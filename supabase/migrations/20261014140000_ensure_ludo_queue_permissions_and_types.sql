-- =========================================================================
-- MIGRATION: 20261014140000_ensure_ludo_queue_permissions_and_types.sql
-- Ensures ludo_matchmaking_queue and ludo_table_matches tables exist,
-- grants all necessary permissions to anon, authenticated, service_role,
-- and ensures player_ids column accepts text[] safely without UUID cast errors.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Ensure ludo_tables registry exists and is seeded
CREATE TABLE IF NOT EXISTS public.ludo_tables (
  id TEXT PRIMARY KEY,
  entry_fee NUMERIC NOT NULL CHECK (entry_fee > 0),
  mode INT NOT NULL CHECK (mode IN (2, 4)),
  prize NUMERIC NOT NULL CHECK (prize > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ludo_tables (id, entry_fee, mode, prize, is_active) VALUES
  ('table-2p-5', 5, 2, 8.75, TRUE),
  ('table-4p-5', 5, 4, 17.50, TRUE),
  ('table-2p-10', 10, 2, 17.50, TRUE),
  ('table-4p-10', 10, 4, 35.00, TRUE),
  ('table-2p-20', 20, 2, 35.00, TRUE),
  ('table-4p-20', 20, 4, 70.00, TRUE),
  ('table-2p-50', 50, 2, 87.50, TRUE),
  ('table-4p-50', 50, 4, 175.00, TRUE),
  ('table-2p-100', 100, 2, 175.00, TRUE),
  ('table-4p-100', 100, 4, 350.00, TRUE),
  ('table-2p-200', 200, 2, 350.00, TRUE),
  ('table-4p-200', 200, 4, 700.00, TRUE),
  ('table-2p-250', 250, 2, 440.00, TRUE),
  ('table-4p-250', 250, 4, 875.00, TRUE),
  ('table-2p-500', 500, 2, 880.00, TRUE),
  ('table-4p-500', 500, 4, 1750.00, TRUE),
  ('table-2p-1000', 1000, 2, 1800.00, TRUE),
  ('table-4p-1000', 1000, 4, 3500.00, TRUE)
ON CONFLICT (id) DO UPDATE SET
  entry_fee = EXCLUDED.entry_fee,
  prize = EXCLUDED.prize,
  is_active = EXCLUDED.is_active;

ALTER TABLE public.ludo_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read ludo tables" ON public.ludo_tables;
CREATE POLICY "Public read ludo tables" ON public.ludo_tables FOR SELECT USING (TRUE);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ludo_tables TO anon, authenticated, service_role;

-- 1. Ensure ludo_matchmaking_queue exists
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

-- 2. Ensure ludo_table_matches exists with proper column types
CREATE TABLE IF NOT EXISTS public.ludo_table_matches (
  id TEXT PRIMARY KEY,
  table_id TEXT REFERENCES public.ludo_tables(id),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'in_progress', 'completed', 'cancelled')),
  max_players INT NOT NULL DEFAULT 2 CHECK (max_players IN (2, 4)),
  player_ids TEXT[] NOT NULL DEFAULT '{}',
  players_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure player_ids is safe for any string user id
DO $$
BEGIN
  ALTER TABLE public.ludo_table_matches ALTER COLUMN player_ids TYPE TEXT[] USING player_ids::TEXT[];
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE public.ludo_table_matches ADD COLUMN IF NOT EXISTS players_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ludo_table_matches ADD COLUMN IF NOT EXISTS game_state JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ludo_table_matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Row Level Security & Explicit Grants
ALTER TABLE public.ludo_matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_table_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read ludo matchmaking queue" ON public.ludo_matchmaking_queue;
CREATE POLICY "Public read ludo matchmaking queue" ON public.ludo_matchmaking_queue FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public insert ludo matchmaking queue" ON public.ludo_matchmaking_queue;
CREATE POLICY "Public insert ludo matchmaking queue" ON public.ludo_matchmaking_queue FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public update ludo matchmaking queue" ON public.ludo_matchmaking_queue;
CREATE POLICY "Public update ludo matchmaking queue" ON public.ludo_matchmaking_queue FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "Public delete ludo matchmaking queue" ON public.ludo_matchmaking_queue;
CREATE POLICY "Public delete ludo matchmaking queue" ON public.ludo_matchmaking_queue FOR DELETE USING (TRUE);

DROP POLICY IF EXISTS "Public read ludo table matches" ON public.ludo_table_matches;
CREATE POLICY "Public read ludo table matches" ON public.ludo_table_matches FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public insert ludo table matches" ON public.ludo_table_matches;
CREATE POLICY "Public insert ludo table matches" ON public.ludo_table_matches FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public update ludo table matches" ON public.ludo_table_matches;
CREATE POLICY "Public update ludo table matches" ON public.ludo_table_matches FOR UPDATE USING (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ludo_matchmaking_queue TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ludo_table_matches TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
