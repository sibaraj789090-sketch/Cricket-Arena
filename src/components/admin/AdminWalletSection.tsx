import React, { useState } from 'react';
import {
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Save,
  Edit,
  Trash2,
  Lock,
  Smartphone,
  Building,
  Shield,
  RefreshCw,
  Sliders,
  UserCheck,
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { useAuth } from '../../context/AuthContext';
import { CoinPackage, WalletSettings, WithdrawalRequest } from '../../types/wallet';
import { CricketDataStore } from '../../lib/storage';

export const AdminWalletSection: React.FC = () => {
  const { user } = useAuth();
  const {
    settings,
    allPackages,
    withdrawals,
    transactions,
    adminApproveWithdrawal,
    adminRejectWithdrawal,
    adminUpdateSettings,
    adminUpdatePackages,
    adminManualAdjustment,
    refreshWallet,
  } = useWallet();

  // Sub-tabs
  const [walletSubTab, setWalletSubTab] = useState<'withdrawals' | 'packages' | 'settings' | 'adjust'>('withdrawals');

  // Withdrawal Action Modals
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [payoutRefId, setPayoutRefId] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');

  // Settings State Form
  const [editSettings, setEditSettings] = useState<WalletSettings>({ ...settings });
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');

  // Package Form State
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [newPkg, setNewPkg] = useState<Partial<CoinPackage>>({
    title: '',
    coins: 100,
    bonusCoins: 0,
    priceInr: 100,
    badge: '',
    isActive: true,
    displayOrder: allPackages.length + 1,
  });

  // Manual Adjustment State
  const [adjUserId, setAdjUserId] = useState('user-demo-1');
  const [adjAmount, setAdjAmount] = useState(100);
  const [adjReason, setAdjReason] = useState('');
  const [adjSuccess, setAdjSuccess] = useState('');
  const [adjError, setAdjError] = useState('');

  // Summary Metrics
  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending');
  const totalPendingInr = pendingWithdrawals.reduce((sum, w) => sum + w.amountInr, 0);
  const approvedWithdrawals = withdrawals.filter((w) => w.status === 'approved');
  const totalApprovedInr = approvedWithdrawals.reduce((sum, w) => sum + w.amountInr, 0);
  const totalDeposits = transactions
    .filter((t) => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + (t.priceInr || 0), 0);

  // Approve Payout Submit
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawal) return;
    setIsProcessing(true);
    setActionErrorMsg('');

    const ref = payoutRefId.trim() || `UTR-${Date.now()}`;
    const result = await adminApproveWithdrawal(selectedWithdrawal.id, adminNotes, ref);

    setIsProcessing(false);
    if (result.success) {
      CricketDataStore.addAuditLog({
        adminId: user?.id || 'admin-master',
        adminName: user?.name || 'Finance Admin',
        action: 'WITHDRAWAL_APPROVED',
        targetType: 'tournament',
        targetId: selectedWithdrawal.id,
        details: `Approved ₹${selectedWithdrawal.amountInr} payout to ${selectedWithdrawal.userName} (${selectedWithdrawal.payoutMethod.toUpperCase()}: ${ref}).`,
      });

      setActionSuccessMsg(`Withdrawal for ₹${selectedWithdrawal.amountInr} marked as Approved & Transferred!`);
      setSelectedWithdrawal(null);
      setActionType(null);
      setPayoutRefId('');
      setAdminNotes('');
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } else {
      setActionErrorMsg(result.error || 'Failed to approve withdrawal.');
    }
  };

  // Reject & Refund Submit
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawal) return;
    if (!adminNotes.trim()) {
      setActionErrorMsg('Please provide a reason for declining the withdrawal.');
      return;
    }

    setIsProcessing(true);
    setActionErrorMsg('');

    const result = await adminRejectWithdrawal(selectedWithdrawal.id, adminNotes);

    setIsProcessing(false);
    if (result.success) {
      CricketDataStore.addAuditLog({
        adminId: user?.id || 'admin-master',
        adminName: user?.name || 'Finance Admin',
        action: 'WITHDRAWAL_REJECTED',
        targetType: 'tournament',
        targetId: selectedWithdrawal.id,
        details: `Declined ₹${selectedWithdrawal.amountInr} withdrawal for ${selectedWithdrawal.userName}. Coins refunded. Reason: ${adminNotes}`,
      });

      setActionSuccessMsg(`Withdrawal declined. ${selectedWithdrawal.amountCoins} coins refunded to user.`);
      setSelectedWithdrawal(null);
      setActionType(null);
      setAdminNotes('');
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } else {
      setActionErrorMsg(result.error || 'Failed to decline withdrawal.');
    }
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    adminUpdateSettings(editSettings);
    CricketDataStore.addAuditLog({
      adminId: user?.id || 'admin-master',
      adminName: user?.name || 'Administrator',
      action: 'WALLET_LIMITS_MODIFIED',
      targetType: 'points_rule',
      targetId: 'wallet_settings',
      details: `Min deposit ₹${editSettings.minDepositInr}, max ₹${editSettings.maxDepositInr}. Min withdraw ₹${editSettings.minWithdrawalInr}, max ₹${editSettings.maxWithdrawalInr}.`,
    });
    setSettingsSuccessMsg('Wallet limits and financial settings saved successfully!');
    setTimeout(() => setSettingsSuccessMsg(''), 3500);
  };

  // Add / Edit Package
  const handleSavePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkg.title || !newPkg.priceInr || !newPkg.coins) return;

    let updatedList = [...allPackages];
    if (editingPkgId) {
      updatedList = updatedList.map((p) =>
        p.id === editingPkgId
          ? {
              ...p,
              title: newPkg.title!,
              coins: Number(newPkg.coins),
              bonusCoins: Number(newPkg.bonusCoins || 0),
              priceInr: Number(newPkg.priceInr),
              badge: newPkg.badge || undefined,
              isActive: Boolean(newPkg.isActive),
              displayOrder: Number(newPkg.displayOrder || p.displayOrder),
            }
          : p
      );
    } else {
      const created: CoinPackage = {
        id: `pkg-${Date.now()}`,
        title: newPkg.title!,
        coins: Number(newPkg.coins),
        bonusCoins: Number(newPkg.bonusCoins || 0),
        priceInr: Number(newPkg.priceInr),
        badge: newPkg.badge || undefined,
        isActive: Boolean(newPkg.isActive),
        displayOrder: Number(newPkg.displayOrder || updatedList.length + 1),
      };
      updatedList.push(created);
    }

    adminUpdatePackages(updatedList);
    setShowAddPackage(false);
    setEditingPkgId(null);
    setNewPkg({
      title: '',
      coins: 100,
      bonusCoins: 0,
      priceInr: 100,
      badge: '',
      isActive: true,
      displayOrder: updatedList.length + 1,
    });
  };

  // Toggle package active state
  const handleTogglePackage = (pkgId: string) => {
    const updated = allPackages.map((p) => (p.id === pkgId ? { ...p, isActive: !p.isActive } : p));
    adminUpdatePackages(updated);
  };

  // Manual Adjustment
  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjSuccess('');
    setAdjError('');

    if (!adjReason.trim()) {
      setAdjError('Please provide a documented reason for this adjustment.');
      return;
    }

    const result = await adminManualAdjustment(adjUserId, adjAmount, adjReason);
    if (result.success) {
      CricketDataStore.addAuditLog({
        adminId: user?.id || 'admin-master',
        adminName: user?.name || 'Administrator',
        action: 'MANUAL_COIN_ADJUSTMENT',
        targetType: 'player',
        targetId: adjUserId,
        details: `Adjusted user balance by ${adjAmount > 0 ? '+' : ''}${adjAmount} coins. Reason: ${adjReason}`,
      });
      setAdjSuccess(`Balance adjusted successfully (${adjAmount > 0 ? '+' : ''}${adjAmount} coins)!`);
      setAdjAmount(100);
      setAdjReason('');
      setTimeout(() => setAdjSuccess(''), 4000);
    } else {
      setAdjError(result.error || 'Failed to adjust balance.');
    }
  };

  return (
    <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-4 text-xs">
      {/* Title */}
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            Wallet &amp; Payment Finance Control
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Process player withdrawal payouts, configure coin packages, and adjust deposit limits.
          </p>
        </div>
        <button
          onClick={refreshWallet}
          className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
          title="Refresh Data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Pending Withdrawals</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-black text-amber-400 font-mono">
              ₹{totalPendingInr.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400">({pendingWithdrawals.length})</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Deposits Processed</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-black text-emerald-400 font-mono">
              ₹{totalDeposits.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Completed Payouts</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-black text-blue-400 font-mono">
              ₹{totalApprovedInr.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400">({approvedWithdrawals.length})</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Coin Purchases Status</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${
                settings.topUpEnabled ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span className="text-xs font-bold text-white">
              {settings.topUpEnabled ? 'Enabled (Active)' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto">
        {[
          { id: 'withdrawals', label: `Pending Withdrawals (${pendingWithdrawals.length})` },
          { id: 'packages', label: `Coin Packages (${allPackages.length})` },
          { id: 'settings', label: 'Financial Limits & Rules' },
          { id: 'adjust', label: 'Manual Coin Adjustment' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setWalletSubTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              walletSubTab === tab.id
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =========================================================
          SUB-TAB 1: WITHDRAWAL REQUESTS MANAGER
          ========================================================= */}
      {walletSubTab === 'withdrawals' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Player Withdrawal Queue
            </h4>
            <span className="text-[11px] text-slate-400">
              Min ₹{settings.minWithdrawalInr} • Max ₹{settings.maxWithdrawalInr.toLocaleString()}
            </span>
          </div>

          {withdrawals.length === 0 ? (
            <p className="text-center py-8 text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
              No withdrawal requests recorded yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {withdrawals.map((w) => {
                const isPending = w.status === 'pending';
                const isApproved = w.status === 'approved';

                return (
                  <div
                    key={w.id}
                    className={`p-3 rounded-xl border transition ${
                      isPending
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : isApproved
                        ? 'bg-slate-900/80 border-slate-800 opacity-90'
                        : 'bg-rose-950/20 border-rose-900/40 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white">
                            ₹{w.amountInr.toLocaleString()}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              isPending
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                : isApproved
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            }`}
                          >
                            {w.status}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Player: <strong className="text-white">{w.userName}</strong>
                          </span>
                        </div>

                        {/* Payout Destination Info */}
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-300">
                          {w.payoutMethod === 'upi' ? (
                            <span className="flex items-center gap-1 font-mono text-amber-300">
                              <Smartphone className="w-3 h-3" /> UPI ID: {w.payoutDetails.upiId}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-mono text-blue-300">
                              <Building className="w-3 h-3" /> A/C: {w.payoutDetails.bankAccountNumber} (
                              {w.payoutDetails.ifscCode}) - {w.payoutDetails.bankName || 'Bank'}
                            </span>
                          )}
                          <span>•</span>
                          <span className="text-slate-400">{w.userEmail}</span>
                        </div>

                        {w.payoutReferenceId && (
                          <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                            Payout Ref: {w.payoutReferenceId}
                          </p>
                        )}
                        {w.adminNotes && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">
                            Note: {w.adminNotes}
                          </p>
                        )}
                      </div>

                      {/* Action buttons if Pending */}
                      {isPending ? (
                        <div className="flex gap-1.5 shrink-0 ml-2">
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(w);
                              setActionType('approve');
                              setPayoutRefId(`UTR-${Date.now().toString().slice(-6)}`);
                              setActionErrorMsg('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(w);
                              setActionType('reject');
                              setActionErrorMsg('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          {new Date(w.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          SUB-TAB 2: COIN PACKAGES MANAGER
          ========================================================= */}
      {walletSubTab === 'packages' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Coin Packages Catalog
            </h4>
            <button
              onClick={() => {
                setShowAddPackage(true);
                setEditingPkgId(null);
                setNewPkg({
                  title: '',
                  coins: 500,
                  bonusCoins: 50,
                  priceInr: 500,
                  badge: '',
                  isActive: true,
                  displayOrder: allPackages.length + 1,
                });
              }}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Package</span>
            </button>
          </div>

          {/* Add / Edit Form */}
          {showAddPackage && (
            <form onSubmit={handleSavePackage} className="p-3 bg-slate-900 rounded-xl border border-slate-700 space-y-2.5">
              <h5 className="font-bold text-amber-400 text-xs">
                {editingPkgId ? 'Edit Package' : 'Create New Coin Package'}
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Package Title</label>
                  <input
                    type="text"
                    required
                    value={newPkg.title || ''}
                    onChange={(e) => setNewPkg({ ...newPkg, title: e.target.value })}
                    placeholder="e.g. Mega Pack"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Price in INR (₹)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPkg.priceInr || 100}
                    onChange={(e) => setNewPkg({ ...newPkg, priceInr: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Base Coins</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPkg.coins || 100}
                    onChange={(e) => setNewPkg({ ...newPkg, coins: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Bonus Coins</label>
                  <input
                    type="number"
                    min="0"
                    value={newPkg.bonusCoins || 0}
                    onChange={(e) => setNewPkg({ ...newPkg, bonusCoins: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Badge (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Popular (+20%)"
                    value={newPkg.badge || ''}
                    onChange={(e) => setNewPkg({ ...newPkg, badge: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="flex items-center gap-4 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={newPkg.isActive}
                      onChange={(e) => setNewPkg({ ...newPkg, isActive: e.target.checked })}
                      className="rounded text-amber-500"
                    />
                    <span>Active / Visible to users</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddPackage(false)}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Save Package
                </button>
              </div>
            </form>
          )}

          {/* Packages List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  pkg.isActive
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-950 border-slate-900 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{pkg.title}</span>
                    {pkg.badge && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-black">
                        {pkg.badge}
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        pkg.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {pkg.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Price: <strong className="text-white">₹{pkg.priceInr}</strong> • Coins:{' '}
                    <strong className="text-amber-400">{pkg.coins}</strong>
                    {pkg.bonusCoins > 0 && <span className="text-emerald-400"> (+{pkg.bonusCoins} Bonus)</span>}
                  </p>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleTogglePackage(pkg.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                      pkg.isActive ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {pkg.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => {
                      setNewPkg({ ...pkg });
                      setEditingPkgId(pkg.id);
                      setShowAddPackage(true);
                    }}
                    className="p-1 rounded-lg bg-slate-800 text-amber-400 hover:text-amber-300"
                    title="Edit Package"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 3: FINANCIAL LIMITS & SETTINGS
          ========================================================= */}
      {walletSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              System Financial Limits &amp; Policies
            </h4>
            <button
              type="submit"
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition shadow flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Limits</span>
            </button>
          </div>

          {settingsSuccessMsg && (
            <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs">
              {settingsSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
              <h5 className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Deposit Limits (INR)
              </h5>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Minimum Deposit</label>
                <input
                  type="number"
                  min="1"
                  value={editSettings.minDepositInr}
                  onChange={(e) =>
                    setEditSettings({ ...editSettings, minDepositInr: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Maximum Deposit</label>
                <input
                  type="number"
                  min="100"
                  value={editSettings.maxDepositInr}
                  onChange={(e) =>
                    setEditSettings({ ...editSettings, maxDepositInr: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
              <h5 className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                Withdrawal Limits (INR)
              </h5>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Minimum Withdrawal</label>
                <input
                  type="number"
                  min="1"
                  value={editSettings.minWithdrawalInr}
                  onChange={(e) =>
                    setEditSettings({ ...editSettings, minWithdrawalInr: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Maximum Withdrawal</label>
                <input
                  type="number"
                  min="100"
                  value={editSettings.maxWithdrawalInr}
                  onChange={(e) =>
                    setEditSettings({ ...editSettings, maxWithdrawalInr: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <label className="text-[10px] text-slate-400 block mb-1">
                New User Free Starting Bonus Coins
              </label>
              <input
                type="number"
                min="0"
                value={editSettings.startingBonusCoins}
                onChange={(e) =>
                  setEditSettings({ ...editSettings, startingBonusCoins: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">Default: 100 free coins credited on signup</p>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Paid Coin Top-Ups Switch</span>
                <span className="text-[10px] text-slate-400">
                  Allow or restrict real INR payment top-ups
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={editSettings.topUpEnabled}
                  onChange={(e) =>
                    setEditSettings({ ...editSettings, topUpEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>
        </form>
      )}

      {/* =========================================================
          SUB-TAB 4: MANUAL COIN ADJUSTMENT
          ========================================================= */}
      {walletSubTab === 'adjust' && (
        <form onSubmit={handleManualAdjustment} className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
          <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            Issue Documented Coin Adjustment
          </h4>
          <p className="text-slate-400 text-[11px]">
            Directly credit or debit a user&apos;s virtual coin balance with mandatory audit logging.
          </p>

          {adjSuccess && <div className="p-2 bg-emerald-950/60 text-emerald-300 rounded-lg">{adjSuccess}</div>}
          {adjError && <div className="p-2 bg-rose-950/60 text-rose-300 rounded-lg">{adjError}</div>}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Target User ID</label>
              <input
                type="text"
                required
                value={adjUserId}
                onChange={(e) => setAdjUserId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">
                Coin Delta (+ to credit, - to debit)
              </label>
              <input
                type="number"
                required
                value={adjAmount}
                onChange={(e) => setAdjAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">
              Documented Reason / Audit Note (Required)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Compensation for match cancellation / Promotional reward"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shadow"
          >
            Apply Adjustment ({adjAmount > 0 ? `+${adjAmount}` : adjAmount} Coins)
          </button>
        </form>
      )}

      {/* =========================================================
          APPROVE / REJECT WITHDRAWAL ACTION MODAL
          ========================================================= */}
      {selectedWithdrawal && actionType && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1b34] border border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              {actionType === 'approve' ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Approve Withdrawal Payout
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Decline Withdrawal &amp; Refund Coins
                </>
              )}
            </h4>

            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Player:</span>
                <span className="text-white font-bold">{selectedWithdrawal.userName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount:</span>
                <span className="text-emerald-400 font-bold font-mono">
                  ₹{selectedWithdrawal.amountInr} ({selectedWithdrawal.amountCoins} Coins)
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Payout Destination:</span>
                <span className="text-amber-300 font-mono">
                  {selectedWithdrawal.payoutDetails.upiId ||
                    selectedWithdrawal.payoutDetails.bankAccountNumber}
                </span>
              </div>
            </div>

            {actionType === 'approve' ? (
              <form onSubmit={handleApprove} className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Bank UTR / UPI Reference ID
                  </label>
                  <input
                    type="text"
                    required
                    value={payoutRefId}
                    onChange={(e) => setPayoutRefId(e.target.value)}
                    placeholder="e.g. UTR-491028401928"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Admin Remark</label>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Payout transferred via IMPS/UPI"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>

                {actionErrorMsg && <p className="text-xs text-rose-400">{actionErrorMsg}</p>}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWithdrawal(null)}
                    className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 py-2 bg-emerald-500 text-slate-950 font-black rounded-xl"
                  >
                    {isProcessing ? 'Processing...' : 'Confirm Paid'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleReject} className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Reason for Declining (Mandatory - will refund coins)
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="e.g. Incorrect UPI VPA address / KYC verification required"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>

                {actionErrorMsg && <p className="text-xs text-rose-400">{actionErrorMsg}</p>}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWithdrawal(null)}
                    className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 py-2 bg-rose-500 text-white font-bold rounded-xl"
                  >
                    {isProcessing ? 'Processing...' : 'Decline & Refund'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
