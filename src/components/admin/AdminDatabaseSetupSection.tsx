import React, { useState } from 'react';
import { Database, Copy, Check, Key, ShieldCheck, Terminal, ExternalLink, RefreshCw } from 'lucide-react';
import { supabaseUrl, supabaseAnonKey, isSupabaseConfigured, updateSupabaseConfig } from '../../lib/supabase';

export const AdminDatabaseSetupSection: React.FC = () => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [selectedSchemaType, setSelectedSchemaType] = useState<'cricket' | 'ludo'>('cricket');
  const [customUrl, setCustomUrl] = useState(supabaseUrl);
  const [customKey, setCustomKey] = useState(supabaseAnonKey);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const ludoSqlSchemaCode = `-- =========================================================
-- LUDO ARENA ADDITIVE SCHEMA (Does not overwrite Cricket!)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.ludo_tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  format VARCHAR(5) NOT NULL DEFAULT '4P' CHECK (format IN ('2P', '4P')),
  status VARCHAR(25) NOT NULL DEFAULT 'registration_open' CHECK (status IN ('upcoming', 'registration_open', 'in_progress', 'completed', 'cancelled')),
  max_participants INT NOT NULL DEFAULT 16,
  enrolled_count INT NOT NULL DEFAULT 0,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rules_description TEXT NOT NULL,
  winner_name TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ludo_tournament_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.ludo_tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'registered',
  points INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_ludo_tournament_participant UNIQUE (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.ludo_bracket_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.ludo_tournaments(id) ON DELETE CASCADE NOT NULL,
  round INT NOT NULL DEFAULT 1,
  round_name TEXT NOT NULL,
  player_names TEXT[] NOT NULL,
  winner_name TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  scheduled_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ludo_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  host_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  player_count INT NOT NULL DEFAULT 4 CHECK (player_count IN (2, 4)),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ludo_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_bracket_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ludo tournaments" ON public.ludo_tournaments FOR SELECT USING (TRUE);
CREATE POLICY "Public read ludo brackets" ON public.ludo_bracket_matches FOR SELECT USING (TRUE);
CREATE POLICY "Public read ludo rooms" ON public.ludo_rooms FOR SELECT USING (TRUE);
CREATE POLICY "Users register free for ludo" ON public.ludo_tournament_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
`;

  const cricketSqlSchemaCode = `-- =========================================================
-- CRICKET ARENA: SUPABASE POSTGRESQL SCHEMA WITH RLS
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles Table (Users & Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cricket Teams
CREATE TABLE IF NOT EXISTS public.cricket_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  code VARCHAR(5) NOT NULL UNIQUE,
  logo TEXT,
  primary_color TEXT DEFAULT '#10B981',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Players Table
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES public.cricket_teams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('WK', 'BAT', 'AR', 'BOWL')),
  credits NUMERIC(4, 1) NOT NULL DEFAULT 8.5 CHECK (credits >= 4.0 AND credits <= 15.0),
  avatar TEXT,
  matches_played INT DEFAULT 0,
  total_runs INT DEFAULT 0,
  total_wickets INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  format VARCHAR(10) NOT NULL DEFAULT 'T20',
  team_a_id UUID REFERENCES public.cricket_teams(id) NOT NULL,
  team_b_id UUID REFERENCES public.cricket_teams(id) NOT NULL,
  venue TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('draft', 'upcoming', 'live', 'completed')),
  entry_limit INT NOT NULL DEFAULT 5000,
  enrolled_count INT NOT NULL DEFAULT 0,
  banner_image TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tournaments" ON public.tournaments FOR SELECT USING (TRUE);
CREATE POLICY "Public read players" ON public.players FOR SELECT USING (TRUE);
`;

  const activeSql = selectedSchemaType === 'cricket' ? cricketSqlSchemaCode : ludoSqlSchemaCode;

  const handleCopySql = () => {
    navigator.clipboard.writeText(activeSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSupabaseConfig(customUrl, customKey);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Database &amp; SQL Schema Management</h3>
              <p className="text-xs text-slate-400">
                Protected technical tool: Supabase connection status, schema queries, and diagnostics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                isSupabaseConfigured
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isSupabaseConfigured ? 'Connected to Supabase' : 'Local Fallback Storage Active'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Supabase URL & Anon Key Configuration */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-3 text-white font-bold text-sm">
          <Key className="w-4 h-4 text-emerald-400" />
          <h4>Supabase Project Credentials</h4>
        </div>
        <p className="text-xs text-slate-300 mb-4">
          Configure or update your project URL and Public Anon Key. In production, ensure these are configured in your server environment variables.
        </p>

        <form onSubmit={handleSaveConfig} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Project URL (VITE_SUPABASE_URL)
              </label>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Anon Key (VITE_SUPABASE_ANON_KEY)
              </label>
              <input
                type="text"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              Changes update your browser storage and reload connection states.
            </span>
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-bold">Saved! Reloading...</span>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow cursor-pointer"
              >
                Save &amp; Connect
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* SQL Schema Viewer & Copy Tool */}
      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">PostgreSQL Schema &amp; RLS Policies</h4>
          </div>

          <div className="flex items-center gap-2">
            {/* Schema Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-0.5">
              <button
                onClick={() => setSelectedSchemaType('cricket')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedSchemaType === 'cricket'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cricket Schema
              </button>
              <button
                onClick={() => setSelectedSchemaType('ludo')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedSchemaType === 'ludo'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ludo Schema
              </button>
            </div>

            <button
              onClick={handleCopySql}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition cursor-pointer"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL'}</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          Execute this SQL script directly in your Supabase SQL Editor. It creates all tables and Row Level Security policies.
        </p>

        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#070b14]">
          <pre className="p-3 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-80 leading-relaxed">
            {activeSql}
          </pre>
        </div>
      </div>
    </div>
  );
};
