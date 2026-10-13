import React, { useState } from 'react';
import { ShieldCheck, Download, Database, UserCheck, Wifi, WifiOff, Coins } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useWallet } from '../../context/WalletContext';

interface HeaderProps {
  onOpenSetupGuide: () => void;
  onOpenRules: () => void;
  onOpenAdmin: () => void;
  onOpenWallet: () => void;
  activeGameMode?: 'cricket' | 'ludo';
  onToggleGameMode?: (mode: 'cricket' | 'ludo') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSetupGuide,
  onOpenRules,
  onOpenAdmin,
  onOpenWallet,
  activeGameMode = 'cricket',
  onToggleGameMode,
}) => {
  const { user, isAdmin, loginAsAdmin, logout } = useAuth();
  const { wallet, settings } = useWallet();
  const { isInstallable, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = loginAsAdmin(adminPasscode);
    if (success) {
      setShowAdminPrompt(false);
      setAdminPasscode('');
      setAdminError('');
      onOpenAdmin();
    } else {
      setAdminError('Invalid passcode! Hint: arena2026 or admin');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0a0f1d]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold text-lg">
              🏏
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-teko text-2xl tracking-wide uppercase font-bold text-white leading-none">
                  CRICKET<span className="text-emerald-400">ARENA</span>
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  REAL CASH &amp; SKILL
                </span>
              </div>
              <p className="text-[10px] text-slate-300 leading-tight">
                Online Skill Games • Top-up and Play • Real Cash Games
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Game Mode Switcher: Cricket vs Ludo */}
            {onToggleGameMode && (
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5 shadow-inner">
                <button
                  onClick={() => onToggleGameMode('cricket')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition flex items-center gap-1 cursor-pointer ${
                    activeGameMode === 'cricket'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🏏</span>
                  <span className="text-[11px]">Cricket</span>
                </button>
                <button
                  onClick={() => onToggleGameMode('ludo')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition flex items-center gap-1 cursor-pointer ${
                    activeGameMode === 'ludo'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🎲</span>
                  <span className="text-[11px]">Ludo</span>
                </button>
              </div>
            )}

            {/* Coins Wallet Badge & Quick Top-Up */}
            <button
              onClick={onOpenWallet}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 hover:from-amber-500/30 hover:to-amber-500/30 border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded-xl text-xs font-black transition shadow-sm active:scale-95 cursor-pointer"
              title="Coins Wallet - Tap to Top-Up or Withdraw"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-mono text-white text-[13px]">{wallet?.balance?.toLocaleString() ?? 0}</span>
              <span className="text-[10px] bg-amber-400 text-slate-950 font-black rounded-full px-1 py-0 leading-tight">
                +
              </span>
            </button>

            {/* Online/Offline Status Indicator */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${
                isOnline
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                  : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
              }`}
              title={isOnline ? 'Online - Live Sync Active' : 'Offline Mode - Cached Data Active'}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3 text-amber-400" />}
              <span className="hidden sm:inline">{isOnline ? 'Live' : 'Offline'}</span>
            </div>

            {/* PWA Install Button */}
            {isInstallable && (
              <button
                onClick={install}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}

            {/* Supabase Hindi Setup Guide */}
            <button
              onClick={onOpenSetupGuide}
              className="flex items-center gap-1 text-slate-300 hover:text-emerald-300 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 px-2 py-1 rounded-lg text-xs font-medium transition"
              title="Database & Hindi Setup Guide"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">SQL / सेटअप</span>
            </button>

            {/* Admin Portal Toggle */}
            {isAdmin ? (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-1 rounded-lg text-xs font-bold transition hover:bg-amber-500/30"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAdminPrompt(true)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded border border-slate-800 hover:border-slate-700 transition"
                title="Admin Login"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Policy & Wallet Sub-banner */}
      <div className="bg-emerald-950/40 border-b border-emerald-900/40 py-1 px-4 text-center">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-[11px] text-emerald-300">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              <strong>Coins Wallet:</strong> Min Deposit ₹{settings.minDepositInr} • Min Withdrawal ₹{settings.minWithdrawalInr} • 100% Verified Ledger.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenWallet}
              className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
            >
              Top-Up / Withdraw
            </button>
            <span className="text-slate-600">•</span>
            <button
              onClick={onOpenRules}
              className="hover:text-emerald-200 font-medium cursor-pointer"
            >
              Rules
            </button>
          </div>
        </div>
      </div>

      {/* Admin Quick Unlock Modal */}
      {showAdminPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl p-5 max-w-sm w-full shadow-2xl text-slate-100">
            <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold">
              <UserCheck className="w-5 h-5" />
              <h3 className="text-base">Admin Dashboard Login</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Enter Administrator Passcode to manage tournaments, update match player scores, or adjust points rules.
            </p>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Passcode (Default: arena2026 or admin)
                </label>
                <input
                  type="password"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  placeholder="Enter passcode"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>
              {adminError && <p className="text-xs text-rose-400">{adminError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminPrompt(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
                >
                  Unlock Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
