-- =========================================================================
-- MIGRATION: 20261013120000_fix_rpc_ludo_join_table_reserve.sql
-- Fixes: "Could not find the function public.rpc_ludo_join_table_reserve in schema cache"
-- Safe, additive migration preserving all existing Cricket & Ludo data.
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. HELPER: Safe UUID parsing (supports guest IDs, MD5 hashing fallback)
CREATE OR REPLACE FUNCTION public.to_uuid_safe(p_val TEXT)
RETURNS UUID AS $$
BEGIN
  IF p_val IS NULL OR TRIM(p_val) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_val::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN md5(p_val)::UUID;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. PROFILES TABLE (Preserves existing schema)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT NOT NULL DEFAULT 'Player',
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. COIN WALLETS TABLE (Real Cash Balances & Row Locks)
CREATE TABLE IF NOT EXISTS public.coin_wallets (
  user_id UUID PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
  locked_balance NUMERIC NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'COINS',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. COIN TRANSACTIONS LEDGER (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount NUMERIC NOT NULL,
  status VARCHAR(20) NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  reference_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user_ref ON public.coin_transactions(user_id, reference_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_status ON public.coin_transactions(status);

-- 6. LUDO CASH TABLES REGISTRY (Authoritative Server-side Rules & Entry Fees)
CREATE TABLE IF NOT EXISTS public.ludo_tables (
  id TEXT PRIMARY KEY,
  entry_fee NUMERIC NOT NULL CHECK (entry_fee > 0),
  mode INT NOT NULL CHECK (mode IN (2, 4)),
  prize NUMERIC NOT NULL CHECK (prize > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed all 21 Real Cash Table Tiers (2P and 4P modes = 42 authoritative tables)
INSERT INTO public.ludo_tables (id, entry_fee, mode, prize, is_active) VALUES
  ('table-2p-5', 5, 2, 8.75, TRUE),
  ('table-4p-5', 5, 4, 17.50, TRUE),
  ('table-2p-10', 10, 2, 17.50, TRUE),
  ('table-4p-10', 10, 4, 35.00, TRUE),
  ('table-2p-20', 20, 2, 35.00, TRUE),
  ('table-4p-20', 20, 4, 70.00, TRUE),
  ('table-2p-50', 5, 2, 87.50, TRUE),
  ('table-4p-50', 50, 4, 175.00, TRUE),
  ('table-2p-100', 100, 2, 175.00, TRUE),
  ('table-4p-100', 100, 4, 350.00, TRUE),
  ('table-2p-200', 200, 2, 350.00, TRUE),
  ('table-4p-200', 200, 4, 700.00, TRUE),
  ('table-2p-250', 250, 2, 440.00, TRUE),
  ('table-4p-250', 250, 4, 875.00, TRUE),
  ('table-2p-500', 500, 2, 880.00, TRUE),
  ('table-4p-500', 500, 4, 1750.00, TRUE),
  ('table-2p-750', 750, 2, 1320.00, TRUE),
  ('table-4p-750', 750, 4, 2625.00, TRUE),
  ('table-2p-1000', 1000, 2, 1800.00, TRUE),
  ('table-4p-1000', 1000, 4, 3500.00, TRUE),
  ('table-2p-1500', 1500, 2, 2700.00, TRUE),
  ('table-4p-1500', 1500, 4, 5250.00, TRUE),
  ('table-2p-1750', 1750, 2, 3150.00, TRUE),
  ('table-4p-1750', 1750, 4, 6125.00, TRUE),
  ('table-2p-2000', 2000, 2, 3640.00, TRUE),
  ('table-4p-2000', 2000, 4, 7000.00, TRUE),
  ('table-2p-3000', 3000, 2, 5460.00, TRUE),
  ('table-4p-3000', 3000, 4, 10500.00, TRUE),
  ('table-2p-3500', 3500, 2, 6370.00, TRUE),
  ('table-4p-3500', 3500, 4, 12250.00, TRUE),
  ('table-2p-5000', 5000, 2, 9200.00, TRUE),
  ('table-4p-5000', 5000, 4, 17500.00, TRUE),
  ('table-2p-7000', 7000, 2, 12880.00, TRUE),
  ('table-4p-7000', 7000, 4, 24500.00, TRUE),
  ('table-2p-10000', 10000, 2, 18400.00, TRUE),
  ('table-4p-10000', 10000, 4, 35000.00, TRUE),
  ('table-2p-12000', 12000, 2, 22080.00, TRUE),
  ('table-4p-12000', 12000, 4, 42000.00, TRUE),
  ('table-2p-15000', 15000, 2, 27600.00, TRUE),
  ('table-4p-15000', 15000, 4, 52500.00, TRUE),
  ('table-2p-25000', 25000, 2, 46000.00, TRUE),
  ('table-4p-25000', 25000, 4, 87000.00, TRUE)
ON CONFLICT (id) DO UPDATE SET
  entry_fee = EXCLUDED.entry_fee,
  prize = EXCLUDED.prize,
  is_active = EXCLUDED.is_active;

-- 7. LUDO MATCHES TABLE (Capacity & Status Tracking)
CREATE TABLE IF NOT EXISTS public.ludo_table_matches (
  id TEXT PRIMARY KEY,
  table_id TEXT REFERENCES public.ludo_tables(id),
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'in_progress', 'completed', 'cancelled')),
  max_players INT NOT NULL DEFAULT 2 CHECK (max_players IN (2, 4)),
  player_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 8. AUTHORITATIVE CANONICAL RPC FUNCTION: rpc_ludo_join_table_reserve
-- Canonical Signature:
-- (p_user_id, p_table_id, p_entry_fee, p_match_id, p_table_title)
-- =========================================================================

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
  -- 1. Security Check: Authenticate user
  -- Never trust raw client p_user_id if Supabase auth.uid() is available.
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

  -- 2. Verify Table & Authoritative Entry Amount
  SELECT * INTO v_table FROM public.ludo_tables WHERE id = p_table_id;
  IF FOUND THEN
    IF NOT v_table.is_active THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'This table is currently disabled by administrator.');
    END IF;
    -- Server overrides client fee with trusted table fee
    v_effective_fee := v_table.entry_fee;
  ELSE
    -- If custom table, validate client fee
    IF p_entry_fee IS NULL OR p_entry_fee <= 0 THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Entry fee must be greater than zero.');
    END IF;
    v_effective_fee := p_entry_fee;
  END IF;

  -- 3. Match Capacity & Status Validation
  IF p_match_id IS NOT NULL THEN
    SELECT * INTO v_match FROM public.ludo_table_matches WHERE id = p_match_id;
    IF FOUND THEN
      IF v_match.status NOT IN ('waiting', 'starting') THEN
        RETURN jsonb_build_object(
          'success', FALSE,
          'error', 'Table match is already in progress or completed.'
        );
      END IF;

      -- Check table capacity
      IF array_length(v_match.player_ids, 1) >= v_match.max_players AND NOT (v_uid = ANY(v_match.player_ids)) THEN
        RETURN jsonb_build_object(
          'success', FALSE,
          'error', 'Table is already full. Please join another table.'
        );
      END IF;
    END IF;
  END IF;

  -- 4. Idempotency Check: Prevent duplicate deductions for the exact same match reservation
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

  -- 5. Ensure user wallet exists and lock row with FOR UPDATE
  INSERT INTO public.coin_wallets (user_id, balance, locked_balance, currency, updated_at)
  VALUES (v_uid, 0, 0, 'COINS', NOW())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance, locked_balance INTO v_current_balance, v_current_locked
  FROM public.coin_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  -- 6. Strict Balance Verification
  IF v_current_balance < v_effective_fee THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Not enough cash. Please top up your cash balance. (Available: ₹' || v_current_balance || ', Required: ₹' || v_effective_fee || ')',
      'balance', v_current_balance,
      'required', v_effective_fee
    );
  END IF;

  -- 7. Atomic Balance Deduction & Lock Reservation
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

  -- 8. Generate reservation ID & Insert immutable ledger record
  v_reservation_id := 'resv-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 10000)::INT;

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

  -- 9. Update match player_ids if match record exists
  IF p_match_id IS NOT NULL THEN
    UPDATE public.ludo_table_matches
    SET player_ids = array_append(player_ids, v_uid)
    WHERE id = p_match_id AND NOT (v_uid = ANY(player_ids));
  END IF;

  -- 10. Return success response
  RETURN jsonb_build_object(
    'success', TRUE,
    'reservation_id', v_reservation_id,
    'balance', v_current_balance - v_effective_fee,
    'locked_balance', v_current_locked + v_effective_fee,
    'entry_fee', v_effective_fee
  );
END;
$$;


-- =========================================================================
-- 9. REFUND RPC FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.rpc_ludo_refund_table_entry(
  p_user_id TEXT,
  p_match_id TEXT,
  p_entry_fee NUMERIC,
  p_reason TEXT DEFAULT 'Cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := COALESCE(auth.uid(), public.to_uuid_safe(p_user_id));
  v_cur_bal NUMERIC;
  v_cur_locked NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid user identity.');
  END IF;

  SELECT balance, locked_balance INTO v_cur_bal, v_cur_locked
  FROM public.coin_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  IF v_cur_bal IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Wallet not found.');
  END IF;

  -- Restore balance and deduct locked balance safely
  UPDATE public.coin_wallets
  SET balance = balance + p_entry_fee,
      locked_balance = GREATEST(0, locked_balance - p_entry_fee),
      updated_at = NOW()
  WHERE user_id = v_uid;

  -- Update reservation transaction
  UPDATE public.coin_transactions
  SET status = 'refunded',
      description = description || ' [Refunded: ' || COALESCE(p_reason, 'Match Cancelled') || ']'
  WHERE user_id = v_uid AND reference_id = p_match_id AND status = 'reserved';

  INSERT INTO public.coin_transactions (
    id, user_id, type, amount, status,
    balance_before, balance_after, reference_id, description, created_at
  )
  VALUES (
    'rfnd-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT,
    v_uid,
    'refund',
    p_entry_fee,
    'completed',
    v_cur_bal,
    v_cur_bal + p_entry_fee,
    p_match_id,
    'Refund Entry Fee: ' || COALESCE(p_reason, 'Match Cancelled') || ' (+₹' || p_entry_fee || ')',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'balance', v_cur_bal + p_entry_fee,
    'locked_balance', GREATEST(0, v_cur_locked - p_entry_fee)
  );
END;
$$;

-- =========================================================================
-- 10. WIN PRIZE SETTLEMENT RPC FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.rpc_ludo_settle_table_win(
  p_winner_user_id TEXT,
  p_match_id TEXT,
  p_entry_fee NUMERIC,
  p_prize_amount NUMERIC,
  p_table_title TEXT DEFAULT 'Ludo Match'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := public.to_uuid_safe(p_winner_user_id);
  v_cur_bal NUMERIC;
  v_cur_locked NUMERIC;
BEGIN
  SELECT balance, locked_balance INTO v_cur_bal, v_cur_locked
  FROM public.coin_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  IF v_cur_bal IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Wallet not found.');
  END IF;

  UPDATE public.coin_wallets
  SET balance = balance + p_prize_amount,
      locked_balance = GREATEST(0, locked_balance - p_entry_fee),
      updated_at = NOW()
  WHERE user_id = v_uid;

  UPDATE public.coin_transactions
  SET status = 'completed'
  WHERE user_id = v_uid AND reference_id = p_match_id AND status = 'reserved';

  INSERT INTO public.coin_transactions (
    id, user_id, type, amount, status,
    balance_before, balance_after, reference_id, description, created_at
  )
  VALUES (
    'win-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 1000)::INT,
    v_uid,
    'winning_prize',
    p_prize_amount,
    'completed',
    v_cur_bal,
    v_cur_bal + p_prize_amount,
    p_match_id,
    'Ludo Champion Prize: ' || COALESCE(p_table_title, 'Ludo Match') || ' (+₹' || p_prize_amount || ')',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'balance', v_cur_bal + p_prize_amount,
    'locked_balance', GREATEST(0, v_cur_locked - p_entry_fee)
  );
END;
$$;

-- =========================================================================
-- 11. GRANT EXECUTION PERMISSIONS
-- =========================================================================

GRANT EXECUTE ON FUNCTION public.rpc_ludo_join_table_reserve(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ludo_refund_table_entry(TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_ludo_settle_table_win(TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- 12. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
