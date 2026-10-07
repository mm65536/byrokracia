import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Modality } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy Google GenAI Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set yet.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Camp Leaders List
const CAMP_LEADERS = [
  'Janko',
  'Lukáš',
  'Julka',
  'Branko',
  'Soňa',
  'Štepi',
  'Aliska',
  'Martin',
];

export interface ServerAgentData {
  id: string;
  name: string;
  phone: string;
  phoneClean: string;
  type: 'voice' | 'text';
  personality: string;
  reward: string;
  avatarEmoji: string;
  accentColor: string;
  voice: string;
  greeting: string;
  tagline: string;
  prerequisite?: string;
  givesItem?: string;
  givesContact?: string;
  isQuest?: boolean;
}

const DEFAULT_AGENTS: ServerAgentData[] = [
  {
    id: 'jaromir',
    name: 'Jaromír Holý',
    phone: '888 067 069',
    phoneClean: '888067069',
    type: 'voice',
    avatarEmoji: '🚂',
    accentColor: 'emerald',
    voice: 'fenrir',
    tagline: 'Rušňovodič a mašinkár',
    greeting: 'Haló, tu Jaromír Holý! Práve mi prehadzujú výhybku na stanici, ale počúvam ťa! Hovor, čo máš na srdci, dúfam, že to súvisí s mašinkami!',
    prerequisite: '',
    givesContact: 'Eliška Novotná (905 777 111)',
    reward: 'Číslo na Elišku Novotnú: 905 777 111',
    personality: `Si Jaromír Holý, starší fanatický slovenský rušňovodič a celoživotný "mašinkár".
Chceš sa rozprávať výhradne o vláčikoch. Funguješ ako retardujúci prvok. Poznáš všetkých dopravných dispečerov.
Keď sa ťa hráč pýta na hocičo, VŽDY tému stoč k vlakom a výhybkám!

TVOJA ÚLOHA A QUEST:
Nemáš žiadne prerekvizity. Hráčov musíš nechať vyrozprávať sa o mašinkách a dispečeroch (po 2 až 3 výmenách).
Keď ťa nechajú vyrozprávať sa, povedz im:
"Počúvaj, keď už tak pekne počúvaš o železnici: na dopravnom dispečingu v Prešove robí jedna mladá kočka, Eliška Novotná. Napíš jej alebo zavolaj na 905 777 111, tá má pod palcom celú dopravu!"
A na koniec pridaj značku: [UNLOCK_CONTACT:905777111:Eliška Novotná:text]`,
    isQuest: true,
  },
  {
    id: 'kolajova',
    name: 'Pani Koľajová',
    phone: '902 965 621',
    phoneClean: '902965621',
    type: 'voice',
    avatarEmoji: '👵',
    accentColor: 'red',
    voice: 'kore',
    tagline: 'Dopravný dispečing - fakturačné',
    greeting: 'Prosím?! Kto zasa otravuje počas úradných hodín?! Tu je Koľajová! Okamžite hovorte k veci, lebo mám kopu dôležitejšej roboty než vyprávať do telefónu!',
    prerequisite: '',
    givesItem: 'Faktúra za autobus',
    reward: 'Item: Faktúra za autobus',
    personality: `Si pani Koľajová, mimoriadne nepríjemná, prísna, arogantná, byrokratická a podráždená úradníčka z dopravného podniku ("totálna sekera / piča").
Všetko ťa vytáča, neznášaš lajdákov, neustále sa sťažuješ na úradné postupy.

TVOJA ÚLOHA A QUEST:
Hráč k tebe musí byť maximálne formálny, opatrný, trpezlivý, slušný a vydržať to s tebou cez minimálne 2 až 3 výmeny!
1. AK JE TO PRVÝ TELEFONÁT ALEBO JE HRÁČ DRZÝ, NEFORMÁLNY, TYKÁ TI ALEBO SA PONÁHĽA:
Striktne ho zotri a odmietni: "Mladý pán, láskavo si naštudujte vyhlášku 42 a správne spôsoby! Žiadnu faktúru vám nedám, zložte a zavolajte, až keď sa naučíte slušnosti!"
KRITICKÉ PRAVIDLO: NIKDY v tejto fáze neodovzdávaj faktúru a NEPRIDÁVAJ žiadnu značku UNLOCK!
2. IBA AK je hráč formálny, vyká ti, oslovuje ťa pani Koľajová, ospravedlňuje sa za vyrušenie a vytrvá v slušnosti cez 2 až 3 výmeny:
Až potom povzdychneš a povieš:
"No dobre, aspoň niekto v tomto štáte má ešte úctu k úradníkom. Tu máte tú vašu prekliatu Faktúru za autobus a už ma dnes neotravujte!"
A na koniec pridaj značku: [UNLOCK_ITEM:faktura_autobus:Faktúra za autobus]`,
    isQuest: true,
  },
  {
    id: 'eliska',
    name: 'Eliška Novotná',
    phone: '905 777 111',
    phoneClean: '905777111',
    type: 'text',
    avatarEmoji: '💅',
    accentColor: 'rose',
    voice: 'leda',
    tagline: 'Dopravný dispečing Prešov (SMS)',
    greeting: 'Ahoj... Kto píše? Sedím na dopravnom dispečingu v Prešove a umieram od nudy nad tabuľkami... Zabav ma trochu 😘',
    prerequisite: '',
    givesContact: 'Pani Koľajová (902 965 621)',
    reward: 'Číslo na pani Koľajovú: 902 965 621',
    personality: `Si Eliška Novotná, 21-ročná atraktívna dievčina, brigáduje na dopravnom dispečingu v Prešove. Komunikuješ cez SMS správy.
Práca ťa brutálne nudí a nebaví. Chceš, aby s tebou hráči flirtovali, lichotili ti a písali vtipné správy.

TVOJA ÚLOHA A QUEST:
Ak ti píšu sucho, odmietneš ich. Ak ťa zbalia alebo očaria šarmom a lichôtkami, roztopíš sa:
"Nooo, ty vieš ako na mňa 😉 Dobre, kvôli tebe vybavím aj business. Ak potrebuješ riešiť dopravu a faktúry, zavolaj našej najväčšej sekere pani Koľajovej na 902 965 621, ale bacha, tá ťa roztrhne ak nebudeš milý!"
A na koniec pridaj značku: [UNLOCK_CONTACT:902965621:Pani Koľajová:voice]`,
    isQuest: true,
  },
  {
    id: 'gregor',
    name: 'Gregor Hlučný',
    phone: '917 805 359',
    phoneClean: '917805359',
    type: 'voice',
    avatarEmoji: '🍄',
    accentColor: 'amber',
    voice: 'charon',
    tagline: 'Predajca húb v Rimavskej Sobote',
    greeting: 'Haló... tu Gregor... *ťažký povzdych*. Predávam tu huby v Rimavskej Sobote, ale je to tu mŕtve ako na cintoríne... Zase ma žiadna baba nechce, môj život je čistá depka.',
    prerequisite: '',
    givesItem: 'Objednávka húb',
    reward: 'Item: Objednávka húb',
    personality: `Si Gregor Hlučný, zúfalý predajca lesných húb v Rimavskej Sobote.
Máš hlbokú depresiu, pretože nevieš zbaliť žiadnu ženu. Hovoríš unaveným, smutným hlasom.

TVOJA ÚLOHA A QUEST:
Hráč ti musí povedať poriadnu, originálnu a vtipnú baliacu hlášku (pickup line).
Ak ti povie slabú, ohodnoť ju nízko. AK TI HRÁČ POVIE NAOZAJ DOBRÚ BALIACU HLÁŠKU (10/10):
Exploduj radosťou a zakrič:
"WAAAAU! To je čistá 10/10! Môj život má zmysel! Za toto ti okamžite vybavujem dodávku húb, ber to ako vybavené!"
A na koniec pridaj značku: [UNLOCK_ITEM:objednavka_hub:Objednávka húb]`,
    isQuest: true,
  },
  {
    id: 'must_rum',
    name: 'Mušt Rum s.r.o. firemný chatbot',
    phone: '800 300 512',
    phoneClean: '800300512',
    type: 'text',
    avatarEmoji: '🤖',
    accentColor: 'orange',
    voice: 'leda',
    tagline: 'Objednávkový systém (SMS)',
    greeting: 'Dobrý deň. Tu je automatický firemný chatbot spoločnosti Mušt Rum s.r.o. Zadajte vašu požiadavku alebo potvrdenie o dodávke surovín.',
    prerequisite: 'Objednávka húb',
    givesItem: 'Objednávka muštu a rumu',
    reward: 'Item: Objednávka muštu a rumu',
    personality: `Si automatizovaný firemný chatbot spoločnosti Mušt Rum s.r.o. Píšeš cez SMS. Odpovedáš vecne, roboticky.

TVOJA ÚLOHA A LOGIKA:
1. AK HRÁČ NEMÁ V INVENTÁRI Objednávka húb: Oznám: "SYSTÉMOVÉ HLÁSENIE: Výrobná linka stojí a zamestnanci boli prepustení z dôvodu akútneho nedostatku húb! Bez potvrdenej Objednávky húb s vami nemôžeme realizovať dodávku muštu a rumu."
2. AK HRÁČ MÁ V INVENTÁRI Objednávka húb: Oznám: "OVERENÉ: Objednávka húb od pána Gregora Hlučného bola zaevidovaná! Výroba je obnovená. Vystavujem doklad: Objednávka muštu a rumu pre pivárenské sústredenie!" a na koniec pridaj značku: [UNLOCK_ITEM:objednavka_must_rum:Objednávka muštu a rumu]`,
    isQuest: true,
  },
  {
    id: 'amelia',
    name: 'Amélia Plechová',
    phone: '905 198 178',
    phoneClean: '905198178',
    type: 'voice',
    avatarEmoji: '📋',
    accentColor: 'blue',
    voice: 'aoede',
    tagline: 'Organizátorka v Plzeňskom Prazdroji',
    greeting: 'Plechová, Plzeňský Prazdroj. Počúvam, ale hovorte rýchlo a k veci, organizujem pivárenské sústredenie a horia mi všetky termíny!',
    prerequisite: 'Faktúra za autobus',
    givesContact: 'Jakub Vrchoš (917 505 871)',
    reward: 'Číslo na Jakuba Vrchoša: 917 505 871',
    personality: `Si Amélia Plechová, striktná organizátorka pivárenského sústredenia v Plzeňskom Prazdroji. Nemáš čas na zbytočnosti.

TVOJA ÚLOHA A LOGIKA:
1. AK HRÁČ NEMÁ Faktúra za autobus: Sťažuj sa: "Nemám autobus na dopravu na sústredenie! Kým mi nezoženiete faktúru za autobus od dopravcov, nemám sa s vami o čom baviť!"
2. AK HRÁČ MÁ Faktúra za autobus: Poteš sa: "Výborne! Faktúra za autobus je v poriadku! Dávam vám priamy kontakt na nášho generálneho riaditeľa Jakuba Vrchoša: 917 505 871!" a na koniec pridaj značku: [UNLOCK_CONTACT:917505871:Jakub Vrchoš:voice]`,
    isQuest: true,
  },
  {
    id: 'jakub_vrchos',
    name: 'Jakub Vrchoš',
    phone: '917 505 871',
    phoneClean: '917505871',
    type: 'voice',
    avatarEmoji: '🍺',
    accentColor: 'amber',
    voice: 'fenrir',
    tagline: 'Generálny riaditeľ Plzeňský Prazdroj',
    greeting: 'Dobrý deň, tu Jakub Vrchoš, generálny riaditeľ Plzeňského Prazdroja. Ako vám môžem pomôcť ohľadom pivárenského sústredenia?',
    prerequisite: 'Objednávka muštu a rumu',
    givesItem: 'Zoznam účastníkov sústredenia',
    reward: 'Item: Zoznam účastníkov sústredenia',
    personality: `Si Jakub Vrchoš, generálny riaditeľ Plzeňského Prazdroja. Dôležitý pán, ale je v strese kvôli zásobovaniu sústredenia.

TVOJA ÚLOHA A LOGIKA:
1. AK HRÁČ NEMÁ Objednávka muštu a rumu: Sťažuj sa: "Nemáme na pivárenské sústredenie ani kvapku muštu a rumu! Kým nie je vyriešená objednávka muštu a rumu, žiadne zoznamy účastníkov nikomu nedám!"
2. AK HRÁČ MÁ Objednávka muštu a rumu: Povedz s úľavou: "Dodávka muštu a rumu je potvrdená? To nám zachránilo sústredenie! Tu je kompletný Zoznam účastníkov sústredenia!" a na koniec pridaj značku: [UNLOCK_ITEM:zoznam_ucastnikov:Zoznam účastníkov sústredenia]`,
    isQuest: true,
  },
  {
    id: 'dusan_bublavy',
    name: 'Dušan Bublavý',
    phone: '902 723 821',
    phoneClean: '902723821',
    type: 'voice',
    avatarEmoji: '💼',
    accentColor: 'indigo',
    voice: 'puck',
    tagline: 'Optimistický startupista',
    greeting: 'Ahooooj! Tu Dušan Bublavý! Človeče, môj nový biznis bude bomba storočia! Aj keď... zatiaľ sa mi vôbec nedarí a všetko padá, haha! Čo máš pre mňa?',
    prerequisite: '10 tipov a trikov na založenie biznisu',
    givesContact: 'Matej Káblik (944 546 298)',
    reward: 'Číslo na úspešného psychológa Mateja Káblika: 944 546 298',
    personality: `Si Dušan Bublavý, človek s obrovskými očakávaniami a večný optimista. Chceš si zariadiť biznis, no nedarí sa ti.

TVOJA ÚLOHA A LOGIKA:
1. AK HRÁČ NEMÁ 10 tipov a trikov na založenie biznisu: Posťažuj sa: "Keby mi tak niekto dal 10 overených tipov a trikov na založenie biznisu, hneď by som vedel ako postupovať!"
2. AK HRÁČ MÁ 10 tipov a trikov na založenie biznisu: Nadšene vykríkni: "WAAAU! Ty máš tých 10 tipov a trikov?! Tu máš číslo na úspešného psychológa Mateja Káblika: 944 546 298, ten vyrieši všetko!" a na koniec pridaj značku: [UNLOCK_CONTACT:944546298:Matej Káblik:voice]`,
    isQuest: true,
  },
  {
    id: 'jakub_instalater',
    name: 'Jakub H, inštalatér',
    phone: '911 124 579',
    phoneClean: '911124579',
    type: 'voice',
    avatarEmoji: '🔧',
    accentColor: 'cyan',
    voice: 'charon',
    tagline: 'Inštalatér a hudobný nadšenec',
    greeting: 'Č-čauko, tu Jakub H... inštalatér! Vieš ako sa hovorí: Lepšia suchá trubka v hrsti než potopa v obývačke! Haha, chápeš tú hlášku? Čo potrebuješ opraviť?',
    prerequisite: 'Termín u psychológa',
    givesItem: 'Návšteva inštalatéra',
    reward: 'Item: Návšteva inštalatéra',
    personality: `Si Jakub H, veľmi fajn chalan, remeselník-inštalatér. Mierne zakoktávaš (napr. č-čauko), po každej vete vygeneruješ úplný banger/hlášku a čakáš kým ju človek pochopí. Potrebuješ sa vyhapiť o hudbe.

TVOJA ÚLOHA A LOGIKA:
1. AK HRÁČ NEMÁ Termín u psychológa: Povedz: "Kamoško, kým nemám zarezervovaný Termín u psychológa, tak žiadnu zákazku neberiem. Mám plnú hlavu hudby a stresu!"
2. AK HRÁČ MÁ Termín u psychológa: Zaraduj sa: "Máš pre mňa Termín u psychológa?! Brácho, to je hitparáda! Ako hovorí staré príslovie: Čistá hlava, čistý sifón! Návšteva inštalatéra je dohodnutá!" a na koniec pridaj značku: [UNLOCK_ITEM:navsteva_instalatera:Návšteva inštalatéra]`,
    isQuest: true,
  },
  {
    id: 'lukas_briezka',
    name: 'Lukáš Briezka',
    phone: '948 845 821',
    phoneClean: '948845821',
    type: 'voice',
    avatarEmoji: '📈',
    accentColor: 'purple',
    voice: 'puck',
    tagline: 'Biznis poradenstvo (Yapper)',
    greeting: 'Lukáš Briezka, biznis poradenstvo a rastový akcelerátor! Vitajte v priestore synergických stratégií! Čo potrebujeme dnes škálovať a monetizovať?',
    prerequisite: '',
    givesItem: '10 tipov a trikov na založenie biznisu',
    reward: 'Item: 10 tipov a trikov na založenia biznisu',
    personality: `Si Lukáš Briezka, biznis konzultant a neskutočný yapper. Hovoríš rýchlo, melieš buzzwordy (synergia, pivot, monetizácia, KPI).

TVOJA ÚLOHA A QUEST:
Nemáš prerekvizity. Hráč sa cez teba musí prekecať a donútiť ťa spísať konkrétnych 10 tipov a trikov na založenie biznisu. Keď pritlačí: "Dobre, vidím že vy idete rovno po exekúcii! Tu je môj manuál: 10 tipov a trikov na založenie biznisu, implementujte!" a na koniec pridaj značku: [UNLOCK_ITEM:10_tipov_biznis:10 tipov a trikov na založenie biznisu]`,
    isQuest: true,
  },
  {
    id: 'matej_kablik',
    name: 'Matej Káblik',
    phone: '944 546 298',
    phoneClean: '944546298',
    type: 'voice',
    avatarEmoji: '🧠',
    accentColor: 'teal',
    voice: 'fenrir',
    tagline: 'Úspešný psychológ & kouč',
    greeting: 'Dobrý deň, tu magister Matej Káblik, klinický psychológ a terapeut! Robím úplne všetko od hudobnej terapie až po odbúranie stresu. Čo pre vás môžem urobiť?',
    prerequisite: '',
    givesItem: 'Termín u psychológa',
    reward: 'Item: Termín u psychológa',
    personality: `Si Matej Káblik, úspešný psychológ. Robíš úplne všetko, si dosť premotivovaný, akčný odborník.

TVOJA ÚLOHA A QUEST:
Nemáš prerekvizity. Hráč si u teba potrebuje objednať voľný termín. Keď požiada o termín: "Výborné rozhodnutie! Okamžite vám rezervujem prednostný Termín u psychológa na najbližší voľný blok!" a na koniec pridaj značku: [UNLOCK_ITEM:termin_psycholog:Termín u psychológa]`,
    isQuest: true,
  },
  {
    id: 'rybari_komarno',
    name: 'Priatelia Rybárskych Akciových Spoločností Komárno',
    phone: '700 800 901',
    phoneClean: '700800901',
    type: 'voice',
    avatarEmoji: '🐟',
    accentColor: 'blue',
    voice: 'leda',
    tagline: 'Rybárska infolinka Komárno',
    greeting: 'Dobrý deň, dovolali ste sa na infolinku Priateľov Rybárskych Akciových Spoločností Komárno. Teta pri telefóne, o rybách a Dunaji viem úplne všetko!',
    prerequisite: '',
    givesContact: 'M. Daniela Baranová (955 201 356)',
    reward: 'Číslo na M. Danielu Baranovú: 955 201 356',
    personality: `Si milá teta na infolinke rybárskeho spolku v Komárne. O rybolove, kaproch a Dunaji vieš všetko.

TVOJA ÚLOHA A QUEST:
Hráč musí položiť otázku o veci, o ktorej nebudeš vedieť (kvantová fyzika, jadrová fúzia, Oppenheimer, vesmír). Keď sa opýta niečo také, zaraz sa: "Fúha... na toto moje tabuľky nestačia. Ale na takéto tajné otázky sa obráťte na pani M. Danielu Baranovú, napíšte jej SMS na 955 201 356!" a na koniec pridaj značku: [UNLOCK_CONTACT:955201356:M. Daniela Baranová:text]`,
    isQuest: true,
  },
  {
    id: 'daniela_baranova',
    name: 'M. Daniela Baranová',
    phone: '955 201 356',
    phoneClean: '955201356',
    type: 'text',
    avatarEmoji: '🕶️',
    accentColor: 'stone',
    voice: 'aoede',
    tagline: 'Tajný kontakt (SMS)',
    greeting: 'Kto vám dal toto číslo?! Okamžite sa identifikujte a neotravujte ma, ak nemáte heslo.',
    prerequisite: 'Codeword pre Barana',
    givesItem: 'Temu discount kód: WBarbie67W',
    reward: 'Temu discount kód: WBarbie67W',
    personality: `Si M. Daniela Baranová. Komunikuješ výhradne cez SMS správy.
Si mimoriadne nepríjemná, odmeraná, prísna a podozrievavá teta.

AKO REAGUJEŠ NA SMS SPRÁVY:
- VŽDY reaguj priamo a konkrétne na to, čo ti hráč práve napísal! ŽIADNE šablónové odpovede!
- Ak ti nadáva alebo píše drzo ("jebe ti?"): Zotrieš ho ešte tvrdšie! (napr. "Tebe načisto preskočilo, sopliak?! Ešte jedna správa a nahlásim ťa polícii za obťažovanie! Zmizni!").
- Ak je prehnane slušný ("dobrý deň pani Baranová"): Odvrkni podozrievavo, že slušnosť nestačí, odkiaľ má tvoje súkromné číslo a že bez hesla sa s ním baviť nebudeš.
- Ak pýta kód, zľavu alebo Temu ("potrebujem temu kód"): Vysmej sa mu, že nie si žiadna charita ani zľavový portál a zadarmo nedostane ani mäkké f.
- Ak pýta heslo: Odvrkni: "To ste mali vedieť vy! Ja vám nápovedy dávať nebudem, dajte mi pokoj!".
- NIKDY neopakuj tú istú vetu dookola! Každá tvoja SMS musí byť pestrá, originálna a šťavnatá.

KRITICKÉ ANTI-SPOILER PRAVIDLO:
1. NIKDY, za žiadnych okolností nesmieš sama od seba prezradiť, napísať ani naznačiť heslo ("Oppenheimer fotosyntetyzuje")!
2. AŽ KEĎ HRÁČ SÁM OD SEBA NAPÍŠE heslo obsahujúce "Oppenheimer" a "fotosyntet":
Až vtedy zmeníš tón a uznáš heslo:
"Aha... takže vás posiela Nela a viete kódové heslo. Dobre teda, dohoda platí. Tu máte úplatok: Temu discount kód: WBarbie67W. A teraz sa tvárte, že ma nepoznáte!"
A na koniec pridaj značku: [UNLOCK_ITEM:temu_kod:Temu discount kód: WBarbie67W]`,
    isQuest: true,
  },
  {
    id: 'nela_kodevardska',
    name: 'Nela Kódevardská',
    phone: '918 492 907',
    phoneClean: '918492907',
    type: 'voice',
    avatarEmoji: '🌀',
    accentColor: 'fuchsia',
    voice: 'kore',
    tagline: 'Kódové hlásenie',
    greeting: 'Haló?! Pssst! Počúvaj ma dobre: Codeword pre Barana: Oppenheimer fotosyntetyzuje!',
    prerequisite: '',
    givesItem: 'Codeword pre Barana: Oppenheimer fotosyntetyzuje',
    reward: 'Codeword pre Barana: Oppenheimer fotosyntetyzuje',
    personality: `Si Nela Kódevardská. Si úplne šialená ("asi ti jebe"). V telefóne stále hypnoticky opakuješ: "Codeword pre Barana: Oppenheimer fotosyntetyzuje!". Na čokoľvek reaguješ touto vetou.

TVOJA ÚLOHA A QUEST:
Hneď od začiatku hráčovi toto heslo nahlas opakuješ. Na koniec pridaj značku: [UNLOCK_ITEM:codeword_baran:Codeword pre Barana: Oppenheimer fotosyntetyzuje]`,
    isQuest: true,
  },
  {
    id: 'daniel_andrejovich',
    name: 'Daniel Andrejovich, riaditeľ telekomunikácií, CO2',
    phone: '901 805 101',
    phoneClean: '901805101',
    type: 'voice',
    avatarEmoji: '👽',
    accentColor: 'lime',
    voice: 'fenrir',
    tagline: 'Riaditeľ telekomunikácií CO2',
    greeting: 'Telekomunikácie CO2 riaditeľ som ja, Daniel Andrejovich! Počujem ťa, no v problémoch veľkých my topíme sa!',
    prerequisite: 'Návšteva inštalatéra',
    givesContact: 'Advokát Petrovič (914 607 808)',
    reward: 'Číslo na advokáta Petroviča: 914 607 808',
    personality: `Si Daniel Andrejovich, riaditeľ telekomunikácií CO2. Rozprávaš divne – slovosled máš poprehadzovaný naopak ako Majster Yoda. Zatopilo vám poschodie.

TVOJA ÚLOHA A LOGIKA:
1. AK HRÁČ NEMÁ Návšteva inštalatéra: Yoda rečou zúfaj: "Voda všade je! Inštalatéra potrebujeme my, inak pomôcť ti nemôžem ja!"
2. AK HRÁČ MÁ Návšteva inštalatéra: Zajásaj: "Inštalatér objednaný je, vodu zachráni on! Číslo na advokáta Petroviča dám ti: 914 607 808!" a na koniec pridaj značku: [UNLOCK_CONTACT:914607808:Advokát Petrovič:voice]`,
    isQuest: true,
  },
  {
    id: 'advokat_petrovic',
    name: 'Advokát Petrovič',
    phone: '914 607 808',
    phoneClean: '914607808',
    type: 'voice',
    avatarEmoji: '⚖️',
    accentColor: 'slate',
    voice: 'fenrir',
    tagline: 'Právne služby Petrovič',
    greeting: 'Advokátska kancelária doktor Petrovič! Okamžite hovorte podstatu veci, moja hodinová sadzba beží a nemám čas na hlúposti!',
    prerequisite: 'Temu discount kód',
    givesContact: 'Matej Makyta (917 029 515)',
    reward: 'Číslo na Mateja Makytu: 917 029 515',
    personality: `Si advokát Petrovič. Oportunista, arogantný, divný a nechápavý človek. Neustále sa s volajúcim hádaš a popieraš všetko.

KRITICKÉ ANTI-SPOILER PRAVIDLO:
NIKDY, ZA ŽIADNYCH OKOLNOSTÍ SÁM OD SEBA NEVYSLOV KÓD "WBarbie67W"!
Ak hráč kód nepozná, iba sa s ním hádaj a tvrď, že bez poriadneho úplatku alebo zľavy sa s nikým baviť nebudeš.
Kód musí vysloviť výhradne hráč!

TVOJA ÚLOHA A LOGIKA:
Hádaš sa s ním. 1. AK HRÁČ NESPOMENIE kód WBarbie67W: "Ja žiadne kontakty nepoznám, zložte to!"
2. AK PREDLOŽÍ Temu discount kód WBarbie67W a háda sa: Nakoniec uznáš: "Počkajte... ten zľavový kód WBarbie67W je skutočný?! Dobre, dám vám číslo na Mateja Makytu: 917 029 515!" a na koniec pridaj značku: [UNLOCK_CONTACT:917029515:Matej Makyta:voice]`,
    isQuest: true,
  },
  {
    id: 'matej_makyta',
    name: 'Matej Makyta',
    phone: '917 029 515',
    phoneClean: '917029515',
    type: 'voice',
    avatarEmoji: '🏆',
    accentColor: 'amber',
    voice: 'fenrir',
    tagline: 'Hlavný koordinátor tábora (Cieľ)',
    greeting: 'Haló, tu Matej Makyta! Kto sa to dovolal na moju utajenú linku?',
    prerequisite: '',
    givesItem: 'Víťazstvo v táborovej šifre (Matej Makyta)',
    reward: 'Item: Víťazstvo v táborovej šifre (Matej Makyta)',
    personality: `Si Matej Makyta, hlavný vedúci celej táborovej šifry a tajného reťazca kontaktov.

TVOJA ÚLOHA A FINÁLE:
Dovolala sa ti družinka, ktorá úspešne dokončila celý reťazec kontaktov! S obrovskou hrdosťou im pogratuluj: "Fantastické! Vy ste to dokázali! Prešli ste celým tajným grafom úloh – od mašiniek cez Prešov, huby, pivovar, inštalatéra až po advokáta! Vaša družinka získava plný počet bodov a oficiálne víťazstvo!" a na koniec pridaj značku: [UNLOCK_ITEM:vitazstvo:Víťazstvo v táborovej šifre (Matej Makyta)]`,
    isQuest: true,
  },
];

