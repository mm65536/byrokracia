import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Phone, Bookmark, Check, Copy, Search, Stamp, FileSpreadsheet, Sparkles, AlertCircle } from 'lucide-react';
import { DiscoveredContact, AgentType } from '../types';
import { formatPhone } from '../data/agents';

export interface ParticipantListPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCall: (phone: string) => void;
  onSaveContact?: (contact: DiscoveredContact) => void;
  savedPhoneCleans: string[];
}

export interface PaperParticipant {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  phoneClean: string;
  type: AgentType;
  note: string;
  signature: string;
  isRealAgent: boolean;
}

// 2 REAL AGENT NUMBERS (Jakub Inštalatér + Dušan Bublavý)
// + 9 RANDOM DUMMY NUMBERS that do NOTHING and belong to NO OTHER PERSONS in the camp
export const PAPER_PARTICIPANTS: PaperParticipant[] = [
  {
    id: 'dusan_bublavy',
    name: 'Dušan Bublavý',
    role: 'Inovatívne startupy & Projekty',
    department: 'Bublavé Inovácie',
    phone: '902 723 821',
    phoneClean: '902723821',
    type: 'voice',
    note: 'Účastník sústredenia. Hľadá biznis rady a nápady na rozbeh podnikania.',
    signature: 'D. Bublavý v.r.',
    isRealAgent: true,
  },
  {
    id: 'jakub_instalater',
    name: 'Jakub H, inštalatér',
    role: 'Technický dozor a servis rozvodov',
    department: 'H-Servis Sifóny & Voda',
    phone: '911 124 579',
    phoneClean: '911124579',
    type: 'voice',
    note: 'Účastník sústredenia. Zodpovedný za potrubia a vodovodné prípojky.',
    signature: 'Jakub H. v.r.',
    isRealAgent: true,
  },
  // 9 RANDOM NUMBERS THAT DO NOTHING:
  {
    id: 'rand_1',
    name: 'Peter Varga',
    role: 'Skladník & Príjem surovín',
    department: 'Skladové hospodárstvo',
    phone: '0903 441 829',
    phoneClean: '0903441829',
    type: 'voice',
    note: 'Účastník sústredenia. Evidencia prepraviek a sudov.',
    signature: 'Varga v.r.',
    isRealAgent: false,
  },
  {
    id: 'rand_2',
    name: 'Monika Kováčová',
    role: 'Administratívna asistentka',
    department: 'Kancelária riaditeľstva',
    phone: '0907 652 193',
    phoneClean: '0907652193',
    type: 'voice',
    note: 'Účastníčka sústredenia. Zápisnice a podklady.',
    signature: 'M. Kováčová v.r.',
    isRealAgent: false,
  },
  {
    id: 'rand_3',
    name: 'Tomáš Molnár',
    role: 'Distribútor nápojov',
    department: 'Logistika západné Slovensko',
    phone: '0915 228 704',
    phoneClean: '0915228704',
    type: 'voice',
    note: 'Účastník sústredenia. Rozvoz a zásobovanie.',
    signature: 'Molnár v.r.',
    isRealAgent: false,
  },
  {
    id: 'rand_4',
    name: 'Zuzana Horváthová',
    role: 'Kontrola akosti a chmeľu',
    department: 'Laboratórna kontrola',
    phone: '0940 891 332',
    phoneClean: '0940891332',
    type: 'voice',
    note: 'Účastníčka sústredenia. Senzorické skúšky piva.',
    signature: 'Z. Horváth v.r.',
    isRealAgent: false,
  },
  {
    id: 'rand_5',
    name: 'Martin Baláž',
    role: 'Operátor stáčacej linky',
    department: 'Výrobná prevádzka',
    phone: '0902 319 874',
    phoneClean: '0902319874',
    type: 'voice',
    note: 'Účastník sústredenia. Fľaškovacia a sudová linka.',
    signature: 'Baláž v.r.',
    isRealAgent: false,
  },
  {
    id: 'rand_6',
    name: 'Lucia Tóthová',
    role: 'Marketing & Event koordinátorka',
    department: 'Propagácia a eventy',
    phone: '0918 734 501',
    phoneClean: '0918734501',
    type: 'voice',
    note: 'Účastníčka sústredenia. Organizácia programu a fotodokumentácia.',
    signature: 'Tóthová v.r.',
    isRealAgent: false,
  },
  {
    id: 'rand_7',
    name: 'Richard Szabó',
    role: 'Technik chladiacich agregátov',
    department: 'Údržba a servis výčapov',
    phone: '0944 116 928',
    phoneClean: '0944116928',
    type: 'voice',
    note: 'Účastník sústredenia. Sanitácia a montáž píp.',
    signature: 'R. Szabó v.r.',
    isRealAgent: false,
  },
  {
    id: 'rand_8',
    name: 'Silvia Nagyová',
    role: 'Personálna referentka (HR)',
    department: 'Ľudské zdroje',
    phone: '0911 802 447',
    phoneClean: '0911802447',
    type: 'voice',
    note: 'Účastníčka sústredenia. Zoznamy ubytovania a diéty.',
    signature: 'Nagyová v.r.',
    isRealAgent: false,
  },
  {
    id: 'rand_9',
    name: 'Michal Urban',
    role: 'Technik bezpečnosti práce (BOZP)',
    department: 'Bezpečnosť a požiarna ochrana',
    phone: '0908 553 619',
    phoneClean: '0908553619',
    type: 'voice',
    note: 'Účastník sústredenia. Školenia bezpečnosti v areáli.',
    signature: 'Urban v.r.',
    isRealAgent: false,
  },
];

