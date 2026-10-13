-- =========================================================================
-- MIGRATION: 20261013160000_timer_score_ludo.sql
-- Timer Ludo — Highest Score Wins configuration and match records
-- Safe, additive migration preserving all existing Cricket & Ludo data.
-- =========================================================================

-- 1. Create or extend timer ludo settings table
CREATE TABLE IF NOT EXISTS public.timer_ludo_settings (
  id TEXT PRIMARY KEY DEFAULT 'global_timer_ludo_config',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  duration_minutes_2p INT NOT NULL DEFAULT 8,
  duration_minutes_4p INT NOT NULL DEFAULT 15,
  home_bonus_points INT NOT NULL DEFAULT 60,
  dice_points_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  capture_transfer_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  tie_breaker_rule TEXT NOT NULL DEFAULT 'home_tokens_then_captures',
  turn_timeout_seconds INT NOT NULL DEFAULT 30,
  max_timeouts_before_forfeit INT NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default global configuration if absent
INSERT INTO public.timer_ludo_settings (
  id, is_enabled, duration_minutes_2p, duration_minutes_4p,
  home_bonus_points, dice_points_enabled, capture_transfer_enabled,
  tie_breaker_rule, turn_timeout_seconds, max_timeouts_before_forfeit
) VALUES (
  'global_timer_ludo_config', TRUE, 8, 15, 60, TRUE, TRUE, 'home_tokens_then_captures', 30, 3
) ON CONFLICT (id) DO NOTHING;

-- 2. Extend ludo match history / completed records with score breakdowns
CREATE TABLE IF NOT EXISTS public.ludo_match_results (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  entry_fee NUMERIC NOT NULL,
  mode INT NOT NULL,
  prize_amount NUMERIC NOT NULL,
  duration_seconds INT NOT NULL,
  winner_user_id TEXT NOT NULL,
  winner_name TEXT NOT NULL,
  winner_color TEXT NOT NULL,
  winner_score INT NOT NULL,
  rankings JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  tie_breaker_used TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ludo_match_results_match_id ON public.ludo_match_results(match_id);
CREATE INDEX IF NOT EXISTS idx_ludo_match_results_winner ON public.ludo_match_results(winner_user_id);

-- Enable RLS
ALTER TABLE public.timer_ludo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read timer ludo settings" ON public.timer_ludo_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin write timer ludo settings" ON public.timer_ludo_settings
  FOR ALL USING (TRUE);

CREATE POLICY "Public read ludo match results" ON public.ludo_match_results
  FOR SELECT USING (TRUE);

CREATE POLICY "Service write ludo match results" ON public.ludo_match_results
  FOR ALL USING (TRUE);
