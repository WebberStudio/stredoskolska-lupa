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
    id: "gymnazium-na-vyhlidce-karlovy-vary",
    nazev: "Gymnázium Na Vyhlídce",
    mesto: "Karlovy Vary",
    adresa: "Vyhlídková 12",
    kraj: "KVK",
    typ: "gymnazium",
    reditel: "Mgr. Jana Dvořáková",
    web: "https://www.example.cz",
    foto: null, // cesta k fotce, např. "assets/skoly/vyhlidka.jpg" (ideálně 1200×800)
    popis:
      "Všeobecné gymnázium s rozšířenou výukou jazyků a vlastním debatním klubem. " +
      "Studenti vyjíždějí na výměnné pobyty do Německa a Francie a škola dlouhodobě " +
      "patří k nejúspěšnějším v kraji u maturit i v přijímacích řízeních na vysoké školy.",
    epizoda: {
      cislo: 1,
      nazev: "Škola není fabrika na jedničky",
      delka: "32:10",
      datum: "2026-09-15",
      popis:
        "O tom, proč známky nejsou všechno, jak se gymnázium mění s nástupem AI " +
        "a co by paní ředitelka vzkázala deváťákům, kteří se bojí přijímaček.",
      youtube: "",  // TODO: ID videa na YouTube
      spotify: "",  // TODO: ID epizody na Spotify
      apple: "",    // TODO: odkaz na Apple Podcasts
    },
  },
  {
    id: "sps-medialni-tvorby-praha",
    nazev: "SPŠ mediální tvorby",
    mesto: "Praha",
    kraj: "PHA",
    typ: "sos",
    reditel: "Ing. Petr Novotný",
    web: "https://www.example.cz",
    foto: null,
    popis:
      "Střední průmyslová škola zaměřená na média, grafiku a audiovizuální tvorbu. " +
      "Studenti mají k dispozici vlastní televizní studio, střižny a fotoateliér, " +
      "praxe probíhají přímo v produkčních firmách a redakcích.",
    epizoda: {
      cislo: 2,
      nazev: "Máme studio, jaké nemá ani leckterá televize",
      delka: "28:44",
      datum: "2026-09-22",
      popis:
        "Jak vypadá výuka, když je učebnou televizní studio, proč škola nebere " +
        "každého a co dělají absolventi po maturitě.",
      youtube: "",
      spotify: "",
      apple: "",
    },
  },
  {
    id: "gymnazium-bratri-simu-plzen",
    nazev: "Gymnázium Bratří Šímů",
    mesto: "Plzeň",
    kraj: "PLK",
    typ: "gymnazium",
    reditel: "PhDr. Martin Kraus",
    web: "https://www.example.cz",
    foto: null,
    popis:
      "Osmileté i čtyřleté gymnázium v centru Plzně. Silná matematika a přírodní " +
      "vědy, robotický kroužek a každoroční studentská vědecká konference.",
    epizoda: {
      cislo: 3,
      nazev: "Proč se nebát matiky (a přijímaček)",
      delka: "41:02",
      datum: "2026-10-01",
      popis:
        "Pan ředitel o tom, jak se z „strašáku školy“ stala nejoblíbenější hodina, " +
        "a jak vypadá den otevřených dveří, který má smysl.",
      youtube: "",
      spotify: "",
      apple: "",
    },
  },
  {
    id: "sos-cestovniho-ruchu-brno",
    nazev: "SOŠ cestovního ruchu",
    mesto: "Brno",
    kraj: "JHM",
    typ: "sos",
    reditel: "Mgr. Alena Horká",
    web: "https://www.example.cz",
    foto: null,
    popis:
      "Odborná škola, ze které se odjíždí na praxe do celé Evropy. Průvodcovství, " +
      "hotelnictví a event management — a školní cestovka, kterou vedou sami studenti.",
    epizoda: {
      cislo: 4,
      nazev: "Naši studenti provádí turisty po Vídni",
      delka: "26:31",
      datum: "2026-10-08",
      popis:
        "O praxi v zahraničí, jazycích a o tom, proč je cestovní ruch obor " +
        "s budoucností i v době, kdy si každý umí koupit letenku sám.",
      youtube: "",
      spotify: "",
      apple: "",
    },
  },
  {
    id: "sou-strojirenske-ostrava",
    nazev: "SOU strojírenské",
    mesto: "Ostrava",
    kraj: "MSK",
    typ: "sou",
    reditel: "Ing. Tomáš Baláž",
    web: "https://www.example.cz",
    foto: null,
    popis:
      "Učiliště, jehož absolventi mají práci jistou dřív, než dostudují. Moderní " +
      "dílny s CNC stroji, svařovací škola a stipendia od partnerských firem.",
    epizoda: {
      cislo: 5,
      nazev: "Řemeslo má zlaté dno. A slušnou výplatu",
      delka: "24:18",
      datum: "2026-10-15",
      popis:
        "Pan ředitel o tom, kolik si vydělá vyučený strojař, proč firmy stojí " +
        "frontu na absolventy a jak vypadá moderní učiliště v roce 2026.",
      youtube: "",
      spotify: "",
      apple: "",
    },
  },
  {
    id: "gymnazium-pod-vezi-hradec-kralove",
    nazev: "Gymnázium Pod Věží",
    mesto: "Hradec Králové",
    kraj: "HKK",
    typ: "gymnazium",
    reditel: "Mgr. Lucie Sedláčková",
    web: "https://www.example.cz",
    foto: null,
    popis:
      "Menší gymnázium rodinného typu s důrazem na humanitní obory, školní " +
      "divadlo a vlastní studentský časopis, který sbírá celostátní ocenění.",
    epizoda: null, // epizodu připravujeme
  },
  {
    id: "obchodni-akademie-ceske-budejovice",
    nazev: "Obchodní akademie",
    mesto: "České Budějovice",
    kraj: "JHC",
    typ: "sos",
    reditel: "Ing. Pavel Šindelář",
    web: "https://www.example.cz",
    foto: null,
    popis:
      "Ekonomika, účetnictví a fiktivní firmy, ve kterých si studenti vyzkouší " +
      "podnikání nanečisto. Spolupráce s podnikateli z regionu a kroužek investování.",
    epizoda: null,
  },
  {
    id: "gymnazium-u-jezera-liberec",
    nazev: "Gymnázium U Jezera",
    mesto: "Liberec",
    kraj: "LBK",
    typ: "gymnazium",
    reditel: "RNDr. Eva Marešová",
    web: "https://www.example.cz",
    foto: null,
    popis:
      "Gymnázium se sportovními třídami pod Ještědem. Lyžařský areál za rohem, " +
      "spolupráce s Technickou univerzitou a silné přírodovědné semináře.",
    epizoda: null,
  },
  {
    id: "sos-lazenska-ostrov",
    nazev: "SOŠ lázeňství a wellness",
    mesto: "Ostrov",
    adresa: "Zámecká 4",
    kraj: "KVK",
    typ: "sos",
    reditel: "Mgr. Radek Poledník",
    web: "https://www.example.cz",
    foto: null,
    popis:
      "Odborná škola spjatá s lázeňskou tradicí regionu — masér, kosmetička, " +
      "hotelnictví. Praxe přímo v karlovarských a jáchymovských lázeňských domech.",
    epizoda: null,
  },
  {
    id: "gymnazium-znojmo-namesti",
    nazev: "Gymnázium Na Náměstí",
    mesto: "Znojmo",
    adresa: "Horní náměstí 21",
    kraj: "JHM",
    typ: "gymnazium",
    reditel: "PaedDr. Ivana Bláhová",
    web: "https://www.example.cz",
    foto: null,
    popis:
      "Gymnázium v historickém centru Znojma s výukou vinařské chemie jako " +
      "volitelného semináře — jinde v republice ho nenajdete. Výměny s rakouským " +
      "Retzem a silná francouzština.",
    epizoda: null,
  },
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
