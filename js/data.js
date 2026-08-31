/* ============================================================
   STŘEDOŠKOLSKÁ LUPA — DATA WEBU
   ------------------------------------------------------------
   Tohle je jediný soubor, který se edituje při správě obsahu.
   Žádný build, žádný programátor — uložit a nahrát na hosting.

   Obsah spravujte přes admin.html — ruční úpravy jen opatrně.
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
   6. `reportaz: { youtube: "ID", delka: "16:15", datum: "2026-01-13" }`
      = videoreportáž ze školy (druhý přehrávač na profilu).
      Prázdné `youtube` → na profilu je „reportáž připravujeme".
      Škola může mít jen reportáž, jen podcast, nebo obojí.
   ============================================================ */
/* ============================================================
   ⏸ OBSAH JE DOČASNĚ SKRYTÝ
   ------------------------------------------------------------
   Školy i s epizodami a reportážemi zůstávají níž uložené, ale
   web je nezobrazuje — chová se, jako by teprve startoval.

   AŽ SE MAJÍ ZASE UKÁZAT: smažte řádek `const SKOLY = [];` pod
   tímhle textem a v řádku `const SKOLY_PRIPRAVENE = [`
   přepište název zpátky na `const SKOLY = [`.
   ============================================================ */
const SKOLY = [];

