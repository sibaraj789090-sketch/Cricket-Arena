import React from 'react';
import { LudoColor } from '../../types';

interface LudoDiceProps {
  playerColor: LudoColor;
  playerName: string;
  diceValue: number | null;
  isActive: boolean;
  isRolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  disabled?: boolean;
  playerScore?: number;
  isLeader?: boolean;
}

export const LudoDice: React.FC<LudoDiceProps> = ({
  playerColor,
  playerName,
  diceValue,
  isActive,
  isRolling,
  canRoll,
  onRoll,
  disabled = false,
  playerScore,
  isLeader = false,
}) => {
  // Color configuration
  const colorStyles: Record<
    LudoColor,
    {
      dotColor: string;
      glowColor: string;
      activeBorder: string;
      badgeBg: string;
      badgeText: string;
    }
  > = {
    red: {
      dotColor: '#dc2626',
      glowColor: 'rgba(239, 68, 68, 0.65)',
      activeBorder: 'border-red-500',
      badgeBg: 'bg-red-500 text-white',
      badgeText: 'text-red-400',
    },
    green: {
      dotColor: '#16a34a',
      glowColor: 'rgba(34, 197, 94, 0.65)',
      activeBorder: 'border-emerald-500',
      badgeBg: 'bg-emerald-500 text-slate-950',
      badgeText: 'text-emerald-400',
    },
    yellow: {
      dotColor: '#d97706',
      glowColor: 'rgba(234, 179, 8, 0.65)',
      activeBorder: 'border-amber-400',
      badgeBg: 'bg-amber-400 text-slate-950',
      badgeText: 'text-amber-400',
    },
    blue: {
      dotColor: '#2563eb',
      glowColor: 'rgba(59, 130, 246, 0.65)',
      activeBorder: 'border-blue-500',
      badgeBg: 'bg-blue-500 text-white',
      badgeText: 'text-blue-400',
    },
  };

  const currentStyle = colorStyles[playerColor];

  // Render authentic 3D dice pips (1 to 6)
  const renderPips = (value: number | null) => {
    const dot = (key: string) => (
      <span
        key={key}
        className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shadow-inner block"
        style={{
          backgroundColor: currentStyle.dotColor,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.8)',
        }}
      />
    );

    const empty = (key: string) => <span key={key} className="w-2.5 h-2.5 sm:w-3 sm:h-3 block" />;

    // When value is null/idle
    if (!value || value < 1 || value > 6) {
      return (
        <div className="flex flex-col items-center justify-center text-slate-400">
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-dashed opacity-40"
            style={{ borderColor: currentStyle.dotColor }}
          />
        </div>
      );
    }

    switch (value) {
      case 1:
        return (
          <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1.5 items-center justify-items-center">
            {empty('1-1')} {empty('1-2')} {empty('1-3')}
            {empty('1-4')} {dot('1-center')} {empty('1-6')}
            {empty('1-7')} {empty('1-8')} {empty('1-9')}
          </div>
        );
      case 2:
        return (
          <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1.5 items-center justify-items-center">
            {dot('2-tr')} {empty('2-2')} {empty('2-3')}
            {empty('2-4')} {empty('2-5')} {empty('2-6')}
            {empty('2-7')} {empty('2-8')} {dot('2-bl')}
          </div>
        );
      case 3:
        return (
          <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1.5 items-center justify-items-center">
            {dot('3-tr')} {empty('3-2')} {empty('3-3')}
            {empty('3-4')} {dot('3-center')} {empty('3-6')}
            {empty('3-7')} {empty('3-8')} {dot('3-bl')}
          </div>
        );
      case 4:
        return (
          <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1.5 items-center justify-items-center">
            {dot('4-tl')} {empty('4-2')} {dot('4-tr')}
            {empty('4-4')} {empty('4-5')} {empty('4-6')}
            {dot('4-bl')} {empty('4-8')} {dot('4-br')}
          </div>
        );
      case 5:
        return (
          <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1.5 items-center justify-items-center">
            {dot('5-tl')} {empty('5-2')} {dot('5-tr')}
            {empty('5-4')} {dot('5-center')} {empty('5-6')}
            {dot('5-bl')} {empty('5-8')} {dot('5-br')}
          </div>
        );
      case 6:
        return (
          <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1.5 items-center justify-items-center">
            {dot('6-tl')} {empty('6-2')} {dot('6-tr')}
            {dot('6-ml')} {empty('6-5')} {dot('6-mr')}
            {dot('6-bl')} {empty('6-8')} {dot('6-br')}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* 3D Dice Container */}
      <button
        type="button"
        disabled={disabled || !canRoll || isRolling}
        onClick={onRoll}
        aria-label={`${playerName} roll dice`}
        style={{
          boxShadow: isActive
            ? `0 0 16px 3px ${currentStyle.glowColor}, 0 6px 12px rgba(0,0,0,0.5), inset 0 2px 2px rgba(255,255,255,0.9)`
            : '0 3px 6px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.6)',
        }}
        className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white via-slate-100 to-slate-200 border-2 flex items-center justify-center transition-all select-none ${
          disabled
            ? 'opacity-40 cursor-not-allowed border-slate-700 bg-slate-800'
            : isActive
            ? `${currentStyle.activeBorder} cursor-pointer scale-105 active:scale-95`
            : 'border-slate-300/80 opacity-70 cursor-default'
        } ${isRolling ? 'animate-spin scale-110' : ''}`}
      >
        {isRolling ? (
          <div className="font-mono text-xl font-black text-slate-800 animate-pulse">
            🎲
          </div>
        ) : (
          renderPips(diceValue)
        )}

        {/* Gloss highlight reflection */}
        <div className="absolute top-1 left-1.5 right-1.5 h-2 bg-gradient-to-b from-white/80 to-transparent rounded-t-xl pointer-events-none" />
      </button>

      {/* Prominent Tap to Roll Button / Badge */}
      {isActive && canRoll && !isRolling && !disabled && (
        <button
          onClick={onRoll}
          className={`mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-bounce shadow-md ${currentStyle.badgeBg}`}
        >
          ROLL!
        </button>
      )}

      {/* Rolling Status */}
      {isActive && isRolling && (
        <span className="mt-1.5 text-[10px] font-bold text-amber-300 animate-pulse">
          Rolling...
        </span>
      )}

      {/* Idle / Already Rolled Status */}
      {isActive && !canRoll && !isRolling && diceValue !== null && (
        <span className="mt-1.5 text-[10px] font-extrabold text-white bg-slate-900/90 px-2 py-0.5 rounded-full border border-slate-700">
          Rolled: {diceValue}
        </span>
      )}

      {/* Live Timer Ludo Score Pill */}
      {playerScore !== undefined && (
        <div
          className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono shadow-sm border ${
            isLeader
              ? 'bg-amber-400 text-slate-950 border-amber-300'
              : 'bg-slate-900/90 text-slate-200 border-slate-700'
          }`}
          title={`${playerName}: ${playerScore} points`}
        >
          {isLeader && <span>👑</span>}
          <span>{playerScore} pts</span>
        </div>
      )}
    </div>
  );
};
