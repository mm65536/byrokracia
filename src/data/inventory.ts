import { InventoryItem } from '../types';

export const KNOWN_ITEMS: Record<string, Omit<InventoryItem, 'unlockedAt'>> = {
  faktura_autobus: {
    id: 'faktura_autobus',
    name: 'Faktúra za autobus',
    icon: '📄',
    description: 'Úradný doklad potvrdzujúci objednaný autobus na dopravu. Vydala ho pani Koľajová.',
    sourceAgent: 'Pani Koľajová',
  },
  objednavka_hub: {
    id: 'objednavka_hub',
    name: 'Objednávka húb',
    icon: '🍄',
    description: 'Potvrdená dodávka lesných húb z Rimavskej Soboty od Gregora Hlučného.',
    sourceAgent: 'Gregor Hlučný',
  },
  objednavka_must_rum: {
    id: 'objednavka_must_rum',
    name: 'Objednávka muštu a rumu',
    icon: '🍹',
    description: 'Oficiálny expedičný list na mušt a rum pre pivárenské sústredenie od Mušt Rum s.r.o.',
    sourceAgent: 'Mušt Rum s.r.o. firemný chatbot',
  },
  zoznam_ucastnikov: {
    id: 'zoznam_ucastnikov',
    name: 'Zoznam účastníkov sústredenia',
    icon: '📋',
    description: 'Dôverný menný zoznam všetkých účastníkov pivárenského sústredenia od generálneho riaditeľa Jakuba Vrchoša.',
    sourceAgent: 'Jakub Vrchoš',
  },
  '10_tipov_biznis': {
    id: '10_tipov_biznis',
    name: '10 tipov a trikov na založenie biznisu',
    icon: '💡',
    description: 'Praktický manuál ako rozbehnúť úspešnú firmu. Vybojované od biznis poradcu Lukáša Briezku.',
    sourceAgent: 'Lukáš Briezka',
  },
  termin_psycholog: {
    id: 'termin_psycholog',
    name: 'Termín u psychológa',
    icon: '🧠',
    description: 'Potvrdená rezervácia prednostného sedenia u psychológa Mateja Káblika na vyhúkanie a odbúranie stresu.',
    sourceAgent: 'Matej Káblik',
  },
  navsteva_instalatera: {
    id: 'navsteva_instalatera',
    name: 'Návšteva inštalatéra',
    icon: '🔧',
    description: 'Dohodnutý zásah a oprava vodovodného potrubia od inštalatéra Jakuba H.',
    sourceAgent: 'Jakub H, inštalatér',
  },
  codeword_baran: {
    id: 'codeword_baran',
    name: 'Codeword pre Barana: Oppenheimer fotosyntetyzuje',
    icon: '🔑',
    description: 'Tajné kódové heslo získané od Nely Kódevardskej pre kontakt M. Daniela Baranová.',
    sourceAgent: 'Nela Kódevardská',
  },
  temu_kod: {
    id: 'temu_kod',
    name: 'Temu discount kód: WBarbie67W',
    icon: '🏷️',
    description: 'Tajný zľavový kód WBarbie67W získaný od M. Daniely Baranovej. ⚠️ DÔLEŽITÉ: Advokát Petrovič sa s vami nebude baviť, kým vám tento kód osobne neschváli táborový vedúci! Choďte za vedúcim, ukážte mu kód v mobile a požiadajte ho o schválenie v táborovej centrále (676 767 667).',
    sourceAgent: 'M. Daniela Baranová',
  },
  vitazstvo: {
    id: 'vitazstvo',
    name: 'Víťazstvo v táborovej šifre (Matej Makyta)',
    icon: '🏆',
    description: 'Záverečné potvrdenie o úspešnom dokončení celej siete kontaktov priamo od koordinátora Mateja Makytu!',
    sourceAgent: 'Matej Makyta',
  },
};

export function createInventoryItem(id: string, customName?: string, sourceAgent?: string): InventoryItem {
  const cleanId = id.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const found = KNOWN_ITEMS[cleanId] || Object.values(KNOWN_ITEMS).find(
    (i) => i.name.toLowerCase() === (customName || id).toLowerCase()
  );

  if (found) {
    return {
      id: found.id,
      name: customName || found.name,
      icon: found.icon,
      description: found.description,
      unlockedAt: new Date().toISOString(),
      sourceAgent: sourceAgent || found.sourceAgent,
    };
  }

  return {
    id: cleanId,
    name: customName || id,
    icon: '📦',
    description: 'Dôležitý predmet získaný počas vyšetrovania.',
    unlockedAt: new Date().toISOString(),
    sourceAgent,
  };
}
