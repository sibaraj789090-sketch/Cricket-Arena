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
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { useAuth } from '../../context/AuthContext';
import { CoinPackage, PayoutMethod } from '../../types/wallet';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'deposit' | 'withdraw' | 'history';
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
    withdrawals,
    buyCoins,
    requestWithdrawal,
    refreshWallet,
    isProcessingPayment,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>(initialTab);

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

  // Withdrawal State
  const [withdrawAmount, setWithdrawAmount] = useState<number>(500);
  const [withdrawMethod, setWithdrawMethod] = useState<PayoutMethod>('upi');
  const [upiId, setUpiId] = useState<string>('');
  const [accountHolderName, setAccountHolderName] = useState<string>(user?.name || '');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [withdrawError, setWithdrawError] = useState<string>('');
  const [withdrawSuccess, setWithdrawSuccess] = useState<string>('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState<boolean>(false);

  // History Filter
  const [historyFilter, setHistoryFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'bonus'>('all');
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

  // Submit Withdrawal Request
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');

    if (withdrawAmount < settings.minWithdrawalInr) {
      setWithdrawError(`Minimum withdrawal is ₹${settings.minWithdrawalInr}`);
      return;
    }
    if (withdrawAmount > settings.maxWithdrawalInr) {
      setWithdrawError(`Maximum withdrawal is ₹${settings.maxWithdrawalInr}`);
      return;
    }
    if (withdrawAmount > wallet.balance) {
      setWithdrawError(`Insufficient balance! Available: ${wallet.balance} coins`);
      return;
    }

    if (withdrawMethod === 'upi') {
      if (!upiId || !upiId.includes('@')) {
        setWithdrawError('Please enter a valid UPI ID (e.g. mobile@upi or username@bank)');
        return;
      }
    } else {
      if (!bankAccountNumber || bankAccountNumber.length < 9) {
        setWithdrawError('Please enter a valid bank account number');
        return;
      }
      if (!ifscCode || ifscCode.length < 4) {
        setWithdrawError('Please enter a valid IFSC code (e.g. HDFC0001234)');
        return;
      }
    }

    setIsSubmittingWithdrawal(true);
    const result = await requestWithdrawal(withdrawAmount, withdrawMethod, {
      upiId: withdrawMethod === 'upi' ? upiId.trim() : undefined,
      accountHolderName: accountHolderName.trim(),
      bankAccountNumber: withdrawMethod === 'bank_transfer' ? bankAccountNumber.trim() : undefined,
      ifscCode: withdrawMethod === 'bank_transfer' ? ifscCode.trim().toUpperCase() : undefined,
      bankName: withdrawMethod === 'bank_transfer' ? bankName.trim() : undefined,
    });

    setIsSubmittingWithdrawal(false);

    if (result.success) {
      setWithdrawSuccess(`Withdrawal request of ₹${withdrawAmount} submitted! Admin will verify and process.`);
      setWithdrawAmount(settings.minWithdrawalInr);
      setUpiId('');
      setBankAccountNumber('');
      setIfscCode('');
    } else {
      setWithdrawError(result.error || 'Failed to submit withdrawal request.');
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((t) => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'deposit') return t.type === 'deposit';
    if (historyFilter === 'withdrawal') return t.type === 'withdrawal';
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
                  <Lock className="w-3 h-3" /> In Withdrawal / Match
                </span>
                <span className="text-sm font-mono font-bold text-slate-200">
                  ₹{wallet.lockedBalance} Cash
                </span>
              </div>
            )}
          </div>

          {/* Real Cash Disclaimer Requirement */}
          <div className="mt-3 p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-[11px] text-amber-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-200">
                “Real Cash only — Real Money. Cash Winnings. And Withdrawals.”
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Top-up and play verified real cash matches. Transparent ledger balances and instant withdrawal support.
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
              onClick={() => setActiveTab('withdraw')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'withdraw'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              <span>Withdraw</span>
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
              TAB 2: WITHDRAWAL SYSTEM
              ========================================================= */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4">
              {/* Withdrawal Limits Banner */}
              <div className="p-2.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Withdrawal Limits:
                </span>
                <span className="font-mono font-bold">
                  Min ₹{settings.minWithdrawalInr} • Max ₹{settings.maxWithdrawalInr.toLocaleString()}
                </span>
              </div>

              {/* Withdrawal Request Form */}
              <form onSubmit={handleSubmitWithdrawal} className="p-3.5 rounded-2xl bg-[#0f1d38]/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Request Payout
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Balance: {wallet.balance} Coins
                  </span>
                </div>

                {/* Amount to Withdraw */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Withdrawal Amount (INR)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={settings.minWithdrawalInr}
                        max={Math.min(settings.maxWithdrawalInr, wallet.balance)}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(Math.min(wallet.balance, settings.maxWithdrawalInr))}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Method Selector: UPI vs Bank */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Payout Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('upi')}
                      className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        withdrawMethod === 'upi'
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : 'bg-slate-900 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Instant UPI ID</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('bank_transfer')}
                      className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        withdrawMethod === 'bank_transfer'
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : 'bg-slate-900 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Bank Account</span>
                    </button>
                  </div>
                </div>

                {/* UPI Fields */}
                {withdrawMethod === 'upi' ? (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      UPI ID (VPA)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. mobile@upi or username@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>
                ) : (
                  /* Bank Fields */
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        placeholder="Enter full account number"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SBIN0001234"
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-amber-400"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Account Holder Name */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Beneficiary Name
                  </label>
                  <input
                    type="text"
                    placeholder="Full Name as on bank/UPI record"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                {withdrawError && <p className="text-xs text-rose-400 font-medium">{withdrawError}</p>}
                {withdrawSuccess && <p className="text-xs text-emerald-400 font-medium">{withdrawSuccess}</p>}

                <button
                  type="submit"
                  disabled={isSubmittingWithdrawal || wallet.balance < settings.minWithdrawalInr}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition shadow-md active:scale-95"
                >
                  {isSubmittingWithdrawal ? 'Submitting Request...' : `Submit Withdrawal (₹${withdrawAmount})`}
                </button>
              </form>

              {/* Past Withdrawal Requests */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  My Withdrawal Requests
                </h3>
                {withdrawals.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                    No withdrawal requests yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {withdrawals.map((w) => {
                      const isPending = w.status === 'pending';
                      const isApproved = w.status === 'approved';

                      return (
                        <div
                          key={w.id}
                          className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-sm">
                                ₹{w.amountInr}
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
                                {w.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {w.payoutMethod.toUpperCase()}:{' '}
                              {w.payoutDetails.upiId || w.payoutDetails.bankAccountNumber}
                            </p>
                            {w.adminNotes && (
                              <p className="text-[10px] text-slate-400 italic mt-0.5">
                                Note: {w.adminNotes}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(w.createdAt).toLocaleDateString()}
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
                {(['all', 'deposit', 'withdrawal', 'bonus'] as const).map((filter) => (
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
