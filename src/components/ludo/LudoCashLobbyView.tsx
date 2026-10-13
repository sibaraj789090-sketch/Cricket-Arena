import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Users,
  Coins,
  ShieldCheck,
  Play,
  ArrowRight,
  Clock,
  Sparkles,
  AlertCircle,
  X,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  History,
  Zap,
  Crown,
  Gamepad2,
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { useAuth } from '../../context/AuthContext';
import { LudoCashTable, LudoCashMatchRecord } from '../../types/ludoCash';
import {
  join_table,
  verifyUserCashBalance,
  refund_table_entry,
} from './LudoServerActions';
import { AdminDataStore } from '../../lib/adminDataStore';
import { LudoRecentWinnersMarquee, LudoRecentWinnersSection } from './LudoRecentWinnersMarquee';

interface LudoCashLobbyViewProps {
  onJoinMatch: (matchId: string) => void;
  onOpenTopUp: () => void;
}

export const LudoCashLobbyView: React.FC<LudoCashLobbyViewProps> = ({
  onJoinMatch,
  onOpenTopUp,
}) => {
  const { wallet, refreshWallet, reserveGameEntry, refundGameEntry } = useWallet();
  const { user } = useAuth();

  const [tables, setTables] = useState<LudoCashTable[]>([]);
  const [selectedModeFilter, setSelectedModeFilter] = useState<'all' | '2' | '4'>('all');
  const [activeTab, setActiveTab] = useState<'tables' | 'history' | 'winners'>('tables');
  const [matchHistory, setMatchHistory] = useState<LudoCashMatchRecord[]>([]);

  // Joining & Confirmation flow
  const [tableToConfirm, setTableToConfirm] = useState<LudoCashTable | null>(null);
  const [insufficientBalanceTable, setInsufficientBalanceTable] = useState<LudoCashTable | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // In-Queue Waiting Modal State
  const [activeQueueTable, setActiveQueueTable] = useState<LudoCashTable | null>(null);
  const [waitingInfo, setWaitingInfo] = useState<{
    queuePosition: number;
    totalWaiting: number;
    needed: number;
  } | null>(null);
  const [isSimulatingBot, setIsSimulatingBot] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);

  // Fetch Tables from Server
  const fetchTables = async () => {
    try {
      const res = await fetch('/api/ludo/tables');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tables)) {
          setTables(data.tables);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch cash tables:', err);
    }
  };

  // Fetch Match History
  const fetchHistory = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/ludo/history/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.records)) {
          setMatchHistory(data.records);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchHistory();
    const interval = setInterval(fetchTables, 3000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle Poll while Waiting in Queue
  useEffect(() => {
    if (!activeQueueTable || !user) return;

    let isMounted = true;
    const pollQueue = async () => {
      try {
        const res = await fetch(
          `/api/ludo/queue/status?tableId=${activeQueueTable.id}&userId=${user.id}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;

          if (data.inMatch && data.matchId) {
            // Match is ready!
            setActiveQueueTable(null);
            setWaitingInfo(null);
            onJoinMatch(data.matchId);
          } else if (data.inQueue) {
            setWaitingInfo({
              queuePosition: data.queuePosition,
              totalWaiting: data.waitingCount,
              needed: data.needed,
            });
          }
        }
      } catch (err) {
        console.warn('Queue poll error:', err);
      }
    };

    pollQueue();
    const queueInterval = setInterval(pollQueue, 1500);
    return () => {
      isMounted = false;
      clearInterval(queueInterval);
    };
  }, [activeQueueTable, user, onJoinMatch]);

  // Click on "Join Table" - Pre-verifies balance using authoritative server action
  const handleInitiateJoin = async (table: LudoCashTable) => {
    setQueueError(null);
    if (!user) return;

    // Check if table is active
    if (!table.isActive) {
      setQueueError('This table is currently disabled by administration. Please select an active table.');
      return;
    }

    // Check if user is banned or restricted from Ludo
    const banCheck = AdminDataStore.isUserBanned(user.id, 'ludo');
    if (banCheck.banned) {
      setQueueError(`Access Denied: Your account is currently restricted from cash tables (${banCheck.reason || 'Restricted by admin'}).`);
      return;
    }

    // Authoritative balance verification
    const balanceCheck = await verifyUserCashBalance(user.id, table.entryFee);
    if (!balanceCheck.hasEnough) {
      setInsufficientBalanceTable(table);
      return;
    }
    setTableToConfirm(table);
  };

  // Confirm and Join Table Queue
  const handleConfirmJoin = async () => {
    if (!tableToConfirm || !user) return;
    setIsJoining(true);
    setQueueError(null);

    const matchIdTemp = `queue_${tableToConfirm.id}_${Date.now()}`;

    // 1. Authoritative 'join_table' action:
    // Reserves the entry fee in the database only after confirming sufficient coins,
    // utilizing database-level constraints to eliminate race conditions.
    const reserveRes = await join_table({
      userId: user.id,
      userName: user.name,
      tableId: tableToConfirm.id,
      tableTitle: `₹${tableToConfirm.entryFee} (${tableToConfirm.mode}P)`,
      entryFee: tableToConfirm.entryFee,
      matchId: matchIdTemp,
    });

    if (!reserveRes.success) {
      setIsJoining(false);
      setQueueError(reserveRes.error || 'Failed to lock entry fee.');
      setTableToConfirm(null);
      return;
    }

    await refreshWallet();

    // 2. Register into Matchmaking Queue on Server
    try {
      const res = await fetch('/api/ludo/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: tableToConfirm.id,
          userId: user.id,
          userName: user.name,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Refund on server failure using authoritative server action
        await refund_table_entry({
          userId: user.id,
          matchId: matchIdTemp,
          entryFee: tableToConfirm.entryFee,
          reason: 'Server join error',
        });
        await refreshWallet();
        setIsJoining(false);
        setQueueError(data.error || 'Failed to join table queue.');
        setTableToConfirm(null);
        return;
      }

      // If match started right away (enough players connected)
      if (data.status === 'starting' && data.matchId) {
        setIsJoining(false);
        setTableToConfirm(null);
        onJoinMatch(data.matchId);
        return;
      }

      // Otherwise enter waiting room modal
      setActiveQueueTable(tableToConfirm);
      setWaitingInfo({
        queuePosition: data.queuePosition || 1,
        totalWaiting: data.totalWaiting || 1,
        needed: data.needed || tableToConfirm.mode,
      });
      setIsJoining(false);
      setTableToConfirm(null);
      fetchTables();
    } catch (err: any) {
      // Refund on network exception
      await refund_table_entry({
        userId: user.id,
        matchId: matchIdTemp,
        entryFee: tableToConfirm.entryFee,
        reason: 'Network connection error',
      });
      await refreshWallet();
      setIsJoining(false);
      setQueueError(err?.message || 'Network error while connecting to server.');
      setTableToConfirm(null);
    }
  };

  // Cancel Waiting Queue with 100% Refund
  const handleCancelQueue = async () => {
    if (!activeQueueTable || !user) return;

    try {
      await fetch('/api/ludo/queue/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: activeQueueTable.id,
          userId: user.id,
        }),
      });

      // 100% Refund in Wallet via authoritative server action
      await refund_table_entry({
        userId: user.id,
        matchId: `cancelled_${activeQueueTable.id}`,
        entryFee: activeQueueTable.entryFee,
        reason: 'Cancelled by player before match started',
      });
      await refreshWallet();
    } catch (err) {
      console.warn('Queue cancel error:', err);
    } finally {
      setActiveQueueTable(null);
      setWaitingInfo(null);
      fetchTables();
    }
  };

  // Simulate Opponent Join (for instant testing & verification)
  const handleSimulateBotOpponent = async () => {
    if (!activeQueueTable) return;
    setIsSimulatingBot(true);

    try {
      const res = await fetch('/api/ludo/queue/simulate-opponent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: activeQueueTable.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.matchId) {
        setActiveQueueTable(null);
        setWaitingInfo(null);
        onJoinMatch(data.matchId);
      }
    } catch (err) {
      console.warn('Bot simulate error:', err);
    } finally {
      setIsSimulatingBot(false);
    }
  };

  const filteredTables = tables.filter((t) => {
    if (selectedModeFilter === 'all') return true;
    return String(t.mode) === selectedModeFilter;
  });

  const totalOnlineInLobby = tables.reduce((acc, t) => acc + (t.onlinePlayers || 0), 0);
  const totalPlayingInLobby = tables.reduce((acc, t) => acc + (t.playingPlayers || 0), 0);

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-20">
      {/* Top Real Cash Balance Header Card */}
      <div className="bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#0f172a] rounded-2xl border border-emerald-500/40 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/40 flex items-center gap-1.5 animate-live-pulse shadow-sm shadow-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                LIVE ONLINE GAME
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                REAL CASH-BASED GAME
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                TOP-UP AND PLAY
              </span>
            </div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              India’s Trusted Gaming Platform
            </div>
            <h1 className="text-lg font-black text-white mt-0.5">Choose Your Ludo Table</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Online Skill Games • Top-up and Play • Real Cash Games
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Available Cash</span>
            <div className="flex items-center justify-end gap-1 font-mono text-xl font-black text-emerald-400">
              <span>₹{wallet.balance.toLocaleString('en-IN')}</span>
            </div>
            <button
              onClick={onOpenTopUp}
              className="mt-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs shadow-md transition cursor-pointer flex items-center gap-1"
            >
              <Coins className="w-3 h-3" />
              <span>Top-Up Cash</span>
            </button>
          </div>
        </div>

        {/* Real Cash Disclaimer Banner */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 bg-amber-950/20 -mx-4 -mb-4 p-3 rounded-b-2xl border-b border-amber-500/20">
          <div className="flex items-start gap-2 text-[11px] text-amber-300 leading-tight">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-200">
                “Real Cash only — Real Money. Cash Winnings. And Withdrawals.”
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Authoritative online multiplayer • Secure ledger verification • Fair-play turn timers
              </p>
            </div>
          </div>
        </div>

        {/* Locked Balance Indicator if any */}
        {wallet.lockedBalance > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-amber-300">
            <span>🔒 Reserved for active match / review:</span>
            <span className="font-mono font-bold">₹{wallet.lockedBalance.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>

      {/* Recent Winners Marquee & Real-time Winnings Showcase */}
      <LudoRecentWinnersMarquee />

      {/* Tabs: Tables Lobby / Recent Winners / Cash Match History */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('tables')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'tables'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Tables ({tables.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('winners')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'winners'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>Recent Winners</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            fetchHistory();
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>My History</span>
        </button>
      </div>

      {queueError && (
        <div className="p-3 bg-rose-950/80 border border-rose-500/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{queueError}</span>
        </div>
      )}

      {/* ========================================================
          TAB 1: TABLES LOBBY
          ======================================================== */}
      {activeTab === 'tables' && (
        <div className="space-y-3">
          {/* 5000+ Live Players Network Summary Banner */}
          <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900/95 to-blue-950/80 border border-emerald-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white tracking-wide">
                    {(totalOnlineInLobby + totalPlayingInLobby || 5240).toLocaleString('en-IN')}+ PLAYERS ACTIVE
                  </span>
                  <span className="text-[9.5px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black uppercase">
                    42 Live Tables
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Instant real-time matchmaking active across all tables
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-[10px] text-slate-400 font-medium">Online:</span>
                <span className="text-[11px] font-mono font-black text-emerald-300">
                  {(totalOnlineInLobby || 3150).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800">
                <Gamepad2 className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-slate-400 font-medium">In Game:</span>
                <span className="text-[11px] font-mono font-black text-blue-300">
                  {(totalPlayingInLobby || 2090).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Mode Filter Selector */}
          <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 px-2">Filter Format:</span>
            <div className="flex gap-1">
              {[
                { id: 'all', label: 'All Tables (42)' },
                { id: '2', label: '👥 2 Players (21)' },
                { id: '4', label: '👨‍👩‍👧‍👦 4 Players (21)' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedModeFilter(filter.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    selectedModeFilter === filter.id
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tables Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredTables.map((table) => {
              const is2P = table.mode === 2;
              const hasBalance = wallet.balance >= table.entryFee;
              const isHighStakes = table.entryFee > 250;

              return (
                <div
                  key={table.id}
                  className={`relative rounded-2xl border p-3.5 flex flex-col justify-between transition-all duration-150 ${
                    table.entryFee >= 5000
                      ? 'bg-gradient-to-b from-[#1C2541] to-[#0B132B] border-amber-500/40 shadow-lg'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        is2P
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {is2P ? '2 Players (1v1)' : '4 Players Free-for-all'}
                    </span>

                    {/* Waiting Status / Game Status */}
                    <span className="flex items-center gap-1.5 text-[10px] font-bold">
                      {table.waitingPlayers > 0 ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-amber-300">
                            WAITING ({table.waitingPlayers}/{table.mode})
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider animate-live-pulse shadow-sm shadow-emerald-500/20">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          LIVE GAME READY
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Real-time Online & In-Game Traffic Counter for this Table */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                    <div className="flex items-center justify-between bg-slate-950/70 border border-slate-800/80 px-2.5 py-1.5 rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Online:</span>
                      </div>
                      <span className="text-[11px] font-mono font-black text-emerald-400">
                        {table.onlinePlayers?.toLocaleString('en-IN') ?? (isHighStakes ? '18' : '185')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-950/70 border border-slate-800/80 px-2.5 py-1.5 rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <Gamepad2 className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="text-[10px] text-slate-400 font-medium">Playing:</span>
                      </div>
                      <span className="text-[11px] font-mono font-black text-blue-400">
                        {table.playingPlayers?.toLocaleString('en-IN') ?? (isHighStakes ? '12' : '135')}
                      </span>
                    </div>
                  </div>

                  {/* Main Entry & Winning Prize Showcase */}
                  <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">Entry Cash:</span>
                      <span className="font-mono text-base font-black text-white">
                        ₹{table.entryFee.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                      <div className="flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-amber-300">1st Prize Winner:</span>
                      </div>
                      <span className="font-mono text-base font-black text-emerald-400">
                        ₹{table.prize.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Join Table Button */}
                  <button
                    onClick={() => handleInitiateJoin(table)}
                    className={`w-full py-2.5 rounded-xl text-xs font-black transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                      hasBalance
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    <span>Join Table</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: MATCH HISTORY
          ======================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {matchHistory.length === 0 ? (
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-8 text-center space-y-2">
              <Trophy className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Match Records Yet</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Join a 2-Player or 4-Player cash table to compete for winning prizes!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {matchHistory.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-slate-900/90 rounded-2xl border border-slate-800 p-3.5 shadow flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">{rec.tableTitle}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          rec.isWinner
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {rec.isWinner ? '🏆 WON' : 'COMPLETED'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Entry: ₹{rec.entryFee} • Ref: {rec.referenceId}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(rec.timestamp).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="text-right">
                    {rec.isWinner ? (
                      <span className="font-mono text-base font-black text-emerald-400">
                        +₹{rec.prizeWon.toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span className="font-mono text-sm font-bold text-slate-400">
                        -₹{rec.entryFee}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL 1: CONFIRMATION MODAL BEFORE JOINING
          ======================================================== */}
      {tableToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-emerald-500/40 p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎲</span>
                <h3 className="text-sm font-black text-white">Confirm Table Entry</h3>
              </div>
              <button
                onClick={() => setTableToConfirm(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Details Ledger */}
            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Format:</span>
                <span className="font-bold text-white">
                  {tableToConfirm.mode === 2 ? '2 Players (1v1)' : '4 Players Free-For-All'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current Cash Balance:</span>
                <span className="font-mono font-bold text-white">
                  ₹{wallet.balance.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Entry Cash Required:</span>
                <span className="font-mono font-bold text-amber-400">
                  -₹{tableToConfirm.entryFee.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 font-bold">
                <span className="text-slate-300">Balance After Reservation:</span>
                <span className="font-mono text-emerald-400">
                  ₹{(wallet.balance - tableToConfirm.entryFee).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 bg-emerald-950/40 -mx-4 -mb-4 p-3 rounded-b-2xl">
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Winner 1st Prize Reward:
                </span>
                <span className="font-mono text-base font-black text-emerald-400">
                  ₹{tableToConfirm.prize.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Real Cash Disclaimer Requirement */}
            <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-[11px] text-amber-200 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">
                  “Real Cash only — Real Money. Cash Winnings. And Withdrawals.”
                </p>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  Your entry cash will be reserved securely. 100% refund guaranteed if cancelled before match starts.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setTableToConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmJoin}
                disabled={isJoining}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isJoining ? (
                  <span>Reserving Entry...</span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Confirm &amp; Join</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: INSUFFICIENT CASH WARNING
          ======================================================== */}
      {insufficientBalanceTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-rose-500/50 p-5 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-white">Not Enough Cash</h3>
              <p className="text-xs text-slate-300 mt-1">
                Please top up your cash balance to join this table.
              </p>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Required Entry:</span>
                <span className="font-bold text-white">₹{insufficientBalanceTable.entryFee}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Your Available Cash:</span>
                <span className="font-bold text-rose-400">₹{wallet.balance}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setInsufficientBalanceTable(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setInsufficientBalanceTable(null);
                  onOpenTopUp();
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Top-Up Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: ACTIVE QUEUE WAITING ROOM
          ======================================================== */}
      {activeQueueTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-blue-500/50 p-6 w-full max-w-md shadow-2xl space-y-5 text-center">
            {/* Animated Matchmaking Radar */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/40 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-emerald-500/40 animate-pulse" />
              <div className="w-14 h-14 rounded-full bg-blue-600/30 border border-blue-400 flex items-center justify-center text-2xl">
                🎲
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-500/30">
                MATCHMAKING QUEUE
              </span>
              <h3 className="text-base font-black text-white mt-1">
                Waiting for Players...
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Table: ₹{activeQueueTable.entryFee} ({activeQueueTable.mode} Players) • Prize: ₹{activeQueueTable.prize}
              </p>
            </div>

            {/* Queue Counter Card */}
            <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Players in Queue:</span>
                <span className="font-mono font-bold text-white">
                  {waitingInfo ? `${waitingInfo.totalWaiting} / ${waitingInfo.needed}` : `1 / ${activeQueueTable.mode}`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{
                    width: `${((waitingInfo?.totalWaiting || 1) / activeQueueTable.mode) * 100}%`,
                  }}
                />
              </div>

              <p className="text-[11px] text-slate-400">
                Searching for opponents... Match starts automatically in a few seconds.
              </p>
            </div>

            {/* Fair Play & Fast Matchmaking Card */}
            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-emerald-500/30 space-y-1.5 text-left text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Instant Multiplayer Matchmaking</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Connects players seamlessly in 2-player and 4-player tables with certified random dice rolling and instant prize settlements.
              </p>
            </div>

            {/* Cancel & 100% Refund Button */}
            <button
              onClick={handleCancelQueue}
              className="w-full py-2.5 rounded-xl border border-rose-500/50 bg-rose-950/30 text-rose-300 hover:bg-rose-950/60 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Cancel &amp; 100% Full Refund (₹{activeQueueTable.entryFee})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
