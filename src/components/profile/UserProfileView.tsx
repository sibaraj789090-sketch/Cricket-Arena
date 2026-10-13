import React, { useState } from 'react';
import {
  Shield,
  Users,
  LogOut,
  BookOpen,
  Coins,
  ArrowDownToLine,
  Lock,
  UserCheck,
  Smartphone,
  Mail,
  UserPlus,
  LogIn,
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
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  onOpenCreateTeam,
  onOpenLeaderboard,
  onOpenRules,
  onOpenAdmin,
  onOpenWallet,
}) => {
  const { user, isAdmin, isGuest, logout, logoutAdmin } = useAuth();
  const { tournaments, virtualTeams, joinedTournamentIds } = useTournament();
  const { wallet, settings } = useWallet();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  const myVirtualTeams = virtualTeams.filter((vt) => vt.userId === user?.id);
  const myTournaments = tournaments.filter((t) => joinedTournamentIds.includes(t.id));

  const totalPoints = myVirtualTeams.reduce((sum, vt) => sum + vt.totalPoints, 0);

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  return (
    <div className="space-y-4">
      {/* Profile Overview Card */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={
                  user?.avatarUrl ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'
                }
                alt={user?.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-md"
              />
              {isAdmin && (
                <span
                  className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow"
                  title="Admin Role"
                >
                  <Shield className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">{user?.name}</h2>
                <span
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    isAdmin
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {isAdmin ? 'ADMINISTRATOR' : user?.role || 'PLAYER'}
                </span>
              </div>
              <p className="text-xs text-slate-400">{user?.email}</p>
              <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                100% Free Member • Fair Play Verified
              </p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800/80 text-center">
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
            <span className="font-mono text-base font-extrabold text-emerald-400">
              {myVirtualTeams.length}
            </span>
            <p className="text-[10px] text-slate-400 font-medium">Virtual Squads</p>
          </div>
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
            <span className="font-mono text-base font-extrabold text-white">
              {myTournaments.length}
            </span>
            <p className="text-[10px] text-slate-400 font-medium">Joined Contests</p>
          </div>
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
            <span className="font-mono text-base font-extrabold text-amber-400">
              {totalPoints.toFixed(1)}
            </span>
            <p className="text-[10px] text-slate-400 font-medium">Career Points</p>
          </div>
        </div>
      </div>

      {/* Coins Wallet Card */}
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

      {/* Account Authentication Options */}
      {authMode === 'view' ? (
        <div className="flex gap-2">
          <button
            onClick={() => setAuthMode('login')}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
          >
            Sign In with Supabase
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold text-emerald-300 transition cursor-pointer"
          >
            Register Free Account
          </button>
        </div>
      ) : (
        <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {authMode === 'login' ? 'Sign In to Cricket Arena' : 'Register Free Cricket Fan Profile'}
            </h3>
            <button
              onClick={() => setAuthMode('view')}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-2.5">
            {authMode === 'signup' && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Virat Fan"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            )}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cricketfan@example.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>

            {authError && <p className="text-xs text-rose-400">{authError}</p>}

            <button
              type="submit"
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 text-xs rounded-xl transition shadow cursor-pointer"
            >
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      )}

      {/* Rules & Policies Link */}
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

      {/* Administrator Status / Portal Access */}
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

      {/* My Virtual Teams List */}
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
    </div>
  );
};
