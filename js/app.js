/* ============================================================
   STŘEDOŠKOLSKÁ LUPA — logika webu
   (data se editují v js/data.js, tenhle soubor není potřeba měnit)
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Pomocníci ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const MESICE = ["ledna", "února", "března", "dubna", "května", "června",
    "července", "srpna", "září", "října", "listopadu", "prosince"];

  function fmtDatum(iso) {
    if (!iso) return "";
    const [r, m, d] = iso.split("-").map(Number);
    if (!r || !m || !d) return iso;
    return d + ". " + MESICE[m - 1] + " " + r;
  }

  const krajNazev = (kod) => KRAJE[kod] || kod;
  const typNazev = (kod) => TYPY_SKOL[kod] || kod;
  // odstraní diakritiku: NFD rozklad + smazání kombinujících znaků U+0300–U+036F
  const bezDiakritiky = (s) =>
    String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const skolaUrl = (s) => "skola.html?id=" + encodeURIComponent(s.id);

  /* ---------- Statistiky ---------- */
  function statistiky() {
    const skoly = SKOLY.length;
    const epizody = SKOLY.filter((s) => s.epizoda).length;
    const kraje = new Set(SKOLY.map((s) => s.kraj)).size;
    return { skoly, epizody, kraje };
  }

  function vyplnStatistiky() {
    const st = statistiky();
    const pruh = $(".hero-stats");
    // dokud v databázi nic není, čísla „0 škol“ nedávají smysl
    if (!st.skoly && pruh) {
      pruh.innerHTML = "<span>PRVNÍ EPIZODY PRÁVĚ NATÁČÍME</span><span>★</span><span>START V ZÁŘÍ 2026</span>";
      return;
    }
    $$("[data-stat]").forEach((el) => {
      const key = el.getAttribute("data-stat");
      if (st[key] != null) el.textContent = st[key];
    });
  }

  /* ---------- Hlavička: mobilní menu + aktivní odkaz ---------- */
  function initHlavicka() {
    const btn = $(".nav-toggle");
    const nav = $(".main-nav");
    if (btn && nav) {
      btn.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? "✕" : "≡";
      });
    }
    const page = document.body.getAttribute("data-page");
    const mapa = {
      index: "index.html", skoly: "skoly.html", skola: "skoly.html",
      blog: "blog.html", clanek: "blog.html",
      "o-projektu": "o-projektu.html", "pro-skoly": "pro-skoly.html",
    };
    const aktivni = mapa[page];
    if (aktivni) {
      $$(".main-nav a").forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (href.endsWith(aktivni) && !a.classList.contains("btn")) {
          a.setAttribute("aria-current", "page");
        }
      });
    }
  }

  /* ---------- Patička: sociální sítě ---------- */
  function initPaticku() {
    const mailA = $("[data-kontakt-email]");
    if (mailA) {
      mailA.href = "mailto:" + NASTAVENI.kontaktEmail;
      mailA.textContent = NASTAVENI.kontaktEmail;
    }
    const telA = $("[data-kontakt-telefon]");
    if (telA && NASTAVENI.kontaktTelefon) {
      telA.href = "tel:" + NASTAVENI.kontaktTelefon.replace(/\s+/g, "");
      telA.textContent = NASTAVENI.kontaktTelefon;
    }
    const box = $("[data-kanaly]");
    if (!box) return;
    const S = NASTAVENI.socialniSite || {};
    const polozky = [
      ["Instagram", S.instagram],
      ["TikTok", S.tiktok],
      ["YouTube", S.youtube],
      ["Facebook", S.facebook],
      ["Spotify", S.spotify],
      ["Apple Podcasts", S.applePodcasts],
    ].filter(([, url]) => url);
    if (!polozky.length) {
      box.innerHTML = '<li><span class="soon">Kanály spouštíme v září 2026.</span></li>';
      return;
    }
    box.innerHTML = polozky
      .map(([n, url]) => '<li><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(n) + "</a></li>")
      .join("");
  }

  /* ---------- Karty škol / epizod ---------- */
  function kartaSkoly(s) {
    const ep = s.epizoda;
    const badge = ep
      ? '<span class="badge-time">' + esc(ep.delka || "—") + "</span>"
      : '<span class="badge-soon">Připravujeme</span>';
    const foto = s.foto
      ? '<img src="' + esc(s.foto) + '" alt="' + esc(s.nazev) + '" loading="lazy">'
      : '<span class="thumb-note">foto ředitele</span>';
    const meta = ep
      ? esc(s.reditel) + " · Ep. " + ep.cislo + (ep.datum ? " · " + fmtDatum(ep.datum) : "")
      : esc(s.reditel);
    return (
      '<article class="card reveal">' +
        '<div class="card-thumb">' + foto + badge + "</div>" +
        '<div class="card-body">' +
          '<p class="card-label">' + esc(krajNazev(s.kraj)) + " · " + esc(typNazev(s.typ)) + "</p>" +
          '<h3 class="card-title h-disp"><a href="' + skolaUrl(s) + '">' + esc(s.nazev) + "</a></h3>" +
          '<p class="card-meta">' + meta + "</p>" +
          '<div class="card-play"><span class="play-dot" aria-hidden="true"></span><span class="line"></span></div>' +
        "</div>" +
      "</article>"
    );
  }

  function vykresliKarty(el, seznam) {
    el.innerHTML = seznam.map(kartaSkoly).join("");
    pozorujReveal(el);
  }

  /* ============================================================
     MAPA KRAJŮ (hranice v js/mapa-cr.js)
     ============================================================ */

  // skloňování: 1 škola / 2–4 školy / 5+ škol
  function sklonuj(n, tvary) {
    if (n === 1) return tvary[0];
    if (n >= 2 && n <= 4) return tvary[1];
    return tvary[2];
  }
  const sklonujSkoly = (n) => sklonuj(n, ["škola", "školy", "škol"]);
  const sklonujEpizody = (n) => sklonuj(n, ["epizoda", "epizody", "epizod"]);

  function poctyDleKraju() {
    const p = {};
    SKOLY.forEach((s) => {
      if (!p[s.kraj]) p[s.kraj] = { skoly: 0, epizody: 0 };
      p[s.kraj].skoly++;
      if (s.epizoda) p[s.kraj].epizody++;
    });
    return p;
  }

  // normalizace názvu obce pro hledání v OBCE_CR
  const normObec = (s) => bezDiakritiky(s).replace(/[-\s]+/g, " ").trim();

  // souřadnice obce: přesně v kraji > unikátní shoda kdekoli v ČR > větší města
  function bodObce(kraj, mesto) {
    const n = normObec(mesto);
    if (!n) return null;
    if (typeof OBCE_CR !== "undefined") {
      if (OBCE_CR[kraj] && OBCE_CR[kraj][n]) return OBCE_CR[kraj][n];
      let nalez = null, pocet = 0;
      for (const k in OBCE_CR) {
        if (OBCE_CR[k][n]) { pocet++; nalez = OBCE_CR[k][n]; }
      }
      if (pocet === 1) return nalez;
    }
    return MAPA_CR.mesta[bezDiakritiky(mesto)] || null;
  }

  // pozice školy v souřadnicích mapy: ruční pin (v %) > obec > střed kraje
  function bodSkoly(s) {
    const [vw, vh] = MAPA_CR.viewBox;
    if (s.pin && typeof s.pin.x === "number") {
      return [(s.pin.x / 100) * vw, (s.pin.y / 100) * vh];
    }
    const t = MAPA_CR.kraje[s.kraj];
    const zdroj = bodObce(s.kraj, s.mesto) || (t && t.stred);
    return zdroj ? [zdroj[0], zdroj[1]] : null;
  }

  /**
   * Vytvoří interaktivní mapu krajů (jednou) a vrátí ovladač
   * { update(kraj, skola) }.
   *
   * Úrovně: celá ČR (počty v krajích) → přiblížený kraj (piny škol
   * s popisky obcí) → zvýrazněná škola (oranžový pin).
   *
   * cb: { onKraj(kod), onSkola(id) } — bez callbacků kliky navigují
   * do katalogu (chování na hlavní straně).
   */
  function vytvorMapu(canvas, cb) {
    if (typeof MAPA_CR === "undefined" || !canvas) return null;
    cb = cb || {};
    const [vw, vh] = MAPA_CR.viewBox;
    const ZAKLAD = [0, 0, vw, vh];
    const pocty = poctyDleKraju();
    canvas.style.aspectRatio = vw + " / " + vh;

    // obálky (bbox) krajů spočtené z path dat
    const bboxy = {};
    for (const [kod, t] of Object.entries(MAPA_CR.kraje)) {
      const c = t.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (let i = 0; i + 1 < c.length; i += 2) {
        if (c[i] < x1) x1 = c[i];
        if (c[i] > x2) x2 = c[i];
        if (c[i + 1] < y1) y1 = c[i + 1];
        if (c[i + 1] > y2) y2 = c[i + 1];
      }
      bboxy[kod] = [x1, y1, x2 - x1, y2 - y1];
    }

    // statická kostra SVG
    let cesty = "", badges = "";
    for (const [kod, t] of Object.entries(MAPA_CR.kraje)) {
      const n = pocty[kod] ? pocty[kod].skoly : 0;
      cesty +=
        '<path class="kraj-tvar' + (n ? " ma-skoly" : "") + '" data-kraj="' + kod +
        '" d="' + t.d + '" fill-rule="evenodd" tabindex="0" role="button" aria-pressed="false"' +
        ' aria-label="' + esc(krajNazev(kod) + " — " + n + " " + sklonujSkoly(n)) + '"></path>';
      if (n) {
        badges +=
          '<g class="kraj-badge" data-kraj="' + kod + '">' +
          '<circle cx="' + t.stred[0] + '" cy="' + t.stred[1] + '" r="17"></circle>' +
          '<text x="' + t.stred[0] + '" y="' + (t.stred[1] + 5) + '">' + n + "</text></g>";
      }
    }
    canvas.innerHTML =
      '<svg class="cz" viewBox="0 0 ' + vw + " " + vh + '" role="group" aria-label="Mapa České republiky po krajích">' +
      cesty + badges + "</svg>" +
      '<div class="map-tip" hidden></div>';
    const svg = $("svg.cz", canvas);
    const tip = $(".map-tip", canvas);

    const stavM = { kraj: "", skola: "", vb: ZAKLAD.slice() };
    let animId = 0;
    const bezPohybu = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // cílový výřez pro kraj — bbox + okraj, dorovnaný na poměr stran mapy
    function cilovyVB(kod) {
      if (!kod || !bboxy[kod]) return ZAKLAD.slice();
      let [x, y, w, h] = bboxy[kod];
      const pad = Math.max(w, h) * 0.12;
      x -= pad; y -= pad; w += pad * 2; h += pad * 2;
      const pomer = vw / vh;
      if (w / h > pomer) { const nh = w / pomer; y -= (nh - h) / 2; h = nh; }
      else { const nw = h * pomer; x -= (nw - w) / 2; w = nw; }
      return [x, y, w, h];
    }

    function nastavVB(vb) {
      stavM.vb = vb;
      svg.setAttribute("viewBox", vb.map((v) => v.toFixed(2)).join(" "));
      rozmisti();
    }

    function animujVB(cil) {
      animId++;
      const id = animId, od = stavM.vb.slice(), t0 = performance.now(), DUR = 520;
      const skoro = od.every((v, i) => Math.abs(v - cil[i]) < 0.5);
      // skrytá karta: rAF nefiruje — skočit rovnou na cíl
      if (bezPohybu || skoro || document.visibilityState === "hidden") {
        nastavVB(cil);
        canvas.classList.remove("zoomuje");
        return;
      }
      const krok = (t) => {
        if (id !== animId) return;
        const p = Math.min(1, (t - t0) / DUR);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        nastavVB(od.map((v, i) => v + (cil[i] - v) * e));
        if (p < 1) requestAnimationFrame(krok);
        else canvas.classList.remove("zoomuje");
      };
      requestAnimationFrame(krok);
    }

    /* piny škol + popisky obcí (souřadnice v prostoru mapy v datasetu,
       na plátno se promítají podle aktuálního výřezu) */
    function smazPiny() { $$(".pin, .pin-label", canvas).forEach((el) => el.remove()); }

    function postavPiny(kod) {
      smazPiny();
      if (!kod) return;
      const dleObce = {};
      SKOLY.filter((s) => s.kraj === kod).forEach((s) => {
        const k = bezDiakritiky(s.mesto);
        (dleObce[k] = dleObce[k] || []).push(s);
      });
      const R = Math.max(9, (bboxy[kod] ? bboxy[kod][2] : vw) * 0.05); // rozestup ve stejné obci
      let html = "";
      Object.values(dleObce).forEach((grp) => {
        const zaklad = bodSkoly(grp[0]);
        if (!zaklad) return;
        grp.forEach((s, i) => {
          let sx = zaklad[0], sy = zaklad[1];
          if (grp.length > 1) {
            const uhel = (i / grp.length) * Math.PI * 2 - Math.PI / 2;
            sx += Math.cos(uhel) * R;
            sy += Math.sin(uhel) * R;
          }
          html +=
            '<a class="pin" href="' + skolaUrl(s) + '" data-id="' + esc(s.id) +
            '" data-sx="' + sx.toFixed(1) + '" data-sy="' + sy.toFixed(1) +
            '" aria-label="' + esc(s.nazev + " — " + s.mesto) + '">' +
            '<span class="pin-tip">' + esc(s.nazev) + "</span></a>";
        });
        html +=
          '<span class="pin-label" data-obec="' + esc(bezDiakritiky(grp[0].mesto)) +
          '" data-sx="' + zaklad[0] + '" data-sy="' + (zaklad[1] + (grp.length > 1 ? R : 0)) + '">' +
          esc(grp[0].mesto) + "</span>";
      });
      canvas.insertAdjacentHTML("beforeend", html);
      $$(".pin", canvas).forEach((pin) => {
        pin.addEventListener("click", (ev) => {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return; // nová karta → profil
          ev.preventDefault();
          if (cb.onSkola) cb.onSkola(pin.getAttribute("data-id"));
          else window.location.href = pin.getAttribute("href");
        });
      });
      rozmisti();
    }

    // promítne dataset souřadnice na % podle aktuálního výřezu
    function rozmisti() {
      const [x, y, w, h] = stavM.vb;
      $$("[data-sx]", canvas).forEach((el) => {
        el.style.left = ((((+el.getAttribute("data-sx")) - x) / w) * 100).toFixed(2) + "%";
        el.style.top = ((((+el.getAttribute("data-sy")) - y) / h) * 100).toFixed(2) + "%";
      });
    }

    function update(kraj, skola) {
      const zmenaKraje = kraj !== stavM.kraj;
      stavM.kraj = kraj;
      stavM.skola = skola || "";

      $$(".kraj-tvar", svg).forEach((p) => {
        const kod = p.getAttribute("data-kraj");
        p.classList.toggle("fokus", !!kraj && kod === kraj);
        p.classList.toggle("pozadi", !!kraj && kod !== kraj);
        p.setAttribute("aria-pressed", kraj === kod ? "true" : "false");
      });
      $$(".kraj-badge", svg).forEach((b) => { b.style.display = kraj ? "none" : ""; });

      if (zmenaKraje) {
        canvas.classList.add("zoomuje");
        postavPiny(kraj);
        animujVB(cilovyVB(kraj));
      }

      const vybrana = stavM.skola ? SKOLY.find((s) => s.id === stavM.skola) : null;
      $$(".pin", canvas).forEach((pin) => {
        const id = pin.getAttribute("data-id");
        pin.classList.toggle("aktivni", !!vybrana && id === stavM.skola);
        pin.classList.toggle("mimo", !!vybrana && id !== stavM.skola);
      });
      $$(".pin-label", canvas).forEach((l) => {
        l.classList.toggle("aktivni", !!vybrana && l.getAttribute("data-obec") === bezDiakritiky(vybrana.mesto));
      });
    }

    // interakce s kraji
    const kodZ = (ev) => {
      const p = ev.target.closest ? ev.target.closest(".kraj-tvar") : null;
      return p ? p.getAttribute("data-kraj") : null;
    };
    function klikKraj(kod) {
      if (!kod || kod === stavM.kraj) return;
      tip.hidden = true; // popisek nesmí zůstat viset po kliknutí
      if (cb.onKraj) cb.onKraj(kod);
      else window.location.href = "skoly.html?kraj=" + kod;
    }
    svg.addEventListener("click", (ev) => klikKraj(kodZ(ev)));
    svg.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const kod = kodZ(ev);
      if (!kod) return;
      ev.preventDefault();
      klikKraj(kod);
    });
    svg.addEventListener("mousemove", (ev) => {
      const kod = kodZ(ev);
      if (!kod || kod === stavM.kraj) { tip.hidden = true; return; }
      const n = pocty[kod] ? pocty[kod].skoly : 0;
      tip.textContent = krajNazev(kod) + " · " + n + " " + sklonujSkoly(n);
      const r = canvas.getBoundingClientRect();
      tip.style.left = (ev.clientX - r.left) + "px";
      tip.style.top = (ev.clientY - r.top) + "px";
      tip.hidden = false;
    });
    svg.addEventListener("mouseleave", () => { tip.hidden = true; });

    update("", "");
    return { update };
  }

  /* ---------- Panel kraje („tabulka") ---------- */
  function radekSkolyPanel(s) {
    const ep = s.epizoda;
    const stav = ep
      ? '<span class="badge-time">' + esc(ep.delka || "ep. " + ep.cislo) + "</span>"
      : '<span class="badge-soon">Připravujeme</span>';
    return (
      '<a class="kraj-radek" href="' + skolaUrl(s) + '" data-id="' + esc(s.id) + '">' +
        '<span class="kr-info">' +
          '<span class="kr-nazev">' + esc(s.nazev) + "</span>" +
          '<span class="kr-meta">' + esc(s.mesto) + " · " + esc(typNazev(s.typ)) + "</span>" +
        "</span>" +
        '<span class="kr-stav">' + stav + '<span class="kr-sipka" aria-hidden="true">→</span></span>' +
      "</a>"
    );
  }

  /* akce: { onKraj(kod), onSkola(id) } */
  function vykresliKrajPanel(el, kod, akce) {
    const pocty = poctyDleKraju();
    if (!SKOLY.length) {
      /* databáze je zatím prázdná — místo tabulky nul pozvánka */
      el.innerHTML =
        '<div class="kraj-panel-head">' +
          '<div class="kp-top"><span class="eyebrow">Startujeme</span></div>' +
          '<h3 class="h-disp">Mapa se plní<br>od září 2026</h3>' +
          '<p class="kp-stats">PRVNÍ EPIZODY PRÁVĚ NATÁČÍME</p>' +
        "</div>" +
        '<div class="kraj-panel-prazdny">' +
          "<p>Jakmile natočíme první epizody, objeví se tu školy podle krajů — a v mapě jejich obce. Chcete být mezi prvními?</p>" +
          '<a class="btn" href="pro-skoly.html#poptavka">Přidat svoji školu</a>' +
        "</div>";
      return;
    }
    if (!kod) {
      /* přehled celé ČR — tabulka krajů */
      const st = statistiky();
      const radky = Object.keys(KRAJE).map((k) => {
        const p = pocty[k] || { skoly: 0, epizody: 0 };
        return (
          '<button type="button" class="kraj-radek" data-kraj="' + k + '">' +
            '<span class="kr-info"><span class="kr-nazev">' + esc(KRAJE[k]) + "</span>" +
            '<span class="kr-meta">' + p.skoly + " " + sklonujSkoly(p.skoly) +
            (p.epizody ? " · " + p.epizody + " " + sklonujEpizody(p.epizody) : "") + "</span></span>" +
            '<span class="kr-stav"><span class="kr-sipka" aria-hidden="true">→</span></span>' +
          "</button>"
        );
      }).join("");
      el.innerHTML =
        '<div class="kraj-panel-head">' +
          '<div class="kp-top"><span class="eyebrow">Celá republika</span></div>' +
          '<h3 class="h-disp">Vyber si kraj</h3>' +
          '<p class="kp-stats">' + st.skoly + " ŠKOL · " + st.epizody + " EPIZOD · " + st.kraje + " KRAJŮ</p>" +
        "</div>" +
        '<div class="kraj-panel-body">' + radky + "</div>" +
        '<div class="kraj-panel-foot"><a class="link-arrow" href="pro-skoly.html">Chci sem svoji školu →</a></div>';
      $$(".kraj-radek[data-kraj]", el).forEach((b) =>
        b.addEventListener("click", () => akce.onKraj(b.getAttribute("data-kraj")))
      );
      return;
    }

    /* vybraný kraj — tabulka jeho škol */
    const skoly = SKOLY.filter((s) => s.kraj === kod);
    const p = pocty[kod] || { skoly: 0, epizody: 0 };
    let telo;
    if (skoly.length) {
      telo = '<div class="kraj-panel-body">' + skoly.map(radekSkolyPanel).join("") + "</div>";
    } else {
      telo =
        '<div class="kraj-panel-prazdny">' +
          "<p>V tomhle kraji zatím žádnou školu nemáme — právě domlouváme první natáčení. Znáte školu, která by tu neměla chybět?</p>" +
          '<a class="btn btn--ghost" href="pro-skoly.html">Přidat školu</a>' +
        "</div>";
    }
    el.innerHTML =
      '<div class="kraj-panel-head">' +
        '<div class="kp-top"><span class="eyebrow">Vybraný kraj</span>' +
          '<button type="button" class="kp-zrusit" id="kp-zrusit">✕ Celá ČR</button></div>' +
        '<h3 class="h-disp">' + esc(KRAJE[kod] || kod) + "</h3>" +
        '<p class="kp-stats">' + p.skoly + " " + sklonujSkoly(p.skoly).toUpperCase() +
          " · " + p.epizody + " " + sklonujEpizody(p.epizody).toUpperCase() + "</p>" +
      "</div>" +
      telo +
      '<div class="kraj-panel-foot">' +
        '<a class="link-arrow" href="#vysledky">zobrazit v katalogu ↓</a>' +
        '<a class="link-arrow" href="pro-skoly.html">přidat školu →</a>' +
      "</div>";
    $("#kp-zrusit", el).addEventListener("click", () => akce.onKraj(""));
    // klik na řádek školy → detail v panelu (ctrl/cmd klik = profil v nové kartě)
    $$("a.kraj-radek", el).forEach((a) =>
      a.addEventListener("click", (ev) => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
        ev.preventDefault();
        akce.onSkola(a.getAttribute("data-id"));
      })
    );
  }

  /* ---------- Panel školy (3. úroveň) ---------- */
  function vykresliSkolaPanel(el, s, akce) {
    const ep = s.epizoda;
    const foto = s.foto
      ? '<img src="' + esc(s.foto) + '" alt="' + esc(s.nazev) + '" loading="lazy">'
      : '<span class="thumb-note">foto ředitele</span>';
    const epBox = ep
      ? '<div class="sp-epizoda">' +
          '<span class="sp-ep-meta">Epizoda ' + ep.cislo +
            (ep.delka ? " · " + esc(ep.delka) : "") +
            (ep.datum ? " · " + fmtDatum(ep.datum) : "") + "</span>" +
          '<span class="sp-ep-nazev">„' + esc(ep.nazev) + "“</span>" +
        "</div>"
      : '<div class="sp-epizoda">' +
          '<span class="sp-ep-meta">Podcast</span>' +
          '<span class="badge-soon">Epizodu připravujeme</span>' +
        "</div>";
    const repBox = (s.reportaz && s.reportaz.youtube)
      ? '<div class="sp-epizoda">' +
          '<span class="sp-ep-meta">Reportáž ze školy</span>' +
          '<span class="sp-ep-nazev">▶ K přehrání na profilu</span>' +
        "</div>"
      : '<div class="sp-epizoda">' +
          '<span class="sp-ep-meta">Reportáž ze školy</span>' +
          '<span class="badge-soon">Připravujeme</span>' +
        "</div>";
    el.innerHTML =
      '<div class="kraj-panel-head">' +
        '<div class="kp-top"><span class="eyebrow">Detail školy</span>' +
          '<button type="button" class="kp-zrusit" id="kp-zpet">← ' + esc(KRAJE[s.kraj] || "Zpět") + "</button></div>" +
      "</div>" +
      '<div class="kraj-panel-body">' +
        '<div class="skola-panel-foto">' + foto + "</div>" +
        '<div class="skola-panel-telo">' +
          '<span class="sp-eyebrow">' + esc(s.mesto) + (s.adresa ? ", " + esc(s.adresa) : "") + " · " + esc(typNazev(s.typ)) + "</span>" +
          '<h3 class="h-disp">' + esc(s.nazev) + "</h3>" +
          '<span class="sp-reditel">Školu vede ' + esc(s.reditel) + "</span>" +
          epBox + repBox +
          (s.popis ? '<p class="sp-popis">' + esc(s.popis) + "</p>" : "") +
          '<div class="skola-panel-akce">' +
            '<a class="btn" href="' + skolaUrl(s) + '">Profil' + (ep ? " a epizoda" : " školy") + "</a>" +
            (s.web ? '<a class="btn btn--ghost" href="' + esc(s.web) + '" target="_blank" rel="noopener">Web ↗</a>' : "") +
          "</div>" +
        "</div>" +
      "</div>";
    $("#kp-zpet", el).addEventListener("click", () => akce.onSkola(""));
  }

  /* ---------- Běžící pruh ---------- */
  function initMarquee() {
    const track = $(".marquee-track");
    if (!track) return;
    const polozky = ["Nová epizoda každý týden", "★", "Rozhovory s řediteli", "★",
      "Promo videa pro školy", "★", "Workshop pro studenty", "★"];
    let html = "";
    for (let i = 0; i < 3; i++) html += polozky.map((p) => "<span>" + p + "</span>").join("");
    track.innerHTML = html + html; // dvě identické poloviny → plynulá smyčka
  }

  /* ---------- Animace při scrollu ---------- */
  let revealObserver = null;
  function pozorujReveal(root) {
    // bez .anim-ok se nic neskrývá — není co odhalovat
    if (!document.documentElement.classList.contains("anim-ok")) return;
    const cile = $$(".reveal", root || document);
    if (!("IntersectionObserver" in window)) {
      cile.forEach((el) => el.classList.add("in"));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              revealObserver.unobserve(e.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
      );
    }
    cile.forEach((el) => revealObserver.observe(el));
    // pojistka: kdyby observer z jakéhokoli důvodu nedoběhl,
    // po 3 s se vše zviditelní natvrdo
    setTimeout(() => cile.forEach((el) => el.classList.add("in")), 3000);
  }

  /* ============================================================
     STRÁNKY
     ============================================================ */

  /* ---------- Úvodní stránka ---------- */
  function initIndex() {
    // nejnovější epizody (podle data epizody)
    const grid = $("#nejnovejsi-grid");
    if (grid) {
      const sEpizodou = SKOLY.filter((s) => s.epizoda)
        .sort((a, b) => String(b.epizoda.datum || "").localeCompare(String(a.epizoda.datum || "")));
      if (sEpizodou.length) {
        vykresliKarty(grid, sEpizodou.slice(0, 3));
      } else {
        // před vydáním první epizody: místo prázdné mřížky pozvánka
        grid.classList.remove("grid", "grid--3");
        grid.innerHTML =
          '<div class="empty-state reveal">' +
            "<strong>První epizody právě natáčíme</strong>" +
            "<p>Rozhovory s řediteli a videoreportáže ze škol vycházejí od září 2026. " +
            "Chcete, aby vaše škola byla mezi prvními?</p>" +
            '<a class="btn" href="pro-skoly.html#poptavka">Přidat svoji školu</a>' +
          "</div>";
        pozorujReveal(grid);
      }
    }
    const mapa = $("#mapa-teaser");
    if (mapa) {
      vytvorMapu(mapa, {}); // klik na kraj → katalog s filtrem
      const popisek = $(".map-side p");
      if (popisek && !SKOLY.length) {
        popisek.textContent =
          "Od září se tu budou objevovat školy po celé republice — v kraji, kde je najdete, i v obci, kde sídlí.";
      }
    }

    const blogGrid = $("#blog-teaser");
    if (blogGrid && CLANKY.length) {
      const posty = CLANKY.slice(0, 3);
      blogGrid.innerHTML =
        kartaClankuHlavni(posty[0]) +
        (posty.length > 1
          ? '<div class="mini">' + posty.slice(1).map(kartaClanku).join("") + "</div>"
          : "");
      pozorujReveal(blogGrid);
    }

    // vyhledávání z hero → katalog
    const form = $("#hero-hledani");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = ($("#hero-q").value || "").trim();
        window.location.href = "skoly.html" + (q ? "?q=" + encodeURIComponent(q) : "");
      });
    }
  }

  /* ---------- Katalog škol ---------- */
  function initKatalog() {
    const grid = $("#katalog-grid");
    if (!grid) return;
    const inputQ = $("#filtr-q");
    const selectKraj = $("#filtr-kraj");

    // chipy typů škol se generují z číselníku TYPY_SKOL
    $("#typ-chipy").innerHTML = Object.entries(TYPY_SKOL)
      .map(([kod, nazev]) =>
        '<button type="button" class="chip" data-typ="' + kod + '" aria-pressed="false">' + esc(nazev) + "</button>")
      .join("");
    const chipsTyp = $$("[data-typ]");
    const pocetEl = $("#pocet-vysledku");
    const prazdno = $("#prazdny-stav");
    const mapaEl = $("#mapa-katalog");
    const panelEl = $("#kraj-panel");

    // naplnit select krajů
    selectKraj.innerHTML =
      '<option value="">Všechny kraje</option>' +
      Object.entries(KRAJE)
        .map(([kod, nazev]) => '<option value="' + kod + '">' + esc(nazev) + "</option>")
        .join("");

    // výchozí stav z URL (?q=&kraj=&typ=&skola=)
    const params = new URLSearchParams(window.location.search);
    const stav = {
      q: params.get("q") || "",
      kraj: KRAJE[params.get("kraj")] ? params.get("kraj") : "",
      typ: params.get("typ") || "",
      skola: "",
    };
    const skolaZUrl = SKOLY.find((s) => s.id === params.get("skola"));
    if (skolaZUrl) {
      stav.skola = skolaZUrl.id;
      stav.kraj = skolaZUrl.kraj; // škola vždy určuje kraj
    }
    inputQ.value = stav.q;
    selectKraj.value = stav.kraj;

    // výběr kraje (mapa, panel, select); "" = zpět na celou ČR
    function zvolKraj(kod) {
      stav.kraj = kod;
      stav.skola = "";
      selectKraj.value = kod;
      aplikuj();
    }

    // výběr školy na mapě / v tabulce kraje; "" = zpět na kraj
    function zvolSkolu(id) {
      const s = id ? SKOLY.find((x) => x.id === id) : null;
      stav.skola = s ? s.id : "";
      if (s) {
        stav.kraj = s.kraj;
        selectKraj.value = s.kraj;
      }
      aplikuj();
    }

    const mapa = vytvorMapu(mapaEl, { onKraj: zvolKraj, onSkola: zvolSkolu });

    function prekresliMapu() {
      if (mapa) mapa.update(stav.kraj, stav.skola);
      if (stav.skola) {
        const s = SKOLY.find((x) => x.id === stav.skola);
        vykresliSkolaPanel(panelEl, s, { onSkola: zvolSkolu });
      } else {
        vykresliKrajPanel(panelEl, stav.kraj, { onKraj: zvolKraj, onSkola: zvolSkolu });
      }
    }

    // Escape: škola → kraj → celá ČR
    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (stav.skola) zvolSkolu("");
      else if (stav.kraj) zvolKraj("");
    });

    function filtruj() {
      const q = bezDiakritiky(stav.q);
      return SKOLY.filter((s) => {
        if (stav.kraj && s.kraj !== stav.kraj) return false;
        if (stav.typ && s.typ !== stav.typ) return false;
        if (q) {
          const seno = bezDiakritiky(
            [s.nazev, s.mesto, krajNazev(s.kraj), typNazev(s.typ), s.reditel,
             s.epizoda && s.epizoda.nazev].filter(Boolean).join(" ")
          );
          if (!seno.includes(q)) return false;
        }
        return true;
      });
    }

    function aplikuj() {
      const vysledky = filtruj();
      vykresliKarty(grid, vysledky);
      pocetEl.textContent = vysledky.length + " " + sklonujSkoly(vysledky.length) +
        (stav.kraj ? " · " + krajNazev(stav.kraj) : "");
      prazdno.hidden = vysledky.length > 0;
      grid.hidden = vysledky.length === 0;
      if (!SKOLY.length) {
        // prázdná databáze ≠ příliš úzký filtr
        prazdno.innerHTML =
          "<strong>Databázi právě plníme</strong>" +
          "<p>První rozhovory s řediteli a videoreportáže ze škol vycházejí od září 2026. " +
          "Znáte školu, která by tu neměla chybět?</p>" +
          '<a class="btn" href="pro-skoly.html#poptavka">Přidat školu</a>';
      }

      chipsTyp.forEach((ch) =>
        ch.setAttribute("aria-pressed", ch.getAttribute("data-typ") === stav.typ ? "true" : "false")
      );

      prekresliMapu();

      // stav do URL (bez reloadu)
      const p = new URLSearchParams();
      if (stav.q) p.set("q", stav.q);
      if (stav.kraj) p.set("kraj", stav.kraj);
      if (stav.typ) p.set("typ", stav.typ);
      if (stav.skola) p.set("skola", stav.skola);
      const nova = p.toString();
      history.replaceState(null, "", window.location.pathname + (nova ? "?" + nova : "") + window.location.hash);
    }

    inputQ.addEventListener("input", () => { stav.q = inputQ.value.trim(); aplikuj(); });
    $("#filtr-form").addEventListener("submit", (e) => e.preventDefault());
    selectKraj.addEventListener("change", () => { zvolKraj(selectKraj.value); });
    chipsTyp.forEach((ch) =>
      ch.addEventListener("click", () => {
        const t = ch.getAttribute("data-typ");
        stav.typ = stav.typ === t ? "" : t;
        aplikuj();
      })
    );
    $("#filtr-reset").addEventListener("click", () => {
      stav.q = ""; stav.kraj = ""; stav.typ = ""; stav.skola = "";
      inputQ.value = ""; selectKraj.value = "";
      aplikuj();
    });

    aplikuj();
  }

  /* ---------- Detail školy ---------- */
  function initDetail() {
    const kont = $("#detail");
    if (!kont) return;
    const id = new URLSearchParams(window.location.search).get("id");
    const s = SKOLY.find((x) => x.id === id);

    if (!s) {
      kont.innerHTML =
        '<section class="sec sec--cream"><div class="wrap">' +
        '<div class="empty-state"><strong>Školu jsme nenašli</strong>' +
        "<p>Odkaz je možná zastaralý, nebo byla škola z databáze odebrána.</p>" +
        '<a class="btn" href="skoly.html">Zpět na všechny školy</a></div>' +
        "</div></section>";
      return;
    }

    document.title = s.nazev + " · Středoškolská lupa";
    const ep = s.epizoda;

    /* hero */
    let hero =
      '<section class="hero hero--page"><div class="wrap">' +
        '<a class="crumb" href="skoly.html">← Všechny školy</a>' +
        '<p class="eyebrow">' + esc(krajNazev(s.kraj)) + " · " + esc(typNazev(s.typ)) + " · " + esc(s.mesto) + "</p>" +
        '<h1 class="h-disp">' + esc(s.nazev) + "</h1>" +
        '<p class="hero-sub">' +
          (ep
            ? "Epizoda " + ep.cislo + ": „" + esc(ep.nazev) + "“. Hostem je " + esc(s.reditel) + "."
            : "Rozhovor s vedením školy právě připravujeme — školu vede " + esc(s.reditel) + ".") +
        "</p>" +
      "</div></section>";

    /* dvě videa: podcast + reportáž */
    const rep = s.reportaz;
    const podcastZdroj = ep && (ep.youtube || ep.spotify)
      ? { youtube: ep.youtube, spotify: ep.spotify, nazev: ep.nazev }
      : null;
    const reportazZdroj = rep && rep.youtube
      ? { youtube: rep.youtube, nazev: "Reportáž — " + s.nazev }
      : null;

    let videa = '<section class="sec sec--cream"><div class="wrap">';
    videa += '<div class="grid grid--2 videa-grid">';

    videa += '<div class="video-blok">';
    videa += '<p class="video-label">🎙 Podcast · rozhovor s vedením</p>';
    videa += '<div class="player-box" id="player-podcast">' +
      obsahPrehravace(podcastZdroj, "play-podcast",
        ep ? "Epizoda " + ep.cislo + " — záznam brzy doplníme" : "Epizodu s vedením školy připravujeme") +
      "</div>";
    if (ep) {
      const odkazy = [];
      if (ep.youtube) odkazy.push(["YouTube", "https://www.youtube.com/watch?v=" + ep.youtube]);
      if (ep.spotify) odkazy.push(["Spotify", "https://open.spotify.com/episode/" + ep.spotify]);
      if (ep.apple) odkazy.push(["Apple Podcasts", ep.apple]);
      if (odkazy.length) {
        videa +=
          '<div class="platforms">' +
          odkazy.map(([n, u]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + n + " ↗</a>").join("") +
          "</div>";
      }
      if (ep.popis) videa += '<p class="video-popis">' + esc(ep.popis) + "</p>";
    }
    videa += "</div>";

    videa += '<div class="video-blok">';
    videa += '<p class="video-label">🎬 Reportáž ze školy</p>';
    videa += '<div class="player-box" id="player-reportaz">' +
      obsahPrehravace(reportazZdroj, "play-reportaz", "Reportáž ze školy připravujeme") +
      "</div>";
    if (reportazZdroj) {
      videa +=
        '<div class="platforms"><a href="https://www.youtube.com/watch?v=' + encodeURIComponent(rep.youtube) +
        '" target="_blank" rel="noopener">YouTube ↗</a></div>';
    }
    videa += "</div>";

    videa += "</div></div></section>";

    /* o škole + fakta */
    let info = '<section class="sec sec--paper"><div class="wrap">';
    info += '<div class="grid grid--2 detail-grid">';
    info += "<div>";
    info += '<h2 class="h-disp" style="font-size:26px;margin-bottom:14px">O škole</h2>';
    info += '<p style="font-size:14.5px;line-height:1.7;color:#3d3a33">' + esc(s.popis || "") + "</p>";
    info += "</div><div>";
    info += '<dl class="fact-list">';
    info += '<div class="fact"><dt>Obec</dt><dd>' + esc(s.mesto) + "</dd></div>";
    if (s.adresa) info += '<div class="fact"><dt>Adresa</dt><dd>' + esc(s.adresa) + "</dd></div>";
    info += '<div class="fact"><dt>Kraj</dt><dd>' + esc(krajNazev(s.kraj)) + "</dd></div>";
    info += '<div class="fact"><dt>Typ školy</dt><dd>' + esc(typNazev(s.typ)) + "</dd></div>";
    info += '<div class="fact"><dt>Ředitel/ka</dt><dd>' + esc(s.reditel) + "</dd></div>";
    if (ep && ep.delka) info += '<div class="fact"><dt>Délka epizody</dt><dd>' + esc(ep.delka) + "</dd></div>";
    if (ep && ep.datum) info += '<div class="fact"><dt>Datum vydání</dt><dd>' + fmtDatum(ep.datum) + "</dd></div>";
    if (s.web) {
      info +=
        '<div class="fact"><dt>Web školy</dt><dd><a href="' + esc(s.web) + '" target="_blank" rel="noopener">' +
        esc(s.web.replace(/^https?:\/\/(www\.)?/, "")) + " ↗</a></dd></div>";
    }
    info += "</dl></div></div></div></section>";
    const player = videa + info;

    /* další školy z kraje */
    const dalsi = SKOLY.filter((x) => x.id !== s.id && x.kraj === s.kraj).slice(0, 3);
    const vyber = dalsi.length
      ? dalsi
      : SKOLY.filter((x) => x.id !== s.id).slice(0, 3);
    let related =
      '<section class="sec sec--paper"><div class="wrap">' +
      '<div class="sec-head"><h2 class="h-disp">' +
      (dalsi.length ? "Další školy z kraje" : "Další školy") +
      '</h2><a class="link-arrow" href="skoly.html">všechny školy →</a></div>' +
      '<div class="grid grid--3" id="related-grid"></div>' +
      "</div></section>";

    kont.innerHTML = hero + player + related;
    vykresliKarty($("#related-grid"), vyber);
    pripojPrehravac("play-podcast", "player-podcast", podcastZdroj);
    pripojPrehravac("play-reportaz", "player-reportaz", reportazZdroj);
    pozorujReveal(kont);
  }

  /* obsah boxu přehrávače: tlačítko přehrát / ohláška „připravujeme" */
  function obsahPrehravace(zdroj, btnId, poznamka) {
    if (!zdroj) {
      return (
        '<span class="play-big" aria-hidden="true" style="opacity:.45"></span>' +
        '<span class="player-note">' + esc(poznamka) + "</span>"
      );
    }
    const kde = zdroj.youtube ? "YouTube" : "Spotify";
    return (
      '<button type="button" class="player-cover" id="' + btnId + '" aria-label="Přehrát (' + kde + ')">' +
        '<span class="play-big" aria-hidden="true"></span>' +
        '<span class="player-note">Přehrát · ' + kde + "</span>" +
      "</button>"
    );
  }

  /* click-to-load embed (YouTube / Spotify) */
  function pripojPrehravac(btnId, boxId, zdroj) {
    const btn = $("#" + btnId);
    if (!btn || !zdroj) return;
    btn.addEventListener("click", () => {
      const box = $("#" + boxId);
      if (zdroj.youtube) {
        box.classList.add("is-video");
        box.innerHTML =
          '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(zdroj.youtube) +
          '?autoplay=1" title="' + esc(zdroj.nazev || "Video") + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
      } else if (zdroj.spotify) {
        box.classList.add("is-spotify");
        box.innerHTML =
          '<iframe src="https://open.spotify.com/embed/episode/' + encodeURIComponent(zdroj.spotify) +
          '" title="' + esc(zdroj.nazev || "Epizoda") + '" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" loading="lazy"></iframe>';
      }
    });
  }

  /* ---------- Blog ---------- */
  // velká karta nejnovějšího článku (hlavní strana)
  function kartaClankuHlavni(c) {
    return (
      '<article class="post-card post-hlavni reveal">' +
        '<span class="post-stitek">Nejnovější</span>' +
        "<time datetime=\"" + esc(c.datum) + '">' + fmtDatum(c.datum) + (c.autor ? " · " + esc(c.autor) : "") + "</time>" +
        '<h3 class="h-disp"><a href="clanek.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.titulek) + "</a></h3>" +
        "<p>" + esc(c.perex) + "</p>" +
        '<span class="more">číst dál →</span>' +
      "</article>"
    );
  }

  function kartaClanku(c) {
    return (
      '<article class="post-card reveal">' +
        "<time datetime=\"" + esc(c.datum) + '">' + fmtDatum(c.datum) + "</time>" +
        '<h3 class="h-disp"><a href="clanek.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.titulek) + "</a></h3>" +
        "<p>" + esc(c.perex) + "</p>" +
        '<span class="more">číst dál →</span>' +
      "</article>"
    );
  }

  function initBlog() {
    const grid = $("#blog-grid");
    if (!grid) return;
    grid.innerHTML = CLANKY.map(kartaClanku).join("");
    pozorujReveal(grid);
  }

  function initClanek() {
    const kont = $("#clanek");
    if (!kont) return;
    const id = new URLSearchParams(window.location.search).get("id");
    const c = CLANKY.find((x) => x.id === id);
    if (!c) {
      kont.innerHTML =
        '<section class="sec sec--cream"><div class="wrap">' +
        '<div class="empty-state"><strong>Článek jsme nenašli</strong>' +
        '<a class="btn" href="blog.html">Zpět na blog</a></div></div></section>';
      return;
    }
    document.title = c.titulek + " · Středoškolská lupa";
    kont.innerHTML =
      '<section class="hero hero--page"><div class="wrap">' +
        '<a class="crumb" href="blog.html">← Blog</a>' +
        '<p class="eyebrow">' + fmtDatum(c.datum) + (c.autor ? " · " + esc(c.autor) : "") + "</p>" +
        '<h1 class="h-disp">' + esc(c.titulek) + "</h1>" +
      "</div></section>" +
      '<section class="sec sec--cream"><div class="wrap">' +
        '<div class="article-body">' + c.obsah + "</div>" +
      "</div></section>" +
      '<section class="sec sec--paper"><div class="wrap">' +
        '<div class="sec-head"><h2 class="h-disp">Další články</h2>' +
        '<a class="link-arrow" href="blog.html">celý blog →</a></div>' +
        '<div class="grid grid--3">' +
        CLANKY.filter((x) => x.id !== c.id).slice(0, 3).map(kartaClanku).join("") +
        "</div></div></section>";
    pozorujReveal(kont);
  }

  /* ---------- Pro školy: poptávkový formulář ---------- */
  function initPoptavka() {
    const form = $("#poptavka-form");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = (id) => ($("#" + id) ? $("#" + id).value.trim() : "");
      const predmet = "Poptávka: promo video a podcast — " + (v("f-skola") || "škola");
      const telo = [
        "Dobrý den,",
        "",
        "máme zájem o natočení promo videa a zapojení do Středoškolské lupy.",
        "",
        "Jméno: " + v("f-jmeno"),
        "Škola: " + v("f-skola"),
        "E-mail: " + v("f-email"),
        "Telefon: " + (v("f-telefon") || "—"),
        "",
        "Poznámka:",
        v("f-zprava") || "—",
      ].join("\n");
      window.location.href =
        "mailto:" + NASTAVENI.kontaktEmail +
        "?subject=" + encodeURIComponent(predmet) +
        "&body=" + encodeURIComponent(telo);
      const pozn = $("#poptavka-pozn");
      if (pozn) {
        pozn.hidden = false;
        pozn.textContent =
          "Otevřel se váš e-mailový program s předvyplněnou zprávou — stačí odeslat. " +
          "Pokud se nic nestalo, napište nám přímo na " + NASTAVENI.kontaktEmail + ".";
      }
    });
  }

  /* ---------- Start ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    // animace zapnout jen tam, kde reálně poběží — jinak je vše
    // rovnou viditelné (skryté karty prohlížečů, reduced-motion…)
    const animaceOk =
      document.visibilityState === "visible" &&
      !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (animaceOk) document.documentElement.classList.add("anim-ok");

    initHlavicka();
    initPaticku();
    initMarquee();
    vyplnStatistiky();

    const page = document.body.getAttribute("data-page");
    if (page === "index") initIndex();
    if (page === "skoly") initKatalog();
    if (page === "skola") initDetail();
    if (page === "blog") initBlog();
    if (page === "clanek") initClanek();
    if (page === "pro-skoly") initPoptavka();

    pozorujReveal(document);
  });
})();
