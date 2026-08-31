/**
 * STŘEDOŠKOLSKÁ LUPA — ochrana administrace
 * ---------------------------------------------------------------
 * Běží na Cloudflare ještě dřív, než se cokoli pošle do prohlížeče.
 * Administraci (a její skripty) vydá jen tomu, kdo zná heslo — na
 * rozdíl od přihlášení v prohlížeči tohle obejít nejde.
 *
 * Heslo se nastavuje v Cloudflare (Settings → Variables and Secrets)
 * jako proměnná ADMIN_HESLO, volitelně i ADMIN_JMENO.
 * Dokud heslo nastavené není, administrace se nevydá vůbec nikomu.
 */

// co je součástí administrace a musí být pod heslem
const ADMIN_CESTY = /^\/(admin(\.html)?$|admin\/|js\/admin|css\/admin)/i;

export default {
  async fetch(request, env) {
    const cesta = new URL(request.url).pathname;

    if (ADMIN_CESTY.test(cesta)) {
      if (!maPristup(request, env)) {
        return new Response(
          "Administrace je chráněná heslem.\n\n" +
          "Pokud sem patříte, přihlaste se; jinak pokračujte na https://www.stredoskolska-lupa.cz",
          {
            status: 401,
            headers: {
              "WWW-Authenticate": 'Basic realm="Administrace Stredoskolska lupa", charset="UTF-8"',
              "Content-Type": "text/plain; charset=utf-8",
              // administrace nepatří do vyhledávačů ani do cache
              "Cache-Control": "no-store",
              "X-Robots-Tag": "noindex, nofollow",
            },
          }
        );
      }
      // přihlášeným pošleme administraci, ale bez ukládání do cache
      const odpoved = await env.ASSETS.fetch(request);
      const upravena = new Response(odpoved.body, odpoved);
      upravena.headers.set("Cache-Control", "no-store");
      upravena.headers.set("X-Robots-Tag", "noindex, nofollow");
      return upravena;
    }

    // všechno ostatní je běžný web
    return env.ASSETS.fetch(request);
  },
};

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

  const jmeno = prihlaseni.slice(0, del);
  const zadane = prihlaseni.slice(del + 1);

  return shodne(jmeno, env.ADMIN_JMENO || "admin") && shodne(zadane, heslo);
}

/** Porovnání v konstantním čase — neprozradí, kolik znaků sedí. */
function shodne(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let rozdil = 0;
  for (let i = 0; i < x.length; i++) rozdil |= x[i] ^ y[i];
  return rozdil === 0;
}
