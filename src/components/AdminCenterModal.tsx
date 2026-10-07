import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Shield,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Users,
  MessageSquare,
  Phone,
  Volume2,
  Sparkles,
  Trophy,
  CheckCircle2,
  Search,
  Key,
  Flame,
  Radio,
  ExternalLink,
  Save,
} from 'lucide-react';
import { AgentData, TeamId, ChatLogRecord, DummyConfig, DummyBehaviorType } from '../types';
import { TEAMS_DATA, SECRET_ADMIN_PHONE, CAMP_LEADERS } from '../data/teams';
import { formatPhone, normalizePhone } from '../data/agents';

interface AdminCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentData[];
  onSaveAgent: (agent: AgentData) => Promise<void>;
  onDeleteAgent: (id: string) => Promise<void>;
  onResetAgents: () => Promise<void>;
  dummies?: DummyConfig[];
  onSaveDummies?: (dummies: DummyConfig[]) => Promise<void>;
  onTestDummy: (type: DummyBehaviorType) => void;
}

export const AdminCenterModal: React.FC<AdminCenterModalProps> = ({
  isOpen,
  onClose,
  agents,
  onSaveAgent,
  onDeleteAgent,
  onResetAgents,
  dummies,
  onSaveDummies,
  onTestDummy,
}) => {
  const [activeTab, setActiveTab] = useState<'agents' | 'teams' | 'dummies' | 'info'>('agents');
  const [editingAgent, setEditingAgent] = useState<AgentData | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Team history logs
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [teamLogs, setTeamLogs] = useState<ChatLogRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Fallback defaults for dummy tety
  const DEFAULT_DUMMIES_FALLBACK: DummyConfig[] = [
    {
      id: 'pig',
      name: '',
      title: 'Krochajúce prasa',
      description: 'Zábavné krochajúce prasa (prehráva pig.m4a audio loop)',
      customText: '🐷 Krochajúce prasa - autentické chrochtanie a kvičanie',
    },
    {
      id: 'leaders',
      name: '',
      title: 'Mená vedúcich',
      description: 'Hlas v hovore dynamicky skanduje mená vedúcich a odpovedá deťom',
      customText: CAMP_LEADERS.join(', '),
    },
    {
      id: 'yapper',
      name: '',
      title: 'Ujo Yapper',
      description: 'Melie neuveriteľné konšpirácie a reaguje na slová hráča novými teóriami',
      customText: 'Si ujo Yapper. Melieš vtipné konšpirácie a nezmysly (mimozemšťania, veveričky, kvantové polievky). Reaguj na hráča novou bláznivou teóriou!',
    },
    {
      id: 'failed',
      name: '',
      title: 'Hovor sa nepodaril',
      description: 'Slovenská telekomunikačná operátorka s trojtónom na začiatku',
      customText: 'Volané číslo je momentálne nedostupné alebo neexistuje. Skontrolujte prosím telefónne číslo a voľbu opakujte. Hovor sa nepodaril.',
    },
    {
      id: 'beep',
      name: '',
      title: 'Obsadzovací tón (Pípanie)',
      description: 'Nekonečné pípanie (tu-tu-tu) linky bez automatického položenia.',
    },
    {
      id: 'bangarang',
      name: '',
      title: 'Bangarang Hotline',
      description: 'Dubstep synth drop na repeat s párty vizualizérom a stroboskopom',
    },
  ];

  // Editable Dummy Tety state
  const [dummyList, setDummyList] = useState<DummyConfig[]>(() => {
    if (dummies && dummies.length > 0) return dummies;
    return DEFAULT_DUMMIES_FALLBACK;
  });
  const [dummySaveStatus, setDummySaveStatus] = useState<string | null>(null);
  const [isSavingDummies, setIsSavingDummies] = useState(false);
  const [savingDummyId, setSavingDummyId] = useState<DummyBehaviorType | null>(null);

  // Load from server only once when modal is opened, NEVER overwrite user edits while open!
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      fetch('/api/game/dummies')
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.dummies) && d.dummies.length > 0) {
            setDummyList(d.dummies);
          } else if (dummies && dummies.length > 0) {
            setDummyList(dummies);
          }
        })
        .catch(() => {
          if (dummies && dummies.length > 0) setDummyList(dummies);
        });
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  const handleUpdateDummy = (id: DummyBehaviorType, field: 'name' | 'customText', val: string) => {
    setDummyList((prev) => {
      const exists = prev.some((item) => item.id === id);
      if (exists) {
        return prev.map((item) => (item.id === id ? { ...item, [field]: val } : item));
      }
      const fallback = DEFAULT_DUMMIES_FALLBACK.find((d) => d.id === id) || {
        id,
        name: '',
        title: id,
        description: '',
      };
      return [...prev, { ...fallback, [field]: val }];
    });
  };

  const handleSaveAllDummies = async () => {
    setIsSavingDummies(true);
    try {
      const res = await fetch('/api/game/dummies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dummies: dummyList }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dummies) setDummyList(data.dummies);
      }
      if (onSaveDummies) {
        await onSaveDummies(dummyList);
      }
      setDummySaveStatus('✅ Všetky zmeny v dummy tetách boli úspešne uložené!');
      setTimeout(() => setDummySaveStatus(null), 3500);
    } catch (e: any) {
      setDummySaveStatus('❌ Chyba pri ukladaní dummy tiet');
      setTimeout(() => setDummySaveStatus(null), 3500);
    } finally {
      setIsSavingDummies(false);
    }
  };

  const handleSaveSingleDummy = async (id: DummyBehaviorType) => {
    const item = dummyList.find((d) => d.id === id);
    setSavingDummyId(id);
    try {
      const res = await fetch('/api/game/dummies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dummies: dummyList }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dummies) setDummyList(data.dummies);
      }
      if (onSaveDummies) {
        await onSaveDummies(dummyList);
      }
      setDummySaveStatus(`✅ Zmeny pre „${item?.title || id}“ boli úspešne uložené!`);
      setTimeout(() => setDummySaveStatus(null), 3500);
    } catch {
      setDummySaveStatus('❌ Chyba pri ukladaní');
      setTimeout(() => setDummySaveStatus(null), 3500);
    } finally {
      setSavingDummyId(null);
    }
  };

  const handleTestWithAutoSave = async (id: DummyBehaviorType) => {
    try {
      await fetch('/api/game/dummies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dummies: dummyList }),
      });
      if (onSaveDummies) {
        await onSaveDummies(dummyList);
      }
    } catch {}
    onTestDummy(id);
  };

  // Form state for creating / editing agent
  const [formData, setFormData] = useState<Partial<AgentData>>({
    name: '',
    phone: '',
    type: 'voice',
    personality: '',
    reward: '',
    avatarEmoji: '👤',
    voice: 'leda',
    greeting: '',
    tagline: '',
  });

  const [teamInventories, setTeamInventories] = useState<Record<string, { items: any[]; contacts: any[] }>>({});

  const fetchTeamInventories = async () => {
    try {
      const res = await fetch('/api/admin/all-inventories');
      if (res.ok) {
        const data = await res.json();
        if (data.inventories) setTeamInventories(data.inventories);
      }
    } catch {}
  };

  const handleResetTeamInventory = async (tId: string) => {
    if (!confirm(`Naozaj chcete resetovať inventár a objavené čísla pre ${tId}?`)) return;
    try {
      const res = await fetch(`/api/game/inventory/${tId}/reset`, { method: 'POST' });
      if (res.ok) {
        fetchTeamInventories();
      }
    } catch {}
  };

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (selectedTeamFilter !== 'all') params.append('teamId', selectedTeamFilter);
      if (searchFilter.trim()) params.append('search', searchFilter.trim());

      const res = await fetch(`/api/admin/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTeamLogs(data.logs || []);
      }
    } catch (e) {
      console.warn('Failed to fetch logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'teams') {
      fetchLogs();
      fetchTeamInventories();
    }
  }, [isOpen, activeTab, selectedTeamFilter]);

  const handleOpenEdit = (agent: AgentData) => {
    setEditingAgent(agent);
    setIsCreatingNew(false);
    setFormData({ ...agent });
  };

  const handleOpenCreate = () => {
    setEditingAgent(null);
    setIsCreatingNew(true);
    setFormData({
      id: 'agent_' + Date.now(),
      name: '',
      phone: '',
      type: 'voice',
      personality: '',
      reward: '',
      avatarEmoji: '🎭',
      voice: 'leda',
      greeting: 'Haló, počúvam!',
      tagline: 'Nový herný agent',
    });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    const phoneClean = normalizePhone(formData.phone || '');
    const agentToSave: AgentData = {
      id: editingAgent?.id || formData.id || 'agent_' + Date.now(),
      name: formData.name || '',
      phone: formatPhone(formData.phone || ''),
      phoneClean,
      type: formData.type || 'voice',
      personality: formData.personality || '',
      reward: formData.reward || '',
      avatarEmoji: formData.avatarEmoji || '👤',
      accentColor: formData.accentColor || 'emerald',
      voice: formData.voice || 'leda',
      greeting: formData.greeting || 'Haló, počúvam!',
      tagline: formData.tagline || '',
      isQuest: Boolean(formData.reward?.trim()),
    };

    await onSaveAgent(agentToSave);
    setEditingAgent(null);
    setIsCreatingNew(false);
    setSaveStatus('Agent úspešne uložený!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Naozaj chcete zmazať tohto agenta?')) {
      await onDeleteAgent(id);
    }
  };

  const handleResetDefaults = async () => {
    if (confirm('Obnoviť pôvodné 3 tety (Jaromír, Eliška, Gregor)?')) {
      await onResetAgents();
    }
  };

  const handleClearHistory = async (teamId?: string) => {
    if (confirm(`Naozaj chcete vymazať históriu ${teamId ? `pre družinku ${teamId}` : 'všetkých družiniek'}?`)) {
      const url = teamId ? `/api/admin/history?teamId=${teamId}` : '/api/admin/history';
      await fetch(url, { method: 'DELETE' });
      fetchLogs();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-4xl h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Admin Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-xl text-white shadow-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Ústredie Vedúcich (Tajný Admin)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Heslo: {SECRET_ADMIN_PHONE}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Správa tet, monitorovanie družiniek a testovanie dummy liniek
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Zatvoriť ústredie"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 border-b border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === 'agents'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Tety & Agenti ({agents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === 'teams'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Monitor Družiniek (6)</span>
          </button>

          <button
            onClick={() => setActiveTab('dummies')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === 'dummies'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Testovacie Dummy Tety</span>
          </button>

          <button
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === 'info'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Vedúci & Inštrukcie</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-900/60">
          {saveStatus && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveStatus}</span>
            </div>
          )}

          {/* TAB 1: AGENTS MANAGER */}
          {activeTab === 'agents' && (
            <div>
              {!editingAgent && !isCreatingNew ? (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Zoznam postáv (Tety & Ujovia v hre)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Deti vytočia číslo na mobile a spoja sa s danou osobnosťou.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleResetDefaults}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Obnoviť Jaromíra, Elišku a Gregora"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Pôvodné 3</span>
                      </button>

                      <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Pridať novú tetu</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {agents.map((agent) => (
                      <div
                        key={agent.id}
                        className="p-5 rounded-2xl bg-slate-850/80 border border-slate-700/70 hover:border-slate-600 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner">
                                {agent.avatarEmoji}
                              </div>
                              <div>
                                <h4 className="text-base font-bold text-white flex items-center gap-2">
                                  <span>{agent.name}</span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                      agent.type === 'voice'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                                    }`}
                                  >
                                    {agent.type === 'voice' ? 'Hlasový hovor' : 'Písacia SMS'}
                                  </span>
                                </h4>
                                <div className="font-mono text-xs text-amber-400 font-semibold mt-0.5">
                                  📞 {formatPhone(agent.phone)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(agent)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                title="Upraviť tetu"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(agent.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Zmazať"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 mb-3 line-clamp-2">
                            {agent.tagline || agent.personality.slice(0, 120) + '...'}
                          </p>

                          {/* Reward / Quest Clue Card */}
                          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/30 text-[11px] text-amber-200/90 mb-3">
                            <span className="font-bold text-amber-400 flex items-center gap-1 mb-0.5">
                              <Sparkles className="w-3 h-3" />
                              <span>Čo ti dáva / Quest nápoveda:</span>
                            </span>
                            <span className="line-clamp-2">
                              {agent.reward || 'Zatiaľ nezadané (nemá quest)'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Hlas: {agent.voice || 'Leda'}</span>
                          <span>Uvítanie: {agent.greeting ? 'Áno' : 'Predvolené'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* EDIT OR CREATE FORM */
                <form onSubmit={handleSaveForm} className="max-w-2xl mx-auto space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-amber-400" />
                      <span>{isCreatingNew ? 'Pridať novú tetu / agenta' : `Upraviť: ${editingAgent?.name}`}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAgent(null);
                        setIsCreatingNew(false);
                      }}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Zrušiť
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Meno postavy
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Napr. Gregor Hlučný"
                        className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Telefónne číslo (heslo)
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Napr. 917 805 359"
                        className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Typ agenta
                      </label>
                      <select
                        value={formData.type || 'voice'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="voice">Hlasový (Telefonát)</option>
                        <option value="text">Písací (SMS Správy)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Hlas syntézy (TTS)
                      </label>
                      <select
                        value={formData.voice || 'leda'}
                        onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
                        className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="leda">Leda (Mladý ženský - Eliška)</option>
                        <option value="fenrir">Fenrir (Energický mužský - Jaromír)</option>
                        <option value="charon">Charon (Hlboký/smutný mužský - Gregor)</option>
                        <option value="puck">Puck (Komický / Ujo Yapper)</option>
                        <option value="kore">Kore (Jemný ženský)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Emoji ikona
                      </label>
                      <input
                        type="text"
                        value={formData.avatarEmoji || '👤'}
                        onChange={(e) => setFormData({ ...formData, avatarEmoji: e.target.value })}
                        className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 text-center text-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Čo ti dáva / Quest nápoveda (Splnená úloha)
                    </label>
                    <textarea
                      rows={2}
                      value={formData.reward || ''}
                      onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                      placeholder="Čo získa družinka po vyriešení úlohy (napr. tajné heslo, umiestnenie kľúča)..."
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Úvodná veta (Zdravica po zdvihnutí)
                    </label>
                    <input
                      type="text"
                      value={formData.greeting || ''}
                      onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                      placeholder="Napr. Haló, tu Gregor... *povzdych*..."
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Osobnosť a systémový prompt pre AI
                    </label>
                    <textarea
                      rows={6}
                      required
                      value={formData.personality || ''}
                      onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                      placeholder="Ako sa má agent správať, na čo odpovedať, aký má quest..."
                      className="w-full bg-slate-850 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAgent(null);
                        setIsCreatingNew(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                    >
                      Zrušiť
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md"
                    >
                      Uložiť postavu
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: TEAMS MONITOR */}
          {activeTab === 'teams' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Prehľad všetkých 6 družiniek
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sledujte, komu deti volali, čo si písali a kto už splnil quest.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedTeamFilter}
                    onChange={(e) => setSelectedTeamFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="all">Všetky družinky</option>
                    {TEAMS_DATA.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleClearHistory(selectedTeamFilter === 'all' ? undefined : selectedTeamFilter)}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Zmazať históriu</span>
                  </button>
                </div>
              </div>

              {/* 6 Teams Quick Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {TEAMS_DATA.map((t) => {
                  const teamInteractions = teamLogs.filter((l) => l.teamId === t.id);
                  const hasUnlocked = teamLogs.some((l) => l.teamId === t.id && l.questUnlocked);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeamFilter(t.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedTeamFilter === t.id
                          ? 'bg-slate-800 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                          : 'bg-slate-850/60 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">Družinka {t.number}</span>
                        {hasUnlocked && <span title="Quest vyriešený!">🏆</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {teamInteractions.length} interakcií
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Team Inventory & Discovered Contacts */}
              {selectedTeamFilter !== 'all' && (
                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎒</span>
                      <h4 className="text-xs font-bold text-white">
                        Batoh a objavené čísla: {TEAMS_DATA.find((t) => t.id === selectedTeamFilter)?.name}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetTeamInventory(selectedTeamFilter)}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-rose-300 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Resetovať inventár družinky
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <h5 className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                        <span>Získané predmety:</span>
                        <span className="text-amber-400 font-bold">
                          ({teamInventories[selectedTeamFilter]?.items?.length || 0})
                        </span>
                      </h5>
                      {!teamInventories[selectedTeamFilter]?.items?.length ? (
                        <div className="text-[11px] text-slate-500 italic">Žiadne odomknuté predmety</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {teamInventories[selectedTeamFilter].items.map((i: any) => (
                            <span
                              key={i.id}
                              className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] flex items-center gap-1"
                            >
                              <span>{i.icon || '📦'}</span>
                              <span className="font-medium">{i.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h5 className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                        <span>Objavené kontakty:</span>
                        <span className="text-emerald-400 font-bold">
                          ({teamInventories[selectedTeamFilter]?.contacts?.length || 0})
                        </span>
                      </h5>
                      {!teamInventories[selectedTeamFilter]?.contacts?.length ? (
                        <div className="text-[11px] text-slate-500 italic">Žiadne objavené kontakty</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {teamInventories[selectedTeamFilter].contacts.map((c: any) => (
                            <span
                              key={c.phoneClean}
                              className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-300 text-[11px] flex items-center gap-1"
                            >
                              <span>{c.type === 'text' ? '💬' : '📞'}</span>
                              <span className="font-medium">{c.name}</span>
                              <span className="font-mono text-[10px] text-slate-400">({c.phone})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Leader Authorization for Advokát Petrovič (Temu Discount Code) */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="text-sm">⚖️</span>
                        <span>Advokát Petrovič & Temu kód:</span>
                        {teamInventories[selectedTeamFilter]?.petrovicApproved ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            ✅ Schválené vedúcim
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            ⏳ Neschválené
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-md">
                        Advokát Petrovič povolí hovor a dá číslo na Mateja Makitu len vtedy, ak táborový vedúci potvrdí ich kód.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        const currentlyApproved = Boolean(teamInventories[selectedTeamFilter]?.petrovicApproved);
                        try {
                          const res = await fetch(`/api/admin/team/${selectedTeamFilter}/approve-petrovic`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ approved: !currentlyApproved }),
                          });
                          if (res.ok) {
                            fetchTeamInventories();
                          }
                        } catch {}
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                        teamInventories[selectedTeamFilter]?.petrovicApproved
                          ? 'bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                      }`}
                    >
                      {teamInventories[selectedTeamFilter]?.petrovicApproved
                        ? 'Zrušiť schválenie'
                        : '✅ Schváliť Temu kód pre Advokáta'}
                    </button>
                  </div>
                </div>
              )}

              {/* Logs Stream */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-300">
                    História správ a hovorov ({teamLogs.length})
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Filtrovať text..."
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none pl-7"
                    />
                    <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                  </div>
                </div>

                {isLoadingLogs ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Načítavam záznamy...
                  </div>
                ) : teamLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Žiadne zaznamenané hovory pre vybranú družinku.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                    {teamLogs.map((log) => {
                      const team = TEAMS_DATA.find((t) => t.id === log.teamId);
                      return (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-semibold text-amber-400">
                              {team?.name || 'Neznáma družinka'} ➔ {log.agent}
                            </span>
                            <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>

                          <div className="text-slate-300">
                            <span className="text-slate-400 font-semibold">Tím: </span>
                            "{log.userMessage}"
                          </div>

                          <div className="text-slate-400">
                            <span className="text-slate-300 font-semibold">{log.agent}: </span>
                            "{log.agentReply}"
                          </div>

                          {log.questUnlocked && (
                            <div className="mt-1 text-[10px] text-amber-300 font-bold flex items-center gap-1">
                              <Trophy className="w-3 h-3" />
                              <span>Tento tím odomkol Gregorovo tajomstvo (10/10)!</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DUMMY TESTING & EDITING */}
          {activeTab === 'dummies' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-850 p-4 rounded-2xl border border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-amber-400" />
                    <span>Správa a editovanie Dummy Tiet (Náhodné linky)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Všetky dummy tety sú hlasové hovory. Môžeš im nastaviť vlastné mená (alebo nechať prázdne pre vytočené číslo), upraviť texty a otestovať ich.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveAllDummies}
                    disabled={isSavingDummies}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingDummies ? 'Ukladám...' : 'Uložiť zmeny v dummy tetách'}</span>
                  </button>
                </div>
              </div>

              {dummySaveStatus && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-medium flex items-center justify-between animate-fadeIn">
                  <span>{dummySaveStatus}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Mená vedúcich */}
                {(() => {
                  const item = dummyList.find((d) => d.id === 'leaders') || {
                    id: 'leaders' as DummyBehaviorType,
                    name: '',
                    title: 'Mená vedúcich',
                    description: 'Hlas v hovore dynamicky skanduje mená vedúcich a odpovedá deťom',
                    customText: CAMP_LEADERS.join(', '),
                  };
                  return (
                    <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700/80 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-white">
                            <span className="text-xl">🏕️</span>
                            <span>{item.title}</span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Hlasový hovor
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{item.description}</p>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Zobrazené meno / Názov (ak necháš prázdne, zobrazí sa iba vytočené číslo):
                            </label>
                            <input
                              type="text"
                              value={item.name || ''}
                              onChange={(e) => handleUpdateDummy('leaders', 'name', e.target.value)}
                              placeholder="napr. Mená vedúcich (alebo nechaj prázdne)"
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Zoznam táborových vedúcich (oddelené čiarkami):
                            </label>
                            <textarea
                              rows={2}
                              value={item.customText || ''}
                              onChange={(e) => handleUpdateDummy('leaders', 'customText', e.target.value)}
                              placeholder="Janko, Lukáš, Julka, Branko, Soňa, Štepi, Aliska, Martin"
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleSaveSingleDummy('leaders')}
                          disabled={savingDummyId === 'leaders'}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingDummyId === 'leaders' ? 'Ukladám...' : 'Uložiť zmeny'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestWithAutoSave('leaders')}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Vyskúšať hovor</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Ujo Yapper */}
                {(() => {
                  const item = dummyList.find((d) => d.id === 'yapper') || {
                    id: 'yapper' as DummyBehaviorType,
                    name: '',
                    title: 'Ujo Yapper',
                    description: 'Melie neuveriteľné konšpirácie a reaguje na slová hráča novými teóriami',
                    customText: 'Si ujo Yapper. Melieš vtipné konšpirácie a nezmysly (mimozemšťania, veveričky, kvantové polievky). Reaguj na hráča novou bláznivou teóriou!',
                  };
                  return (
                    <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700/80 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-white">
                            <span className="text-xl">🗣️</span>
                            <span>{item.title}</span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Hlasový hovor (AI)
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{item.description}</p>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Zobrazené meno / Názov (ak necháš prázdne, zobrazí sa iba vytočené číslo):
                            </label>
                            <input
                              type="text"
                              value={item.name || ''}
                              onChange={(e) => handleUpdateDummy('yapper', 'name', e.target.value)}
                              placeholder="napr. Ujo Yapper (alebo nechaj prázdne)"
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Pokyny / témy pre vymýšľanie teórií:
                            </label>
                            <textarea
                              rows={2}
                              value={item.customText || ''}
                              onChange={(e) => handleUpdateDummy('yapper', 'customText', e.target.value)}
                              placeholder="Melieš vtipné konšpirácie a nezmysly..."
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleSaveSingleDummy('yapper')}
                          disabled={savingDummyId === 'yapper'}
                          className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingDummyId === 'yapper' ? 'Ukladám...' : 'Uložiť zmeny'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestWithAutoSave('yapper')}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5 text-amber-400" />
                          <span>Vyskúšať hovor</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Hovor sa nepodaril */}
                {(() => {
                  const item = dummyList.find((d) => d.id === 'failed') || {
                    id: 'failed' as DummyBehaviorType,
                    name: '',
                    title: 'Hovor sa nepodaril',
                    description: 'Slovenská telekomunikačná operátorka s trojtónom na začiatku',
                    customText: 'Volané číslo je momentálne nedostupné alebo neexistuje. Skontrolujte prosím telefónne číslo a voľbu opakujte. Hovor sa nepodaril.',
                  };
                  return (
                    <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700/80 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-white">
                            <span className="text-xl">🤖</span>
                            <span>{item.title}</span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Hlasový hovor (Loop)
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{item.description}</p>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Zobrazené meno / Názov (ak necháš prázdne, zobrazí sa iba vytočené číslo):
                            </label>
                            <input
                              type="text"
                              value={item.name || ''}
                              onChange={(e) => handleUpdateDummy('failed', 'name', e.target.value)}
                              placeholder="napr. Operátor (alebo nechaj prázdne)"
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Text automatického hlásenia operátorky:
                            </label>
                            <textarea
                              rows={2}
                              value={item.customText || ''}
                              onChange={(e) => handleUpdateDummy('failed', 'customText', e.target.value)}
                              placeholder="Volané číslo je momentálne nedostupné..."
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleSaveSingleDummy('failed')}
                          disabled={savingDummyId === 'failed'}
                          className="flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingDummyId === 'failed' ? 'Ukladám...' : 'Uložiť zmeny'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestWithAutoSave('failed')}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5 text-sky-400" />
                          <span>Vyskúšať</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Obsadzovací tón (Pípanie) */}
                {(() => {
                  const item = dummyList.find((d) => d.id === 'beep') || {
                    id: 'beep' as DummyBehaviorType,
                    name: '',
                    title: 'Obsadzovací tón (Pípanie)',
                    description: 'Nekonečné pípanie (tu-tu-tu) linky bez automatického položenia.',
                  };
                  return (
                    <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700/80 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-white">
                            <span className="text-xl">📞</span>
                            <span>{item.title}</span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30">
                            Nekonečné pípanie
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{item.description}</p>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Zobrazené meno / Názov (ak necháš prázdne, zobrazí sa iba vytočené číslo):
                            </label>
                            <input
                              type="text"
                              value={item.name || ''}
                              onChange={(e) => handleUpdateDummy('beep', 'name', e.target.value)}
                              placeholder="napr. Obsadené (alebo nechaj prázdne)"
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleSaveSingleDummy('beep')}
                          disabled={savingDummyId === 'beep'}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingDummyId === 'beep' ? 'Ukladám...' : 'Uložiť zmeny'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestWithAutoSave('beep')}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>Vyskúšať</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 5. Bangarang na repeat */}
                {(() => {
                  const item = dummyList.find((d) => d.id === 'bangarang') || {
                    id: 'bangarang' as DummyBehaviorType,
                    name: '',
                    title: 'Bangarang Hotline',
                    description: 'Dubstep synth drop na repeat s párty vizualizérom a stroboskopom',
                  };
                  return (
                    <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700/80 flex flex-col justify-between space-y-3 md:col-span-2">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 font-bold text-white">
                            <span className="text-xl">🔊</span>
                            <span>{item.title}</span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Dubstep párty linka
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{item.description}</p>

                        <div className="max-w-md">
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            Zobrazené meno / Názov (ak necháš prázdne, zobrazí sa iba vytočené číslo):
                          </label>
                          <input
                            type="text"
                            value={item.name || ''}
                            onChange={(e) => handleUpdateDummy('bangarang', 'name', e.target.value)}
                            placeholder="napr. Bangarang (alebo nechaj prázdne)"
                            className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800 max-w-md">
                        <button
                          type="button"
                          onClick={() => handleSaveSingleDummy('bangarang')}
                          disabled={savingDummyId === 'bangarang'}
                          className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingDummyId === 'bangarang' ? 'Ukladám...' : 'Uložiť zmeny'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestWithAutoSave('bangarang')}
                          className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5 text-purple-400" />
                          <span>Vyskúšať Bangarang</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 4: SECRET INFO & INSTRUCTIONS */}
          {activeTab === 'info' && (
            <div className="max-w-2xl mx-auto space-y-5 text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200">
                <h4 className="text-sm font-bold text-amber-300 mb-1 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  <span>Ako sa dostať do tohto Admin Panelu:</span>
                </h4>
                <p className="leading-relaxed">
                  Stačí na mobile vytočiť tajné telefónne číslo{' '}
                  <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded">
                    {SECRET_ADMIN_PHONE}
                  </span>
                  . Hovor sa automaticky presmeruje priamo do tejto centrálnej riadiacej miestnosti vedúcich! Deti o tomto čísle nevedia.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700 space-y-2">
                <h4 className="text-sm font-bold text-white mb-1">
                  Zoznam táborových vedúcich:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {CAMP_LEADERS.map((leader) => (
                    <span
                      key={leader}
                      className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-semibold"
                    >
                      {leader}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-700 space-y-2">
                <h4 className="text-sm font-bold text-white mb-1">
                  Tety a ich herné úlohy:
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>
                    <strong className="text-white">888 067 069 (Jaromír Holý):</strong> Rušňovodič posadnutý vlakmi. Retardujúci prvok – nemá quest, zdržuje deti vášňou pre mašinky.
                  </li>
                  <li>
                    <strong className="text-white">905 777 111 (Eliška Novotná):</strong> Písacia SMS teta. Nudí sa v práci, čaká vtipný flirt/sexting. Ak ju zabavia, dá indíciu o kľúči na verande (kód: 4209).
                  </li>
                  <li>
                    <strong className="text-white">917 805 359 (Gregor Hlučný):</strong> Hlasový hovor. Má depresiu lebo nevie zbaliť ženu. Ak mu deti dajú 10/10 pickup line, rozveselí sa a dá heslo: ZLATÁ KURIERKA k vedúcemu Lukášovi!
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
