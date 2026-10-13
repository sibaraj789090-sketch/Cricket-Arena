import React from 'react';
import { Player, CricketTeam } from '../../types';

interface PitchViewProps {
  selectedPlayers: Player[];
  teams: CricketTeam[];
  captainId: string;
  viceCaptainId: string;
  onRemovePlayer?: (playerId: string) => void;
  onSelectCaptain?: (playerId: string) => void;
  onSelectViceCaptain?: (playerId: string) => void;
}

export const PitchView: React.FC<PitchViewProps> = ({
  selectedPlayers,
  teams,
  captainId,
  viceCaptainId,
  onRemovePlayer,
}) => {
  const wkPlayers = selectedPlayers.filter((p) => p.role === 'WK');
  const batPlayers = selectedPlayers.filter((p) => p.role === 'BAT');
  const arPlayers = selectedPlayers.filter((p) => p.role === 'AR');
  const bowlPlayers = selectedPlayers.filter((p) => p.role === 'BOWL');

  const getTeamCode = (teamId: string) => {
    return teams.find((t) => t.id === teamId)?.code || '';
  };

  const renderPlayerBadge = (player: Player) => {
    const isCap = player.id === captainId;
    const isVC = player.id === viceCaptainId;
    const teamCode = getTeamCode(player.teamId);

    return (
      <div
        key={player.id}
        className="relative group flex flex-col items-center justify-center transition-transform hover:scale-110 active:scale-95"
      >
        {/* Role & C/VC Badges */}
        <div className="absolute -top-2 z-10 flex gap-0.5">
          {isCap && (
            <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1 rounded shadow-md border border-white">
              C (2x)
            </span>
          )}
          {isVC && (
            <span className="bg-blue-400 text-slate-950 text-[9px] font-black px-1 rounded shadow-md border border-white">
              VC (1.5x)
            </span>
          )}
        </div>

        {/* Player Avatar */}
        <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full p-0.5 bg-gradient-to-b from-slate-200 to-slate-400 shadow-lg">
          <img
            src={player.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'}
            alt={player.name}
            className="w-full h-full rounded-full object-cover"
          />
          {onRemovePlayer && (
            <button
              onClick={() => onRemovePlayer(player.id)}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
              title="Remove player"
            >
              ×
            </button>
          )}
        </div>

        {/* Name Plate */}
        <div className="bg-slate-950/90 border border-slate-700/80 px-1.5 py-0.5 rounded text-center mt-0.5 max-w-[70px] shadow">
          <p className="text-[10px] font-bold text-white truncate leading-none">
            {player.name.split(' ').slice(-1)[0]}
          </p>
          <p className="text-[9px] text-emerald-400 font-semibold leading-none mt-0.5">
            {teamCode} • {player.credits}Cr
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-emerald-900/50 shadow-2xl bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-950 p-3 sm:p-4 text-white min-h-[360px] flex flex-col justify-between">
      {/* Stadium grass pitch lines */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
      
      {/* Center 22-yard pitch strip */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-48 sm:w-32 sm:h-56 bg-amber-100/10 border border-amber-200/20 rounded-lg pointer-events-none" />

      {/* 1. Wicket Keepers Row */}
      <div className="relative z-10">
        <p className="text-[10px] uppercase font-bold text-emerald-300 text-center mb-1 tracking-wider opacity-80">
          WICKET-KEEPERS ({wkPlayers.length})
        </p>
        <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
          {wkPlayers.length > 0 ? (
            wkPlayers.map(renderPlayerBadge)
          ) : (
            <p className="text-[10px] text-emerald-200/50 italic">No WK selected</p>
          )}
        </div>
      </div>

      {/* 2. Batters Row */}
      <div className="relative z-10 my-1">
        <p className="text-[10px] uppercase font-bold text-emerald-300 text-center mb-1 tracking-wider opacity-80">
          BATTERS ({batPlayers.length})
        </p>
        <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
          {batPlayers.length > 0 ? (
            batPlayers.map(renderPlayerBadge)
          ) : (
            <p className="text-[10px] text-emerald-200/50 italic">No Batters selected</p>
          )}
        </div>
      </div>

      {/* 3. All-Rounders Row */}
      <div className="relative z-10 my-1">
        <p className="text-[10px] uppercase font-bold text-emerald-300 text-center mb-1 tracking-wider opacity-80">
          ALL-ROUNDERS ({arPlayers.length})
        </p>
        <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
          {arPlayers.length > 0 ? (
            arPlayers.map(renderPlayerBadge)
          ) : (
            <p className="text-[10px] text-emerald-200/50 italic">No All-Rounders selected</p>
          )}
        </div>
      </div>

      {/* 4. Bowlers Row */}
      <div className="relative z-10">
        <p className="text-[10px] uppercase font-bold text-emerald-300 text-center mb-1 tracking-wider opacity-80">
          BOWLERS ({bowlPlayers.length})
        </p>
        <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
          {bowlPlayers.length > 0 ? (
            bowlPlayers.map(renderPlayerBadge)
          ) : (
            <p className="text-[10px] text-emerald-200/50 italic">No Bowlers selected</p>
          )}
        </div>
      </div>
    </div>
  );
};
