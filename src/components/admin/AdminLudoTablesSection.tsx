import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Users,
  Settings,
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Zap,
  Power,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Save,
  Search,
  Plus,
  Edit2,
  Archive,
  Eye,
  XCircle,
  PauseCircle,
  PlayCircle,
  Coins,
  Wifi,
  WifiOff,
  UserCheck,
  Check,
  HelpCircle,
  Gamepad2,
  Sparkles,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { LudoCashTable, LudoAdminConfig } from '../../types/ludoCash';
import { useAuth } from '../../context/AuthContext';
import { adminFetch } from '../../lib/adminAuth';

const fetch = adminFetch;

export interface DetailedTablePlayer {
  userId: string;
  userName: string;
  color?: string;
  joinedAt?: string;
  isOnline?: boolean;
  isReady?: boolean;
}

export interface DetailedTableMatch {
  matchId: string;
  status: 'waiting' | 'starting' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  playerCount: number;
  entryFee: number;
  prizeAmount: number;
  startedAt?: string;
  players: DetailedTablePlayer[];
  currentTurn?: string;
}

export interface DetailedLudoTable extends LudoCashTable {
  isArchived?: boolean;
  waitingQueue?: DetailedTablePlayer[];
  activeMatchesList?: DetailedTableMatch[];
}

