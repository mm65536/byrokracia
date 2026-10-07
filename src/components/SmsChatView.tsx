import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Send,
  ArrowLeft,
  Trash2,
  Phone,
  UserPlus,
  Check,
} from 'lucide-react';
import { AgentData, ChatMessage, TeamId } from '../types';
import { formatPhone } from '../data/agents';

interface SmsChatViewProps {
  agent: AgentData;
  activeTeamId: TeamId;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClearHistory: () => void;
  onBackToKeypad: () => void;
  isLoading: boolean;
  isSavedContact?: boolean;
  onSaveContact?: () => void;
}

export const SmsChatView: React.FC<SmsChatViewProps> = ({
  agent,
  messages,
  onSendMessage,
  onClearHistory,
  onBackToKeypad,
  isLoading,
  isSavedContact = false,
  onSaveContact,
}) => {
  const [inputText, setInputText] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSave = () => {
    if (onSaveContact) {
      onSaveContact();
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 2500);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    await onSendMessage(text);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToKeypad}
            className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title="Späť na číselník"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs text-slate-400 hidden sm:inline">Späť</span>
          </button>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg sm:text-xl shadow-inner shrink-0">
            {agent.avatarEmoji || '💬'}
          </div>

          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-white leading-tight truncate">
              {agent.name}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
              {formatPhone(agent.phone)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Save contact button */}
          {isSavedContact ? (
            <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] sm:text-xs font-semibold">
              <Check className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Uložený</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 hover:text-white text-[11px] sm:text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Uložiť tento kontakt do batohu"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Uložiť kontakt</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearHistory}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
            title="Vymazať správy"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {savedBanner && (
        <div className="bg-emerald-500/20 border-b border-emerald-500/40 px-4 py-1.5 text-center text-xs font-medium text-emerald-300 animate-fadeIn">
          ✅ Kontakt {agent.name} bol úspešne uložený do batohu!
        </div>
      )}

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs text-center py-10">
            <div>Žiadne predchádzajúce správy.</div>
            <div className="text-[11px] text-slate-600 mt-1">Napíšte správu a začnite konverzáciu.</div>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-sky-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                }`}
              >
                <div>{m.text}</div>
              </div>
            </motion.div>
          );
        })}

        {isLoading && (
          <div className="flex items-start">
            <div className="bg-slate-800 text-slate-400 px-4 py-2.5 rounded-2xl rounded-bl-none border border-slate-700/60 text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Napíšte SMS správu..."
          disabled={isLoading}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="p-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md active:scale-95 transition-all cursor-pointer"
          title="Odoslať správu"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
