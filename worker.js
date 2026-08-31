/**
 * STŘEDOŠKOLSKÁ LUPA — serverová část webu
 * ---------------------------------------------------------------
 * Dělá dvě věci:
 *
 * 1) Chrání administraci heslem. Kontrola běží na Cloudflare ještě
 *    dřív, než se cokoli pošle do prohlížeče — obejít ji nejde.
 *    Heslo se nastavuje v Cloudflare (Settings → Variables and
 *    Secrets) jako ADMIN_HESLO, volitelně i ADMIN_JMENO.
 *    Dokud heslo nastavené není, administrace se nevydá nikomu.
 *
 * 2) Umí publikovat obsah z administrace rovnou na web — uloží
 *    změnu do repozitáře na GitHubu, odkud si ji Cloudflare sám
 *    vyzvedne a web přestaví. K tomu potřebuje GITHUB_TOKEN
 *    (oprávnění „Contents: read and write" na tenhle repozitář).
 */

// co je součástí administrace a musí být pod heslem
const ADMIN_CESTY = /^\/(admin(\.html)?$|admin\/|js\/admin|css\/admin)/i;

// pomocné soubory, které na web nepatří (wrangler je z nahrávání nevynechá)
const SKRYTE_SOUBORY = /^\/(\.git|\.gitignore|\.assetsignore|\.dev\.vars|package(-lock)?\.json|wrangler\.jsonc?|worker\.js)/i;

// soubory, které smí administrace publikovat — nic jiného
const POVOLENE_SOUBORY = ["js/data.js", "js/admin-ucty.js"];

const VYCHOZI_REPO = "WebberStudio/stredoskolska-lupa";
const VYCHOZI_VETEV = "main";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cesta = url.pathname;

    // --- publikování obsahu z administrace ---
    if (cesta === "/admin/publikovat") {
      if (!maPristup(request, env)) return vyzvaKPrihlaseni();
      if (request.method !== "POST") {
        return odpovedJson({ chyba: "Očekává se POST." }, 405);
      }
      return publikovat(request, env);
    }

    // --- pomocné soubory ven nepatří ---
    if (SKRYTE_SOUBORY.test(cesta)) {
      return new Response("Nenalezeno", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // --- administrace: jen pro toho, kdo zná heslo ---
    if (ADMIN_CESTY.test(cesta)) {
      if (!maPristup(request, env)) return vyzvaKPrihlaseni();
      const odpoved = await env.ASSETS.fetch(request);
      const upravena = new Response(odpoved.body, odpoved);
      upravena.headers.set("Cache-Control", "no-store");
      upravena.headers.set("X-Robots-Tag", "noindex, nofollow");
      return upravena;
    }

    // --- všechno ostatní je běžný web ---
    return env.ASSETS.fetch(request);
  },
};

/* ============================================================
   Přihlášení
   ============================================================ */

function vyzvaKPrihlaseni() {
  return new Response(
    "Administrace je chráněná heslem.\n\n" +
    "Pokud sem nepatříte, pokračujte na https://www.stredoskolska-lupa.cz",
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Administrace Stredoskolska lupa", charset="UTF-8"',
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );
}

/** Ověří hlavičku Authorization proti heslu uloženému v Cloudflare. */
function maPristup(request, env) {
  const heslo = env.ADMIN_HESLO;
  // bez nastaveného hesla radši nepustíme nikoho
  if (!heslo) return false;

  const hlavicka = request.headers.get("Authorization") || "";
  if (!hlavicka.startsWith("Basic ")) return false;

  let prihlaseni;
  try {
    prihlaseni = atob(hlavicka.slice(6));
  } catch (e) {
    return false;
  }

  const del = prihlaseni.indexOf(":");
  if (del < 0) return false;

  return shodne(prihlaseni.slice(0, del), env.ADMIN_JMENO || "admin") &&
         shodne(prihlaseni.slice(del + 1), heslo);
}

/** Porovnání v konstantním čase — neprozradí, kolik znaků sedí. */
function shodne(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let rozdil = 0;
  for (let i = 0; i < x.length; i++) rozdil |= x[i] ^ y[i];
  return rozdil === 0;
}

/* ============================================================
   Publikování na web (zápis do repozitáře na GitHubu)
   ============================================================ */

async function publikovat(request, env) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return odpovedJson({
      chyba: "Publikování zatím není nastavené — v Cloudflare chybí GITHUB_TOKEN.",
    }, 501);
  }

  let telo;
  try {
    telo = await request.json();
  } catch (e) {
    return odpovedJson({ chyba: "Nečitelná data." }, 400);
  }

  const soubor = String(telo && telo.soubor || "");
  const obsah = telo && telo.obsah;

  if (POVOLENE_SOUBORY.indexOf(soubor) < 0) {
    return odpovedJson({ chyba: "Tenhle soubor publikovat nelze: " + soubor }, 400);
  }
  if (typeof obsah !== "string" || !obsah.trim()) {
    return odpovedJson({ chyba: "Obsah souboru je prázdný." }, 400);
  }

  const repo = env.GITHUB_REPO || VYCHOZI_REPO;
  const vetev = env.GITHUB_VETEV || VYCHOZI_VETEV;
  const adresa = "https://api.github.com/repos/" + repo + "/contents/" + soubor;
  const hlavicky = {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "User-Agent": "stredoskolska-lupa-admin",
    "Content-Type": "application/json",
  };

  try {
    // GitHub vyžaduje otisk současné verze souboru, aby nepřepsal cizí změnu
    let sha;
    const stavajici = await fetch(adresa + "?ref=" + encodeURIComponent(vetev), { headers: hlavicky });
    if (stavajici.status === 200) {
      sha = (await stavajici.json()).sha;
    } else if (stavajici.status !== 404) {
      return odpovedJson({
        chyba: "GitHub odmítl přístup (" + stavajici.status + "). Zkontrolujte oprávnění tokenu.",
      }, 502);
    }

    const zapis = await fetch(adresa, {
      method: "PUT",
      headers: hlavicky,
      body: JSON.stringify({
        message: (telo.zprava || "Aktualizace obsahu z administrace").slice(0, 200),
        content: naBase64(obsah),
        branch: vetev,
        sha: sha,
      }),
    });

    if (!zapis.ok) {
      const detail = await zapis.text();
      return odpovedJson({
        chyba: "Uložení na GitHub selhalo (" + zapis.status + ").",
        detail: detail.slice(0, 300),
      }, 502);
    }

    const vysledek = await zapis.json();
    return odpovedJson({
      ok: true,
      commit: vysledek.commit && vysledek.commit.sha ? vysledek.commit.sha.slice(0, 7) : "",
      soubor: soubor,
    });
  } catch (e) {
    return odpovedJson({ chyba: "Spojení s GitHubem selhalo: " + (e && e.message ? e.message : e) }, 502);
  }
}

/** Text (i s diakritikou) na base64, jak ho GitHub API očekává. */
function naBase64(text) {
  const bajty = new TextEncoder().encode(text);
  let binarne = "";
  for (let i = 0; i < bajty.length; i++) binarne += String.fromCharCode(bajty[i]);
  return btoa(binarne);
}

function odpovedJson(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
