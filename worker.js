/**
 * STŘEDOŠKOLSKÁ LUPA — serverová část webu
 * ---------------------------------------------------------------
 * Veřejný web běží jako obyčejné statické stránky. Tenhle skript
 * se stará o tři věci navíc:
 *
 * 1) PŘIHLÁŠENÍ DO ADMINISTRACE. Účty (e-mail + otisk hesla) žijí
 *    v úložišti Cloudflare KV — ne v souboru na webu. Kontrola běží
 *    na serveru, takže ji z prohlížeče nejde obejít.
 *
 * 2) SPRÁVA ÚČTŮ. Přidání kolegy, změna vlastního hesla i odebrání
 *    přístupu se dělá v administraci a hned se to zapíše do KV.
 *
 * 3) PUBLIKOVÁNÍ. Administrace uloží obsah (js/data.js a fotky škol)
 *    rovnou do KV a web ho odtud čte. Žádný GitHub, žádný token,
 *    žádné přestavování — změna je venku do minuty.
 *
 *    KDE JE OBSAH: js/data.js v repozitáři je jen VÝCHOZÍ STAV a
 *    záloha. Jakmile se z administrace jednou publikuje, platí verze
 *    v KV (klíč web:js/data.js) a soubor v repozitáři se na webu
 *    neprojeví. Chcete-li obsah upravit ručně, buď přes administraci,
 *    nebo zapsat do KV (wrangler kv key put …). Záloha aktuálního
 *    obsahu: /admin/api/export (po přihlášení) nebo wrangler kv key get.
 *
 * Co je potřeba nastavit v Cloudflare:
 *   ADMIN_KLIC  — zakládací klíč (Settings → Variables and Secrets,
 *                 typ Secret). Vytvoří první účet, obnovuje heslo.
 *   ADMIN_KV    — KV namespace „stredoskolska-lupa-admin" (binding
 *                 ve wrangler.jsonc). Drží účty i publikovaný obsah.
 *
 * Poznámka k heslům: heslo se na server nikdy neposílá. Prohlížeč
 * z něj spočítá otisk (PBKDF2-SHA256, 250 000 opakování) a posílá
 * jen ten; server si ukládá otisk otisku. I kdyby někdo získal
 * obsah úložiště, hesla z něj nedostane.
 */

/* soubory administrace — bez přihlášení se nevydají */
const ADMIN_CESTY = /^\/(admin(\.html)?$|admin\/|js\/admin|css\/admin)/i;

/* pomocné soubory, které na web nepatří (wrangler je z nahrávání nevynechá) */
const SKRYTE_SOUBORY = /^\/(\.git|\.gitignore|\.assetsignore|\.dev\.vars|package(-lock)?\.json|wrangler\.jsonc?|worker\.js)/i;

/* soubory, které smí administrace publikovat — nic jiného */
const POVOLENE_SOUBORY = ["js/data.js"];

/* a k tomu fotky škol (jen do assets/skoly/, jen obrázky, max ~6 MB) */
const POVOLENE_OBRAZKY = /^assets\/skoly\/[a-z0-9][a-z0-9._-]{0,60}\.(jpe?g|png|webp|avif)$/;
const MAX_OBRAZEK = 8 * 1024 * 1024;   // délka base64, tj. zhruba 6 MB souboru

/* publikovaný obsah leží v KV pod klíčem web:<cesta souboru> */
const PREFIX_OBSAHU = "web:";
const SOUBOR_DAT = "js/data.js";

const KLIC_UCTY = "ucty";
const COOKIE = "lupa_relace";
const PLATNOST_H = 8;        // jak dlouho vydrží přihlášení
const MIN_ITERACE = 100000;  // minimální síla otisku, kterou přijmeme

