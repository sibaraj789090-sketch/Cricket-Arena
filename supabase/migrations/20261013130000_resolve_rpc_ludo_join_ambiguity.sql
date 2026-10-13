-- =========================================================================
-- MIGRATION: 20261013130000_resolve_rpc_ludo_join_ambiguity.sql
-- Resolves: "Could not choose the best candidate function between public.rpc_ludo_join_table_reserve"
-- Removes redundant overload and establishes canonical signature:
-- public.rpc_ludo_join_table_reserve(p_user_id, p_table_id, p_entry_fee, p_match_id, p_table_title)
-- =========================================================================

-- 1. SAFELY REMOVE EXISTING OVERLOADS TO ELIMINATE AMBIGUITY
-- Drop both existing variant parameter orders so pg_proc has zero ambiguity
DROP FUNCTION IF EXISTS public.rpc_ludo_join_table_reserve(NUMERIC, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_ludo_join_table_reserve(TEXT, TEXT, NUMERIC, TEXT, TEXT);

-- 2. CREATE AUTHORITATIVE CANONICAL RPC FUNCTION
-- Canonical Signature:
-- p_user_id TEXT, p_table_id TEXT, p_entry_fee NUMERIC, p_match_id TEXT, p_table_title TEXT DEFAULT NULL
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
  -- A. Derive authenticated user from auth.uid() first to prevent user ID spoofing.
  -- Never trust client-provided p_user_id when auth.uid() is available.
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

  -- B. Verify Table & Authoritative Entry Amount from trusted database records
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

  -- C. Validate Match Status and Table Capacity (if match record exists)
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

  -- D. Idempotency Check: prevent duplicate join / duplicate fee deduction
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

  -- E. Atomic Wallet Row Lock & Sufficient Balance Verification
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

  -- F. Atomic Balance Deduction & Locked Balance Transfer
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

  -- G. Add player to match table if match record exists
  IF p_match_id IS NOT NULL THEN
    UPDATE public.ludo_table_matches
    SET player_ids = array_append(player_ids, v_uid)
    WHERE id = p_match_id AND NOT (v_uid = ANY(player_ids));
  END IF;

  v_reservation_id := 'resv-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || floor(random() * 10000)::INT;

  -- H. Immutable Ledger Audit Entry
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

-- 3. GRANT EXECUTION PERMISSION ON THE CANONICAL SIGNATURE ONLY
GRANT EXECUTE ON FUNCTION public.rpc_ludo_join_table_reserve(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. RELOAD SUPABASE POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
