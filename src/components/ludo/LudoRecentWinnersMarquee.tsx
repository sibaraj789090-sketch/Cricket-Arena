import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Sparkles, ChevronRight, X, Clock, Users, ArrowUpRight } from 'lucide-react';
import { RecentLudoWinner, INITIAL_RECENT_WINNERS } from '../../types/ludoCash';

interface LudoRecentWinnersMarqueeProps {
  onSelectTable?: (tableId: string) => void;
}

export const LudoRecentWinnersMarquee: React.FC<LudoRecentWinnersMarqueeProps> = () => {
  const [winners, setWinners] = useState<RecentLudoWinner[]>(() => INITIAL_RECENT_WINNERS);
  const [loading, setLoading] = useState<boolean>(false);
  const [showAllModal, setShowAllModal] = useState<boolean>(false);

  // Fetch recent winners from backend
  const fetchRecentWinners = async () => {
    try {
      const res = await fetch('/api/ludo/recent-winners');
      if (res.ok) {
        const text = await res.text();
        if (text) {
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data.winners) && data.winners.length > 0) {
              setWinners(data.winners);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Failed to fetch recent winners:', err);
    }
  };

  useEffect(() => {
    fetchRecentWinners();
    const interval = setInterval(fetchRecentWinners, 8000);
    return () => clearInterval(interval);
  }, []);

  // Format relative timestamp
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1m ago';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  // Calculate total winnings in the recent window
  const totalWinnings = winners.reduce((sum, w) => sum + (w.prizeWon || 0), 0);

  if (loading && winners.length === 0) {
    return (
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-2 text-center text-xs text-slate-400">
        Loading recent winners...
      </div>
    );
  }

  if (winners.length === 0) return null;

  // Duplicate for seamless infinite marquee loop
  const marqueeItems = [...winners, ...winners];

  return (
    <div className="bg-gradient-to-r from-slate-900/95 via-[#0e1726]/95 to-slate-900/95 rounded-2xl border border-amber-500/30 p-2.5 shadow-lg relative overflow-hidden backdrop-blur-sm">
      {/* Top Banner Row */}
      <div className="flex items-center justify-between pb-1.5 px-1 border-b border-slate-800/80 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 shadow-sm shadow-amber-500/30">
            <Trophy className="w-3.2 h-3.2 fill-current" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
              Recent Winners
            </span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/90 px-1.5 py-0.2 rounded border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              LIVE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
            Paid out: <strong className="text-emerald-400 font-bold">₹{totalWinnings.toLocaleString('en-IN')}</strong>
          </span>
          <button
            onClick={() => setShowAllModal(true)}
            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition flex items-center gap-0.5 cursor-pointer bg-amber-950/40 hover:bg-amber-900/40 px-2 py-0.5 rounded-lg border border-amber-500/30"
          >
            <span>View All ({winners.length})</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Marquee Scroller Track */}
      <div className="relative overflow-hidden w-full group py-0.5">
        {/* Soft edge blur overlays */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#0e1726] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#0e1726] to-transparent z-10 pointer-events-none" />

        <div className="animate-marquee flex items-center gap-2.5">
          {marqueeItems.map((winner, index) => {
            const isHighPrize = winner.prizeWon >= 500;
            return (
              <div
                key={`${winner.id}-${index}`}
                onClick={() => setShowAllModal(true)}
                className={`cursor-pointer shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition select-none ${
                  isHighPrize
                    ? 'bg-gradient-to-r from-amber-950/60 to-slate-900/90 border-amber-500/50 shadow-sm shadow-amber-500/10 hover:border-amber-400'
                    : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 hover:border-emerald-500/40'
                }`}
              >
                {/* Winner Avatar */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isHighPrize
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-xs'
                      : 'bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950'
                  }`}
                >
                  {winner.userName.slice(0, 1).toUpperCase()}
                </div>

                {/* Winner Name & Table Tier */}
                <div className="leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-white max-w-[90px] truncate">
                      {winner.userName}
                    </span>
                    {isHighPrize && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-slate-400">
                    <span className="bg-slate-800 px-1 py-0.2 rounded font-semibold text-slate-300">
                      {winner.mode}P • ₹{winner.entryFee}
                    </span>
                    <span>• {getRelativeTime(winner.completedAt)}</span>
                  </div>
                </div>

                {/* Prize Amount Badge */}
                <div className="text-right pl-1 border-l border-slate-800/80">
                  <div className="text-xs font-black font-mono text-emerald-400 flex items-center gap-0.5">
                    <span>+₹{winner.prizeWon.toLocaleString('en-IN')}</span>
                  </div>
                  <span className="text-[8px] uppercase tracking-wider text-emerald-500/90 font-bold block">
                    WON
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Marquee Hint Footer */}
      <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400 px-1">
        <span className="flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
          <span>Real Cash winnings credited instantly to winner's wallet ledger</span>
        </span>
        <span className="font-semibold text-slate-400">Hover/Hold to pause</span>
      </div>

      {/* ========================================================
          RECENT WINNERS MODAL / FULL LEADERBOARD DRAWER
          ======================================================== */}
      {showAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#0B132B] border border-amber-500/40 rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border-b border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/30">
                  <Trophy className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Latest Ludo Winners</span>
                    <span className="text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded font-bold">
                      VERIFIED
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Real Cash prize settlements from completed 2P & 4P tables
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAllModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Stats Summary */}
            <div className="p-3 bg-slate-900/90 border-b border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Total Payout</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  ₹{totalWinnings.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Matches</span>
                <span className="font-mono font-black text-white text-sm">
                  {winners.length} Tables
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Top Winner</span>
                <span className="font-mono font-black text-amber-400 text-sm truncate block">
                  ₹{Math.max(...winners.map((w) => w.prizeWon || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Winners List Scroll Container */}
            <div className="p-4 space-y-2 overflow-y-auto max-h-[55vh]">
              {winners.map((winner, idx) => {
                const isGold = idx === 0;
                const isSilver = idx === 1;
                const isBronze = idx === 2;

                return (
                  <div
                    key={winner.id || idx}
                    className={`p-3 rounded-xl border flex items-center justify-between transition ${
                      isGold
                        ? 'bg-amber-950/30 border-amber-500/40 shadow-sm shadow-amber-500/10'
                        : isSilver
                        ? 'bg-slate-800/40 border-slate-700'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank Badge */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-black text-[10px] shrink-0 ${
                          isGold
                            ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/40'
                            : isSilver
                            ? 'bg-slate-300 text-slate-950'
                            : isBronze
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{winner.userName}</span>
                          {isGold && <Crown className="w-3 h-3 text-amber-400" />}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <Users className="w-2.5 h-2.5" />
                            {winner.mode}P Table (₹{winner.entryFee})
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-slate-400">
                            <Clock className="w-2.5 h-2.5" />
                            {getRelativeTime(winner.completedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-sm font-black text-emerald-400">
                        +₹{winner.prizeWon.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[9px] text-emerald-500/80 font-bold uppercase tracking-wider block">
                        Cash Prize
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Bottom Action */}
            <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                Want to win? Pick a table and challenge live opponents!
              </span>
              <button
                onClick={() => setShowAllModal(false)}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Play Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface LudoRecentWinnersSectionProps {
  onSelectMode?: (mode: 2 | 4) => void;
  onGoToTables?: () => void;
}

export const LudoRecentWinnersSection: React.FC<LudoRecentWinnersSectionProps> = ({
  onSelectMode,
  onGoToTables,
}) => {
  const [winners, setWinners] = useState<RecentLudoWinner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<'all' | '2' | '4'>('all');

  useEffect(() => {
    const fetchWinners = async () => {
      try {
        const res = await fetch('/api/ludo/recent-winners');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.winners)) {
            setWinners(data.winners);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch recent winners:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWinners();
    const interval = setInterval(fetchWinners, 8000);
    return () => clearInterval(interval);
  }, []);

  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1m ago';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  const filteredWinners = winners.filter((w) => {
    if (filterMode === 'all') return true;
    return String(w.mode) === filterMode;
  });

  const totalWinnings = winners.reduce((sum, w) => sum + (w.prizeWon || 0), 0);

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Overview Stats Cards */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#0B132B] p-3 rounded-2xl border border-emerald-500/30 shadow-md">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">
            Total Won Today
          </span>
          <span className="font-mono font-black text-emerald-400 text-base">
            ₹{totalWinnings.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="bg-[#0B132B] p-3 rounded-2xl border border-slate-800 shadow-md">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">
            Matches Settled
          </span>
          <span className="font-mono font-black text-white text-base">
            {winners.length} Tables
          </span>
        </div>

        <div className="bg-[#0B132B] p-3 rounded-2xl border border-amber-500/30 shadow-md">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">
            Top Prize Won
          </span>
          <span className="font-mono font-black text-amber-400 text-base">
            ₹{winners.length > 0 ? Math.max(...winners.map((w) => w.prizeWon || 0)).toLocaleString('en-IN') : '0'}
          </span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
        <span className="text-[11px] font-bold text-slate-400 px-2">Filter Winners:</span>
        <div className="flex gap-1">
          {[
            { id: 'all', label: 'All Tables' },
            { id: '2', label: '👥 2P Matches' },
            { id: '4', label: '👨‍👩‍👧‍👦 4P Matches' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterMode(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterMode === f.id
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Winner Cards Feed */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
          Loading recent completed matches...
        </div>
      ) : filteredWinners.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
          No completed matches found for this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredWinners.map((winner, idx) => {
            const isGold = idx === 0;
            const isSilver = idx === 1;
            const isBronze = idx === 2;

            return (
              <div
                key={winner.id || idx}
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                  isGold
                    ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/50 shadow-md shadow-amber-500/10'
                    : isSilver
                    ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-[#121c33] border-slate-700/80'
                    : 'bg-[#0f172a] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank Badge */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                      isGold
                        ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 shadow-sm shadow-amber-500/30'
                        : isSilver
                        ? 'bg-slate-300 text-slate-950 font-bold'
                        : isBronze
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white">{winner.userName}</span>
                      {isGold && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-bold font-mono">
                        CHAMPION
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="bg-slate-800 px-1.5 py-0.2 rounded text-slate-300 font-semibold">
                        {winner.mode}P Table • ₹{winner.entryFee} Entry
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-slate-400 text-[10px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {getRelativeTime(winner.completedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex items-center gap-3">
                  <div>
                    <div className="font-mono text-base font-black text-emerald-400">
                      +₹{winner.prizeWon.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[9px] text-emerald-500/90 font-bold uppercase tracking-wider block">
                      Cash Winnings
                    </span>
                  </div>

                  {onGoToTables && (
                    <button
                      onClick={() => {
                        if (onSelectMode) onSelectMode(winner.mode);
                        onGoToTables();
                      }}
                      title="Play this table format"
                      className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-400 flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

