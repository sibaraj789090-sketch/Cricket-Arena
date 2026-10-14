/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Trophy,
  Flame,
  Calendar,
  Users,
  ShieldCheck,
  Award,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Info,
  Clock,
  Play,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WalletProvider } from './context/WalletContext';
import { TournamentProvider, useTournament } from './context/TournamentContext';
import { Tournament } from './types';
import { Header } from './components/common/Header';
import { BottomNav, NavTab } from './components/common/BottomNav';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { UpdateNotification } from './components/common/UpdateNotification';
import { TournamentCard } from './components/tournament/TournamentCard';
import { TournamentDetailsModal } from './components/tournament/TournamentDetailsModal';
import { CreateTeamModal } from './components/team/CreateTeamModal';
import { LeaderboardView } from './components/leaderboard/LeaderboardView';
import { UserProfileView } from './components/profile/UserProfileView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLoginView } from './components/admin/AdminLoginView';
import { RulesAndPolicies } from './components/legal/RulesAndPolicies';
import { LudoCashLobbyView } from './components/ludo/LudoCashLobbyView';
import { LudoOnlineMatchView } from './components/ludo/LudoOnlineMatchView';
import { LudoTournamentView } from './components/ludo/LudoTournamentView';
import { WalletModal } from './components/wallet/WalletModal';
import { AuthModal } from './components/auth/AuthModal';
import { ReferAndEarnModal } from './components/referral/ReferAndEarnModal';

