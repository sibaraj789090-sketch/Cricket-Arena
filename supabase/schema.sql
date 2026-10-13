-- =========================================================================
-- CRICKET ARENA - SUPABASE POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY (RLS)
-- Free-Entry Cricket Tournament & Fantasy Statistics Platform
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Users & Admins)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on role for fast permission verification
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. CRICKET TEAMS
CREATE TABLE IF NOT EXISTS public.cricket_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  code VARCHAR(5) NOT NULL UNIQUE,
  logo TEXT,
  primary_color TEXT DEFAULT '#10B981',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PLAYERS TABLE
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

CREATE INDEX IF NOT EXISTS idx_players_team_id ON public.players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_role ON public.players(role);

-- 4. POINTS CONFIGURATION
CREATE TABLE IF NOT EXISTS public.points_config (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  rules JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TOURNAMENTS
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
  banner_image TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  points_config_id TEXT REFERENCES public.points_config(id) DEFAULT 'standard-t20-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_time ON public.tournaments(start_time);

-- 6. TOURNAMENT ENTRIES (Free registration)
CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tournament_user UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_entries_tournament ON public.tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_entries_user ON public.tournament_entries(user_id);

-- 7. VIRTUAL TEAMS (User's 11-player squad)
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_tournament_team UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_virtual_teams_tournament ON public.virtual_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_virtual_teams_points ON public.virtual_teams(tournament_id, total_points DESC);

-- 8. PLAYER MATCH STATS & SCORES
CREATE TABLE IF NOT EXISTS public.player_match_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  runs INT DEFAULT 0,
  balls_faced INT DEFAULT 0,
  fours INT DEFAULT 0,
  sixes INT DEFAULT 0,
  is_out BOOLEAN DEFAULT FALSE,
  overs_bowled NUMERIC(4, 1) DEFAULT 0,
  maidens INT DEFAULT 0,
  runs_conceded INT DEFAULT 0,
  wickets INT DEFAULT 0,
  catches INT DEFAULT 0,
  stumpings INT DEFAULT 0,
  run_outs INT DEFAULT 0,
  dot_balls INT DEFAULT 0,
  calculated_points NUMERIC(8, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_match_player_score UNIQUE (tournament_id, player_id)
);

-- 9. AUDIT LOGS (Immutable record of Admin actions)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.profiles(id),
  admin_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cricket_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Is current user an Admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles RLS
CREATE POLICY "Public profiles are readable" ON public.profiles
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. Cricket Teams & Players RLS
CREATE POLICY "Public read cricket teams" ON public.cricket_teams
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin write cricket teams" ON public.cricket_teams
  FOR ALL USING (public.is_admin());

CREATE POLICY "Public read players" ON public.players
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin write players" ON public.players
  FOR ALL USING (public.is_admin());

-- 3. Points Config RLS
CREATE POLICY "Public read points config" ON public.points_config
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin write points config" ON public.points_config
  FOR ALL USING (public.is_admin());

-- 4. Tournaments RLS
CREATE POLICY "Public read tournaments" ON public.tournaments
  FOR SELECT USING (status != 'draft' OR public.is_admin());

CREATE POLICY "Admin write tournaments" ON public.tournaments
  FOR ALL USING (public.is_admin());

-- 5. Tournament Entries RLS
CREATE POLICY "Public read tournament entries" ON public.tournament_entries
  FOR SELECT USING (TRUE);

CREATE POLICY "User join free tournament" ON public.tournament_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Virtual Teams RLS
CREATE POLICY "Public read virtual teams" ON public.virtual_teams
  FOR SELECT USING (TRUE);

CREATE POLICY "User create virtual team" ON public.virtual_teams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User edit virtual team" ON public.virtual_teams
  FOR UPDATE USING (auth.uid() = user_id);

-- 7. Player Match Scores RLS
CREATE POLICY "Public read match scores" ON public.player_match_scores
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin write match scores" ON public.player_match_scores
  FOR ALL USING (public.is_admin());

-- 8. Audit Logs RLS
CREATE POLICY "Admin view audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin create audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (public.is_admin());

-- Auto-create profile trigger on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 9. COINS WALLET, TOP-UP, AND WITHDRAWAL SUBSYSTEM
-- =========================================================================

-- Coin Wallets
CREATE TABLE IF NOT EXISTS public.coin_wallets (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  balance INT NOT NULL DEFAULT 100 CHECK (balance >= 0),
  locked_balance INT NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'COINS',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coin Packages Catalog
CREATE TABLE IF NOT EXISTS public.coin_packages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  coins INT NOT NULL CHECK (coins > 0),
  bonus_coins INT NOT NULL DEFAULT 0 CHECK (bonus_coins >= 0),
  price_inr NUMERIC(10, 2) NOT NULL CHECK (price_inr > 0),
  badge TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coin Transactions Ledger (Auditable)
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'starting_bonus', 'game_fee', 'game_reward', 'admin_adjustment')),
  amount INT NOT NULL,
  price_inr NUMERIC(10, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'rejected', 'failed')),
  balance_before INT NOT NULL,
  balance_after INT NOT NULL,
  reference_id TEXT UNIQUE,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON public.coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_ref ON public.coin_transactions(reference_id);

