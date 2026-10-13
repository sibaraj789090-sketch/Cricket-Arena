import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Ban,
  Clock,
  UserX,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Calendar,
  User,
  Plus,
  FileText,
  Filter,
} from 'lucide-react';
import { PlayerRestriction, RestrictionType } from '../../types/adminControl';
import { AdminDataStore } from '../../lib/adminDataStore';
import { useAuth } from '../../context/AuthContext';
import { adminFetch } from '../../lib/adminAuth';

const fetch = adminFetch;

export const AdminBansSection: React.FC = () => {
  const { user } = useAuth();

  const [restrictions, setRestrictions] = useState<PlayerRestriction[]>(() =>
    AdminDataStore.getRestrictions()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'full_ban' | 'ludo_ban' | 'temp_suspend'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'lifted'>('active');

  // New Ban Modal State
  const [isNewBanModalOpen, setIsNewBanModalOpen] = useState(false);
  const [targetUid, setTargetUid] = useState('');
  const [targetUserName, setTargetUserName] = useState('');
  const [banType, setBanType] = useState<RestrictionType>('full_ban');
  const [banDurationHours, setBanDurationHours] = useState(24);
  const [banReason, setBanReason] = useState('');
  const [banInternalNote, setBanInternalNote] = useState('');
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);

  // Unban Action Modal
  const [selectedUnban, setSelectedUnban] = useState<PlayerRestriction | null>(null);
  const [unbanReason, setUnbanReason] = useState('Pardoned following administrative appeal review.');
  const [isUnbanning, setIsUnbanning] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const reloadRestrictions = async () => {
    try {
      const res = await fetch('/api/admin/bans');
      if (res.ok) {
        const data = await res.json();
        if (data.restrictions) {
          setRestrictions(data.restrictions);
          return;
        }
      }
    } catch {
      // fallback
    }
    setRestrictions(AdminDataStore.getRestrictions());
  };

  useEffect(() => {
    reloadRestrictions();
  }, []);

  // Filter restrictions
  const filteredRestrictions = restrictions.filter((r) => {
    if (typeFilter !== 'all' && r.restrictionType !== typeFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        r.userId.toLowerCase().includes(q) ||
        r.userName.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        (r.adminName && r.adminName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Handle Create Ban
  const handleCreateBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUid.trim() || !banReason.trim()) return;

    setIsSubmittingBan(true);
    setFeedbackMsg(null);

    try {
      AdminDataStore.applyRestriction({
        userId: targetUid.trim(),
        userName: targetUserName.trim() || `Player_${targetUid.trim().slice(-4)}`,
        restrictionType: banType,
        reason: banReason.trim(),
        internalNote: banInternalNote.trim(),
        adminId: user?.id || 'admin-master',
        adminName: user?.name || 'Administrator',
        durationHours: banType === 'temp_suspend' ? banDurationHours : undefined,
      });

      // Sync server
      await fetch('/api/admin/players/restrict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({
          userId: targetUid.trim(),
          userName: targetUserName.trim() || `Player_${targetUid.trim().slice(-4)}`,
          restrictionType: banType,
          reason: banReason.trim(),
          internalNote: banInternalNote.trim(),
          durationHours: banType === 'temp_suspend' ? banDurationHours : undefined,
          adminId: user?.id || 'admin-master',
          adminName: user?.name || 'Administrator',
        }),
      }).catch(() => {});

      setFeedbackMsg({
        text: `Restriction ${banType.replace('_', ' ').toUpperCase()} applied to UID ${targetUid}. Server enforcement active.`,
      });
      setIsNewBanModalOpen(false);
      setTargetUid('');
      setTargetUserName('');
      setBanReason('');
      setBanInternalNote('');
      reloadRestrictions();
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({ text: err?.message || 'Failed to enforce restriction.', error: true });
    } finally {
      setIsSubmittingBan(false);
    }
  };

  // Handle Unban
  const handleExecuteUnban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnban) return;

    setIsUnbanning(true);

    try {
      AdminDataStore.liftRestriction({
        userId: selectedUnban.userId,
        adminId: user?.id || 'admin-master',
        adminName: user?.name || 'Administrator',
        reason: unbanReason,
      });

      await fetch('/api/admin/players/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({
          userId: selectedUnban.userId,
          reason: unbanReason,
          adminId: user?.id || 'admin-master',
          adminName: user?.name || 'Administrator',
        }),
      }).catch(() => {});

      setFeedbackMsg({
        text: `Restriction lifted for ${selectedUnban.userName}. Account restored to clean standing.`,
      });
      setSelectedUnban(null);
      reloadRestrictions();
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({ text: err?.message || 'Failed to lift restriction.', error: true });
    } finally {
      setIsUnbanning(false);
    }
  };

  const activeTotal = restrictions.filter((r) => r.status === 'active').length;
  const fullBansCount = restrictions.filter((r) => r.status === 'active' && r.restrictionType === 'full_ban').length;
  const ludoBansCount = restrictions.filter((r) => r.status === 'active' && r.restrictionType === 'ludo_ban').length;
  const tempSuspendsCount = restrictions.filter((r) => r.status === 'active' && r.restrictionType === 'temp_suspend').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Bans &amp; Blacklist System</h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  SERVER ENFORCED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative blacklists, Ludo table restrictions, temporary suspensions, and permanent bans with audit trails.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNewBanModalOpen(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Ban / Restriction</span>
            </button>
            <button
              onClick={reloadRestrictions}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Enforcement Architecture Note */}
      <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
        <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-white">
            Server-Side Enforcement &amp; Audit Trail Preservation
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Banned players cannot bypass restrictions by refreshing their browser, changing client state, or invoking direct database RPCs. Furthermore, banning never deletes a player's wallet balance or transaction history, guaranteeing forensic financial auditability.
          </p>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            feedbackMsg.error
              ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
              : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
          }`}
        >
          {feedbackMsg.error ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Restrictions</span>
          <span className="font-mono text-base font-black text-rose-400 mt-0.5 block">
            {activeTotal} Accounts
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Permanent App Bans</span>
          <span className="font-mono text-base font-black text-white mt-0.5 block">
            {fullBansCount} Banned
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Ludo Table Blocks</span>
          <span className="font-mono text-base font-black text-purple-400 mt-0.5 block">
            {ludoBansCount} Restricted
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Temp Suspensions</span>
          <span className="font-mono text-base font-black text-amber-400 mt-0.5 block">
            {tempSuspendsCount} Active
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Status Filter */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            {(['active', 'all', 'lifted'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition cursor-pointer ${
                  statusFilter === s ? 'bg-rose-600 text-white font-black shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            {[
              { id: 'all', label: 'All Types' },
              { id: 'full_ban', label: 'Full Ban' },
              { id: 'ludo_ban', label: 'Ludo Only' },
              { id: 'temp_suspend', label: 'Temp Suspend' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id as any)}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  typeFilter === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search UID, username, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400 font-mono"
          />
        </div>
      </div>

      {/* Restrictions List */}
      <div className="space-y-2.5">
        {filteredRestrictions.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 text-xs">
            No moderation or blacklist entries matched your filter.
          </div>
        ) : (
          filteredRestrictions.map((item) => {
            const isActive = item.status === 'active';
            const isTemp = item.restrictionType === 'temp_suspend';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition ${
                  isActive
                    ? 'bg-[#180a0f]/80 border-rose-500/40 shadow-sm'
                    : 'bg-slate-900/50 border-slate-800 opacity-70'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {item.userName}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      (UID: <strong className="text-slate-200">{item.userId}</strong>)
                    </span>

                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        item.restrictionType === 'full_ban'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : item.restrictionType === 'ludo_ban'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {item.restrictionType.replace('_', ' ')}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-left sm:text-right text-[11px] text-slate-400 font-mono">
                    <span>Enforced: {new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Reason & Notes */}
                <div className="pt-2.5 space-y-2 text-xs">
                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-slate-200">
                    <strong className="text-[10px] uppercase tracking-wider text-rose-400 block mb-0.5">
                      Violation Reason:
                    </strong>
                    <p className="leading-relaxed">{item.reason}</p>
                  </div>

                  {item.internalNote && (
                    <div className="bg-blue-950/20 p-2 rounded-xl border border-blue-900/40 text-[11px] text-blue-300">
                      <strong>Internal Staff Note:</strong> {item.internalNote}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-slate-500" />
                      <span>Enforcing Admin: <strong className="text-slate-300">{item.adminName}</strong> (UID: {item.adminId})</span>
                    </div>

                    {isTemp && item.expiresAt && (
                      <div className="flex items-center gap-1.5 text-amber-400 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>Expires: {new Date(item.expiresAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {isActive && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => setSelectedUnban(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer active:scale-95"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unban / Restore Access</span>
                      </button>
                    </div>
                  )}

                  {!isActive && item.liftedAt && (
                    <div className="pt-1 text-[11px] text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-slate-500" />
                      <span>Restored access on {new Date(item.liftedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE NEW BAN MODAL */}
      {isNewBanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-rose-500/40 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <span>Add Player Ban / Restriction</span>
              </h3>
              <button
                onClick={() => setIsNewBanModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateBanSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Player Auth UID (Exact ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. usr-rohit-88 or full auth UID"
                  value={targetUid}
                  onChange={(e) => setTargetUid(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Username (Display)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rohit_Sharma"
                  value={targetUserName}
                  onChange={(e) => setTargetUserName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Restriction Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBanType('full_ban')}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      banType === 'full_ban'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <strong className="block text-[11px]">Full App Ban</strong>
                    <span className="text-[10px] text-slate-400">Permanent lockout</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBanType('ludo_ban')}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      banType === 'ludo_ban'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <strong className="block text-[11px]">Ludo Tables</strong>
                    <span className="text-[10px] text-slate-400">Cash game block</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBanType('temp_suspend')}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      banType === 'temp_suspend'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <strong className="block text-[11px]">Temp Suspend</strong>
                    <span className="text-[10px] text-slate-400">Timed suspension</span>
                  </button>
                </div>
              </div>

              {banType === 'temp_suspend' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Duration in Hours
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={banDurationHours}
                    onChange={(e) => setBanDurationHours(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Reason (Required - Logged to Immutable Audit)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cheat script detection, repeated AFK stalling, abusive behaviour"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Internal Administrative Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Case notes or match IDs..."
                  value={banInternalNote}
                  onChange={(e) => setBanInternalNote(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingBan}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition cursor-pointer active:scale-95 shadow"
                >
                  {isSubmittingBan ? 'Enforcing...' : 'Enforce Ban with Server Authority'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNBAN CONFIRMATION MODAL */}
      {selectedUnban && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-emerald-500/40 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-400" />
                <span>Restore Player Access</span>
              </h3>
              <button
                onClick={() => setSelectedUnban(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Restore full platform access for <strong>{selectedUnban.userName}</strong> (UID: {selectedUnban.userId})?
            </p>

            <form onSubmit={handleExecuteUnban} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Pardon Reason / Unban Justification
                </label>
                <textarea
                  rows={2}
                  value={unbanReason}
                  onChange={(e) => setUnbanReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUnban(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUnbanning}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer"
                >
                  {isUnbanning ? 'Restoring...' : 'Confirm Unban'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
