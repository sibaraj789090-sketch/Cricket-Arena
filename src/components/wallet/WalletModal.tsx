import React, { useState } from 'react';
import {
  X,
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
  CreditCard,
  QrCode,
  Smartphone,
  Building,
  RefreshCw,
  Lock,
  Send,
  FileText,
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { useAuth } from '../../context/AuthContext';
import { CoinPackage } from '../../types/wallet';
import { AdminDataStore } from '../../lib/adminDataStore';
import { CashAdditionRequest } from '../../types/adminControl';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'deposit' | 'request-cash' | 'history';
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'deposit',
}) => {
  const { user } = useAuth();
  const {
    wallet,
    settings,
    packages,
    transactions,
    buyCoins,
    refreshWallet,
    isProcessingPayment,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<'deposit' | 'request-cash' | 'history'>(initialTab);

  // Custom Deposit State
  const [customAmount, setCustomAmount] = useState<number>(500);
  const [customError, setCustomError] = useState<string>('');

  // Checkout Modal State
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [isCustomCheckout, setIsCustomCheckout] = useState<boolean>(false);
  const [checkoutMethod, setCheckoutMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    coins: number;
    amount: number;
    orderId: string;
  } | null>(null);
  const [paymentError, setPaymentError] = useState<string>('');

  // Manual Cash Addition Request State (No auto-credit)
  const [cashReqAmount, setCashReqAmount] = useState<number>(500);
  const [cashReqReason, setCashReqReason] = useState<string>('');
  const [cashReqSuccess, setCashReqSuccess] = useState<string>('');
  const [cashReqError, setCashReqError] = useState<string>('');
  const [isSubmittingCashReq, setIsSubmittingCashReq] = useState<boolean>(false);
  const [myCashRequests, setMyCashRequests] = useState<CashAdditionRequest[]>(() =>
    AdminDataStore.getCashRequests().filter((r) => r.userId === (user?.id || 'guest'))
  );

  // History Filter
  const [historyFilter, setHistoryFilter] = useState<'all' | 'deposit' | 'game' | 'bonus'>('all');
  const [copiedRef, setCopiedRef] = useState<string>('');

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedRef(text);
    setTimeout(() => setCopiedRef(''), 2000);
  };

  // Open Checkout for a standard Package
  const handleSelectPackage = (pkg: CoinPackage) => {
    setSelectedPackage(pkg);
    setIsCustomCheckout(false);
    setPaymentError('');
  };

  // Open Checkout for Custom Deposit
  const handleCustomDepositClick = () => {
    if (customAmount < settings.minDepositInr) {
      setCustomError(`Minimum deposit is ₹${settings.minDepositInr}`);
      return;
    }
    if (customAmount > settings.maxDepositInr) {
      setCustomError(`Maximum deposit is ₹${settings.maxDepositInr}`);
      return;
    }
    setCustomError('');
    setSelectedPackage(null);
    setIsCustomCheckout(true);
    setPaymentError('');
  };

  // Confirm and Process Payment (Simulating gateway verification with server)
  const handleConfirmPayment = async () => {
    setPaymentError('');
    const targetPkgId = isCustomCheckout ? 'custom' : selectedPackage?.id || '';
    const targetAmount = isCustomCheckout ? customAmount : selectedPackage?.priceInr || 0;

    const result = await buyCoins(targetPkgId, targetAmount, checkoutMethod);

    if (result.success && result.coinsAwarded) {
      setPaymentSuccessData({
        coins: result.coinsAwarded,
        amount: targetAmount,
        orderId: `ORD-${Date.now().toString().slice(-6)}`,
      });
      setSelectedPackage(null);
      setIsCustomCheckout(false);
    } else {
      setPaymentError(result.error || 'Payment failed. Please try again.');
    }
  };

  // Submit Cash Request (Never automatically credits)
  const handleSubmitCashRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setCashReqError('');
    setCashReqSuccess('');

    if (cashReqAmount < 10) {
      setCashReqError('Minimum cash request is 10 coins.');
      return;
    }

    if (!cashReqReason.trim() || cashReqReason.trim().length < 4) {
      setCashReqError('Please provide a reason or transaction reference (minimum 4 characters).');
      return;
    }

    setIsSubmittingCashReq(true);

    try {
      const newReq = AdminDataStore.createCashRequest({
        userId: user?.id || 'guest',
        userName: user?.name || 'Player',
        requestedAmount: cashReqAmount,
        reason: cashReqReason,
      });

      // Also notify backend server
      fetch('/api/wallet/cash-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'guest',
          userName: user?.name || 'Player',
          requestedAmount: cashReqAmount,
          reason: cashReqReason,
        }),
      }).catch(() => {});

      setMyCashRequests((prev) => [newReq, ...prev]);
      setCashReqSuccess(
        `Request for ₹${cashReqAmount} coins submitted for administrative review! It will be verified by an administrator. Coins are NOT automatically added.`
      );
      setCashReqReason('');
    } catch (err: any) {
      setCashReqError(err?.message || 'Failed to submit request.');
    } finally {
      setIsSubmittingCashReq(false);
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((t) => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'deposit') return t.type === 'deposit';
    if (historyFilter === 'game') return t.type === 'game_fee' || t.type === 'game_reward';
    if (historyFilter === 'bonus') return t.type === 'starting_bonus' || t.type === 'admin_adjustment';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b1222] border border-blue-900/60 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="p-4 bg-gradient-to-r from-[#0d1830] via-[#0f2042] to-[#0d1830] border-b border-blue-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-lg text-amber-400">
              <Coins className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-wide">Coins Wallet</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Instant &amp; Secure
                </span>
              </div>
              <p className="text-xs text-slate-400">Manage deposits, gameplay coins &amp; payouts</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={refreshWallet}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Wallet"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Close Wallet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Balance Card Banner */}
        <div className="p-4 bg-gradient-to-br from-[#0c1a36] to-[#081124] border-b border-blue-950/80">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Available Real Cash Balance
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-black text-amber-400 tracking-tight font-mono">
                  {wallet.balance.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-amber-300">CASH</span>
                <span className="text-xs text-slate-400">
                  (≈ ₹{wallet.balance.toLocaleString()} INR)
                </span>
              </div>
            </div>

            {wallet.lockedBalance > 0 && (
              <div className="text-right bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1.5">
                <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1 justify-end">
                  <Lock className="w-3 h-3" /> In Active Match Queue
                </span>
                <span className="text-sm font-mono font-bold text-slate-200">
                  ₹{wallet.lockedBalance} Cash
                </span>
              </div>
            )}
          </div>

          {/* Real Cash Skill Gaming Notice */}
          <div className="mt-3 p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/40 text-[11px] text-blue-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-cyan-200">
                Authoritative Skill Gaming Wallet &amp; Ledger
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Participate in verified skill matches with immutable ledger records. Manual cash requests are reviewed and approved by administrators.
              </p>
            </div>
          </div>

          {/* Quick Tabs */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              onClick={() => setActiveTab('deposit')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'deposit'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Top-Up</span>
            </button>
            <button
              onClick={() => setActiveTab('request-cash')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'request-cash'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Cash Request</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-blue-500 text-white shadow-md font-black'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* =========================================================
              TAB 1: DEPOSIT / COIN PACKAGES
              ========================================================= */}
          {activeTab === 'deposit' && (
            <div className="space-y-4">
              {/* Deposit Limits Banner */}
              <div className="p-2.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Deposit Limits:
                </span>
                <span className="font-mono font-bold">
                  Min ₹{settings.minDepositInr} • Max ₹{settings.maxDepositInr.toLocaleString()}
                </span>
              </div>

              {/* Coin Packages Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Select a Coin Package
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {packages.map((pkg) => {
                    const totalCoins = pkg.coins + pkg.bonusCoins;
                    return (
                      <div
                        key={pkg.id}
                        className="relative p-3 rounded-2xl bg-gradient-to-b from-[#0f1d3a] to-[#0b1429] border border-blue-900/50 hover:border-amber-400/80 transition-all shadow-md group flex flex-col justify-between"
                      >
                        {pkg.badge && (
                          <span className="absolute -top-2 right-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow">
                            {pkg.badge}
                          </span>
                        )}

                        <div>
                          <div className="flex items-center gap-1 text-amber-400 font-bold mb-1">
                            <Coins className="w-4 h-4" />
                            <span className="text-base font-black font-mono">
                              {totalCoins.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-amber-300">COINS</span>
                          </div>

                          <p className="text-xs font-semibold text-white truncate">{pkg.title}</p>
                          {pkg.bonusCoins > 0 ? (
                            <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                              Includes +{pkg.bonusCoins} Bonus Coins
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 mt-0.5">Instant credit</p>
                          )}
                        </div>

                        <button
                          onClick={() => handleSelectPackage(pkg)}
                          className="mt-3 w-full py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md flex items-center justify-center gap-1 active:scale-95"
                        >
                          <span>Buy for ₹{pkg.priceInr}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Deposit Amount */}
              <div className="p-3.5 rounded-2xl bg-[#0f1d38]/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Custom Deposit Amount (₹100 - ₹1,00,000)
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">1 INR = 1 Coin</span>
                </div>

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[100, 250, 500, 1000, 2500, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setCustomAmount(amt);
                        setCustomError('');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                        customAmount === amt
                          ? 'bg-emerald-500 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={settings.minDepositInr}
                      max={settings.maxDepositInr}
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(Number(e.target.value));
                        setCustomError('');
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <button
                    onClick={handleCustomDepositClick}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition shadow active:scale-95"
                  >
                    Top-Up ₹{customAmount || 0}
                  </button>
                </div>

                {customError && <p className="text-xs text-rose-400 font-medium">{customError}</p>}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: MANUAL CASH ADDITION REQUESTS (No auto-credit)
              ========================================================= */}
          {activeTab === 'request-cash' && (
            <div className="space-y-4">
              {/* Educational Rule Banner */}
              <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-cyan-200">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  Manual Cash Request Review Policy
                </span>
                <p className="text-[11px] text-slate-300">
                  Requests submitted here are held in <strong>Pending</strong> status until an administrator verifies the details. Submission <strong>NEVER automatically credits</strong> your account.
                </p>
              </div>

              {/* Cash Request Form */}
              <form onSubmit={handleSubmitCashRequest} className="p-4 rounded-2xl bg-[#0f1d38]/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Request Real Cash Addition
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Current: {wallet.balance} Coins
                  </span>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Requested Amount (Coins / INR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={10}
                      max={100000}
                      value={cashReqAmount}
                      onChange={(e) => setCashReqAmount(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-400"
                      required
                    />
                  </div>
                </div>

                {/* Reason & Reference */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Reason &amp; Transaction Proof
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter UPI UTR, payment reference, or reason for requesting cash tokens..."
                    value={cashReqReason}
                    onChange={(e) => setCashReqReason(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
                    required
                  />
                </div>

                {cashReqError && (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 font-medium">
                    {cashReqError}
                  </div>
                )}
                {cashReqSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 font-medium">
                    {cashReqSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingCashReq}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black text-xs transition shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingCashReq ? 'Submitting...' : `Submit Request for ₹${cashReqAmount}`}</span>
                </button>
              </form>

              {/* My Submitted Cash Requests */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  My Cash Addition Requests
                </h3>
                {myCashRequests.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
                    <p className="text-xs text-slate-500">No cash addition requests submitted yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myCashRequests.map((req) => {
                      const isPending = req.status === 'pending';
                      const isApproved = req.status === 'approved';

                      return (
                        <div
                          key={req.id}
                          className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-white text-sm">
                                ₹{req.requestedAmount}
                              </span>
                              <span
                                className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${
                                  isPending
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                    : isApproved
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                    : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                }`}
                              >
                                {req.status}
                              </span>
                              {req.approvedAmount !== undefined && (
                                <span className="text-[11px] text-emerald-400 font-mono font-bold">
                                  Approved: ₹{req.approvedAmount}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-300 leading-relaxed break-words">
                              {req.reason}
                            </p>

                            {req.adminNote && (
                              <p className="text-[10px] text-cyan-300 italic mt-1 bg-cyan-950/40 p-1.5 rounded-lg border border-cyan-800/40">
                                <strong>Admin Note:</strong> {req.adminNote}
                              </p>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 3: TRANSACTION AUDIT HISTORY
              ========================================================= */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {/* Filter Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                {(['all', 'deposit', 'game', 'bonus'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`px-3 py-1 rounded-xl capitalize font-bold transition shrink-0 ${
                      historyFilter === filter
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {filter === 'all' ? 'All Transactions' : filter}
                  </button>
                ))}
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="py-8 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                  <Coins className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold">No transactions found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTransactions.map((tx) => {
                    const isCredit = tx.amount > 0;
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isCredit ? 'bg-emerald-400' : 'bg-amber-400'
                              }`}
                            />
                            <h4 className="font-bold text-white truncate text-xs">{tx.description}</h4>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                            <span>{new Date(tx.createdAt).toLocaleString()}</span>
                            <span>•</span>
                            <span
                              onClick={() => handleCopy(tx.referenceId)}
                              className="font-mono cursor-pointer hover:text-slate-200 flex items-center gap-0.5"
                              title="Click to copy Ref ID"
                            >
                              Ref: {tx.referenceId}
                              {copiedRef === tx.referenceId ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-mono font-black text-sm block ${
                              isCredit ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {isCredit ? '+' : ''}
                            {tx.amount}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase font-bold">
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Policy Badge */}
        <div className="p-3 bg-[#0a0f1d] border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% Protected Ledger &amp; RBI Gateway Compliance
          </span>
          <button onClick={onClose} className="hover:text-white font-bold">
            Close
          </button>
        </div>
      </div>

      {/* =========================================================
          CHECKOUT CONFIRMATION MODAL
          ========================================================= */}
      {(selectedPackage || isCustomCheckout) && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0f1b34] border border-blue-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Secure Checkout
              </h3>
              <button
                onClick={() => {
                  setSelectedPackage(null);
                  setIsCustomCheckout(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order Summary */}
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Item</span>
                <span className="text-white font-bold">
                  {isCustomCheckout ? 'Custom Coins Top-Up' : selectedPackage?.title}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Coins to Receive</span>
                <span className="text-amber-400 font-mono font-bold">
                  {isCustomCheckout
                    ? `${customAmount} Coins`
                    : `${(selectedPackage?.coins || 0) + (selectedPackage?.bonusCoins || 0)} Coins`}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800 text-sm">
                <span className="font-bold text-white">Amount to Pay</span>
                <span className="text-emerald-400 font-mono font-black">
                  ₹{isCustomCheckout ? customAmount : selectedPackage?.priceInr}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Choose Payment Gateway Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'upi', label: 'UPI / QR', icon: QrCode },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'netbanking', label: 'NetBank', icon: Building },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCheckoutMethod(m.id as any)}
                      className={`p-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 ${
                        checkoutMethod === m.id
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentError && (
              <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {paymentError}
              </p>
            )}

            <button
              onClick={handleConfirmPayment}
              disabled={isProcessingPayment}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              {isProcessingPayment ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying on Server...</span>
                </>
              ) : (
                <span>
                  Confirm &amp; Pay ₹
                  {isCustomCheckout ? customAmount : selectedPackage?.priceInr}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          PAYMENT SUCCESS MODAL
          ========================================================= */}
      {paymentSuccessData && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0f1f3a] border-2 border-emerald-500/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-3 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-white">Payment Successful!</h3>
            <p className="text-xs text-slate-300">
              Your payment of <strong className="text-emerald-400">₹{paymentSuccessData.amount}</strong> was
              verified on the server.
            </p>

            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 font-mono text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Coins Credited:</span>
                <span className="text-amber-400 font-bold">+{paymentSuccessData.coins} Coins</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Reference ID:</span>
                <span className="text-white">{paymentSuccessData.orderId}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setPaymentSuccessData(null);
                setActiveTab('history');
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-md"
            >
              View in Wallet History
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