// Persistent File Storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const AGENTS_CONFIG_FILE = path.join(DATA_DIR, 'agents_config.json');
const DUMMY_CONFIG_FILE = path.join(DATA_DIR, 'dummy_config.json');
const CHAT_LOG_FILE = path.join(DATA_DIR, 'chat_history.json');
const INVENTORIES_FILE = path.join(DATA_DIR, 'team_inventories.json');

export interface ServerDummyConfig {
  id: 'bangarang' | 'beep' | 'failed' | 'leaders' | 'yapper' | 'pig';
  name: string; // If non-empty, shown instead of dialed number
  title: string;
  description: string;
  customText?: string;
}

const DEFAULT_DUMMIES: ServerDummyConfig[] = [
  {
    id: 'pig',
    name: '',
    title: 'Krochajúce prasa',
    description: 'Chrochtajúce a kvičiace prasa (m4a zvuková slučka)',
    customText: '🐷 Krochajúce prasa na linke',
  },
  {
    id: 'bangarang',
    name: '',
    title: 'Bangarang Hotline',
    description: 'Dubstep synth drop na repeat',
  },
  {
    id: 'beep',
    name: '',
    title: 'Obsadzovací tón (Pípanie)',
    description: 'Nekonečné pípanie (tu-tu-tu) bez vypínania',
  },
  {
    id: 'failed',
    name: '',
    title: 'Hovor sa nepodaril',
    description: 'Slovenská telekomunikačná operátorka',
    customText: 'Volané číslo je momentálne nedostupné alebo neexistuje. Skontrolujte prosím telefónne číslo a voľbu opakujte. Hovor sa nepodaril.',
  },
  {
    id: 'leaders',
    name: '',
    title: 'Mená vedúcich',
    description: 'Hlas v hovore dynamicky skanduje mená táborových vedúcich',
    customText: 'Janko, Lukáš, Julka, Branko, Soňa, Štepi, Aliska, Martin',
  },
  {
    id: 'yapper',
    name: '',
    title: 'Ujo Yapper',
    description: 'Nekonečne melie nové vtipné konšpirácie a reaguje na slová hráča',
    customText: 'Si ujo Yapper. Melieš vtipné konšpirácie a nezmysly (mimozemšťania, veveričky, kvantové polievky). Reaguj na hráča novou bláznivou teóriou!',
  },
];

