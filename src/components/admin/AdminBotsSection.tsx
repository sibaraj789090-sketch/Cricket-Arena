import React, { useState, useEffect } from 'react';
import {
  Bot,
  Power,
  Play,
  Square,
  RotateCcw,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle2,
  FileText,
  Sliders,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  RefreshCw,
  Users,
  Award,
  BookOpen,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import {
  VirtualLudoBot,
  BotPoolConfig,
  BotMatchLog,
  BotPoolStats,
  BotStrategy,
  SimulationOutcome,
} from '../../types/ludoBot';
import { LudoCashMatch } from '../../types/ludoCash';
import { useAuth } from '../../context/AuthContext';
import { adminFetch } from '../../lib/adminAuth';

const fetch = adminFetch;

export const AdminBotsSection: React.FC = () => {
  const { user } = useAuth();

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'pool' | 'simulation' | 'active_matches' | 'strategies' | 'logs'>('pool');

  // Global Config & Stats
  const [config, setConfig] = useState<BotPoolConfig | null>(null);
  const [stats, setStats] = useState<BotPoolStats | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Bot Pool Directory State (Pagination & Filters)
  const [bots, setBots] = useState<VirtualLudoBot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalBots, setTotalBots] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingBots, setIsLoadingBots] = useState(false);

  // Selected Bot for Inspection Modal
  const [selectedBot, setSelectedBot] = useState<VirtualLudoBot | null>(null);

  // QA Match Simulation Config
  const [simMode, setSimMode] = useState<2 | 4>(2);
  const [simStrategy, setSimStrategy] = useState<BotStrategy>('stronger_legal');
  const [simOutcome, setSimOutcome] = useState<SimulationOutcome>('random');
  const [simTableId, setSimTableId] = useState('table-2p-10');
  const [includeAdminAccount, setIncludeAdminAccount] = useState(true);
  const [isStartingSim, setIsStartingSim] = useState(false);
  const [lastCreatedMatch, setLastCreatedMatch] = useState<LudoCashMatch | null>(null);

  // Active Simulation Matches
  const [activeMatches, setActiveMatches] = useState<LudoCashMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  // Bot Logs
  const [logs, setLogs] = useState<BotMatchLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Fetch Config & Stats
  const fetchConfigAndStats = async () => {
    try {
      const res = await fetch('/api/admin/bots/config', {
        headers: { 'x-user-role': 'admin' },
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setStats(data.stats);
      }
    } catch (err) {
      console.warn('Failed to load bot config:', err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  // Fetch Paginated Bots List
  const fetchBotsList = async () => {
    setIsLoadingBots(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        status: statusFilter,
        strategy: strategyFilter,
      });
      const res = await fetch(`/api/admin/bots/list?${query.toString()}`, {
        headers: { 'x-user-role': 'admin' },
      });
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
        setTotalBots(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.warn('Failed to load bots:', err);
    } finally {
      setIsLoadingBots(false);
    }
  };

  // Fetch Active Simulation Matches
  const fetchActiveMatches = async () => {
    setIsLoadingMatches(true);
    try {
      const res = await fetch('/api/admin/bots/simulation/active', {
        headers: { 'x-user-role': 'admin' },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveMatches(data.matches || []);
      }
    } catch (err) {
      console.warn('Failed to fetch active bot matches:', err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/admin/bots/logs?limit=100', {
        headers: { 'x-user-role': 'admin' },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.warn('Failed to fetch bot logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchConfigAndStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'pool') {
      fetchBotsList();
    } else if (activeTab === 'active_matches') {
      fetchActiveMatches();
    } else if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, page, limit, statusFilter, strategyFilter]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'pool') {
        setPage(1);
        fetchBotsList();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Flash Message helper
  const showFeedback = (text: string, error = false) => {
    setActionMessage({ text, error });
    setTimeout(() => setActionMessage(null), 5000);
  };

  // Toggle Bot System (LUDO_BOTS_ENABLED)
  const handleToggleBots = async () => {
    if (!config) return;
    const targetState = !config.enabled;
    try {
      const res = await fetch('/api/admin/bots/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({ enabled: targetState }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfig(data.config);
        setStats(data.stats);
        showFeedback(data.message);
        fetchBotsList();
      } else {
        showFeedback(data.error || 'Failed to toggle bot system.', true);
      }
    } catch (err: any) {
      showFeedback(err.message || 'Network error toggling bots.', true);
    }
  };

  // Re-seed or configure pool size
  const handleConfigurePool = async (newPoolSize: number, newStrategy: BotStrategy) => {
    try {
      const res = await fetch('/api/admin/bots/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          poolSize: newPoolSize,
          defaultStrategy: newStrategy,
          reseed: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfig(data.config);
        setStats(data.stats);
        showFeedback(`Bot pool re-seeded to ${newPoolSize} virtual bots!`);
        fetchBotsList();
      } else {
        showFeedback(data.error || 'Failed to update pool config.', true);
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // Toggle Auto-Fill Stealth Bots for Live Tables
  const handleToggleAutoMatch = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/admin/bots/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({ autoMatchStealthBots: enabled }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfig(data.config);
        showFeedback(`Auto-fill stealth bots ${enabled ? 'ENABLED' : 'DISABLED'} for all 2P & 4P tables.`);
        fetchConfigAndStats();
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // Start QA Simulation Match
  const handleStartSimulation = async () => {
    setIsStartingSim(true);
    try {
      const res = await fetch('/api/admin/bots/simulation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          tableId: simTableId,
          mode: simMode,
          strategy: simStrategy,
          simulatedOutcome: simOutcome,
          adminUserId: includeAdminAccount ? user?.id : undefined,
          adminUserName: includeAdminAccount ? user?.name : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastCreatedMatch(data.match);
        showFeedback(`QA Simulation started! Match ID: ${data.match.id}. Outcome Mode: ${simOutcome.toUpperCase()}.`);
        fetchConfigAndStats();
        fetchActiveMatches();
      } else {
        showFeedback(data.error || 'Failed to launch QA simulation.', true);
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    } finally {
      setIsStartingSim(false);
    }
  };

  // Stop Match
  const handleStopMatch = async (matchId: string) => {
    try {
      const res = await fetch('/api/admin/bots/stop-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({ matchId, reason: 'Manually stopped by Admin' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(`Match ${matchId} stopped safely. Bots returned to idle.`);
        fetchActiveMatches();
        fetchConfigAndStats();
      } else {
        showFeedback(data.error || 'Failed to stop match.', true);
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // Safe Reset All Simulation Matches
  const handleResetAllMatches = async () => {
    try {
      const res = await fetch('/api/admin/bots/reset-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(data.message);
        fetchActiveMatches();
        fetchConfigAndStats();
        fetchBotsList();
      } else {
        showFeedback(data.error || 'Failed to reset matches.', true);
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // Update Individual Bot Strategy
  const handleUpdateBotStrategy = async (botId: string, strategy: BotStrategy) => {
    try {
      const res = await fetch(`/api/admin/bots/bot/${botId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({ strategy }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(`Bot ${botId} strategy updated to ${strategy}.`);
        if (selectedBot && selectedBot.id === botId) {
          setSelectedBot(data.bot);
        }
        fetchBotsList();
        fetchConfigAndStats();
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/admin/bots/logs', {
        method: 'DELETE',
        headers: { 'x-user-role': 'admin' },
      });
      if (res.ok) {
        showFeedback('Bot activity logs cleared.');
        fetchLogs();
      }
    } catch (err: any) {
      showFeedback(err.message, true);
    }
  };

  return (
    <div className="space-y-4">
      {/* ========================================================
          1. TOP BOT ENGINE STATUS & GLOBAL TOGGLE BANNER
          ======================================================== */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl border ${
                config?.enabled
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-900 border-slate-700 text-slate-500'
              }`}
            >
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">Ludo Virtual Bots &amp; QA Simulation</h2>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                    config?.enabled
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40 animate-pulse'
                      : 'bg-rose-950 text-rose-400 border-rose-500/40'
                  }`}
                >
                  {config?.enabled ? '● BOTS ACTIVE' : '○ BOTS DISABLED'}
                </span>
                <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                  5000+ POOL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pre-launch virtual player pool and isolated QA outcome simulation engine. Strictly zero access to production Real Cash tables.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={handleToggleBots}
              disabled={isLoadingConfig}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black shadow-lg transition cursor-pointer ${
                config?.enabled
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{config?.enabled ? 'Disable All Bots' : 'Enable Bot System'}</span>
            </button>
          </div>
        </div>

        {/* Real-Time Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Virtual Bot Pool</span>
            <span className="font-mono text-lg font-black text-white">
              {stats?.totalBots?.toLocaleString() || '5,200'}
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">
              Configured: 5000+ Bots
            </span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Idle / Available</span>
            <span className="font-mono text-lg font-black text-emerald-400">
              {stats?.idleBots?.toLocaleString() || '0'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Ready for QA Sandbox</span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Active in Simulation</span>
            <span className="font-mono text-lg font-black text-amber-400">
              {stats?.inMatchBots || 0}
            </span>
            <span className="text-[10px] text-amber-400/80 block mt-0.5">Isolated Test Games</span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Strategy Split</span>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono font-bold">
              <span className="text-blue-400">Adv: {stats?.strategiesCount?.stronger_legal || 0}</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400">Rnd: {stats?.strategiesCount?.random_legal || 0}</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400">Beg: {stats?.strategiesCount?.beginner || 0}</span>
            </div>
          </div>
        </div>

        {/* Auto-Fill Stealth Matchmaking Card */}
        <div className="mt-4 bg-slate-900/90 rounded-xl border border-blue-500/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-500/30">
                AUTO-MATCH STEALTH PLAYERS
              </span>
              <span className="text-white font-bold">Zero-Wait Ludo Matchmaking</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                config?.autoMatchStealthBots
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-950 text-rose-400 border border-rose-500/30'
              }`}>
                {config?.autoMatchStealthBots ? '● ACTIVE' : '○ PAUSED'}
              </span>
            </div>
            <p className="text-slate-300">
              When a real player joins any 2P or 4P table and no other real players are online, realistic stealth opponents automatically join after 3 seconds so users never wait in an empty queue. Opponents look 100% natural with genuine names, avatars, and human reaction delays.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleToggleAutoMatch(!config?.autoMatchStealthBots)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                config?.autoMatchStealthBots
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{config?.autoMatchStealthBots ? 'Auto-Fill: ENABLED' : 'Auto-Fill: DISABLED'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. ADMIN BOT NAVIGATION TABS
          ======================================================== */}
      <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
        {[
          { id: 'pool', label: '🤖 Bot Pool Directory (5000+)', icon: Users, badge: totalBots },
          { id: 'simulation', label: '⚡ QA Match Outcome Simulation', icon: Zap },
          { id: 'active_matches', label: '🎮 Live Test Matches', icon: Play, badge: activeMatches.length },
          { id: 'strategies', label: '📜 Strategy Guide & Specs', icon: BookOpen },
          { id: 'logs', label: '📋 Bot Activity Logs', icon: FileText, badge: logs.length },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-800 text-amber-300 border border-slate-700">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================
          TAB 1: 5000+ BOT POOL DIRECTORY (SEARCH & PAGINATION)
          ======================================================== */}
      {activeTab === 'pool' && (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-amber-400" />
                Virtual Ludo Bot Pool Directory (5,200 Active Bots)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every bot is clearly tagged with <span className="text-purple-300 font-bold font-mono">[BOT]</span>. Bots operate exclusively with non-purchasable test tokens and cannot enter production cash tables.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConfigurePool(5200, 'stronger_legal')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
                title="Re-seed 5200 bots"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-seed 5,200 Bots</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {/* Search Input */}
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search bot by name (e.g. ApexRoller) or ID (e.g. bot-00100)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Statuses</option>
                <option value="idle">Idle (Available)</option>
                <option value="in_match">In Match (Active)</option>
                <option value="paused">Paused</option>
              </select>
            </div>

            {/* Strategy Filter */}
            <div>
              <select
                value={strategyFilter}
                onChange={(e) => setStrategyFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Strategies</option>
                <option value="stronger_legal">Stronger Legal (Heuristic AI)</option>
                <option value="random_legal">Random Legal Moves</option>
                <option value="beginner">Beginner (Slow/Relaxed)</option>
              </select>
            </div>
          </div>

          {/* Bot Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Bot ID</th>
                  <th className="px-3 py-2.5">Bot Name &amp; Label</th>
                  <th className="px-3 py-2.5">Strategy</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Test Tokens</th>
                  <th className="px-3 py-2.5">Sim Rating</th>
                  <th className="px-3 py-2.5">Record</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/50 font-mono">
                {isLoadingBots ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                      Loading virtual bot records...
                    </td>
                  </tr>
                ) : bots.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                      No bots found matching "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  bots.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-3 py-2.5 text-amber-400 font-bold">
                        {b.id}
                      </td>
                      <td className="px-3 py-2.5 font-sans">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-lg ${b.avatar} text-white font-bold text-[10px] flex items-center justify-center shrink-0`}>
                            🤖
                          </span>
                          <div>
                            <span className="font-bold text-white block">
                              {b.rawName}
                            </span>
                            <span className="text-[9px] font-black uppercase text-purple-300 bg-purple-950/80 px-1.5 py-0.2 rounded border border-purple-500/40 inline-block mt-0.5">
                              [BOT] VIRTUAL
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-sans">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            b.strategy === 'stronger_legal'
                              ? 'bg-blue-950 text-blue-300 border-blue-500/40'
                              : b.strategy === 'random_legal'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                              : 'bg-amber-950 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {b.strategy.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-sans">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            b.status === 'idle'
                              ? 'bg-emerald-950/60 text-emerald-400'
                              : b.status === 'in_match' || b.status === 'testing'
                              ? 'bg-amber-950/60 text-amber-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {b.testTokenBalance} TEST
                      </td>
                      <td className="px-3 py-2.5 text-white font-bold">
                        {b.rating}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-400 font-sans">
                        <span className="text-emerald-400 font-bold">{b.wins}W</span> /{' '}
                        <span className="text-rose-400">{b.losses}L</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-sans">
                        <button
                          onClick={() => setSelectedBot(b)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800">
            <div>
              Showing <span className="font-bold text-white">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-bold text-white">
                {Math.min(page * limit, totalBots)}
              </span>{' '}
              of <span className="font-bold text-white">{totalBots.toLocaleString()}</span> bots
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold text-white">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: QA MATCH OUTCOME SIMULATION
          ======================================================== */}
      {activeTab === 'simulation' && (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/40">
                QA TESTING ONLY
              </span>
              <span className="text-xs text-slate-400">Deterministic Match Steering</span>
            </div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Match Outcome Simulation Engine
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Launch isolated QA test matches with pre-configured outcome expectations (<span className="text-emerald-400 font-bold">Bot Wins</span>, <span className="text-blue-400 font-bold">Human Account Wins</span>, or <span className="text-amber-400 font-bold">Random Legal Result</span>).
            </p>
          </div>

          {/* Prominent Safety Warning Notice Banner */}
          <div className="p-3.5 bg-gradient-to-r from-amber-950/80 to-slate-900 border-2 border-amber-500/70 rounded-2xl text-amber-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-black text-amber-400 uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>SIMULATION — NOT A REAL MATCH NOTICE</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-amber-200/90 space-y-0.5">
              <li>Uses isolated test tokens (50 TEST TOKENS). Zero real money is purchased, won, or deducted.</li>
              <li>Outcome simulations never affect production real cash tables or real player balances.</li>
              <li>Simulation outcomes are strictly prohibited from altering matches between real human users.</li>
              <li>All moves and dice evaluations remain logged and transparent for quality assurance.</li>
            </ul>
          </div>

          {/* Simulation Config Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* 1. Pre-selected Outcome */}
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                Target Outcome Simulation
              </label>
              <select
                value={simOutcome}
                onChange={(e) => setSimOutcome(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
              >
                <option value="random">🎲 Random Result (Normal Probability Rules)</option>
                <option value="bot_wins">🤖 Bot Wins (Optimal Simulated Bot Roll Sequencing)</option>
                <option value="human_wins">👤 Human Account Wins (Test Player Finishes 1st)</option>
              </select>
            </div>

            {/* 2. Bot Strategy */}
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                Participating Bot Strategy
              </label>
              <select
                value={simStrategy}
                onChange={(e) => setSimStrategy(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="stronger_legal">Stronger Legal (Heuristic - Captures &amp; Goal Priority)</option>
                <option value="random_legal">Random Legal Moves (Uniform)</option>
                <option value="beginner">Beginner (Relaxed, Misses Exits)</option>
              </select>
            </div>

            {/* 3. Match Player Count / Mode */}
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                Player Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSimMode(2)}
                  className={`py-2 rounded-xl font-bold border transition ${
                    simMode === 2
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  2 Players (1v1)
                </button>
                <button
                  type="button"
                  onClick={() => setSimMode(4)}
                  className={`py-2 rounded-xl font-bold border transition ${
                    simMode === 4
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  4 Players (1v3)
                </button>
              </div>
            </div>

            {/* 4. Include Admin Account */}
            <div>
              <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                Participants Assignment
              </label>
              <label className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAdminAccount}
                  onChange={(e) => setIncludeAdminAccount(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className="text-white text-xs">
                  Include My Admin Profile as Test Human ({simMode === 2 ? '1 Admin + 1 Bot' : '1 Admin + 3 Bots'})
                </span>
              </label>
            </div>
          </div>

          {/* Launch Button */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Simulation ID will be generated with isolated test state.
            </span>
            <button
              onClick={handleStartSimulation}
              disabled={isStartingSim || !config?.enabled}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>{isStartingSim ? 'Starting Simulation...' : 'Launch QA Simulation Match'}</span>
            </button>
          </div>

          {/* Last Created Simulation Match Info */}
          {lastCreatedMatch && (
            <div className="mt-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> QA Simulation Match Running
                </span>
                <span className="font-mono text-slate-400 text-[11px]">ID: {lastCreatedMatch.id}</span>
              </div>
              <p className="text-slate-300">
                Mode: <strong className="text-white">{lastCreatedMatch.playerCount}P</strong> • Target Outcome:{' '}
                <strong className="text-amber-400 uppercase font-mono">{simOutcome.replace('_', ' ')}</strong> • Participants:{' '}
                {lastCreatedMatch.players.map((p) => p.userName).join(', ')}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleStopMatch(lastCreatedMatch.id)}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60 text-xs font-bold flex items-center gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop This Match</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 3: LIVE TEST MATCHES
          ======================================================== */}
      {activeTab === 'active_matches' && (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-amber-400" />
                Active QA Simulation &amp; Bot Matches ({activeMatches.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor live simulated bot games. Admins can pause, safely stop, or reset test matches at any moment.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchActiveMatches}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetAllMatches}
                className="px-3 py-1.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 hover:bg-rose-900/80 text-xs font-bold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Matches Safely</span>
              </button>
            </div>
          </div>

          {activeMatches.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No simulation or bot matches are currently running. Launch one from the "QA Match Outcome Simulation" tab.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeMatches.map((m) => (
                <div key={m.id} className="bg-slate-950 rounded-2xl border border-slate-800 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                        QA SIMULATION MATCH
                      </span>
                      <h4 className="font-mono text-xs font-bold text-white mt-1">
                        {m.id}
                      </h4>
                    </div>
                    <span className="text-xs bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded font-bold">
                      {m.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="text-slate-400">
                      Mode: <span className="text-white font-bold">{m.playerCount}P</span> • Turn:{' '}
                      <span className="text-amber-400 font-bold uppercase">{m.gameState.currentTurn}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Players: {m.players.map((p) => p.userName).join(', ')}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Zero real balance stake
                    </span>
                    <button
                      onClick={() => handleStopMatch(m.id)}
                      className="px-2.5 py-1 rounded-xl bg-rose-950 border border-rose-500/40 text-rose-300 hover:bg-rose-900 text-xs font-bold flex items-center gap-1"
                    >
                      <Square className="w-3 h-3" />
                      <span>Stop Match</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 4: STRATEGY GUIDE & TECHNICAL SPECIFICATIONS
          ======================================================== */}
      {activeTab === 'strategies' && (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-4 text-xs">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              Documented Bot Strategies &amp; Safety Isolation Constitution
            </h3>
            <p className="text-slate-400 mt-0.5">
              Comprehensive reference on how bot decisions are calculated and how strict isolation is guaranteed.
            </p>
          </div>

          {/* 3 Documented Strategies */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Beginner */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/40">
                1. Beginner Strategy
              </span>
              <h4 className="font-bold text-white text-xs">Casual / Relaxed Play</h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Simulates casual, novice play. Makes completely random legal moves among valid tokens. Does not prioritize capturing opponent tokens and occasionally hesitates or makes non-optimal moves.
              </p>
              <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                Target Pool Share: 25%
              </div>
            </div>

            {/* 2. Random Legal */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
                2. Random Legal Strategy
              </span>
              <h4 className="font-bold text-white text-xs">Pure Probabilistic Legal Moves</h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Implements a strictly uniform random distribution across all legally movable tokens for the rolled dice value. Perfect baseline for benchmarking unbiased game mechanics.
              </p>
              <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                Target Pool Share: 35%
              </div>
            </div>

            {/* 3. Stronger Legal */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-blue-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-500/40">
                3. Stronger Legal Strategy
              </span>
              <h4 className="font-bold text-white text-xs">Heuristic Competitive AI</h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Applies multi-layered tactical heuristics:
                <br />1. Prioritizes yard token release when rolling a 6.
                <br />2. Prioritizes capturing opponent tokens.
                <br />3. Moves tokens into safe star cells and home column.
                <br />4. Advances furthest tokens to finish.
              </p>
              <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                Target Pool Share: 40% (Default)
              </div>
            </div>
          </div>

          {/* Security & Isolation Proof */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-blue-500/30 space-y-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 text-blue-400">
              <ShieldCheck className="w-4 h-4" /> Authoritative Security &amp; Isolation Guarantees
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-300">
              <div className="space-y-1">
                <span className="font-bold text-white block">Production Real Cash Isolation:</span>
                <p className="text-slate-400">
                  The Express server enforces a hard block on any table with <code>entryFee &gt; 0</code>. Any request pairing a bot with a cash table is rejected with HTTP 403 Forbidden.
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-white block">Supabase Data Immutability:</span>
                <p className="text-slate-400">
                  Bot actions exist exclusively in isolated in-memory maps and bot logs. Zero writes occur to Supabase <code>coin_wallets</code>, <code>coin_transactions</code>, or <code>profiles</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 5: BOT ACTIVITY LOGS
          ======================================================== */}
      {activeTab === 'logs' && (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Bot Match Audit Logs ({logs.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every bot move, dice roll, capture, and simulation outcome is recorded in this isolated audit trail.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchLogs}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900/60 text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No bot logs recorded yet. Logs will populate automatically during bot matches.
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">{log.eventType.toUpperCase()}</span>
                      <span className="text-[10px] text-slate-500 font-sans">
                        Match: {log.matchId}
                      </span>
                      {log.isSimulation && (
                        <span className="text-[9px] bg-amber-950 text-amber-300 px-1.5 rounded border border-amber-500/30 font-bold">
                          SIMULATION
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 font-sans text-xs">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 self-end sm:self-auto">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          BOT INSPECTION & STRATEGY EDIT MODAL
          ======================================================== */}
      {selectedBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] rounded-3xl border border-slate-700 p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className={`w-9 h-9 rounded-xl ${selectedBot.avatar} text-white font-bold text-sm flex items-center justify-center`}>
                  🤖
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>{selectedBot.rawName}</span>
                    <span className="text-[9px] font-black uppercase text-purple-300 bg-purple-950 px-1.5 py-0.2 rounded border border-purple-500/40">
                      [BOT]
                    </span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">UID: {selectedBot.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBot(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Simulated Rating</span>
                <span className="font-mono text-base font-bold text-white">{selectedBot.rating}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Win/Loss Record</span>
                <span className="font-mono text-base font-bold text-white">
                  {selectedBot.wins}W / {selectedBot.losses}L
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Status</span>
                <span className="font-mono text-xs font-bold text-emerald-400">{selectedBot.status.toUpperCase()}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Test Tokens</span>
                <span className="font-mono text-xs font-bold text-slate-300">{selectedBot.testTokenBalance} TEST</span>
              </div>
            </div>

            {/* Change Strategy */}
            <div className="text-xs">
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Configure Bot Strategy
              </label>
              <select
                value={selectedBot.strategy}
                onChange={(e) => handleUpdateBotStrategy(selectedBot.id, e.target.value as BotStrategy)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="stronger_legal">Stronger Legal (Heuristic Decision Maker)</option>
                <option value="random_legal">Random Legal Moves</option>
                <option value="beginner">Beginner (Slow / Misses optimal moves)</option>
              </select>
            </div>

            <button
              onClick={() => setSelectedBot(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