export const AdminLudoTablesSection: React.FC = () => {
  const { user } = useAuth();

  const [tables, setTables] = useState<DetailedLudoTable[]>([]);
  const [config, setConfig] = useState<LudoAdminConfig>({
    onlineLudoEnabled: true,
    timerLudoEnabled: true,
    durationMinutes2P: 8,
    durationMinutes4P: 15,
    homeBonusPoints: 60,
    dicePointsEnabled: true,
    captureTransferEnabled: true,
    tieBreakerRule: 'home_tokens_then_captures',
    allowTwoPlayer: true,
    allowFourPlayer: true,
    turnTimeoutSeconds: 30,
    maxTimeoutsBeforeForfeit: 3,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | '2' | '4'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'queued' | 'live'>('all');
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Modals state
  const [inspectingTable, setInspectingTable] = useState<DetailedLudoTable | null>(null);
  const [editingTable, setEditingTable] = useState<DetailedLudoTable | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Create table form state
  const [newEntryFee, setNewEntryFee] = useState<number>(50);
  const [newMode, setNewMode] = useState<2 | 4>(2);
  const [newPrize, setNewPrize] = useState<number>(85);
  const [newMinBalance, setNewMinBalance] = useState<number>(50);

  // Edit table form state
  const [editFee, setEditFee] = useState<number>(0);
  const [editPrize, setEditPrize] = useState<number>(0);
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editOnlinePlayers, setEditOnlinePlayers] = useState<number>(0);
  const [editPlayingPlayers, setEditPlayingPlayers] = useState<number>(0);
  const [editUseCustomTraffic, setEditUseCustomTraffic] = useState<boolean>(false);

  // Dedicated Fast Player Traffic Modal state
  const [trafficModalTable, setTrafficModalTable] = useState<DetailedLudoTable | null>(null);
  const [modalOnlinePlayers, setModalOnlinePlayers] = useState<number>(0);
  const [modalPlayingPlayers, setModalPlayingPlayers] = useState<number>(0);
  const [modalResetAuto, setModalResetAuto] = useState<boolean>(false);
  const [isSavingTraffic, setIsSavingTraffic] = useState<boolean>(false);

  // Action confirmations
  const [actionPrompt, setActionPrompt] = useState<{
    type: 'cancel_queue' | 'pause_match' | 'resume_match' | 'cancel_match' | 'archive_table';
    tableId?: string;
    matchId?: string;
    title: string;
    message: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Load detailed tables from authoritative server
  const loadTablesData = async () => {
    try {
      const res = await fetch('/api/ludo/admin/detailed-tables');
      if (res.ok) {
        const data = await res.json();
        if (data.tables) {
          // Normalize active matches list
          const normalized: DetailedLudoTable[] = data.tables.map((t: any) => ({
            ...t,
            activeMatchesList: t.activeMatches || [],
          }));
          setTables(normalized);
        }
        if (data.config) setConfig(data.config);
      }
    } catch (err) {
      console.warn('Failed to fetch detailed ludo tables:', err);
    }
  };

  useEffect(() => {
    loadTablesData();
    const interval = setInterval(loadTablesData, 3500);
    return () => clearInterval(interval);
  }, []);

  // Recalculate default prize when creating new table
  useEffect(() => {
    const defaultP = newMode === 2 ? Math.round(newEntryFee * 1.75 * 100) / 100 : Math.round(newEntryFee * 3.5 * 100) / 100;
    setNewPrize(defaultP);
    setNewMinBalance(newEntryFee);
  }, [newEntryFee, newMode]);

  // Toggle table active / disabled
  const handleToggleTable = async (tableId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/ludo/admin/table/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({ tableId, isActive: !currentStatus }),
      });

      if (res.ok) {
        setTables((prev) =>
          prev.map((t) => (t.id === tableId ? { ...t, isActive: !currentStatus } : t))
        );
        setStatusMsg({ text: `Table ${tableId} is now ${!currentStatus ? 'ACTIVE' : 'DISABLED'}.` });
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Failed to toggle table', error: true });
    }
  };

  // Save multiplayer rules config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/ludo/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setStatusMsg({ text: 'Online Ludo rules updated successfully across all servers!' });
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg({ text: err.error || 'Failed to save configuration', error: true });
      }
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Network error', error: true });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Create table handler
  const handleCreateTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEntryFee <= 0) return;

    try {
      const res = await fetch('/api/ludo/admin/table/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({
          entryFee: newEntryFee,
          mode: newMode,
          prize: newPrize,
          minBalance: newMinBalance,
        }),
      });

      if (res.ok) {
        setStatusMsg({ text: `New ₹${newEntryFee} (${newMode}P) table created successfully!` });
        setIsCreateModalOpen(false);
        loadTablesData();
        setTimeout(() => setStatusMsg(null), 3500);
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg({ text: err.error || 'Failed to create table', error: true });
      }
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Failed to create table', error: true });
    }
  };

  // Edit table handler
  const handleOpenEdit = (table: DetailedLudoTable) => {
    setEditingTable(table);
    setEditFee(table.entryFee);
    setEditPrize(table.prize);
    setEditActive(table.isActive);
    const hasManual = table.manualOnlinePlayers !== undefined || table.manualPlayingPlayers !== undefined;
    setEditUseCustomTraffic(hasManual);
    setEditOnlinePlayers(table.manualOnlinePlayers !== undefined ? table.manualOnlinePlayers : (table.onlinePlayers || 0));
    setEditPlayingPlayers(table.manualPlayingPlayers !== undefined ? table.manualPlayingPlayers : (table.playingPlayers || 0));
  };

  const handleEditTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;

    try {
      const payload: any = {
        tableId: editingTable.id,
        entryFee: editFee,
        prize: editPrize,
        isActive: editActive,
      };

      if (editUseCustomTraffic) {
        payload.onlinePlayers = editOnlinePlayers;
        payload.playingPlayers = editPlayingPlayers;
      } else {
        payload.resetAutoTraffic = true;
      }

      const res = await fetch('/api/ludo/admin/table/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatusMsg({ text: `Table ${editingTable.id} and player counts updated successfully!` });
        setEditingTable(null);
        loadTablesData();
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg({ text: err.error || 'Failed to edit table', error: true });
      }
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Failed to edit table', error: true });
    }
  };

  // Dedicated Player Traffic Modal Handlers
  const handleOpenTrafficModal = (table: DetailedLudoTable) => {
    setTrafficModalTable(table);
    setModalOnlinePlayers(table.manualOnlinePlayers !== undefined ? table.manualOnlinePlayers : (table.onlinePlayers || 0));
    setModalPlayingPlayers(table.manualPlayingPlayers !== undefined ? table.manualPlayingPlayers : (table.playingPlayers || 0));
    setModalResetAuto(false);
  };

  const handleSaveTrafficModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trafficModalTable) return;
    setIsSavingTraffic(true);

    try {
      const res = await fetch('/api/ludo/admin/table/traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({
          tableId: trafficModalTable.id,
          onlinePlayers: modalOnlinePlayers,
          playingPlayers: modalPlayingPlayers,
          resetAutoTraffic: modalResetAuto,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ text: data.message || `Table ${trafficModalTable.id} player counts updated!` });
        setTrafficModalTable(null);
        loadTablesData();
        setTimeout(() => setStatusMsg(null), 3500);
      } else {
        setStatusMsg({ text: data.error || 'Failed to update traffic counts', error: true });
      }
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Network error updating traffic', error: true });
    } finally {
      setIsSavingTraffic(false);
    }
  };

  // Global Bulk Traffic Operations (Reset all or Scale)
  const handleBulkTrafficAction = async (action: 'reset_all_auto' | 'scale', multiplier?: number) => {
    try {
      const res = await fetch('/api/ludo/admin/tables/traffic-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({ action, multiplier }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({ text: data.message });
        loadTablesData();
        setTimeout(() => setStatusMsg(null), 3500);
      } else {
        setStatusMsg({ text: data.error || 'Failed bulk traffic action', error: true });
      }
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Network error', error: true });
    }
  };

  // Execute Action (Cancel Queue, Pause Match, Resume Match, Cancel Match, Archive)
  const handleExecuteAction = async () => {
    if (!actionPrompt) return;
    setIsProcessingAction(true);

    try {
      if (actionPrompt.type === 'cancel_queue' && actionPrompt.tableId) {
        const res = await fetch('/api/ludo/admin/table/cancel-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({
            tableId: actionPrompt.tableId,
            reason: actionReason || 'Waiting queue cancelled by administrator',
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setStatusMsg({
            text: `Queue cancelled! ${data.refundedCount || 0} players safely refunded to Cash wallet.`,
          });
        }
      } else if (actionPrompt.type === 'pause_match' && actionPrompt.matchId) {
        const res = await fetch('/api/ludo/admin/match/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({
            matchId: actionPrompt.matchId,
            reason: actionReason || 'Game paused by administrator',
          }),
        });
        if (res.ok) setStatusMsg({ text: `Match ${actionPrompt.matchId} paused.` });
      } else if (actionPrompt.type === 'resume_match' && actionPrompt.matchId) {
        const res = await fetch('/api/ludo/admin/match/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({ matchId: actionPrompt.matchId }),
        });
        if (res.ok) setStatusMsg({ text: `Match ${actionPrompt.matchId} resumed.` });
      } else if (actionPrompt.type === 'cancel_match' && actionPrompt.matchId) {
        const res = await fetch('/api/ludo/admin/match/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({
            matchId: actionPrompt.matchId,
            reason: actionReason || 'Match cancelled by administrator with full entry refunds',
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setStatusMsg({
            text: `Match cancelled safely! Entry fees refunded to all ${data.refundedPlayersCount || 0} players.`,
          });
        }
      } else if (actionPrompt.type === 'archive_table' && actionPrompt.tableId) {
        const res = await fetch('/api/ludo/admin/table/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({ tableId: actionPrompt.tableId }),
        });
        if (res.ok) setStatusMsg({ text: `Table ${actionPrompt.tableId} archived.` });
      }

      setActionPrompt(null);
      setActionReason('');
      loadTablesData();
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Action failed', error: true });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Filter tables
  const filteredTables = tables.filter((t) => {
    if (t.isArchived) return false;
    if (modeFilter !== 'all' && String(t.mode) !== modeFilter) return false;
    if (statusFilter === 'active' && !t.isActive) return false;
    if (statusFilter === 'disabled' && t.isActive) return false;
    if (statusFilter === 'queued' && (!t.waitingQueue || t.waitingQueue.length === 0)) return false;
    if (statusFilter === 'live' && (!t.activeMatchesList || t.activeMatchesList.length === 0)) return false;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      const matchesFee = String(t.entryFee).includes(q);
      const matchesId = t.id.toLowerCase().includes(q);
      return matchesFee || matchesId;
    }
    return true;
  });

  // Calculate live statistics
  const totalTablesCount = tables.filter((t) => !t.isArchived).length;
  const activeTablesCount = tables.filter((t) => t.isActive && !t.isArchived).length;
  const totalWaitingPlayers = tables.reduce((acc, t) => acc + (t.waitingQueue?.length || 0), 0);
  const totalLiveMatches = tables.reduce((acc, t) => acc + (t.activeMatchesList?.length || 0), 0);
  const totalOnlinePlayers = tables.reduce((acc, t) => acc + (t.onlinePlayers || 0), 0);
  const totalPlayingPlayers = tables.reduce((acc, t) => acc + (t.playingPlayers || 0), 0);
  const totalCustomTables = tables.filter((t) => t.manualOnlinePlayers !== undefined || t.manualPlayingPlayers !== undefined).length;

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Ludo Table Management</h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  REAL STATE ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative control over all cash tables, real waiting queues, active match refunds, and player traffic counts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Create Table</span>
            </button>
            <button
              onClick={loadTablesData}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real Multiplayer Integrity Notice */}
      <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-300 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-cyan-200">
            Real-Time State Guarantee (Zero Fake Player Counts)
          </p>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Every table displays authentic joined players, verified UIDs, and real-time socket connections. Disabled tables strictly reject new joins. When an admin cancels a table or match, entry tokens are refunded automatically.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            statusMsg.error
              ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
              : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
          }`}
        >
          {statusMsg.error ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Real-Time Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Configured Tables</span>
          <span className="font-mono text-base font-black text-white mt-0.5 block">
            {activeTablesCount} / {totalTablesCount} Active
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Waiting In Queues</span>
          <span className="font-mono text-base font-black text-amber-400 mt-0.5 block">
            {totalWaitingPlayers} Players
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Live Matches</span>
          <span className="font-mono text-base font-black text-blue-400 mt-0.5 block">
            {totalLiveMatches} In Progress
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Formats Active</span>
          <div className="flex justify-center items-center gap-1.5 mt-1">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                config.allowTwoPlayer ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
              }`}
            >
              2P: {config.allowTwoPlayer ? 'ON' : 'OFF'}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                config.allowFourPlayer ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-500'
              }`}
            >
              4P: {config.allowFourPlayer ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Live Player Traffic & Audience Control Panel */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900/95 to-blue-950/80 border border-emerald-500/40 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Gamepad2 className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  Player Lobby Traffic &amp; Bot Audience Control
                </h4>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Displays active online &amp; playing players across all 42 tables. You can customize player counts for any individual table or bulk calibrate.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkTrafficAction('reset_all_auto')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="Reset all tables back to default 5000+ bot distribution formula"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset All to Auto</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkTrafficAction('scale', 1.25)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-emerald-500/40"
              title="Increase online & playing player traffic by 25%"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>+25% Traffic</span>
            </button>
            <button
              type="button"
              onClick={() => handleBulkTrafficAction('scale', 0.8)}
              className="px-2.5 py-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-blue-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-blue-500/40"
              title="Scale down traffic by 20%"
            >
              <span>-20% Traffic</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Online Players</span>
                <span className="text-sm font-black font-mono text-emerald-400">
                  {totalOnlinePlayers.toLocaleString('en-IN')} Live
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">All 42 Tables</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total In-Game Active</span>
                <span className="text-sm font-black font-mono text-blue-400">
                  {totalPlayingPlayers.toLocaleString('en-IN')} Playing
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Matches Running</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Custom Admin Overrides</span>
                <span className="text-sm font-black font-mono text-purple-300">
                  {totalCustomTables} / {totalTablesCount} Tables
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400">
              {totalCustomTables > 0 ? 'Customised' : 'All Auto'}
            </span>
          </div>
        </div>
      </div>

      {/* Global Configuration Card — Timer Ludo & Fair Play Rules */}
      <form onSubmit={handleSaveConfig} className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Timer Ludo — Highest Score Wins Configuration
              </h4>
              <p className="text-[10px] text-slate-400">
                Authoritative match durations, dice scoring, capture transfers, and deterministic tie-breaker settings.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
            Server Authoritative
          </span>
        </div>

        {/* Master Toggles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Timer Ludo Enabled Toggle */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Timer Ludo Mode</span>
              <span className="text-[11px] text-slate-400">Highest Score Wins format</span>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, timerLudoEnabled: !config.timerLudoEnabled })}
              className={`p-1 rounded-lg ${config.timerLudoEnabled ? 'text-amber-400' : 'text-slate-500'}`}
            >
              {config.timerLudoEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          {/* Dice Points Rule Toggle */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Dice Points (1-6 pts)</span>
              <span className="text-[11px] text-slate-400">Roll value added to score</span>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, dicePointsEnabled: !config.dicePointsEnabled })}
              className={`p-1 rounded-lg ${config.dicePointsEnabled ? 'text-emerald-400' : 'text-slate-500'}`}
            >
              {config.dicePointsEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          {/* Capture Score Transfer Toggle */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Capture Score Transfer</span>
              <span className="text-[11px] text-slate-400">Steal captured token's pts</span>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, captureTransferEnabled: !config.captureTransferEnabled })}
              className={`p-1 rounded-lg ${config.captureTransferEnabled ? 'text-emerald-400' : 'text-slate-500'}`}
            >
              {config.captureTransferEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>
        </div>

        {/* Durations & Home Bonus Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* 2-Player Match Duration */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
            <label className="text-slate-300 font-bold block flex items-center justify-between">
              <span>2-Player Match Duration:</span>
              <span className="text-[10px] text-amber-400 font-mono">Minutes</span>
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={config.durationMinutes2P}
              onChange={(e) => setConfig({ ...config, durationMinutes2P: Math.max(1, Number(e.target.value)) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
            />
            <span className="text-[10px] text-slate-400 block">Default: 10 mins (or 8 mins)</span>
          </div>

          {/* 4-Player Match Duration */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
            <label className="text-slate-300 font-bold block flex items-center justify-between">
              <span>4-Player Match Duration:</span>
              <span className="text-[10px] text-amber-400 font-mono">Minutes</span>
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={config.durationMinutes4P}
              onChange={(e) => setConfig({ ...config, durationMinutes4P: Math.max(1, Number(e.target.value)) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
            />
            <span className="text-[10px] text-slate-400 block">Default: 15 minutes</span>
          </div>

          {/* Reaching Home Bonus */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
            <label className="text-slate-300 font-bold block flex items-center justify-between">
              <span>Home Token Bonus:</span>
              <span className="text-[10px] text-emerald-400 font-mono">Points</span>
            </label>
            <input
              type="number"
              min={0}
              max={500}
              value={config.homeBonusPoints}
              onChange={(e) => setConfig({ ...config, homeBonusPoints: Math.max(0, Number(e.target.value)) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-slate-400 block">Awarded once per token (Default: 60)</span>
          </div>
        </div>

        {/* Tie-Breaker Rule Selector & Timeouts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Tie-Breaker Rule */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1 sm:col-span-1">
            <label className="text-slate-300 font-bold block">
              Deterministic Tie-Breaker:
            </label>
            <select
              value={config.tieBreakerRule}
              onChange={(e) => setConfig({ ...config, tieBreakerRule: e.target.value as any })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="home_tokens_then_captures">Home Tokens ➔ Captures ➔ Timeouts</option>
              <option value="most_captures">Most Captures ➔ Home Tokens ➔ Timeouts</option>
              <option value="least_timeouts">Fewest Timeouts ➔ Home Tokens ➔ Captures</option>
            </select>
            <span className="text-[10px] text-slate-400 block">Rule shown to players before match</span>
          </div>

          {/* Turn Timeout (Seconds) */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
            <label className="text-slate-300 font-bold block">
              Player Turn Timeout (Seconds):
            </label>
            <input
              type="number"
              min={10}
              max={60}
              value={config.turnTimeoutSeconds}
              onChange={(e) => setConfig({ ...config, turnTimeoutSeconds: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-slate-400 block">Time to roll & move (Default: 30s)</span>
          </div>

          {/* Max Consecutive Timeouts */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
            <label className="text-slate-300 font-bold block">
              Max Consecutive Timeouts:
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={config.maxTimeoutsBeforeForfeit}
              onChange={(e) => setConfig({ ...config, maxTimeoutsBeforeForfeit: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-slate-400 block">Forfeit if missed (Default: 3)</span>
          </div>
        </div>

        {/* Security & Anti-Cheat Assurance */}
        <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 flex items-start gap-2">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-white">Authoritative Fair-Play Guarantee:</span>
            <span className="text-slate-300 text-[10px]">
              Admins cannot alter live player scores or force match winners. Matches can be cancelled safely with audited reasons and 100% automated coin refunds.
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSavingConfig}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Timer Ludo Settings</span>
        </button>
      </form>

      {/* Filter and Table Catalog */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Ludo Cash Table Directory ({filteredTables.length} Configured)
            </h4>
            <p className="text-[11px] text-slate-400">
              Manage entry requirements, inspect joined players with UIDs, and control live tables.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
              {(['all', 'active', 'disabled', 'queued', 'live'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 rounded-lg font-bold capitalize transition cursor-pointer ${
                    statusFilter === s ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Mode Filter */}
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
              {(['all', '2', '4'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModeFilter(m)}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    modeFilter === m ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m === 'all' ? 'All Formats' : `${m}P`}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search table or ₹..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Table Rows List */}
        <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
          {filteredTables.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No matching tables found.
            </div>
          ) : (
            filteredTables.map((table) => {
              const queue = table.waitingQueue || [];
              const matches = table.activeMatchesList || [];
              const hasLiveMatch = matches.length > 0;
              const hasWaitingPlayers = queue.length > 0;
              const totalJoinedCount = queue.length + matches.reduce((acc, m) => acc + m.players.length, 0);

              // Status derivation
              let tableStatus = 'IDLE';
              let statusColor = 'bg-slate-800 text-slate-400 border-slate-700';

              if (!table.isActive) {
                tableStatus = 'DISABLED';
                statusColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
              } else if (hasLiveMatch) {
                tableStatus = 'LIVE MATCH';
                statusColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse';
              } else if (hasWaitingPlayers) {
                tableStatus = `${queue.length}/${table.mode} WAITING`;
                statusColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
              }

              return (
                <div
                  key={table.id}
                  className={`p-3 rounded-2xl border transition ${
                    hasLiveMatch
                      ? 'bg-blue-950/20 border-blue-500/40 shadow-md'
                      : hasWaitingPlayers
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : !table.isActive
                      ? 'bg-slate-950/40 border-slate-800/80 opacity-75'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Left: Info */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-black text-white">
                          ₹{table.entryFee.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs text-slate-300 font-bold">
                          {table.mode === 2 ? 'Quick 1v1 Table' : '4-Player Arena'}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            table.mode === 2
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          }`}
                        >
                          {table.mode}P Format
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${statusColor}`}>
                          {tableStatus}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          ID: {table.id}
                        </span>
                        {Boolean(table.manualOnlinePlayers !== undefined || table.manualPlayingPlayers !== undefined) && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                            <span>Custom Traffic</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>
                          1st Prize: <strong className="text-emerald-400 font-mono">₹{table.prize}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Min Wallet Required: <strong className="text-slate-300 font-mono">₹{table.minBalanceRequired || table.entryFee}</strong>
                        </span>
                        <span>•</span>
                        <span className="text-emerald-300 font-medium">
                          Online: <strong className="font-mono font-bold text-emerald-400">{table.onlinePlayers || 0}</strong>
                        </span>
                        <span>•</span>
                        <span className="text-blue-300 font-medium">
                          In Game: <strong className="font-mono font-bold text-blue-400">{table.playingPlayers || 0}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Pool Reserved:{' '}
                          <strong className="text-amber-400 font-mono">
                            ₹{(table.entryFee * (hasLiveMatch ? table.mode : queue.length)).toLocaleString('en-IN')}
                          </strong>
                        </span>
                      </div>

                      {/* Display Joined Players / Queue UIDs */}
                      {hasWaitingPlayers && (
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                            Queue:
                          </span>
                          {queue.map((p) => (
                            <span
                              key={p.userId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[10px] font-mono"
                            >
                              <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                              <strong>{p.userName}</strong>
                              <span className="text-slate-400">({p.userId})</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Display Active Match Players */}
                      {hasLiveMatch && (
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                            Active Players:
                          </span>
                          {matches[0]?.players?.map((p) => (
                            <span
                              key={p.userId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-200 text-[10px] font-mono"
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  p.color === 'red'
                                    ? 'bg-rose-500'
                                    : p.color === 'green'
                                    ? 'bg-emerald-500'
                                    : p.color === 'yellow'
                                    ? 'bg-amber-400'
                                    : 'bg-blue-500'
                                }`}
                              />
                              <strong>{p.userName}</strong>
                              <span className="text-slate-400">({p.userId})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setInspectingTable(table)}
                        className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Inspect Table Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={() => handleOpenTrafficModal(table)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          table.manualOnlinePlayers !== undefined || table.manualPlayingPlayers !== undefined
                            ? 'bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-200'
                            : 'bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300'
                        }`}
                        title="Edit Online and In-Game Players"
                      >
                        <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Edit Players</span>
                      </button>

                      <button
                        onClick={() => handleOpenEdit(table)}
                        className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Edit Real Cash Requirements"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Edit</span>
                      </button>

                      {hasWaitingPlayers && (
                        <button
                          onClick={() =>
                            setActionPrompt({
                              type: 'cancel_queue',
                              tableId: table.id,
                              title: `Cancel Waiting Queue (₹${table.entryFee})`,
                              message: `Are you sure? This will remove all ${queue.length} waiting player(s) and automatically refund ₹${table.entryFee} to each player's wallet.`,
                            })
                          }
                          className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Cancel Queue and Refund Players"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Cancel Queue</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleTable(table.id, table.isActive)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          table.isActive
                            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/80'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{table.isActive ? 'Active' : 'Disabled'}</span>
                      </button>

                      <button
                        onClick={() =>
                          setActionPrompt({
                            type: 'archive_table',
                            tableId: table.id,
                            title: `Archive Table ${table.id}`,
                            message: `Archive this table? It will be removed from the active catalog.`,
                          })
                        }
                        className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                        title="Archive Table"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* INSPECT TABLE MODAL */}
      {inspectingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-blue-900/80 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">
                  Table Inspection: ₹{inspectingTable.entryFee} ({inspectingTable.mode}P)
                </h3>
              </div>
              <button
                onClick={() => setInspectingTable(null)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1"
              >
                Close
              </button>
            </div>

            {/* Table Core Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Table ID</span>
                <span className="font-mono text-white text-[11px] truncate block">{inspectingTable.id}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Entry Fee</span>
                <span className="font-mono text-emerald-400 font-bold">₹{inspectingTable.entryFee}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Prize Pool</span>
                <span className="font-mono text-amber-400 font-bold">₹{inspectingTable.prize}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                    inspectingTable.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {inspectingTable.isActive ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
            </div>

            {/* Waiting Queue Details */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Waiting Players Queue ({inspectingTable.waitingQueue?.length || 0})</span>
                </h5>
                {inspectingTable.waitingQueue && inspectingTable.waitingQueue.length > 0 && (
                  <button
                    onClick={() => {
                      setActionPrompt({
                        type: 'cancel_queue',
                        tableId: inspectingTable.id,
                        title: `Cancel Waiting Queue`,
                        message: `Cancel this queue and refund ₹${inspectingTable.entryFee} to ${inspectingTable.waitingQueue?.length} player(s)?`,
                      });
                      setInspectingTable(null);
                    }}
                    className="text-[10px] font-bold text-rose-400 hover:underline"
                  >
                    Cancel Queue &amp; Refund
                  </button>
                )}
              </div>

              {!inspectingTable.waitingQueue || inspectingTable.waitingQueue.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No players currently waiting in queue.</p>
              ) : (
                <div className="space-y-1.5">
                  {inspectingTable.waitingQueue.map((p, idx) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[10px]">#{idx + 1}</span>
                        <Wifi className="w-3 h-3 text-emerald-400" />
                        <span className="font-bold text-white">{p.userName}</span>
                        <span className="text-[10px] font-mono text-slate-400">UID: {p.userId}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {p.joinedAt ? new Date(p.joinedAt).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Matches on this Table */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3 space-y-2">
              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span>Active Matches ({inspectingTable.activeMatchesList?.length || 0})</span>
              </h5>

              {!inspectingTable.activeMatchesList || inspectingTable.activeMatchesList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No live match running on this table.</p>
              ) : (
                <div className="space-y-3">
                  {inspectingTable.activeMatchesList.map((m) => (
                    <div
                      key={m.matchId}
                      className="p-3 rounded-xl bg-slate-950/80 border border-blue-500/30 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-300 font-mono font-bold">Match #{m.matchId}</span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase">
                            {m.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {m.status === 'in_progress' ? (
                            <button
                              onClick={() => {
                                setActionPrompt({
                                  type: 'pause_match',
                                  matchId: m.matchId,
                                  title: `Pause Match ${m.matchId}`,
                                  message: 'Pause this match? Gameplay will be halted.',
                                });
                                setInspectingTable(null);
                              }}
                              className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold"
                            >
                              Pause
                            </button>
                          ) : m.status === 'paused' ? (
                            <button
                              onClick={() => {
                                setActionPrompt({
                                  type: 'resume_match',
                                  matchId: m.matchId,
                                  title: `Resume Match ${m.matchId}`,
                                  message: 'Resume gameplay for this match?',
                                });
                                setInspectingTable(null);
                              }}
                              className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold"
                            >
                              Resume
                            </button>
                          ) : null}

                          <button
                            onClick={() => {
                              setActionPrompt({
                                type: 'cancel_match',
                                matchId: m.matchId,
                                title: `Cancel Match ${m.matchId}`,
                                message: `Cancel this match and safely refund ₹${m.entryFee} to all participating players?`,
                              });
                              setInspectingTable(null);
                            }}
                            className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold"
                          >
                            Cancel &amp; Safe Refund
                          </button>
                        </div>
                      </div>

                      {/* Players */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {m.players.map((p) => (
                          <div
                            key={p.userId}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  p.color === 'red'
                                    ? 'bg-rose-500'
                                    : p.color === 'green'
                                    ? 'bg-emerald-500'
                                    : p.color === 'yellow'
                                    ? 'bg-amber-400'
                                    : 'bg-blue-500'
                                }`}
                              />
                              <span className="font-bold text-white">{p.userName}</span>
                              <span className="text-[10px] font-mono text-slate-400">({p.userId})</span>
                            </div>
                            <span className="text-[10px] text-emerald-400">Connected</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW TABLE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-amber-500/40 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Create New Ludo Cash Table</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateTableSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Format (Player Count)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewMode(2)}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      newMode === 2
                        ? 'bg-blue-600 border-blue-500 text-white shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    2 Players (1v1 Quick)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMode(4)}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      newMode === 4
                        ? 'bg-purple-600 border-purple-500 text-white shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    4 Players (Arena)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Real Cash Entry Fee (INR)
                </label>
                <input
                  type="number"
                  min={1}
                  value={newEntryFee}
                  onChange={(e) => setNewEntryFee(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  1st Place Prize (INR)
                </label>
                <input
                  type="number"
                  min={1}
                  value={newPrize}
                  onChange={(e) => setNewPrize(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Min Wallet Balance Required
                </label>
                <input
                  type="number"
                  min={1}
                  value={newMinBalance}
                  onChange={(e) => setNewMinBalance(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow cursor-pointer active:scale-95"
                >
                  Confirm &amp; Publish Cash Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TABLE MODAL */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-blue-900/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <span>Edit Table Requirements</span>
              </h3>
              <button
                onClick={() => setEditingTable(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleEditTableSubmit} className="space-y-3 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Table ID</span>
                <span className="font-mono text-white text-[11px]">{editingTable.id}</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Entry Cash Fee (INR)
                </label>
                <input
                  type="number"
                  min={1}
                  value={editFee}
                  onChange={(e) => setEditFee(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Winner 1st Prize (INR)
                </label>
                <input
                  type="number"
                  min={1}
                  value={editPrize}
                  onChange={(e) => setEditPrize(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div>
                  <span className="font-bold text-white block">Table Active Status</span>
                  <span className="text-[10px] text-slate-400">Disabled tables reject new joins</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditActive(!editActive)}
                  className={`p-1 rounded-lg ${editActive ? 'text-emerald-400' : 'text-slate-500'}`}
                >
                  {editActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>

              {/* Player Traffic Configuration in Edit Modal */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">Custom Player Traffic</span>
                    <span className="text-[10px] text-slate-400">Override 5,000+ bot pool numbers</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditUseCustomTraffic(!editUseCustomTraffic)}
                    className={`p-1 rounded-lg ${editUseCustomTraffic ? 'text-purple-400' : 'text-slate-500'}`}
                  >
                    {editUseCustomTraffic ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>
                </div>

                {editUseCustomTraffic ? (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <label className="text-[10px] font-bold text-emerald-400 block mb-1">
                        🟢 Online Count
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editOnlinePlayers}
                        onChange={(e) => setEditOnlinePlayers(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-blue-400 block mb-1">
                        🎮 In-Game / Playing
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editPlayingPlayers}
                        onChange={(e) => setEditPlayingPlayers(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-slate-950 border border-blue-500/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-blue-300 font-bold focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">
                    Using dynamic auto-calculated bot numbers based on entry stake.
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition shadow cursor-pointer active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED PLAYER TRAFFIC & BOTS MODAL */}
      {trafficModalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-emerald-500/50 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Edit Table Player Traffic</h3>
                  <p className="text-[10px] text-slate-400">
                    Live counts displayed to users in the lobby
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTrafficModalTable(null)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveTrafficModal} className="space-y-4 text-xs">
              {/* Table Info Badge */}
              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Table Selected</span>
                  <span className="font-mono text-white text-sm font-black">
                    ₹{trafficModalTable.entryFee} ({trafficModalTable.mode}P)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Table ID</span>
                  <span className="font-mono text-slate-400 text-xs">{trafficModalTable.id}</span>
                </div>
              </div>

              {/* Reset to Auto Option */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div>
                  <span className="font-bold text-slate-200 block text-[11px]">Revert to Dynamic Auto Bots</span>
                  <span className="text-[10px] text-slate-400">Calculates automatically from 5,000+ bot pool</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalResetAuto(!modalResetAuto)}
                  className={`p-1 rounded-lg ${modalResetAuto ? 'text-cyan-400' : 'text-slate-500'}`}
                >
                  {modalResetAuto ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>

              {!modalResetAuto && (
                <div className="space-y-3">
                  {/* Online Count */}
                  <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                        <span>Online Players (🟢 Lobby Display)</span>
                      </label>
                      <span className="text-[11px] font-mono text-slate-400 font-bold">
                        {modalOnlinePlayers} Active
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={modalOnlinePlayers}
                      onChange={(e) => setModalOnlinePlayers(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2 text-base font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                    />
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 font-bold">Quick:</span>
                      {[-50, -10, 10, 50, 100].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => setModalOnlinePlayers((prev) => Math.max(0, prev + delta))}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-300 transition"
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Playing / In-Game Count */}
                  <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" />
                        <span>In-Game Players (🎮 Matches Running)</span>
                      </label>
                      <span className="text-[11px] font-mono text-slate-400 font-bold">
                        {modalPlayingPlayers} Playing
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={modalPlayingPlayers}
                      onChange={(e) => setModalPlayingPlayers(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-blue-500/50 rounded-xl px-3 py-2 text-base font-mono text-blue-300 font-bold focus:outline-none focus:border-blue-400"
                    />
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 font-bold">Quick:</span>
                      {[-50, -10, 10, 50, 100].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => setModalPlayingPlayers((prev) => Math.max(0, prev + delta))}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-300 transition"
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingTraffic}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingTraffic ? 'Saving Counts...' : 'Save Player Counts'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION / REASON PROMPT MODAL */}
      {actionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
          <div className="bg-[#0b1222] border border-rose-500/40 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>{actionPrompt.title}</span>
              </h3>
              <button
                onClick={() => setActionPrompt(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {actionPrompt.message}
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Administrative Reason / Audit Note:
              </label>
              <textarea
                rows={2}
                placeholder="Reason for administrative intervention..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionPrompt(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={isProcessingAction}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition cursor-pointer"
              >
                {isProcessingAction ? 'Executing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
