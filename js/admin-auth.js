/* ============================================================
   STŘEDOŠKOLSKÁ LUPA — přihlášení do administrace (část v prohlížeči)
   ------------------------------------------------------------
   Samotné přihlášení řeší server (worker.js) — než se tahle
   stránka vůbec načte, je jasné, kdo ji otevřel. Tady se jen
   zjistí, kdo je přihlášený, a předá se to administraci.

   Hesla se na server nikdy neposílají. Prohlížeč z hesla spočítá
   otisk (PBKDF2-SHA256, 250 000 opakování) a odesílá jen ten;
   server si ukládá otisk otisku. Zpětně z toho heslo přečíst nejde.
   ============================================================ */
(function () {
  "use strict";

  const ITERACE = 250000;
  const enc = new TextEncoder();

  const normEmail = (s) => String(s || "").trim().toLowerCase();

  const hex = (buf) =>
    Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

  function hexNaBajty(s) {
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  function novaSul() {
    return hex(crypto.getRandomValues(new Uint8Array(16)));
  }

  async function otisk(heslo, sul, iterace) {
    const klic = await crypto.subtle.importKey("raw", enc.encode(heslo), "PBKDF2", false, ["deriveBits"]);
    const bity = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: hexNaBajty(sul), iterations: iterace || ITERACE, hash: "SHA-256" },
      klic, 256
    );
    return hex(bity);
  }

  /** Z hesla udělá to, co se posílá na server — sůl a ověřovač. */
  async function prihlasovaciUdaje(heslo) {
    const sul = novaSul();
    const o = await otisk(heslo, sul, ITERACE);
    const overovac = hex(await crypto.subtle.digest("SHA-256", enc.encode(o)));
    return { sul: sul, iterace: ITERACE, overovac: overovac };
  }

  /* ---------- Komunikace se serverem ---------- */

  async function server(cesta, data) {
    const odpoved = await fetch(cesta, data
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }
      : { method: "GET" });

    // relace vypršela — ať se objeví přihlašovací obrazovka
    if (odpoved.status === 401) { location.replace("/admin"); throw new Error("Relace vypršela."); }

    let vysledek = {};
    try { vysledek = await odpoved.json(); } catch (e) { /* prázdná odpověď */ }
    if (!odpoved.ok || !vysledek.ok) {
      throw new Error(vysledek.chyba || ("Server odpověděl " + odpoved.status));
    }
    return vysledek;
  }

  /* ---------- Start ---------- */

  const AUTH = {
    email: "",
    ucty: [],
    normEmail: normEmail,

    async odhlas() {
      try { await fetch("/admin/api/odhlaseni", { method: "POST" }); } catch (e) { /* nevadí */ }
      location.replace("/admin");
    },

    async pridatUcet(email, heslo) {
      const u = await prihlasovaciUdaje(heslo);
      u.email = email;
      prevezmi(await server("/admin/api/ucty", u));
    },

    async zmenitHeslo(heslo) {
      prevezmi(await server("/admin/api/ucty/heslo", await prihlasovaciUdaje(heslo)));
    },

    async smazatUcet(email) {
      prevezmi(await server("/admin/api/ucty/smazat", { email: email }));
    },
  };

  function prevezmi(data) {
    AUTH.email = data.ja || AUTH.email;
    AUTH.ucty = Array.isArray(data.ucty) ? data.ucty : [];
  }

  async function start() {
    if (!window.crypto || !crypto.subtle) {
      document.body.innerHTML =
        '<div style="padding:40px;font:16px/1.6 system-ui">Administraci otevřete přes ' +
        "<strong>https</strong> adresu — v tomhle režimu prohlížeč neumožňuje bezpečně " +
        "pracovat s heslem.</div>";
      return;
    }
    if (typeof window.spustAdministraci !== "function") {
      console.error("admin.js se nenačetl");
      return;
    }

    try {
      prevezmi(await server("/admin/api/ucty"));
    } catch (e) {
      document.body.innerHTML =
        '<div style="padding:40px;font:16px/1.6 system-ui">Administraci se nepodařilo načíst: ' +
        (e && e.message ? e.message : e) + "</div>";
      return;
    }

    window.spustAdministraci(AUTH);
  }

  document.addEventListener("DOMContentLoaded", start);
})();
