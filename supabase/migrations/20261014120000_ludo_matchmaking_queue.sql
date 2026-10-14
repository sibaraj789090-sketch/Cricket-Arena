-- =========================================================================
-- MIGRATION: 20261014120000_ludo_matchmaking_queue.sql
-- Persistent Ludo Matchmaking Queue & Match State with Row Level Security (RLS)
-- Enables distributed matchmaking across serverless instances (Vercel)
-- Safe, additive migration preserving all existing Cricket & Ludo data.
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. MATCHMAKING QUEUE TABLE
CREATE TABLE IF NOT EXISTS public.ludo_matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Player',
  avatar TEXT,
  mode INT NOT NULL DEFAULT 2 CHECK (mode IN (2, 4)),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'cancelled')),
  match_id TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ludo_queue_table_status ON public.ludo_matchmaking_queue(table_id, status);
CREATE INDEX IF NOT EXISTS idx_ludo_queue_user ON public.ludo_matchmaking_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ludo_queue_joined ON public.ludo_matchmaking_queue(joined_at ASC);

-- 3. ENSURE LUDO TABLE MATCHES HAS FULL STATE COLUMNS
CREATE TABLE IF NOT EXISTS public.ludo_table_matches (
  id TEXT PRIMARY KEY,
  table_id TEXT REFERENCES public.ludo_tables(id),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'in_progress', 'completed', 'cancelled')),
  max_players INT NOT NULL DEFAULT 2 CHECK (max_players IN (2, 4)),
  player_ids UUID[] NOT NULL DEFAULT '{}',
  players_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure additive columns exist if table was previously created with minimal schema
ALTER TABLE public.ludo_table_matches ADD COLUMN IF NOT EXISTS players_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ludo_table_matches ADD COLUMN IF NOT EXISTS game_state JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ludo_table_matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.ludo_matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_table_matches ENABLE ROW LEVEL SECURITY;

-- Queue Table RLS Policies
DROP POLICY IF EXISTS "Public read ludo matchmaking queue" ON public.ludo_matchmaking_queue;
CREATE POLICY "Public read ludo matchmaking queue" ON public.ludo_matchmaking_queue
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public insert ludo matchmaking queue" ON public.ludo_matchmaking_queue;
CREATE POLICY "Public insert ludo matchmaking queue" ON public.ludo_matchmaking_queue
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public update ludo matchmaking queue" ON public.ludo_matchmaking_queue;
CREATE POLICY "Public update ludo matchmaking queue" ON public.ludo_matchmaking_queue
  FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "Public delete ludo matchmaking queue" ON public.ludo_matchmaking_queue;
CREATE POLICY "Public delete ludo matchmaking queue" ON public.ludo_matchmaking_queue
  FOR DELETE USING (TRUE);

-- Matches Table RLS Policies
DROP POLICY IF EXISTS "Public read ludo table matches" ON public.ludo_table_matches;
CREATE POLICY "Public read ludo table matches" ON public.ludo_table_matches
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public insert ludo table matches" ON public.ludo_table_matches;
CREATE POLICY "Public insert ludo table matches" ON public.ludo_table_matches
  FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public update ludo table matches" ON public.ludo_table_matches;
CREATE POLICY "Public update ludo table matches" ON public.ludo_table_matches
  FOR UPDATE USING (TRUE);

-- 5. GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ludo_matchmaking_queue TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ludo_table_matches TO anon, authenticated, service_role;

-- 6. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
