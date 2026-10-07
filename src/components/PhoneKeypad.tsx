import React, { useEffect } from 'react';
import { Phone, Delete, UserPlus, Check } from 'lucide-react';
import { playDtmfTone, unlockAudioContext } from '../utils/audio';
import { formatPhone, normalizePhone } from '../data/agents';
import { AgentData } from '../types';

interface PhoneKeypadProps {
  dialedNumber: string;
  onChangeNumber: (val: string) => void;
  onCall: (num: string) => void;
  onMessage: (num: string) => void;
  onSaveNumber?: (num: string) => void;
  isSavedNumber?: boolean;
  agents: AgentData[];
}

const KEYS = [
  { char: '1', letters: '' },
  { char: '2', letters: 'ABC' },
  { char: '3', letters: 'DEF' },
  { char: '4', letters: 'GHI' },
  { char: '5', letters: 'JKL' },
  { char: '6', letters: 'MNO' },
  { char: '7', letters: 'PQRS' },
  { char: '8', letters: 'TUV' },
  { char: '9', letters: 'WXYZ' },
  { char: '*', letters: '' },
  { char: '0', letters: '+' },
  { char: '#', letters: '' },
];

export const PhoneKeypad: React.FC<PhoneKeypadProps> = ({
  dialedNumber,
  onChangeNumber,
  onCall,
  onMessage,
  onSaveNumber,
  isSavedNumber,
  agents,
}) => {
  const clean = normalizePhone(dialedNumber);
  const matchedAgent = agents.find((a) => a.phoneClean === clean);
  const isVoiceOnly = matchedAgent?.type === 'voice';
  const isTextOnly = matchedAgent?.type === 'text';

  const handleKeyPress = (char: string) => {
    unlockAudioContext();
    playDtmfTone(char);
    if (dialedNumber.length < 16) {
      onChangeNumber(dialedNumber + char);
    }
  };

  const handleBackspace = () => {
    if (dialedNumber.length > 0) {
      onChangeNumber(dialedNumber.slice(0, -1));
    }
  };

  const handleClear = () => {
    onChangeNumber('');
  };

  const handlePrimaryAction = () => {
    if (!dialedNumber.trim()) return;
    onCall(dialedNumber);
  };

  // Keyboard support for typing numbers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (/^[0-9*#]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter' && dialedNumber.trim()) {
        handlePrimaryAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialedNumber]);

  return (
    <div className="flex flex-col items-center justify-between w-full max-w-sm mx-auto px-4 py-2 select-none">
      {/* Number Display */}
      <div className="w-full flex flex-col items-center justify-center min-h-[68px] sm:min-h-[76px] mb-3 px-2">
        <div className="w-full text-center truncate font-mono text-3xl sm:text-4xl font-semibold tracking-wider text-slate-100 min-h-[44px] flex items-center justify-center">
          {dialedNumber ? (
            formatPhone(dialedNumber)
          ) : (
            <span className="text-slate-600 font-sans text-lg sm:text-xl font-normal">
              Zadajte číslo...
            </span>
          )}
        </div>
        {dialedNumber && (
          <div className="text-[11px] text-slate-500 mt-0.5">
            {clean.length} číslic
          </div>
        )}
      </div>

      {/* 3x4 Telephone Keypad */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-[280px] mb-6">
        {KEYS.map((k) => (
          <button
            key={k.char}
            type="button"
            onClick={() => handleKeyPress(k.char)}
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-white flex flex-col items-center justify-center border border-slate-700/60 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <span className="text-2xl sm:text-3xl font-medium leading-none">
              {k.char}
            </span>
            {k.letters && (
              <span className="text-[9px] font-bold tracking-widest text-slate-400 mt-1 uppercase">
                {k.letters}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Action Buttons: Spacer / Call / Backspace */}
      <div className="grid grid-cols-3 items-center w-full max-w-[280px]">
        {/* Left: Save Number to Contacts or Spacer */}
        <div className="flex justify-center">
          {dialedNumber.trim() ? (
            <button
              type="button"
              onClick={() => onSaveNumber?.(dialedNumber)}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer border ${
                isSavedNumber
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-sky-400 hover:text-sky-300 shadow-md'
              }`}
              title={isSavedNumber ? 'Číslo je už v batohu' : 'Uložiť číslo do batohu'}
            >
              {isSavedNumber ? <Check className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              <span className="text-[8px] font-bold tracking-tight mt-0.5">
                {isSavedNumber ? 'V BATOHU' : 'ULOŽIŤ'}
              </span>
            </button>
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14" />
          )}
        </div>

        {/* Center: Primary Big Green Call Button */}
        <div className="flex justify-center">
          <button
            type="button"
            disabled={!dialedNumber.trim()}
            onClick={() => onCall(dialedNumber)}
            className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer ${
              dialedNumber.trim()
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
            }`}
            title="Vytočiť hovor"
          >
            <Phone className="w-7 h-7 fill-current" />
          </button>
        </div>

        {/* Right: Backspace button */}
        <div className="flex justify-center">
          {dialedNumber ? (
            <button
              type="button"
              onClick={handleBackspace}
              onContextMenu={(e) => {
                e.preventDefault();
                handleClear();
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
              title="Zmazať číslicu (podrž pre zmazanie všetkého)"
            >
              <Delete className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14" />
          )}
        </div>
      </div>
    </div>
  );
};