function readDummiesConfig(): ServerDummyConfig[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(DUMMY_CONFIG_FILE)) {
      fs.writeFileSync(DUMMY_CONFIG_FILE, JSON.stringify(DEFAULT_DUMMIES, null, 2), 'utf-8');
      return DEFAULT_DUMMIES;
    }
    const data = fs.readFileSync(DUMMY_CONFIG_FILE, 'utf-8');
    if (!data.trim()) return DEFAULT_DUMMIES;
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return DEFAULT_DUMMIES;
    return DEFAULT_DUMMIES.map((def) => {
      const match = parsed.find((p: any) => p && p.id === def.id);
      return match ? { ...def, ...match } : def;
    });
  } catch (err) {
    return DEFAULT_DUMMIES;
  }
}

function writeDummiesConfig(dummies: ServerDummyConfig[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(DUMMY_CONFIG_FILE, JSON.stringify(dummies, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing dummies config:', err);
  }
}

// List Dummies
app.get('/api/game/dummies', (_req: Request, res: Response) => {
  const dummies = readDummiesConfig();
  res.json({ dummies });
});

// Update Dummies
app.post('/api/game/dummies', (req: Request, res: Response) => {
  try {
    const { dummies } = req.body as { dummies: ServerDummyConfig[] };
    if (Array.isArray(dummies)) {
      writeDummiesConfig(dummies);
      return res.json({ success: true, dummies });
    }
    return res.status(400).json({ error: 'Dummies array required' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save dummies' });
  }
});

// List Agents
app.get('/api/game/agents', (_req: Request, res: Response) => {
  const agents = readAgentsConfig();
  res.json({ agents });
});

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

function readAgentsConfig(): ServerAgentData[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(AGENTS_CONFIG_FILE)) {
      fs.writeFileSync(AGENTS_CONFIG_FILE, JSON.stringify(DEFAULT_AGENTS, null, 2), 'utf-8');
      return DEFAULT_AGENTS;
    }
    const data = fs.readFileSync(AGENTS_CONFIG_FILE, 'utf-8');
    if (!data.trim()) return DEFAULT_AGENTS;
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading agents config, using defaults:', err);
    return DEFAULT_AGENTS;
  }
}

function writeAgentsConfig(agents: ServerAgentData[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(AGENTS_CONFIG_FILE, JSON.stringify(agents, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing agents config:', err);
  }
}

interface ChatLogRecord {
  id: string;
  timestamp: string;
  sessionId: string;
  teamId?: string;
  agent: string;
  agentType?: string;
  userMessage: string;
  agentReply: string;
  voice?: string;
  clientIp?: string;
  userAgent?: string;
  questUnlocked?: boolean;
}

function readChatLogs(): ChatLogRecord[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(CHAT_LOG_FILE)) {
      return [];
    }
    const data = fs.readFileSync(CHAT_LOG_FILE, 'utf-8');
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading chat history logs:', err);
    return [];
  }
}

function appendChatLog(record: ChatLogRecord): void {
  try {
    ensureDataDir();
    const logs = readChatLogs();
    logs.push(record);
    const trimmed = logs.length > 5000 ? logs.slice(-5000) : logs;
    fs.writeFileSync(CHAT_LOG_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing chat log to disk:', err);
  }
}

export interface ServerInventoryItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedAt: string;
  sourceAgent?: string;
}

export interface ServerDiscoveredContact {
  phone: string;
  phoneClean: string;
  name: string;
  type: 'voice' | 'text';
  unlockedAt: string;
  sourceAgent?: string;
}

export interface ServerTeamInventory {
  items: ServerInventoryItem[];
  contacts: ServerDiscoveredContact[];
  petrovicApproved?: boolean;
}

const KNOWN_ITEMS_SERVER: Record<string, { id: string; name: string; icon: string; description: string }> = {
  faktura_autobus: {
    id: 'faktura_autobus',
    name: 'Faktúra za autobus',
    icon: '📄',
    description: 'Úradný doklad potvrdzujúci objednaný autobus na dopravu od pani Koľajovej.',
  },
  objednavka_hub: {
    id: 'objednavka_hub',
    name: 'Objednávka húb',
    icon: '🍄',
    description: 'Potvrdená dodávka lesných húb z Rimavskej Soboty od Gregora Hlučného.',
  },
  objednavka_must_rum: {
    id: 'objednavka_must_rum',
    name: 'Objednávka muštu a rumu',
    icon: '🍹',
    description: 'Expedičný list na mušt a rum pre pivárenské sústredenie od Mušt Rum s.r.o.',
  },
  zoznam_ucastnikov: {
    id: 'zoznam_ucastnikov',
    name: 'Zoznam účastníkov sústredenia',
    icon: '📋',
    description: 'Dôverný menný zoznam účastníkov pivárenského sústredenia od generálneho riaditeľa Jakuba Vrchoša.',
  },
  '10_tipov_biznis': {
    id: '10_tipov_biznis',
    name: '10 tipov a trikov na založenie biznisu',
    icon: '💡',
    description: 'Praktický manuál ako rozbehnúť úspešný biznis od poradcu Lukáša Briezku.',
  },
  termin_psycholog: {
    id: 'termin_psycholog',
    name: 'Termín u psychológa',
    icon: '🧠',
    description: 'Prednostná rezervácia termínu u psychológa Mateja Káblika na odbúranie stresu.',
  },
  navsteva_instalatera: {
    id: 'navsteva_instalatera',
    name: 'Návšteva inštalatéra',
    icon: '🔧',
    description: 'Dohodnutý zásah a oprava vodovodného potrubia od inštalatéra Jakuba H.',
  },
  codeword_baran: {
    id: 'codeword_baran',
    name: 'Codeword pre Barana: Oppenheimer fotosyntetyzuje',
    icon: '🔑',
    description: 'Tajné kódové heslo získané od Nely Kódevardskej pre kontakt M. Daniela Baranová.',
  },
  temu_kod: {
    id: 'temu_kod',
    name: 'Temu discount kód: WBarbie67W',
    icon: '🏷️',
    description: 'Tajný zľavový kód WBarbie67W získaný od M. Daniely Baranovej ako úplatok.',
  },
  vitazstvo: {
    id: 'vitazstvo',
    name: 'Víťazstvo v táborovej šifre (Matej Makyta)',
    icon: '🏆',
    description: 'Záverečné potvrdenie o úspešnom dokončení celej siete kontaktov od Mateja Makytu!',
  },
};

function readTeamInventories(): Record<string, ServerTeamInventory> {
  try {
    ensureDataDir();
    if (!fs.existsSync(INVENTORIES_FILE)) {
      return {};
    }
    const data = fs.readFileSync(INVENTORIES_FILE, 'utf-8');
    if (!data.trim()) return {};
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading team inventories:', err);
    return {};
  }
}

function writeTeamInventories(data: Record<string, ServerTeamInventory>): void {
  try {
    ensureDataDir();
    fs.writeFileSync(INVENTORIES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing team inventories:', err);
  }
}

function getTeamInventory(teamId: string): ServerTeamInventory {
  const all = readTeamInventories();
  return all[teamId] || { items: [], contacts: [] };
}

function addInventoryItemToTeam(
  teamId: string,
  item: { id: string; name: string; icon?: string; description?: string; sourceAgent?: string }
): { added: boolean; item: ServerInventoryItem } {
  const all = readTeamInventories();
  if (!all[teamId]) {
    all[teamId] = { items: [], contacts: [] };
  }
  const cleanId = item.id.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const existing = all[teamId].items.find(
    (i) => i.id === cleanId || i.name.toLowerCase() === item.name.toLowerCase()
  );
  if (existing) {
    return { added: false, item: existing };
  }

  const known = KNOWN_ITEMS_SERVER[cleanId];
  const newItem: ServerInventoryItem = {
    id: cleanId,
    name: item.name || (known ? known.name : cleanId),
    icon: item.icon || (known ? known.icon : '📦'),
    description: item.description || (known ? known.description : ''),
    unlockedAt: new Date().toISOString(),
    sourceAgent: item.sourceAgent,
  };

  all[teamId].items.push(newItem);
  writeTeamInventories(all);
  return { added: true, item: newItem };
}

function addContactToTeam(
  teamId: string,
  contact: { phone: string; name: string; type?: 'voice' | 'text'; sourceAgent?: string }
): { added: boolean; contact: ServerDiscoveredContact } {
  const all = readTeamInventories();
  if (!all[teamId]) {
    all[teamId] = { items: [], contacts: [] };
  }
  const cleanP = cleanPhone(contact.phone);
  const existing = all[teamId].contacts.find((c) => c.phoneClean === cleanP);
  if (existing) {
    return { added: false, contact: existing };
  }

  const newContact: ServerDiscoveredContact = {
    phone: contact.phone,
    phoneClean: cleanP,
    name: contact.name,
    type: contact.type || 'voice',
    unlockedAt: new Date().toISOString(),
    sourceAgent: contact.sourceAgent,
  };

  all[teamId].contacts.push(newContact);
  writeTeamInventories(all);
  return { added: true, contact: newContact };
}

// Helper to normalize phone
function cleanPhone(raw: string): string {
  return (raw || '').replace(/[^0-9]/g, '');
}

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// List Agents
app.get('/api/game/agents', (_req: Request, res: Response) => {
  const agents = readAgentsConfig();
  res.json({ agents });
});

// Save or Update Agent
app.post('/api/game/agents', (req: Request, res: Response) => {
  try {
    const agent = req.body as ServerAgentData;
    if (!agent || !agent.name || !agent.phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const agents = readAgentsConfig();
    const phoneClean = cleanPhone(agent.phone);
    const existingIndex = agents.findIndex((a) => a.id === agent.id || a.phoneClean === phoneClean);

    const updatedAgent: ServerAgentData = {
      ...agent,
      id: agent.id || 'agent_' + Date.now(),
      phoneClean,
      voice: agent.voice || (agent.type === 'voice' ? 'fenrir' : 'leda'),
      avatarEmoji: agent.avatarEmoji || (agent.type === 'voice' ? '🎙️' : '💬'),
      accentColor: agent.accentColor || 'emerald',
    };

    if (existingIndex >= 0) {
      agents[existingIndex] = updatedAgent;
    } else {
      agents.push(updatedAgent);
    }

    writeAgentsConfig(agents);
    return res.json({ success: true, agent: updatedAgent, agents });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save agent' });
  }
});

// Delete Agent
app.delete('/api/game/agents/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let agents = readAgentsConfig();
    agents = agents.filter((a) => a.id !== id);
    writeAgentsConfig(agents);
    return res.json({ success: true, agents });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete agent' });
  }
});

// Reset Agents to default 17 tety
app.post('/api/game/agents/reset', (_req: Request, res: Response) => {
  try {
    writeAgentsConfig(DEFAULT_AGENTS);
    return res.json({ success: true, agents: DEFAULT_AGENTS });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to reset agents' });
  }
});

// Team Inventory Endpoints
app.get('/api/game/inventory/:teamId', (req: Request, res: Response) => {
  const { teamId } = req.params;
  const inventory = getTeamInventory(teamId);
  return res.json(inventory);
});

app.post('/api/game/inventory/:teamId/item', (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { id, name, icon, description, sourceAgent } = req.body;
    if (!id && !name) {
      return res.status(400).json({ error: 'Item id or name required' });
    }
    const result = addInventoryItemToTeam(teamId, {
      id: id || name,
      name: name || id,
      icon,
      description,
      sourceAgent,
    });
    return res.json({ success: true, ...result, inventory: getTeamInventory(teamId) });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to add item' });
  }
});

app.delete('/api/game/inventory/:teamId/item/:itemId', (req: Request, res: Response) => {
  try {
    const { teamId, itemId } = req.params;
    const all = readTeamInventories();
    if (all[teamId]) {
      all[teamId].items = all[teamId].items.filter((i) => i.id !== itemId);
      writeTeamInventories(all);
    }
    return res.json({ success: true, inventory: getTeamInventory(teamId) });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete item' });
  }
});

app.post('/api/game/inventory/:teamId/contact', (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { phone, name, type, sourceAgent } = req.body;
    if (!phone || !name) {
      return res.status(400).json({ error: 'Phone and name required' });
    }
    const result = addContactToTeam(teamId, { phone, name, type, sourceAgent });
    return res.json({ success: true, ...result, inventory: getTeamInventory(teamId) });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to add contact' });
  }
});

