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
} from 'lucide-react';
import { LudoCashTable, LudoAdminConfig } from '../../types/ludoCash';
import { useAuth } from '../../context/AuthContext';

export const AdminLudoTablesSection: React.FC = () => {
  const { user } = useAuth();

  const [tables, setTables] = useState<LudoCashTable[]>([]);
  const [config, setConfig] = useState<LudoAdminConfig>({
    onlineLudoEnabled: true,
    allowTwoPlayer: true,
    allowFourPlayer: true,
    turnTimeoutSeconds: 30,
    maxTimeoutsBeforeForfeit: 3,
  });

  const [activeQueues, setActiveQueues] = useState<Record<string, number>>({});
  const [liveMatchesCount, setLiveMatchesCount] = useState<number>(0);
  const [completedMatchesCount, setCompletedMatchesCount] = useState<number>(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | '2' | '4'>('all');
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load Admin Data from Server
  const loadAdminData = async () => {
    try {
      const res = await fetch('/api/ludo/admin/overview');
      if (res.ok) {
        const data = await res.json();
        if (data.tables) setTables(data.tables);
        if (data.config) setConfig(data.config);
        if (data.activeQueues) setActiveQueues(data.activeQueues);
        if (data.liveMatchesCount !== undefined) setLiveMatchesCount(data.liveMatchesCount);
        if (data.completedMatchesCount !== undefined) setCompletedMatchesCount(data.completedMatchesCount);
      }
    } catch (err) {
      console.warn('Failed to fetch ludo admin data:', err);
    }
  };

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Toggle Table Active / Inactive
  const handleToggleTable = async (tableId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/ludo/admin/table/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          tableId,
          isActive: !currentStatus,
        }),
      });

      if (res.ok) {
        setTables((prev) =>
          prev.map((t) => (t.id === tableId ? { ...t, isActive: !currentStatus } : t))
        );
        setStatusMsg({ text: `Table ${tableId} updated to ${!currentStatus ? 'Active' : 'Disabled'}.` });
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Failed to update table status', error: true });
    }
  };

  // Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/ludo/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setStatusMsg({ text: 'Online Ludo configuration saved successfully!' });
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg({ text: err.error || 'Failed to save configuration', error: true });
      }
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Network error', error: true });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTables = tables.filter((t) => {
    if (modeFilter !== 'all' && String(t.mode) !== modeFilter) return false;
    if (searchFilter && !String(t.entryFee).includes(searchFilter)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Section Header */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Ludo Tables &amp; Real Cash Rewards</h3>
              <p className="text-xs text-slate-400">
                Authoritative configuration for all 21 cash table tiers, prize ratios, queues, and game timeouts.
              </p>
            </div>
          </div>

          <button
            onClick={loadAdminData}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
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
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Master Switch</span>
          <span
            className={`text-xs font-black inline-block mt-1 px-2 py-0.5 rounded ${
              config.onlineLudoEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {config.onlineLudoEnabled ? 'ONLINE ACTIVE' : 'PAUSED'}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Live Queues</span>
          <span className="font-mono text-base font-black text-amber-400 mt-0.5 block">
            {Object.keys(activeQueues).length} Active
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Matches in Progress</span>
          <span className="font-mono text-base font-black text-blue-400 mt-0.5 block">
            {liveMatchesCount} Live
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Completed Matches</span>
          <span className="font-mono text-base font-black text-emerald-400 mt-0.5 block">
            {completedMatchesCount} Settled
          </span>
        </div>
      </div>

      {/* Global Configuration Card */}
      <form onSubmit={handleSaveConfig} className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
          <Settings className="w-3.5 h-3.5 text-blue-400" />
          <span>Multiplayer &amp; Fair Play Rules</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Online Master Toggle */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Online Ludo Platform</span>
              <span className="text-[11px] text-slate-400">Master availability</span>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, onlineLudoEnabled: !config.onlineLudoEnabled })}
              className={`p-1 rounded-lg ${config.onlineLudoEnabled ? 'text-emerald-400' : 'text-slate-500'}`}
            >
              {config.onlineLudoEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          {/* 2-Player Toggle */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">2-Player Tables (1v1)</span>
              <span className="text-[11px] text-slate-400">Allow 1v1 duels</span>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, allowTwoPlayer: !config.allowTwoPlayer })}
              className={`p-1 rounded-lg ${config.allowTwoPlayer ? 'text-emerald-400' : 'text-slate-500'}`}
            >
              {config.allowTwoPlayer ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          {/* 4-Player Toggle */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">4-Player Tables</span>
              <span className="text-[11px] text-slate-400">Allow 4P matches</span>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, allowFourPlayer: !config.allowFourPlayer })}
              className={`p-1 rounded-lg ${config.allowFourPlayer ? 'text-emerald-400' : 'text-slate-500'}`}
            >
              {config.allowFourPlayer ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>
        </div>

        {/* Turn Timeout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div>
            <label className="text-slate-400 font-semibold block mb-1">
              Turn Timeout (Seconds):
            </label>
            <input
              type="number"
              min={10}
              max={60}
              value={config.turnTimeoutSeconds}
              onChange={(e) => setConfig({ ...config, turnTimeoutSeconds: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">
              Max Timeouts Before Forfeit:
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={config.maxTimeoutsBeforeForfeit}
              onChange={(e) =>
                setConfig({ ...config, maxTimeoutsBeforeForfeit: Number(e.target.value) })
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Multiplayer Config</span>
        </button>
      </form>

      {/* Individual Cash Tables Catalog */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Cash Table Catalog ({filteredTables.length} Active Tiers)
            </h4>
            <p className="text-[11px] text-slate-400">
              Toggle availability for individual entry amounts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Filter */}
            <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setModeFilter('all')}
                className={`px-2 py-1 rounded-lg font-bold transition ${
                  modeFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setModeFilter('2')}
                className={`px-2 py-1 rounded-lg font-bold transition ${
                  modeFilter === '2' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                2P
              </button>
              <button
                type="button"
                onClick={() => setModeFilter('4')}
                className={`px-2 py-1 rounded-lg font-bold transition ${
                  modeFilter === '4' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                4P
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search ₹ amount..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
          {filteredTables.map((table) => {
            const queueCount = activeQueues[table.id] || 0;

            return (
              <div
                key={table.id}
                className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-900/40 px-2 rounded-xl transition"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-white">
                      ₹{table.entryFee.toLocaleString('en-IN')} Entry
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        table.mode === 2
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}
                    >
                      {table.mode} Players
                    </span>
                    {queueCount > 0 && (
                      <span className="text-[10px] font-black text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/30">
                        {queueCount} Waiting
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Winner 1st Prize: <span className="text-emerald-400 font-mono font-bold">₹{table.prize.toLocaleString('en-IN')}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleTable(table.id, table.isActive)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                      table.isActive
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/80'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{table.isActive ? 'Active' : 'Disabled'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
