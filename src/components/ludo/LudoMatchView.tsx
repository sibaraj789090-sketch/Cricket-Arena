import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  ArrowLeft,
  Volume2,
  VolumeX,
  Trophy,
  Users,
  Shield,
  HelpCircle,
  Sparkles,
  Info,
} from 'lucide-react';
import { LudoColor, LudoGameState } from '../../types';
import {
  createInitialLudoGame,
  getLegalMoves,
  getNextPlayer,
  capitalize,
  playLudoSound,
  getGlobalTrackIndex,
  SAFE_CELL_INDICES,
} from '../../lib/ludoEngine';
import { LudoBoard } from './LudoBoard';
import { LudoDice } from './LudoDice';

interface LudoMatchViewProps {
  onExit: () => void;
}

export const LudoMatchView: React.FC<LudoMatchViewProps> = ({ onExit }) => {
  const [playerCount, setPlayerCount] = useState<2 | 4>(4);
  const [gameState, setGameState] = useState<LudoGameState>(() => createInitialLudoGame(4));
  const [isRolling, setIsRolling] = useState(false);
  const [rollingPlayer, setRollingPlayer] = useState<LudoColor | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Individual persistent dice values for all 4 players
  const [playerDiceValues, setPlayerDiceValues] = useState<Record<LudoColor, number | null>>({
    red: null,
    green: null,
    yellow: null,
    blue: null,
  });

  // Sound trigger helper
  const triggerSound = (type: 'dice' | 'move' | 'capture' | 'win' | 'six') => {
    if (soundEnabled) {
      playLudoSound(type);
    }
  };

  // Start new game or switch between 2 and 4 players
  const handleStartGame = (count: 2 | 4) => {
    setPlayerCount(count);
    setGameState(createInitialLudoGame(count));
    setPlayerDiceValues({
      red: null,
      green: null,
      yellow: null,
      blue: null,
    });
    setIsRolling(false);
    setRollingPlayer(null);
    triggerSound('move');
  };

  // Dedicated roll handler for a specific player's dice slot
  const handleRollDice = (color: LudoColor) => {
    // Only allow rolling if it's currently this player's turn and they haven't rolled yet
    if (gameState.currentTurn !== color) return;
    if (gameState.hasRolled || gameState.isGameOver || isRolling) return;
    if (!gameState.players.includes(color)) return;

    setIsRolling(true);
    setRollingPlayer(color);
    triggerSound('dice');

    setTimeout(() => {
      // Generate genuine random 1 to 6
      const roll = Math.floor(Math.random() * 6) + 1;
      setIsRolling(false);
      setRollingPlayer(null);

      // Update that player's fixed dice slot
      setPlayerDiceValues((prev) => ({
        ...prev,
        [color]: roll,
      }));

      if (roll === 6) {
        triggerSound('six');
      }

      // Check for 3 consecutive sixes penalty
      const newConsecutiveSixes = roll === 6 ? gameState.consecutiveSixes + 1 : 0;
      if (newConsecutiveSixes >= 3) {
        // Penalty: Turn forfeited
        const nextColor = getNextPlayer(gameState.currentTurn, gameState.players, gameState.winners);
        setGameState((prev) => ({
          ...prev,
          diceValue: roll,
          hasRolled: false,
          consecutiveSixes: 0,
          currentTurn: nextColor,
          highlightedTokenIds: [],
          lastActionText: `⚠️ 3 consecutive 6s! ${capitalize(
            prev.currentTurn
          )} forfeits turn. Now ${capitalize(nextColor)}'s turn.`,
        }));
        return;
      }

      // Calculate legal moves for this player with this roll
      const legalTokenIds = getLegalMoves(gameState.tokens, color, roll);

      if (legalTokenIds.length === 0) {
        // No moves possible -> show prompt and pass turn after brief pause
        setGameState((prev) => ({
          ...prev,
          diceValue: roll,
          hasRolled: true,
          consecutiveSixes: newConsecutiveSixes,
          highlightedTokenIds: [],
          lastActionText: `${capitalize(color)} rolled a ${roll}. No moves available!`,
        }));

        setTimeout(() => {
          setGameState((prev) => {
            const nextColor = getNextPlayer(prev.currentTurn, prev.players, prev.winners);
            return {
              ...prev,
              diceValue: null,
              hasRolled: false,
              currentTurn: nextColor,
              highlightedTokenIds: [],
              lastActionText: `Turn passed to ${capitalize(nextColor)}. Roll your dice!`,
            };
          });
        }, 1100);
      } else {
        // Moves available -> highlight legal tokens on the board
        setGameState((prev) => ({
          ...prev,
          diceValue: roll,
          hasRolled: true,
          consecutiveSixes: newConsecutiveSixes,
          highlightedTokenIds: legalTokenIds,
          lastActionText: `${capitalize(color)} rolled a ${roll}! Tap a glowing token to move.`,
        }));
      }
    }, 450);
  };

  // Move Token Handler when user taps a highlighted token on the board
  const handleSelectToken = (tokenId: number) => {
    if (!gameState.hasRolled || gameState.diceValue === null) return;
    if (!gameState.highlightedTokenIds.includes(tokenId)) return;

    const roll = gameState.diceValue;
    const color = gameState.currentTurn;
    const playerTokens = [...gameState.tokens[color]];
    const token = { ...playerTokens[tokenId] };

    let awardExtraTurn = roll === 6;
    let actionDescription = '';

    if (token.step === -1) {
      // Exit yard to start square
      token.step = 0;
      actionDescription = `${capitalize(color)} entered track with Token #${tokenId + 1}!`;
      triggerSound('move');
    } else {
      // Advance token on track or home stretch
      token.step += roll;
      triggerSound('move');

      // Check if token reached Home triangle
      if (token.step === 56) {
        awardExtraTurn = true;
        actionDescription = `🎉 ${capitalize(color)}'s Token #${tokenId + 1} reached HOME! Extra turn!`;
        triggerSound('win');
      } else {
        actionDescription = `${capitalize(color)} moved Token #${tokenId + 1} (${roll} squares).`;
      }
    }

    playerTokens[tokenId] = token;

    // Check Capture if on main perimeter track (steps 0..50)
    const updatedAllTokens = { ...gameState.tokens, [color]: playerTokens };

    if (token.step >= 0 && token.step <= 50) {
      const myGlobalIdx = getGlobalTrackIndex(color, token.step)!;

      // Safe square check
      if (!SAFE_CELL_INDICES.has(myGlobalIdx)) {
        // Check all opponent tokens on this square
        (Object.keys(updatedAllTokens) as LudoColor[]).forEach((oppColor) => {
          if (oppColor !== color) {
            updatedAllTokens[oppColor] = updatedAllTokens[oppColor].map((oppTok) => {
              if (oppTok.step >= 0 && oppTok.step <= 50) {
                const oppGlobalIdx = getGlobalTrackIndex(oppColor, oppTok.step);
                if (oppGlobalIdx === myGlobalIdx) {
                  // Capture! Send back to yard
                  awardExtraTurn = true;
                  actionDescription = `💥 ${capitalize(color)} captured ${capitalize(
                    oppColor
                  )}'s token! Extra turn awarded!`;
                  triggerSound('capture');
                  return { ...oppTok, step: -1 };
                }
              }
              return oppTok;
            });
          }
        });
      }
    }

    // Check Victory condition: all 4 tokens in Home (step 56)
    const allHome = playerTokens.every((t) => t.step === 56);
    const updatedWinners = [...gameState.winners];
    let isOver = false;

    if (allHome && !updatedWinners.includes(color)) {
      updatedWinners.push(color);
      actionDescription = `🏆 ${capitalize(color).toUpperCase()} HAS WON THE MATCH!`;
      triggerSound('win');
      isOver = true;
    }

    // Determine next turn
    let nextPlayer = color;
    if (!awardExtraTurn && !isOver) {
      nextPlayer = getNextPlayer(color, gameState.players, updatedWinners);
      actionDescription += ` Next: ${capitalize(nextPlayer)}.`;
    } else if (awardExtraTurn && !isOver) {
      actionDescription += ` ${capitalize(color)} gets an extra turn!`;
    }

    setGameState({
      ...gameState,
      tokens: updatedAllTokens,
      diceValue: null,
      hasRolled: false,
      currentTurn: isOver ? color : nextPlayer,
      winners: updatedWinners,
      isGameOver: isOver,
      lastActionText: actionDescription,
      extraTurn: awardExtraTurn,
      highlightedTokenIds: [],
    });
  };

  // Color theme definitions for player cards
  const playerCardConfig: Record<
    LudoColor,
    {
      name: string;
      bg: string;
      activeGlow: string;
      activeBorder: string;
      textColor: string;
      badgeColor: string;
    }
  > = {
    red: {
      name: 'Player 1 (Red)',
      bg: 'bg-rose-950/40',
      activeGlow: 'shadow-[0_0_20px_rgba(225,29,72,0.5)]',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/50',
      textColor: 'text-rose-400',
      badgeColor: 'bg-rose-600 text-white',
    },
    green: {
      name: 'Player 2 (Green)',
      bg: 'bg-emerald-950/40',
      activeGlow: 'shadow-[0_0_20px_rgba(22,163,74,0.5)]',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/50',
      textColor: 'text-emerald-400',
      badgeColor: 'bg-emerald-600 text-slate-950 font-bold',
    },
    yellow: {
      name: 'Player 3 (Yellow)',
      bg: 'bg-amber-950/40',
      activeGlow: 'shadow-[0_0_20px_rgba(234,179,8,0.5)]',
      activeBorder: 'border-amber-400 ring-2 ring-amber-400/50',
      textColor: 'text-amber-400',
      badgeColor: 'bg-amber-400 text-slate-950 font-bold',
    },
    blue: {
      name: 'Player 4 (Blue)',
      bg: 'bg-blue-950/40',
      activeGlow: 'shadow-[0_0_20px_rgba(37,99,235,0.5)]',
      activeBorder: 'border-blue-500 ring-2 ring-blue-500/50',
      textColor: 'text-blue-400',
      badgeColor: 'bg-blue-600 text-white',
    },
  };

  // Renders a player's card with their name, status, home tokens, and their dedicated dice slot
  const renderPlayerPanel = (color: LudoColor) => {
    const isParticipating = gameState.players.includes(color);
    const isCurrent = gameState.currentTurn === color && isParticipating && !gameState.isGameOver;
    const isRollingThis = isRolling && rollingPlayer === color;
    const canRollThis = isCurrent && !gameState.hasRolled && !isRolling;
    const config = playerCardConfig[color];

    const homeTokensCount = gameState.tokens[color].filter((t) => t.step === 56).length;

    return (
      <div
        key={`panel-${color}`}
        className={`relative p-2.5 rounded-2xl border transition-all duration-300 flex items-center justify-between backdrop-blur-md ${
          !isParticipating
            ? 'opacity-30 border-slate-800 bg-slate-950/40 cursor-not-allowed'
            : isCurrent
            ? `${config.bg} ${config.activeBorder} ${config.activeGlow} scale-[1.02] z-20`
            : 'border-slate-800/80 bg-[#0d172e]/60 opacity-85'
        }`}
      >
        {/* Left: Player Info & Progress */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                color === 'red'
                  ? 'bg-rose-500'
                  : color === 'green'
                  ? 'bg-emerald-500'
                  : color === 'yellow'
                  ? 'bg-amber-400'
                  : 'bg-blue-500'
              } ${isCurrent ? 'animate-pulse ring-2 ring-white/70' : ''}`}
            />
            <h3 className="text-xs font-black text-white truncate">{config.name}</h3>
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            {isParticipating ? (
              <>
                <span className="text-slate-400">Home:</span>
                <span className={`font-mono font-bold ${config.textColor}`}>
                  {homeTokensCount}/4
                </span>
                <span className="text-slate-500 text-[10px]">🏁</span>
              </>
            ) : (
              <span className="text-slate-500 text-[10px] uppercase font-bold">
                Inactive (2P Mode)
              </span>
            )}
          </div>

          {/* Turn status indicator */}
          {isCurrent && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-white/20 text-white animate-pulse">
                {canRollThis ? 'Your Turn' : 'Move Token'}
              </span>
            </div>
          )}
        </div>

        {/* Right: Player's Own Dedicated Dice Slot */}
        <div className="shrink-0 pl-1">
          <LudoDice
            playerColor={color}
            playerName={config.name}
            diceValue={playerDiceValues[color]}
            isActive={isCurrent}
            isRolling={isRollingThis}
            canRoll={canRollThis}
            onRoll={() => handleRollDice(color)}
            disabled={!isParticipating || !isCurrent}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2.5 max-w-md mx-auto select-none">
      {/* Top Header & Game Mode Controls */}
      <div className="bg-gradient-to-r from-[#0b162c] via-[#0e1d3a] to-[#0b162c] rounded-2xl border border-blue-900/50 p-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
            title="Exit to Arena"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-white tracking-wide">Ludo Match</h2>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-bold uppercase">
                Pass &amp; Play
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {playerCount} Players • Dedicated Corner Dice
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white transition"
            title={soundEnabled ? 'Mute Sounds' : 'Enable Sounds'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Rules Modal */}
          <button
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white transition"
            title="Ludo Rules"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
          </button>

          {/* Restart */}
          <button
            onClick={() => handleStartGame(playerCount)}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition"
            title="Restart Match"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2-Player or 4-Player Mode Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => handleStartGame(2)}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            playerCount === 2
              ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 shadow-lg font-black'
              : 'bg-[#0b162c] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>2 Players (Red vs Yellow)</span>
        </button>
        <button
          onClick={() => handleStartGame(4)}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            playerCount === 4
              ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-slate-950 shadow-lg font-black'
              : 'bg-[#0b162c] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>4 Players (Full Arena)</span>
        </button>
      </div>

      {/* Blue Game Stage Container */}
      <div className="bg-gradient-to-b from-[#09142e] via-[#060e22] to-[#040916] rounded-3xl border border-blue-900/60 p-2.5 sm:p-3 shadow-2xl space-y-2.5">
        {/* ==========================================
            TOP ROW: RED (Left) & GREEN (Right)
            ========================================== */}
        <div className="grid grid-cols-2 gap-2">
          {renderPlayerPanel('red')}
          {renderPlayerPanel('green')}
        </div>

        {/* ==========================================
            CENTER: TRADITIONAL FULL LUDO BOARD
            ========================================== */}
        <div className="relative">
          <LudoBoard gameState={gameState} onSelectToken={handleSelectToken} />

          {/* Action announcement floating ticker */}
          <div className="mt-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md flex items-center justify-between text-xs shadow-md">
            <span className="text-slate-200 font-medium truncate">
              {gameState.lastActionText}
            </span>
            {gameState.consecutiveSixes > 0 && (
              <span className="text-amber-400 font-mono font-bold shrink-0 ml-1.5">
                🔥 6s: {gameState.consecutiveSixes}
              </span>
            )}
          </div>
        </div>

        {/* ==========================================
            BOTTOM ROW: BLUE (Left) & YELLOW (Right)
            ========================================== */}
        <div className="grid grid-cols-2 gap-2">
          {renderPlayerPanel('blue')}
          {renderPlayerPanel('yellow')}
        </div>
      </div>

      {/* Victory Announcement Banner */}
      {gameState.isGameOver && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-2 border-amber-500/80 p-5 rounded-3xl shadow-2xl text-center space-y-2 animate-bounce">
          <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-base font-black text-white uppercase tracking-wider">
            🎉 MATCH COMPLETED!
          </h3>
          <p className="text-xs text-amber-300 font-bold">
            Player {capitalize(gameState.winners[0])} has won the Ludo Match!
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <button
              onClick={() => handleStartGame(playerCount)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition shadow-lg"
            >
              Play Again
            </button>
            <button
              onClick={onExit}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
            >
              Back to Arena
            </button>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b162c] border border-blue-800/80 rounded-2xl p-5 max-w-sm w-full text-slate-100 shadow-2xl text-xs space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Ludo Match Rules (Pass &amp; Play)
            </h3>
            <ul className="space-y-1.5 text-slate-300 list-disc list-inside leading-relaxed text-[11px]">
              <li>
                <strong>Entering Track:</strong> Roll a <strong>6</strong> on your corner dice to
                move a token from your yard into the game track.
              </li>
              <li>
                <strong>Corner Dice:</strong> Each player has their own fixed dice slot. Only the
                active player&apos;s dice will roll when tapped.
              </li>
              <li>
                <strong>Extra Turns:</strong> Rolling a 6, capturing an opponent token, or reaching
                Home awards an immediate extra turn!
              </li>
              <li>
                <strong>Safe Squares:</strong> Star squares and colored starting squares are 100%
                safe; tokens cannot be captured there.
              </li>
              <li>
                <strong>Capture:</strong> Landing on an opponent token on a non-safe square captures
                it and sends it back to their yard.
              </li>
              <li>
                <strong>Home Triangle:</strong> Tokens enter their colored path; exact roll is
                required to enter Home.
              </li>
              <li>
                <strong>3 Consecutive Sixes:</strong> Forfeits that player&apos;s turn.
              </li>
              <li>
                <strong>100% Free:</strong> No money, no gambling, purely recreational board game!
              </li>
            </ul>
            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs mt-2"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
