import React, { useState, useEffect } from 'react';
import { PhoneInterface } from './components/PhoneInterface';
import { TeamSelectModal } from './components/TeamSelectModal';
import { AgentData, TeamId, ChatMessage, TeamInventory, InventoryItem, DiscoveredContact } from './types';
import { INITIAL_AGENTS } from './data/agents';
import { TEAMS_DATA } from './data/teams';
import { KNOWN_ITEMS } from './data/inventory';

export default function App() {
  const [activeTeamId, setActiveTeamId] = useState<TeamId | null>(() => {
    try {
      const saved = localStorage.getItem('camp_active_team');
      if (saved && TEAMS_DATA.some((t) => t.id === saved)) {
        return saved as TeamId;
      }
    } catch {}
    return null;
  });

  const [agents, setAgents] = useState<AgentData[]>(INITIAL_AGENTS);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [isTextLoading, setIsTextLoading] = useState(false);

  // Per-team inventory state
  const [teamInventories, setTeamInventories] = useState<Record<string, TeamInventory>>(() => {
    const initial: Record<string, TeamInventory> = {};
    for (const t of TEAMS_DATA) {
      try {
        const saved = localStorage.getItem(`camp_inventory_${t.id}`);
        if (saved) {
          initial[t.id] = JSON.parse(saved);
        } else {
          initial[t.id] = { teamId: t.id, items: [], contacts: [] };
        }
      } catch {
        initial[t.id] = { teamId: t.id, items: [], contacts: [] };
      }
    }
    return initial;
  });

  // Fetch agents from server
  const loadAgents = async () => {
    try {
      const res = await fetch('/api/game/agents');
      if (res.ok) {
        const data = await res.json();
        if (data.agents && Array.isArray(data.agents) && data.agents.length > 0) {
          setAgents(data.agents);
        }
      }
    } catch (e) {
      console.warn('Failed to load agents from server, using local defaults:', e);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // Fetch inventory for active team from server and merge with localStorage
  const loadActiveTeamInventory = async (tId: TeamId) => {
    try {
      const res = await fetch(`/api/game/inventory/${tId}`);
      if (res.ok) {
        const serverInv = await res.json();
        setTeamInventories((prev) => {
          const current = prev[tId] || { teamId: tId, items: [], contacts: [] };
          // Merge unique items by id
          const itemsMap = new Map<string, InventoryItem>();
          for (const item of [...current.items, ...(serverInv.items || [])]) {
            itemsMap.set(item.id, item);
          }
          // Merge unique contacts by phoneClean
          const contactsMap = new Map<string, DiscoveredContact>();
          for (const contact of [...current.contacts, ...(serverInv.contacts || [])]) {
            contactsMap.set(contact.phoneClean, contact);
          }
          const merged: TeamInventory = {
            teamId: tId,
            items: Array.from(itemsMap.values()),
            contacts: Array.from(contactsMap.values()),
            petrovicApproved: Boolean(serverInv.petrovicApproved ?? current.petrovicApproved),
          };
          try {
            localStorage.setItem(`camp_inventory_${tId}`, JSON.stringify(merged));
          } catch {}
          return { ...prev, [tId]: merged };
        });
      }
    } catch (e) {
      console.warn('Failed to fetch team inventory from server:', e);
    }
  };

  useEffect(() => {
    if (activeTeamId) {
      loadActiveTeamInventory(activeTeamId);
    }
  }, [activeTeamId]);

  // Load chat messages for the active team from localStorage
  useEffect(() => {
    if (!activeTeamId) return;
    try {
      const storageKey = `camp_messages_${activeTeamId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setChatMessages(JSON.parse(saved));
      } else {
        // Initialize default welcome greeting for Eliška
        const eliskaAgent = agents.find((a) => a.id === 'eliska') || INITIAL_AGENTS[2];
        setChatMessages({
          eliska: [
            {
              id: 'eliska-greet',
              role: 'model',
              text: eliskaAgent.greeting,
              timestamp: new Date().toISOString(),
              agentId: 'eliska',
              teamId: activeTeamId,
            },
          ],
        });
      }
    } catch (e) {
      console.warn('Storage read error:', e);
    }
  }, [activeTeamId, agents]);

  // Save chat messages to localStorage per team
  const saveTeamMessages = (updated: Record<string, ChatMessage[]>) => {
    if (!activeTeamId) return;
    try {
      const storageKey = `camp_messages_${activeTeamId}`;
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {}
  };

  // Change team handler
  const handleSelectTeam = (teamId: TeamId) => {
    setActiveTeamId(teamId);
    try {
      localStorage.setItem('camp_active_team', teamId);
    } catch {}
  };

  // Unlock Item handler for active team
  const handleUnlockItem = (itemToUnlock: InventoryItem) => {
    if (!activeTeamId) return;
    const cleanId = itemToUnlock.id.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const known = KNOWN_ITEMS[cleanId];
    const fullItem: InventoryItem = {
      id: cleanId,
      name: itemToUnlock.name || (known ? known.name : cleanId),
      icon: itemToUnlock.icon || (known ? known.icon : '📦'),
      description: itemToUnlock.description || (known ? known.description : ''),
      unlockedAt: itemToUnlock.unlockedAt || new Date().toISOString(),
      sourceAgent: itemToUnlock.sourceAgent,
    };

    setTeamInventories((prev) => {
      const current = prev[activeTeamId] || { teamId: activeTeamId, items: [], contacts: [] };
      if (current.items.some((i) => i.id === cleanId || i.name.toLowerCase() === fullItem.name.toLowerCase())) {
        return prev;
      }
      const updated: TeamInventory = {
        ...current,
        items: [...current.items, fullItem],
      };
      try {
        localStorage.setItem(`camp_inventory_${activeTeamId}`, JSON.stringify(updated));
      } catch {}
      return { ...prev, [activeTeamId]: updated };
    });

    // Notify server asynchronously
    fetch(`/api/game/inventory/${activeTeamId}/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullItem),
    }).catch(() => {});
  };

  // Unlock Contact handler for active team
  const handleUnlockContact = (contactToUnlock: DiscoveredContact) => {
    if (!activeTeamId) return;
    const fullContact: DiscoveredContact = {
      phone: contactToUnlock.phone,
      phoneClean: contactToUnlock.phoneClean,
      name: contactToUnlock.name,
      type: contactToUnlock.type,
      unlockedAt: contactToUnlock.unlockedAt || new Date().toISOString(),
      sourceAgent: contactToUnlock.sourceAgent,
    };

    setTeamInventories((prev) => {
      const current = prev[activeTeamId] || { teamId: activeTeamId, items: [], contacts: [] };
      if (current.contacts.some((c) => c.phoneClean === fullContact.phoneClean)) {
        return prev;
      }
      const updated: TeamInventory = {
        ...current,
        contacts: [...current.contacts, fullContact],
      };
      try {
        localStorage.setItem(`camp_inventory_${activeTeamId}`, JSON.stringify(updated));
      } catch {}
      return { ...prev, [activeTeamId]: updated };
    });

    // Notify server asynchronously
    fetch(`/api/game/inventory/${activeTeamId}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullContact),
    }).catch(() => {});
  };

  // Delete Contact handler for active team
  const handleDeleteContact = (phoneClean: string) => {
    if (!activeTeamId) return;
    setTeamInventories((prev) => {
      const current = prev[activeTeamId] || { teamId: activeTeamId, items: [], contacts: [] };
      const updated: TeamInventory = {
        ...current,
        contacts: current.contacts.filter((c) => c.phoneClean !== phoneClean),
      };
      try {
        localStorage.setItem(`camp_inventory_${activeTeamId}`, JSON.stringify(updated));
      } catch {}
      return { ...prev, [activeTeamId]: updated };
    });

    fetch(`/api/game/inventory/${activeTeamId}/contact/${phoneClean}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  // Send SMS Message to a text agent
  const handleSendTextMessage = async (agentId: string, text: string) => {
    if (!activeTeamId) return;

    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
      agentId,
      teamId: activeTeamId,
    };

    const currentThread = chatMessages[agentId] || [];
    const newThread = [...currentThread, userMsg];

    const updatedMap = {
      ...chatMessages,
      [agentId]: newThread,
    };
    setChatMessages(updatedMap);
    saveTeamMessages(updatedMap);
    setIsTextLoading(true);

    try {
      const targetAgent = agents.find((a) => a.id === agentId);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agentId,
          phone: targetAgent?.phone,
          teamId: activeTeamId,
          messages: newThread.map((m) => ({ role: m.role, text: m.text })),
          includeAudio: false,
        }),
      });

      if (!res.ok) {
        throw new Error('Chyba spojenia');
      }

      const data = await res.json();

      // Check for unlocked items & contacts in text response
      if (Array.isArray(data.unlockedItems) && data.unlockedItems.length > 0) {
        for (const item of data.unlockedItems) {
          handleUnlockItem(item);
        }
      }
      if (Array.isArray(data.unlockedContacts) && data.unlockedContacts.length > 0) {
        for (const contact of data.unlockedContacts) {
          handleUnlockContact(contact);
        }
      }

      const modelReply: ChatMessage = {
        id: 'model_' + Date.now(),
        role: 'model',
        text: data.reply || 'Správa bola doručená.',
        timestamp: new Date().toISOString(),
        agentId,
        teamId: activeTeamId,
        isReward: data.questUnlocked,
      };

      const finalMap = {
        ...chatMessages,
        [agentId]: [...newThread, modelReply],
      };
      setChatMessages(finalMap);
      saveTeamMessages(finalMap);
    } catch (err) {
      console.warn('Text send error:', err);
      const errorMsg: ChatMessage = {
        id: 'err_' + Date.now(),
        role: 'model',
        text: '⚠️ Správu sa nepodarilo odoslať. Skontrolujte signál a skúste to znova.',
        timestamp: new Date().toISOString(),
        agentId,
        teamId: activeTeamId,
      };
      const finalMap = {
        ...chatMessages,
        [agentId]: [...newThread, errorMsg],
      };
      setChatMessages(finalMap);
      saveTeamMessages(finalMap);
    } finally {
      setIsTextLoading(false);
    }
  };

  const handleClearTextHistory = (agentId: string) => {
    const updated = {
      ...chatMessages,
      [agentId]: [],
    };
    setChatMessages(updated);
    saveTeamMessages(updated);
  };

  // Agent CRUD handlers
  const handleSaveAgent = async (agentToSave: AgentData) => {
    try {
      const res = await fetch('/api/game/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentToSave),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.agents) setAgents(data.agents);
      }
    } catch (e) {
      console.warn('Save agent error:', e);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      const res = await fetch(`/api/game/agents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.agents) setAgents(data.agents);
      }
    } catch (e) {
      console.warn('Delete agent error:', e);
    }
  };

  const handleResetAgents = async () => {
    try {
      const res = await fetch('/api/game/agents/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.agents) setAgents(data.agents);
      }
    } catch (e) {
      console.warn('Reset agents error:', e);
    }
  };

  // If no team is selected yet, show Team Select screen first
  if (!activeTeamId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <TeamSelectModal
          isOpen={true}
          activeTeamId={null}
          onSelectTeam={handleSelectTeam}
          canDismiss={false}
        />
      </div>
    );
  }

  const activeInventory = teamInventories[activeTeamId] || {
    teamId: activeTeamId,
    items: [],
    contacts: [],
  };

  return (
    <PhoneInterface
      activeTeamId={activeTeamId}
      onChangeTeam={handleSelectTeam}
      agents={agents}
      onSaveAgent={handleSaveAgent}
      onDeleteAgent={handleDeleteAgent}
      onResetAgents={handleResetAgents}
      chatMessages={chatMessages}
      onSendTextMessage={handleSendTextMessage}
      onClearTextHistory={handleClearTextHistory}
      isTextLoading={isTextLoading}
      inventory={activeInventory}
      onUnlockItem={handleUnlockItem}
      onUnlockContact={handleUnlockContact}
      onDeleteContact={handleDeleteContact}
    />
  );
}
