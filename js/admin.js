/* ============================================================
   STŘEDOŠKOLSKÁ LUPA — ADMINISTRACE
   ------------------------------------------------------------
   Nástroj pro správu obsahu. Veškerý obsah webu je v js/data.js,
   administrace ho edituje — nic víc.

   • Na adrese webu se změny publikují tlačítkem „Publikovat na
     web" — worker.js je uloží do úložiště Cloudflare (KV) a web
     je odtud čte. Stejnou cestou se nahrávají i fotky škol.
     Soubor js/data.js v repozitáři je jen výchozí stav a záloha.
   • Při vývoji na localhostu se místo toho ukládá do složky webu
     (Chrome/Edge) nebo se data.js stáhne.

   Přístup hlídá server — bez přihlášení se tenhle soubor vůbec
   nevydá (viz worker.js a js/admin-auth.js).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Pomocníci ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const bezDiakritiky = (s) =>
    String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const normObec = (s) => bezDiakritiky(s).replace(/[-\s]+/g, " ").trim();

  // kde na mapě leží obec vůči vybranému kraji
  function overObec(kraj, mesto) {
    const n = normObec(mesto);
    if (!n) return { stav: "prazdne" };
    if (typeof OBCE_CR !== "undefined") {
      if (kraj && OBCE_CR[kraj] && OBCE_CR[kraj][n]) return { stav: "ok" };
      const kraje = [];
      for (const k in OBCE_CR) if (OBCE_CR[k][n]) kraje.push(k);
      if (!kraj && kraje.length) return { stav: "ok-bez-kraje" };
      if (kraj && kraje.length) return { stav: "jinde", kraje };
    }
    if (typeof MAPA_CR !== "undefined" && MAPA_CR.mesta[bezDiakritiky(mesto)]) return { stav: "ok" };
    return { stav: "ne" };
  }
  const slug = (s) =>
    bezDiakritiky(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const MESICE = ["ledna", "února", "března", "dubna", "května", "června",
    "července", "srpna", "září", "října", "listopadu", "prosince"];
  const fmtDatum = (iso) => {
    if (!iso) return "";
    const [r, m, d] = iso.split("-").map(Number);
    return d && m ? d + ". " + MESICE[m - 1] + " " + r : iso;
  };
  const dnes = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  function toast(text, typ) {
    const t = document.createElement("div");
    t.className = "toast" + (typ ? " " + typ : "");
    t.textContent = text;
    // chybu si člověk potřebuje přečíst — ta ať zůstane, dokud na ni neklikne
    if (typ === "chyba") {
      t.title = "Kliknutím zavřít";
      t.style.cursor = "pointer";
      t.addEventListener("click", () => t.remove());
    }
    document.body.appendChild(t);
    setTimeout(() => t.remove(), typ === "chyba" ? 20000 : 3200);
  }

  /* ---------- Přihlášený uživatel (předá js/admin-auth.js) ---------- */
  let AUTH = null;

  /* ---------- Stav ---------- */
  const DRAFT_KLIC = "lupaAdminDraft";
  // verze obsahu, ze které rozpracované změny vycházejí — ať poznáme koncept nad zastaralým základem
  const DRAFT_VERZE_KLIC = "lupaAdminDraftVerze";
  let zakladVerze = null;
  try { zakladVerze = localStorage.getItem(DRAFT_VERZE_KLIC) || null; } catch (e) { /* nevadí */ }
  const kopie = (x) => JSON.parse(JSON.stringify(x));

  function stavZWebu() {
    return {
      nastaveni: kopie(NASTAVENI),
      skoly: kopie(SKOLY),
      clanky: kopie(CLANKY),
    };
  }

  let stav = stavZWebu();
  const puvodniJson = JSON.stringify(stav);
  let zDraftu = false;
  try {
    const d = localStorage.getItem(DRAFT_KLIC);
    if (d) {
      const parsed = JSON.parse(d);
      if (parsed && parsed.skoly && parsed.clanky && parsed.nastaveni) {
        if (JSON.stringify(parsed) !== puvodniJson) { stav = parsed; zDraftu = true; }
        else localStorage.removeItem(DRAFT_KLIC);
      }
    }
  } catch (e) { /* poškozený draft ignorujeme */ }

  function ulozDraft() {
    try {
      localStorage.setItem(DRAFT_KLIC, JSON.stringify(stav));
      if (zakladVerze) localStorage.setItem(DRAFT_VERZE_KLIC, zakladVerze);
    } catch (e) { /* plné úložiště */ }
    aktualizujListu();
  }

  /* ---------- Serializace data.js ---------- */
  const jeIdent = (k) => /^[A-Za-z_$][\w$]*$/.test(k);
  function jsVal(v, ind) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      return "[\n" + v.map((x) => ind + "  " + jsVal(x, ind + "  ")).join(",\n") + ",\n" + ind + "]";
    }
    const kl = Object.keys(v);
    if (!kl.length) return "{}";
    return "{\n" + kl.map((k) =>
      ind + "  " + (jeIdent(k) ? k : JSON.stringify(k)) + ": " + jsVal(v[k], ind + "  ")
    ).join(",\n") + ",\n" + ind + "}";
  }

  function generujDataJs() {
    return (
`/* ============================================================
   STŘEDOŠKOLSKÁ LUPA — DATA WEBU
   ------------------------------------------------------------
   Tenhle soubor je celý obsah webu. Nejpohodlněji se edituje
   v administraci (/admin) — ručně jen opatrně.

   Na webu platí verze publikovaná z administrace (úložiště KV);
   soubor v repozitáři je výchozí stav a záloha.
   Vygenerováno administrací ${dnes()}.
   ============================================================ */

/* ---------- Nastavení webu ---------- */
const NASTAVENI = ${jsVal(stav.nastaveni, "")};

/* ---------- Číselníky (neměnit) ---------- */
const KRAJE = ${jsVal(KRAJE, "")};

const TYPY_SKOL = ${jsVal(TYPY_SKOL, "")};

/* ---------- Školy a epizody ---------- */
const SKOLY = ${jsVal(stav.skoly, "")};

/* ---------- Blog ---------- */
const CLANKY = ${jsVal(stav.clanky, "")};
`);
  }

  /* ---------- Publikování rovnou na web (přes server) ----------
     Funguje jen tam, kde běží serverová část — tedy na ostré adrese,
     ne při otevření administrace z disku. */
  const naWebu = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) &&
                 location.protocol !== "file:";

  // poslední krok se na webu jmenuje jinak než v lokální administraci
  const dokonceni = () => naWebu ? "nezapomeňte Publikovat na web" : "nezapomeňte Uložit změny";

  // otisk verze obsahu, nad kterou pracujeme — server odmítne přepsat novější
  let verzeObsahu = null;

  async function nactiStavObsahu() {
    try {
      const o = await fetch("/admin/api/stav-obsahu");
      const d = await o.json();
      if (o.ok && d.ok) { verzeObsahu = d.verze || null; return d; }
    } catch (e) { /* stav je jen informativní */ }
    return null;
  }

  async function publikovatSoubor(cesta, obsah, popis) {
    const odpoved = await fetch("/admin/publikovat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // posíláme verzi, ze které rozpracované změny vycházejí — ne tu, kterou jsme
      // náhodou viděli při načtení; jinak by starý koncept tiše přepsal novější obsah
      body: JSON.stringify({ soubor: cesta, obsah: obsah, zprava: popis, verze: zakladVerze || verzeObsahu }),
    });
    let data = {};
    try { data = await odpoved.json(); } catch (e) { /* prázdná odpověď */ }
    if (!odpoved.ok || !data.ok) {
      throw new Error(data.chyba || ("Server odpověděl " + odpoved.status));
    }
    return data;
  }

  /** Fotku pošleme na web rovnou — obrázek se do data.js nevejde. */
  async function publikovatObrazek(cesta, soubor) {
    const base64 = await new Promise((hotovo, chyba) => {
      const ctecka = new FileReader();
      ctecka.onload = () => hotovo(String(ctecka.result).split(",")[1] || "");
      ctecka.onerror = () => chyba(new Error("Soubor se nepodařilo přečíst."));
      ctecka.readAsDataURL(soubor);
    });
    return publikovatSoubor(cesta, base64, "Fotka školy z administrace");
  }

  async function publikovatVse() {
    const tlacitka = [$("#btn-publikovat"), $("#btn-publikovat-2")].filter(Boolean);
    tlacitka.forEach((b) => { b.disabled = true; b.textContent = "Publikuji…"; });
    try {
      const text = generujDataJs();
      // než to pustíme ven: vygenerovaný soubor musí projít jako JavaScript
      // a vrátit všechny části — jinak by web zčernal
      try {
        const zk = new Function(text + "\nreturn { NASTAVENI, KRAJE, TYPY_SKOL, SKOLY, CLANKY };")();
        if (!zk || !Array.isArray(zk.SKOLY) || !Array.isArray(zk.CLANKY) || !zk.NASTAVENI) {
          throw new Error("chybí část obsahu");
        }
      } catch (e) {
        throw new Error("Vygenerovaný obsah není v pořádku (" + (e && e.message ? e.message : e) +
                        ") — nepublikuji. Zkuste Zahodit změny a zadat je znovu.");
      }
      const vysledek = await publikovatSoubor("js/data.js", text,
        "Aktualizace obsahu z administrace (" + (AUTH ? AUTH.email : "web") + ")");
      if (vysledek && vysledek.verze) verzeObsahu = vysledek.verze;
      prijmoutUlozeno();
      toast("Publikováno ✓ Na webu se to ukáže do minuty.", "ok");
    } catch (e) {
      toast("Publikování selhalo: " + (e && e.message ? e.message : e), "chyba");
    } finally {
      tlacitka.forEach((b) => { b.disabled = false; b.textContent = "Publikovat na web"; });
    }
  }

  /* ---------- Ukládání: složka webu (File System Access) ---------- */
  const fsPodpora = "showDirectoryPicker" in window;
  let slozka = null;

  async function pripojitSlozku() {
    if (!fsPodpora) {
      toast("Tenhle prohlížeč přímé ukládání neumí — použijte Stáhnout data.js (nebo Chrome/Edge).", "chyba");
      return false;
    }
    try {
      const h = await window.showDirectoryPicker({ id: "lupa-web", mode: "readwrite" });
      const js = await h.getDirectoryHandle("js");
      await js.getFileHandle("data.js");
      slozka = h;
      aktualizujListu();
      toast("Složka webu připojena — Uložit teď zapisuje přímo do ní.", "ok");
      return true;
    } catch (e) {
      if (e && e.name === "AbortError") return false;
      toast("Tohle nevypadá jako složka webu — musí obsahovat js/data.js.", "chyba");
      return false;
    }
  }

  async function zapisSoubor(cesta, obsah) {
    let dir = slozka;
    for (let i = 0; i < cesta.length - 1; i++) {
      dir = await dir.getDirectoryHandle(cesta[i], { create: true });
    }
    const soubor = await dir.getFileHandle(cesta[cesta.length - 1], { create: true });
    const w = await soubor.createWritable();
    await w.write(obsah);
    await w.close();
  }

  async function ulozit() {
    const text = generujDataJs();
    if (!slozka) {
      if (fsPodpora) {
        const ok = await pripojitSlozku();
        if (!ok) return;
      } else {
        stahnout();
        return;
      }
    }
    try {
      await zapisSoubor(["js", "data.js"], text);
      prijmoutUlozeno();
      toast("Uloženo do js/data.js ✓ (nezapomeňte pak soubor nahrát na hosting)", "ok");
    } catch (e) {
      toast("Uložení selhalo: " + (e && e.message ? e.message : e), "chyba");
    }
  }

  function stahnout() {
    const blob = new Blob([generujDataJs()], { type: "text/javascript;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.js";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Staženo — soubor nahraďte ve složce webu: js/data.js", "ok");
  }

  function prijmoutUlozeno() {
    // uložený stav se stává „původním" — pro označení změn v této relaci
    localStorage.removeItem(DRAFT_KLIC);
    try { localStorage.removeItem(DRAFT_VERZE_KLIC); } catch (e) { /* nevadí */ }
    zakladVerze = verzeObsahu;
    ulozenyJson = JSON.stringify(stav);
    aktualizujListu();
  }
  let ulozenyJson = zDraftu ? null : puvodniJson; // null = draft ≠ soubor

  function aktualizujListu() {
    // srovnává se s posledním uloženým stavem (null = draft z minula ≠ soubor)
    const zaklad = ulozenyJson === null ? puvodniJson : ulozenyJson;
    $("#adm-zmeny").hidden = JSON.stringify(stav) === zaklad;
    const sl = $("#adm-slozka");
    // na webu se do složky neukládá, tak o ní ani nemluvíme
    if (naWebu) { sl.textContent = "Publikuje se přímo na web"; sl.classList.remove("pripojeno"); return; }
    if (slozka) { sl.textContent = "Složka připojena: " + slozka.name; sl.classList.add("pripojeno"); }
    else { sl.textContent = fsPodpora ? "Složka webu nepřipojena" : "Prohlížeč neumí přímé ukládání"; sl.classList.remove("pripojeno"); }
  }

  /* ---------- Mini-formát článků (text ⇄ HTML) ---------- */
  function textNaHtml(text) {
    const bloky = String(text || "").replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
    return bloky.map((b) => {
      const radky = b.split("\n").map((r) => r.trim()).filter(Boolean);
      if (!radky.length) return "";
      if (radky.length === 1 && radky[0].startsWith("## ")) {
        return "<h2>" + radky[0].slice(3) + "</h2>";
      }
      if (radky.every((r) => r.startsWith("- "))) {
        return "<ul>\n" + radky.map((r) => "  <li>" + r.slice(2) + "</li>").join("\n") + "\n</ul>";
      }
      return "<p>" + radky.join("<br>") + "</p>";
    }).filter(Boolean).join("\n");
  }

  function htmlNaText(html) {
    let t = String(html || "");
    t = t.replace(/\r\n/g, "\n");
    t = t.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (m, x) => "\n\n## " + x.replace(/\s+/g, " ").trim() + "\n\n");
    t = t.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (m, x) => {
      const li = [];
      x.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (mm, y) => { li.push("- " + y.replace(/\s+/g, " ").trim()); return ""; });
      return "\n\n" + li.join("\n") + "\n\n";
    });
    t = t.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (m, x) => "\n\n" + x.replace(/<br\s*\/?>/gi, "\n").replace(/[ \t]*\n[ \t]*/g, "\n").replace(/[ \t]+/g, " ").trim() + "\n\n");
    t = t.replace(/\n{3,}/g, "\n\n").trim();
    return t;
  }

  /* ---------- Rozpoznání odkazů na epizody ---------- */
  function vytahniYoutube(vstup) {
    const s = String(vstup || "").trim();
    if (!s) return "";
    const m = s.match(/(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
    if (m) return m[1];
    if (/^[\w-]{11}$/.test(s)) return s;
    return null; // nerozpoznáno
  }
  function vytahniSpotify(vstup) {
    const s = String(vstup || "").trim();
    if (!s) return "";
    const m = s.match(/open\.spotify\.com\/(?:[a-z-]+\/)?episode\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    if (/^[A-Za-z0-9]{15,}$/.test(s)) return s;
    return null;
  }

  /* ---------- UI stav ---------- */
  const ui = { tab: "skoly", editace: null }; // editace: {typ:"skola"|"clanek", index:-1|n}

  /* ---------- Náhledy (stejné třídy jako web) ---------- */
  function nahledKartySkoly(s) {
    const ep = s.epizoda;
    const badge = ep
      ? '<span class="badge-time">' + esc(ep.delka || "—") + "</span>"
      : '<span class="badge-soon">Připravujeme</span>';
    const foto = s.foto
      ? '<img src="' + esc(s.foto) + '" alt="">'
      : '<span class="thumb-note">foto ředitele</span>';
    return (
      '<article class="card">' +
        '<div class="card-thumb">' + foto + badge + "</div>" +
        '<div class="card-body">' +
          '<p class="card-label">' + esc(KRAJE[s.kraj] || "") + " · " + esc(TYPY_SKOL[s.typ] || "") + "</p>" +
          '<h3 class="card-title h-disp">' + esc(s.nazev || "Název školy") + "</h3>" +
          '<p class="card-meta">' + esc(s.reditel || "") + "</p>" +
          '<div class="card-play"><span class="play-dot" aria-hidden="true"></span><span class="line"></span></div>' +
        "</div>" +
      "</article>"
    );
  }

  /* ---------- Render ---------- */
  const obsah = $("#adm-obsah");

  function render() {
    $$(".adm-taby .chip").forEach((ch) =>
      ch.setAttribute("aria-pressed", ch.getAttribute("data-tab") === ui.tab ? "true" : "false"));
    if (ui.tab === "skoly") return ui.editace ? renderFormSkola() : renderSeznamSkol();
    if (ui.tab === "blog") return ui.editace ? renderFormClanek() : renderSeznamClanku();
    if (ui.tab === "nastaveni") return renderNastaveni();
    if (ui.tab === "ucty") return renderUcty();
    renderNavod();
  }

  /* ----- Školy: seznam ----- */
  function renderSeznamSkol() {
    const radky = stav.skoly.map((s, i) => {
      const ep = s.epizoda;
      return (
        '<button type="button" class="adm-radek" data-i="' + i + '">' +
          '<span class="ar-info"><span class="ar-nazev">' + esc(s.nazev) + "</span>" +
          '<span class="ar-meta">' + esc(s.mesto) + " · " + esc(KRAJE[s.kraj] || s.kraj) + " · " + esc(TYPY_SKOL[s.typ] || s.typ) + "</span></span>" +
          '<span class="ar-stav">' +
            (ep
              ? '<span class="badge-time">Ep. ' + esc(String(ep.cislo)) + "</span>"
              : s.reportaz && s.reportaz.youtube
                ? '<span class="badge-time">Reportáž</span>'
                : '<span class="badge-soon">Nic natočeného</span>') +
            '<span class="kr-sipka" aria-hidden="true">→</span>' +
          "</span>" +
        "</button>"
      );
    }).join("");
    obsah.innerHTML =
      '<div class="adm-panel">' +
        '<div class="adm-panel-head"><h2 class="h-disp">Školy (' + stav.skoly.length + ')</h2>' +
        '<button type="button" class="btn" id="btn-nova-skola">+ Přidat školu</button></div>' +
        (radky || '<p class="adm-prazdno">Zatím žádné školy.</p>') +
      "</div>";
    $("#btn-nova-skola").addEventListener("click", () => { ui.editace = { typ: "skola", index: -1 }; render(); });
    $$(".adm-radek", obsah).forEach((r) =>
      r.addEventListener("click", () => { ui.editace = { typ: "skola", index: +r.getAttribute("data-i") }; render(); }));
  }

  /* ----- Školy: formulář ----- */
  function renderFormSkola() {
    const novy = ui.editace.index < 0;
    const s = novy
      ? { id: "", nazev: "", mesto: "", adresa: "", kraj: "", typ: "", reditel: "", web: "", foto: null, popis: "", epizoda: null }
      : kopie(stav.skoly[ui.editace.index]);
    const ep = s.epizoda || {};
    const dalsiCislo = stav.skoly.reduce((m, x) => Math.max(m, x.epizoda ? x.epizoda.cislo : 0), 0) + 1;

    obsah.innerHTML =
      '<div class="adm-panel"><div class="adm-panel-head">' +
        '<h2 class="h-disp">' + (novy ? "Nová škola" : "Upravit školu") + "</h2>" +
        '<button type="button" class="btn btn--ghost" id="btn-zpet">← Zpět na seznam</button></div>' +
      '<form class="adm-form" id="form-skola" novalidate>' +
        '<div class="adm-chyby" id="chyby" hidden></div>' +
        "<fieldset><legend>Základní údaje</legend>" +
          '<div class="field"><label for="f-nazev">Název školy *</label><input id="f-nazev" type="text" value="' + esc(s.nazev) + '" placeholder="Gymnázium…"></div>' +
          '<div class="field"><label for="f-reditel">Ředitel/ka *</label><input id="f-reditel" type="text" value="' + esc(s.reditel) + '" placeholder="Mgr. Jana Nováková"></div>' +
          '<div class="field"><label for="f-mesto">Obec *</label><input id="f-mesto" type="text" value="' + esc(s.mesto) + '" placeholder="Karlovy Vary">' +
            '<span class="kontrola" id="mesto-kontrola"></span></div>' +
          '<div class="field"><label for="f-adresa">Adresa (ulice a č. p.)</label><input id="f-adresa" type="text" value="' + esc(s.adresa || "") + '" placeholder="Nádražní 12"></div>' +
          '<div class="field"><label for="f-kraj">Kraj *</label><select id="f-kraj"><option value="">— vyberte —</option>' +
            Object.entries(KRAJE).map(([k, n]) => '<option value="' + k + '"' + (s.kraj === k ? " selected" : "") + ">" + esc(n) + "</option>").join("") +
          "</select></div>" +
          '<div class="field"><label for="f-typ">Typ školy *</label><select id="f-typ"><option value="">— vyberte —</option>' +
            Object.entries(TYPY_SKOL).map(([k, n]) => '<option value="' + k + '"' + (s.typ === k ? " selected" : "") + ">" + esc(n) + "</option>").join("") +
          "</select></div>" +
          '<div class="field"><label for="f-web">Web školy</label><input id="f-web" type="text" value="' + esc(s.web || "") + '" placeholder="www.skola.cz"></div>' +
          '<div class="field"><label for="f-foto">Fotka (cesta ve webu)</label><input id="f-foto" type="text" value="' + esc(s.foto || "") + '" placeholder="assets/skoly/nazev.jpg">' +
            (naWebu || fsPodpora
              ? '<input id="f-foto-soubor" type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden>' +
                '<button type="button" class="btn btn--ghost" id="btn-foto" style="padding:8px 12px;font-size:10.5px">Nahrát fotku…</button>' +
                '<span class="napoveda">' + (naWebu
                  ? "Uloží se rovnou na web do assets/skoly/ (max 6 MB)."
                  : "Uloží se do assets/skoly/ (potřeba připojená složka webu).") + "</span>"
              : '<span class="napoveda">Soubor nakopírujte do assets/skoly/ a sem napište cestu.</span>') +
          "</div>" +
          '<div class="field full"><label for="f-popis">Popis školy</label><textarea id="f-popis" placeholder="Pár vět o škole…">' + esc(s.popis || "") + "</textarea></div>" +
          '<p class="napoveda full">Adresa profilu: <code>skola.html?id=<span id="id-nahled">' + esc(s.id || "…") + "</span></code>" + (novy ? " (vytvoří se automaticky z názvu a obce)" : "") + "</p>" +
        "</fieldset>" +
        "<fieldset><legend>Epizoda podcastu</legend>" +
          '<label class="prepinac full"><input type="checkbox" id="f-ma-epizodu"' + (s.epizoda ? " checked" : "") + "> Škola má epizodu</label>" +
          '<div class="field"><label for="f-ep-cislo">Číslo epizody</label><input id="f-ep-cislo" type="number" min="1" value="' + esc(String(ep.cislo || dalsiCislo)) + '"></div>' +
          '<div class="field"><label for="f-ep-delka">Délka (mm:ss)</label><input id="f-ep-delka" type="text" value="' + esc(ep.delka || "") + '" placeholder="32:10"></div>' +
          '<div class="field full"><label for="f-ep-nazev">Název epizody *</label><input id="f-ep-nazev" type="text" value="' + esc(ep.nazev || "") + '" placeholder="Škola není fabrika na jedničky"></div>' +
          '<div class="field"><label for="f-ep-datum">Datum vydání</label><input id="f-ep-datum" type="date" value="' + esc(ep.datum || "") + '"></div>' +
          '<div class="field"><label for="f-ep-youtube">YouTube (odkaz nebo ID)</label><input id="f-ep-youtube" type="text" value="' + esc(ep.youtube || "") + '" placeholder="https://www.youtube.com/watch?v=…"></div>' +
          '<div class="field"><label for="f-ep-spotify">Spotify (odkaz na epizodu)</label><input id="f-ep-spotify" type="text" value="' + esc(ep.spotify || "") + '" placeholder="https://open.spotify.com/episode/…"></div>' +
          '<div class="field"><label for="f-ep-apple">Apple Podcasts (odkaz)</label><input id="f-ep-apple" type="text" value="' + esc(ep.apple || "") + '" placeholder="https://podcasts.apple.com/…"></div>' +
          '<div class="field full"><label for="f-ep-popis">Popis epizody</label><textarea id="f-ep-popis" placeholder="O čem se v epizodě mluví…">' + esc(ep.popis || "") + "</textarea></div>" +
        "</fieldset>" +
        "<fieldset><legend>Reportáž ze školy</legend>" +
          '<div class="field full"><label for="f-reportaz">YouTube (odkaz nebo ID)</label>' +
            '<input id="f-reportaz" type="text" value="' + esc((s.reportaz && s.reportaz.youtube) || "") + '" placeholder="https://www.youtube.com/watch?v=…">' +
            '<span class="napoveda">Videoreportáž ze školy — druhý přehrávač na profilu. Dokud je pole prázdné, na webu je „připravujeme".</span>' +
          "</div>" +
          '<div class="field"><label for="f-rep-delka">Délka (mm:ss)</label>' +
            '<input id="f-rep-delka" type="text" value="' + esc((s.reportaz && s.reportaz.delka) || "") + '" placeholder="16:15"></div>' +
          '<div class="field"><label for="f-rep-datum">Datum vydání</label>' +
            '<input id="f-rep-datum" type="date" value="' + esc((s.reportaz && s.reportaz.datum) || "") + '"></div>' +
        "</fieldset>" +
        '<fieldset class="jeden-sloupec"><legend>Náhled karty</legend><div class="adm-nahled" id="nahled"></div></fieldset>' +
        '<div class="adm-akce">' +
          '<button type="submit" class="btn">' + (novy ? "Přidat školu" : "Uložit úpravy") + "</button>" +
          '<button type="button" class="btn btn--ghost" id="btn-zrusit">Zrušit</button>' +
          (novy ? "" : '<button type="button" class="btn btn--ghost smazat" id="btn-smazat">Smazat školu</button>') +
        "</div>" +
      "</form></div>";

    const zpet = () => { ui.editace = null; render(); };
    $("#btn-zpet").addEventListener("click", zpet);
    $("#btn-zrusit").addEventListener("click", zpet);

    const sebrat = () => {
      const maEp = $("#f-ma-epizodu").checked;
      const v = (id) => $(id).value.trim();
      const o = {
        id: s.id, nazev: v("#f-nazev"), mesto: v("#f-mesto"), adresa: v("#f-adresa"),
        kraj: $("#f-kraj").value, typ: $("#f-typ").value, reditel: v("#f-reditel"),
        web: v("#f-web"), foto: v("#f-foto") || null, popis: v("#f-popis"),
        epizoda: maEp ? {
          cislo: parseInt($("#f-ep-cislo").value, 10) || dalsiCislo,
          nazev: v("#f-ep-nazev"), delka: v("#f-ep-delka"), datum: $("#f-ep-datum").value,
          popis: v("#f-ep-popis"),
          youtube: v("#f-ep-youtube"), spotify: v("#f-ep-spotify"), apple: v("#f-ep-apple"),
        } : null,
      };
      return o;
    };

    const obnovNahled = () => {
      const o = sebrat();
      $("#nahled").innerHTML = nahledKartySkoly(o);
      $("#id-nahled").textContent = s.id || (slug(o.nazev + "-" + o.mesto) || "…");
      const mk = $("#mesto-kontrola");
      const ov = overObec(o.kraj, o.mesto);
      if (ov.stav === "prazdne") { mk.textContent = ""; mk.className = "kontrola"; }
      else if (ov.stav === "ok") { mk.textContent = "✓ obec znám — pin bude přesně na mapě"; mk.className = "kontrola ok"; }
      else if (ov.stav === "ok-bez-kraje") { mk.textContent = "✓ obec znám — ještě vyberte kraj"; mk.className = "kontrola ok"; }
      else if (ov.stav === "jinde") {
        mk.textContent = "⚠ v tomhle kraji obec neznám — leží v: " +
          ov.kraje.slice(0, 3).map((k) => KRAJE[k] || k).join(", ") +
          (ov.kraje.length > 3 ? "…" : "") + " (zkontrolujte kraj)";
        mk.className = "kontrola varovani";
      }
      else { mk.textContent = "⚠ obec neznám — pin spadne na střed kraje (zkontrolujte překlep)"; mk.className = "kontrola varovani"; }
    };
    $("#form-skola").addEventListener("input", obnovNahled);
    obnovNahled();

    if ($("#btn-foto")) {
      $("#btn-foto").addEventListener("click", () => $("#f-foto-soubor").click());
      $("#f-foto-soubor").addEventListener("change", async () => {
        const soubor = $("#f-foto-soubor").files[0];
        if (!soubor) return;
        if (soubor.size > 6 * 1024 * 1024) {
          toast("Fotka má " + Math.round(soubor.size / 1048576) + " MB — zmenšete ji pod 6 MB.", "chyba");
          return;
        }
        if (!naWebu && !slozka && !(await pripojitSlozku())) return;

        const pripona = (soubor.name.match(/\.(jpe?g|png|webp|avif)$/i) || [".jpg"])[0].toLowerCase();
        const jmeno = (s.id || slug($("#f-nazev").value + "-" + $("#f-mesto").value) || "skola") + pripona;
        const tlacitko = $("#btn-foto");
        tlacitko.disabled = true;
        tlacitko.textContent = "Nahrávám…";
        try {
          if (naWebu) await publikovatObrazek("assets/skoly/" + jmeno, soubor);
          else await zapisSoubor(["assets", "skoly", jmeno], soubor);
          $("#f-foto").value = "assets/skoly/" + jmeno;
          obnovNahled();
          toast(naWebu
            ? "Fotka nahraná na web — zobrazí se během chvilky."
            : "Fotka uložena do assets/skoly/" + jmeno, "ok");
        } catch (e) {
          toast("Nahrání fotky selhalo: " + (e && e.message ? e.message : e), "chyba");
        } finally {
          tlacitko.disabled = false;
          tlacitko.textContent = "Nahrát fotku…";
        }
      });
    }

    $("#form-skola").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const o = sebrat();
      const chyby = [];
      if (!o.nazev) chyby.push("Vyplňte název školy.");
      if (!o.mesto) chyby.push("Vyplňte obec.");
      if (!o.kraj) chyby.push("Vyberte kraj.");
      if (!o.typ) chyby.push("Vyberte typ školy.");
      if (!o.reditel) chyby.push("Vyplňte ředitele/ku.");
      if (o.web && !/^https?:\/\//i.test(o.web)) o.web = "https://" + o.web;
      if (o.epizoda) {
        if (!o.epizoda.nazev) chyby.push("Vyplňte název epizody (nebo epizodu vypněte).");
        if (o.epizoda.delka && !/^\d{1,3}:\d{2}$/.test(o.epizoda.delka)) chyby.push("Délka epizody má být ve tvaru mm:ss, např. 32:10.");
        const yt = vytahniYoutube(o.epizoda.youtube);
        if (yt === null) chyby.push("YouTube odkaz nepoznávám — vložte odkaz na video, nebo pole nechte prázdné.");
        else o.epizoda.youtube = yt;
        const sp = vytahniSpotify(o.epizoda.spotify);
        if (sp === null) chyby.push("Spotify odkaz nepoznávám — vložte odkaz na epizodu, nebo pole nechte prázdné.");
        else o.epizoda.spotify = sp;
        if (o.epizoda.apple && !/^https?:\/\//i.test(o.epizoda.apple)) o.epizoda.apple = "https://" + o.epizoda.apple;
      }
      const repVstup = $("#f-reportaz").value.trim();
      const repId = vytahniYoutube(repVstup);
      const repDelka = $("#f-rep-delka").value.trim();
      if (repId === null) chyby.push("YouTube odkaz reportáže nepoznávám — vložte odkaz na video, nebo pole nechte prázdné.");
      else if (repDelka && !/^\d{1,3}:\d{2}$/.test(repDelka)) chyby.push("Délka reportáže má být ve tvaru mm:ss, např. 16:15.");
      else if (repId) o.reportaz = { youtube: repId, delka: repDelka, datum: $("#f-rep-datum").value };
      if (!o.id) {
        o.id = slug(o.nazev + "-" + o.mesto);
        let n = 2;
        while (stav.skoly.some((x) => x.id === o.id)) o.id = slug(o.nazev + "-" + o.mesto) + "-" + n++;
      }
      if (!o.adresa) delete o.adresa;
      const puvodni = ui.editace.index >= 0 ? stav.skoly[ui.editace.index] : null;
      if (puvodni && puvodni.pin) o.pin = puvodni.pin; // ruční pin zachovat

      const box = $("#chyby");
      if (chyby.length) {
        box.innerHTML = chyby.map((c) => "<span>• " + esc(c) + "</span>").join("");
        box.hidden = false;
        box.scrollIntoView({ block: "center" });
        return;
      }
      if (puvodni) stav.skoly[ui.editace.index] = o;
      else stav.skoly.push(o);
      ulozDraft();
      ui.editace = null;
      render();
      toast(puvodni ? "Škola upravena (" + dokonceni() + ")" : "Škola přidána (" + dokonceni() + ")");
    });

    if (!novy) {
      $("#btn-smazat").addEventListener("click", () => {
        if (!confirm("Opravdu smazat školu „" + s.nazev + "“? Tohle nejde vrátit.")) return;
        stav.skoly.splice(ui.editace.index, 1);
        ulozDraft();
        ui.editace = null;
        render();
        toast("Škola smazána (" + dokonceni() + ")");
      });
    }
  }

  /* ----- Blog: seznam ----- */
  function renderSeznamClanku() {
    const radky = stav.clanky.map((c, i) =>
      '<button type="button" class="adm-radek" data-i="' + i + '">' +
        '<span class="ar-info"><span class="ar-nazev">' + esc(c.titulek) + "</span>" +
        '<span class="ar-meta">' + fmtDatum(c.datum) + (c.autor ? " · " + esc(c.autor) : "") + "</span></span>" +
        '<span class="ar-stav"><span class="kr-sipka" aria-hidden="true">→</span></span>' +
      "</button>"
    ).join("");
    obsah.innerHTML =
      '<div class="adm-panel">' +
        '<div class="adm-panel-head"><h2 class="h-disp">Blog (' + stav.clanky.length + ')</h2>' +
        '<button type="button" class="btn" id="btn-novy-clanek">+ Napsat článek</button></div>' +
        (radky || '<p class="adm-prazdno">Zatím žádné články.</p>') +
      "</div>";
    $("#btn-novy-clanek").addEventListener("click", () => { ui.editace = { typ: "clanek", index: -1 }; render(); });
    $$(".adm-radek", obsah).forEach((r) =>
      r.addEventListener("click", () => { ui.editace = { typ: "clanek", index: +r.getAttribute("data-i") }; render(); }));
  }

  /* ----- Blog: formulář ----- */
  function renderFormClanek() {
    const novy = ui.editace.index < 0;
    const c = novy
      ? { id: "", titulek: "", datum: dnes(), autor: "", perex: "", obsah: "" }
      : kopie(stav.clanky[ui.editace.index]);

    obsah.innerHTML =
      '<div class="adm-panel"><div class="adm-panel-head">' +
        '<h2 class="h-disp">' + (novy ? "Nový článek" : "Upravit článek") + "</h2>" +
        '<button type="button" class="btn btn--ghost" id="btn-zpet">← Zpět na seznam</button></div>' +
      '<form class="adm-form" id="form-clanek" novalidate>' +
        '<div class="adm-chyby" id="chyby" hidden></div>' +
        "<fieldset><legend>Článek</legend>" +
          '<div class="field full"><label for="c-titulek">Titulek *</label><input id="c-titulek" type="text" value="' + esc(c.titulek) + '"></div>' +
          '<div class="field"><label for="c-datum">Datum *</label><input id="c-datum" type="date" value="' + esc(c.datum) + '"></div>' +
          '<div class="field"><label for="c-autor">Autor</label><input id="c-autor" type="text" value="' + esc(c.autor || "") + '" placeholder="Michaela Brejchová"></div>' +
          '<div class="field full"><label for="c-perex">Perex (krátká upoutávka) *</label><textarea id="c-perex" style="min-height:70px">' + esc(c.perex) + "</textarea></div>" +
          '<div class="field full"><label for="c-obsah">Text článku *</label>' +
            '<textarea id="c-obsah" style="min-height:260px">' + esc(htmlNaText(c.obsah)) + "</textarea>" +
            '<span class="napoveda">Odstavce oddělujte prázdným řádkem. Mezititulek: <code>## Nadpis</code> · odrážka: <code>- text</code> · tučně: <code>&lt;strong&gt;text&lt;/strong&gt;</code> · odkaz: <code>&lt;a href="https://…"&gt;text&lt;/a&gt;</code></span>' +
          "</div>" +
        "</fieldset>" +
        '<fieldset class="jeden-sloupec"><legend>Náhled</legend><div class="adm-nahled"><div class="article-body" id="nahled-clanku"></div></div></fieldset>' +
        '<div class="adm-akce">' +
          // NE „Publikovat" — publikuje se až tlačítkem v liště nahoře,
          // dvě různá „publikovat" vedle sebe uživatele spolehlivě zmatou
          '<button type="submit" class="btn">' + (novy ? "Přidat článek" : "Uložit úpravy") + "</button>" +
          '<button type="button" class="btn btn--ghost" id="btn-zrusit">Zrušit</button>' +
          (novy ? "" : '<button type="button" class="btn btn--ghost smazat" id="btn-smazat">Smazat článek</button>') +
        "</div>" +
      "</form></div>";

    const zpet = () => { ui.editace = null; render(); };
    $("#btn-zpet").addEventListener("click", zpet);
    $("#btn-zrusit").addEventListener("click", zpet);

    const obnovNahled = () => { $("#nahled-clanku").innerHTML = textNaHtml($("#c-obsah").value) || '<p class="muted">Náhled článku…</p>'; };
    $("#c-obsah").addEventListener("input", obnovNahled);
    obnovNahled();

    $("#form-clanek").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const o = {
        id: c.id,
        titulek: $("#c-titulek").value.trim(),
        datum: $("#c-datum").value,
        autor: $("#c-autor").value.trim(),
        perex: $("#c-perex").value.trim(),
        obsah: textNaHtml($("#c-obsah").value),
      };
      const chyby = [];
      if (!o.titulek) chyby.push("Vyplňte titulek.");
      if (!o.datum) chyby.push("Vyplňte datum.");
      if (!o.perex) chyby.push("Vyplňte perex.");
      if (!o.obsah) chyby.push("Napište text článku.");
      if (!o.id) {
        o.id = slug(o.titulek);
        let n = 2;
        while (stav.clanky.some((x) => x.id === o.id)) o.id = slug(o.titulek) + "-" + n++;
      }
      const box = $("#chyby");
      if (chyby.length) {
        box.innerHTML = chyby.map((x) => "<span>• " + esc(x) + "</span>").join("");
        box.hidden = false;
        box.scrollIntoView({ block: "center" });
        return;
      }
      if (novy) stav.clanky.unshift(o);       // nejnovější nahoru
      else stav.clanky[ui.editace.index] = o;
      ulozDraft();
      ui.editace = null;
      render();
      toast(novy ? "Článek přidán (" + dokonceni() + ")" : "Článek upraven (" + dokonceni() + ")");
    });

    if (!novy) {
      $("#btn-smazat").addEventListener("click", () => {
        if (!confirm("Opravdu smazat článek „" + c.titulek + "“?")) return;
        stav.clanky.splice(ui.editace.index, 1);
        ulozDraft();
        ui.editace = null;
        render();
        toast("Článek smazán (" + dokonceni() + ")");
      });
    }
  }

  /* ----- Nastavení ----- */
  function renderNastaveni() {
    const n = stav.nastaveni;
    const S = n.socialniSite || {};
    const pole = (id, label, hodnota, ph) =>
      '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="text" value="' + esc(hodnota || "") + '" placeholder="' + esc(ph || "") + '"></div>';
    obsah.innerHTML =
      '<div class="adm-panel"><div class="adm-panel-head"><h2 class="h-disp">Nastavení webu</h2></div>' +
      '<form class="adm-form" id="form-nastaveni">' +
        "<fieldset><legend>Kontakt</legend>" +
          pole("n-email", "Kontaktní e-mail (poptávky, patička)", n.kontaktEmail, "info@…") +
          pole("n-telefon", "Telefon (patička)", n.kontaktTelefon, "+420 …") +
          pole("n-mw", "Odkaz na Mediální workshop", n.odkazMedialniWorkshop, "https://www.medialniworkshop.cz") +
        "</fieldset>" +
        "<fieldset><legend>Sociální sítě (prázdné = na webu se neukáže)</legend>" +
          pole("n-ig", "Instagram", S.instagram, "https://www.instagram.com/…") +
          pole("n-tt", "TikTok", S.tiktok, "https://www.tiktok.com/@…") +
          pole("n-yt", "YouTube", S.youtube, "https://www.youtube.com/@…") +
          pole("n-fb", "Facebook", S.facebook, "https://www.facebook.com/…") +
          pole("n-sp", "Spotify", S.spotify, "https://open.spotify.com/show/…") +
          pole("n-ap", "Apple Podcasts", S.applePodcasts, "https://podcasts.apple.com/…") +
        "</fieldset>" +
        '<div class="adm-akce"><button type="submit" class="btn">Uložit nastavení</button></div>' +
      "</form></div>";
    $("#form-nastaveni").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const v = (id) => $(id).value.trim();
      stav.nastaveni.kontaktEmail = v("#n-email");
      stav.nastaveni.kontaktTelefon = v("#n-telefon");
      stav.nastaveni.odkazMedialniWorkshop = v("#n-mw");
      stav.nastaveni.socialniSite = {
        instagram: v("#n-ig"), tiktok: v("#n-tt"), youtube: v("#n-yt"),
        facebook: v("#n-fb"), spotify: v("#n-sp"), applePodcasts: v("#n-ap"),
      };
      ulozDraft();
      toast("Nastavení uloženo (" + dokonceni() + ")");
    });
  }

  /* ----- Účty ----- */
  function renderUcty() {
    const ucty = AUTH ? AUTH.ucty : [];
    const radky = ucty.map((u, i) =>
      '<div class="adm-radek">' +
        '<span class="ar-info"><span class="ar-nazev">' + esc(u.email) + "</span>" +
        '<span class="ar-meta">' +
          (u.email === AUTH.email ? "přihlášeni právě tímto účtem · " : "") +
          "vytvořen " + fmtDatum(u.vytvoren) + "</span></span>" +
        '<span class="ar-stav">' +
          (ucty.length > 1 && u.email !== AUTH.email
            ? '<button type="button" class="kp-zrusit smazat-ucet" data-i="' + i + '">Smazat</button>'
            : '<span class="badge-rep">' + (u.email === AUTH.email ? "Vy" : "Jediný účet") + "</span>") +
        "</span>" +
      "</div>"
    ).join("");

    obsah.innerHTML =
      '<div class="adm-panel">' +
        '<div class="adm-panel-head"><h2 class="h-disp">Přístup do administrace (' + ucty.length + ")</h2></div>" +
        radky +
        '<form class="adm-form" id="form-ucet">' +
          '<div class="adm-chyby" id="chyby-ucet" hidden></div>' +
          "<fieldset><legend>Nový účet</legend>" +
            '<div class="field"><label for="u-email">E-mail</label>' +
              '<input id="u-email" type="email" autocomplete="off" placeholder="jmeno@medialniworkshop.cz"></div>' +
            '<div class="field"><label for="u-heslo">Heslo (aspoň 8 znaků)</label>' +
              '<input id="u-heslo" type="password" autocomplete="new-password"></div>' +
            '<div class="field full"><button type="submit" class="btn">Přidat účet</button></div>' +
          "</fieldset>" +
        "</form>" +
        '<form class="adm-form" id="form-heslo" style="padding-top:0">' +
          '<div class="adm-chyby" id="chyby-heslo" hidden></div>' +
          "<fieldset><legend>Změna vlastního hesla</legend>" +
            '<div class="field"><label for="h-nove">Nové heslo</label>' +
              '<input id="h-nove" type="password" autocomplete="new-password"></div>' +
            '<div class="field"><label for="h-nove2">Nové heslo ještě jednou</label>' +
              '<input id="h-nove2" type="password" autocomplete="new-password"></div>' +
            '<div class="field full"><button type="submit" class="btn btn--ghost">Změnit heslo</button></div>' +
          "</fieldset>" +
        "</form>" +
        '<div class="adm-navod" style="padding-top:0">' +
          "<p class=\"napoveda\">Změny se ukládají hned — nemusíte nic publikovat. Hesla se nikam " +
          "neposílají: odchází jen jejich otisk, ze kterého heslo zpětně přečíst nejde. " +
          "Zapomenuté heslo se obnovuje na přihlašovací obrazovce odkazem " +
          "<strong>Zapomenuté heslo?</strong> — potřebujete k tomu zakládací klíč z Cloudflare.</p>" +
        "</div>" +
      "</div>";

    function chybaBox(id, zpravy) {
      const b = $("#" + id);
      if (!zpravy.length) { b.hidden = true; return false; }
      b.innerHTML = zpravy.map((x) => "<span>• " + esc(x) + "</span>").join("");
      b.hidden = false;
      return true;
    }

    // vytvoření otisku hesla chvíli trvá — po tu dobu tlačítko nereaguje
    async function pracuj(tlacitko, popis, prace) {
      const puvodni = tlacitko.textContent;
      tlacitko.disabled = true;
      tlacitko.textContent = "Ukládám…";
      try {
        await prace();
        render();
        toast(popis, "ok");
      } catch (e) {
        toast("Nepovedlo se: " + (e && e.message ? e.message : e), "chyba");
        tlacitko.disabled = false;
        tlacitko.textContent = puvodni;
      }
    }

    $("#form-ucet").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const email = $("#u-email").value.trim();
      const heslo = $("#u-heslo").value;
      const chyby = [];
      if (!email || email.indexOf("@") < 1) chyby.push("Vyplňte platný e-mail.");
      if (heslo.length < 8) chyby.push("Heslo musí mít aspoň 8 znaků.");
      if (ucty.some((u) => AUTH.normEmail(u.email) === AUTH.normEmail(email))) {
        chyby.push("Účet s tímhle e-mailem už existuje.");
      }
      if (chybaBox("chyby-ucet", chyby)) return;
      pracuj($("#form-ucet button[type=submit]"), "Účet " + email + " přidán",
             () => AUTH.pridatUcet(email, heslo));
    });

    $("#form-heslo").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const a = $("#h-nove").value, b = $("#h-nove2").value;
      const chyby = [];
      if (a.length < 8) chyby.push("Heslo musí mít aspoň 8 znaků.");
      if (a !== b) chyby.push("Hesla se neshodují.");
      if (chybaBox("chyby-heslo", chyby)) return;
      pracuj($("#form-heslo button[type=submit]"), "Heslo změněno",
             () => AUTH.zmenitHeslo(a));
    });

    $$(".smazat-ucet", obsah).forEach((b) =>
      b.addEventListener("click", () => {
        const u = ucty[+b.getAttribute("data-i")];
        if (!u || !confirm("Opravdu odebrat přístup pro „" + u.email + "“?")) return;
        pracuj(b, "Účet odebrán", () => AUTH.smazatUcet(u.email));
      })
    );
  }

  /* ----- Návod ----- */
  function renderNavod() {
    obsah.innerHTML =
      '<div class="adm-panel"><div class="adm-navod">' +
        "<h3>Jak administrace funguje</h3>" +
        "<p>Celý obsah webu (školy, epizody, blog, kontakty) žije v jediném souboru <code>js/data.js</code>. " +
        "Administrace ho edituje — nic víc, nic míň. Web nepotřebuje databázi ani programátora.</p>" +
        "<h3>Běžný postup — přímo na webu</h3>" +
        "<ol>" +
          "<li>Přihlaste se na <code>www.stredoskolska-lupa.cz/admin</code>.</li>" +
          "<li>Udělejte změny — přidejte školu, napište článek…</li>" +
          "<li>Klikněte na <strong>Publikovat na web</strong>. Do minuty se změna sama objeví návštěvníkům.</li>" +
        "</ol>" +
        "<p class=\"napoveda\">Fotku ředitele nahrajete přímo v detailu školy tlačítkem " +
        "<strong>Nahrát fotku…</strong> — uloží se rovnou na web (max 6 MB).</p>" +
        "<h3>Administrace je jen na webu</h3>" +
        "<p>Otevřít <code>admin.html</code> ze složky v počítači už nejde — přihlášení kontroluje " +
        "server, a ten běží jen na adrese webu. Administrace tak nejde obejít ani okopírováním souborů.</p>" +
        "<h3>Přihlášení a přístup</h3>" +
        "<p>Přihlašuje se e-mailem a heslem. Kontrolu dělá <strong>server</strong>, ne prohlížeč — bez správného hesla se administrace vůbec nenačte a v adrese se nedá nic obejít. Přihlášení platí 8 hodin.</p>" +
        "<p>Další lidi přidáte v záložce <strong>Účty</strong>; tam se také mění vlastní heslo. Účty jsou uložené na serveru (Cloudflare KV), ne v souboru na webu.</p>" +
        "<p>Zapomenuté heslo se obnovuje na přihlašovací obrazovce odkazem <strong>Zapomenuté heslo?</strong>. Potřebujete k tomu <strong>zakládací klíč</strong> — tajnou proměnnou <code>ADMIN_KLIC</code> v Cloudflare. Držte ji stranou, je to poslední záchrana.</p>" +
        "<h3>Publikování změn</h3>" +
        "<p>Tlačítko <strong>Publikovat na web</strong> uloží obsah rovnou do úložiště webu. " +
        "Nic se nikam nenahrává ani nepřestavuje — na webu se změna ukáže <strong>do minuty</strong>. " +
        "Když ji nevidíte hned, načtěte stránku znovu (<code>F5</code>).</p>" +
        "<p>Dva lidé v administraci naráz: kdo by publikoval nad starší verzí, než je venku, " +
        "dostane upozornění a musí si administraci nejdřív načíst znovu — aby nepřepsal změny " +
        "toho druhého.</p>" +
        (naWebu
          ? "<h3>Co je právě venku</h3>" +
            '<div id="stav-obsahu"><p class="napoveda">Zjišťuji…</p></div>' +
            '<p>Záloha: <a href="/admin/api/export" download>stáhnout aktuální obsah webu (data.js)</a>. ' +
            "Hodí se ji čas od času uložit stranou.</p>" +
            "<h3>Zkusit nanečisto</h3>" +
            "<p>Projde totéž co publikování, ale na webu nic nezmění: přihlášení, úložiště, " +
            "co je právě venku, jestli vaše rozpracované změny projdou a jestli nevycházejí " +
            "ze zastaralé verze obsahu. Stejné tlačítko je i v oranžové liště u nepublikovaných změn.</p>" +
            '<p><button type="button" class="btn btn--ghost" id="btn-zkouska">Zkusit nanečisto</button></p>' +
            '<div id="vysledek-zkousky"></div>'
          : "") +
        "<h3>Rozpracované změny</h3>" +
        "<p>Neuložené změny se drží v prohlížeči (přežijí i zavření okna) a svítí u nich oranžová lišta. " +
        "<strong>Zahodit změny</strong> je vrátí do stavu podle souboru <code>data.js</code>.</p>" +
        "<h3>Epizody</h3>" +
        "<p>Do polí YouTube a Spotify klidně vložte celý odkaz z adresního řádku — administrace si z něj vytáhne, co potřebuje. " +
        "Dokud jsou pole prázdná, na webu se u epizody ukazuje ohláška „záznam brzy doplníme“.</p>" +
      "</div></div>";

    if ($("#stav-obsahu")) vykresliStavObsahu();
    const tlZkouska = $("#btn-zkouska");
    if (tlZkouska) tlZkouska.addEventListener("click", () => zkouskaPublikovani(tlZkouska));
  }

  /** Zkouška nanečisto: co by se stalo, kdybych teď klikl na Publikovat — bez publikování. */
  async function zkouskaPublikovani(tlacitko) {
    const box = $("#vysledek-zkousky");
    if (!box) return;
    tlacitko.disabled = true;
    tlacitko.textContent = "Zkouším…";
    box.innerHTML = "";
    const kroky = [];

    try {
      // 1) server: přihlášení, úložiště, co je venku
      const odpoved = await fetch("/admin/api/zkouska", { method: "POST" });
      const data = await odpoved.json().catch(() => ({}));
      if (odpoved.status === 401) { location.replace("/admin"); return; }
      if (!odpoved.ok || !data.ok) throw new Error(data.chyba || ("Server odpověděl " + odpoved.status));
      kroky.push(...data.kroky);
      if (data.verze) verzeObsahu = data.verze;

      // 2) rozpracované změny: vygenerovaný obsah musí projít jako JavaScript
      const jsouZmeny = $("#adm-zmeny").hidden === false;
      try {
        const text = generujDataJs();
        const zk = new Function(text + "\nreturn { NASTAVENI, KRAJE, TYPY_SKOL, SKOLY, CLANKY };")();
        if (!zk || !Array.isArray(zk.SKOLY) || !Array.isArray(zk.CLANKY) || !zk.NASTAVENI) throw new Error("chybí část obsahu");
        kroky.push({
          nazev: jsouZmeny ? "Rozpracované změny" : "Obsah k publikování",
          ok: true,
          popis: (jsouZmeny ? "Prošly by v pořádku: " : "Nic nepublikovaného; obsah je v pořádku: ") +
                 zk.SKOLY.length + " škol, " + zk.CLANKY.length + " článků, " +
                 Math.round(text.length / 1024) + " kB.",
        });
      } catch (e) {
        kroky.push({ nazev: "Rozpracované změny", ok: false,
                     popis: "Vygenerovaný obsah neprojde (" + (e && e.message ? e.message : e) +
                            "). Dejte Zahodit změny a zadejte je znovu." });
      }

      // 3) nevycházejí změny ze zastaralé verze?
      if (jsouZmeny) {
        if (!verzeObsahu) {
          kroky.push({ nazev: "Verze, ze které vycházíte", ok: true,
                       popis: "Z administrace se zatím nepublikovalo — není s čím kolidovat." });
        } else if (!zakladVerze) {
          kroky.push({ nazev: "Verze, ze které vycházíte", ok: false,
                       popis: "Nedá se zjistit (koncept vznikl ve starší verzi administrace). " +
                              "Pokud jste změny nedělali dnes, radši je zahoďte a zadejte znovu." });
        } else if (zakladVerze === verzeObsahu) {
          kroky.push({ nazev: "Verze, ze které vycházíte", ok: true,
                       popis: "Pracujete nad tím, co je právě na webu." });
        } else {
          kroky.push({ nazev: "Verze, ze které vycházíte", ok: false,
                       popis: "Na webu je novější obsah, než ze kterého tyhle změny vycházejí — " +
                              "publikování by ho přepsalo. Dejte Zahodit změny a zadejte je znovu." });
        }

        // 4) heuristika: co je venku a v konceptu chybí (typický zastaralý koncept)
        const venku = stavZWebu();
        const chybi = [];
        venku.skoly.forEach((s) => { if (!stav.skoly.some((x) => x.id === s.id)) chybi.push("škola „" + s.nazev + "“"); });
        venku.clanky.forEach((c) => { if (!stav.clanky.some((x) => x.id === c.id)) chybi.push("článek „" + c.titulek + "“"); });
        if (chybi.length) {
          kroky.push({ nazev: "Položky, které by z webu zmizely", ok: false,
                       popis: chybi.slice(0, 5).join(", ") + (chybi.length > 5 ? " a další" : "") +
                              ". Pokud jste je nesmazali schválně, koncept je zastaralý — dejte Zahodit změny." });
        }
      }

      const vse = kroky.every((k) => k.ok);
      box.innerHTML =
        '<div class="adm-panel" style="margin:12px 0">' +
          kroky.map((k) =>
            '<div class="adm-radek"><span class="ar-info">' +
              '<span class="ar-nazev">' + (k.ok ? "✓ " : "✗ ") + esc(k.nazev) + "</span>" +
              '<span class="ar-meta">' + esc(k.popis || "") + "</span>" +
            "</span></div>").join("") +
        "</div>" +
        '<p class="napoveda">' + (vse
          ? (jsouZmeny ? "Můžete publikovat — všechno by prošlo." : "Všechno je v pořádku.")
          : "Než budete publikovat, vyřešte řádky označené ✗.") + "</p>";
      toast(vse ? "Zkouška prošla ✓" : "Zkouška našla problém — čtěte výpis.", vse ? "ok" : "chyba");
    } catch (e) {
      box.innerHTML = '<p class="napoveda">Zkoušku se nepodařilo spustit: ' +
                      esc(e && e.message ? e.message : String(e)) + "</p>";
      toast("Zkouška se nezdařila: " + (e && e.message ? e.message : e), "chyba");
    } finally {
      tlacitko.disabled = false;
      tlacitko.textContent = "Zkusit nanečisto";
    }
  }

  /** Do návodu vypíše, odkud web bere obsah a kdo ho naposledy publikoval. */
  async function vykresliStavObsahu() {
    const box = $("#stav-obsahu");
    const stav = await nactiStavObsahu();
    if (!box) return;
    if (!stav) {
      box.innerHTML = '<p class="napoveda">Stav se nepodařilo zjistit.</p>';
      return;
    }
    const kdy = stav.kdy ? new Date(stav.kdy) : null;
    const kdyText = kdy && !isNaN(kdy)
      ? kdy.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" }) +
        " v " + kdy.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })
      : "";
    box.innerHTML =
      '<div class="adm-panel" style="margin:12px 0"><div class="adm-radek"><span class="ar-info">' +
        '<span class="ar-nazev">' + (stav.zdroj === "uloziste"
          ? "Obsah publikovaný z administrace"
          : "Výchozí obsah ze souborů webu") + "</span>" +
        '<span class="ar-meta">' + (stav.zdroj === "uloziste"
          ? "naposledy publikováno " + esc(kdyText) + (stav.kdo ? " · " + esc(stav.kdo) : "") +
            (stav.velikost ? " · " + Math.round(stav.velikost / 1024) + " kB" : "")
          : "z administrace se zatím nepublikovalo") + "</span>" +
      "</span></div></div>";
  }

  /* ---------- Start ---------- */
  $$(".adm-taby .chip").forEach((ch) =>
    ch.addEventListener("click", () => {
      ui.tab = ch.getAttribute("data-tab");
      ui.editace = null;
      render();
    }));

  [$("#btn-publikovat"), $("#btn-publikovat-2")].forEach((b) => {
    if (b) b.addEventListener("click", publikovatVse);
  });

  $("#btn-pripojit").addEventListener("click", pripojitSlozku);
  $("#btn-ulozit").addEventListener("click", ulozit);
  $("#btn-ulozit-2").addEventListener("click", ulozit);
  $("#btn-stahnout").addEventListener("click", stahnout);
  $("#btn-zahodit").addEventListener("click", () => {
    if (!confirm("Zahodit všechny neuložené změny a načíst stav ze souboru data.js?")) return;
    localStorage.removeItem(DRAFT_KLIC);
    stav = stavZWebu();
    ulozenyJson = puvodniJson;
    ui.editace = null;
    render();
    aktualizujListu();
    toast("Změny zahozeny");
  });

  window.addEventListener("beforeunload", (evt) => {
    // draft je sice v localStorage, ale upozornit neškodí
    if ($("#adm-zmeny").hidden === false) { evt.preventDefault(); evt.returnValue = ""; }
  });

  $("#btn-odhlasit").addEventListener("click", () => {
    if ($("#adm-zmeny").hidden === false &&
        !confirm("Máte neuložené změny. Opravdu se odhlásit? Změny zůstanou rozpracované.")) return;
    AUTH.odhlas();
  });

  /* Administraci spouští až přihlašovací vrstva (js/admin-auth.js) —
     do té doby se nevykreslí žádný obsah. */
  window.spustAdministraci = function (auth) {
    AUTH = auth;
    const u = $("#adm-uzivatel");
    u.textContent = auth.email;
    u.hidden = false;
    $("#btn-odhlasit").hidden = false;

    // Na ostré adrese vede k cíli jediná cesta — Publikovat na web.
    // Ukládání do složky a stahování souboru dávají smysl jen lokálně;
    // na webu by to byly slepé uličky, tak je schováme.
    if (naWebu) {
      [$("#btn-publikovat"), $("#btn-publikovat-2")].forEach((b) => { if (b) b.hidden = false; });
      [$("#btn-pripojit"), $("#btn-ulozit"), $("#btn-ulozit-2"), $("#btn-stahnout")]
        .forEach((b) => { if (b) b.hidden = true; });
      const slozka = $("#adm-slozka");
      if (slozka) slozka.textContent = "Publikuje se přímo na web";
      const popis = $("#adm-zmeny-popis");
      if (popis) popis.textContent = "● Nepublikované změny";
      const zkusit = $("#btn-zkouska-2");
      if (zkusit) {
        zkusit.hidden = false;
        zkusit.addEventListener("click", () => {
          ui.tab = "navod";
          ui.editace = null;
          render();
          const tl = $("#btn-zkouska");
          if (tl) { tl.scrollIntoView({ block: "center" }); zkouskaPublikovani(tl); }
        });
      }
      // verze obsahu, nad kterou pracujeme — server podle ní pozná souběžnou změnu
      nactiStavObsahu().then((s) => {
        if (!s) return;
        if (!zDraftu) {
          zakladVerze = verzeObsahu;
        } else if (zakladVerze && verzeObsahu && zakladVerze !== verzeObsahu) {
          toast("Pozor: rozpracované změny vznikly nad starší verzí obsahu, než je teď na webu. " +
                "Než je publikujete, dejte Zkusit nanečisto — nebo Zahodit změny a zadejte je znovu.", "chyba");
        }
      });
    }

    if (zDraftu) {
      toast(naWebu
        ? "Načteny rozpracované změny z minula — na web je pošle Publikovat na web."
        : "Načteny rozpracované změny z minula — Uložit změny je zapíše do webu.");
    }

    render();
    aktualizujListu();
  };
})();