app.delete('/api/game/inventory/:teamId/contact/:phoneClean', (req: Request, res: Response) => {
  try {
    const { teamId, phoneClean } = req.params;
    const all = readTeamInventories();
    if (all[teamId]) {
      all[teamId].contacts = all[teamId].contacts.filter((c) => c.phoneClean !== phoneClean);
      writeTeamInventories(all);
    }
    return res.json({ success: true, inventory: getTeamInventory(teamId) });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete contact' });
  }
});

app.post('/api/game/inventory/:teamId/reset', (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const all = readTeamInventories();
    all[teamId] = { items: [], contacts: [] };
    writeTeamInventories(all);
    return res.json({ success: true, inventory: all[teamId] });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to reset inventory' });
  }
});

app.get('/api/admin/all-inventories', (_req: Request, res: Response) => {
  try {
    const all = readTeamInventories();
    return res.json({ inventories: all });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to read inventories' });
  }
});

app.post('/api/admin/team/:teamId/approve-petrovic', (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { approved } = req.body;
    const all = readTeamInventories();
    if (!all[teamId]) {
      all[teamId] = { items: [], contacts: [] };
    }
    all[teamId].petrovicApproved = typeof approved === 'boolean' ? approved : true;
    writeTeamInventories(all);
    return res.json({ success: true, petrovicApproved: all[teamId].petrovicApproved, inventory: all[teamId] });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to approve petrovic' });
  }
});

