import React, { useState } from 'react';
import {
  ShieldAlert,
  Trophy,
  Users,
  Settings,
  History,
  Plus,
  Save,
  CheckCircle,
  AlertTriangle,
  Play,
  Check,
  Edit,
  ArrowRight,
  Coins,
} from 'lucide-react';
import { AdminWalletSection } from './AdminWalletSection';
import { AdminLudoTablesSection } from './AdminLudoTablesSection';
import { useAuth } from '../../context/AuthContext';
import { useTournament } from '../../context/TournamentContext';
import {
  Tournament,
  Player,
  TournamentStatus,
  MatchFormat,
  PlayerRole,
  PointsConfig,
  LudoTournament,
  LudoTournamentStatus,
  LudoMatchFormat,
} from '../../types';
import { calculatePlayerScore } from '../../lib/pointsCalculator';
import { LudoDataStore } from '../../lib/ludoStorage';
import { CricketDataStore } from '../../lib/storage';

export const AdminDashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const {
    tournaments,
    cricketTeams,
    players,
    pointsConfig,
    auditLogs,
    virtualTeams,
    adminCreateTournament,
    adminUpdateTournamentStatus,
    adminUpdatePlayerScores,
    adminUpdatePointsConfig,
    adminAddPlayer,
    refreshData,
  } = useTournament();

  const [adminTab, setAdminTab] = useState<'scores' | 'tournaments' | 'ludo-tables' | 'ludo' | 'wallet' | 'roster' | 'points' | 'audit' | 'participants'>('ludo-tables');

  // Ludo Tournament Admin State
  const [ludoTournaments, setLudoTournaments] = useState<LudoTournament[]>(() =>
    LudoDataStore.getTournaments()
  );
  const [newLudoTitle, setNewLudoTitle] = useState('');
  const [newLudoFormat, setNewLudoFormat] = useState<LudoMatchFormat>('4P');
  const [newLudoLimit, setNewLudoLimit] = useState(16);
  const [newLudoRules, setNewLudoRules] = useState('Standard knockout match rules. Extra turn on 6, home, and capture.');
  const [ludoMsg, setLudoMsg] = useState('');

  const handleCreateLudoTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLudoTitle) return;

    const newTour = LudoDataStore.adminCreateTournament({
      title: newLudoTitle,
      format: newLudoFormat,
      status: 'registration_open',
      maxParticipants: newLudoLimit,
      startTime: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      rulesDescription: newLudoRules,
      isDemo: true,
      roundsCount: newLudoFormat === '2P' ? 3 : 2,
    });

    CricketDataStore.addAuditLog({
      adminId: user?.id || 'admin-master',
      adminName: user?.name || 'Administrator',
      action: 'LUDO_TOURNAMENT_CREATED',
      targetType: 'tournament',
      targetId: newTour.id,
      details: `Created Ludo tournament "${newTour.title}" (${newTour.format}, max ${newTour.maxParticipants} players).`,
    });

    setLudoTournaments(LudoDataStore.getTournaments());
    setLudoMsg(`Ludo tournament "${newTour.title}" created successfully!`);
    setNewLudoTitle('');
    setTimeout(() => setLudoMsg(''), 3500);
  };

  const handleUpdateLudoStatus = (tourId: string, status: LudoTournamentStatus, winner?: string) => {
    LudoDataStore.adminUpdateTournamentStatus(tourId, status, winner);
    setLudoTournaments(LudoDataStore.getTournaments());

    CricketDataStore.addAuditLog({
      adminId: user?.id || 'admin-master',
      adminName: user?.name || 'Administrator',
      action: 'LUDO_TOURNAMENT_STATUS_UPDATED',
      targetType: 'tournament',
      targetId: tourId,
      details: `Updated Ludo tournament ${tourId} status to ${status.toUpperCase()}${winner ? ` (Winner: ${winner})` : ''}`,
    });

    setLudoMsg(`Tournament status updated to ${status.toUpperCase()} and logged in audit history.`);
    setTimeout(() => setLudoMsg(''), 3500);
  };

  // Match Scoring State
  const [scoringTourId, setScoringTourId] = useState<string>(tournaments[0]?.id || '');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(players[0]?.id || '');
  const [scoreInputs, setScoreInputs] = useState({
    runs: 48,
    ballsFaced: 32,
    fours: 4,
    sixes: 2,
    isOut: true,
    oversBowled: 0,
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
    catches: 1,
    stumpings: 0,
    runOuts: 0,
    dotBalls: 0,
  });
  const [scorePublishMessage, setScorePublishMessage] = useState<string>('');

  // New Tournament State
  const [newTourTitle, setNewTourTitle] = useState('');
  const [newTourFormat, setNewTourFormat] = useState<MatchFormat>('T20');
  const [newTeamA, setNewTeamA] = useState(cricketTeams[0]?.id || '');
  const [newTeamB, setNewTeamB] = useState(cricketTeams[1]?.id || '');
  const [newTourVenue, setNewTourVenue] = useState('Eden Gardens, Kolkata');
  const [newTourLimit, setNewTourLimit] = useState(10000);
  const [tourCreatedMsg, setTourCreatedMsg] = useState('');

  // Editable Points Config State
  const [editablePoints, setEditablePoints] = useState<PointsConfig>(pointsConfig);
  const [pointsSavedMsg, setPointsSavedMsg] = useState('');

  // New Player State
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeamId, setNewPlayerTeamId] = useState(cricketTeams[0]?.id || '');
  const [newPlayerRole, setNewPlayerRole] = useState<PlayerRole>('BAT');
  const [newPlayerCredits, setNewPlayerCredits] = useState(9.0);
  const [playerCreatedMsg, setPlayerCreatedMsg] = useState('');

  // Authorization Protection Check
  if (!isAdmin) {
    return (
      <div className="bg-[#0f172a] rounded-2xl border border-rose-500/40 p-6 text-center shadow-xl">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Access Denied: Admin Rights Required</h2>
        <p className="text-xs text-slate-300 max-w-md mx-auto mb-4">
          This portal allows score publication, rules alteration, and tournament state modification. Only verified administrators with server authorization can access these controls.
        </p>
      </div>
    );
  }

  // Active scoring tournament & player
  const currentScoringTour = tournaments.find((t) => t.id === scoringTourId) || tournaments[0];
  const currentScoringPlayer = players.find((p) => p.id === selectedPlayerId) || players[0];

  // Calculated Preview Points
  const previewPoints = calculatePlayerScore(
    scoreInputs,
    currentScoringPlayer?.role,
    pointsConfig
  );

  const handlePublishScore = async () => {
    setScorePublishMessage('');
    if (!scoringTourId || !selectedPlayerId) return;

    const scoresMap: Record<string, number> = {
      [selectedPlayerId]: previewPoints,
    };

    const notes = `${currentScoringPlayer.name}: ${scoreInputs.runs} runs (${scoreInputs.ballsFaced} balls), ${scoreInputs.wickets} wkts, ${scoreInputs.catches} catches = ${previewPoints} pts`;

    const res = await adminUpdatePlayerScores(scoringTourId, scoresMap, notes);
    if (res.success) {
      setScorePublishMessage(`Score published for ${currentScoringPlayer.name}! All virtual squads recalculated.`);
      setTimeout(() => setScorePublishMessage(''), 4000);
    }
  };

  const handleCreateTournamentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourTitle) return;

    adminCreateTournament({
      title: newTourTitle,
      format: newTourFormat,
      teamAId: newTeamA,
      teamBId: newTeamB,
      venue: newTourVenue,
      startTime: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
      status: 'upcoming',
      entryLimit: newTourLimit,
      bannerImage: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80',
      isDemo: true,
      pointsConfigId: pointsConfig.id,
    });

    setTourCreatedMsg('Tournament created and added to schedule!');
    setNewTourTitle('');
    setTimeout(() => setTourCreatedMsg(''), 3500);
  };

  const handleSavePointsConfig = () => {
    adminUpdatePointsConfig(editablePoints);
    setPointsSavedMsg('Fantasy points system updated and audited on server!');
    setTimeout(() => setPointsSavedMsg(''), 3500);
  };

  const handleAddPlayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName) return;

    adminAddPlayer({
      name: newPlayerName,
      teamId: newPlayerTeamId,
      role: newPlayerRole,
      credits: newPlayerCredits,
      matchesPlayed: 10,
      totalRuns: 250,
      totalWickets: 8,
    });

    setPlayerCreatedMsg(`Player ${newPlayerName} added to roster!`);
    setNewPlayerName('');
    setTimeout(() => setPlayerCreatedMsg(''), 3500);
  };

  return (
    <div className="space-y-4">
      {/* Admin Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-[#0f172a] to-slate-900 border border-amber-500/40 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                SERVER AUTHORIZED
              </span>
              <span className="text-xs text-amber-300 font-semibold">Admin: {user?.name}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-1">
              Cricket Arena Control Panel
            </h2>
            <p className="text-xs text-slate-400">
              Manage tournaments, update player stats, recalculate fantasy leaderboards, and audit logs.
            </p>
          </div>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
        {[
          { id: 'ludo-tables', label: '🎲 Ludo Tables & Rewards', icon: Trophy },
          { id: 'wallet', label: '💰 Coins & Wallet', icon: Coins },
          { id: 'scores', label: 'Match Scores & Points', icon: Trophy },
          { id: 'tournaments', label: 'Cricket Tournaments', icon: Play },
          { id: 'ludo', label: 'Ludo Championships', icon: Trophy },
          { id: 'roster', label: 'Teams & Players', icon: Users },
          { id: 'points', label: 'Points Rules', icon: Settings },
          { id: 'audit', label: 'Audit Logs', icon: History },
          { id: 'participants', label: 'Users & Entries', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setAdminTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                adminTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. MATCH SCORE UPDATER TAB */}
      {adminTab === 'scores' && (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Update Match Player Stats &amp; Recalculate Fantasy Points
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Submitting stats will immediately recalculate total fantasy points for all virtual squads (including Captain 2x &amp; Vice-Captain 1.5x) and update leaderboard rankings.
            </p>
          </div>

          {scorePublishMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{scorePublishMessage}</span>
            </div>
          )}

          {/* Tournament & Player Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Select Match
              </label>
              <select
                value={scoringTourId}
                onChange={(e) => setScoringTourId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Select Cricketer
              </label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role} - {p.credits}Cr)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Calculated Points Preview Card */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 rounded-xl border border-emerald-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase">Calculated Fantasy Score</span>
              <p className="text-sm font-bold text-white">{currentScoringPlayer.name}</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl font-black text-emerald-400">
                +{previewPoints}
              </span>
              <span className="text-xs text-slate-400 block leading-none">PTS</span>
            </div>
          </div>

          {/* Stats Inputs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-1">Runs Scored</label>
              <input
                type="number"
                min="0"
                value={scoreInputs.runs}
                onChange={(e) => setScoreInputs({ ...scoreInputs, runs: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
              />
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-1">Balls Faced</label>
              <input
                type="number"
                min="0"
                value={scoreInputs.ballsFaced}
                onChange={(e) => setScoreInputs({ ...scoreInputs, ballsFaced: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
              />
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-1">Fours (4s)</label>
              <input
                type="number"
                min="0"
                value={scoreInputs.fours}
                onChange={(e) => setScoreInputs({ ...scoreInputs, fours: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
              />
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-1">Sixes (6s)</label>
              <input
                type="number"
                min="0"
                value={scoreInputs.sixes}
                onChange={(e) => setScoreInputs({ ...scoreInputs, sixes: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
              />
            </div>

            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-1">Wickets Taken</label>
              <input
                type="number"
                min="0"
                value={scoreInputs.wickets}
                onChange={(e) => setScoreInputs({ ...scoreInputs, wickets: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
              />
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-1">Maiden Overs</label>
              <input
                type="number"
                min="0"
                value={scoreInputs.maidens}
                onChange={(e) => setScoreInputs({ ...scoreInputs, maidens: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
              />
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-1">Catches Taken</label>
              <input
                type="number"
                min="0"
                value={scoreInputs.catches}
                onChange={(e) => setScoreInputs({ ...scoreInputs, catches: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
              />
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-1">Stumpings</label>
              <input
                type="number"
                min="0"
                value={scoreInputs.stumpings}
                onChange={(e) => setScoreInputs({ ...scoreInputs, stumpings: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
              />
            </div>
          </div>

          <button
            onClick={handlePublishScore}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4 stroke-[2.5]" />
            <span>Publish Score &amp; Recalculate Leaderboard</span>
          </button>
        </div>
      )}

      {/* 2. TOURNAMENTS MANAGER TAB */}
      {adminTab === 'tournaments' && (
        <div className="space-y-4">
          {/* Create Tournament Form */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Create New Cricket Tournament
            </h3>

            {tourCreatedMsg && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs mb-3">
                {tourCreatedMsg}
              </div>
            )}

            <form onSubmit={handleCreateTournamentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">Tournament Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asia Champions Cup 2026"
                  value={newTourTitle}
                  onChange={(e) => setNewTourTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Team A</label>
                  <select
                    value={newTeamA}
                    onChange={(e) => setNewTeamA(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  >
                    {cricketTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Team B</label>
                  <select
                    value={newTeamB}
                    onChange={(e) => setNewTeamB(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  >
                    {cricketTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Format</label>
                  <select
                    value={newTourFormat}
                    onChange={(e) => setNewTourFormat(e.target.value as MatchFormat)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  >
                    <option value="T20">T20</option>
                    <option value="ODI">ODI</option>
                    <option value="TEST">TEST</option>
                    <option value="T10">T10</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Entry Limit</label>
                  <input
                    type="number"
                    value={newTourLimit}
                    onChange={(e) => setNewTourLimit(parseInt(e.target.value) || 5000)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Stadium Venue</label>
                <input
                  type="text"
                  value={newTourVenue}
                  onChange={(e) => setNewTourVenue(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
              >
                Create Tournament
              </button>
            </form>
          </div>

          {/* Existing Tournaments Status Controls */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Manage Existing Tournaments Status
            </h3>
            <div className="space-y-2">
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-white">{t.title}</p>
                    <p className="text-[11px] text-slate-400">
                      Status: <span className="font-mono text-emerald-400">{t.status.toUpperCase()}</span> • {t.enrolledCount} enrolled
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {t.status !== 'live' && (
                      <button
                        onClick={() => adminUpdateTournamentStatus(t.id, 'live')}
                        className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold"
                      >
                        Set Live
                      </button>
                    )}
                    {t.status !== 'completed' && (
                      <button
                        onClick={() => adminUpdateTournamentStatus(t.id, 'completed')}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LUDO TOURNAMENTS ADMIN TAB */}
      {adminTab === 'ludo' && (
        <div className="space-y-4">
          {/* Create Ludo Tournament */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Create Ludo Tournament
            </h3>

            {ludoMsg && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs mb-3">
                {ludoMsg}
              </div>
            )}

            <form onSubmit={handleCreateLudoTournament} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-semibold">Tournament Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ludo Super Star Championship"
                  value={newLudoTitle}
                  onChange={(e) => setNewLudoTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Match Format</label>
                  <select
                    value={newLudoFormat}
                    onChange={(e) => setNewLudoFormat(e.target.value as LudoMatchFormat)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  >
                    <option value="2P">2-Player Knockout</option>
                    <option value="4P">4-Player Tables</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Max Participants</label>
                  <input
                    type="number"
                    value={newLudoLimit}
                    onChange={(e) => setNewLudoLimit(parseInt(e.target.value) || 16)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Rules Description</label>
                <input
                  type="text"
                  value={newLudoRules}
                  onChange={(e) => setNewLudoRules(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
              >
                Create Ludo Tournament
              </button>
            </form>
          </div>

          {/* Manage Existing Ludo Tournaments */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Manage Existing Ludo Tournaments
            </h3>
            <div className="space-y-2">
              {ludoTournaments.map((t) => (
                <div
                  key={t.id}
                  className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-white">{t.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {t.format} • Status: <span className="font-mono text-emerald-400">{t.status.toUpperCase()}</span> • {t.enrolledCount} enrolled
                      {t.winnerName && <span className="text-amber-400 ml-2 font-bold">• Winner: {t.winnerName}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {t.status === 'upcoming' && (
                      <button
                        onClick={() => handleUpdateLudoStatus(t.id, 'registration_open')}
                        className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold"
                      >
                        Open Registration
                      </button>
                    )}
                    {t.status === 'registration_open' && (
                      <button
                        onClick={() => handleUpdateLudoStatus(t.id, 'in_progress')}
                        className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold"
                      >
                        Start Knockouts
                      </button>
                    )}
                    {t.status !== 'completed' && (
                      <button
                        onClick={() => {
                          const winner = prompt('Enter winner name:', 'Player 1') || 'Champion';
                          handleUpdateLudoStatus(t.id, 'completed', winner);
                        }}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold"
                      >
                        Crown Winner
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LUDO TABLES & CASH REWARDS TAB */}
      {adminTab === 'ludo-tables' && <AdminLudoTablesSection />}

      {/* WALLET & FINANCIAL CONTROL TAB */}
      {adminTab === 'wallet' && <AdminWalletSection />}

      {/* 3. ROSTER MANAGER TAB */}
      {adminTab === 'roster' && (
        <div className="space-y-4">
          {/* Add Player */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Add Cricketer to Roster
            </h3>
            {playerCreatedMsg && (
              <div className="p-2 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs mb-3">
                {playerCreatedMsg}
              </div>
            )}
            <form onSubmit={handleAddPlayerSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Player Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jasprit Bumrah"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Cricket Team</label>
                  <select
                    value={newPlayerTeamId}
                    onChange={(e) => setNewPlayerTeamId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  >
                    {cricketTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Role</label>
                  <select
                    value={newPlayerRole}
                    onChange={(e) => setNewPlayerRole(e.target.value as PlayerRole)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  >
                    <option value="BAT">Batter (BAT)</option>
                    <option value="BOWL">Bowler (BOWL)</option>
                    <option value="AR">All-Rounder (AR)</option>
                    <option value="WK">Wicket-Keeper (WK)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Credit Cost (4.0 - 15.0)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="4"
                    max="15"
                    value={newPlayerCredits}
                    onChange={(e) => setNewPlayerCredits(parseFloat(e.target.value) || 8.5)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition"
              >
                Add Player
              </button>
            </form>
          </div>

          {/* Current Players List */}
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              Active Player Directory ({players.length})
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-1.5 text-xs">
              {players.map((p) => {
                const team = cricketTeams.find((t) => t.id === p.teamId);
                return (
                  <div key={p.id} className="p-2 bg-slate-900/60 rounded-xl flex items-center justify-between border border-slate-800">
                    <div>
                      <span className="font-bold text-white">{p.name}</span>
                      <span className="text-[11px] text-slate-400 ml-2">
                        {team?.shortName} • {p.role}
                      </span>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">{p.credits} Cr</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. POINTS RULES CONFIGURATOR TAB */}
      {adminTab === 'points' && (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3 text-xs">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              Fantasy Points Rules Engine
            </h3>
            <p className="text-slate-400 text-[11px]">
              Configure point values for runs, boundaries, wickets, and maidens. Changes are audited on the server.
            </p>
          </div>

          {pointsSavedMsg && (
            <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300">
              {pointsSavedMsg}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-0.5">Run Point</label>
              <input
                type="number"
                value={editablePoints.rules.batting.run}
                onChange={(e) =>
                  setEditablePoints({
                    ...editablePoints,
                    rules: {
                      ...editablePoints.rules,
                      batting: { ...editablePoints.rules.batting, run: parseInt(e.target.value) || 1 },
                    },
                  })
                }
                className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1 text-white font-mono"
              />
            </div>

            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-0.5">Boundary 4 Bonus</label>
              <input
                type="number"
                value={editablePoints.rules.batting.boundaryFour}
                onChange={(e) =>
                  setEditablePoints({
                    ...editablePoints,
                    rules: {
                      ...editablePoints.rules,
                      batting: { ...editablePoints.rules.batting, boundaryFour: parseInt(e.target.value) || 1 },
                    },
                  })
                }
                className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1 text-white font-mono"
              />
            </div>

            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-0.5">Six 6 Bonus</label>
              <input
                type="number"
                value={editablePoints.rules.batting.six}
                onChange={(e) =>
                  setEditablePoints({
                    ...editablePoints,
                    rules: {
                      ...editablePoints.rules,
                      batting: { ...editablePoints.rules.batting, six: parseInt(e.target.value) || 2 },
                    },
                  })
                }
                className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1 text-white font-mono"
              />
            </div>

            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-0.5">Wicket Points</label>
              <input
                type="number"
                value={editablePoints.rules.bowling.wicket}
                onChange={(e) =>
                  setEditablePoints({
                    ...editablePoints,
                    rules: {
                      ...editablePoints.rules,
                      bowling: { ...editablePoints.rules.bowling, wicket: parseInt(e.target.value) || 25 },
                    },
                  })
                }
                className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1 text-white font-mono"
              />
            </div>

            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-0.5">Maiden Over</label>
              <input
                type="number"
                value={editablePoints.rules.bowling.maidenOver}
                onChange={(e) =>
                  setEditablePoints({
                    ...editablePoints,
                    rules: {
                      ...editablePoints.rules,
                      bowling: { ...editablePoints.rules.bowling, maidenOver: parseInt(e.target.value) || 12 },
                    },
                  })
                }
                className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1 text-white font-mono"
              />
            </div>

            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
              <label className="text-[11px] text-slate-400 block mb-0.5">Catch Points</label>
              <input
                type="number"
                value={editablePoints.rules.fielding.catch}
                onChange={(e) =>
                  setEditablePoints({
                    ...editablePoints,
                    rules: {
                      ...editablePoints.rules,
                      fielding: { ...editablePoints.rules.fielding, catch: parseInt(e.target.value) || 8 },
                    },
                  })
                }
                className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1 text-white font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleSavePointsConfig}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow"
          >
            Save Points System
          </button>
        </div>
      )}

      {/* 5. AUDIT LOGS TAB */}
      {adminTab === 'audit' && (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
          <div className="border-b border-slate-800 pb-2 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Immutable Audit Log History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Every score recalculation, points update, and tournament status change is permanently logged.
            </p>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    {log.action}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-200 text-xs">{log.details}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Admin: {log.adminName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. PARTICIPANTS TAB */}
      {adminTab === 'participants' && (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl text-xs">
          <h3 className="text-sm font-bold text-white mb-2">Registered User Virtual Squads</h3>
          <p className="text-slate-400 mb-3">
            Total Virtual Teams registered across all free tournaments: {virtualTeams.length}
          </p>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {virtualTeams.map((vt) => {
              const tour = tournaments.find((t) => t.id === vt.tournamentId);
              return (
                <div key={vt.id} className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">{vt.teamName} (by {vt.userName})</p>
                    <p className="text-[11px] text-slate-400">Match: {tour?.title || vt.tournamentId}</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">{vt.totalPoints} pts</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
