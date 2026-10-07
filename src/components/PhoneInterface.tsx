import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Backpack, Sparkles, X } from 'lucide-react';
import { PhoneKeypad } from './PhoneKeypad';
import { SmsChatView } from './SmsChatView';
import { ActiveCallOverlay } from './ActiveCallOverlay';
import { AdminCenterModal } from './AdminCenterModal';
import { TeamSelectModal } from './TeamSelectModal';
import { InventoryModal } from './InventoryModal';
import {
  AgentData,
  TeamId,
  CallSession,
  ChatMessage,
  DummyBehaviorType,
  DummyConfig,
  TeamInventory,
  InventoryItem,
  DiscoveredContact,
} from '../types';
import { TEAMS_DATA, SECRET_ADMIN_PHONE_CLEAN } from '../data/teams';
import { normalizePhone, formatPhone } from '../data/agents';

interface PhoneInterfaceProps {
  activeTeamId: TeamId;
  onChangeTeam: (id: TeamId) => void;
  agents: AgentData[];
  onSaveAgent: (agent: AgentData) => Promise<void>;
  onDeleteAgent: (id: string) => Promise<void>;
  onResetAgents: () => Promise<void>;
  chatMessages: Record<string, ChatMessage[]>;
  onSendTextMessage: (agentId: string, text: string) => Promise<void>;
  onClearTextHistory: (agentId: string) => void;
  isTextLoading: boolean;
  inventory: TeamInventory;
  onUnlockItem: (item: InventoryItem) => void;
  onUnlockContact: (contact: DiscoveredContact) => void;
  onDeleteContact?: (phoneClean: string) => void;
}

