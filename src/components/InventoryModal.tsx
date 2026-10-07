import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Backpack, Phone, MessageSquare, Sparkles, CheckCircle2, ChevronRight, Bookmark, Trash2, FileText } from 'lucide-react';
import { InventoryItem, DiscoveredContact, TeamInfo } from '../types';
import { formatPhone } from '../data/agents';
import { ParticipantListPaperModal } from './ParticipantListPaperModal';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: TeamInfo;
  items: InventoryItem[];
  contacts: DiscoveredContact[];
  onCallContact: (phone: string) => void;
  onMessageContact: (phone: string) => void;
  onDeleteContact?: (phoneClean: string) => void;
  onUnlockContact?: (contact: DiscoveredContact) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  team,
  items,
  contacts,
  onCallContact,
  onMessageContact,
  onDeleteContact,
  onUnlockContact,
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'contacts'>('items');
  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Backpack className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>Batoh & Zápisník</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                    {team.name}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {items.length} {items.length === 1 ? 'predmet' : items.length >= 2 && items.length <= 4 ? 'predmety' : 'predmetov'} • {contacts.length} {contacts.length === 1 ? 'kontakt' : contacts.length >= 2 && contacts.length <= 4 ? 'kontakty' : 'kontaktov'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Zavrieť"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'items'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Backpack className="w-4 h-4" />
              <span>Získané predmety</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 border border-slate-700">
                {items.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('contacts')}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'contacts'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Objavené čísla</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 border border-slate-700">
                {contacts.length}
              </span>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {activeTab === 'items' && (
              <>
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-2xl mb-3 text-slate-500">
                      🎒
                    </div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">
                      Batoh je zatiaľ prázdny
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      Zatiaľ vaša družinka nezískala žiadne predmety ani doklady. Vytočte telefónne číslo na klávesnici a začnite plniť úlohy postáv!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex items-start gap-3 hover:border-amber-500/40 transition-colors shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shrink-0 shadow-inner">
                          {item.icon || '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-white truncate">
                              {item.name}
                            </h4>
                            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                              Odomknuté
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-snug">
                            {item.description}
                          </p>
                          {item.sourceAgent && (
                            <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                              <span className="text-slate-400">Získané od:</span>
                              <span className="font-semibold text-slate-300">{item.sourceAgent}</span>
                            </div>
                          )}

                          {/* Interactive Paper Document View for Zoznam účastníkov */}
                          {(item.id === 'zoznam_ucastnikov' ||
                            item.id.includes('zoznam') ||
                            item.name.toLowerCase().includes('zoznam') ||
                            item.name.toLowerCase().includes('účastník')) && (
                            <button
                              type="button"
                              onClick={() => setIsPaperModalOpen(true)}
                              className="mt-3 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/25 to-yellow-500/20 hover:from-amber-500/35 hover:to-yellow-500/30 border-2 border-amber-500/50 text-amber-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer shadow-md group"
                              title="Otvoriť a prečítať prezenčnú listinu s telefónnymi číslami"
                            >
                              <FileText className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                              <span>📄 Otvoriť zoznam účastníkov (Prečítať papier)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'contacts' && (
              <>
                {contacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-2xl mb-3 text-slate-500">
                      📞
                    </div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">
                      Žiadne objavené kontakty
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      Keď vám niektorá z postáv v rozhovore prezradí ďalšie telefónne číslo, automaticky sa zapíše do vášho zápisníka!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {contacts.map((contact) => (
                      <div
                        key={contact.phoneClean}
                        className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg text-emerald-400 shrink-0 shadow-inner">
                            {contact.type === 'text' ? '💬' : '📞'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">
                              {contact.name}
                            </h4>
                            <div className="text-xs font-mono font-semibold text-emerald-400 mt-0.5">
                              {formatPhone(contact.phone)}
                            </div>
                            {contact.sourceAgent && (
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                Od: {contact.sourceAgent}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {contact.type === 'text' ? (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onMessageContact(contact.phone);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                              title="Napísať SMS"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>SMS</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onCallContact(contact.phone);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                              title="Zavolať"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Vytočiť</span>
                            </button>
                          )}

                          {onDeleteContact && (
                            <button
                              type="button"
                              onClick={() => onDeleteContact(contact.phoneClean)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Odstrániť kontakt zo zápisníka"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer note */}
          <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Predmety sa automaticky odomykajú po splnení úloh</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Hotovo
            </button>
          </div>
        </motion.div>

        {/* Paper Document Modal for Participant List */}
        <ParticipantListPaperModal
          isOpen={isPaperModalOpen}
          onClose={() => setIsPaperModalOpen(false)}
          onCall={(phone) => {
            setIsPaperModalOpen(false);
            onClose();
            onCallContact(phone);
          }}
          onSaveContact={onUnlockContact}
          savedPhoneCleans={contacts.map((c) => c.phoneClean)}
        />
      </div>
    </AnimatePresence>
  );
};