const SKOLY_PRIPRAVENE = [
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
      "Zdravotnická škola v centru Příbrami. Na střední škole nabízí obory " +
      "praktická sestra, zdravotnické lyceum, masér ve zdravotnictví a nutriční " +
      "asistent, na vyšší odborné škole diplomovanou všeobecnou a diplomovanou " +
      "dětskou sestru. Součástí školy je domov mládeže, vlastní jídelna i " +
      "školní poradenské pracoviště.",
    epizoda: {
      cislo: 1,
      nazev: "Zdravotnická škola v Příbrami",
      delka: "15:08",
      datum: "2026-08-22",
      popis:
        "První díl Středoškolské lupy — rozhovor s ředitelem Střední zdravotnické " +
        "školy a Vyšší odborné školy zdravotnické v Příbrami.",
      youtube: "0tYj9iDBgRw",
      spotify: "",
      apple: "",
    },
    reportaz: { youtube: "kF8lDC4CDQQ", delka: "27:12", datum: "2026-01-29" },
  },
  {
    id: "sls-sou-krivoklat",
    nazev: "Střední lesnická škola a SOU",
    mesto: "Křivoklát",
    adresa: "Písky 181",
    kraj: "STC",
    typ: "sos",
    reditel: "Mgr. Alexandra Lochová",
    web: "https://www.sls-krivoklat.cz",
    foto: null,
    popis:
      "Lesnická škola přímo pod křivoklátským hradem, uprostřed chráněné " +
      "krajinné oblasti. Maturitní obory lesnictví a veterinářství, učební " +
      "obory mechanik lesní techniky, opravář lesnických strojů a truhlář — " +
      "praxe se odehrává v lese, ne za lavicí.",
    epizoda: {
      cislo: 3,
      nazev: "Lesnická škola pod Křivoklátem",
      delka: "14:34",
      datum: "2026-08-22",
      popis:
        "Třetí díl Středoškolské lupy — rozhovor s ředitelkou Střední lesnické " +
        "školy a Středního odborného učiliště Křivoklát.",
      youtube: "V2_ANYhcM1c",
      spotify: "",
      apple: "",
    },
    reportaz: { youtube: "-cFCpbUX33E", delka: "16:15", datum: "2026-01-13" },
  },
  {
    id: "sou-libechov",
    nazev: "Střední odborné učiliště Liběchov",
    mesto: "Liběchov",
    adresa: "Boží Voda 230",
    kraj: "STC",
    typ: "sou",
    reditel: "Ing. Vít Faltejsek",
    web: "https://soulibechov.cz",
    foto: null,
    popis:
      "Rodinná škola v klidném prostředí u Mělníka, s tradicí od roku 1953. " +
      "Menší kolektiv, osobní přístup a učební obory, po kterých je na trhu " +
      "práce poptávka.",
    epizoda: null, // podcast zatím nenatočen
    reportaz: { youtube: "yDC5EtPlE4k", delka: "13:50", datum: "2026-04-02" },
  },
  {
    id: "sos-sou-slany",
    nazev: "Střední odborná škola a SOU Slaný",
    mesto: "Slaný",
    adresa: "Hlaváčkovo náměstí 673",
    kraj: "STC",
    typ: "sos",
    reditel: "Mgr. Monika Kašparová",
    web: "https://sosasouslany.cz",
    foto: null,
    popis:
      "Škola s obory, po kterých je na trhu práce okamžitá poptávka. Jako " +
      "jediná ve Středočeském kraji nabízí obor technická zařízení budov — " +
      "vedle dalších technických a řemeslných oborů.",
    epizoda: null, // podcast zatím nenatočen
    reportaz: { youtube: "xYkvz42UYnY", delka: "16:58", datum: "2026-01-21" },
  },
  {
    id: "ss-rybarska-trebon",
    nazev: "SŠ rybářská a vodohospodářská Jakuba Krčína",
    mesto: "Třeboň",
    adresa: "Táboritská 688",
    kraj: "JHC",
    typ: "sos",
    reditel: "Ing. Aleš Vondrka, Ph.D.",
    web: "https://www.ssrv.cz",
    foto: null,
    popis:
      "Škola nejstaršího českého řemesla v srdci třeboňských rybníků. Rybářství " +
      "a vodohospodářství v podání profesionálů — absolventi mají uplatnění " +
      "doma i v zahraničí.",
    epizoda: null, // podcast zatím nenatočen
    reportaz: { youtube: "LBms0hVy0as", delka: "16:46", datum: "2025-12-17" },
  },
  {
    id: "sportovni-gymnazium-kladno",
    nazev: "Sportovní gymnázium Kladno",
    mesto: "Kladno",
    adresa: "Plzeňská 3103",
    kraj: "STC",
    typ: "gymnazium",
    reditel: "Mgr. Květoslava Havlůjová",
    web: "https://sgagy.cz",
    foto: null,
    popis:
      "Osmileté i čtyřleté všeobecné studium, k tomu rozšířená výuka tělesné " +
      "výchovy a čtyřleté zaměření sportovní příprava — gymnázium pro ty, kdo " +
      "chtějí studovat i závodit.",
    epizoda: null, // podcast zatím nenatočen
    reportaz: { youtube: "8UIpn5imBdY", delka: "13:54", datum: "2025-10-08" },
  },
  {
    id: "sos-sou-horovice",
    nazev: "Střední odborná škola a SOU Hořovice",
    mesto: "Hořovice",
    adresa: "Palackého náměstí 100",
    kraj: "STC",
    typ: "sos",
    reditel: "Ing. Vladimír Kebert, CSc.",
    web: "https://soshorovice.cz",
    foto: null,
    popis:
      "Technicky výborně vybavená škola s jedenácti studijními obory — od " +
      "informačních technologií po řemesla. Reportáží provázejí sami studenti " +
      "oboru IT.",
    epizoda: null, // podcast zatím nenatočen
    reportaz: { youtube: "wzsKfPjDycY", delka: "19:50", datum: "2025-09-18" },
  },
  {
    id: "ss-remesel-kunice",
    nazev: "Střední škola řemesel Kunice",
    mesto: "Kunice",
    adresa: "K Učilišti 18",
    kraj: "STC",
    typ: "sou",
    reditel: "Mgr. Dalibor Zdobinský",
    web: "https://www.ssrkunice.cz",
    foto: null,
    popis:
      "Škola pro žáky se speciálními vzdělávacími potřebami. Malé útulné třídy " +
      "s moderním vybavením, velká zahrada a lesy kolem — a řemeslné obory, " +
      "které dávají jistotu.",
    epizoda: null, // podcast zatím nenatočen
    reportaz: { youtube: "sCdyN24CWhA", delka: "12:11", datum: "2025-09-11" },
  },
  {
    id: "gymnazium-stribro",
    nazev: "Gymnázium a obchodní akademie Stříbro",
    mesto: "Stříbro",
    adresa: "Soběslavova 1426",
    kraj: "PLK",
    typ: "gymnazium",
    reditel: "Mgr. Milan Deredimos",
    web: "https://www.goas.cz",
    foto: null,
    popis:
      "Gymnázium a obchodní akademie pod jednou střechou — všeobecné vzdělání i " +
      "ekonomické obory v menším městě na Tachovsku, kde se všichni navzájem " +
      "znají.",
    epizoda: null, // podcast zatím nenatočen
    reportaz: { youtube: "7pwxr-C-Kh4", delka: "12:58", datum: "2025-06-25" },
  },
  {
    id: "sou-domazlice",
    nazev: "Střední odborné učiliště Domažlice",
    mesto: "Domažlice",
    adresa: "Prokopa Velikého 640",
    kraj: "PLK",
    typ: "sou",
    reditel: "Mgr. Zdeňka Buršíková",
    web: "https://soudom.cz",
    foto: null,
    popis:
      "Učiliště s maturitními i učebními obory a pracovišti v Domažlicích a ve " +
      "Stodu. Škola má řadu ocenění včetně mezinárodního certifikátu IES.",
    epizoda: null, // podcast zatím nenatočen
    reportaz: { youtube: "ucEVkUjK3zQ", delka: "6:03", datum: "2025-04-15" },
  },
  {
    id: "ss-zivnostenska-plana",
    nazev: "Střední škola živnostenská a Základní škola",
    mesto: "Planá",
    adresa: "Kostelní 129",
    kraj: "PLK",
    typ: "sou",
    reditel: "Mgr. Josef Mára",
    web: "https://www.sszplana.cz",
    foto: null,
    popis:
      "Živnostenská škola na Tachovsku s učebními obory včetně ošetřovatele. " +
      "Součástí je i základní škola — malá škola s osobním přístupem.",
    epizoda: null, // podcast zatím nenatočen
    reportaz: { youtube: "br5lxNiiExU", delka: "7:02", datum: "2025-01-17" },
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
    reportaz: { youtube: "", delka: "", datum: "" },
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
