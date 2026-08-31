/* ============================================================
   STŘEDOŠKOLSKÁ LUPA — PŘIHLÁŠENÍ DO ADMINISTRACE
   ------------------------------------------------------------
   Zámek před administrací. Heslo se nikam neposílá ani neukládá —
   počítá se z něj otisk (PBKDF2-SHA256, 250 000 iterací) a ten se
   porovnává s otiskem v js/admin-ucty.js.

   ⚠️ Co tahle ochrana umí a co ne:
   • Zabrání tomu, aby administraci otevřel někdo, kdo k ní nemá
     heslo — kolega u počítače, návštěva, náhodný nálezce adresy.
   • NENAHRAZUJE serverové přihlášení. Web je statický, takže
     veškerá kontrola běží v prohlížeči. Zkušenější člověk ji umí
     obejít. Skutečnou ochranou je, že administrace není na
     internetu (viz .gitignore) — držte to tak.
   • I kdyby se někdo dostal dovnitř, nemůže přepsat živý web:
     administrace jen připraví soubor, který se pak nahrává ručně.
   ============================================================ */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);

  const ITERACE = 250000;             // pomalé schválně — ztěžuje hádání hesla
  const RELACE_KLIC = "lupaAdminRelace";
  const POKUSY_KLIC = "lupaAdminPokusy";
  const PLATNOST_H = 8;               // jak dlouho zůstat přihlášen
  const MAX_POKUSU = 5;
  const ZAMEK_MIN = 5;

  /* ---------- Kryptografie (Web Crypto) ---------- */
  const enc = new TextEncoder();
  const hex = (buf) =>
    Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

  function sulHex() {
    return hex(crypto.getRandomValues(new Uint8Array(16)));
  }

  function hexNaBajty(s) {
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  async function otisk(heslo, sul, iterace) {
    const klic = await crypto.subtle.importKey("raw", enc.encode(heslo), "PBKDF2", false, ["deriveBits"]);
    const bity = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: hexNaBajty(sul), iterations: iterace || ITERACE, hash: "SHA-256" },
      klic, 256
    );
    return hex(bity);
  }

  // porovnání v konstantním čase (neprozradí, kolik znaků sedí)
  function shodne(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  const normEmail = (s) => String(s || "").trim().toLowerCase();

  /* ---------- Účty ---------- */
  // pracovní kopie — administrace ji může měnit (záložka Účty)
  const ucty = (typeof ADMIN_UCTY !== "undefined" && Array.isArray(ADMIN_UCTY))
    ? ADMIN_UCTY.map((u) => Object.assign({}, u))
    : [];

  async function vytvorUcet(email, heslo) {
    const sul = sulHex();
    return {
      email: normEmail(email),
      sul: sul,
      hash: await otisk(heslo, sul, ITERACE),
      iterace: ITERACE,
      vytvoren: new Date().toISOString().slice(0, 10),
    };
  }

  async function overUcet(email, heslo) {
    const u = ucty.find((x) => normEmail(x.email) === normEmail(email));
    if (!u) {
      // i pro neznámý e-mail počítáme hash — ať se podle rychlosti nepozná,
      // který e-mail v systému existuje
      await otisk(heslo, sulHex(), ITERACE);
      return null;
    }
    const h = await otisk(heslo, u.sul, u.iterace || ITERACE);
    return shodne(h, u.hash) ? u : null;
  }

  /* ---------- Relace ---------- */
  function prihlasen() {
    try {
      const r = JSON.parse(sessionStorage.getItem(RELACE_KLIC) || "null");
      if (!r || !r.email || !r.do) return null;
      if (Date.now() > r.do) { sessionStorage.removeItem(RELACE_KLIC); return null; }
      // účet mezitím mohl být smazán
      if (!ucty.some((u) => normEmail(u.email) === normEmail(r.email))) return null;
      return r;
    } catch (e) { return null; }
  }

  function zaloziRelaci(email) {
    sessionStorage.setItem(RELACE_KLIC, JSON.stringify({
      email: normEmail(email),
      do: Date.now() + PLATNOST_H * 3600 * 1000,
    }));
  }

  function odhlas() {
    sessionStorage.removeItem(RELACE_KLIC);
    location.reload();
  }

  /* ---------- Ochrana proti hádání hesla ---------- */
  function stavPokusu() {
    try { return JSON.parse(localStorage.getItem(POKUSY_KLIC) || "null") || { n: 0, do: 0 }; }
    catch (e) { return { n: 0, do: 0 }; }
  }
  function zapisPokusy(s) {
    try { localStorage.setItem(POKUSY_KLIC, JSON.stringify(s)); } catch (e) { /* nevadí */ }
  }
  function zbyvaZamek() {
    const s = stavPokusu();
    return s.do && Date.now() < s.do ? Math.ceil((s.do - Date.now()) / 60000) : 0;
  }
  function neuspech() {
    const s = stavPokusu();
    s.n = (s.n || 0) + 1;
    if (s.n >= MAX_POKUSU) { s.do = Date.now() + ZAMEK_MIN * 60000; s.n = 0; }
    zapisPokusy(s);
  }
  const uspech = () => zapisPokusy({ n: 0, do: 0 });

  /* ---------- Obrazovka přihlášení ---------- */
  function overlay(prvniSpusteni) {
    const box = document.createElement("div");
    box.className = "auth-overlay";
    box.innerHTML =
      '<div class="auth-karta">' +
        '<img class="auth-logo" src="assets/logo.png" alt="" width="96" height="96">' +
        '<p class="eyebrow">Administrace</p>' +
        '<h1 class="h-disp auth-nadpis">' +
          (prvniSpusteni ? "Nastavte si přístup" : "Přihlášení") + "</h1>" +
        '<p class="auth-popis">' +
          (prvniSpusteni
            ? "Zatím tu není žádný účet. Vyberte si e-mail a heslo — uloží se jen otisk hesla, ne heslo samotné."
            : "Zadejte e-mail a heslo, které používáte pro správu obsahu.") +
        "</p>" +
        '<form class="auth-form" id="auth-form" novalidate>' +
          '<div class="field"><label for="auth-email">E-mail</label>' +
            '<input id="auth-email" type="email" autocomplete="username" required></div>' +
          '<div class="field"><label for="auth-heslo">Heslo</label>' +
            '<input id="auth-heslo" type="password" autocomplete="' +
              (prvniSpusteni ? "new-password" : "current-password") + '" required></div>' +
          (prvniSpusteni
            ? '<div class="field"><label for="auth-heslo2">Heslo ještě jednou</label>' +
              '<input id="auth-heslo2" type="password" autocomplete="new-password" required></div>'
            : "") +
          '<p class="auth-chyba" id="auth-chyba" hidden></p>' +
          '<button type="submit" class="btn" id="auth-odeslat">' +
            (prvniSpusteni ? "Vytvořit účet a vstoupit" : "Přihlásit se") + "</button>" +
        "</form>" +
        '<p class="auth-pozn">' +
          (prvniSpusteni
            ? "Heslo si dobře zapamatujte — nejde ho obnovit e-mailem. Kdybyste ho zapomněli, smaže se soubor js/admin-ucty.js a nastavíte si přístup znovu."
            : "Heslo jste zapomněli? Smažte obsah souboru js/admin-ucty.js (nechte tam prázdný seznam) a nastavíte si přístup znovu.") +
        "</p>" +
      "</div>";
    document.body.appendChild(box);
    document.body.classList.add("auth-zamceno");
    return box;
  }

  function chyba(text) {
    const el = $("#auth-chyba");
    el.textContent = text;
    el.hidden = false;
  }

  // běží administrace na veřejné adrese, nebo lokálně u mě v počítači?
  const mistni = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
                 location.protocol === "file:";

  function start() {
    // administrace se nesmí vykreslit dřív, než je jasné, kdo ji otevřel
    const relace = prihlasen();
    if (relace) return spust(relace.email);

    const prvni = ucty.length === 0;

    // POJISTKA: zakládat první účet jde jen lokálně. Na veřejné adrese
    // by si ho jinak mohl vytvořit kdokoliv, kdo stránku najde.
    if (prvni && !mistni) {
      const box = document.createElement("div");
      box.className = "auth-overlay";
      box.innerHTML =
        '<div class="auth-karta">' +
          '<img class="auth-logo" src="assets/logo.png" alt="" width="96" height="96">' +
          '<p class="eyebrow">Administrace</p>' +
          '<h1 class="h-disp auth-nadpis">Přístup není nastaven</h1>' +
          '<p class="auth-popis">Na téhle adrese nejde účet založit — bezpečnostní pojistka. ' +
          "Otevřete administraci na svém počítači (localhost), vytvořte účet tam a nahrajte " +
          "soubor <strong>js/admin-ucty.js</strong> na web.</p>" +
          '<p class="auth-pozn">Že jste se sem dostali, znamená, že jste prošli heslem ' +
          "na úrovni serveru. Účty pro samotnou administraci se ale zakládají jen lokálně.</p>" +
        "</div>";
      document.body.appendChild(box);
      document.body.classList.add("auth-zamceno");
      return;
    }
    const box = overlay(prvni);
    const form = $("#auth-form", box);
    const tlacitko = $("#auth-odeslat", box);
    $("#auth-email", box).focus();

    const zamek = zbyvaZamek();
    if (zamek) chyba("Příliš mnoho pokusů. Zkuste to znovu za " + zamek + " min.");

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      $("#auth-chyba", box).hidden = true;

      const min = zbyvaZamek();
      if (min) { chyba("Příliš mnoho pokusů. Zkuste to znovu za " + min + " min."); return; }

      const email = $("#auth-email", box).value.trim();
      const heslo = $("#auth-heslo", box).value;

      if (!email || !heslo) { chyba("Vyplňte e-mail i heslo."); return; }

      tlacitko.disabled = true;
      tlacitko.textContent = "Ověřuji…";
      try {
        if (prvni) {
          const heslo2 = $("#auth-heslo2", box).value;
          if (heslo.length < 8) { chyba("Heslo musí mít aspoň 8 znaků."); return; }
          if (heslo !== heslo2) { chyba("Hesla se neshodují."); return; }
          ucty.push(await vytvorUcet(email, heslo));
          uspech();
          zaloziRelaci(email);
          box.remove();
          document.body.classList.remove("auth-zamceno");
          spust(email, true);
          return;
        }

        const u = await overUcet(email, heslo);
        if (!u) {
          neuspech();
          const z = zbyvaZamek();
          chyba(z ? "Příliš mnoho pokusů. Zkuste to znovu za " + z + " min."
                  : "E-mail nebo heslo nesouhlasí.");
          $("#auth-heslo", box).value = "";
          return;
        }
        uspech();
        zaloziRelaci(u.email);
        box.remove();
        document.body.classList.remove("auth-zamceno");
        spust(u.email);
      } catch (e) {
        chyba("Přihlášení selhalo: " + (e && e.message ? e.message : e));
      } finally {
        tlacitko.disabled = false;
        tlacitko.textContent = prvni ? "Vytvořit účet a vstoupit" : "Přihlásit se";
      }
    });
  }

  function spust(email, prvniUcet) {
    if (typeof window.spustAdministraci !== "function") {
      console.error("admin.js se nenačetl");
      return;
    }
    window.spustAdministraci({
      email: email,
      prvniUcet: !!prvniUcet,
      ucty: ucty,
      odhlas: odhlas,
      vytvorUcet: vytvorUcet,
      normEmail: normEmail,
    });
  }

  if (!window.crypto || !crypto.subtle) {
    document.body.innerHTML =
      '<div style="padding:40px;font:16px/1.6 system-ui">Administraci otevřete přes ' +
      "<strong>http://localhost:…</strong> nebo https adresu — v tomhle režimu prohlížeč " +
      "neumožňuje bezpečně ověřit heslo.</div>";
    return;
  }

  document.addEventListener("DOMContentLoaded", start);
})();