function CricketArenaApp() {
  const { user, isAdmin } = useAuth();
  const { tournaments, virtualTeams, joinedTournamentIds } = useTournament();

  const [activeGameMode, setActiveGameMode] = useState<'cricket' | 'ludo'>('cricket');
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [activeLudoMatchId, setActiveLudoMatchId] = useState<string | null>(null);
  const [selectedTournamentForTeam, setSelectedTournamentForTeam] = useState<Tournament | null>(null);
  const [selectedTournamentForDetails, setSelectedTournamentForDetails] = useState<Tournament | null>(null);
  const [leaderboardTourId, setLeaderboardTourId] = useState<string>('');

  // Modals
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showWalletModal, setShowWalletModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showReferModal, setShowReferModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [rulesDefaultSection, setRulesDefaultSection] = useState<'rules' | 'points' | 'terms' | 'privacy' | 'contact'>('rules');

  // Tournaments filter
  const [tournamentFilter, setTournamentFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');

  const myVirtualTeams = virtualTeams.filter((vt) => vt.userId === user?.id);

  const filteredTournaments = tournaments.filter((t) => {
    if (tournamentFilter === 'all') return true;
    return t.status === tournamentFilter;
  });

  const featuredTournament = tournaments.find((t) => t.status === 'live') || tournaments[0];

  const handleOpenRules = (section: 'rules' | 'points' | 'terms' | 'privacy' | 'contact' = 'rules') => {
    setRulesDefaultSection(section);
    setShowRulesModal(true);
  };

  const handleOpenAuth = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const handleOpenLeaderboard = (tournament: Tournament) => {
    setLeaderboardTourId(tournament.id);
    setCurrentTab('rankings');
  };

  const isPlayingLudoMatch = currentTab === 'ludo-match' && Boolean(activeLudoMatchId);

  // Dedicated Full-Screen Gameplay View
  // Hides top header, logo, tagline, cricket/ludo switcher, banners, and bottom navigation
  if (isPlayingLudoMatch && activeLudoMatchId) {
    return (
      <div className="fixed inset-0 z-50 bg-[#070b14] text-slate-100 flex flex-col overflow-hidden select-none">
        <LudoOnlineMatchView
          matchId={activeLudoMatchId}
          onExit={() => setActiveLudoMatchId(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenRules={() => handleOpenRules('terms')}
        onOpenAdmin={() => setCurrentTab('admin')}
        onOpenWallet={() => setShowWalletModal(true)}
        onOpenAuth={() => handleOpenAuth('login')}
        onOpenProfile={() => setCurrentTab('profile')}
        onOpenRefer={() => setShowReferModal(true)}
        activeGameMode={activeGameMode}
        onToggleGameMode={(mode) => {
          setActiveGameMode(mode);
          if (mode === 'ludo') {
            setCurrentTab('ludo-match');
          } else {
            setCurrentTab('home');
          }
        }}
      />

      {/* PWA Install Promotion Banner */}
      <PWAInstallBanner />

      {/* Offline Status */}
      <OfflineIndicator />

      {/* PWA Update Toast */}
      <UpdateNotification />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4 pt-3 pb-24 sm:pb-20">
        {/* ========================================================
            TAB 1: HOME PAGE
            ======================================================== */}
        {currentTab === 'home' && (
          <div className="space-y-4">
            {/* Hero Live Match Spotlight */}
            {featuredTournament && (
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-950 via-[#0d1629] to-[#070b14] border border-emerald-500/30 p-4 sm:p-6 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        FEATURED MATCH
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                        {featuredTournament.format}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
                      100% Free Entry
                    </span>
                  </div>

                  <h1 className="font-teko text-3xl sm:text-4xl font-bold tracking-wide text-white uppercase leading-none">
                    {featuredTournament.title}
                  </h1>
                  <p className="text-xs text-slate-300 mt-1 max-w-lg">
                    Build your virtual squad of 11 cricket champions within 100 credits. Earn live points with Captain (2x) &amp; Vice-Captain (1.5x) multipliers!
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => setSelectedTournamentForTeam(featuredTournament)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4 stroke-[2.5]" />
                      <span>Join Free &amp; Pick 11</span>
                    </button>

                    <button
                      onClick={() => handleOpenLeaderboard(featuredTournament)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition border border-slate-700/80 cursor-pointer"
                    >
                      View Live Standings
                    </button>

                    <span className="text-xs text-slate-400 ml-auto hidden sm:inline">
                      {featuredTournament.enrolledCount.toLocaleString()} Cricket Fans Joined
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Metrics Ticker */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#0f172a] p-3 rounded-2xl border border-slate-800/80 shadow">
                <span className="font-mono text-base sm:text-lg font-black text-emerald-400">
                  {tournaments.length}
                </span>
                <p className="text-[11px] text-slate-400 font-medium">Free Contests</p>
              </div>
              <div className="bg-[#0f172a] p-3 rounded-2xl border border-slate-800/80 shadow">
                <span className="font-mono text-base sm:text-lg font-black text-white">
                  100.0 Cr
                </span>
                <p className="text-[11px] text-slate-400 font-medium">Squad Budget</p>
              </div>
              <div className="bg-[#0f172a] p-3 rounded-2xl border border-slate-800/80 shadow">
                <span className="font-mono text-base sm:text-lg font-black text-amber-400">
                  2.0x / 1.5x
                </span>
                <p className="text-[11px] text-slate-400 font-medium">C &amp; VC Boost</p>
              </div>
            </div>

            {/* How It Works (Simple 3 Steps) */}
            <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  How to Play on Cricket Arena
                </h3>
                <button
                  onClick={() => handleOpenRules('rules')}
                  className="text-[11px] text-emerald-400 hover:underline font-semibold"
                >
                  Rules
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/60">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center mb-1.5">
                    1
                  </span>
                  <p className="font-bold text-white mb-0.5">Select a Tournament</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    100% free entry. Pick any live or upcoming cricket match contest.
                  </p>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/60">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center mb-1.5">
                    2
                  </span>
                  <p className="font-bold text-white mb-0.5">Build Your Dream XI</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Pick 11 stars within 100 credits. Assign Captain (2x) and Vice-Captain (1.5x).
                  </p>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/60">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center mb-1.5">
                    3
                  </span>
                  <p className="font-bold text-white mb-0.5">Climb the Leaderboard</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Runs, wickets &amp; catches earn points. Track live rank updates.
                  </p>
                </div>
              </div>
            </div>

            {/* Online Real Cash Ludo Tables Showcase */}
            <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-emerald-950/40 rounded-2xl border border-emerald-500/30 p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base">
                    🎲
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                      <span>Online Real Cash Ludo</span>
                      <span className="text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded font-black">
                        CASH TABLES
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/90 px-1.5 py-0.5 rounded border border-emerald-500/40 animate-live-pulse shadow-sm shadow-emerald-500/20">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        LIVE ONLINE GAME
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Join 2-Player &amp; 4-Player cash tables from ₹5 up to ₹25,000. Authoritative multiplayer!
                    </p>
                  </div>
                </div>

                <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  Real Winnings
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Cash Tables Card */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-base">💰</span>
                      <h3 className="text-xs font-bold text-white">Choose Your Ludo Table</h3>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-mono font-bold">21 Tables</span>
                      <span className="inline-flex items-center gap-1 text-[8.5px] font-bold text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/30 animate-live-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        LIVE ONLINE GAME
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                      ₹5 to ₹25,000 real cash tables. 2-player 1v1 and 4-player formats with live matchmaking queues.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveGameMode('ludo');
                      setCurrentTab('ludo-match');
                    }}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Enter Cash Tables</span>
                  </button>
                </div>

                {/* Tournament Card */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🏆</span>
                      <h3 className="text-xs font-bold text-white">Ludo Championships</h3>
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 rounded">Brackets</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                      Knockout championship brackets for competitive skill ranking and tournament glory!
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveGameMode('ludo');
                      setCurrentTab('ludo-tournaments');
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>View Championships</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Upcoming Cricket Tournaments Header & List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Cricket Tournaments
                  </h2>
                </div>
                <button
                  onClick={() => setCurrentTab('tournaments')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {tournaments.slice(0, 3).map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    onOpenDetails={(t) => setSelectedTournamentForDetails(t)}
                    onOpenCreateTeam={(t) => setSelectedTournamentForTeam(t)}
                    onOpenLeaderboard={handleOpenLeaderboard}
                  />
                ))}
              </div>
            </div>

            {/* Real Cash -Based Skill Gaming Platform Footer Disclaimer */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Real Cash -Based Skill Gaming Platform
              </h4>
              <p className="text-[11px] text-slate-300 max-w-md mx-auto mt-1 leading-relaxed">
                “Cricket Arena offers free-to-play skill games and virtual Real Cash-based games. Cash are for in-game only. They are real money, be withdrawn, and be exchanged for cash or real-money rewards. Game availability depends on live online players and server status.”
              </p>
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                <span>Fair Play Verified • Secure Online Ledger • Transparent Match Rules</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: TOURNAMENTS LIST & FILTERS
            ======================================================== */}
        {currentTab === 'tournaments' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-base font-bold text-white uppercase tracking-wider">
                Cricket Tournaments
              </h1>
              <p className="text-xs text-slate-400">
                Explore all free cricket matches and pick your virtual squad.
              </p>
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Matches' },
                { id: 'live', label: '🔴 Live Now' },
                { id: 'upcoming', label: '⏳ Upcoming' },
                { id: 'completed', label: '🏁 Completed' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setTournamentFilter(filter.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    tournamentFilter === filter.id
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-[#0f172a] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Tournaments Grid */}
            <div className="space-y-3">
              {filteredTournaments.length === 0 ? (
                <div className="bg-[#0f172a] p-8 rounded-2xl text-center text-slate-400 text-xs border border-slate-800">
                  No tournaments match the selected filter.
                </div>
              ) : (
                filteredTournaments.map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    onOpenDetails={(t) => setSelectedTournamentForDetails(t)}
                    onOpenCreateTeam={(t) => setSelectedTournamentForTeam(t)}
                    onOpenLeaderboard={handleOpenLeaderboard}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: MY SQUADS & JOINED MATCHES
            ======================================================== */}
        {currentTab === 'my-teams' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-base font-bold text-white uppercase tracking-wider">
                My Virtual Squads ({myVirtualTeams.length})
              </h1>
              <p className="text-xs text-slate-400">
                Manage your 11-player lineups, track points, and inspect formations.
              </p>
            </div>

            {myVirtualTeams.length === 0 ? (
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                <Trophy className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-white">No Virtual Teams Created Yet</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Join any upcoming or live cricket tournament to pick your 11 players and compete for rankings.
                </p>
                <button
                  onClick={() => setCurrentTab('tournaments')}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  Browse Free Tournaments
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myVirtualTeams.map((team) => {
                  const tour = tournaments.find((t) => t.id === team.tournamentId);

                  return (
                    <div
                      key={team.id}
                      className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{team.teamName}</h3>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono font-bold">
                              11 PLAYERS
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Match: {tour?.title || 'Cricket Tournament'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-base font-black text-emerald-400">
                            {team.totalPoints.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-slate-400 block leading-none">PTS</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-400">
                          Status: <strong className="text-white capitalize">{tour?.status || 'Active'}</strong>
                        </span>

                        <div className="flex gap-2">
                          {tour && tour.status !== 'completed' && (
                            <button
                              onClick={() => setSelectedTournamentForTeam(tour)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold rounded-xl text-xs transition"
                            >
                              Edit XI
                            </button>
                          )}
                          {tour && (
                            <button
                              onClick={() => handleOpenLeaderboard(tour)}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
                            >
                              Leaderboard
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 4: LEADERBOARD & USER RANKINGS
            ======================================================== */}
        {currentTab === 'rankings' && (
          <LeaderboardView initialTournamentId={leaderboardTourId} />
        )}

        {/* ========================================================
            TAB 5: USER PROFILE & SETTINGS
            ======================================================== */}
        {currentTab === 'profile' && (
          <UserProfileView
            onOpenCreateTeam={(t) => setSelectedTournamentForTeam(t)}
            onOpenLeaderboard={handleOpenLeaderboard}
            onOpenRules={() => handleOpenRules('terms')}
            onOpenAdmin={() => setCurrentTab('admin')}
            onOpenWallet={() => setShowWalletModal(true)}
            onOpenRefer={() => setShowReferModal(true)}
          />
        )}

        {/* ========================================================
            TAB 6: ADMIN CONTROL PANEL
            ======================================================== */}
        {currentTab === 'admin' && (
          isAdmin ? (
            <AdminDashboard onExitAdmin={() => setCurrentTab('home')} />
          ) : (
            <AdminLoginView
              onLoginSuccess={() => setCurrentTab('admin')}
              onCancel={() => setCurrentTab('home')}
            />
          )
        )}

        {/* ========================================================
            TAB 7: LUDO CASH TABLES & MULTIPLAYER MATCH
            ======================================================== */}
        {currentTab === 'ludo-match' && (
          activeLudoMatchId ? (
            <LudoOnlineMatchView
              matchId={activeLudoMatchId}
              onExit={() => setActiveLudoMatchId(null)}
            />
          ) : (
            <LudoCashLobbyView
              onJoinMatch={(mId) => setActiveLudoMatchId(mId)}
              onOpenTopUp={() => setShowWalletModal(true)}
            />
          )
        )}

        {/* ========================================================
            TAB 8: LUDO TOURNAMENTS & BRACKETS
            ======================================================== */}
        {currentTab === 'ludo-tournaments' && (
          <LudoTournamentView onStartPracticeMatch={() => setCurrentTab('ludo-match')} />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        myTeamsCount={myVirtualTeams.length}
        activeGameMode={activeGameMode}
      />

      {/* MODALS */}
      {/* 1. Squad Builder Modal */}
      {selectedTournamentForTeam && (
        <CreateTeamModal
          tournament={selectedTournamentForTeam}
          isOpen={Boolean(selectedTournamentForTeam)}
          onClose={() => setSelectedTournamentForTeam(null)}
          onSuccess={() => {
            setCurrentTab('my-teams');
          }}
        />
      )}

      {/* 2. Match Details Modal */}
      {selectedTournamentForDetails && (
        <TournamentDetailsModal
          tournament={selectedTournamentForDetails}
          isOpen={Boolean(selectedTournamentForDetails)}
          onClose={() => setSelectedTournamentForDetails(null)}
          onOpenCreateTeam={(t) => setSelectedTournamentForTeam(t)}
          onOpenLeaderboard={handleOpenLeaderboard}
        />
      )}

      {/* 3. Rules & Policies Modal */}
      <RulesAndPolicies
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        defaultSection={rulesDefaultSection}
      />

      {/* 5. Coins Wallet & Top-Up Modal */}
      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onOpenRefer={() => setShowReferModal(true)}
      />

      {/* 6. User Sign Up and Login Modal (No OTP) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
        onSuccessRedirect={() => setCurrentTab('profile')}
      />

      {/* 7. Refer & Earn Modal */}
      <ReferAndEarnModal
        isOpen={showReferModal}
        onClose={() => setShowReferModal(false)}
        onOpenAuth={handleOpenAuth}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <TournamentProvider>
          <CricketArenaApp />
        </TournamentProvider>
      </WalletProvider>
    </AuthProvider>
  );
}