export default {
  async fetch(request, env) {
    const cesta = new URL(request.url).pathname;

    // --- rozhraní administrace ---
    if (cesta.startsWith("/admin/api/")) return api(request, env, cesta);
    if (cesta === "/admin/publikovat") {
      const relace = await overRelaci(request, env);
      if (!relace) return json({ chyba: "Nejste přihlášeni." }, 401);
      if (request.method !== "POST") return json({ chyba: "Očekává se POST." }, 405);
      try {
        return await publikovat(request, env, relace);
      } catch (e) {
        return json({ chyba: "Chyba serveru: " + popisChyby(e) }, 500);
      }
    }

    // --- pomocné soubory ven nepatří ---
    if (SKRYTE_SOUBORY.test(cesta)) return prosteNenalezeno();

    // --- administrace: jen pro přihlášené ---
    if (ADMIN_CESTY.test(cesta)) {
      if (!(await overRelaci(request, env))) {
        // na samotnou adresu /admin ukážeme přihlašovací obrazovku,
        // na její soubory (skripty, styly) neukazujeme vůbec nic
        const hlavni = /^\/admin(\.html)?\/?$/i.test(cesta);
        return hlavni ? prihlasovaciStranka(env) : prosteNenalezeno();
      }
      const odpoved = await env.ASSETS.fetch(request);
      const upravena = new Response(odpoved.body, odpoved);
      upravena.headers.set("Cache-Control", "no-store");
      upravena.headers.set("X-Robots-Tag", "noindex, nofollow");
      return upravena;
    }

    // --- obsah publikovaný z administrace má přednost před souborem v repozitáři ---
    const soubor = cesta.slice(1);
    if (env.ADMIN_KV && (soubor === SOUBOR_DAT || POVOLENE_OBRAZKY.test(soubor))) {
      const zUloziste = await obsahZUloziste(request, env, soubor);
      if (zUloziste) return zUloziste;
    }

    // --- všechno ostatní je běžný veřejný web ---
    return env.ASSETS.fetch(request);
  },
};

/* ============================================================
   Rozhraní administrace (/admin/api/…)
   ============================================================ */

async function api(request, env, cesta) {
  const jenCteni = cesta === "/admin/api/ucty" || cesta === "/admin/api/stav-obsahu" ||
                   cesta === "/admin/api/export";
  if (request.method !== "POST" && !jenCteni) {
    return json({ chyba: "Očekává se POST." }, 405);
  }
  if (!env.ADMIN_KV) {
    return json({ chyba: "Úložiště účtů není v Cloudflare připojené (chybí binding ADMIN_KV)." }, 501);
  }

  let telo = {};
  if (request.method === "POST") {
    try { telo = await request.json(); } catch (e) { telo = {}; }
  }

  try {
    switch (cesta) {
      case "/admin/api/sul":        return await dejSul(env, telo);
      case "/admin/api/prihlaseni": return await prihlaseni(env, telo);
      case "/admin/api/zalozeni":   return await zalozeni(env, telo);
      case "/admin/api/odhlaseni":  return odhlaseni();
      case "/admin/api/ucty":       return await ucty(request, env, telo);
      case "/admin/api/ucty/heslo": return await zmenaHesla(request, env, telo);
      case "/admin/api/ucty/smazat":return await smazaniUctu(request, env, telo);
      case "/admin/api/stav-obsahu":return await stavObsahu(request, env);
      case "/admin/api/export":     return await exportObsahu(request, env);
      case "/admin/api/zkouska":    return await zkouskaPublikovani(request, env);
      default: return json({ chyba: "Neznámý požadavek." }, 404);
    }
  } catch (e) {
    // ať uživatel místo bílé stránky uvidí, co se pokazilo
    return json({ chyba: "Chyba serveru: " + (e && e.message ? e.message : e) }, 500);
  }
}

/** Sůl k danému e-mailu. Neznámý e-mail dostane vymyšlenou, ale vždy
    stejnou sůl — aby se z odpovědi nedalo vyčíst, kdo tu účet má. */
async function dejSul(env, telo) {
  const email = normEmail(telo.email);
  if (!email) return json({ chyba: "Chybí e-mail." }, 400);

  const seznam = await nactiUcty(env);
  const u = seznam.find((x) => x.email === email);
  if (u) return json({ sul: u.sul, iterace: u.iterace || 250000 });

  const falesna = await hmacHex(env, "sul:" + email);
  return json({ sul: falesna.slice(0, 32), iterace: 250000 });
}

async function prihlaseni(env, telo) {
  const email = normEmail(telo.email);
  const otisk = String(telo.otisk || "");
  if (!email || !/^[0-9a-f]{64}$/.test(otisk)) {
    return json({ chyba: "Neúplné přihlašovací údaje." }, 400);
  }

  const seznam = await nactiUcty(env);
  const u = seznam.find((x) => x.email === email);
  const overovac = await sha256hex(otisk);

  // i u neznámého e-mailu doběhneme stejnou cestou, ať to trvá stejně dlouho
  if (!u || !shodne(overovac, u.overovac)) {
    return json({ chyba: "E-mail nebo heslo nesouhlasí." }, 401);
  }
  return json({ ok: true, email: u.email }, 200, await cookieRelace(env, u.email));
}

/** Založení prvního účtu i obnova zapomenutého hesla — obojí proti
    zakládacímu klíči, který je uložený jen v Cloudflare. */
