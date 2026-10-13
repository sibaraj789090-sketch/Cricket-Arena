import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Coins,
  History,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Eye,
  Slash,
  Ban,
  ArrowRight,
  TrendingUp,
  FileText,
  DollarSign,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import { PlayerProfileSummary, PlayerRestriction, RestrictionType } from '../../types/adminControl';
import { AdminDataStore } from '../../lib/adminDataStore';
import { WalletDataStore } from '../../lib/walletStorage';
import { CricketDataStore } from '../../lib/storage';
import { useAuth } from '../../context/AuthContext';
import { UserWallet, WalletTransaction } from '../../types/wallet';
import { adminFetch } from '../../lib/adminAuth';

const fetch = adminFetch;

export const AdminPlayersSection: React.FC = () => {
  const { user } = useAuth();

  const [players, setPlayers] = useState<PlayerProfileSummary[]>(() =>
    AdminDataStore.getPlayerProfiles()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'restricted'>('all');
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Profile Modal State
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfileSummary | null>(null);
  const [playerWallet, setPlayerWallet] = useState<UserWallet | null>(null);
  const [playerTransactions, setPlayerTransactions] = useState<WalletTransaction[]>([]);
  const [profileTab, setProfileTab] = useState<'overview' | 'wallet' | 'moderation'>('overview');

  // Moderation Action State
  const [modRestrictionType, setModRestrictionType] = useState<RestrictionType>('temp_suspend');
  const [modReason, setModReason] = useState('');
  const [modInternalNote, setModInternalNote] = useState('');
  const [modDurationHours, setModDurationHours] = useState(24);
  const [modFeedback, setModFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [isProcessingMod, setIsProcessingMod] = useState(false);

  // Manual Balance Adjustment State
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number>(100);
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustReason, setAdjustReason] = useState('');

  const reloadPlayers = async () => {
    try {
      const res = await fetch('/api/admin/players');
      if (res.ok) {
        const data = await res.json();
        if (data.players) {
          // Merge local wallet balances for accuracy
          const merged = data.players.map((p: any) => {
            const w = WalletDataStore.getWallet(p.userId);
            const activeRes = AdminDataStore.getActiveRestriction(p.userId);
            return {
              ...p,
              balance: w.balance,
              lockedBalance: w.lockedBalance,
              restriction: activeRes || p.restriction,
            };
          });
          setPlayers(merged);
          return;
        }
      }
    } catch {
      // fallback
    }
    setPlayers(AdminDataStore.getPlayerProfiles());
  };

  useEffect(() => {
    reloadPlayers();
  }, []);

  const handleCopyUid = (uid: string) => {
    navigator.clipboard?.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const handleOpenProfile = (player: PlayerProfileSummary) => {
    setSelectedPlayer(player);
    const w = WalletDataStore.getWallet(player.userId);
    setPlayerWallet(w);
    setPlayerTransactions(WalletDataStore.getTransactions(player.userId));
    setProfileTab('overview');
    setModFeedback(null);
    setIsAdjustingBalance(false);
  };

  // Apply ban or restriction
  const handleApplyRestriction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer || !modReason.trim()) return;

    setIsProcessingMod(true);
    setModFeedback(null);

    try {
      // 1. Authoritative local store
      AdminDataStore.applyRestriction({
        userId: selectedPlayer.userId,
        userName: selectedPlayer.userName,
        restrictionType: modRestrictionType,
        reason: modReason,
        internalNote: modInternalNote,
        adminId: user?.id || 'admin-master',
        adminName: user?.name || 'Administrator',
        durationHours: modRestrictionType === 'temp_suspend' ? modDurationHours : undefined,
      });

      // 2. Server sync
      await fetch('/api/admin/players/restrict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: selectedPlayer.userId,
          userName: selectedPlayer.userName,
          restrictionType: modRestrictionType,
          reason: modReason,
          internalNote: modInternalNote,
          durationHours: modRestrictionType === 'temp_suspend' ? modDurationHours : undefined,
          adminId: user?.id || 'admin-master',
          adminName: user?.name || 'Administrator',
        }),
      }).catch(() => {});

      setModFeedback({
        text: `Successfully applied ${modRestrictionType.replace('_', ' ').toUpperCase()} to ${selectedPlayer.userName}.`,
      });
      setModReason('');
      setModInternalNote('');
      reloadPlayers();

      // Refresh selected player state
      const updatedRes = AdminDataStore.getActiveRestriction(selectedPlayer.userId);
      setSelectedPlayer((prev) => (prev ? { ...prev, restriction: updatedRes || undefined } : null));
    } catch (err: any) {
      setModFeedback({ text: err?.message || 'Failed to apply restriction.', error: true });
    } finally {
      setIsProcessingMod(false);
    }
  };

  // Lift Ban / Unban
  const handleLiftRestriction = async () => {
    if (!selectedPlayer) return;

    setIsProcessingMod(true);
    setModFeedback(null);

    try {
      AdminDataStore.liftRestriction({
        userId: selectedPlayer.userId,
        adminId: user?.id || 'admin-master',
        adminName: user?.name || 'Administrator',
        reason: 'Pardoned by administrator via Player Management console.',
      });

      await fetch('/api/admin/players/unban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: selectedPlayer.userId,
          reason: 'Pardoned by administrator via Player Management console.',
          adminId: user?.id || 'admin-master',
          adminName: user?.name || 'Administrator',
        }),
      }).catch(() => {});

      setModFeedback({
        text: `Restrictions lifted. Player ${selectedPlayer.userName} has full platform access restored.`,
      });
      reloadPlayers();
      setSelectedPlayer((prev) => (prev ? { ...prev, restriction: undefined } : null));
    } catch (err: any) {
      setModFeedback({ text: err?.message || 'Failed to lift restriction.', error: true });
    } finally {
      setIsProcessingMod(false);
    }
  };

  // Manual Balance Adjustment
  const handleAdjustBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer || adjustAmount <= 0) return;

    const delta = adjustType === 'add' ? adjustAmount : -adjustAmount;

    const result = WalletDataStore.adjustBalance(
      selectedPlayer.userId,
      delta,
      `Admin adjustment: ${adjustReason || (adjustType === 'add' ? 'Manual credit' : 'Manual deduction')}`,
      user?.name || 'Administrator'
    );

    if (result.success) {
      // Server sync
      fetch('/api/admin/wallet/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          targetUserId: selectedPlayer.userId,
          amountDelta: delta,
          reason: adjustReason,
          adminName: user?.name || 'Administrator',
        }),
      }).catch(() => {});

      // Refresh wallet
      const w = WalletDataStore.getWallet(selectedPlayer.userId);
      setPlayerWallet(w);
      setPlayerTransactions(WalletDataStore.getTransactions(selectedPlayer.userId));
      setSelectedPlayer((prev) => (prev ? { ...prev, balance: w.balance } : null));
      setIsAdjustingBalance(false);
      setAdjustReason('');
      reloadPlayers();
    }
  };

  const filteredPlayers = players.filter((p) => {
    const isRestricted = Boolean(p.restriction && p.restriction.status === 'active');
    if (statusFilter === 'active' && isRestricted) return false;
    if (statusFilter === 'restricted' && !isRestricted) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        p.userId.toLowerCase().includes(q) ||
        p.userName.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalRegistered = players.length;
  const activeCount = players.filter((p) => !p.restriction || p.restriction.status !== 'active').length;
  const restrictedCount = players.filter((p) => p.restriction && p.restriction.status === 'active').length;
  const totalBalanceHeld = players.reduce((sum, p) => sum + p.balance, 0);

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Player &amp; UID Management</h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  AUTH VERIFIED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect registered player accounts, audit Real Cash balances, track match records, and manage access restrictions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={reloadPlayers}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1 transition"
            >
              <span>Refresh Directory</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Accounts</span>
          <span className="font-mono text-base font-black text-white mt-0.5 block">
            {totalRegistered} Registered
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Clean</span>
          <span className="font-mono text-base font-black text-emerald-400 mt-0.5 block">
            {activeCount} Players
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Restricted / Banned</span>
          <span className="font-mono text-base font-black text-rose-400 mt-0.5 block">
            {restrictedCount} Accounts
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Real Cash Held</span>
          <span className="font-mono text-base font-black text-amber-400 mt-0.5 block">
            ₹{totalBalanceHeld.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5">
          {(['all', 'active', 'restricted'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                statusFilter === tab
                  ? 'bg-blue-600 text-white font-black shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'all' ? 'All Players' : tab}
              {tab === 'restricted' && restrictedCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black">
                  {restrictedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search exact UID, username, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 font-mono"
          />
        </div>
      </div>

      {/* Players Directory List */}
      <div className="space-y-2.5">
        {filteredPlayers.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 text-xs">
            No player accounts matched your search criteria.
          </div>
        ) : (
          filteredPlayers.map((player) => {
            const isRestricted = Boolean(player.restriction && player.restriction.status === 'active');
            const restriction = player.restriction;
            const winRate =
              player.totalMatchesPlayed > 0
                ? Math.round((player.wins / player.totalMatchesPlayed) * 100)
                : 0;

            return (
              <div
                key={player.userId}
                className={`p-3.5 rounded-2xl border transition ${
                  isRestricted
                    ? 'bg-rose-950/20 border-rose-500/40 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Avatar & Identity */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {player.userName}
                      </span>
                      {isRestricted ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 uppercase">
                          {restriction?.restrictionType.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          Active Account
                        </span>
                      )}

                      {player.pendingCashRequestsCount > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {player.pendingCashRequestsCount} Pending Request
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        UID: <strong className="text-slate-200">{player.userId}</strong>
                        <button
                          onClick={() => handleCopyUid(player.userId)}
                          className="text-slate-500 hover:text-white p-0.5"
                          title="Copy UID"
                        >
                          {copiedUid === player.userId ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </span>
                      <span>•</span>
                      <span>Joined: {new Date(player.registeredAt).toLocaleDateString()}</span>
                      {player.email && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400">{player.email}</span>
                        </>
                      )}
                    </div>

                    {/* Stats strip */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                      <span className="text-slate-300">
                        Cash Balance:{' '}
                        <strong className="text-amber-400 font-mono font-bold">
                          ₹{player.balance.toLocaleString('en-IN')}
                        </strong>
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">
                        Matches: <strong className="text-slate-200">{player.totalMatchesPlayed}</strong>
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-emerald-400">
                        Wins: <strong>{player.wins}</strong>
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-rose-400">
                        Losses: <strong>{player.losses}</strong>
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-blue-300 font-mono">
                        Win Rate: <strong>{winRate}%</strong>
                      </span>
                    </div>

                    {isRestricted && restriction && (
                      <div className="mt-1.5 p-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                        <strong>Reason:</strong> {restriction.reason}
                        {restriction.expiresAt && (
                          <span className="block text-[11px] text-rose-400 font-mono mt-0.5">
                            Expires: {new Date(restriction.expiresAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenProfile(player)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open Profile</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DETAILED PLAYER PROFILE MODAL */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-blue-900/80 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{selectedPlayer.userName}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span>UID: {selectedPlayer.userId}</span>
                    <button
                      onClick={() => handleCopyUid(selectedPlayer.userId)}
                      className="text-slate-500 hover:text-white"
                    >
                      {copiedUid === selectedPlayer.userId ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Profile Tabs */}
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setProfileTab('overview')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  profileTab === 'overview' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Overview &amp; Stats
              </button>
              <button
                onClick={() => setProfileTab('wallet')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  profileTab === 'wallet' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Wallet &amp; Transactions
              </button>
              <button
                onClick={() => setProfileTab('moderation')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                  profileTab === 'moderation' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Moderation &amp; Bans
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {profileTab === 'overview' && (
              <div className="space-y-3 text-xs">
                {/* Balance Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Available Cash</span>
                    <span className="font-mono text-base font-black text-amber-400 mt-0.5 block">
                      ₹{selectedPlayer.balance}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Locked in Tables</span>
                    <span className="font-mono text-base font-black text-slate-300 mt-0.5 block">
                      ₹{selectedPlayer.lockedBalance || 0}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Matches Played</span>
                    <span className="font-mono text-base font-black text-white mt-0.5 block">
                      {selectedPlayer.totalMatchesPlayed}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Win Record</span>
                    <span className="font-mono text-base font-black text-emerald-400 mt-0.5 block">
                      {selectedPlayer.wins}W / {selectedPlayer.losses}L
                    </span>
                  </div>
                </div>

                {/* Account Details Box */}
                <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                  <h5 className="font-bold text-white text-xs border-b border-slate-800 pb-1.5">
                    Account Verification &amp; Security
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Authenticated UID:</span>
                      <p className="font-mono text-slate-200 mt-0.5">{selectedPlayer.userId}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Registration Date:</span>
                      <p className="font-mono text-slate-200 mt-0.5">
                        {new Date(selectedPlayer.registeredAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Account Status:</span>
                      <p className="mt-0.5">
                        {selectedPlayer.restriction && selectedPlayer.restriction.status === 'active' ? (
                          <span className="text-rose-400 font-bold uppercase">
                            {selectedPlayer.restriction.restrictionType.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold">Good Standing (Active)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Pending Cash Requests:</span>
                      <p className="font-mono text-slate-200 mt-0.5">
                        {selectedPlayer.pendingCashRequestsCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: WALLET & TRANSACTIONS */}
            {profileTab === 'wallet' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Current Verified Balance</span>
                    <span className="font-mono text-lg font-black text-amber-400">
                      ₹{selectedPlayer.balance} Coins
                    </span>
                  </div>

                  <button
                    onClick={() => setIsAdjustingBalance(!isAdjustingBalance)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition cursor-pointer"
                  >
                    {isAdjustingBalance ? 'Cancel Adjustment' : 'Manual Balance Adjustment'}
                  </button>
                </div>

                {/* Balance Adjustment Form */}
                {isAdjustingBalance && (
                  <form
                    onSubmit={handleAdjustBalanceSubmit}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-2.5"
                  >
                    <h5 className="font-bold text-amber-300 text-xs">
                      Manual Balance Modification
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjustType('add')}
                        className={`py-1.5 rounded-xl font-bold border transition ${
                          adjustType === 'add'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        + Add Coins (Credit)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustType('deduct')}
                        className={`py-1.5 rounded-xl font-bold border transition ${
                          adjustType === 'deduct'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        - Deduct Coins (Debit)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Amount (INR / Coins)</label>
                        <input
                          type="number"
                          min={1}
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Reason / Audit Trail Note</label>
                        <input
                          type="text"
                          placeholder="e.g. Compensation for match timeout"
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer"
                    >
                      Execute Authoritative Balance Adjustment
                    </button>
                  </form>
                )}

                {/* Ledger History List */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  <h5 className="font-bold text-white text-xs">Recent Ledger Entries</h5>
                  {playerTransactions.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">No transaction history recorded yet.</p>
                  ) : (
                    playerTransactions.map((tx) => {
                      const isCredit = tx.amount >= 0 || tx.type === 'deposit' || tx.type === 'starting_bonus' || tx.type === 'game_reward';
                      const txDate = tx.createdAt || tx.timestamp || new Date().toISOString();

                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px]"
                        >
                          <div>
                            <span className="font-bold text-white block">{tx.description}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(txDate).toLocaleString()} • Ref: {tx.referenceId || tx.id}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold ${
                              isCredit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isCredit ? '+' : '-'}₹{Math.abs(tx.amount)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: MODERATION & BANS */}
            {profileTab === 'moderation' && (
              <div className="space-y-3 text-xs">
                {modFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      modFeedback.error
                        ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                        : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                    }`}
                  >
                    {modFeedback.error ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    )}
                    <span>{modFeedback.text}</span>
                  </div>
                )}

                {/* Current Active Ban Status */}
                {selectedPlayer.restriction && selectedPlayer.restriction.status === 'active' ? (
                  <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-400" />
                        <div>
                          <span className="font-bold text-white text-xs block">
                            Active Restriction: {selectedPlayer.restriction.restrictionType.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Enforced by {selectedPlayer.restriction.adminName} on{' '}
                            {new Date(selectedPlayer.restriction.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleLiftRestriction}
                        disabled={isProcessingMod}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Lift Ban &amp; Restore Access
                      </button>
                    </div>

                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-rose-500/20 text-[11px] text-rose-200">
                      <p><strong>Reason:</strong> {selectedPlayer.restriction.reason}</p>
                      {selectedPlayer.restriction.internalNote && (
                        <p className="mt-1 text-slate-400">
                          <strong>Internal Note:</strong> {selectedPlayer.restriction.internalNote}
                        </p>
                      )}
                      {selectedPlayer.restriction.expiresAt && (
                        <p className="mt-1 text-amber-300 font-mono">
                          Expires: {new Date(selectedPlayer.restriction.expiresAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>This player has no active bans or restrictions. Account is in good standing.</span>
                  </div>
                )}

                {/* Apply New Restriction Form */}
                <form
                  onSubmit={handleApplyRestriction}
                  className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-3"
                >
                  <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Ban className="w-4 h-4 text-rose-400" />
                    <span>Apply Account Restriction or Ban</span>
                  </h5>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Restriction Type
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setModRestrictionType('temp_suspend')}
                        className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                          modRestrictionType === 'temp_suspend'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <strong className="block text-[11px]">Temporary Suspend</strong>
                        <span className="text-[10px] text-slate-400">Hours-based lockout</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModRestrictionType('ludo_ban')}
                        className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                          modRestrictionType === 'ludo_ban'
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <strong className="block text-[11px]">Ludo Tables Ban</strong>
                        <span className="text-[10px] text-slate-400">Restrict from cash tables</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModRestrictionType('full_ban')}
                        className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                          modRestrictionType === 'full_ban'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <strong className="block text-[11px]">Permanent Ban</strong>
                        <span className="text-[10px] text-slate-400">Entire app block</span>
                      </button>
                    </div>
                  </div>

                  {modRestrictionType === 'temp_suspend' && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Suspension Duration (Hours)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={720}
                        value={modDurationHours}
                        onChange={(e) => setModDurationHours(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Reason (Required - Visible to Audits)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Stalling high-stake matches, abusive chat, or automated script detection"
                      value={modReason}
                      onChange={(e) => setModReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Internal Admin Note (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Internal security notes, ticket references, or evidence links..."
                      value={modInternalNote}
                      onChange={(e) => setModInternalNote(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessingMod}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition cursor-pointer active:scale-95 shadow"
                  >
                    {isProcessingMod ? 'Enforcing...' : 'Enforce Restriction & Save Audit Record'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