export const PhoneInterface: React.FC<PhoneInterfaceProps> = ({
  activeTeamId,
  onChangeTeam,
  agents,
  onSaveAgent,
  onDeleteAgent,
  onResetAgents,
  chatMessages,
  onSendTextMessage,
  onClearTextHistory,
  isTextLoading,
  inventory,
  onUnlockItem,
  onUnlockContact,
  onDeleteContact,
}) => {
  const [dialedNumber, setDialedNumber] = useState('');
  const [activeCallSession, setActiveCallSession] = useState<CallSession | null>(null);
  const [activeChatAgent, setActiveChatAgent] = useState<AgentData | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Celebratory unlock toast notification
  const [unlockedToast, setUnlockedToast] = useState<{
    icon: string;
    title: string;
    subtitle: string;
  } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showUnlockToast = (icon: string, title: string, subtitle: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setUnlockedToast({ icon, title, subtitle });
    toastTimerRef.current = setTimeout(() => {
      setUnlockedToast(null);
    }, 4500);
  };

  const [dummies, setDummies] = useState<DummyConfig[]>([]);

  const fetchDummies = async () => {
    try {
      const res = await fetch('/api/game/dummies');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.dummies)) {
          setDummies(data.dummies);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchDummies();
  }, []);

  const handleSaveDummies = async (updatedDummies: DummyConfig[]) => {
    try {
      const res = await fetch('/api/game/dummies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dummies: updatedDummies }),
      });
      if (res.ok) {
        setDummies(updatedDummies);
      }
    } catch (e) {
      console.error('Failed to save dummies:', e);
    }
  };

  // Deterministic modulo pool for fake/unknown numbers so the exact same number ALWAYS answers the same dummy teta
  const DUMMY_MODULO_POOL: DummyBehaviorType[] = ['pig', 'failed', 'leaders', 'yapper', 'beep', 'bangarang'];

  const getDeterministicDummyBehavior = (cleanNumber: string): DummyBehaviorType => {
    let hash = 0;
    for (let i = 0; i < cleanNumber.length; i++) {
      hash = (hash * 37 + cleanNumber.charCodeAt(i)) >>> 0;
    }
    return DUMMY_MODULO_POOL[hash % DUMMY_MODULO_POOL.length];
  };

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeTeam = TEAMS_DATA.find((t) => t.id === activeTeamId) || TEAMS_DATA[0];

  // Initiate dialing a phone number
  const handleDial = (inputNumber: string) => {
    const clean = normalizePhone(inputNumber);
    if (!clean) return;

    // Secret Admin Phone: 676767667
    if (clean === SECRET_ADMIN_PHONE_CLEAN || clean === '676767667') {
      setDialedNumber('');
      setIsAdminOpen(true);
      return;
    }

    // Matej Makita: Does not pick up in app (no voice, no dummy teta, rings endlessly - real person in camp)
    if (clean === '917029515') {
      onUnlockContact({
        phone: '917 029 515',
        phoneClean: '917029515',
        name: 'Matej Makita',
        type: 'voice',
        unlockedAt: new Date().toISOString(),
        sourceAgent: 'Automaticky zapísané',
      });
      setActiveCallSession({
        targetPhone: '917 029 515',
        targetName: 'Matej Makita',
        isMatejMakita: true,
        agentType: 'voice',
        status: 'calling',
        startTime: Date.now(),
      });
      return;
    }

    // Check if known agent in full graph (REAL agents ALWAYS connect to the real agent, 0% dummy chance!)
    const matchedAgent = agents.find((a) => a.phoneClean === clean);

    if (matchedAgent) {
      // Auto-save contact into backpack
      onUnlockContact({
        phone: matchedAgent.phone,
        phoneClean: matchedAgent.phoneClean,
        name: matchedAgent.name,
        type: matchedAgent.type,
        unlockedAt: new Date().toISOString(),
        sourceAgent: 'Automaticky zapísané',
      });

      if (matchedAgent.type === 'text') {
        // Písacia teta (Eliška, Daniela Baranová, Mušt Rum chatbot) - S ňou sa PÍŠE SMS!
        setDialedNumber('');
        setActiveChatAgent(matchedAgent);
        return;
      }

      // Voice agent: Start Voice Call
      setActiveCallSession({
        targetPhone: matchedAgent.phone,
        targetName: matchedAgent.name,
        agentId: matchedAgent.id,
        agentType: 'voice',
        agent: matchedAgent,
        status: 'calling',
        startTime: Date.now(),
      });
    } else {
      // Unknown non-real number -> Deterministically pick via modulo so calling the same number ALWAYS gives the same dummy!
      const behavior = getDeterministicDummyBehavior(clean);
      const dummyCfg = dummies.find((d) => d.id === behavior);
      const targetName = dummyCfg?.name?.trim() || inputNumber;

      // Dummy behavior call
      setActiveCallSession({
        targetPhone: inputNumber,
        targetName,
        isDummy: true,
        dummyType: behavior,
        agentType: 'voice',
        status: 'calling',
        startTime: Date.now(),
      });
    }
  };

  // Message shortcut handler
  const handleMessageShortcut = (inputNumber: string) => {
    const clean = normalizePhone(inputNumber);
    const matchedAgent = agents.find((a) => a.phoneClean === clean);

    if (matchedAgent) {
      if (matchedAgent.type === 'voice') {
        // Voice agent: cannot be texted, calls instead
        handleDial(inputNumber);
        return;
      }
      setActiveChatAgent(matchedAgent);
    } else {
      // Unknown number: dial call
      handleDial(inputNumber);
    }
  };

  // Admin sandbox tester for dummies
  const handleTestDummyFromAdmin = (type: DummyBehaviorType) => {
    setIsAdminOpen(false);
    const dummyCfg = dummies.find((d) => d.id === type);
    const targetName = dummyCfg?.name?.trim() || '000 000 000';
    setActiveCallSession({
      targetPhone: '000 000 000',
      targetName,
      isDummy: true,
      dummyType: type,
      agentType: 'voice',
      status: 'calling',
      startTime: Date.now(),
    });
  };

  const handleSaveDialedNumber = (num: string) => {
    const clean = normalizePhone(num);
    if (!clean) return;
    const matchedAgent = agents.find((a) => a.phoneClean === clean);
    const newContact: DiscoveredContact = {
      phone: num,
      phoneClean: clean,
      name: matchedAgent ? matchedAgent.name : `Neznáme číslo (${formatPhone(num)})`,
      type: matchedAgent ? matchedAgent.type : 'voice',
      unlockedAt: new Date().toISOString(),
      sourceAgent: 'Ručne zapísané',
    };
    onUnlockContact(newContact);
    showUnlockToast('📞', `Uložený kontakt: ${newContact.name}`, `${formatPhone(num)} zapísané do batohu`);
  };

  const isDialedNumberSaved = Boolean(
    dialedNumber.trim() &&
    inventory.contacts.some((c) => c.phoneClean === normalizePhone(dialedNumber))
  );

  const currentMessages = activeChatAgent ? chatMessages[activeChatAgent.id] || [] : [];
  const totalInventoryCount = inventory.items.length + inventory.contacts.length;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-0 sm:p-4 select-none relative">
      {/* Clean Container that scales to viewport */}
      <div className="w-full sm:max-w-md h-[100dvh] sm:h-[680px] bg-slate-900 border-0 sm:border border-slate-800 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        {/* Top Header: Active Team Badge, Backpack Button & Time */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-300 font-medium z-30">
          <div className="flex items-center gap-2">
            {/* Active Team Pill (tap to switch) */}
            <button
              type="button"
              onClick={() => setIsTeamModalOpen(true)}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Zmeniť družinku"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="truncate max-w-[95px] sm:max-w-none">{activeTeam.name}</span>
            </button>

            {/* Backpack / Inventory Button */}
            <button
              type="button"
              onClick={() => setIsInventoryOpen(true)}
              className="px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
              title="Otvoriť batoh a objavené kontakty"
            >
              <Backpack className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Batoh</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/25 text-amber-200 font-bold shrink-0">
                {totalInventoryCount}
              </span>
            </button>
          </div>

          {/* Time display */}
          <span className="text-slate-500 font-mono text-xs">
            {currentTime || '12:00'}
          </span>
        </div>

        {/* Global Celebratory Unlock Toast */}
        <AnimatePresence>
          {unlockedToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              className="absolute top-14 inset-x-3 z-40 p-3 rounded-2xl bg-amber-950/90 border border-amber-500/50 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-white"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg shrink-0">
                  {unlockedToast.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-amber-300 truncate">
                    {unlockedToast.title}
                  </div>
                  <div className="text-[11px] text-amber-100/80 truncate">
                    {unlockedToast.subtitle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnlockedToast(null)}
                className="p-1 text-amber-300/70 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content: SMS Chat if active, else Keypad */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-950">
          {activeChatAgent ? (
            <SmsChatView
              agent={activeChatAgent}
              activeTeamId={activeTeamId}
              messages={currentMessages}
              onSendMessage={(text) => onSendTextMessage(activeChatAgent.id, text)}
              onClearHistory={() => onClearTextHistory(activeChatAgent.id)}
              onBackToKeypad={() => setActiveChatAgent(null)}
              isLoading={isTextLoading}
              isSavedContact={inventory.contacts.some((c) => c.phoneClean === activeChatAgent.phoneClean)}
              onSaveContact={() => {
                onUnlockContact({
                  phone: activeChatAgent.phone,
                  phoneClean: activeChatAgent.phoneClean,
                  name: activeChatAgent.name,
                  type: activeChatAgent.type,
                  sourceAgent: 'Ručne uložené zo správ',
                });
                showUnlockToast(
                  '💬',
                  `Uložený kontakt: ${activeChatAgent.name}`,
                  `${formatPhone(activeChatAgent.phone)} zapísané do batohu`
                );
              }}
            />
          ) : (
            <div className="h-full flex flex-col justify-center py-2 overflow-y-auto custom-scrollbar">
              <PhoneKeypad
                dialedNumber={dialedNumber}
                onChangeNumber={setDialedNumber}
                onCall={handleDial}
                onMessage={handleMessageShortcut}
                onSaveNumber={handleSaveDialedNumber}
                isSavedNumber={isDialedNumberSaved}
                agents={agents}
              />
            </div>
          )}
        </div>

        {/* Active Phone Call Overlay */}
        <AnimatePresence>
          {activeCallSession && (
            <ActiveCallOverlay
              session={activeCallSession}
              activeTeamId={activeTeamId}
              isSavedContact={Boolean(
                inventory.contacts.some(
                  (c) =>
                    c.phoneClean === normalizePhone(activeCallSession.targetPhone) ||
                    (activeCallSession.agent && c.phoneClean === activeCallSession.agent.phoneClean)
                )
              )}
              onEndCall={() => setActiveCallSession(null)}
              onUnlockItem={(item) => {
                onUnlockItem(item);
                showUnlockToast(item.icon || '🎒', `Nový predmet: ${item.name}`, 'Pridané do batohu');
              }}
              onUnlockContact={(contact) => {
                onUnlockContact(contact);
                showUnlockToast('📞', `Nový kontakt: ${contact.name}`, formatPhone(contact.phone));
              }}
            />
          )}
        </AnimatePresence>

        {/* Backpack / Inventory Modal */}
        <InventoryModal
          isOpen={isInventoryOpen}
          onClose={() => setIsInventoryOpen(false)}
          team={activeTeam}
          items={inventory.items}
          contacts={inventory.contacts}
          onCallContact={(phone) => {
            setIsInventoryOpen(false);
            handleDial(phone);
          }}
          onMessageContact={(phone) => {
            setIsInventoryOpen(false);
            handleMessageShortcut(phone);
          }}
          onDeleteContact={onDeleteContact}
          onUnlockContact={onUnlockContact}
        />

        {/* Secret Admin Center Modal (Triggered by 676767667) */}
        <AdminCenterModal
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          agents={agents}
          onSaveAgent={onSaveAgent}
          onDeleteAgent={onDeleteAgent}
          onResetAgents={onResetAgents}
          dummies={dummies}
          onSaveDummies={handleSaveDummies}
          onTestDummy={handleTestDummyFromAdmin}
        />

        {/* Team Selection Switcher */}
        <TeamSelectModal
          isOpen={isTeamModalOpen}
          activeTeamId={activeTeamId}
          onSelectTeam={(newTeamId) => {
            onChangeTeam(newTeamId);
            setIsTeamModalOpen(false);
          }}
          canDismiss={true}
          onClose={() => setIsTeamModalOpen(false)}
        />
      </div>
    </div>
  );
};
