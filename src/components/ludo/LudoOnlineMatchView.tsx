import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Trophy,
  Users,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  RotateCcw,
  Flag,
} from 'lucide-react';
import { LudoColor, LudoGameState } from '../../types';
import { LudoCashMatch, LudoOnlinePlayer } from '../../types/ludoCash';
import { LudoBoard } from './LudoBoard';
import { LudoDice } from './LudoDice';
import { playLudoSound, capitalize } from '../../lib/ludoEngine';
import { useAuth } from '../../context/AuthContext';
import { useWallet } from '../../context/WalletContext';
import { settle_table_winner } from './LudoServerActions';

interface LudoOnlineMatchViewProps {
  matchId: string;
  onExit: () => void;
}

export const LudoOnlineMatchView: React.FC<LudoOnlineMatchViewProps> = ({
  matchId,
  onExit,
}) => {
  const { user } = useAuth();
  const { settleGameReward } = useWallet();

  const [match, setMatch] = useState<LudoCashMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [hasSettledReward, setHasSettledReward] = useState(false);

  // Turn animation & client rolling state
  const [isRolling, setIsRolling] = useState(false);
  const [rollingPlayer, setRollingPlayer] = useState<LudoColor | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);

  // Sound helper
  const triggerSound = (type: 'dice' | 'move' | 'capture' | 'win' | 'six') => {
    if (soundEnabled) {
      playLudoSound(type);
    }
  };

  // Determine current user's color
  const myPlayer = match?.players.find((p) => p.userId === user?.id);
  const myColor: LudoColor | undefined = myPlayer?.color;

  // Poll authoritative match state from server
  const fetchMatchState = async () => {
    try {
      const res = await fetch(`/api/ludo/match/${matchId}/state`);
      if (res.ok) {
        const data = await res.json();
        if (data.match) {
          setMatch(data.match);
          setIsLoading(false);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || 'Match not found');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.warn('Match state poll error:', err);
    }
  };

  useEffect(() => {
    fetchMatchState();
    const interval = setInterval(fetchMatchState, 1200);
    return () => clearInterval(interval);
  }, [matchId]);

  // Turn timer countdown
  useEffect(() => {
    if (!match || match.status !== 'in_progress' || match.gameState.isGameOver) return;

    const timer = setInterval(() => {
      if (match.turnDeadline) {
        const diff = Math.max(0, Math.ceil((new Date(match.turnDeadline).getTime() - Date.now()) / 1000));
        setTimeLeft(diff);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [match]);

  // Handle Game Over settlement
  useEffect(() => {
    if (!match || match.status !== 'completed' || !match.gameState.isGameOver || hasSettledReward) return;

    if (user && match.winnerId === user.id) {
      // Current user WON the real cash prize!
      setHasSettledReward(true);
      triggerSound('win');
      settle_table_winner({
        winnerUserId: user.id,
        matchId: match.id,
        prizeAmount: match.prizeAmount,
        entryFee: match.entryFee,
        tableTitle: `₹${match.entryFee} (${match.playerCount}P)`,
      });
      settleGameReward(
        match.id,
        `₹${match.entryFee} (${match.playerCount}P)`,
        match.prizeAmount,
        match.entryFee
      );
    }
  }, [match, user, hasSettledReward, settleGameReward]);

  // Roll Dice Action
  const handleRollDice = async (color: LudoColor) => {
    if (!match || !user) return;
    if (match.gameState.currentTurn !== color) return;
    if (match.gameState.hasRolled || match.gameState.isGameOver || isRolling) return;

    // Check if player owns this color or if simulated
    if (color !== myColor && !(match.players.find((p) => p.color === color) as any)?.isSimulated) {
      return;
    }

    setIsRolling(true);
    setRollingPlayer(color);
    triggerSound('dice');

    try {
      const res = await fetch(`/api/ludo/match/${matchId}/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          color,
        }),
      });

      const data = await res.json();
      if (res.ok && data.match) {
        setMatch(data.match);
        if (data.roll === 6) {
          triggerSound('six');
        }
      } else {
        setErrorMsg(data.error || 'Failed to roll dice');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server');
    } finally {
      setIsRolling(false);
      setRollingPlayer(null);
    }
  };

  // Move Token Action
  const handleSelectToken = async (tokenId: number) => {
    if (!match || !user) return;
    const currentTurn = match.gameState.currentTurn;

    // Only allow token selection if it's user's turn and token is legal
    if (currentTurn !== myColor && !(match.players.find((p) => p.color === currentTurn) as any)?.isSimulated) {
      return;
    }

    if (!match.gameState.hasRolled || match.gameState.isGameOver) return;
    if (!match.gameState.highlightedTokenIds.includes(tokenId)) return;

    triggerSound('move');

    try {
      const res = await fetch(`/api/ludo/match/${matchId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          color: currentTurn,
          tokenId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.match) {
        setMatch(data.match);
      } else {
        setErrorMsg(data.error || 'Failed to move token');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server');
    }
  };

  // Forfeit / Leave Match
  const handleConfirmForfeit = async () => {
    if (!user) return;
    try {
      await fetch(`/api/ludo/match/${matchId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (err) {
      console.warn('Forfeit error:', err);
    } finally {
      setShowForfeitModal(false);
      onExit();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
        <h3 className="text-sm font-bold text-white">Connecting to Real Cash Table...</h3>
        <p className="text-xs text-slate-400">Verifying authoritative game state</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-white">Match Not Found</h3>
        <p className="text-xs text-slate-400">{errorMsg || 'This match has expired or ended.'}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
        >
          Return to Tables
        </button>
      </div>
    );
  }

  const { gameState } = match;
  const isMyTurn = gameState.currentTurn === myColor;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto pb-24 px-2 space-y-3">
      {/* Top Match Stakes Banner */}
      <div className="w-full bg-[#0a1128] rounded-2xl border border-blue-500/40 p-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForfeitModal(true)}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              title="Leave Match"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/40 flex items-center gap-1.5 animate-live-pulse shadow-sm shadow-emerald-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  LIVE ONLINE GAME
                </span>
                <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-950/80 px-1.5 py-0.2 rounded border border-blue-500/30">
                  {match.playerCount}P REAL CASH TABLE
                </span>
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-white">
                Entry: ₹{match.entryFee} • 1st Prize: <span className="text-emerald-400 font-mono font-black">₹{match.prizeAmount}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs ${
                soundEnabled
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Leave Match / Forfeit */}
            <button
              onClick={() => setShowForfeitModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 hover:bg-rose-950/80 text-[11px] font-bold flex items-center gap-1"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* Turn Status & Timer Bar */}
        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                gameState.currentTurn === 'red'
                  ? 'bg-rose-500'
                  : gameState.currentTurn === 'green'
                  ? 'bg-emerald-500'
                  : gameState.currentTurn === 'yellow'
                  ? 'bg-amber-400'
                  : 'bg-blue-500'
              } animate-ping`}
            />
            <span className="font-bold text-white">
              {isMyTurn ? '👉 YOUR TURN!' : `${capitalize(gameState.currentTurn)}'s Turn`}
            </span>
          </div>

          <div className="flex items-center gap-1 font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
            <Clock className="w-3 h-3" />
            <span>{timeLeft}s</span>
          </div>
        </div>
      </div>

      {/* Action text notification banner */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-center text-xs text-slate-300 font-medium shadow-sm">
        {gameState.lastActionText}
      </div>

      {/* ========================================================
          THE LUDO BOARD WITH 4 FIXED CORNER DICE SLOTS
          ======================================================== */}
      <div className="relative w-full max-w-[440px] aspect-square flex flex-col justify-between p-1 bg-[#050b1a] rounded-3xl border-2 border-blue-900/60 shadow-2xl">
        {/* TOP ROW: RED (Top-Left) and GREEN (Top-Right) Dice Slots */}
        <div className="flex items-center justify-between px-2 pt-1 z-20">
          {/* RED DICE SLOT */}
          <div className="flex flex-col items-center">
            {gameState.players.includes('red') && (
              <LudoDice
                playerColor="red"
                playerName={
                  match.players.find((p) => p.color === 'red')?.userName || 'Red Player'
                }
                diceValue={
                  gameState.currentTurn === 'red' && gameState.hasRolled
                    ? gameState.diceValue
                    : null
                }
                isActive={gameState.currentTurn === 'red'}
                isRolling={isRolling && rollingPlayer === 'red'}
                canRoll={
                  gameState.currentTurn === 'red' &&
                  !gameState.hasRolled &&
                  !gameState.isGameOver &&
                  (myColor === 'red' || (match.players.find((p) => p.color === 'red') as any)?.isSimulated)
                }
                onRoll={() => handleRollDice('red')}
              />
            )}
          </div>

          {/* GREEN DICE SLOT */}
          <div className="flex flex-col items-center">
            {gameState.players.includes('green') && (
              <LudoDice
                playerColor="green"
                playerName={
                  match.players.find((p) => p.color === 'green')?.userName || 'Green Player'
                }
                diceValue={
                  gameState.currentTurn === 'green' && gameState.hasRolled
                    ? gameState.diceValue
                    : null
                }
                isActive={gameState.currentTurn === 'green'}
                isRolling={isRolling && rollingPlayer === 'green'}
                canRoll={
                  gameState.currentTurn === 'green' &&
                  !gameState.hasRolled &&
                  !gameState.isGameOver &&
                  (myColor === 'green' || (match.players.find((p) => p.color === 'green') as any)?.isSimulated)
                }
                onRoll={() => handleRollDice('green')}
              />
            )}
          </div>
        </div>

        {/* CENTER: THE 15x15 LUDO BOARD */}
        <div className="relative flex-1 w-full my-1">
          <LudoBoard
            gameState={gameState}
            onSelectToken={handleSelectToken}
          />
        </div>

        {/* BOTTOM ROW: BLUE (Bottom-Left) and YELLOW (Bottom-Right) Dice Slots */}
        <div className="flex items-center justify-between px-2 pb-1 z-20">
          {/* BLUE DICE SLOT */}
          <div className="flex flex-col items-center">
            {gameState.players.includes('blue') && (
              <LudoDice
                playerColor="blue"
                playerName={
                  match.players.find((p) => p.color === 'blue')?.userName || 'Blue Player'
                }
                diceValue={
                  gameState.currentTurn === 'blue' && gameState.hasRolled
                    ? gameState.diceValue
                    : null
                }
                isActive={gameState.currentTurn === 'blue'}
                isRolling={isRolling && rollingPlayer === 'blue'}
                canRoll={
                  gameState.currentTurn === 'blue' &&
                  !gameState.hasRolled &&
                  !gameState.isGameOver &&
                  (myColor === 'blue' || (match.players.find((p) => p.color === 'blue') as any)?.isSimulated)
                }
                onRoll={() => handleRollDice('blue')}
              />
            )}
          </div>

          {/* YELLOW DICE SLOT */}
          <div className="flex flex-col items-center">
            {gameState.players.includes('yellow') && (
              <LudoDice
                playerColor="yellow"
                playerName={
                  match.players.find((p) => p.color === 'yellow')?.userName || 'Yellow Player'
                }
                diceValue={
                  gameState.currentTurn === 'yellow' && gameState.hasRolled
                    ? gameState.diceValue
                    : null
                }
                isActive={gameState.currentTurn === 'yellow'}
                isRolling={isRolling && rollingPlayer === 'yellow'}
                canRoll={
                  gameState.currentTurn === 'yellow' &&
                  !gameState.hasRolled &&
                  !gameState.isGameOver &&
                  (myColor === 'yellow' || (match.players.find((p) => p.color === 'yellow') as any)?.isSimulated)
                }
                onRoll={() => handleRollDice('yellow')}
              />
            )}
          </div>
        </div>
      </div>

      {/* Connected Players Status Bar */}
      <div className="w-full bg-slate-900/80 rounded-2xl border border-slate-800 p-3 flex items-center justify-around text-xs">
        {match.players.map((p) => {
          const isMe = p.userId === user?.id;
          const isTurn = gameState.currentTurn === p.color;

          return (
            <div
              key={p.userId}
              className={`flex flex-col items-center px-2 py-1 rounded-xl transition ${
                isTurn ? 'bg-slate-800 font-bold' : 'opacity-70'
              }`}
            >
              <div className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    p.color === 'red'
                      ? 'bg-rose-500'
                      : p.color === 'green'
                      ? 'bg-emerald-500'
                      : p.color === 'yellow'
                      ? 'bg-amber-400'
                      : 'bg-blue-500'
                  }`}
                />
                <span className="text-white text-[11px] truncate max-w-[80px]">
                  {p.userName} {isMe && '(You)'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                {capitalize(p.color)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ========================================================
          WINNER CELEBRATION MODAL (REAL CASH SETTLEMENT)
          ======================================================== */}
      {gameState.isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border-2 border-amber-500/60 p-6 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-3xl animate-bounce">
              🏆
            </div>

            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/40">
                MATCH COMPLETED
              </span>
              <h2 className="text-xl font-black text-white mt-1">
                {match.winnerId === user?.id ? '🎉 You Won!' : `${match.winnerName} Won!`}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {match.winnerId === user?.id
                  ? 'Congratulations! Your real cash prize has been credited to your wallet.'
                  : 'Better luck next match! Keep rolling and competing.'}
              </p>
            </div>

            {/* Winning Prize Display */}
            <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 uppercase font-bold">1st Prize Reward</span>
              <div className="font-mono text-2xl font-black text-emerald-400">
                ₹{match.prizeAmount.toLocaleString('en-IN')}
              </div>
              <p className="text-[10px] text-slate-500">
                Ref ID: LUDO-MATCH-{match.id}
              </p>
            </div>

            <button
              onClick={onExit}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition cursor-pointer"
            >
              Return to Tables Lobby
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          FORFEIT / LEAVE WARNING MODAL
          ======================================================== */}
      {showForfeitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-rose-500/50 p-5 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <Flag className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-white">Leave Active Table?</h3>
              <p className="text-xs text-slate-300 mt-1">
                If you leave now, you will forfeit this match and your entry fee (₹{match.entryFee}) will not be refunded.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowForfeitModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Continue Playing
              </button>
              <button
                onClick={handleConfirmForfeit}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg"
              >
                Forfeit &amp; Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