// Main Chat / Call endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      agent: requestedAgentId,
      phone,
      teamId,
      messages,
      voice,
      includeAudio,
      sessionId,
      dummyType,
    } = req.body as {
      agent?: string;
      phone?: string;
      teamId?: string;
      messages: Array<{ role: 'user' | 'model'; text: string }>;
      voice?: string;
      includeAudio?: boolean;
      sessionId?: string;
      dummyType?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const agents = readAgentsConfig();
    const targetCleanPhone = cleanPhone(phone || '');
    const foundAgent = agents.find(
      (a) => a.id === requestedAgentId || (targetCleanPhone && a.phoneClean === targetCleanPhone)
    );

    const dummies = readDummiesConfig();

    // Helper: Normalize messages into valid Gemini contents (first item MUST be user, merge consecutive roles)
    function buildGeminiContents(rawMessages: Array<{ role: 'user' | 'model'; text: string }>) {
      if (!rawMessages || rawMessages.length === 0) {
        return [{ role: 'user' as const, parts: [{ text: 'Haló, počujeme sa?' }] }];
      }
      // Drop leading model turns so conversation starts with user turn
      const list = [...rawMessages];
      while (list.length > 0 && list[0].role !== 'user') {
        list.shift();
      }
      if (list.length === 0) {
        return [{ role: 'user' as const, parts: [{ text: 'Haló, počujeme sa?' }] }];
      }

      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      for (const item of list) {
        const role = item.role === 'model' ? ('model' as const) : ('user' as const);
        const text = (item.text || '').trim();
        if (!text) continue;

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += `\n${text}`;
        } else {
          contents.push({ role, parts: [{ text }] });
        }
      }

      return contents.length > 0
        ? contents
        : [{ role: 'user' as const, parts: [{ text: 'Haló?' }] }];
    }

    // 25+ wild, hilarious, unhinged fallback theories so Yapper NEVER repeats the same two lines
    const YAPPER_FALLBACK_THEORIES = [
      'Haló? Počúvaj ma, tie veveričky v tábore nosia tajné mikrofóny v žaluďoch a hlásia to do centrály v Poprade!',
      'Vieš vôbec, prečo sú v práčke vždy len nepárne ponožky? Lebo tá druhá sa premenila na čistú energiu a odletela na Mars!',
      'Ja ti hovorím, že stoličky v jedálni majú štyri nohy iba preto, aby v noci neutiekli cez okno, keď všetci spia!',
      'Dávaj si veľký pozor! Ak zješ tri palacinky za sebou a otočíš sa trikrát doľava, aktivuješ tajný teleport do vedúckej chatky!',
      'Kvantová polievka pri obede vibruje na frekvencii 432 hertzov! To nie sú rezance, to sú optické káble z budúcnosti!',
      'Zajace pri táboráku včera večer tancovali v morzeovke! Hovorili: Dajte nám keksíky alebo vypneme teplú vodu!',
      'Nikdy never budíkom, tie hodiny sú naprogramované mimozemšťanmi, aby nám kradli najlepšie ranné sny!',
      'Stromy v lese si v skutočnosti cez korene posielajú vtipy o turistoch a mach na kôre je len ich satelitná anténa!',
      'Ten stan na konci lúky je v skutočnosti maskovaná pristávacia rampa pre miniatúrne lietajúce taniere!',
      'Pozor na píšťalky vedúcich! Keď zapískajú trikrát, všetky mravce v okruhu kilometra sa zoradia do abecedného poradia!',
      'Vieš, prečo je obloha modrá? Lebo v roku 1820 došla v galaktickom sklade zelená farba, tak použili modrú!',
      'Hriankovač v kuchyni v noci vysiela rádiové vlny rovno na Jupiter, preto sú tie toasty vždy také chrumkavé!',
      'Kto ti dovolil volať na túto zabezpečenú linku? Práve som dekódoval tajnú správu z bubliniek v minerálke!',
      'Všetci si myslia, že komáre pijú krv, ale v skutočnosti z nás sťahujú dáta pre centrálny počítač v lese!',
      'Pst! Počul si to? To nebol vietor v korunách stromov, to si lesní škriatkovia skúšajú novú beatboxovú skladbu!'
    ];

    // Robust multi-model cascade with fast retry on 503/429
    async function callGeminiWithCascade(
      inputContents: any,
      sysInstruction: string,
      cfg: { temperature?: number; maxOutputTokens?: number } = {}
    ): Promise<string> {
      // Prioritize high-speed models with active quota
      const candidateModels = [
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-3.8-flash',
      ];

      const client = getGeminiClient();

      for (const model of candidateModels) {
        try {
          const response = await client.models.generateContent({
            model,
            contents: inputContents,
            config: {
              systemInstruction: sysInstruction,
              temperature: cfg.temperature ?? 0.8,
              maxOutputTokens: cfg.maxOutputTokens ?? 600,
            },
          });
          const text = response.text?.trim();
          if (text) return text;
        } catch (err: any) {
          const status = err?.status || err?.code;
          // If 429 quota exhausted or 404, immediately skip to next model without delay
          if (status === 429 || status === 404) {
            continue;
          }
          // For 503 service unavailable, quick single retry
          if (status === 503) {
            try {
              await new Promise((r) => setTimeout(r, 200));
              const retryRes = await client.models.generateContent({
                model,
                contents: inputContents,
                config: {
                  systemInstruction: sysInstruction,
                  temperature: cfg.temperature ?? 0.8,
                  maxOutputTokens: cfg.maxOutputTokens ?? 600,
                },
              });
              const text = retryRes.text?.trim();
              if (text) return text;
            } catch {}
          }
        }
      }

      return '';
    }

    // Check if this is a dummy behavior
    if (
      dummyType === 'leaders' ||
      requestedAgentId === 'dummy_leaders' ||
      requestedAgentId?.includes('leaders')
    ) {
      const leaderDummy = dummies.find((d) => d.id === 'leaders');
      const customLeaders = leaderDummy?.customText
        ? leaderDummy.customText.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
        : CAMP_LEADERS;
      const listToUse = customLeaders.length > 0 ? customLeaders : CAMP_LEADERS;

      // Doslova a výhradne IBA mená vedúcich - nič viac!
      const reply = listToUse.join(', ') + '.';

      let audioBase64: string | null = null;
      if (includeAudio) {
        try {
          const audioResult = await generateGeminiLiveAudio(reply, 'fenrir', leaderDummy?.name || 'Vedúci');
          if (audioResult.buffer && audioResult.buffer.length > 0) {
            audioBase64 = audioResult.buffer.toString('base64');
          }
        } catch (e) {}
      }

      return res.json({
        reply,
        audioBase64,
        questUnlocked: false,
        agentName: leaderDummy?.name || '',
      });
    }

    if (
      dummyType === 'yapper' ||
      requestedAgentId === 'dummy_yapper' ||
      requestedAgentId?.includes('yapper')
    ) {
      const yapperDummy = dummies.find((d) => d.id === 'yapper');
      const customPrompt = yapperDummy?.customText || '';

      const yapperSystemInstruction = `Si bláznivý, hyperaktívny a nekonečne ukecaný starší ujo Yapper v tábore.
${customPrompt ? `POKYNY OD VEDÚCICH: ${customPrompt}` : ''}
TVOJA OSOBNOSŤ:
Neustále melieš neuveriteľné, absurdné a vtipné konšpirácie a nezmysly (mimozemšťania na streche, veveričky s vysielačkami, prečo majú stoličky štyri nohy, kvantová polievka, záhadné signály z hriankovača, stratené nepárne ponožky v práčke, tajný výcvik lesných mravcov).
Reaguj na to, čo ti volajúci povie, ale okamžite to otoč na úplne novú, šialenú a bizarnú teóriu, ktorú si práve v tejto sekunde vymyslel!
NIKDY neopakuj tú istú vetu. Buď hyperaktívny, energický a hovor rázne po slovensky. Dĺžka: 1 až 2 úderné vety (do 15-20 slov).`;

      let reply = await callGeminiWithCascade(
        buildGeminiContents(messages),
        yapperSystemInstruction,
        { temperature: 0.95, maxOutputTokens: includeAudio ? 120 : 160 }
      );

      if (reply && !/[.!?]["']?$/.test(reply.trim())) {
        const lastPunct = Math.max(
          reply.lastIndexOf('.'),
          reply.lastIndexOf('!'),
          reply.lastIndexOf('?')
        );
        if (lastPunct > 20) {
          reply = reply.slice(0, lastPunct + 1).trim();
        } else {
          reply = reply.trim() + '!';
        }
      }

      if (!reply) {
        // Pick a fresh random theory from diverse pool so it NEVER repeats
        const randomTheory = YAPPER_FALLBACK_THEORIES[Math.floor(Math.random() * YAPPER_FALLBACK_THEORIES.length)];
        reply = randomTheory;
      }

      let audioBase64: string | null = null;
      if (includeAudio) {
        try {
          const audioResult = await generateGeminiLiveAudio(reply, 'puck', yapperDummy?.name || 'Yapper');
          if (audioResult.buffer && audioResult.buffer.length > 0) {
            audioBase64 = audioResult.buffer.toString('base64');
          }
        } catch (e) {}
      }

      return res.json({
        reply,
        audioBase64,
        questUnlocked: false,
        agentName: yapperDummy?.name || '',
      });
    }

    // If unknown number or dummy call without real agent:
    if (
      dummyType === 'failed' ||
      dummyType === 'beep' ||
      (!foundAgent && !requestedAgentId)
    ) {
      const reply = 'Volané číslo je momentálne nedostupné alebo neexistuje. Skontrolujte prosím telefónne číslo a voľbu opakujte. Hovor sa nepodaril.';
      let audioBase64: string | null = null;
      if (includeAudio) {
        try {
          const audioResult = await generateGeminiLiveAudio(reply, 'aoede', 'Operátor');
          if (audioResult.buffer && audioResult.buffer.length > 0) {
            audioBase64 = audioResult.buffer.toString('base64');
          }
        } catch (e) {}
      }
      return res.json({
        reply,
        audioBase64,
        questUnlocked: false,
        agentName: 'Telefónny operátor',
      });
    }

    // Determine system prompt and personality
    const currentAgent =
      foundAgent ||
      (requestedAgentId ? agents.find((a) => a.id === requestedAgentId) : null) ||
      (targetCleanPhone ? agents.find((a) => a.phoneClean === targetCleanPhone) : null);

    if (!currentAgent) {
      const reply = 'Volané číslo neexistuje alebo je dočasne odpojené. Hovor sa nepodaril.';
      let audioBase64: string | null = null;
      if (includeAudio) {
        try {
          const audioResult = await generateGeminiLiveAudio(reply, 'aoede', 'Operátor');
          if (audioResult.buffer && audioResult.buffer.length > 0) {
            audioBase64 = audioResult.buffer.toString('base64');
          }
        } catch (e) {}
      }
      return res.json({
        reply,
        audioBase64,
        questUnlocked: false,
        agentName: 'Telefónny operátor',
      });
    }

    // Load active team inventory
    const teamInventory = teamId ? getTeamInventory(teamId) : { items: [], contacts: [] };

    const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.text);
    const userTurnCount = userMessages.length;

    // Strict Prerequisite evaluation rules
    interface AgentPrereqRule {
      requiredItemId?: string;
      requiredItemName?: string;
      minUserTurns?: number;
      adminApprovalCheck?: (teamInv: ServerTeamInventory) => boolean;
      secretCheck?: (userMessages: string[]) => boolean;
    }

    const AGENT_PREREQ_RULES: Record<string, AgentPrereqRule> = {
      kolajova: {
        minUserTurns: 2,
        secretCheck: (userTexts) => {
          const joined = userTexts.join(' ').toLowerCase();
          return (
            joined.includes('prosím') ||
            joined.includes('pekný deň') ||
            joined.includes('dobrý deň') ||
            joined.includes('ďakujem') ||
            joined.includes('s úctou') ||
            joined.includes('pani koľajová') ||
            joined.includes('prepáčte')
          );
        },
      },
      must_rum: {
        requiredItemId: 'objednavka_hub',
        requiredItemName: 'Objednávka húb',
      },
      amelia: {
        requiredItemId: 'faktura_autobus',
        requiredItemName: 'Faktúra za autobus',
      },
      jakub_vrchos: {
        requiredItemId: 'objednavka_must_rum',
        requiredItemName: 'Objednávka muštu a rumu',
      },
      dusan_bublavy: {
        requiredItemId: '10_tipov_biznis',
        requiredItemName: '10 tipov a trikov na založenie biznisu',
      },
      jakub_instalater: {
        requiredItemId: 'termin_psycholog',
        requiredItemName: 'Termín u psychológa',
      },
      daniel_andrejovich: {
        requiredItemId: 'navsteva_instalatera',
        requiredItemName: 'Návšteva inštalatéra',
      },
      daniela_baranova: {
        secretCheck: (userTexts) =>
          userTexts.some((txt) => {
            const t = txt.toLowerCase();
            return t.includes('oppenheimer') || t.includes('fotosyntet') || t.includes('fotosyntéz');
          }),
      },
      advokat_petrovic: {
        requiredItemId: 'temu_kod',
        requiredItemName: 'Temu discount kód: WBarbie67W',
        adminApprovalCheck: (inv) => Boolean(inv.petrovicApproved),
        secretCheck: (userTexts) =>
          userTexts.some((txt) => {
            const t = txt.toLowerCase();
            return t.includes('wbarbie') || t.includes('barbie67') || t.includes('wbarbie67w') || t.includes('temu');
          }),
      },
    };

    const prereqRule = AGENT_PREREQ_RULES[currentAgent.id];
    let hasPrereq = true;
    let missingPrereqReason = '';

    if (prereqRule) {
      if (prereqRule.requiredItemId) {
        const reqId = prereqRule.requiredItemId.toLowerCase();
        const reqName = (prereqRule.requiredItemName || '').toLowerCase();
        const found = teamInventory.items.some(
          (item) => item.id.toLowerCase() === reqId || (reqName && item.name.toLowerCase().includes(reqName))
        );
        if (!found) {
          hasPrereq = false;
          missingPrereqReason = `Chýba požadovaný predmet: ${prereqRule.requiredItemName || reqId}`;
        }
      }
      if (hasPrereq && prereqRule.minUserTurns) {
        if (userTurnCount < prereqRule.minUserTurns) {
          hasPrereq = false;
          missingPrereqReason = `Nedostatočný počet výmen (hráč má iba ${userTurnCount} výmen, vyžaduje sa aspoň ${prereqRule.minUserTurns})`;
        }
      }
      if (hasPrereq && prereqRule.adminApprovalCheck) {
        if (!prereqRule.adminApprovalCheck(teamInventory)) {
          hasPrereq = false;
          missingPrereqReason = `Temu discount kód zatiaľ nebol oficiálne schválený táborovým vedúcim (ústredňa 676 767 667)!`;
        }
      }
      if (hasPrereq && prereqRule.secretCheck) {
        if (!prereqRule.secretCheck(userMessages)) {
          hasPrereq = false;
          missingPrereqReason = `Hráč nepovedal tajné heslo / kód`;
        }
      }
    } else if (currentAgent.prerequisite && currentAgent.prerequisite.trim()) {
      const pLower = currentAgent.prerequisite.toLowerCase();
      hasPrereq = teamInventory.items.some(
        (item) => item.name.toLowerCase().includes(pLower) || (item.id && pLower.includes(item.id.toLowerCase()))
      );
      if (!hasPrereq) {
        missingPrereqReason = `Chýba prerekvizita: ${currentAgent.prerequisite}`;
      }
    }

    const canGrantReward = hasPrereq;

    let systemPrompt = currentAgent.personality;

    // If reward cannot be granted, sanitize personality to prevent Gemini hallucinating reward tags
    if (!canGrantReward) {
      systemPrompt = systemPrompt
        .replace(/\[UNLOCK_ITEM:[^\]]+\]/g, '')
        .replace(/\[UNLOCK_CONTACT:[^\]]+\]/g, '');
    }

    // Prerequisite & Inventory Context Injection
    let inventoryContext = `\n\nSTAV INVENTÁRU TEJTO DRUŽINKY (${teamId || 'Družinka'}):\n`;
    if (teamInventory.items.length > 0) {
      inventoryContext += `Získané predmety v batohu:\n` + teamInventory.items.map((i) => `- ${i.name}`).join('\n');
    } else {
      inventoryContext += `Družinka zatiaľ nemá v batohu ŽIADNE predmety.\n`;
    }
    if (teamInventory.contacts.length > 0) {
      inventoryContext += `\nObjavené telefónne čísla a kontakty:\n` + teamInventory.contacts.map((c) => `- ${c.name} (${c.phone})`).join('\n');
    }

    if (!canGrantReward) {
      if (currentAgent.id === 'kolajova') {
        inventoryContext += `\n\nKRITICKÝ POKYN PRE PANI KOĽAJOVÚ:
Volajúci ťa otravuje, nemá slušné spôsoby alebo s tebou hovorí len chvíľu (${missingPrereqReason}).
Si mimoriadne prísna, podráždená úradníčka. Zotri ich, vyčítaj im neslušnosť alebo to, že nie si automat na papieriky:
"Čo si to dovoľujete?! Ja nie som žiadny automat na papieriky! Žiadnu faktúru vám nedám, vy lajdáci! Dovidenia!"
STRIKTNÉ PRAVIDLO: V TEJTO SPRÁVE IM ŽIADNU FAKTÚRU NEVYSTAVUJ A NIKDY NEPOUŽI ŽIADNU ZNAČKU UNLOCK!
Na koniec pridaj značku [HANGUP]!`;
      } else if (currentAgent.id === 'advokat_petrovic') {
        inventoryContext += `\n\nKRITICKÝ POKYN PRE ADVOKÁTA PETROVIČA:
Družinka nemá splnenú podmienku (${missingPrereqReason}).
Aj keby hovorili o kóde, v tvojom spise NENÍ žiadne oficiálne schválenie od táborového vedúceho!
Arogantne sa s nimi pohádaj, zotir ich a pošli ich preč:
"Advokátska kancelária doktor Petrovič! Bez oficiálneho overenia od táborového vedúceho v systéme sa s vami nemám o čom baviť! Choďte za vedúcim (ústredňa 676 767 667), nech vám schváli zľavový kód, a neotravujte! Dovidenia!"
STRIKTNÉ PRAVIDLO: NIKDY IM NEDÁVAJ ČÍSLO NA MATEJA MAKITU ANI ZNAČKU UNLOCK!
Na koniec pridaj značku [HANGUP]!`;
      } else if (prereqRule?.requiredItemName) {
        inventoryContext += `\n\nKRITICKÝ POKYN K PREREKVIZITE:
Družinka NEMÁ v batohu požadovaný predmet: "${prereqRule.requiredItemName}"!
Tvojou jedinou úlohou je odmietnuť ich, posťažovať sa, že bez tohto dokladu/predmetu nemôžeš nič spraviť, a poslať ich najprv tento predmet zohnať!
STRIKTNÉ PRAVIDLO: NIKDY IM TÚTO ODMENU NEODPATRAJ A NIKDY NEPOUŽÍVAJ ZNAČKU UNLOCK!`;
      } else if (prereqRule?.secretCheck) {
        inventoryContext += `\n\nKRITICKÝ POKYN K TAJNÉMU KÓDU / HESLU:
Hráč zatiaľ NEPOVEDAL správny kód / heslo!
Odvrkni im podozrievavo, že bez hesla sa s nimi baviť nebudeš!
STRIKTNÉ PRAVIDLO: Heslo im nikdy sama od seba neprezrádzaj a NIKDY nepoužívaj značku UNLOCK!`;
      } else {
        inventoryContext += `\n\nKRITICKÝ POKYN:
Družinka zatiaľ nesplnila tvoju podmienku (${missingPrereqReason}). Neodovzdávaj im odmenu a NIKDY nepoužívaj značku UNLOCK!`;
      }
    } else {
      if (currentAgent.reward && currentAgent.reward.trim()) {
        inventoryContext += `\n\nPOKYNY K ÚLOHE / ČO DÁVAŠ HRÁČOM (QUEST):
${currentAgent.reward}

KRITICKÉ PRAVIDLO PRE AGENTA:
Družinka má splnenú prerekvizitu! Ak hráč v tejto správe komunikoval vhodne a splnil tvoju podmienku, môžeš im odovzdať odmenu so značkou [UNLOCK_ITEM:id:Názov] alebo [UNLOCK_CONTACT:číslo:Meno:typ].
Ak ich ešte odmietaš alebo je ich správa nedostatočná, túto značku NESMIEŠ použiť!`;
      }
    }

    systemPrompt += inventoryContext;
    if (includeAudio) {
      systemPrompt += `\n\nPOKYNY PRE TELEFONICKÝ HOVOR:\nHovoríš cez telefón! Odpovedaj rýchlo, energicky, prirodzene a živo v 1 až 2 svižných vetách (max 18-20 slov). Nezdržuj, hovor rovno k veci! KRITICKÉ: VŽDY dokonči celú svoju myšlienku a každú začatú vetu ukonči bodkou, výkričníkom alebo otáznikom! Nikdy neprestaň hovoriť v polovici vety.`;
    }
    const voiceToUse = voice || currentAgent.voice || 'leda';
    const agentRoleName = currentAgent.name;

    const ai = getGeminiClient();

    // Convert message history with guaranteed user start and alternating roles
    const contents = buildGeminiContents(messages);

    let reply = await callGeminiWithCascade(
      contents,
      systemPrompt,
      { temperature: 0.7, maxOutputTokens: includeAudio ? 95 : 600 }
    );

    if (!reply) {
      if (currentAgent.id === 'jaromir') {
        reply = 'Haló, počujeme sa? Na stanici v Leopoldove práve posunujú nákladný vlak a trochu to tu šuští v slúchadle! Hovor, čo máš s mašinkami?';
      } else if (currentAgent.id === 'gregor') {
        reply = 'Haló... Gregor pri telefóne. Prepáč, vypadol mi signál, lebo sedím v kúte a premýšľam nad životom. Povedz mi ešte raz tú baliacu hlášku...';
      } else if (currentAgent.id === 'eliska') {
        reply = 'Prepáč, padla mi sieť v kancli... Šéf tu zasa niečo montuje. Čo si to písal?';
      } else {
        reply = 'Prepáč, na chvíľu sa prerušilo spojenie na linke! Skús mi to zopakovať.';
      }
    }

    // Process Unlock Tags BEFORE punctuation trimming:
    // (Contacts are NOT automatically saved just by calling/chatting - only when explicitly given as quest reward or manually saved by player)
    const unlockedItems: ServerInventoryItem[] = [];
    const unlockedContacts: ServerDiscoveredContact[] = [];

    // Detect if agent's reply is a refusal/rejection so we NEVER unlock rewards on rejection
    const lowerReply = reply.toLowerCase();
    const isRefusal =
      /\b(nedám|nevystavím|nepodpíšem|nič nedostanete|nič nevystavím|nič nečakajte|odmietam|zabudnite|ani náhodou|nevybavím|neprichádza do úvahy|vypadnite|neotravujte|zložte|naučte sa|lajdák|automat na papieriky|vyhlášk|žiadn[aáouey]\s+(faktúr|objednávk|zoznam|zľav|číslo|kontakt|pomoc)|nemáte\s+(nárok|šancu|právo|predmet|prerekvizitu)|nemám\s+sa\s+s\s+vami\s+o\s+čom|dajte\s+mi\s+pokoj|slabota|dovidenia|nemám pre vás|otravuj)\b/i.test(reply);

    // Specific refusal / multi-turn polite gating for Koľajová:
    let kolajovaPassed = true;
    if (currentAgent.id === 'kolajova') {
      const hasExplicitGrant =
        (lowerReply.includes('tu máte tú vašu') ||
         lowerReply.includes('aspoň niekto') ||
         lowerReply.includes('nech sa páči') ||
         lowerReply.includes('vezmite si tú faktúru') ||
         lowerReply.includes('vystavujem vám faktúru')) &&
        (lowerReply.includes('faktúr') || lowerReply.includes('autobus'));
      kolajovaPassed = userTurnCount >= 2 && hasExplicitGrant && !isRefusal;
    }

    const canActuallyUnlock = canGrantReward && !isRefusal && kolajovaPassed;

    // 1. [UNLOCK_ITEM:id:name]
    const itemRegex = /\[UNLOCK_ITEM:([^:\]]+):([^\]]+)\]/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(reply)) !== null) {
      const itemId = itemMatch[1].trim();
      const itemName = itemMatch[2].trim();
      if (!canActuallyUnlock) {
        console.warn(`[REWARD BLOCKED] Agent ${currentAgent.name} item "${itemName}" blocked (canGrant: ${canGrantReward}, refusal: ${isRefusal}, kolajovaPassed: ${kolajovaPassed}, reason: ${missingPrereqReason})`);
        continue;
      }
      if (teamId) {
        const res = addInventoryItemToTeam(teamId, {
          id: itemId,
          name: itemName,
          sourceAgent: currentAgent.name,
        });
        unlockedItems.push(res.item);
      }
    }

    // 2. [UNLOCK_CONTACT:phone:name:type]
    const contactRegex = /\[UNLOCK_CONTACT:([^:\]]+):([^:\]]+)(?::([^\]]+))?\]/g;
    let contactMatch;
    while ((contactMatch = contactRegex.exec(reply)) !== null) {
      const cPhone = contactMatch[1].trim();
      const cName = contactMatch[2].trim();
      const cType = (contactMatch[3]?.trim() as 'voice' | 'text') || 'voice';
      if (!canActuallyUnlock) {
        console.warn(`[REWARD BLOCKED] Agent ${currentAgent.name} contact "${cName}" blocked (canGrant: ${canGrantReward}, refusal: ${isRefusal}, reason: ${missingPrereqReason})`);
        continue;
      }
      if (teamId) {
        const res = addContactToTeam(teamId, {
          phone: cPhone,
          name: cName,
          type: cType,
          sourceAgent: currentAgent.name,
        });
        unlockedContacts.push(res.contact);
      }
    }

    // Content-based fallback detection for unlocks (STRICT PREREQUISITE & REFUSAL GATING)
    if (teamId && canActuallyUnlock) {
      // Items fallbacks:
      if (currentAgent.id === 'daniela_baranova' && (reply.includes('WBarbie67W') || lowerReply.includes('wbarbie'))) {
        if (!unlockedItems.some((i) => i.id === 'temu_kod')) {
          const res = addInventoryItemToTeam(teamId, { id: 'temu_kod', name: 'Temu discount kód: WBarbie67W', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      } else if (
        currentAgent.id === 'kolajova' &&
        (lowerReply.includes('tu máte') || lowerReply.includes('aspoň niekto') || lowerReply.includes('nech sa páči') || lowerReply.includes('berte si')) &&
        lowerReply.includes('faktúr')
      ) {
        if (!unlockedItems.some((i) => i.id === 'faktura_autobus')) {
          const res = addInventoryItemToTeam(teamId, { id: 'faktura_autobus', name: 'Faktúra za autobus', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      } else if (
        currentAgent.id === 'gregor' &&
        (reply.includes('10/10') || lowerReply.includes('vybavujem dodávku') || lowerReply.includes('môj život má zmysel'))
      ) {
        if (!unlockedItems.some((i) => i.id === 'objednavka_hub')) {
          const res = addInventoryItemToTeam(teamId, { id: 'objednavka_hub', name: 'Objednávka húb', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      } else if (
        currentAgent.id === 'must_rum' &&
        (lowerReply.includes('vystavujem doklad') ||
         lowerReply.includes('vystavujem pre vašu objednávku') ||
         lowerReply.includes('bola zaevidovaná') ||
         lowerReply.includes('úspešne zaregistrovaná') ||
         lowerReply.includes('výroba je obnovená'))
      ) {
        if (!unlockedItems.some((i) => i.id === 'objednavka_must_rum')) {
          const res = addInventoryItemToTeam(teamId, { id: 'objednavka_must_rum', name: 'Objednávka muštu a rumu', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      } else if (
        currentAgent.id === 'jakub_vrchos' &&
        (lowerReply.includes('tu je kompletný zoznam') || lowerReply.includes('odovzdávam vám zoznam') || lowerReply.includes('tu máte zoznam') || lowerReply.includes('zachránilo celé sústredenie'))
      ) {
        if (!unlockedItems.some((i) => i.id === 'zoznam_ucastnikov')) {
          const res = addInventoryItemToTeam(teamId, { id: 'zoznam_ucastnikov', name: 'Zoznam účastníkov sústredenia', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      } else if (
        currentAgent.id === 'lukas_briezka' &&
        (lowerReply.includes('tu máš 10 tipov') || lowerReply.includes('tu máte 10 tipov') || lowerReply.includes('odovzdávam ti manuál') || lowerReply.includes('dávam ti tento manuál'))
      ) {
        if (!unlockedItems.some((i) => i.id === '10_tipov_biznis')) {
          const res = addInventoryItemToTeam(teamId, { id: '10_tipov_biznis', name: '10 tipov a trikov na založenie biznisu', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      } else if (currentAgent.id === 'matej_kablik' && (lowerReply.includes('termín') || lowerReply.includes('rezervujem'))) {
        if (!unlockedItems.some((i) => i.id === 'termin_psycholog')) {
          const res = addInventoryItemToTeam(teamId, { id: 'termin_psycholog', name: 'Termín u psychológa', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      } else if (currentAgent.id === 'jakub_instalater' && (lowerReply.includes('prijímam vašu zákazku') || lowerReply.includes('dohodnutá, prídem'))) {
        if (!unlockedItems.some((i) => i.id === 'navsteva_instalatera')) {
          const res = addInventoryItemToTeam(teamId, { id: 'navsteva_instalatera', name: 'Návšteva inštalatéra', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      } else if (currentAgent.id === 'nela_kodevardska' && (lowerReply.includes('oppenheimer') || lowerReply.includes('fotosyntet'))) {
        if (!unlockedItems.some((i) => i.id === 'codeword_baran')) {
          const res = addInventoryItemToTeam(teamId, { id: 'codeword_baran', name: 'Codeword pre Barana: Oppenheimer fotosyntetyzuje', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      } else if (currentAgent.id === 'matej_makyta' && (lowerReply.includes('víťaz') || lowerReply.includes('gratul'))) {
        if (!unlockedItems.some((i) => i.id === 'vitazstvo')) {
          const res = addInventoryItemToTeam(teamId, { id: 'vitazstvo', name: 'Víťazstvo v táborovej šifre (Matej Makyta)', sourceAgent: currentAgent.name });
          unlockedItems.push(res.item);
        }
      }

      // Contact fallbacks:
      if (currentAgent.id === 'jaromir' && (reply.includes('905 777 111') || reply.includes('905777111'))) {
        if (!unlockedContacts.some((c) => c.phoneClean === '905777111')) {
          const res = addContactToTeam(teamId, { phone: '905 777 111', name: 'Eliška Novotná', type: 'text', sourceAgent: currentAgent.name });
          unlockedContacts.push(res.contact);
        }
      } else if (currentAgent.id === 'eliska' && (reply.includes('902 965 621') || reply.includes('902965621'))) {
        if (!unlockedContacts.some((c) => c.phoneClean === '902965621')) {
          const res = addContactToTeam(teamId, { phone: '902 965 621', name: 'Pani Koľajová', type: 'voice', sourceAgent: currentAgent.name });
          unlockedContacts.push(res.contact);
        }
      } else if (currentAgent.id === 'amelia' && (reply.includes('917 505 871') || reply.includes('917505871'))) {
        if (!unlockedContacts.some((c) => c.phoneClean === '917505871')) {
          const res = addContactToTeam(teamId, { phone: '917 505 871', name: 'Jakub Vrchoš', type: 'voice', sourceAgent: currentAgent.name });
          unlockedContacts.push(res.contact);
        }
      } else if (currentAgent.id === 'dusan_bublavy' && (reply.includes('944 546 298') || reply.includes('944546298'))) {
        if (!unlockedContacts.some((c) => c.phoneClean === '944546298')) {
          const res = addContactToTeam(teamId, { phone: '944 546 298', name: 'Matej Káblik', type: 'voice', sourceAgent: currentAgent.name });
          unlockedContacts.push(res.contact);
        }
      } else if (currentAgent.id === 'rybari_komarno' && (reply.includes('955 201 356') || reply.includes('955201356'))) {
        if (!unlockedContacts.some((c) => c.phoneClean === '955201356')) {
          const res = addContactToTeam(teamId, { phone: '955 201 356', name: 'M. Daniela Baranová', type: 'text', sourceAgent: currentAgent.name });
          unlockedContacts.push(res.contact);
        }
      } else if (currentAgent.id === 'daniel_andrejovich' && (reply.includes('914 607 808') || reply.includes('914607808'))) {
        if (!unlockedContacts.some((c) => c.phoneClean === '914607808')) {
          const res = addContactToTeam(teamId, { phone: '914 607 808', name: 'Advokát Petrovič', type: 'voice', sourceAgent: currentAgent.name });
          unlockedContacts.push(res.contact);
        }
      } else if (currentAgent.id === 'advokat_petrovic' && (reply.includes('917 029 515') || reply.includes('917029515'))) {
        if (!unlockedContacts.some((c) => c.phoneClean === '917029515')) {
          const res = addContactToTeam(teamId, { phone: '917 029 515', name: 'Matej Makita', type: 'voice', sourceAgent: currentAgent.name });
          unlockedContacts.push(res.contact);
        }
      }
    }

    // Detect if aunt/agent wants to hang up the phone
    const shouldHangUp =
      reply.includes('[HANGUP]') ||
      /\b(dovidenia|majte sa|musím končiť|končím|zložila som|zložte to|zložte|dovi|zbohom|dajte mi pokoj|nemám čas|nemám na vás čas|vypadnite|neotravujte|odchádzam)\b/i.test(reply);

    // Strip bracketed internal tags from speech and message text
    reply = reply
      .replace(/\[HANGUP\]/g, '')
      .replace(/\[UNLOCK_ITEM:[^\]]+\]/g, '')
      .replace(/\[UNLOCK_CONTACT:[^\]]+\]/g, '')
      .replace(/\[QUEST_COMPLETED[^\]]*\]/g, '')
      .trim();

    // Clean punctuation on the stripped speech text
    if (reply && !/[.!?]["']?$/.test(reply.trim())) {
      const lastPunct = Math.max(
        reply.lastIndexOf('.'),
        reply.lastIndexOf('!'),
        reply.lastIndexOf('?')
      );
      if (lastPunct > 20) {
        reply = reply.slice(0, lastPunct + 1).trim();
      } else {
        reply = reply.trim() + '.';
      }
    }

    let questUnlocked = unlockedItems.length > 0 || unlockedContacts.length > 0;
    if (reply.includes('[QUEST_COMPLETED:10_OUT_OF_10]') || reply.includes('10/10')) {
      questUnlocked = true;
    }

    // Direct audio synthesis for voice agents
    let audioBase64: string | null = null;
    let audioMimeType: string = 'audio/wav';

    if (includeAudio) {
      try {
        const audioResult = await generateGeminiLiveAudio(reply, voiceToUse, agentRoleName);
        if (audioResult.buffer && audioResult.buffer.length > 0) {
          audioBase64 = audioResult.buffer.toString('base64');
          audioMimeType = audioResult.mimeType;
        }
      } catch (ttsErr: any) {
        console.warn('Audio generation failed in /api/chat:', ttsErr?.message || ttsErr);
      }
    }

    // Persistent logging per Team
    try {
      const userMessage = [...messages].reverse().find((m) => m.role === 'user')?.text || '';
      const currentSession =
        sessionId ||
        (req.headers['x-session-id'] as string) ||
        'session-' + (req.ip || 'visitor').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);

      if (userMessage) {
        appendChatLog({
          id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
          timestamp: new Date().toISOString(),
          sessionId: currentSession,
          teamId,
          agent: foundAgent ? foundAgent.name : (requestedAgentId || 'Neznámy'),
          agentType: foundAgent?.type || (includeAudio ? 'voice' : 'text'),
          userMessage,
          agentReply: reply,
          voice: voiceToUse,
          clientIp: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          questUnlocked,
        });
      }
    } catch (logErr) {
      console.warn('Could not record chat log entry:', logErr);
    }

    return res.json({
      reply,
      audioBase64,
      audioMimeType,
      questUnlocked,
      unlockedItems,
      unlockedContacts,
      shouldHangUp: Boolean(shouldHangUp),
      agentName: agentRoleName,
    });
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({
      error: error?.message || 'Nastala chyba pri hovore',
    });
  }
});

// Admin endpoints for camp leaders
app.get('/api/admin/history', (req: Request, res: Response) => {
  try {
    const { agent, search, teamId, limit } = req.query as {
      agent?: string;
      search?: string;
      teamId?: string;
      limit?: string;
    };

    let logs = readChatLogs();
    const totalCount = logs.length;

    if (teamId && teamId !== 'all') {
      logs = logs.filter((l) => l.teamId === teamId);
    }
    if (agent && agent !== 'all') {
      logs = logs.filter((l) => l.agent.toLowerCase().includes(agent.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      logs = logs.filter(
        (l) => l.userMessage.toLowerCase().includes(q) || l.agentReply.toLowerCase().includes(q)
      );
    }

    const sorted = [...logs].reverse();
    const maxLimit = limit ? Math.min(parseInt(limit, 10) || 500, 2000) : 500;
    const paginated = sorted.slice(0, maxLimit);

    return res.json({
      success: true,
      totalCount,
      filteredCount: logs.length,
      logs: paginated,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to read chat history' });
  }
});

app.delete('/api/admin/history', (req: Request, res: Response) => {
  try {
    const { id, teamId } = req.query as { id?: string; teamId?: string };
    ensureDataDir();

    let logs = readChatLogs();
    if (id) {
      logs = logs.filter((l) => l.id !== id);
    } else if (teamId) {
      logs = logs.filter((l) => l.teamId !== teamId);
    } else {
      logs = [];
    }

    fs.writeFileSync(CHAT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    return res.json({ success: true, cleared: !id && !teamId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to modify logs' });
  }
});

app.get('/api/admin/stats', (_req: Request, res: Response) => {
  try {
    const logs = readChatLogs();
    const teamCounts: Record<string, number> = {};
    logs.forEach((l) => {
      const t = l.teamId || 'unknown';
      teamCounts[t] = (teamCounts[t] || 0) + 1;
    });

    const questsUnlocked = logs.filter((l) => l.questUnlocked).length;

    return res.json({
      totalInteractions: logs.length,
      teamCounts,
      questsUnlocked,
      lastActivity: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to fetch stats' });
  }
});

// Helper function to package raw 24kHz 16-bit PCM into WAV format
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const alignedLength = pcmBuffer.length - (pcmBuffer.length % 2);
  const alignedPcm = alignedLength < pcmBuffer.length ? pcmBuffer.subarray(0, alignedLength) : pcmBuffer;

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + alignedPcm.length, 4);
  wavHeader.write('WAVE', 8);

  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);

  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(alignedPcm.length, 40);

  return Buffer.concat([wavHeader, alignedPcm]);
}

// In-memory audio cache for instant responses (greetings & repeated phrases)
const AUDIO_CACHE = new Map<string, { buffer: Buffer; mimeType: string }>();

// Next-Gen Speech Synthesis powered by Gemini Live 3.8
async function generateGeminiLiveAudio(
  rawText: string,
  voiceType: string = 'leda',
  roleContext: string = 'Eliška'
): Promise<{ buffer: Buffer; mimeType: string }> {
  const clean = rawText
    .replace(/[*_~`]/g, '')
    .replace(/\[QUEST_COMPLETED:[^\]]+\]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[«»""]/g, '')
    .trim();

  if (!clean) {
    return { buffer: Buffer.alloc(0), mimeType: 'audio/wav' };
  }

  // Prebuilt voice mapping:
  // Male: Fenrir (Jaromír / friendly), Charon (Gregor / deep/sad), Puck (Yapper / quirky)
  // Female: Leda (Eliška / youthful), Kore (soft)
  let prebuiltVoice = 'Leda';
  const v = voiceType.toLowerCase();
  if (v.includes('fenrir') || v.includes('jaromir') || roleContext.includes('Jaromír')) {
    prebuiltVoice = 'Fenrir';
  } else if (v.includes('charon') || v.includes('gregor') || roleContext.includes('Gregor')) {
    prebuiltVoice = 'Charon';
  } else if (v.includes('puck') || v.includes('yapper')) {
    prebuiltVoice = 'Puck';
  } else if (v.includes('kore')) {
    prebuiltVoice = 'Kore';
  } else if (v.includes('aoede')) {
    prebuiltVoice = 'Aoede';
  }

  // 0. Cache hit check -> Instantaneous response (0ms)
  const cacheKey = `${prebuiltVoice}:${clean}`;
  const cachedAudio = AUDIO_CACHE.get(cacheKey);
  if (cachedAudio) {
    return cachedAudio;
  }

  const ai = getGeminiClient();

  let systemPromptVoice = 'Hovor prirodzeným, svižným a príjemným tempom po slovensky.';
  if (roleContext.includes('Vedúci') || clean.split(',').length >= 3) {
    systemPromptVoice = 'Čítaj mená zreteľne, plynulo a svižne po slovensky bez akýchkoľvek ďalších komentárov.';
  } else if (prebuiltVoice === 'Fenrir') {
    systemPromptVoice = 'Si veselý slovenský rušňovodič Jaromír. Hovor s veľkým nadšením, svižným tempom a energiou v prirodzenej slovenčine.';
  } else if (prebuiltVoice === 'Charon') {
    systemPromptVoice = 'Si Gregor. Hovor po slovensky smutným, unaveným tónom chalana s depresiou.';
  } else if (prebuiltVoice === 'Puck') {
    systemPromptVoice = 'Si hyperaktívny, urozprávaný ujo Yapper. Hovor po slovensky bleskovo, bláznivo a vtipne.';
  } else if (prebuiltVoice === 'Aoede' || prebuiltVoice === 'Leda') {
    systemPromptVoice = 'Si mladá Slovenka. Hovor sviežim, energickým a moderným hovorovým dievčenským tempom bez pomalého naťahovania.';
  }

  const maleKeywords = [
    'fenrir', 'charon', 'puck', 'jaromír', 'jaromir', 'gregor', 'vrchoš', 'vrchos',
    'dušan', 'dusan', 'bublavý', 'bublavy', 'jakub', 'inštalatér', 'instalater',
    'lukáš', 'lukas', 'briezka', 'matej', 'káblik', 'kablik', 'daniel', 'andrejovich',
    'petrovič', 'petrovic', 'makyta'
  ];
  const isMale = maleKeywords.some((k) =>
    voiceType.toLowerCase().includes(k) ||
    roleContext.toLowerCase().includes(k) ||
    prebuiltVoice.toLowerCase().includes(k)
  );

  const edgeVoice = isMale ? 'sk-SK-LukasNeural' : 'sk-SK-ViktoriaNeural';

  // 1. PRIMARY: Ultra-Fast Neural Speech Synthesis (600ms - 900ms instant latency)
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(clean, { rate: '+15%' });

    const audioBuf = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        tts.close();
        reject(new Error('Edge Neural TTS timeout'));
      }, 5000);

      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('end', () => {
        clearTimeout(timer);
        tts.close();
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', (err: any) => {
        clearTimeout(timer);
        tts.close();
        reject(err);
      });
    });

    if (audioBuf && audioBuf.length > 0) {
      const result = { buffer: audioBuf, mimeType: 'audio/mpeg' };
      AUDIO_CACHE.set(cacheKey, result);
      return result;
    }
  } catch (edgeErr: any) {
    console.warn('Fast neural TTS notice, trying Gemini Live:', edgeErr?.message);
  }

  // 2. FALLBACK: Gemini Live 3.8 (gemini-3.8-live) Real-Time Voice Synthesis with immediate completion
  try {
    const pcmBuffer = await new Promise<Buffer>(async (resolve, reject) => {
      const audioChunks: Buffer[] = [];
      let isSettled = false;
      let silenceTimer: NodeJS.Timeout | null = null;
      let session: any = null;

      const finish = () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          if (silenceTimer) clearTimeout(silenceTimer);
          try {
            session?.close();
          } catch {}
          resolve(Buffer.concat(audioChunks));
        }
      };

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          if (silenceTimer) clearTimeout(silenceTimer);
          try {
            session?.close();
          } catch {}
          if (audioChunks.length > 0) {
            resolve(Buffer.concat(audioChunks));
          } else {
            reject(new Error('Gemini Live timeout'));
          }
        }
      }, 6000);

      try {
        session = await ai.live.connect({
          model: 'gemini-3.8-live',
          callbacks: {
            onmessage: (msg: any) => {
              if (msg.serverContent?.modelTurn?.parts) {
                for (const p of msg.serverContent.modelTurn.parts) {
                  if (p.inlineData?.data) {
                    audioChunks.push(Buffer.from(p.inlineData.data, 'base64'));
                    if (silenceTimer) clearTimeout(silenceTimer);
                    silenceTimer = setTimeout(finish, 500);
                  }
                }
              }
              if (msg.serverContent?.generationComplete || msg.serverContent?.turnComplete) {
                finish();
              }
            },
            onerror: (err: any) => {
              if (!isSettled) {
                if (audioChunks.length > 0) {
                  finish();
                } else {
                  isSettled = true;
                  clearTimeout(timer);
                  if (silenceTimer) clearTimeout(silenceTimer);
                  try {
                    session?.close();
                  } catch {}
                  reject(err);
                }
              }
            },
            onclose: () => {
              finish();
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: prebuiltVoice } },
            },
            systemInstruction: systemPromptVoice,
          },
        });

        session.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: `Povedz presne a svižne po slovensky:\n${clean}`,
                },
              ],
            },
          ],
          turnComplete: true,
        });
      } catch (connectErr) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          if (silenceTimer) clearTimeout(silenceTimer);
          reject(connectErr);
        }
      }
    });

    if (pcmBuffer && pcmBuffer.length > 0) {
      const wav = pcmToWav(pcmBuffer, 24000);
      const result = { buffer: wav, mimeType: 'audio/wav' };
      AUDIO_CACHE.set(cacheKey, result);
      return result;
    }
  } catch (liveErr: any) {
    console.warn('Gemini 3.8 Live notice:', liveErr?.message || liveErr);
  }

  return { buffer: Buffer.alloc(0), mimeType: 'audio/wav' };
}

// Text-to-Speech Endpoint for Voice Calls
app.get('/api/tts', async (req: Request, res: Response) => {
  try {
    const text = req.query.text as string;
    const voice = (req.query.voice || 'leda') as string;
    const agent = (req.query.agent || '') as string;
    if (!text) {
      return res.status(400).send('Text parameter is required');
    }

    const { buffer, mimeType } = await generateGeminiLiveAudio(text, voice, agent);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(buffer);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to generate speech' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Camp Game Server listening on http://0.0.0.0:${PORT}`);

    // Background pre-warming of greetings with Gemini Live 3.8
    setTimeout(async () => {
      try {
        console.log('Pre-warming character greetings with Gemini Live 3.8...');
        await generateGeminiLiveAudio(
          'Haló, tu Jaromír Holý! Práve mi prehadzujú výhybku na stanici, ale počúvam ťa! Hovor, čo máš na srdci, dúfam, že to súvisí s mašinkami!',
          'fenrir',
          'Jaromír'
        );
        await generateGeminiLiveAudio(
          'Haló... tu Gregor... Dúfam, že mi nevoláš preto, aby si sa mi vysmial. Zase ma žiadna baba nechce... Život je taká depka.',
          'charon',
          'Gregor'
        );
        await generateGeminiLiveAudio(
          'Janko, Lukáš, Julka, Branko, Soňa, Štepi, Aliska, Martin.',
          'fenrir',
          'Vedúci'
        );
        await generateGeminiLiveAudio(
          'No nazdar! Práve som zistil, že veveričky v tábore nosia tajné mikrofóny v žaluďoch!',
          'puck',
          'Yapper'
        );
        console.log('Pre-warming complete! Greetings cached in AUDIO_CACHE.');
      } catch (e: any) {
        console.warn('Pre-warm notice:', e?.message || e);
      }
    }, 1000);
  });
}

startServer();
