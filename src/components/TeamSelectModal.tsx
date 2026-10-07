import React from 'react';
import { motion } from 'motion/react';
import { TEAMS_DATA } from '../data/teams';
import { TeamId } from '../types';

interface TeamSelectModalProps {
  isOpen: boolean;
  activeTeamId: TeamId | null;
  onSelectTeam: (teamId: TeamId) => void;
  canDismiss?: boolean;
  onClose?: () => void;
}

export const TeamSelectModal: React.FC<TeamSelectModalProps> = ({
  isOpen,
  activeTeamId,
  onSelectTeam,
  canDismiss = false,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl"
      >
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Vyberte družinku
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {TEAMS_DATA.map((team) => {
            const isSelected = activeTeamId === team.id;
            return (
              <button
                key={team.id}
                onClick={() => onSelectTeam(team.id)}
                className={`flex items-center justify-center py-4 px-3 rounded-2xl border text-sm font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-slate-800/80 border-slate-700/70 hover:bg-slate-750 hover:border-slate-600 text-slate-200'
                }`}
              >
                {team.name}
              </button>
            );
          })}
        </div>

        {canDismiss && onClose && (
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Zavrieť
          </button>
        )}
      </motion.div>
    </div>
  );
};
