-- =========================================================================
-- LUDO ARENA ADDITIVE SUPABASE SCHEMA WITH ROW LEVEL SECURITY (RLS)
-- Free-Entry Ludo Tournaments & Multiplayer Room Preparation
-- NOTE: This migration is additive and does NOT overwrite any Cricket tables!
-- =========================================================================

-- 1. LUDO TOURNAMENTS TABLE
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

CREATE INDEX IF NOT EXISTS idx_ludo_tournaments_status ON public.ludo_tournaments(status);

-- 2. LUDO TOURNAMENT PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.ludo_tournament_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.ludo_tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'eliminated', 'champion', 'runner_up')),
  points INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_ludo_tournament_participant UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ludo_participants_tour ON public.ludo_tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_ludo_participants_user ON public.ludo_tournament_participants(user_id);

-- 3. LUDO BRACKET MATCHES (Single Elimination)
CREATE TABLE IF NOT EXISTS public.ludo_bracket_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.ludo_tournaments(id) ON DELETE CASCADE NOT NULL,
  round INT NOT NULL DEFAULT 1,
  round_name TEXT NOT NULL,
  player_names TEXT[] NOT NULL,
  winner_name TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  scheduled_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ludo_brackets_tour ON public.ludo_bracket_matches(tournament_id);

-- 4. LUDO MULTIPLAYER ROOMS (Online Preparation)
CREATE TABLE IF NOT EXISTS public.ludo_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  host_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  player_count INT NOT NULL DEFAULT 4 CHECK (player_count IN (2, 4)),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed')),
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ludo_rooms_code ON public.ludo_rooms(code);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.ludo_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_bracket_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_rooms ENABLE ROW LEVEL SECURITY;

-- Tournaments RLS
CREATE POLICY "Public read ludo tournaments" ON public.ludo_tournaments
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin write ludo tournaments" ON public.ludo_tournaments
  FOR ALL USING (public.is_admin());

-- Participants RLS
CREATE POLICY "Public read ludo participants" ON public.ludo_tournament_participants
  FOR SELECT USING (TRUE);

CREATE POLICY "Users register free for ludo" ON public.ludo_tournament_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Brackets RLS
CREATE POLICY "Public read ludo brackets" ON public.ludo_bracket_matches
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin write ludo brackets" ON public.ludo_bracket_matches
  FOR ALL USING (public.is_admin());

-- Rooms RLS
CREATE POLICY "Public read ludo rooms" ON public.ludo_rooms
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can create rooms" ON public.ludo_rooms
  FOR INSERT WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Users can update rooms" ON public.ludo_rooms
  FOR UPDATE USING (TRUE);
