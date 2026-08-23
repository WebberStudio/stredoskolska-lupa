/* ============================================================
   STŘEDOŠKOLSKÁ LUPA — DATA WEBU
   ------------------------------------------------------------
   Tohle je jediný soubor, který se edituje při správě obsahu.
   Žádný build, žádný programátor — uložit a nahrát na hosting.

   ⚠️ UKÁZKOVÁ DATA: školy, ředitelé i články níže jsou smyšlené
   placeholdery pro vývoj webu. Před spuštěním nahraďte
   skutečným obsahem.
   ============================================================ */

/* ---------- Nastavení webu ---------- */
const NASTAVENI = {
  kontaktEmail: "michaela@medialniworkshop.cz",
  kontaktTelefon: "+420 774 928 948",

  // Odkazy na sociální sítě — prázdný řetězec "" = odkaz se na webu zatím nezobrazí
  socialniSite: {
    instagram: "",
    tiktok: "",
    youtube: "",
    facebook: "",
    spotify: "",
    applePodcasts: "",
  },

  odkazMedialniWorkshop: "https://www.medialniworkshop.cz",
};

/* ---------- Číselníky ---------- */
const KRAJE = {
  PHA: "Praha",
  STC: "Středočeský kraj",
  JHC: "Jihočeský kraj",
  PLK: "Plzeňský kraj",
  KVK: "Karlovarský kraj",
  ULK: "Ústecký kraj",
  LBK: "Liberecký kraj",
  HKK: "Královéhradecký kraj",
  PAK: "Pardubický kraj",
  VYS: "Kraj Vysočina",
  JHM: "Jihomoravský kraj",
  OLK: "Olomoucký kraj",
  ZLK: "Zlínský kraj",
  MSK: "Moravskoslezský kraj",
};

/* Typy škol = kategorie filtrů v katalogu. Novou kategorii přidáte
   jedním řádkem — filtry i admin si ji převezmou samy. */
const TYPY_SKOL = {
  gymnazium: "Gymnázium",
  lyceum: "Lyceum",
  sos: "SOŠ",
  sou: "SOU",
  konzervator: "Konzervatoř",
  umelecka: "Umělecká škola",
};

/* ============================================================
   ŠKOLY A EPIZODY
   ------------------------------------------------------------
   Každá škola = jeden záznam. Jak přidat novou školu:
   1. Zkopírujte celý blok { ... }, včetně čárky za ním.
   2. `id` musí být unikátní, bez diakritiky a mezer
      (používá se v adrese: skola.html?id=...).
   3. Poloha na mapě se určí automaticky podle `mesto` = obec školy
      (zná ~140 českých měst; při neznámém městě se použije
      střed kraje). Ručně jde přebít volitelným polem
      `pin: { x: 33, y: 42 }` — procenta na mapě (x zleva, y shora).
      Volitelné pole `adresa` (ulice a č. p.) se ukazuje
      v detailu školy.
   4. `epizoda` může být null → škola se zobrazí jako
      „Epizodu připravujeme".
   5. U epizody vyplňte `youtube` (ID videa, tj. text za v=)
      nebo `spotify` (ID epizody z odkazu open.spotify.com/episode/...).
      Dokud jsou prázdné, na webu je místo přehrávače ohláška.
   6. Volitelné pole `reportaz: { youtube: "ID" }` = reportáž /
      promo video ze školy — druhý přehrávač na profilu školy.
      Bez něj se na profilu ukazuje „reportáž připravujeme".
   ============================================================ */
const SKOLY = [
  {
    id: "szs-voszs-pribram",
    nazev: "Střední zdravotnická škola a VOŠ zdravotnická",
    mesto: "Příbram",
    adresa: "Jiráskovy sady 113",
    kraj: "STC",
    typ: "sos",
    reditel: "Mgr. Jan Chvál",
    web: "https://szspb.cz",
    foto: null,
    popis:
      "Zdravotnická škola v centru Příbrami. Na střední škole nabízí obory praktická sestra, " +
      "zdravotnické lyceum, masér ve zdravotnictví a nutriční asistent, na vyšší odborné škole " +
      "diplomovanou všeobecnou a diplomovanou dětskou sestru. Součástí školy je domov mládeže, " +
      "vlastní jídelna i školní poradenské pracoviště.",
    epizoda: {
      cislo: 1,
      nazev: "Zdravotnická škola v Příbrami",
      delka: "15:08",
      datum: "2026-08-22",
      popis:
        "První díl Středoškolské lupy — rozhovor s ředitelem Střední zdravotnické školy " +
        "a Vyšší odborné školy zdravotnické v Příbrami.",
      youtube: "0tYj9iDBgRw",
      spotify: "",
      apple: "",
    },
  },

  /* ------------------------------------------------------------
     NOVOU ŠKOLU přidáte přes admin.html (doporučeno), nebo ručně:
     zkopírujte vzor níže sem nad tuto poznámku a odmažte lomítka.

  {
    id: "gymnazium-priklad-mesto",
    nazev: "Gymnázium Příklad",
    mesto: "Karlovy Vary",
    adresa: "Nádražní 12",
    kraj: "KVK",
    typ: "gymnazium",
    reditel: "Mgr. Jana Nováková",
    web: "https://www.priklad.cz",
    foto: null,
    popis: "Pár vět o škole, které uvidí uchazeči na profilu.",
    epizoda: {
      cislo: 1,
      nazev: "Název epizody",
      delka: "32:10",
      datum: "2026-09-15",
      popis: "O čem se v epizodě mluví.",
      youtube: "",
      spotify: "",
      apple: "",
    },
    reportaz: { youtube: "" },
  },

     ------------------------------------------------------------ */
];