-- Payment Orders
CREATE TABLE IF NOT EXISTS public.coin_payment_orders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  package_id TEXT NOT NULL,
  amount_inr NUMERIC(10, 2) NOT NULL CHECK (amount_inr >= 100),
  coins_awarded INT NOT NULL CHECK (coins_awarded > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('created', 'pending', 'completed', 'failed', 'cancelled')),
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.coin_payment_orders(user_id);

-- Withdrawal Requests
CREATE TABLE IF NOT EXISTS public.coin_withdrawal_requests (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  amount_coins INT NOT NULL CHECK (amount_coins >= 110 AND amount_coins <= 50000),
  amount_inr NUMERIC(10, 2) NOT NULL CHECK (amount_inr >= 110 AND amount_inr <= 50000),
  payout_method VARCHAR(20) NOT NULL CHECK (payout_method IN ('upi', 'bank_transfer')),
  payout_details JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  payout_reference_id TEXT,
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.coin_withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.coin_withdrawal_requests(status);

-- Wallet Financial Settings
CREATE TABLE IF NOT EXISTS public.wallet_settings (
  id TEXT PRIMARY KEY DEFAULT 'global_settings',
  min_deposit_inr INT NOT NULL DEFAULT 100,
  max_deposit_inr INT NOT NULL DEFAULT 100000,
  min_withdrawal_inr INT NOT NULL DEFAULT 110,
  max_withdrawal_inr INT NOT NULL DEFAULT 50000,
  starting_bonus_coins INT NOT NULL DEFAULT 100,
  coin_to_inr_rate NUMERIC(6, 2) NOT NULL DEFAULT 1.0,
  topup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial packages and settings
INSERT INTO public.wallet_settings (id, min_deposit_inr, max_deposit_inr, min_withdrawal_inr, max_withdrawal_inr, starting_bonus_coins, topup_enabled)
VALUES ('global_settings', 100, 100000, 110, 50000, 100, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.coin_packages (id, title, coins, bonus_coins, price_inr, badge, is_active, display_order)
VALUES
  ('pkg-100', 'Starter Pack', 100, 0, 100.00, 'Min Deposit', TRUE, 1),
  ('pkg-250', 'Popular Booster', 250, 25, 250.00, 'Popular (+10%)', TRUE, 2),
  ('pkg-500', 'Pro Player Pack', 500, 100, 500.00, 'Best Value (+20%)', TRUE, 3),
  ('pkg-1000', 'Champion Stash', 1000, 300, 1000.00, 'Hot Deal (+30%)', TRUE, 4),
  ('pkg-2500', 'Arena Legend Vault', 2500, 1000, 2500.00, 'Huge Bonus (+40%)', TRUE, 5),
  ('pkg-5000', 'Grand Master Chest', 5000, 2500, 5000.00, 'Mega Value (+50%)', TRUE, 6)
ON CONFLICT (id) DO NOTHING;

-- RLS for Wallet Tables
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY;

-- 1. Wallets: User reads own wallet; Admin reads/writes all
CREATE POLICY "User read own wallet" ON public.coin_wallets
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admin manage all wallets" ON public.coin_wallets
  FOR ALL USING (public.is_admin());

-- 2. Packages: Public reads active; Admin manages
CREATE POLICY "Public read active packages" ON public.coin_packages
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Admin manage packages" ON public.coin_packages
  FOR ALL USING (public.is_admin());

-- 3. Transactions: User reads own ledger; Admin reads all
CREATE POLICY "User read own transactions" ON public.coin_transactions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admin manage transactions" ON public.coin_transactions
  FOR ALL USING (public.is_admin());

-- 4. Payment Orders: User reads own; Admin manages
CREATE POLICY "User read own payment orders" ON public.coin_payment_orders
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admin manage payment orders" ON public.coin_payment_orders
  FOR ALL USING (public.is_admin());

-- 5. Withdrawals: User reads and inserts own; Admin manages
CREATE POLICY "User read own withdrawals" ON public.coin_withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "User submit withdrawal" ON public.coin_withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin manage withdrawals" ON public.coin_withdrawal_requests
  FOR ALL USING (public.is_admin());

-- 6. Settings: Public reads; Admin manages
CREATE POLICY "Public read wallet settings" ON public.wallet_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "Admin manage wallet settings" ON public.wallet_settings
  FOR ALL USING (public.is_admin());

-- =========================================================================
-- 10. ATOMIC WALLET RPC PROCEDURES (SERVER-SIDE TAMPER-PROOF BALANCES)
-- =========================================================================

-- Helper to safely convert user string ID into valid UUID
CREATE OR REPLACE FUNCTION public.to_uuid_safe(p_val TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN p_val::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN md5(p_val)::UUID;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- A. Atomic Deposit Credit
CREATE OR REPLACE FUNCTION public.rpc_credit_wallet_deposit(
  p_user_id TEXT,
  p_package_id TEXT,
  p_amount_inr NUMERIC,
  p_coins INT,
  p_reference_id TEXT,
  p_description TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := public.to_uuid_safe(p_user_id);
  v_current_balance INT := 0;
  v_new_balance INT := 0;
  v_settings RECORD;
  v_pkg RECORD;
  v_effective_coins INT := p_coins;
  v_effective_price NUMERIC := p_amount_inr;
BEGIN
  -- 1. Idempotency Check: if reference_id already credited, return immediately without duplicate addition
  IF EXISTS (
    SELECT 1 FROM public.coin_transactions 
    WHERE reference_id = p_reference_id AND status = 'completed'
  ) THEN
    SELECT balance INTO v_new_balance FROM public.coin_wallets WHERE user_id = v_uid;
    RETURN jsonb_build_object(
      'success', TRUE,
      'idempotent', TRUE,
      'balance', COALESCE(v_new_balance, 0),
      'message', 'Transaction already processed'
    );
  END IF;

  -- 2. Read global limits from wallet_settings
  SELECT * INTO v_settings FROM public.wallet_settings WHERE id = 'global_settings';
  IF v_settings.topup_enabled IS FALSE THEN
    RAISE EXCEPTION 'Coin top-up is currently disabled by administrator.';
  END IF;

  -- 3. Authoritative server verification of package / amount
  IF p_package_id = 'custom' THEN
    IF p_amount_inr < v_settings.min_deposit_inr OR p_amount_inr > v_settings.max_deposit_inr THEN
      RAISE EXCEPTION 'Deposit amount outside permissible limits (min % - max % INR)', 
        v_settings.min_deposit_inr, v_settings.max_deposit_inr;
    END IF;
    v_effective_coins := FLOOR(p_amount_inr * v_settings.coin_to_inr_rate);
  ELSE
    SELECT * INTO v_pkg FROM public.coin_packages WHERE id = p_package_id AND is_active = TRUE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Specified coin package % does not exist or is inactive', p_package_id;
    END IF;
    v_effective_coins := v_pkg.coins + v_pkg.bonus_coins;
    v_effective_price := v_pkg.price_inr;
  END IF;

  -- 4. Atomic row lock on coin_wallets
  INSERT INTO public.coin_wallets (user_id, balance, locked_balance, currency, updated_at)
  VALUES (v_uid, 0, 0, 'COINS', NOW())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_current_balance
  FROM public.coin_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  v_new_balance := v_current_balance + v_effective_coins;

  UPDATE public.coin_wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = v_uid;

  -- 5. Record immutable transaction in ledger
  INSERT INTO public.coin_transactions (
    id, user_id, type, amount, price_inr, status, 
    balance_before, balance_after, reference_id, description, created_at
  )
  VALUES (
    'tx-dep-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT,
    v_uid,
    'deposit',
    v_effective_coins,
    v_effective_price,
    'completed',
    v_current_balance,
    v_new_balance,
    p_reference_id,
    COALESCE(p_description, 'Verified Coin Deposit: ' || v_effective_coins || ' Coins'),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'balance', v_new_balance,
    'coins_awarded', v_effective_coins,
    'amount_inr', v_effective_price
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Atomic Withdrawal Request
CREATE OR REPLACE FUNCTION public.rpc_request_wallet_withdrawal(
  p_user_id TEXT,
  p_user_name TEXT,
  p_user_email TEXT,
  p_amount_inr NUMERIC,
  p_payout_method TEXT,
  p_payout_details JSONB,
  p_request_id TEXT,
  p_reference_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := public.to_uuid_safe(p_user_id);
  v_current_balance INT;
  v_current_locked INT;
  v_coins_needed INT := p_amount_inr::INT;
  v_settings RECORD;
BEGIN
  -- 1. Read limits
  SELECT * INTO v_settings FROM public.wallet_settings WHERE id = 'global_settings';
  IF p_amount_inr < v_settings.min_withdrawal_inr OR p_amount_inr > v_settings.max_withdrawal_inr THEN
    RAISE EXCEPTION 'Withdrawal amount must be between ₹% and ₹%', 
      v_settings.min_withdrawal_inr, v_settings.max_withdrawal_inr;
  END IF;

  -- 2. Lock wallet row FOR UPDATE
  SELECT balance, locked_balance INTO v_current_balance, v_current_locked
  FROM public.coin_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < v_coins_needed THEN
    RAISE EXCEPTION 'Insufficient coins balance. Available: %, Requested: %', 
      COALESCE(v_current_balance, 0), v_coins_needed;
  END IF;

  -- 3. Atomic transfer from available balance to locked_balance
  UPDATE public.coin_wallets
  SET balance = balance - v_coins_needed,
      locked_balance = locked_balance + v_coins_needed,
      updated_at = NOW()
  WHERE user_id = v_uid;

  -- 4. Record withdrawal request
  INSERT INTO public.coin_withdrawal_requests (
    id, user_id, user_name, user_email, amount_coins, amount_inr,
    payout_method, payout_details, status, created_at
  )
  VALUES (
    p_request_id,
    v_uid,
    p_user_name,
    p_user_email,
    v_coins_needed,
    p_amount_inr,
    p_payout_method,
    p_payout_details,
    'pending',
    NOW()
  );

  -- 5. Record pending transaction in ledger
  INSERT INTO public.coin_transactions (
    id, user_id, type, amount, price_inr, status,
    balance_before, balance_after, reference_id, description, created_at
  )
  VALUES (
    'tx-wdr-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT,
    v_uid,
    'withdrawal',
    -v_coins_needed,
    p_amount_inr,
    'pending',
    v_current_balance,
    v_current_balance - v_coins_needed,
    p_reference_id,
    'Withdrawal Request (' || upper(p_payout_method) || '): ₹' || p_amount_inr || ' placed under review',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'balance', v_current_balance - v_coins_needed,
    'locked_balance', v_current_locked + v_coins_needed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Atomic Admin Approve or Reject Withdrawal
CREATE OR REPLACE FUNCTION public.rpc_admin_process_withdrawal(
  p_request_id TEXT,
  p_action TEXT, -- 'approve' or 'reject'
  p_admin_notes TEXT,
  p_payout_ref TEXT,
  p_admin_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_req RECORD;
  v_user_balance INT;
  v_user_locked INT;
BEGIN
  -- Require admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  SELECT * INTO v_req
  FROM public.coin_withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request % not found', p_request_id;
  END IF;

  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'Withdrawal request already marked as %', v_req.status;
  END IF;

  SELECT balance, locked_balance INTO v_user_balance, v_user_locked
  FROM public.coin_wallets
  WHERE user_id = v_req.user_id
  FOR UPDATE;

  IF p_action = 'approve' THEN
    -- Clear locked balance
    UPDATE public.coin_wallets
    SET locked_balance = GREATEST(0, locked_balance - v_req.amount_coins),
        updated_at = NOW()
    WHERE user_id = v_req.user_id;

    UPDATE public.coin_withdrawal_requests
    SET status = 'approved',
        admin_notes = p_admin_notes,
        payout_reference_id = p_payout_ref,
        processed_at = NOW(),
        processed_by = p_admin_name
    WHERE id = p_request_id;

    -- Update transaction ledger
    UPDATE public.coin_transactions
    SET status = 'completed',
        description = 'Withdrawal processed: ₹' || v_req.amount_inr || ' transferred (' || upper(v_req.payout_method) || ': ' || p_payout_ref || ')'
    WHERE user_id = v_req.user_id AND type = 'withdrawal' AND status = 'pending';

  ELSIF p_action = 'reject' THEN
    -- Refund locked coins back to active balance
    UPDATE public.coin_wallets
    SET balance = balance + v_req.amount_coins,
        locked_balance = GREATEST(0, locked_balance - v_req.amount_coins),
        updated_at = NOW()
    WHERE user_id = v_req.user_id;

    UPDATE public.coin_withdrawal_requests
    SET status = 'rejected',
        admin_notes = p_admin_notes,
        processed_at = NOW(),
        processed_by = p_admin_name
    WHERE id = p_request_id;

    -- Record refund in ledger
    INSERT INTO public.coin_transactions (
      id, user_id, type, amount, status,
      balance_before, balance_after, reference_id, description, created_at
    )
    VALUES (
      'tx-ref-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
      v_req.user_id,
      'admin_adjustment',
      v_req.amount_coins,
      'completed',
      v_user_balance,
      v_user_balance + v_req.amount_coins,
      'REF-' || p_request_id,
      'Refund for declined withdrawal: +' || v_req.amount_coins || ' coins. Reason: ' || p_admin_notes,
      NOW()
    );
  ELSE
    RAISE EXCEPTION 'Invalid action %; expected approve or reject', p_action;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'action', p_action,
    'requestId', p_request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. Atomic Admin Manual Adjustment
CREATE OR REPLACE FUNCTION public.rpc_admin_manual_adjustment(
  p_target_user_id TEXT,
  p_amount_delta INT,
  p_reason TEXT,
  p_admin_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_tuid UUID := public.to_uuid_safe(p_target_user_id);
  v_cur_bal INT;
  v_new_bal INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  IF p_amount_delta = 0 THEN
    RAISE EXCEPTION 'Adjustment amount cannot be zero';
  END IF;

  INSERT INTO public.coin_wallets (user_id, balance, locked_balance, currency, updated_at)
  VALUES (v_tuid, 0, 0, 'COINS', NOW())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_cur_bal
  FROM public.coin_wallets
  WHERE user_id = v_tuid
  FOR UPDATE;

  v_new_bal := v_cur_bal + p_amount_delta;
  IF v_new_bal < 0 THEN
    RAISE EXCEPTION 'Cannot adjust balance below zero. Current balance is %', v_cur_bal;
  END IF;

  UPDATE public.coin_wallets
  SET balance = v_new_bal, updated_at = NOW()
  WHERE user_id = v_tuid;

  INSERT INTO public.coin_transactions (
    id, user_id, type, amount, status,
    balance_before, balance_after, reference_id, description, created_at
  )
  VALUES (
    'tx-adj-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    v_tuid,
    'admin_adjustment',
    p_amount_delta,
    'completed',
    v_cur_bal,
    v_new_bal,
    'ADJ-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    'Manual adjustment by ' || p_admin_name || ': ' || CASE WHEN p_amount_delta > 0 THEN '+' ELSE '' END || p_amount_delta || ' coins. Reason: ' || p_reason,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'balance', v_new_bal
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 11. ATOMIC LUDO CASH TABLE JOIN & RESERVATION RPC PROCEDURES
-- =========================================================================

-- E. Atomic Ludo Table Join & Entry Fee Reservation
-- Prevents race conditions using FOR UPDATE locks and balance >= p_entry_fee constraints.
CREATE OR REPLACE FUNCTION public.rpc_ludo_join_table_reserve(
  p_user_id TEXT,
  p_table_id TEXT,
  p_entry_fee NUMERIC,
  p_match_id TEXT,
  p_table_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_current_balance NUMERIC;
  v_current_locked NUMERIC;
  v_effective_fee NUMERIC;
  v_reservation_id TEXT;
  v_rows_updated INT;
  v_table RECORD;
  v_match RECORD;
BEGIN
  -- 1. Security Check: Authenticated user derivation from auth.uid()
  -- Client-provided p_user_id is NEVER trusted when auth.uid() is available.
  IF auth.uid() IS NOT NULL THEN
    v_uid := auth.uid();
  ELSIF p_user_id IS NOT NULL AND TRIM(p_user_id) <> '' THEN
    v_uid := public.to_uuid_safe(p_user_id);
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Unauthenticated request: user must be signed in.'
    );
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid user identity.'
    );
  END IF;

  -- 2. Verify Table & Authoritative Entry Amount from trusted database records
  SELECT * INTO v_table FROM public.ludo_tables WHERE id = p_table_id;
  IF FOUND THEN
    IF NOT v_table.is_active THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'This table is currently disabled by administrator.'
      );
    END IF;
    -- Server-authoritative fee from trusted table record (never trust client tampering)
    v_effective_fee := v_table.entry_fee;
  ELSE
    IF p_entry_fee IS NULL OR p_entry_fee <= 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Entry fee must be greater than zero.'
      );
    END IF;
    v_effective_fee := p_entry_fee;
  END IF;

  -- 3. Validate Match Status and Table Capacity (if match record exists)
  IF p_match_id IS NOT NULL THEN
    SELECT * INTO v_match FROM public.ludo_table_matches WHERE id = p_match_id FOR UPDATE;
    IF FOUND THEN
      IF v_match.status NOT IN ('waiting', 'starting') THEN
        RETURN jsonb_build_object(
          'success', FALSE,
          'error', 'Match is no longer open for joining (Status: ' || v_match.status || ').'
        );
      END IF;
      -- Validate table capacity against max_players
      IF cardinality(v_match.player_ids) >= v_match.max_players AND NOT (v_uid = ANY(v_match.player_ids)) THEN
        RETURN jsonb_build_object(
          'success', FALSE,
          'error', 'Table is full. Maximum players (' || v_match.max_players || ') reached.'
        );
      END IF;
    END IF;
  END IF;

  -- 4. Idempotency Check: prevent duplicate join / duplicate fee deduction
  IF p_match_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.coin_transactions
    WHERE reference_id = p_match_id AND status = 'reserved' AND user_id = v_uid
  ) THEN
    SELECT balance, locked_balance INTO v_current_balance, v_current_locked
    FROM public.coin_wallets WHERE user_id = v_uid;

    RETURN jsonb_build_object(
      'success', TRUE,
      'already_reserved', TRUE,
      'balance', COALESCE(v_current_balance, 0),
      'locked_balance', COALESCE(v_current_locked, 0),
      'entry_fee', v_effective_fee,
      'reservation_id', p_match_id
    );
  END IF;

  -- 5. Atomic Wallet Row Lock & Sufficient Balance Verification
  INSERT INTO public.coin_wallets (user_id, balance, locked_balance, currency, updated_at)
  VALUES (v_uid, 0, 0, 'COINS', NOW())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance, locked_balance INTO v_current_balance, v_current_locked
  FROM public.coin_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  IF v_current_balance < v_effective_fee THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Not enough cash. Please top up your cash balance. (Available: ₹' || v_current_balance || ', Required: ₹' || v_effective_fee || ')',
      'balance', v_current_balance,
      'required', v_effective_fee
    );
  END IF;

  -- 6. Atomic Balance Deduction & Locked Balance Transfer
  UPDATE public.coin_wallets
  SET balance = balance - v_effective_fee,
      locked_balance = locked_balance + v_effective_fee,
      updated_at = NOW()
  WHERE user_id = v_uid AND balance >= v_effective_fee;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Race condition detected: Insufficient balance during update.'
    );
  END IF;

  -- 7. Add player to match table if match record exists
  IF p_match_id IS NOT NULL THEN
    UPDATE public.ludo_table_matches
    SET player_ids = array_append(player_ids, v_uid)
    WHERE id = p_match_id AND NOT (v_uid = ANY(player_ids));
  END IF;

  v_reservation_id := 'resv-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 10000)::INT;

  -- 8. Immutable Ledger Audit Entry
  INSERT INTO public.coin_transactions (
    id, user_id, type, amount, status,
    balance_before, balance_after, reference_id, description, created_at
  )
  VALUES (
    v_reservation_id,
    v_uid,
    'game_fee',
    -v_effective_fee,
    'reserved',
    v_current_balance,
    v_current_balance - v_effective_fee,
    p_match_id,
    'Reserved Entry Fee for Ludo Table: ' || COALESCE(p_table_title, p_table_id) || ' (₹' || v_effective_fee || ')',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'reservation_id', v_reservation_id,
    'balance', v_current_balance - v_effective_fee,
    'locked_balance', v_current_locked + v_effective_fee,
    'entry_fee', v_effective_fee
  );
END;
$$;

-- F. Atomic Ludo Table Cancellation & Refund
CREATE OR REPLACE FUNCTION public.rpc_ludo_refund_table_entry(
  p_user_id TEXT,
  p_match_id TEXT,
  p_entry_fee INT,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := public.to_uuid_safe(p_user_id);
  v_cur_bal INT;
  v_cur_locked INT;
BEGIN
  SELECT balance, locked_balance INTO v_cur_bal, v_cur_locked
  FROM public.coin_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  IF v_cur_bal IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  -- Restore balance and deduct locked balance
  UPDATE public.coin_wallets
  SET balance = balance + p_entry_fee,
      locked_balance = GREATEST(0, locked_balance - p_entry_fee),
      updated_at = NOW()
  WHERE user_id = v_uid;

  -- Update prior reservation transaction
  UPDATE public.coin_transactions
  SET status = 'refunded',
      description = description || ' [Refunded: ' || COALESCE(p_reason, 'Cancelled') || ']'
  WHERE user_id = v_uid AND reference_id = p_match_id AND status = 'reserved';

  -- Add refund ledger entry
  INSERT INTO public.coin_transactions (
    id, user_id, type, amount, status,
    balance_before, balance_after, reference_id, description, created_at
  )
  VALUES (
    'tx-ref-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    v_uid,
    'game_refund',
    p_entry_fee,
    'completed',
    v_cur_bal,
    v_cur_bal + p_entry_fee,
    'REF-' || p_match_id,
    'Refund: ' || COALESCE(p_reason, 'Match Cancelled') || ' (+₹' || p_entry_fee || ')',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'balance', v_cur_bal + p_entry_fee,
    'locked_balance', GREATEST(0, v_cur_locked - p_entry_fee)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- G. Atomic Ludo Table Winner Prize Settlement
CREATE OR REPLACE FUNCTION public.rpc_ludo_settle_table_win(
  p_winner_user_id TEXT,
  p_match_id TEXT,
  p_prize_amount NUMERIC,
  p_entry_fee INT,
  p_table_title TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := public.to_uuid_safe(p_winner_user_id);
  v_cur_bal INT;
  v_cur_locked INT;
  v_prize_coins INT := p_prize_amount::INT;
BEGIN
  SELECT balance, locked_balance INTO v_cur_bal, v_cur_locked
  FROM public.coin_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  IF v_cur_bal IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_winner_user_id;
  END IF;

  -- Release locked entry fee and credit prize amount
  UPDATE public.coin_wallets
  SET balance = balance + v_prize_coins,
      locked_balance = GREATEST(0, locked_balance - p_entry_fee),
      updated_at = NOW()
  WHERE user_id = v_uid;

  -- Update reservation to completed
  UPDATE public.coin_transactions
  SET status = 'completed'
  WHERE user_id = v_uid AND reference_id = p_match_id AND status = 'reserved';

  -- Add prize record
  INSERT INTO public.coin_transactions (
    id, user_id, type, amount, status,
    balance_before, balance_after, reference_id, description, created_at
  )
  VALUES (
    'tx-win-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    v_uid,
    'game_reward',
    v_prize_coins,
    'completed',
    v_cur_bal,
    v_cur_bal + v_prize_coins,
    'WIN-' || p_match_id,
    'Ludo Champion Prize: ' || COALESCE(p_table_title, 'Ludo Match') || ' (+₹' || p_prize_amount || ')',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'balance', v_cur_bal + v_prize_coins,
    'prize_awarded', v_prize_coins
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions and PostgREST schema cache reload
GRANT EXECUTE ON FUNCTION public.rpc_ludo_join_table_reserve(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ludo_refund_table_entry(TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ludo_settle_table_win(TEXT, TEXT, NUMERIC, INT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