export const ParticipantListPaperModal: React.FC<ParticipantListPaperModalProps> = ({
  isOpen,
  onClose,
  onCall,
  onSaveContact,
  savedPhoneCleans,
}) => {
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const handleCopy = (phone: string, clean: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(clean);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleSave = (p: PaperParticipant) => {
    if (onSaveContact) {
      onSaveContact({
        name: p.name,
        phone: p.phone,
        phoneClean: p.phoneClean,
        type: p.type,
        sourceAgent: 'Zoznam účastníkov (Plzeňský Prazdroj)',
      });
    }
  };

  const filtered = PAPER_PARTICIPANTS.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.note.toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 18 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#fdfaf2] text-[#2c2416] rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.65)] border-4 border-[#e2d5bd] overflow-hidden"
          style={{
            backgroundImage: `radial-gradient(#ebe0cb 1.2px, transparent 1.2px)`,
            backgroundSize: '22px 22px',
          }}
        >
          {/* Authentic Paper Document Header */}
          <div className="px-5 py-4 bg-[#f3ecd9] border-b-2 border-[#d9c8aa] flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-900 text-amber-50 flex items-center justify-center shadow-sm shrink-0 border border-amber-950/20">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-amber-950 text-amber-100 font-mono">
                    DÔVERNÝ DOKUMENT • PP-2026/SÚSTR-084
                  </span>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded border border-amber-300">
                    Oficiálna prezenčná listina
                  </span>
                </div>
                <h2 className="text-base sm:text-xl font-black tracking-tight text-amber-950 font-serif mt-1">
                  Zoznam účastníkov pivárenského sústredenia
                </h2>
                <p className="text-xs text-amber-900/80 font-medium">
                  Plzeňský Prazdroj, a.s. • Podpísal: Ing. Jakub Vrchoš, generálny riaditeľ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-amber-800 hover:text-amber-950 hover:bg-[#e4d7be] rounded-xl transition-colors cursor-pointer shrink-0"
              title="Zavrieť papierový zoznam"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search bar & info banner */}
          <div className="px-4 sm:px-5 py-2.5 bg-[#fbf6e8] border-b border-[#e4d7be] flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-amber-800/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Hľadať v zozname (meno, oddelenie, číslo)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/80 border border-amber-300 rounded-xl text-amber-950 placeholder-amber-800/40 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-medium"
              />
            </div>
            <div className="text-[11px] font-semibold text-amber-900 flex items-center gap-1.5 self-end sm:self-center">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>{filtered.length} účastníkov na papieri</span>
            </div>
          </div>

          {/* Notice Banner */}
          <div className="px-5 py-2 bg-amber-100/70 border-b border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Prezenčná listina obsahuje účastníkov sústredenia. Čísla môžete priamo vytočiť alebo si ich zapísať do mobilu.
            </span>
          </div>

          {/* Participant rows */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2.5 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-amber-800/70 font-serif">
                <p className="text-sm font-semibold">Žiadny účastník nezodpovedá vyhľadávaniu.</p>
              </div>
            ) : (
              filtered.map((p, idx) => {
                const isSaved = savedPhoneCleans.includes(p.phoneClean);
                const isCopied = copiedPhone === p.phoneClean;

                return (
                  <div
                    key={p.id}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white/90 border border-[#ded2bc] hover:border-amber-400 transition-all shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono text-amber-700/80 font-bold">
                            #{idx + 1}
                          </span>
                          <h3 className="font-bold text-sm sm:text-base text-amber-950 font-serif">
                            {p.name}
                          </h3>
                          <span className="text-xs font-mono font-bold text-amber-900 px-2 py-0.5 rounded-md bg-amber-200/70 border border-amber-300">
                            {formatPhone(p.phone)}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-amber-900/90 mt-0.5">
                          {p.role} • <span className="font-normal italic text-amber-800/80">{p.department}</span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                          <p className="text-[11px] text-[#554632] leading-snug">
                            {p.note}
                          </p>
                          <span className="text-[10px] font-serif italic text-amber-800/70 bg-[#f6efe1] px-2 py-0.5 rounded border border-[#e6d8c0]">
                            Podpis: {p.signature}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleCopy(p.phone, p.phoneClean)}
                          className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/80 transition-colors cursor-pointer text-xs"
                          title="Skopírovať číslo"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {onSaveContact && (
                          <button
                            type="button"
                            onClick={() => handleSave(p)}
                            disabled={isSaved}
                            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              isSaved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 opacity-90 cursor-default'
                                : 'bg-amber-800 hover:bg-amber-900 text-amber-50 shadow-xs active:scale-98'
                            }`}
                            title={isSaved ? 'Už máte v zápisníku' : 'Uložiť do zápisníka'}
                          >
                            {isSaved ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Uložené</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-3.5 h-3.5" />
                                <span>Do zápisníka</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onCall(p.phone)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer"
                          title="Vytočiť toto číslo"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Vytočiť</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Authentic Document Footer: Red Rubber Stamp + Official Signature */}
          <div className="px-5 py-3.5 bg-[#f3ebd7] border-t-2 border-[#d9c7a7] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-red-700 text-red-700 flex items-center justify-center font-serif text-[8px] font-black uppercase rotate-[-6deg] px-1 text-center shadow-xs">
                ÚRADNÁ PEČIATKA
              </div>
              <div className="text-[11px] font-serif leading-tight text-amber-900">
                <span className="font-bold">Plzeňský Prazdroj, a.s. — Ústredie</span>
                <br />
                <span className="italic text-amber-800/80">Potvrdené: Ing. Jakub Vrchoš, generálny riaditeľ v.r.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-amber-950 hover:bg-black text-amber-100 font-semibold text-xs transition-colors cursor-pointer shadow-md"
            >
              Zatvoriť zoznam
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
