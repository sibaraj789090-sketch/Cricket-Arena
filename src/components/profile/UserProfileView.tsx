import React, { useState } from 'react';
import {
  Shield,
  Users,
  LogOut,
  BookOpen,
  Coins,
  ArrowDownToLine,
  Lock,
  Smartphone,
  Mail,
  LogIn,
  CheckCircle2,
  Sparkles,
  Gift,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTournament } from '../../context/TournamentContext';
import { useWallet } from '../../context/WalletContext';
import { Tournament } from '../../types';
import { AuthModal } from '../auth/AuthModal';

interface UserProfileViewProps {
  onOpenCreateTeam: (tournament: Tournament) => void;
  onOpenLeaderboard: (tournament: Tournament) => void;
  onOpenRules: () => void;
  onOpenAdmin: () => void;
  onOpenWallet: () => void;
  onOpenRefer?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  onOpenCreateTeam,
  onOpenLeaderboard,
  onOpenRules,
  onOpenAdmin,
  onOpenWallet,
  onOpenRefer,
}) => {
  const { user, isAdmin, isGuest, logout, logoutAdmin } = useAuth();
  const { tournaments, virtualTeams, joinedTournamentIds } = useTournament();
  const { wallet, settings } = useWallet();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const myVirtualTeams = virtualTeams.filter((vt) => vt.userId === user?.id);
  const myTournaments = tournaments.filter((t) => joinedTournamentIds.includes(t.id));
  const totalPoints = myVirtualTeams.reduce((sum, vt) => sum + vt.totalPoints, 0);

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    if (isAdmin) {
      await logoutAdmin();
    } else {
      await logout();
    }
  };

  // Format joined date nicely if available
  const joinedDateFormatted = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Active Member';

  return (
    <div className="space-y-4">
      {/* ========================================================
          GUEST CALL-TO-ACTION BANNER (IF PLAYING AS GUEST)
          ======================================================== */}
      {isGuest && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/80 via-[#0d1f38] to-[#071324] border border-emerald-500/40 p-4 sm:p-5 shadow-2xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-900/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Guest Mode Active
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white">
              Create a Free Account or Sign In
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
              Save your fantasy squads, wallet coins, and tournament trophies across devices.
              Sign up or log in instantly using your <strong>Gmail address</strong> or <strong>Mobile number</strong> with <strong>Zero OTP verification</strong>!
            </p>

            <div className="flex flex-wrap gap-2.5 mt-3.5">
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Register Free (No OTP)</span>
              </button>
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-98 text-white font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign In (Gmail / Mobile)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          USER PROFILE OVERVIEW CARD
          ======================================================== */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src={
                  user?.avatarUrl ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'
                }
                alt={user?.name || 'User'}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-md"
              />
              {isAdmin ? (
                <span
                  className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow"
                  title="Administrator Role"
                >
                  <Shield className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              ) : (
                <span
                  className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1 rounded-full shadow"
                  title="Verified Player"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  {user?.name || 'Cricket Player'}
                </h2>
                <span
                  className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                    isAdmin
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : isGuest
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isAdmin ? 'ADMINISTRATOR' : isGuest ? 'GUEST FAN' : 'VERIFIED PLAYER'}
                </span>
              </div>

              {/* User identifier and contact details */}
              <div className="space-y-0.5 mt-1">
                {user?.email && (
                  <p className="text-xs text-slate-300 flex items-center gap-1.5 font-mono">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{user.email}</span>
                  </p>
                )}
                {user?.phone && (
                  <p className="text-xs text-slate-300 flex items-center gap-1.5 font-mono">
                    <Smartphone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>+91 {user.phone}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                  <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    ID: {user?.id?.slice(0, 16) || 'usr-guest'}
                  </span>
                  <span>•</span>
                  <span>Joined: {joinedDateFormatted}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Logout Button */}
          {!isGuest && (
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 border border-slate-700/80 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800 text-center">
          <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-mono text-base font-extrabold text-emerald-400">
              {myVirtualTeams.length}
            </span>
            <p className="text-[10px] text-slate-400 font-medium">Virtual Squads</p>
          </div>
          <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-mono text-base font-extrabold text-white">
              {myTournaments.length}
            </span>
            <p className="text-[10px] text-slate-400 font-medium">Joined Contests</p>
          </div>
          <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
            <span className="font-mono text-base font-extrabold text-amber-400">
              {totalPoints.toFixed(1)}
            </span>
            <p className="text-[10px] text-slate-400 font-medium">Career Points</p>
          </div>
        </div>

        {/* Switch Account Option for Logged-In Users */}
        {!isGuest && (
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px]">Signed in as {user?.name}</span>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer"
            >
              Switch Account &rarr;
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          COINS WALLET CARD
          ======================================================== */}
      <div className="bg-gradient-to-r from-[#0c1a36] via-[#0f2247] to-[#0c1a36] rounded-2xl border border-blue-900/60 p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Coins className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">Coins Wallet</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400">
                Verified
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-amber-400 font-mono">
                {wallet.balance.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-amber-300">COINS</span>
              <span className="text-[11px] text-slate-400">
                (≈ ₹{wallet.balance.toLocaleString()})
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Min Deposit ₹{settings.minDepositInr} • Min Withdrawal ₹{settings.minWithdrawalInr}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenWallet}
          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>Wallet</span>
        </button>
      </div>

      {/* ========================================================
          REFER & EARN FEATURE CARD
          ======================================================== */}
      <div className="bg-gradient-to-r from-amber-950/40 via-[#161f36] to-[#0c1424] rounded-2xl border border-amber-500/40 p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
              <Gift className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  Refer &amp; Earn
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ₹50 Bonus Per Friend
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mt-0.5">
                Invite Friends &amp; Win Unlimited Bonus Coins
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Earn ₹50 per friend who signs up. Your friend gets ₹50 Welcome Bonus too!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenRefer}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-95 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Invite Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* User Referral Quick Info */}
        {!isGuest && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-slate-300">
              <span>Your Invite Code:</span>
              <span className="font-mono font-black text-amber-400 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-700 tracking-wider">
                {user?.referralCode || 'ROHIT77'}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenRefer}
              className="text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
            >
              Open Dashboard &rarr;
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          RULES, POLICIES & FAIR PLAY
          ======================================================== */}
      <div className="text-xs">
        <button
          onClick={onOpenRules}
          className="w-full p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-white">Rules, Policies &amp; Fair Play</p>
              <p className="text-[10px] text-slate-400">Zero Betting • Skill Gaming • Cricket &amp; Ludo Rules</p>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">View &rarr;</span>
        </button>
      </div>

      {/* ========================================================
          ADMINISTRATOR PORTAL ACCESS (SEPARATE & SECURE)
          ======================================================== */}
      {isAdmin ? (
        <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/40 p-3.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-amber-300">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <p className="font-bold text-xs">Administrator Mode Active</p>
              <p className="text-[11px] text-slate-300">Authorized manager controls unlocked.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAdmin}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
            >
              Dashboard
            </button>
            <button
              onClick={() => logoutAdmin()}
              className="bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 font-semibold px-2.5 py-1.5 rounded-xl text-xs border border-slate-700 transition cursor-pointer"
              title="Log Out Administrator"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-2 text-center">
          <button
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-[11px] font-medium transition cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-900"
          >
            <Lock className="w-3 h-3" />
            <span>Administrator Portal Access</span>
          </button>
        </div>
      )}

      {/* ========================================================
          MY VIRTUAL SQUADS LIST
          ======================================================== */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          My Virtual Squads ({myVirtualTeams.length})
        </h3>

        {myVirtualTeams.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            You haven&apos;t created any virtual cricket teams yet. Join a free tournament to build your dream XI!
          </p>
        ) : (
          <div className="space-y-2">
            {myVirtualTeams.map((team) => {
              const tour = tournaments.find((t) => t.id === team.tournamentId);

              return (
                <div
                  key={team.id}
                  className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{team.teamName}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 rounded font-mono">
                        {team.totalPoints} pts
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {tour?.title || 'Cricket Match'} • {team.playerIds.length} Players Selected
                    </p>
                  </div>

                  {tour && (
                    <div className="flex gap-2">
                      {tour.status !== 'completed' && (
                        <button
                          onClick={() => onOpenCreateTeam(tour)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 transition cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => onOpenLeaderboard(tour)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer"
                      >
                        Rankings
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================
          LOGOUT CONFIRMATION MODAL
          ======================================================== */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-5 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sign Out of Cricket Arena?</h3>
              <p className="text-xs text-slate-400 mt-1">
                You will be switched to Guest Mode. You can log back in at any time with your registered Gmail address or Mobile number.
              </p>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          USER AUTHENTICATION MODAL (SIGN IN / REGISTER)
          ======================================================== */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />
    </div>
  );
};
