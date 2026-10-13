import React, { useState } from 'react';
import { X, Copy, Check, Database, Key, HelpCircle, ExternalLink, ShieldCheck, Terminal } from 'lucide-react';
import { supabaseUrl, supabaseAnonKey, isSupabaseConfigured, updateSupabaseConfig } from '../../lib/supabase';

interface HindiSetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HindiSetupGuideModal: React.FC<HindiSetupGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [selectedSchemaType, setSelectedSchemaType] = useState<'cricket' | 'ludo'>('cricket');
  const [customUrl, setCustomUrl] = useState(supabaseUrl);
  const [customKey, setCustomKey] = useState(supabaseAnonKey);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

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

  const sqlSchemaCode = `-- =========================================================
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

-- Players Roster
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

-- Tournaments Table (100% Free Entry)
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  format VARCHAR(10) NOT NULL DEFAULT 'T20' CHECK (format IN ('T20', 'ODI', 'TEST', 'T10')),
  team_a_id UUID REFERENCES public.cricket_teams(id) NOT NULL,
  team_b_id UUID REFERENCES public.cricket_teams(id) NOT NULL,
  venue TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('draft', 'upcoming', 'live', 'completed')),
  entry_limit INT NOT NULL DEFAULT 5000,
  enrolled_count INT NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Free Entries
CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tournament_user UNIQUE (tournament_id, user_id)
);

-- Virtual Teams (11 players, Captain 2x, VC 1.5x)
CREATE TABLE IF NOT EXISTS public.virtual_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  team_name TEXT NOT NULL,
  player_ids UUID[] NOT NULL,
  captain_id UUID NOT NULL,
  vice_captain_id UUID NOT NULL,
  total_points NUMERIC(8, 2) NOT NULL DEFAULT 0,
  rank INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_tournament_team UNIQUE (tournament_id, user_id)
);

-- Row Level Security (RLS) Enablement
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tournaments" ON public.tournaments FOR SELECT USING (TRUE);
CREATE POLICY "Public read virtual teams" ON public.virtual_teams FOR SELECT USING (TRUE);
CREATE POLICY "Users can create own teams" ON public.virtual_teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users join free" ON public.tournament_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
`;

  const currentCode = selectedSchemaType === 'cricket' ? sqlSchemaCode : ludoSqlSchemaCode;

  const copySql = () => {
    navigator.clipboard.writeText(currentCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    updateSupabaseConfig(customUrl, customKey);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl max-w-2xl w-full p-4 sm:p-6 text-slate-100 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Supabase डेटाबेस सेटअप गाइड
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                  हिंदी में
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                100% मुफ़्त PostgreSQL डेटाबेस और Authentication सेटअप करने के आसान चरण
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Connection Status */}
        <div className={`p-3 rounded-xl border mb-4 flex items-center justify-between text-xs ${
          isSupabaseConfigured
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-slate-900 border-slate-700 text-slate-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>
              {isSupabaseConfigured
                ? 'Supabase क्लाउड कनेक्टेड है! (Live PostgreSQL Sync)'
                : 'लोकल मोड एक्टिव है (बिना किसी सेटअप के ऐप तुरंत काम कर रहा है)'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {isSupabaseConfigured ? 'Connected' : 'Local Fallback'}
          </span>
        </div>

        {/* Hindi Instructions Steps */}
        <div className="space-y-4 text-xs text-slate-300 max-h-[50vh] overflow-y-auto pr-1">
          {/* Step 1 */}
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
            <h3 className="font-bold text-emerald-400 text-sm mb-1 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">1</span>
              Supabase पर फ्री अकाउंट और प्रोजेक्ट बनाएं
            </h3>
            <p className="leading-relaxed text-slate-300">
              1. सबसे पहले <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-semibold">supabase.com</a> पर जाएं और &quot;Start your project&quot; (फ्री) पर क्लिक करें।<br />
              2. &quot;New project&quot; बनाएं, नाम दें <strong>&quot;Cricket-Arena&quot;</strong>, एक मजबूत पासवर्ड सेट करें और रीजन (जैसे Mumbai या Singapore) चुनें।
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">2</span>
                SQL Editor में जाकर Tables और RLS Policies रन करें
              </h3>
              <button
                onClick={copySql}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-2 py-1 rounded text-[11px] transition shadow"
              >
                {copiedSql ? <Check className="w-3 h-3 text-slate-950" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSql ? 'SQL कॉपी हो गया!' : 'Copy SQL'}</span>
              </button>
            </div>

            {/* Schema Selector Tabs */}
            <div className="flex gap-2 my-2">
              <button
                type="button"
                onClick={() => setSelectedSchemaType('cricket')}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition ${
                  selectedSchemaType === 'cricket'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                🏏 1. Cricket Schema (schema.sql)
              </button>
              <button
                type="button"
                onClick={() => setSelectedSchemaType('ludo')}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition ${
                  selectedSchemaType === 'ludo'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                🎲 2. Ludo Schema (Additive ludo_schema.sql)
              </button>
            </div>

            <p className="leading-relaxed text-slate-300 mb-2">
              Supabase डैशबोर्ड में बाएं मेनू से <strong>SQL Editor</strong> पर जाएं, &quot;New query&quot; खोलें और नीचे दिया गया SQL कोड पेस्ट करके <strong>RUN</strong> बटन दबाएं:
            </p>
            <div className="relative">
              <pre className="bg-[#070b14] border border-slate-800 p-2.5 rounded-lg font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-28">
                {currentCode}
              </pre>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
            <h3 className="font-bold text-emerald-400 text-sm mb-1 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">3</span>
              Project URL और Anon Key यहां पेस्ट करें
            </h3>
            <p className="leading-relaxed text-slate-300 mb-3">
              Supabase में <strong>Project Settings &gt; API</strong> पर जाएं। वहां से <strong>Project URL</strong> और <strong>Project API key (anon/public)</strong> कॉपी करके नीचे सेव करें:
            </p>
            <form onSubmit={handleSaveCredentials} className="space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Supabase Anon Key (Public)
                </label>
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                {saveSuccess && <span className="text-emerald-400 text-xs font-semibold">सेव हो गया और रीलोड हो रहा है...</span>}
                <button
                  type="submit"
                  className="ml-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                >
                  कनेक्ट और सेव करें
                </button>
              </div>
            </form>
          </div>

          {/* Step 4 */}
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
            <h3 className="font-bold text-emerald-400 text-sm mb-1 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">4</span>
              GitHub &amp; Vercel पर फ्री डिप्लॉयमेंट (Deployment)
            </h3>
            <p className="leading-relaxed text-slate-300">
              यह कोड 100% Vercel और GitHub के साथ कम्पैटिबल है।<br />
              1. GitHub पर अपना नया रिपॉजिटरी बनाएं और कोड पुश करें।<br />
              2. <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-semibold">vercel.com</a> पर लॉगिन करके अपना GitHub रेपो इम्पोर्ट करें।<br />
              3. Vercel के <strong>Environment Variables</strong> में <code>VITE_SUPABASE_URL</code> और <code>VITE_SUPABASE_ANON_KEY</code> जोड़ें।<br />
              4. <strong>Deploy</strong> पर क्लिक करें — आपका PWA लाइव हो जाएगा!
            </p>
          </div>

          {/* Admin Role SQL */}
          <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-500/30">
            <h4 className="font-bold text-amber-300 text-xs mb-1">
              खुद को Admin Role कैसे दें?
            </h4>
            <p className="text-[11px] text-slate-300 mb-1.5">
              Supabase SQL Editor में यह कमांड चलाएं (अपना ईमेल डालें):
            </p>
            <pre className="bg-[#070b14] p-1.5 rounded text-[11px] text-amber-300 font-mono">
              UPDATE public.profiles SET role = &apos;admin&apos; WHERE email = &apos;your-email@gmail.com&apos;;
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-3 mt-4 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            फाइल पाथ: <code>/supabase/schema.sql</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 font-semibold rounded-xl text-slate-200 transition"
          >
            बंद करें (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
