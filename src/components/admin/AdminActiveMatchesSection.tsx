import React, { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Users,
  Shield,
  Coins,
  ArrowRight,
  Eye,
  Dice5,
  XCircle,
  HelpCircle,
  Check,
  Ban,
  Radio,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LudoCashMatch, LudoOnlinePlayer } from '../../types/ludoCash';
import { adminFetch } from '../../lib/adminAuth';

const fetch = adminFetch;

interface ActiveMatchDisplay extends LudoCashMatch {
  elapsedSeconds?: number;
  currentTurnPlayer?: LudoOnlinePlayer;
  totalTokensInPlay?: number;
  tokensHomeCount?: number;
}

export const AdminActiveMatchesSection: React.FC = () => {
  const { user } = useAuth();

  const [matches, setMatches] = useState<ActiveMatchDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Inspector modal
  const [inspectingMatch, setInspectingMatch] = useState<ActiveMatchDisplay | null>(null);

  // Action modal
  const [actionModal, setActionModal] = useState<{
    type: 'pause' | 'resume' | 'cancel' | 'disable_table';
    match: ActiveMatchDisplay;
    title: string;
    description: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Auto-refresh matches every 3 seconds
  const loadActiveMatches = async () => {
    try {
      const res = await fetch('/api/ludo/admin/matches/active');
      if (res.ok) {
        const data = await res.json();
        if (data.matches) {
          setMatches(data.matches);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch active matches:', err);
    }
  };

  useEffect(() => {
    loadActiveMatches();
    const interval = setInterval(loadActiveMatches, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;

    setIsProcessingAction(true);
    setStatusMsg(null);

    const match = actionModal.match;
    const reason = actionReason.trim() || 'Administrative live game intervention';

    try {
      if (actionModal.type === 'pause') {
        const res = await fetch('/api/ludo/admin/match/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({ matchId: match.id, reason }),
        });
        if (res.ok) {
          setStatusMsg({ text: `Match ${match.id} has been paused.` });
        }
      } else if (actionModal.type === 'resume') {
        const res = await fetch('/api/ludo/admin/match/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({ matchId: match.id }),
        });
        if (res.ok) {
          setStatusMsg({ text: `Match ${match.id} has resumed.` });
        }
      } else if (actionModal.type === 'cancel') {
        const res = await fetch('/api/ludo/admin/match/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({ matchId: match.id, reason }),
        });
        const data = await res.json();
        if (res.ok) {
          setStatusMsg({
            text: `Match ${match.id} cancelled safely! Full refund of ₹${match.entryFee} processed for ${data.refundedPlayersCount || match.players.length} players.`,
          });
        }
      } else if (actionModal.type === 'disable_table') {
        const res = await fetch('/api/ludo/admin/table/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({ tableId: match.tableId, isActive: false }),
        });
        if (res.ok) {
          setStatusMsg({ text: `Parent table ${match.tableId} disabled to prevent new players.` });
        }
      }

      setActionModal(null);
      setActionReason('');
      setInspectingMatch(null);
      loadActiveMatches();
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Failed to execute administrative action.', error: true });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const formatElapsed = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const liveMatches = matches.filter((m) => m.status === 'in_progress');
  const pausedMatches = matches.filter((m) => m.status === 'paused');
  const startingMatches = matches.filter((m) => m.status === 'starting');
  const totalReservedCash = matches.reduce((sum, m) => sum + m.entryFee * m.playerCount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Active Games &amp; Live Match Control</h3>
                <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE SOCKETS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect running matches in real time, monitor turn states, pause tables, or cancel matches with automated player refunds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadActiveMatches}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh State</span>
            </button>
          </div>
        </div>
      </div>

      {/* Network Transparency Notice */}
      <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
        <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-white">
            Real Server-Authoritative Matches vs Local Practice
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            All matches listed here run on the authoritative Express game engine. Local bot practice matches never appear on the server dashboard. Dice rolls and player moves are processed by server rules without client tampering.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            statusMsg.error
              ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
              : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
          }`}
        >
          {statusMsg.error ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Live In Progress</span>
          <span className="font-mono text-base font-black text-blue-400 mt-0.5 block">
            {liveMatches.length} Matches
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Paused By Admin</span>
          <span className="font-mono text-base font-black text-amber-400 mt-0.5 block">
            {pausedMatches.length} Paused
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Starting Matchmaking</span>
          <span className="font-mono text-base font-black text-purple-400 mt-0.5 block">
            {startingMatches.length} Starting
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Real Cash In Play</span>
          <span className="font-mono text-base font-black text-emerald-400 mt-0.5 block">
            ₹{totalReservedCash.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Matches List */}
      <div className="space-y-3">
        {matches.length === 0 ? (
          <div className="p-10 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 text-xs">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-25 text-blue-400" />
            <p className="font-semibold">No matches currently active on the server.</p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              When players join real cash tables and matchmaking completes, live game rooms appear here with full control.
            </p>
          </div>
        ) : (
          matches.map((m) => {
            const isPaused = m.status === 'paused';
            const currentTurn = m.gameState?.currentTurn;
            const turnPlayer = m.players.find((p) => p.color === currentTurn);

            return (
              <div
                key={m.id}
                className={`p-4 rounded-2xl border transition ${
                  isPaused
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-slate-900/80 border-blue-500/30 shadow-md'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-black text-white">
                      Match #{m.id}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isPaused
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}
                    >
                      {m.status}
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      Table: {m.tableId}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                      ₹{m.entryFee} Entry ({m.playerCount}P) • 1st Prize ₹{m.prizeAmount}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                    <span className="flex items-center gap-1 text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40 font-bold">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Timer: {m.timeRemainingSeconds !== undefined ? formatElapsed(m.timeRemainingSeconds) : '0s'} remaining
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      Elapsed: {formatElapsed(m.elapsedSeconds)}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="pt-3 space-y-3">
                  {/* Current Turn & Last Move */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Current Turn:
                      </span>
                      {turnPlayer ? (
                        <span className="flex items-center gap-1.5 font-bold text-white font-mono">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              turnPlayer.color === 'red'
                                ? 'bg-rose-500'
                                : turnPlayer.color === 'green'
                                ? 'bg-emerald-500'
                                : turnPlayer.color === 'yellow'
                                ? 'bg-amber-400'
                                : 'bg-blue-500'
                            }`}
                          />
                          <span>{turnPlayer.userName}</span>
                          <span className="text-slate-500 text-[10px]">({turnPlayer.color.toUpperCase()})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Waiting for roll...</span>
                      )}

                      {m.gameState?.diceValue && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[11px] font-mono font-bold">
                          <Dice5 className="w-3 h-3" />
                          Dice: {m.gameState.diceValue}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 truncate max-w-xs">
                      {m.gameState?.lastActionText || 'Match initialized.'}
                    </div>
                  </div>

                  {/* Participating Players */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Participating Players &amp; Connection Status:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {m.players.map((p) => {
                        const isCurrentTurn = p.color === currentTurn;

                        return (
                          <div
                            key={p.userId}
                            className={`p-2 rounded-xl border flex items-center justify-between ${
                              isCurrentTurn
                                ? 'bg-blue-950/30 border-blue-500/50'
                                : 'bg-slate-950/50 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-3 h-3 rounded-full shrink-0 ${
                                  p.color === 'red'
                                    ? 'bg-rose-500'
                                    : p.color === 'green'
                                    ? 'bg-emerald-500'
                                    : p.color === 'yellow'
                                    ? 'bg-amber-400'
                                    : 'bg-blue-500'
                                }`}
                              />
                              <div>
                                <span className="font-bold text-white block">{p.userName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">UID: {p.userId}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="font-mono text-xs font-black text-amber-400 block">
                                {m.gameState?.scores?.[p.color] ?? p.score ?? 0} pts
                              </span>
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 justify-end">
                                <Wifi className="w-2.5 h-2.5" />
                                Online
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono block">
                                Timeouts: {p.timeouts || p.timeoutCount || 0}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInspectingMatch(m)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Inspect Tokens &amp; State</span>
                      </button>

                      <button
                        onClick={() =>
                          setActionModal({
                            type: 'disable_table',
                            match: m,
                            title: `Disable Parent Table (${m.tableId})`,
                            description: 'Prevent new matches and queues from forming on this table while leaving this current match intact.',
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                      >
                        Disable Table
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPaused ? (
                        <button
                          onClick={() =>
                            setActionModal({
                              type: 'resume',
                              match: m,
                              title: `Resume Match #${m.id}`,
                              description: 'Resume gameplay and player turn countdown timers.',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume Match</span>
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setActionModal({
                              type: 'pause',
                              match: m,
                              title: `Pause Match #${m.id}`,
                              description: 'Temporarily pause the match and display an administrative pause notice on all players screens.',
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Match</span>
                        </button>
                      )}

                      <button
                        onClick={() =>
                          setActionModal({
                            type: 'cancel',
                            match: m,
                            title: `Cancel Match #${m.id} & Refund Players`,
                            description: `Are you sure? This will terminate the match and securely credit full entry fees of ₹${m.entryFee} to all ${m.players.length} players wallets.`,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel &amp; Safe Refund</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* INSPECT MATCH DETAILS MODAL */}
      {inspectingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-blue-900/80 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-black text-white">
                  Match State Inspector: #{inspectingMatch.id}
                </h3>
              </div>
              <button
                onClick={() => setInspectingMatch(null)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Core Info Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Table ID</span>
                <span className="font-mono text-white text-[11px] truncate block">{inspectingMatch.tableId}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Pool Reserved</span>
                <span className="font-mono text-emerald-400 font-bold">
                  ₹{inspectingMatch.entryFee * inspectingMatch.playerCount}
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <span className="text-[10px] font-black uppercase text-blue-400">{inspectingMatch.status}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Elapsed Time</span>
                <span className="font-mono text-amber-400 font-bold">{formatElapsed(inspectingMatch.elapsedSeconds)}</span>
              </div>
            </div>

            {/* Token Positions Breakdown */}
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <h5 className="font-bold text-white text-xs border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>Player Token Positions &amp; Steps (0 = Yard, 1-51 = Track, 56 = Home)</span>
                <span className="text-[10px] text-slate-400 font-normal">Authoritative Engine State</span>
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {inspectingMatch.players.map((p) => {
                  const tokens = inspectingMatch.gameState?.tokens?.[p.color] || [];

                  return (
                    <div key={p.userId} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="flex items-center gap-1.5 mb-1.5">
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
                        <strong className="text-white">{p.userName}</strong>
                        <span className="text-[10px] text-slate-500 font-mono">({p.color})</span>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                        {tokens.map((t, idx) => {
                          const isHome = t.step === 56;
                          const atStart = t.step <= 0;

                          return (
                            <div
                              key={idx}
                              className={`p-1 rounded ${
                                isHome
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : atStart
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              <span>T{idx + 1}: </span>
                              <strong>{isHome ? 'HOME' : atStart ? 'STAR' : `S${t.step}`}</strong>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions in modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setActionModal({
                    type: 'cancel',
                    match: inspectingMatch,
                    title: `Cancel Match #${inspectingMatch.id}`,
                    description: `Cancel this match and safely refund ₹${inspectingMatch.entryFee} to each player?`,
                  });
                  setInspectingMatch(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer"
              >
                Cancel Match &amp; Safe Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTION CONFIRMATION MODAL */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-blue-900/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>{actionModal.title}</span>
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {actionModal.description}
            </p>

            <form onSubmit={handleExecuteAction} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Reason for Intervention (Recorded in Immutable Audit Log)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Player connection timeout review, server maintenance, or disputed match"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition cursor-pointer"
                >
                  {isProcessingAction ? 'Processing...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