async function zalozeni(env, telo) {
  const klic = env.ADMIN_KLIC || env.ADMIN_HESLO;   // ADMIN_HESLO = starší název
  if (!klic) {
    return json({ chyba: "Zakládací klíč není v Cloudflare nastavený (proměnná ADMIN_KLIC)." }, 501);
  }
  if (!shodne(String(telo.klic || ""), klic)) {
    return json({ chyba: "Zakládací klíč nesouhlasí." }, 403);
  }

  const novy = zkontrolujUcet(telo);
  if (novy.chyba) return json({ chyba: novy.chyba }, 400);

  const seznam = await nactiUcty(env);
  const i = seznam.findIndex((x) => x.email === novy.ucet.email);
  if (i >= 0) {
    // účet existuje → jde o obnovu hesla, zbytek (datum vzniku) necháme
    novy.ucet.vytvoren = seznam[i].vytvoren;
    seznam[i] = novy.ucet;
  } else {
    seznam.push(novy.ucet);
  }
  await ulozUcty(env, seznam);

  return json({ ok: true, email: novy.ucet.email, obnova: i >= 0 },
               200, await cookieRelace(env, novy.ucet.email));
}

function odhlaseni() {
  return json({ ok: true }, 200,
    COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
}

/** GET = seznam účtů, POST = přidání dalšího. */
async function ucty(request, env, telo) {
  const relace = await overRelaci(request, env);
  if (!relace) return json({ chyba: "Nejste přihlášeni." }, 401);

  const seznam = await nactiUcty(env);

  if (request.method === "GET") return json({ ok: true, ja: relace.email, ucty: verejne(seznam) });

  const novy = zkontrolujUcet(telo);
  if (novy.chyba) return json({ chyba: novy.chyba }, 400);
  if (seznam.some((x) => x.email === novy.ucet.email)) {
    return json({ chyba: "Účet s tímhle e-mailem už existuje." }, 409);
  }

  seznam.push(novy.ucet);
  await ulozUcty(env, seznam);
  return json({ ok: true, ja: relace.email, ucty: verejne(seznam) });
}

async function zmenaHesla(request, env, telo) {
  const relace = await overRelaci(request, env);
  if (!relace) return json({ chyba: "Nejste přihlášeni." }, 401);

  const novy = zkontrolujUcet({ email: relace.email, sul: telo.sul, iterace: telo.iterace, overovac: telo.overovac });
  if (novy.chyba) return json({ chyba: novy.chyba }, 400);

  const seznam = await nactiUcty(env);
  const i = seznam.findIndex((x) => x.email === relace.email);
  if (i < 0) return json({ chyba: "Váš účet už v seznamu není." }, 404);

  novy.ucet.vytvoren = seznam[i].vytvoren;
  seznam[i] = novy.ucet;
  await ulozUcty(env, seznam);
  return json({ ok: true, ja: relace.email, ucty: verejne(seznam) });
}

async function smazaniUctu(request, env, telo) {
  const relace = await overRelaci(request, env);
  if (!relace) return json({ chyba: "Nejste přihlášeni." }, 401);

  const email = normEmail(telo.email);
  if (email === relace.email) return json({ chyba: "Vlastní účet smazat nelze." }, 400);

  const seznam = await nactiUcty(env);
  const zbytek = seznam.filter((x) => x.email !== email);
  if (zbytek.length === seznam.length) return json({ chyba: "Takový účet tu není." }, 404);
  if (!zbytek.length) return json({ chyba: "Poslední účet smazat nelze." }, 400);

  await ulozUcty(env, zbytek);
  return json({ ok: true, ja: relace.email, ucty: verejne(zbytek) });
}

/* ============================================================
   Účty v úložišti
   ============================================================ */

async function nactiUcty(env) {
  try {
    const data = await env.ADMIN_KV.get(KLIC_UCTY, "json");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function ulozUcty(env, seznam) {
  return env.ADMIN_KV.put(KLIC_UCTY, JSON.stringify(seznam));
}

/** Ven jde jen e-mail a datum — sůl ani otisk nikoho nezajímají. */
function verejne(seznam) {
  return seznam.map((u) => ({ email: u.email, vytvoren: u.vytvoren }));
}

/** Ověří, že přišel použitelný účet, a poskládá ho k uložení. */
function zkontrolujUcet(telo) {
  const email = normEmail(telo && telo.email);
  const sul = String((telo && telo.sul) || "");
  const overovac = String((telo && telo.overovac) || "");
  const iterace = parseInt((telo && telo.iterace) || 0, 10);

  if (!email || email.indexOf("@") < 1) return { chyba: "Neplatný e-mail." };
  if (!/^[0-9a-f]{32}$/.test(sul)) return { chyba: "Poškozená data přihlášení (sůl)." };
  if (!/^[0-9a-f]{64}$/.test(overovac)) return { chyba: "Poškozená data přihlášení (otisk)." };
  if (!(iterace >= MIN_ITERACE)) return { chyba: "Otisk hesla je příliš slabý." };

  return {
    ucet: {
      email: email,
      sul: sul,
      iterace: iterace,
      overovac: overovac,
      vytvoren: new Date().toISOString().slice(0, 10),
    },
  };
}

const normEmail = (s) => String(s || "").trim().toLowerCase();

/* ============================================================
   Relace (přihlášení drží podepsaná cookie)
   ============================================================ */

async function cookieRelace(env, email) {
  const platnost = Date.now() + PLATNOST_H * 3600 * 1000;
  const obsah = b64url(new TextEncoder().encode(JSON.stringify({ e: email, do: platnost })));
  const token = obsah + "." + (await hmacHex(env, obsah));
  return COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" +
         PLATNOST_H * 3600;
}

async function overRelaci(request, env) {
  const klic = env.ADMIN_KLIC || env.ADMIN_HESLO;
  if (!klic) return null;   // bez klíče nemá co podepisovat — nikoho nepustíme

  const hlavicka = request.headers.get("Cookie") || "";
  const nalez = hlavicka.match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  if (!nalez) return null;

  const kusy = nalez[1].split(".");
  if (kusy.length !== 2) return null;
  if (!shodne(kusy[1], await hmacHex(env, kusy[0]))) return null;

  try {
    const data = JSON.parse(new TextDecoder().decode(zB64url(kusy[0])));
    if (!data || !data.e || !(Date.now() < data.do)) return null;
    return { email: data.e };
  } catch (e) {
    return null;
  }
}

/* ============================================================
   Publikovaný obsah (KV)
   ------------------------------------------------------------
   Klíč web:js/data.js drží celý obsah webu, web:assets/skoly/…
   fotky škol. U každého záznamu je v metadatech otisk (ETag),
   typ, kdy a kdo ho publikoval.
   ============================================================ */

/** Vydá soubor z KV, když tam je. Jinak null a web sáhne do repozitáře. */
async function obsahZUloziste(request, env, soubor) {
  const zaznam = await env.ADMIN_KV.getWithMetadata(PREFIX_OBSAHU + soubor, { type: "arrayBuffer" });
  if (!zaznam || !zaznam.value) return null;

  const meta = zaznam.metadata || {};
  const otisk = meta.otisk || hex(await crypto.subtle.digest("SHA-256", zaznam.value)).slice(0, 32);
  const etag = '"' + otisk + '"';
  const jeData = soubor === SOUBOR_DAT;

  const hlavicky = {
    "Content-Type": jeData ? "text/javascript; charset=utf-8" : (meta.typ || typPodlePripony(soubor)),
    // data.js: prohlížeč se vždycky zeptá, jestli nemáme novější (a dostane 304, když ne);
    // fotky se mění zřídka, těm stačí den
    "Cache-Control": jeData ? "public, max-age=0, must-revalidate" : "public, max-age=86400",
    "ETag": etag,
    "X-Content-Type-Options": "nosniff",
    "X-Zdroj-Obsahu": "administrace",
  };

  const podminka = (request.headers.get("If-None-Match") || "").replace(/^W\//, "");
  if (podminka === etag) return new Response(null, { status: 304, headers: hlavicky });
  return new Response(zaznam.value, { status: 200, headers: hlavicky });
}

async function publikovat(request, env, relace) {
  if (!env.ADMIN_KV) {
    return json({ chyba: "Úložiště obsahu není v Cloudflare připojené (chybí binding ADMIN_KV)." }, 501);
  }

  let telo;
  try {
    telo = await request.json();
  } catch (e) {
    return json({ chyba: "Nečitelná data." }, 400);
  }

  const soubor = String((telo && telo.soubor) || "");
  const obsah = telo && telo.obsah;
  const jeObrazek = POVOLENE_OBRAZKY.test(soubor);

  if (POVOLENE_SOUBORY.indexOf(soubor) < 0 && !jeObrazek) {
    return json({ chyba: "Tenhle soubor publikovat nelze: " + soubor }, 400);
  }
  if (typeof obsah !== "string" || !obsah.trim()) {
    return json({ chyba: "Obsah souboru je prázdný." }, 400);
  }

  let bajty, typ;
  if (jeObrazek) {
    // obrázek chodí v base64 — ověříme, že to base64 opravdu je
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(obsah)) {
      return json({ chyba: "Poškozená data obrázku." }, 400);
    }
    if (obsah.length > MAX_OBRAZEK) {
      return json({ chyba: "Fotka je moc velká — zmenšete ji pod 6 MB." }, 413);
    }
    bajty = zB64url(obsah);
    typ = typPodlePripony(soubor);
  } else {
    const potiz = zkontrolujDataJs(obsah);
    if (potiz) return json({ chyba: potiz }, 400);

    // Dva lidé v administraci naráz: kdo publikuje nad starší verzí,
    // než je venku, nesmí tu novější tiše přepsat.
    const soucasny = await env.ADMIN_KV.getWithMetadata(PREFIX_OBSAHU + soubor);
    const platna = (soucasny && soucasny.metadata && soucasny.metadata.otisk) || "";
    if (telo.verze !== undefined && telo.verze !== null && platna && String(telo.verze) !== platna) {
      return json({
        chyba: "Venku je novější verze obsahu, než nad kterou jste pracovali. Načtěte administraci " +
               "znovu (F5); pokud upozornění zůstane, dejte Zahodit změny a zadejte je znovu — " +
               "jinak byste přepsali, co mezitím publikoval někdo jiný.",
      }, 409);
    }
    bajty = new TextEncoder().encode(obsah);
    typ = "text/javascript; charset=utf-8";
  }

  const otisk = hex(await crypto.subtle.digest("SHA-256", bajty)).slice(0, 32);
  await env.ADMIN_KV.put(PREFIX_OBSAHU + soubor, bajty, {
    metadata: {
      otisk: otisk,
      typ: typ,
      kdy: new Date().toISOString(),
      kdo: relace.email,
      velikost: bajty.byteLength,
    },
  });

  return json({ ok: true, soubor: soubor, verze: otisk });
}

/** Zkouška nanečisto: projde totéž co publikování, ale nic na webu nezmění.
    Zapíše a hned smaže zkušební klíč, ať je jasné, že úložiště opravdu bere zápisy. */
async function zkouskaPublikovani(request, env) {
  const relace = await overRelaci(request, env);
  if (!relace) return json({ chyba: "Nejste přihlášeni." }, 401);

  const kroky = [{ nazev: "Přihlášení", ok: true, popis: "Přihlášeni jako " + relace.email + "." }];

  // 1) úložiště bere zápisy i čtení
  const klic = PREFIX_OBSAHU + "_zkouska";
  const razitko = String(Date.now());
  try {
    await env.ADMIN_KV.put(klic, razitko, { expirationTtl: 120 });
    const zpet = await env.ADMIN_KV.get(klic);
    await env.ADMIN_KV.delete(klic);
    kroky.push(zpet === razitko
      ? { nazev: "Úložiště obsahu", ok: true, popis: "Zkušební zápis i čtení prošly." }
      : { nazev: "Úložiště obsahu", ok: false,
          popis: "Zápis prošel, ale čtení vrátilo něco jiného — zkuste to za minutu znovu." });
  } catch (e) {
    kroky.push({ nazev: "Úložiště obsahu", ok: false, popis: "Zápis selhal: " + popisChyby(e) });
  }

  // 2) co je právě venku
  let verze = "";
  try {
    const zaznam = await env.ADMIN_KV.getWithMetadata(PREFIX_OBSAHU + SOUBOR_DAT, { type: "arrayBuffer" });
    const meta = (zaznam && zaznam.metadata) || {};
    if (zaznam && zaznam.value) {
      verze = meta.otisk || "";
      kroky.push({ nazev: "Co je právě venku", ok: true,
                   popis: "Obsah publikovaný z administrace" +
                          (meta.kdy ? " (" + meta.kdy.slice(0, 16).replace("T", " ") + " UTC" : "") +
                          (meta.kdo ? ", " + meta.kdo : "") + (meta.kdy ? ")" : "") + "." });
    } else {
      kroky.push({ nazev: "Co je právě venku", ok: true,
                   popis: "Výchozí obsah ze souborů webu — z administrace se zatím nepublikovalo." });
    }
  } catch (e) {
    kroky.push({ nazev: "Co je právě venku", ok: false, popis: "Nepodařilo se zjistit: " + popisChyby(e) });
  }

  return json({ ok: true, kroky: kroky, verze: verze });
}

/** Co je právě venku: odkud se obsah bere, kdy a kdo ho publikoval. */
async function stavObsahu(request, env) {
  if (!(await overRelaci(request, env))) return json({ chyba: "Nejste přihlášeni." }, 401);

  const zaznam = await env.ADMIN_KV.getWithMetadata(PREFIX_OBSAHU + SOUBOR_DAT, { type: "arrayBuffer" });
  const meta = (zaznam && zaznam.metadata) || {};
  const vKv = !!(zaznam && zaznam.value);
  return json({
    ok: true,
    zdroj: vKv ? "uloziste" : "soubor",
    verze: vKv ? (meta.otisk || "") : "",
    kdy: meta.kdy || "",
    kdo: meta.kdo || "",
    velikost: vKv ? (meta.velikost || zaznam.value.byteLength) : 0,
  });
}

/** Aktuální data.js ke stažení — záloha toho, co je právě na webu. */
async function exportObsahu(request, env) {
  if (!(await overRelaci(request, env))) return json({ chyba: "Nejste přihlášeni." }, 401);

  let text = await env.ADMIN_KV.get(PREFIX_OBSAHU + SOUBOR_DAT, "text");
  if (!text) {
    const zRepa = await env.ASSETS.fetch(new Request(new URL("/" + SOUBOR_DAT, request.url)));
    text = zRepa.ok ? await zRepa.text() : "";
  }
  const datum = new Date().toISOString().slice(0, 10);
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Disposition": 'attachment; filename="data-' + datum + '.js"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/** Než pustíme data.js na web: musí obsahovat všechny části, jinak by web zčernal. */
function zkontrolujDataJs(text) {
  for (const cast of ["NASTAVENI", "KRAJE", "TYPY_SKOL", "SKOLY", "CLANKY"]) {
    if (!new RegExp("\\bconst\\s+" + cast + "\\s*=").test(text)) {
      return "V obsahu chybí část " + cast + " — soubor vypadá poškozeně, nepublikuji ho.";
    }
  }
  if (text.length > 4 * 1024 * 1024) return "Obsah je podezřele velký (přes 4 MB) — nepublikuji ho.";
  return "";
}

function typPodlePripony(soubor) {
  const pripona = (soubor.match(/\.([a-z0-9]+)$/i) || ["", ""])[1].toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" }[pripona]
    || "application/octet-stream";
}

const popisChyby = (e) => (e && e.message ? e.message : String(e));

/* ============================================================
   Drobnosti
   ============================================================ */

/** Porovnání v konstantním čase — neprozradí, kolik znaků sedí. */
function shodne(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(String(a || ""));
  const y = enc.encode(String(b || ""));
  if (x.length !== y.length) return false;
  let rozdil = 0;
  for (let i = 0; i < x.length; i++) rozdil |= x[i] ^ y[i];
  return rozdil === 0;
}

async function hmacHex(env, zprava) {
  const tajemstvi = env.ADMIN_KLIC || env.ADMIN_HESLO || "";
  const klic = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode("lupa-relace:" + tajemstvi),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const podpis = await crypto.subtle.sign("HMAC", klic, new TextEncoder().encode(zprava));
  return hex(podpis);
}

async function sha256hex(text) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

function hex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(bajty) {
  let s = "";
  for (let i = 0; i < bajty.length; i++) s += String.fromCharCode(bajty[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function zB64url(text) {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function json(data, status, cookie) {
  const hlavicky = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (cookie) hlavicky["Set-Cookie"] = cookie;
  return new Response(JSON.stringify(data), { status: status || 200, headers: hlavicky });
}

function prosteNenalezeno() {
  return new Response("Nenalezeno", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/* ============================================================
   Přihlašovací obrazovka
   ============================================================ */

async function prihlasovaciStranka(env) {
  const klicNastaven = !!(env.ADMIN_KLIC || env.ADMIN_HESLO);
  const uloziste = !!env.ADMIN_KV;
  const seznam = uloziste ? await nactiUcty(env) : [];

  return new Response(prihlasovaciHtml({
    nastaveno: seznam.length > 0,
    klicNastaven: klicNastaven,
    uloziste: uloziste,
  }), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      // přihlašovací formulář nemá co dělat v cizím rámu
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function prihlasovaciHtml(stav) {
  const potiz = !stav.uloziste
    ? "Úložiště účtů není připojené. V Cloudflare chybí binding <strong>ADMIN_KV</strong>."
    : !stav.klicNastaven
      ? "Zakládací klíč není nastavený. V Cloudflare doplňte tajnou proměnnou <strong>ADMIN_KLIC</strong>."
      : "";

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Přihlášení · Středoškolská lupa</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="stylesheet" href="/css/style.css">
<style>
  body { background:#0B1F3D; min-height:100vh; display:grid; place-items:center;
         padding:32px 20px; font-family:"Archivo",system-ui,sans-serif; color:#0B1F3D; }
  .karta { width:100%; max-width:420px; background:#FBF3DE; border:2px solid #0B1F3D;
           box-shadow:10px 10px 0 rgba(0,0,0,.35); padding:34px 30px 30px; }
  .karta img { display:block; margin:0 auto 14px; width:88px; height:88px; object-fit:contain; }
  .oko { font:700 12px/1 "Archivo",sans-serif; letter-spacing:.16em; text-transform:uppercase;
         color:#F26B1D; text-align:center; margin:0 0 6px; }
  h1 { font-family:"Anton",Impact,sans-serif; font-weight:400; font-size:30px; line-height:1.1;
       text-transform:uppercase; text-align:center; margin:0 0 10px; letter-spacing:.01em; }
  p.popis { font-size:14px; line-height:1.55; color:#4a5568; text-align:center; margin:0 0 22px; }
  label { display:block; font-weight:700; font-size:13px; margin:0 0 5px; }
  input { width:100%; box-sizing:border-box; padding:11px 12px; font:400 15px/1.2 "Archivo",sans-serif;
          border:2px solid #0B1F3D; background:#fff; color:#0B1F3D; }
  input:focus { outline:3px solid #F26B1D; outline-offset:1px; }
  .pole { margin:0 0 14px; }
  button { width:100%; padding:13px 16px; margin-top:6px; cursor:pointer;
           font:700 14px/1 "Archivo",sans-serif; letter-spacing:.08em; text-transform:uppercase;
           background:#F26B1D; color:#fff; border:2px solid #0B1F3D; box-shadow:4px 4px 0 #0B1F3D; }
  button:hover:not(:disabled) { transform:translate(-1px,-1px); box-shadow:5px 5px 0 #0B1F3D; }
  button:disabled { opacity:.6; cursor:progress; }
  .hlaska { margin:0 0 14px; padding:10px 12px; border:2px solid #b3261e; background:#fdecea;
            color:#7f1d17; font-size:13.5px; line-height:1.5; }
  .hlaska.info { border-color:#0B1F3D; background:#eef2f8; color:#0B1F3D; }
  .pozn { margin:18px 0 0; font-size:12.5px; line-height:1.55; color:#6b7280; text-align:center; }
  .pozn a { color:#0B1F3D; }
  .zpet { display:block; text-align:center; margin-top:14px; font-size:12.5px; color:#6b7280; }
</style>
</head>
<body>
<main class="karta">
  <img src="/assets/logo.png" alt="Středoškolská lupa">
  <p class="oko">Administrace</p>
  <h1 id="nadpis">Přihlášení</h1>
  <p class="popis" id="popis">Zadejte e-mail a heslo, kterým spravujete obsah webu.</p>

  ${potiz ? '<p class="hlaska">' + potiz + "</p>" : ""}
  <p class="hlaska" id="chyba" hidden></p>

  <form id="form" novalidate>
    <div class="pole">
      <label for="email">E-mail</label>
      <input id="email" type="email" autocomplete="username" required>
    </div>
    <div class="pole">
      <label for="heslo">Heslo</label>
      <input id="heslo" type="password" autocomplete="current-password" required>
    </div>
    <div class="pole" id="pole-heslo2" hidden>
      <label for="heslo2">Heslo ještě jednou</label>
      <input id="heslo2" type="password" autocomplete="new-password">
    </div>
    <div class="pole" id="pole-klic" hidden>
      <label for="klic">Zakládací klíč</label>
      <input id="klic" type="password" autocomplete="off">
    </div>
    <button type="submit" id="odeslat">Přihlásit se</button>
  </form>

  <p class="pozn" id="pozn"></p>
  <a class="zpet" href="/">← zpět na web</a>
</main>

<script>
(function () {
  "use strict";
  var NASTAVENO = ${stav.nastaveno ? "true" : "false"};
  var ITERACE = 250000;

  var $ = function (id) { return document.getElementById(id); };
  var rezim = NASTAVENO ? "prihlaseni" : "zalozeni";

  var enc = new TextEncoder();
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf),
      function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function hexNaBajty(s) {
    var out = new Uint8Array(s.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }
  function otisk(heslo, sul, iterace) {
    return crypto.subtle.importKey("raw", enc.encode(heslo), "PBKDF2", false, ["deriveBits"])
      .then(function (k) {
        return crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: hexNaBajty(sul), iterations: iterace, hash: "SHA-256" }, k, 256);
      }).then(hex);
  }
  function novaSul() {
    return hex(crypto.getRandomValues(new Uint8Array(16)));
  }
  function poslat(cesta, data) {
    return fetch(cesta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.chyba || ("Server odpověděl " + r.status));
        return d;
      });
    });
  }
  function chyba(text) {
    var el = $("chyba");
    el.innerHTML = "";
    el.appendChild(document.createTextNode(text));
    el.hidden = false;
  }

  function prekresli() {
    var zaklada = rezim !== "prihlaseni";
    $("nadpis").textContent = rezim === "prihlaseni" ? "Přihlášení"
      : rezim === "obnova" ? "Nový účet nebo nové heslo" : "Nastavte si přístup";
    $("popis").textContent = rezim === "prihlaseni"
      ? "Zadejte e-mail a heslo, kterým spravujete obsah webu."
      : rezim === "obnova"
        ? "Zadejte e-mail, heslo a zakládací klíč. Když u toho e-mailu ještě účet není, založí se; jinak mu heslo nastavíme nové."
        : "Zatím tu není žádný účet. Vyberte si e-mail a heslo — uloží se jen otisk hesla, ne heslo samotné.";
    $("pole-heslo2").hidden = !zaklada;
    $("pole-klic").hidden = !zaklada;
    $("heslo").setAttribute("autocomplete", zaklada ? "new-password" : "current-password");
    $("odeslat").textContent = rezim === "prihlaseni" ? "Přihlásit se"
      : rezim === "obnova" ? "Uložit a vstoupit" : "Vytvořit účet a vstoupit";
    $("chyba").hidden = true;

    var pozn = $("pozn");
    pozn.innerHTML = "";
    if (rezim === "prihlaseni") {
      var a = document.createElement("a");
      a.href = "#";
      a.textContent = "Nový účet nebo zapomenuté heslo?";
      a.addEventListener("click", function (ev) { ev.preventDefault(); rezim = "obnova"; prekresli(); });
      pozn.appendChild(a);
    } else if (rezim === "obnova") {
      var b = document.createElement("a");
      b.href = "#";
      b.textContent = "← zpět na přihlášení";
      b.addEventListener("click", function (ev) { ev.preventDefault(); rezim = "prihlaseni"; prekresli(); });
      pozn.appendChild(b);
    } else {
      pozn.textContent = "Zakládací klíč najdete v Cloudflare jako tajnou proměnnou ADMIN_KLIC.";
    }
  }

  $("form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    $("chyba").hidden = true;

    var email = $("email").value.trim();
    var heslo = $("heslo").value;
    var tl = $("odeslat");

    if (!email || !heslo) { chyba("Vyplňte e-mail i heslo."); return; }

    var zaklada = rezim !== "prihlaseni";
    if (zaklada) {
      if (heslo.length < 8) { chyba("Heslo musí mít aspoň 8 znaků."); return; }
      if (heslo !== $("heslo2").value) { chyba("Hesla se neshodují."); return; }
      if (!$("klic").value) { chyba("Vyplňte zakládací klíč."); return; }
    }

    var puvodni = tl.textContent;
    tl.disabled = true;
    tl.textContent = "Ověřuji…";

    var prace;
    if (zaklada) {
      var sul = novaSul();
      prace = otisk(heslo, sul, ITERACE)
        .then(function (o) { return crypto.subtle.digest("SHA-256", enc.encode(o)); })
        .then(function (d) {
          return poslat("/admin/api/zalozeni", {
            email: email, sul: sul, iterace: ITERACE, overovac: hex(d), klic: $("klic").value,
          });
        });
    } else {
      prace = poslat("/admin/api/sul", { email: email })
        .then(function (d) { return otisk(heslo, d.sul, d.iterace || ITERACE); })
        .then(function (o) { return poslat("/admin/api/prihlaseni", { email: email, otisk: o }); });
    }

    prace.then(function () {
      location.replace("/admin");
    }).catch(function (e) {
      chyba(e && e.message ? e.message : String(e));
      $("heslo").value = "";
      tl.disabled = false;
      tl.textContent = puvodni;
    });
  });

  if (!window.crypto || !crypto.subtle) {
    chyba("Prohlížeč neumí bezpečně ověřit heslo. Otevřete administraci přes https adresu.");
    $("odeslat").disabled = true;
  } else {
    prekresli();
    $("email").focus();
  }
})();
</script>
</body>
</html>`;
}