/* ============================================================
   BLOG
   ------------------------------------------------------------
   Nový článek = nový blok { ... } na ZAČÁTEK pole (nejnovější
   nahoře). `obsah` je HTML — odstavce do <p>...</p>,
   mezititulky do <h2>...</h2>.
   ============================================================ */
const CLANKY = [
  {
    id: "spoustime-stredoskolskou-lupu",
    titulek: "Spouštíme Středoškolskou lupu",
    datum: "2026-08-20",
    autor: "Michaela Brejchová",
    perex:
      "Vzniká první web, kde si poslechnete ředitele a ředitelky středních škol " +
      "z celé republiky. Proč to děláme a co u nás najdete?",
    obsah: `
      <p>Výběr střední školy je jedno z prvních velkých rozhodnutí v životě — a dělá se
      skoro naslepo. Weby škol vypadají jeden jako druhý, dny otevřených dveří trvají
      dvě hodiny a „od doslechu" ví každý něco jiného. Chyběl formát, kde školu
      představí sám člověk, který ji vede. Osobně, do hloubky a tak, že se k tomu
      dá kdykoli vrátit.</p>
      <p>Proto vzniká <strong>Středoškolská lupa</strong> — databáze středoškolských
      podcastů. Základem jsou rozhovory s řediteli a ředitelkami, které natáčí náš tým.
      Každá škola dostane svůj profil, epizodu si pustíte přímo na webu a školy
      můžete filtrovat podle kraje, města i typu.</p>
      <h2>Co u nás najdete</h2>
      <p>Katalog škol s vyhledáváním a mapou, profily škol s přehrávačem epizod,
      a blog s novinkami z projektu i články o výběru školy a mediálním vzdělávání.
      Epizody poběží také na Spotify, Apple Podcasts a YouTube.</p>
      <p>Projekt navazuje na <a href="https://www.medialniworkshop.cz" target="_blank" rel="noopener">Mediální
      workshop</a>, jediný celorepublikový projekt mediálního vzdělávání pro školy.
      Sledujte nás — první epizoda vychází v září.</p>
    `,
  },
  {
    id: "prvni-epizoda-vyjde-v-zari",
    titulek: "První epizoda vyjde v září",
    datum: "2026-08-18",
    autor: "Redakce",
    perex:
      "Pilotní díl natáčíme s první školou už za pár týdnů. Podívejte se, jak bude " +
      "natáčení probíhat a co všechno škola získá.",
    obsah: `
      <p>Léto věnujeme přípravám — a v září to vypukne. První pilotní epizoda vznikne
      ve spolupráci s první zapojenou školou a hned po zpracování zamíří do databáze
      i na podcastové platformy.</p>
      <h2>Jak natáčení probíhá</h2>
      <p>U vás ve škole proběhne <strong>mediální workshop pro studenty</strong> a
      natočíme <strong>promo video školy na míru</strong> — techniku i know-how
      přivezeme s sebou. <strong>Podcast s ředitelem či ředitelkou</strong> pak
      natáčíme u nás ve studiu, v klidu a v kvalitě, kterou si rozhovor zaslouží.</p>
      <p>Z každé epizody navíc vzniknou krátké sestřihy na sociální sítě — škola tak
      dostane hotový balíček obsahu, který může sdílet na svém webu i sítích.</p>
      <p>Chcete být mezi prvními? <a href="pro-skoly.html">Ozvěte se nám</a>.</p>
    `,
  },
  {
    id: "jak-vybrat-stredni-skolu",
    titulek: "Jak vybrat střední školu a nezbláznit se z toho",
    datum: "2026-08-10",
    autor: "Redakce",
    perex:
      "Deváťák doma, tabulky s termíny na lednici a nervy na pochodu? Pár tipů, " +
      "jak si výběr školy zjednodušit — a na co se ptát.",
    obsah: `
      <p>Přihlášky se podávají až v zimě, ale rozhodování začíná právě teď. Dobrá
      zpráva: nemusíte objet dvacet dnů otevřených dveří. Stačí si výběr rozdělit
      na pár kroků.</p>
      <h2>1. Nejdřív typ školy, pak konkrétní škola</h2>
      <p>Gymnázium, SOŠ, nebo SOU? Základní otázka nezní „kam se dostanu", ale
      „co chci dělat po škole". Vysoká škola bez jasné představy → gymnázium.
      Konkrétní obor, který láká → SOŠ. Řemeslo a rychlý nástup do praxe → SOU.</p>
      <h2>2. Poslouchejte lidi, ne brožury</h2>
      <p>Papír snese všechno. Mnohem víc poznáte z toho, jak o škole mluví její
      ředitel, učitelé a studenti. Přesně proto natáčíme rozhovory s řediteli —
      poznáte atmosféru a hodnoty školy dřív, než podáte přihlášku.</p>
      <h2>3. Na dni otevřených dveří se ptejte konkrétně</h2>
      <ul>
        <li>Kolik studentů odchází po prvním ročníku — a proč?</li>
        <li>Jak vypadá běžný rozvrh v prvním ročníku?</li>
        <li>Co dělají absolventi rok po maturitě?</li>
        <li>Jak škola řeší, když student „nestíhá"?</li>
      </ul>
      <p>A hlavně klid. Výběr školy je důležitý, ale není nevratný. I přestup jde
      zvládnout — mnohem hůř se dohání ztracená motivace.</p>
    `,
  },
];
