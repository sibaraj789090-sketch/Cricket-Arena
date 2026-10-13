import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  X,
  Volume2,
  VolumeX,
  Music,
  Trophy,
  Users,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  RotateCcw,
  Flag,
  HelpCircle,
  Crown,
  ChevronRight,
  Info,
  CheckCircle2,
  Play,
  Home,
  Check,
  MessageSquare,
} from 'lucide-react';
import { LudoColor, LudoGameState } from '../../types';
import { LudoCashMatch, LudoOnlinePlayer, LudoFinalRanking, LudoQuickMessage } from '../../types/ludoCash';
import { LudoBoard } from './LudoBoard';
import { LudoDice } from './LudoDice';
import { LudoSimulationBanner } from './LudoSimulationBanner';
import { LudoQuickChatModal, LudoSpeechBubble } from './LudoQuickChat';
import { playLudoSound, capitalize } from '../../lib/ludoEngine';
import { ludoAudio } from '../../lib/ludoAudio';
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

  // Device orientation state (Portrait vs Landscape responsiveness)
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight;
  });

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Audio state
  const [masterSoundEnabled, setMasterSoundEnabled] = useState<boolean>(() => ludoAudio.isMasterSoundEnabled());
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(() => ludoAudio.isBgmEnabled());
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => ludoAudio.isSfxEnabled());

  // Menu and Modals state
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [showReturnLobbyConfirmModal, setShowReturnLobbyConfirmModal] = useState(false);
  const [showHowToPlayModal, setShowHowToPlayModal] = useState(false);
  const [showScoreBreakdownModal, setShowScoreBreakdownModal] = useState(false);
  const [hasSettledReward, setHasSettledReward] = useState(false);

  // Turn animation & client rolling state
  const [isRolling, setIsRolling] = useState(false);
  const [rollingPlayer, setRollingPlayer] = useState<LudoColor | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [matchTimeRemaining, setMatchTimeRemaining] = useState<number>(0);

  // Start Hindi background music on mount and pause on exit
  useEffect(() => {
    ludoAudio.startBgm();
    return () => {
      ludoAudio.pauseBgm();
    };
  }, []);

  const toggleMasterSound = () => {
    const next = !masterSoundEnabled;
    setMasterSoundEnabled(next);
    ludoAudio.setMasterSoundEnabled(next);
    setBgmEnabled(next);
    setSfxEnabled(next);
  };

  const toggleBgm = () => {
    const next = !bgmEnabled;
    setBgmEnabled(next);
    ludoAudio.setBgmEnabled(next);
    if (next && !masterSoundEnabled) {
      setMasterSoundEnabled(true);
    }
  };

  const toggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    ludoAudio.setSfxEnabled(next);
    if (next && !masterSoundEnabled) {
      setMasterSoundEnabled(true);
    }
  };

  // Quick Chat State
  const [showQuickChatModal, setShowQuickChatModal] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [activeBubbles, setActiveBubbles] = useState<Record<LudoColor, LudoQuickMessage | null>>({
    red: null,
    green: null,
    yellow: null,
    blue: null,
  });
  const [latestToastMessage, setLatestToastMessage] = useState<LudoQuickMessage | null>(null);
  const lastSeenMsgIdRef = useRef<string>('');

  // Sound helper using centralized audio manager
  const triggerSound = (type: 'dice' | 'move' | 'capture' | 'win' | 'six' | 'chat') => {
    ludoAudio.playSfx(type);
  };

  // Determine current user's color
  const myPlayer = match?.players.find((p) => p.userId === user?.id);
  const myColor: LudoColor | undefined = myPlayer?.color;

  // Listen for new chat messages from server state
  useEffect(() => {
    if (!match?.chatMessages || match.chatMessages.length === 0) return;
    const latest = match.chatMessages[match.chatMessages.length - 1];
    if (latest && latest.id !== lastSeenMsgIdRef.current) {
      const isInitialMount = lastSeenMsgIdRef.current === '';
      lastSeenMsgIdRef.current = latest.id;

      // Only show bubble & play audio if it was sent recently (last 6 seconds)
      const isRecent = Date.now() - latest.timestamp < 6000;
      if (isRecent) {
        setActiveBubbles((prev) => ({
          ...prev,
          [latest.senderColor]: latest,
        }));
        setLatestToastMessage(latest);

        if (!isInitialMount && latest.senderId !== user?.id) {
          triggerSound('chat');
          if (!showQuickChatModal) {
            setHasUnreadChat(true);
          }
        }

        const bubbleTimer = setTimeout(() => {
          setActiveBubbles((prev) => ({
            ...prev,
            [latest.senderColor]: null,
          }));
        }, 4000);

        const toastTimer = setTimeout(() => {
          setLatestToastMessage(null);
        }, 3500);

        return () => {
          clearTimeout(bubbleTimer);
          clearTimeout(toastTimer);
        };
      }
    }
  }, [match?.chatMessages, user?.id, showQuickChatModal]);

  // Send Quick Chat handler
  const handleSendQuickMessage = async (text: string) => {
    if (!match || !user || isSendingChat) return;
    setIsSendingChat(true);
    triggerSound('chat');

    // Optimistically show local bubble immediately
    if (myColor) {
      const optimisticMsg: LudoQuickMessage = {
        id: `opt-${Date.now()}`,
        senderId: user.id,
        senderName: user.name || 'You',
        senderColor: myColor,
        text,
        timestamp: Date.now(),
      };
      setActiveBubbles((prev) => ({
        ...prev,
        [myColor]: optimisticMsg,
      }));
      setLatestToastMessage(optimisticMsg);
      setTimeout(() => {
        setActiveBubbles((prev) => ({
          ...prev,
          [myColor]: null,
        }));
      }, 4000);
      setTimeout(() => {
        setLatestToastMessage(null);
      }, 3500);
    }

    try {
      const res = await fetch(`/api/ludo/match/${matchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          text,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.match) {
          setMatch(data.match);
        }
      }
    } catch (err) {
      console.warn('Failed to send quick chat:', err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Poll authoritative match state from server
  const fetchMatchState = async () => {
    try {
      const res = await fetch(`/api/ludo/match/${matchId}/state`);
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (res.ok && data?.match) {
        setMatch(data.match);
        setIsLoading(false);
      } else if (!res.ok) {
        setErrorMsg(data?.error || 'Match not found');
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

  // Authoritative Match Countdown Timer
  useEffect(() => {
    if (!match?.endsAt) {
      if (match?.timeRemainingSeconds !== undefined) {
        setMatchTimeRemaining(match.timeRemainingSeconds);
      }
      return;
    }

    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((new Date(match.endsAt!).getTime() - Date.now()) / 1000));
      setMatchTimeRemaining(diff);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [match?.endsAt, match?.timeRemainingSeconds]);

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

    if ((match as any).isSimulation) {
      setHasSettledReward(true);
      triggerSound('win');
      return;
    }

    if (user && match.winnerId === user.id) {
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

  // Forfeit / Leave Match Action
  const handleConfirmLeave = async () => {
    if (!user) return;
    try {
      await fetch(`/api/ludo/match/${matchId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (err) {
      console.warn('Leave match error:', err);
    } finally {
      setShowLeaveConfirmModal(false);
      setShowGameMenu(false);
      onExit();
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#070b14] text-white">
        <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
        <h3 className="text-sm font-bold text-white">Loading Full-Screen Ludo Arena...</h3>
        <p className="text-xs text-slate-400">Synchronizing game board and player turn clock</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#070b14] text-white">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-white">Match Not Found</h3>
        <p className="text-xs text-slate-400">{errorMsg || 'This match has expired or ended.'}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-md"
        >
          Return to Tables
        </button>
      </div>
    );
  }

  const { gameState } = match;
  const isMyTurn = gameState.currentTurn === myColor;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sortedPlayers = [...match.players].sort((a, b) => {
    const scoreA = gameState.scores?.[a.color] ?? a.score ?? 0;
    const scoreB = gameState.scores?.[b.color] ?? b.score ?? 0;
    return scoreB - scoreA;
  });

  const leadingScore = sortedPlayers[0] ? (gameState.scores?.[sortedPlayers[0].color] ?? sortedPlayers[0].score ?? 0) : 0;

  const renderPlayerDiceSlot = (color: LudoColor) => {
    if (!gameState.players.includes(color)) {
      return <div className="w-12 h-12 sm:w-16 sm:h-16 opacity-0 pointer-events-none" />;
    }

    const player = match.players.find((p) => p.color === color);
    const playerName = player?.userName.replace(' [BOT]', '') || `${capitalize(color)} Player`;
    const playerScore = gameState.scores?.[color] ?? player?.score ?? 0;
    const isLeader = playerScore > 0 && playerScore === leadingScore;
    const isActive = gameState.currentTurn === color;
    const canRoll =
      isActive &&
      !gameState.hasRolled &&
      !gameState.isGameOver &&
      (myColor === color || (player as any)?.isSimulated);

    const bubblePosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' =
      color === 'red'
        ? 'top-left'
        : color === 'green'
        ? 'top-right'
        : color === 'blue'
        ? 'bottom-left'
        : 'bottom-right';

    return (
      <div className="relative flex flex-col items-center justify-center">
        <LudoSpeechBubble
          message={activeBubbles[color]}
          position={bubblePosition}
        />
        <LudoDice
          playerColor={color}
          playerName={playerName}
          playerScore={playerScore}
          isLeader={isLeader}
          diceValue={
            gameState.currentTurn === color && gameState.hasRolled
              ? gameState.diceValue
              : null
          }
          isActive={isActive}
          isRolling={isRolling && rollingPlayer === color}
          canRoll={canRoll}
          onRoll={() => handleRollDice(color)}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-full flex flex-col justify-between overflow-hidden bg-[#070b14] text-slate-100 select-none touch-manipulation pl-safe pr-safe">
      {/* QA Simulation Notice Banner */}
      {(match as any).isSimulation && (
        <div className="shrink-0 w-full">
          <LudoSimulationBanner
            simulatedOutcome={(match as any).simulatedOutcome}
            testTokenStake={(match as any).testTokenStake || 50}
          />
        </div>
      )}

      {/* ========================================================
          1. COMPACT TOP APP BAR (NO FULL WEBSITE HEADER OVERLAP)
          ======================================================== */}
      <header className="shrink-0 w-full bg-[#0a1128]/95 backdrop-blur-md border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between z-30 shadow-lg">
        {/* Left: Table Stake info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-500/40">
                {match.playerCount}P LUDO
              </span>
              <span className="font-mono text-xs font-black text-white truncate">
                Entry ₹{match.entryFee}
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 font-mono">
              1st Prize: ₹{match.prizeAmount}
            </span>
          </div>
        </div>

        {/* Center: Authoritative Match Countdown Timer & Turn Indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Match Countdown Clock */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border font-mono font-black text-xs sm:text-sm ${
              matchTimeRemaining <= 30
                ? 'bg-rose-950/90 text-rose-300 border-rose-500/60 animate-pulse'
                : matchTimeRemaining <= 120
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                : 'bg-slate-900/90 text-emerald-300 border-emerald-500/40'
            }`}
            title="Authoritative Match Timer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTime(matchTimeRemaining)}</span>
          </div>

          {/* Turn Timer */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900/80 border border-slate-700 text-amber-400 font-mono text-xs font-bold"
            title="Turn Timeout"
          >
            <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">Turn:</span>
            <span>{timeLeft}s</span>
          </div>
        </div>

        {/* Right: Quick Chat, Sound Quick-Toggle and Three-Line Hamburger Menu (☰) */}
        <div className="flex items-center gap-1.5">
          {/* Quick Chat Button (💬) */}
          <button
            type="button"
            onClick={() => {
              setShowQuickChatModal(true);
              setHasUnreadChat(false);
            }}
            aria-label="Open Quick Chat"
            className="relative p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 hover:text-white transition cursor-pointer flex items-center justify-center shadow"
            title="Send Quick Message (Good luck, Nice move!)"
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            {hasUnreadChat && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0a1128] animate-pulse" />
            )}
          </button>

          {/* Audio BGM & Sound Quick-Toggle */}
          <button
            type="button"
            onClick={toggleBgm}
            className={`p-1.5 sm:p-2 rounded-xl border text-xs cursor-pointer transition ${
              bgmEnabled
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title={bgmEnabled ? 'Hindi BGM: Playing (Tap to mute)' : 'Hindi BGM: Muted (Tap to unmute)'}
          >
            {bgmEnabled ? <Music className="w-4 h-4 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* THREE-LINE HAMBURGER MENU BUTTON (☰) */}
          <button
            type="button"
            onClick={() => setShowGameMenu(true)}
            aria-label="Open Game Menu"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 hover:text-white transition cursor-pointer flex items-center justify-center shadow"
          >
            <Menu className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* ========================================================
          2. PLAYERS LIVE SCORE CHIPS (SUB-HEADER BAR)
          ======================================================== */}
      <div className="shrink-0 w-full px-2 py-1 bg-slate-950/80 border-b border-slate-900 flex items-center justify-around gap-1 z-20">
        {match.players.map((p) => {
          const isMe = p.userId === user?.id;
          const isTurn = gameState.currentTurn === p.color;
          const score = gameState.scores?.[p.color] ?? p.score ?? 0;
          const isLeader = score > 0 && score === leadingScore;

          return (
            <div
              key={p.userId}
              className={`flex-1 flex flex-col items-center py-0.5 px-1 rounded-lg transition ${
                isTurn
                  ? 'bg-slate-800/90 border border-slate-700 shadow-sm'
                  : 'opacity-80'
              }`}
            >
              <div className="flex items-center gap-1 max-w-full">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    p.color === 'red'
                      ? 'bg-rose-500'
                      : p.color === 'green'
                      ? 'bg-emerald-500'
                      : p.color === 'yellow'
                      ? 'bg-amber-400'
                      : 'bg-blue-500'
                  }`}
                />
                <span className="text-[10px] sm:text-[11px] font-bold text-white truncate max-w-[55px] sm:max-w-[70px]">
                  {p.userName.replace(' [BOT]', '')}
                </span>
                {isLeader && <span className="text-[10px]">👑</span>}
              </div>
              <span className="font-mono text-[10px] sm:text-[11px] font-black text-amber-400">
                {score} pts
              </span>
            </div>
          );
        })}
      </div>

      {/* ========================================================
          3. MAIN RESPONSIVE GAMEPLAY BOARD CONTAINER
          Automatically fits within mobile screen without cropping
          ======================================================== */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-1 overflow-hidden relative">
        {/* Subtle Non-Intrusive Quick Chat Toast */}
        {latestToastMessage && (
          <div className="absolute top-2 z-30 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/95 border border-amber-500/40 shadow-xl backdrop-blur-md animate-fadeIn text-xs">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                latestToastMessage.senderColor === 'red'
                  ? 'bg-rose-500'
                  : latestToastMessage.senderColor === 'green'
                  ? 'bg-emerald-500'
                  : latestToastMessage.senderColor === 'yellow'
                  ? 'bg-amber-400'
                  : 'bg-blue-500'
              }`}
            />
            <span className="font-bold text-amber-300 truncate max-w-[80px]">
              {latestToastMessage.senderName}:
            </span>
            <span className="font-bold text-white truncate max-w-[150px]">
              "{latestToastMessage.text}"
            </span>
          </div>
        )}

        {/* PORTRAIT ORIENTATION */}
        {!isLandscape && (
          <div className="flex-1 w-full flex flex-col items-center justify-between py-1 px-1 overflow-hidden my-auto">
            {/* TOP ROW: RED (Top-Left) and GREEN (Top-Right) Corner Dice Slots */}
            <div className="w-full max-w-[min(96vw,calc(100dvh-200px))] flex items-center justify-between px-2 shrink-0 z-20">
              {renderPlayerDiceSlot('red')}
              {renderPlayerDiceSlot('green')}
            </div>

            {/* CENTER: THE 15x15 LUDO BOARD GRID */}
            <div className="relative w-full flex-1 flex items-center justify-center p-0.5 overflow-hidden my-auto">
              <div
                className="w-full aspect-square flex items-center justify-center"
                style={{
                  maxWidth: 'min(96vw, calc(100dvh - 200px))',
                  maxHeight: 'min(96vw, calc(100dvh - 200px))',
                }}
              >
                <LudoBoard
                  gameState={gameState}
                  onSelectToken={handleSelectToken}
                  className="w-full h-full aspect-square"
                />
              </div>
            </div>

            {/* BOTTOM ROW: BLUE (Bottom-Left) and YELLOW (Bottom-Right) Corner Dice Slots */}
            <div className="w-full max-w-[min(96vw,calc(100dvh-200px))] flex items-center justify-between px-2 shrink-0 z-20">
              {renderPlayerDiceSlot('blue')}
              {renderPlayerDiceSlot('yellow')}
            </div>
          </div>
        )}

        {/* LANDSCAPE ORIENTATION */}
        {isLandscape && (
          <div className="flex-1 w-full flex flex-row items-center justify-center px-3 py-1 gap-3 sm:gap-6 overflow-hidden h-[calc(100dvh-46px)] my-auto">
            {/* LEFT COLUMN: RED (top-left) & BLUE (bottom-left) */}
            <div className="w-28 sm:w-32 flex flex-col justify-around items-center h-full py-1 shrink-0 z-20">
              {renderPlayerDiceSlot('red')}
              {renderPlayerDiceSlot('blue')}
            </div>

            {/* CENTER: THE 15x15 LUDO BOARD GRID (Maximized square filling height without cropping) */}
            <div className="relative flex items-center justify-center h-full aspect-square max-h-[calc(100dvh-50px)] max-w-[calc(100dvh-50px)] overflow-hidden shrink-0">
              <LudoBoard
                gameState={gameState}
                onSelectToken={handleSelectToken}
                className="w-full h-full aspect-square"
              />
            </div>

            {/* RIGHT COLUMN: GREEN (top-right) & YELLOW (bottom-right) */}
            <div className="w-28 sm:w-32 flex flex-col justify-around items-center h-full py-1 shrink-0 z-20">
              {renderPlayerDiceSlot('green')}
              {renderPlayerDiceSlot('yellow')}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          4. BOTTOM STATUS TICKER & ACTION BAR
          ======================================================== */}
      <footer className="shrink-0 w-full bg-[#0a1128]/95 border-t border-slate-800 px-3 py-1.5 flex items-center justify-between text-xs z-30 pb-safe">
        <div className="flex items-center gap-1.5 truncate max-w-[70vw]">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              gameState.currentTurn === 'red'
                ? 'bg-rose-500'
                : gameState.currentTurn === 'green'
                ? 'bg-emerald-500'
                : gameState.currentTurn === 'yellow'
                ? 'bg-amber-400'
                : 'bg-blue-500'
            } animate-ping`}
          />
          <span className="font-bold text-white text-[11px] truncate">
            {isMyTurn ? '👉 YOUR TURN!' : `${capitalize(gameState.currentTurn)}'s Turn`} •{' '}
            <span className="text-slate-400 font-normal">{gameState.lastActionText}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowScoreBreakdownModal(true)}
          className="text-[10px] font-bold text-amber-400 bg-amber-950/60 hover:bg-amber-950 px-2.5 py-1 rounded-lg border border-amber-500/40 flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Trophy className="w-3 h-3 text-amber-400" />
          <span>Scoreboard</span>
        </button>
      </footer>

      {/* ========================================================
          5. THREE-LINE HAMBURGER MENU MODAL (☰)
          Contains: Resume Game, Return to Lobby, Leave Match,
          Sound Effects ON/OFF, Hindi BGM ON/OFF, How to Play
          ======================================================== */}
      {showGameMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-amber-500/50 p-5 w-full max-w-sm shadow-2xl space-y-4 text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <Menu className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white">Game Menu</h3>
                  <p className="text-[10px] text-slate-400">
                    Table #{match.tableId} • ₹{match.entryFee} Entry
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGameMenu(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Close Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Options List */}
            <div className="space-y-2 text-xs">
              {/* Option 1: Resume Game */}
              <button
                type="button"
                onClick={() => setShowGameMenu(false)}
                className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center justify-between transition cursor-pointer shadow"
              >
                <span className="flex items-center gap-2">
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Resume Game</span>
                </span>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>

              {/* Option 1b: Quick Messages */}
              <button
                type="button"
                onClick={() => {
                  setShowGameMenu(false);
                  setShowQuickChatModal(true);
                  setHasUnreadChat(false);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-2 text-slate-200">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span>Quick Messages (Chat)</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              {/* Option 2: Return to Lobby */}
              <button
                type="button"
                onClick={() => {
                  setShowGameMenu(false);
                  setShowReturnLobbyConfirmModal(true);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-2 text-slate-200">
                  <Home className="w-4 h-4 text-blue-400" />
                  <span>Return to Lobby</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              {/* Option 3: Leave Match */}
              <button
                type="button"
                onClick={() => {
                  setShowGameMenu(false);
                  setShowLeaveConfirmModal(true);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-rose-400" />
                  <span>Leave Match (Forfeit)</span>
                </span>
                <ChevronRight className="w-4 h-4 text-rose-400/60" />
              </button>

              {/* Option 4: Sound: ON/OFF */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                {/* Primary Master Sound Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-700/80">
                  <div className="flex items-center gap-2">
                    {masterSoundEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-500" />
                    )}
                    <div>
                      <span className="font-bold text-white block leading-tight">Sound: {masterSoundEnabled ? 'ON' : 'OFF'}</span>
                      <span className="text-[10px] text-slate-400">Master sound toggle</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleMasterSound}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer border ${
                      masterSoundEnabled
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {masterSoundEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Sub-controls: Hindi BGM and SFX */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {/* Hindi BGM */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800/80">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-semibold text-slate-300 truncate">Hindi BGM</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleBgm}
                      className={`px-2 py-0.5 rounded text-[10px] font-black border transition cursor-pointer ${
                        bgmEnabled
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {bgmEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Sound SFX */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800/80">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-semibold text-slate-300 truncate">SFX Effects</span>
                    </div>
                    <button
                      type="button"
                      onClick={toggleSfx}
                      className={`px-2 py-0.5 rounded text-[10px] font-black border transition cursor-pointer ${
                        sfxEnabled
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {sfxEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 5: How to Play */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowGameMenu(false);
                    setShowHowToPlayModal(true);
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-cyan-400" />
                    <span>How to Play &amp; Scoring</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowGameMenu(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              Back to Game
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          6. MODAL: CONFIRM RETURN TO LOBBY
          ======================================================== */}
      {showReturnLobbyConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-blue-500/50 p-5 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mx-auto text-blue-400">
              <Home className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-white">Return to Tables Lobby?</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Your match is still in progress. If you return to the lobby now, you may forfeit your turn or match if you do not resume in time.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowReturnLobbyConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Stay in Match
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReturnLobbyConfirmModal(false);
                  onExit();
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg cursor-pointer"
              >
                Go to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          7. MODAL: CONFIRM LEAVE / FORFEIT MATCH
          ======================================================== */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-rose-500/60 p-5 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <Flag className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-white">Leave Active Match?</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Leaving this active match will forfeit the game to your opponent. Your entry fee of{' '}
                <strong className="text-amber-400">₹{match.entryFee}</strong> will not be refunded.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg cursor-pointer"
              >
                Forfeit &amp; Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          8. MODAL: HOW TO PLAY & SCORING RULES
          ======================================================== */}
      {showHowToPlayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-amber-500/50 p-5 w-full max-w-sm shadow-2xl space-y-4 text-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Timer Ludo — Rules &amp; Scoring
              </h3>
              <button
                type="button"
                onClick={() => setShowHowToPlayModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 space-y-1">
                <span className="font-black text-amber-300 block">🏆 Highest Score Wins</span>
                <p className="text-[11px] text-slate-300">
                  When the {match.durationMinutes || (match.playerCount === 2 ? 10 : 15)}-minute timer reaches 00:00, the game stops immediately and the player with the highest total score wins the prize!
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-white text-[11px]">How Points are Earned:</span>
                <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                  <li><strong>Dice Roll:</strong> 1 to 6 points added for each valid roll.</li>
                  <li><strong>Capture Opponent:</strong> Transfers all points recorded on the victim's token directly to the captor!</li>
                  <li><strong>Reaching Home:</strong> +60 points instant home bonus per token.</li>
                  <li><strong>Captured Tokens:</strong> Score deducted from victim and reset to 0 in yard.</li>
                </ul>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 block text-[11px]">⚖️ Deterministic Tie-Breaker:</span>
                <p className="text-[11px] text-slate-200 font-mono">
                  {match.tieBreakerRule || 'Hierarchy: 1) Highest Score ➔ 2) Most Home Tokens ➔ 3) Most Captures ➔ 4) Fewest Timeouts'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHowToPlayModal(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          9. MODAL: LIVE SCOREBOARD / SCORE BREAKDOWN
          ======================================================== */}
      {showScoreBreakdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-blue-500/50 p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-emerald-400" />
                Live Standings &amp; Breakdown
              </h3>
              <button
                type="button"
                onClick={() => setShowScoreBreakdownModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {sortedPlayers.map((p, idx) => {
                const score = gameState.scores?.[p.color] ?? p.score ?? 0;
                const homeCount = gameState.tokens[p.color]?.filter((t) => t.step === 56).length || 0;
                const bd = p.scoreBreakdown;

                return (
                  <div
                    key={p.userId}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-amber-400 w-4">
                          #{idx + 1}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            p.color === 'red'
                              ? 'bg-rose-500'
                              : p.color === 'green'
                              ? 'bg-emerald-500'
                              : p.color === 'yellow'
                              ? 'bg-amber-400'
                              : 'bg-blue-500'
                          }`}
                        />
                        <span className="font-bold text-white truncate max-w-[120px]">
                          {p.userName.replace(' [BOT]', '')}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-black text-emerald-400">
                        {score} pts
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-400 text-center pt-1 border-t border-slate-800/80">
                      <div className="bg-slate-950 p-1 rounded">
                        <span>Dice</span>
                        <div className="font-mono text-white font-bold">+{bd?.dicePoints || 0}</div>
                      </div>
                      <div className="bg-slate-950 p-1 rounded">
                        <span>Captures</span>
                        <div className="font-mono text-emerald-400 font-bold">+{bd?.capturePoints || 0}</div>
                      </div>
                      <div className="bg-slate-950 p-1 rounded">
                        <span>Home</span>
                        <div className="font-mono text-amber-400 font-bold">+{bd?.homeBonuses || 0} ({homeCount})</div>
                      </div>
                      <div className="bg-slate-950 p-1 rounded">
                        <span>Lost</span>
                        <div className="font-mono text-rose-400 font-bold">-{bd?.lostInCaptures || 0}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowScoreBreakdownModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Close Scoreboard
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          10. FINAL WINNER CELEBRATION & COMPLETE SCORE BREAKDOWN
          ======================================================== */}
      {gameState.isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border-2 border-amber-500/60 p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-center max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-3xl animate-bounce">
              🏆
            </div>

            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-950 px-2.5 py-0.5 rounded border border-amber-500/40">
                {(match as any).isSimulation ? 'QA SIMULATION COMPLETE' : 'TIMER LUDO FINISHED'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                {match.winnerId === user?.id ? '🎉 You Won!' : `${match.winnerName} Won!`}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Highest Score Wins • Duration: {match.durationMinutes || (match.playerCount === 2 ? 10 : 15)} Minutes
              </p>
            </div>

            {/* Winning Prize Display */}
            {!(match as any).isSimulation && (
              <div className="bg-slate-950/90 rounded-2xl p-3 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold">1st Place Real Cash Prize</span>
                <div className="font-mono text-2xl font-black text-emerald-400">
                  ₹{match.prizeAmount.toLocaleString('en-IN')}
                </div>
                <p className="text-[10px] text-slate-500">
                  Ref ID: TIMER-LUDO-{match.id}
                </p>
              </div>
            )}

            {/* Complete Final Ranked Scoreboard with Breakdown */}
            <div className="space-y-2 text-left">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Final Standings &amp; Score Breakdown
              </h4>

              <div className="space-y-1.5">
                {(match.finalRankings || sortedPlayers.map((p, idx) => ({
                  rank: idx + 1,
                  userId: p.userId,
                  userName: p.userName,
                  color: p.color,
                  score: gameState.scores?.[p.color] ?? p.score ?? 0,
                  tokensHomeCount: gameState.tokens[p.color]?.filter((t) => t.step === 56).length || 0,
                  capturesCount: p.scoreBreakdown?.capturesCount || 0,
                  timeoutsCount: p.timeoutCount || 0,
                  prizeWon: idx === 0 ? match.prizeAmount : 0,
                  isWinner: idx === 0,
                  scoreBreakdown: p.scoreBreakdown || {
                    dicePoints: 0,
                    capturePoints: 0,
                    homeBonuses: 0,
                    lostInCaptures: 0,
                    totalScore: p.score || 0,
                    tokensHomeCount: 0,
                    capturesCount: 0,
                  },
                }))).map((r: LudoFinalRanking) => {
                  const isUser = r.userId === user?.id;

                  return (
                    <div
                      key={r.userId}
                      className={`p-2.5 rounded-2xl border text-xs space-y-1.5 ${
                        r.rank === 1
                          ? 'bg-amber-950/30 border-amber-500/50'
                          : isUser
                          ? 'bg-blue-950/30 border-blue-500/40'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-black text-[11px] ${
                            r.rank === 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {r.rank}
                          </span>
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              r.color === 'red'
                                ? 'bg-rose-500'
                                : r.color === 'green'
                                ? 'bg-emerald-500'
                                : r.color === 'yellow'
                                ? 'bg-amber-400'
                                : 'bg-blue-500'
                            }`}
                          />
                          <span className="font-bold text-white">
                            {r.userName.replace(' [BOT]', '')} {isUser && '(You)'}
                          </span>
                          {r.rank === 1 && <span>👑</span>}
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-sm font-black text-amber-400">
                            {r.score} pts
                          </span>
                          {r.prizeWon > 0 && !(match as any).isSimulation && (
                            <span className="block text-[10px] text-emerald-400 font-bold font-mono">
                              +₹{r.prizeWon}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detailed Score Breakdown */}
                      <div className="grid grid-cols-4 gap-1 text-[10px] text-slate-400 text-center bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80">
                        <div>
                          <span className="block text-slate-500">Dice</span>
                          <span className="font-mono text-white font-bold">+{r.scoreBreakdown?.dicePoints || 0}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500">Captures</span>
                          <span className="font-mono text-emerald-400 font-bold">+{r.scoreBreakdown?.capturePoints || 0}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500">Home (+60)</span>
                          <span className="font-mono text-amber-400 font-bold">+{r.scoreBreakdown?.homeBonuses || 0}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500">Lost</span>
                          <span className="font-mono text-rose-400 font-bold">-{r.scoreBreakdown?.lostInCaptures || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Deterministic tie-breaker notice */}
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400">
                <span className="font-bold text-amber-400">Tie-Breaker Rule:</span>{' '}
                {match.tieBreakerRule || 'Hierarchy: 1) Highest Score ➔ 2) Most Home Tokens ➔ 3) Most Captures ➔ 4) Fewest Timeouts'}
              </div>
            </div>

            <button
              type="button"
              onClick={onExit}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition cursor-pointer"
            >
              Return to Tables Lobby
            </button>
          </div>
        </div>
      )}

      {/* 11. QUICK CHAT MODAL */}
      <LudoQuickChatModal
        isOpen={showQuickChatModal}
        onClose={() => setShowQuickChatModal(false)}
        onSend={handleSendQuickMessage}
        recentMessages={match.chatMessages || []}
        currentUserId={user?.id}
        isSending={isSendingChat}
      />
    </div>
  );
};
