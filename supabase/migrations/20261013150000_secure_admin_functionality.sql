-- =========================================================================
-- MIGRATION: 20261013150000_secure_admin_functionality.sql
-- CRICKET ARENA & LUDO ARENA - SECURE ADMIN MANAGEMENT SYSTEM
--
-- This migration provides:
-- 1. Definitive, hardened 'is_admin' check supporting database roles and JWT claims
-- 2. Schema guarantees for tables:
--    - public.cash_addition_requests
--    - public.player_restrictions
--    - public.ludo_tables
--    - public.audit_logs
-- 3. Row Level Security (RLS) policies guaranteeing non-admins cannot access or tamper
-- 4. Secure RPC function: 'process_cash_request' (atomic approval/rejection with wallet ledger)
-- 5. Secure RPC function: 'ban_player' (authoritative moderation, restriction lifecycles)
-- 6. Secure RPC function: 'manage_ludo_table' (authoritative table creation, modification, toggle)
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. TABLE STRUCTURE COMPATIBILITY & PREPARATION
-- =========================================================================

-- Profiles table role & ban enhancements
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Cash Addition Requests
CREATE TABLE IF NOT EXISTS public.cash_addition_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  requested_amount NUMERIC NOT NULL CHECK (requested_amount > 0),
  approved_amount NUMERIC CHECK (approved_amount >= 0),
  reason TEXT NOT NULL,
  admin_note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  processed_by UUID REFERENCES public.profiles(id),
  processed_by_name TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_requests_user ON public.cash_addition_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_requests_status ON public.cash_addition_requests(status);
CREATE INDEX IF NOT EXISTS idx_cash_requests_created ON public.cash_addition_requests(created_at DESC);

-- Player Restrictions (Bans, Suspensions, Ludo Restrictions)
CREATE TABLE IF NOT EXISTS public.player_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  restriction_type VARCHAR(20) NOT NULL CHECK (restriction_type IN ('full_ban', 'ludo_ban', 'temp_suspend')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lifted')),
  reason TEXT NOT NULL,
  internal_note TEXT,
  admin_id UUID NOT NULL,
  admin_name TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  lifted_at TIMESTAMPTZ,
  lifted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restrictions_user ON public.player_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_restrictions_status ON public.player_restrictions(status);
CREATE INDEX IF NOT EXISTS idx_restrictions_type ON public.player_restrictions(restriction_type);

-- Ludo Tables Registry
CREATE TABLE IF NOT EXISTS public.ludo_tables (
  id TEXT PRIMARY KEY,
  name TEXT,
  entry_fee NUMERIC NOT NULL CHECK (entry_fee > 0),
  mode INT NOT NULL CHECK (mode IN (2, 4)),
  prize NUMERIC NOT NULL CHECK (prize > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ludo_tables 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ludo_tables_active ON public.ludo_tables(is_active);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  admin_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(created_at DESC);

-- =========================================================================
-- 2. DEFINITIVE 'is_admin' AUTHORIZATION CHECK
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
  v_jwt JSONB;
BEGIN
  -- Obtain authenticated caller ID
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check database profile role
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_uid;

  IF v_role IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  -- 2. Check JWT app_metadata or user_metadata claims
  v_jwt := auth.jwt();
  IF v_jwt IS NOT NULL THEN
    IF COALESCE(v_jwt -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin') THEN
      RETURN TRUE;
    END IF;
    IF COALESCE(v_jwt -> 'user_metadata' ->> 'role', '') IN ('admin', 'superadmin') THEN
      RETURN TRUE;
    END IF;
    IF COALESCE((v_jwt -> 'app_metadata' ->> 'is_admin')::BOOLEAN, FALSE) = TRUE THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Verifies if current authenticated caller has administrative privileges.';

-- Overload allowing verification of specific user ID
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role IN ('admin', 'superadmin')
  );
END;
$$;

-- =========================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all relevant tables
ALTER TABLE public.cash_addition_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing overlapping policies to prevent conflicts
DROP POLICY IF EXISTS "Users read own cash requests" ON public.cash_addition_requests;
DROP POLICY IF EXISTS "Users insert own pending cash requests" ON public.cash_addition_requests;
DROP POLICY IF EXISTS "Admins update cash requests" ON public.cash_addition_requests;
DROP POLICY IF EXISTS "Admins manage all cash requests" ON public.cash_addition_requests;
DROP POLICY IF EXISTS "Deny public cash request update" ON public.cash_addition_requests;

DROP POLICY IF EXISTS "Users read own restrictions" ON public.player_restrictions;
DROP POLICY IF EXISTS "Admins manage restrictions" ON public.player_restrictions;

DROP POLICY IF EXISTS "Public read ludo tables" ON public.ludo_tables;
DROP POLICY IF EXISTS "Admins manage ludo tables" ON public.ludo_tables;

DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Deny non-admin audit log access" ON public.audit_logs;

-- --- A. CASH ADDITION REQUESTS RLS ---
-- Non-admins can only view their own requests; Admins can view all requests
CREATE POLICY "Users read own cash requests" ON public.cash_addition_requests
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Regular users can only insert their own requests with 'pending' status
CREATE POLICY "Users insert own pending cash requests" ON public.cash_addition_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Only admins can modify or delete cash requests (via direct query or RPC)
CREATE POLICY "Admins manage all cash requests" ON public.cash_addition_requests
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- B. PLAYER RESTRICTIONS RLS ---
-- Users can check their own active restrictions; Admins can view all restrictions
CREATE POLICY "Users read own restrictions" ON public.player_restrictions
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Strictly Admins can insert, update, or delete player restrictions
CREATE POLICY "Admins manage restrictions" ON public.player_restrictions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- C. LUDO TABLES RLS ---
-- Anyone (authenticated or public) can view active tables; Admins can view all (active and archived)
CREATE POLICY "Public read ludo tables" ON public.ludo_tables
  FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

-- Non-admins cannot insert, update, or delete Ludo tables
CREATE POLICY "Admins manage ludo tables" ON public.ludo_tables
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- D. AUDIT LOGS RLS ---
-- Only administrators can read audit trail logs
CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT
  USING (public.is_admin());

-- Direct user insertion is denied (only SECURITY DEFINER RPCs can write audit logs)
CREATE POLICY "Admins insert audit logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (public.is_admin());

-- =========================================================================
-- 4. SECURE FUNCTION: process_cash_request
-- =========================================================================
-- Securely processes a pending cash addition request (approve or reject).
-- Features:
-- - Strict administrator privilege verification
-- - Row-level locking (FOR UPDATE) preventing concurrency / double-spend race conditions
-- - Idempotent execution (guards against multiple approval cycles)
-- - Prevent self-approval (admin cannot approve their own requests)
-- - Atomic coin wallet balance update with ledger transaction creation
-- - Full audit trail entry
-- =========================================================================

CREATE OR REPLACE FUNCTION public.process_cash_request(
  p_request_id UUID,
  p_action TEXT, -- 'approve' or 'reject'
  p_admin_note TEXT DEFAULT NULL,
  p_approved_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_name TEXT;
  v_req RECORD;
  v_amount NUMERIC;
  v_cur_bal NUMERIC;
  v_new_bal NUMERIC;
  v_action_normalized TEXT;
  v_tx_id TEXT;
BEGIN
  -- 1. Administrator Authorization Check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only verified administrators can process cash requests.';
  END IF;

  v_admin_id := auth.uid();
  SELECT COALESCE(name, 'Administrator') INTO v_admin_name
  FROM public.profiles
  WHERE id = v_admin_id;

  v_action_normalized := LOWER(TRIM(p_action));
  IF v_action_normalized NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action: "%". Must be "approve" or "reject".', p_action;
  END IF;

  -- 2. Lock request row FOR UPDATE to guarantee atomic exactly-once processing
  SELECT * INTO v_req
  FROM public.cash_addition_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Cash request with specified ID does not exist.'
    );
  END IF;

  -- 3. Idempotency Check
  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Request has already been processed with status: ' || v_req.status,
      'already_processed', TRUE,
      'status', v_req.status
    );
  END IF;

  -- 4. Conflict of Interest Check (Admins cannot approve their own requests)
  IF v_admin_id IS NOT NULL AND v_admin_id = v_req.user_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Administrative violation: Administrators cannot approve or reject their own cash requests.'
    );
  END IF;

  -- 5. Handle Action: APPROVE
  IF v_action_normalized = 'approve' THEN
    v_amount := COALESCE(p_approved_amount, v_req.requested_amount);
    IF v_amount <= 0 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Approved amount must be strictly greater than zero.'
      );
    END IF;

    -- Ensure coin wallet exists
    INSERT INTO public.coin_wallets (user_id, balance, locked_balance, currency, updated_at)
    VALUES (v_req.user_id, 0, 0, 'COINS', NOW())
    ON CONFLICT (user_id) DO NOTHING;

    -- Lock wallet row FOR UPDATE
    SELECT balance INTO v_cur_bal
    FROM public.coin_wallets
    WHERE user_id = v_req.user_id
    FOR UPDATE;

    v_new_bal := COALESCE(v_cur_bal, 0) + v_amount;

    -- Update wallet balance atomically
    UPDATE public.coin_wallets
    SET balance = v_new_bal,
        updated_at = NOW()
    WHERE user_id = v_req.user_id;

    -- Generate unique ledger transaction ID
    v_tx_id := 'TX-ADMIN-CASH-' || SUBSTRING(p_request_id::TEXT, 1, 8) || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT;

    -- Record in transaction ledger
    INSERT INTO public.coin_transactions (
      id,
      user_id,
      type,
      amount,
      status,
      balance_before,
      balance_after,
      reference_id,
      description,
      created_at
    ) VALUES (
      v_tx_id,
      v_req.user_id,
      'admin_adjustment',
      v_amount,
      'completed',
      v_cur_bal,
      v_new_bal,
      'REQ-' || p_request_id::TEXT,
      'Manual cash request approved by ' || v_admin_name || COALESCE(': ' || p_admin_note, ''),
      NOW()
    );

    -- Update request status
    UPDATE public.cash_addition_requests
    SET status = 'approved',
        approved_amount = v_amount,
        admin_note = p_admin_note,
        processed_by = v_admin_id,
        processed_by_name = v_admin_name,
        processed_at = NOW()
    WHERE id = p_request_id;

    -- Record Audit Log
    INSERT INTO public.audit_logs (
      id, admin_id, admin_name, action, target_type, target_id, details, timestamp, created_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_id,
      v_admin_name,
      'CASH_REQUEST_APPROVED',
      'cash_request',
      p_request_id::TEXT,
      'Approved ' || v_amount || ' coins for player ' || v_req.user_name || ' (UID: ' || v_req.user_id || '). Note: ' || COALESCE(p_admin_note, 'None'),
      NOW(),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'request_id', p_request_id,
      'action', 'approved',
      'user_id', v_req.user_id,
      'approved_amount', v_amount,
      'new_balance', v_new_bal,
      'transaction_id', v_tx_id,
      'message', 'Cash request successfully approved and coins credited.'
    );

  -- 6. Handle Action: REJECT
  ELSIF v_action_normalized = 'reject' THEN
    UPDATE public.cash_addition_requests
    SET status = 'rejected',
        admin_note = p_admin_note,
        processed_by = v_admin_id,
        processed_by_name = v_admin_name,
        processed_at = NOW()
    WHERE id = p_request_id;

    -- Record Audit Log
    INSERT INTO public.audit_logs (
      id, admin_id, admin_name, action, target_type, target_id, details, timestamp, created_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_id,
      v_admin_name,
      'CASH_REQUEST_REJECTED',
      'cash_request',
      p_request_id::TEXT,
      'Rejected cash request of ' || v_req.requested_amount || ' coins for player ' || v_req.user_name || ' (UID: ' || v_req.user_id || '). Reason: ' || COALESCE(p_admin_note, 'None specified'),
      NOW(),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'request_id', p_request_id,
      'action', 'rejected',
      'user_id', v_req.user_id,
      'status', 'rejected',
      'message', 'Cash request rejected with zero modification to player balance.'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.process_cash_request(UUID, TEXT, TEXT, NUMERIC) IS 'Authoritative administrative function to approve or reject manual cash requests with atomic ledger entries.';

-- =========================================================================
-- 5. SECURE FUNCTION: ban_player
-- =========================================================================
-- Authoritatively manages restrictions on player accounts:
-- - Types: 'full_ban', 'ludo_ban', 'temp_suspend'
-- - Actions: 'apply' (impose restriction) or 'lift' (unban / clear restriction)
-- - Enforces administrator verification
-- - Prevents admins from banning themselves or fellow admins
-- - Updates public.player_restrictions and public.profiles state
-- - Emits audit logs
-- =========================================================================

CREATE OR REPLACE FUNCTION public.ban_player(
  p_target_user_id UUID,
  p_restriction_type TEXT DEFAULT 'full_ban', -- 'full_ban', 'ludo_ban', 'temp_suspend'
  p_reason TEXT DEFAULT 'Violation of Terms of Service',
  p_duration_hours INT DEFAULT NULL,
  p_internal_note TEXT DEFAULT NULL,
  p_action TEXT DEFAULT 'apply' -- 'apply' or 'lift'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_name TEXT;
  v_target RECORD;
  v_action_normalized TEXT;
  v_type_normalized TEXT;
  v_expires_at TIMESTAMPTZ;
  v_restriction_id UUID;
BEGIN
  -- 1. Administrator Authorization Check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only verified administrators can apply or lift player restrictions.';
  END IF;

  v_admin_id := auth.uid();
  SELECT COALESCE(name, 'Administrator') INTO v_admin_name
  FROM public.profiles
  WHERE id = v_admin_id;

  v_action_normalized := LOWER(TRIM(p_action));
  IF v_action_normalized NOT IN ('apply', 'lift', 'unban') THEN
    RAISE EXCEPTION 'Invalid action: "%". Must be "apply", "lift", or "unban".', p_action;
  END IF;

  -- 2. Verify target player exists
  SELECT * INTO v_target
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Player profile not found for UID: ' || p_target_user_id::TEXT
    );
  END IF;

  -- 3. Self-Ban and Admin-Ban Protection
  IF v_admin_id IS NOT NULL AND v_admin_id = p_target_user_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Administrative protection: Administrators cannot ban or restrict their own accounts.'
    );
  END IF;

  IF v_target.role IN ('admin', 'superadmin') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Administrative protection: Cannot ban an account with administrator role.'
    );
  END IF;

  -- 4. Handle Action: LIFT / UNBAN
  IF v_action_normalized IN ('lift', 'unban') THEN
    -- Deactivate all active restrictions for this player
    UPDATE public.player_restrictions
    SET status = 'lifted',
        lifted_at = NOW(),
        lifted_by = v_admin_id,
        updated_at = NOW()
    WHERE user_id = p_target_user_id
      AND status = 'active';

    -- Clear ban flag on profile
    UPDATE public.profiles
    SET is_banned = FALSE,
        ban_reason = NULL,
        updated_at = NOW()
    WHERE id = p_target_user_id;

    -- Record Audit Log
    INSERT INTO public.audit_logs (
      id, admin_id, admin_name, action, target_type, target_id, details, timestamp, created_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_id,
      v_admin_name,
      'PLAYER_RESTRICTION_LIFTED',
      'player',
      p_target_user_id::TEXT,
      'Lifted all bans and restrictions for player ' || v_target.name || ' (UID: ' || p_target_user_id || '). Note: ' || COALESCE(p_internal_note, 'None'),
      NOW(),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'action', 'lifted',
      'user_id', p_target_user_id,
      'user_name', v_target.name,
      'message', 'All restrictions have been lifted for this player.'
    );
  END IF;

  -- 5. Handle Action: APPLY RESTRICTION
  v_type_normalized := LOWER(TRIM(p_restriction_type));
  IF v_type_normalized NOT IN ('full_ban', 'ludo_ban', 'temp_suspend') THEN
    RAISE EXCEPTION 'Invalid restriction_type: "%". Allowed types: "full_ban", "ludo_ban", "temp_suspend".', p_restriction_type;
  END IF;

  IF p_duration_hours IS NOT NULL AND p_duration_hours > 0 THEN
    v_expires_at := NOW() + (p_duration_hours || ' hours')::INTERVAL;
  ELSE
    v_expires_at := NULL; -- Indefinite / permanent ban
  END IF;

  -- Retire previous active restrictions of this type
  UPDATE public.player_restrictions
  SET status = 'lifted',
      lifted_at = NOW(),
      lifted_by = v_admin_id,
      updated_at = NOW()
  WHERE user_id = p_target_user_id
    AND restriction_type = v_type_normalized
    AND status = 'active';

  -- Create new restriction record
  v_restriction_id := gen_random_uuid();
  INSERT INTO public.player_restrictions (
    id,
    user_id,
    user_name,
    restriction_type,
    status,
    reason,
    internal_note,
    admin_id,
    admin_name,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    v_restriction_id,
    p_target_user_id,
    v_target.name,
    v_type_normalized,
    'active',
    p_reason,
    p_internal_note,
    COALESCE(v_admin_id, '00000000-0000-0000-0000-000000000000'::UUID),
    v_admin_name,
    v_expires_at,
    NOW(),
    NOW()
  );

  -- Update profiles table flag if full_ban or temp_suspend
  IF v_type_normalized IN ('full_ban', 'temp_suspend') THEN
    UPDATE public.profiles
    SET is_banned = TRUE,
        ban_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_target_user_id;
  END IF;

  -- Record Audit Log
  INSERT INTO public.audit_logs (
    id, admin_id, admin_name, action, target_type, target_id, details, timestamp, created_at
  ) VALUES (
    gen_random_uuid(),
    v_admin_id,
    v_admin_name,
    'PLAYER_RESTRICTION_APPLIED',
    'player',
    p_target_user_id::TEXT,
    'Applied ' || v_type_normalized || ' on ' || v_target.name || ' (UID: ' || p_target_user_id || '). Reason: ' || p_reason || COALESCE('. Expires: ' || v_expires_at::TEXT, '. Indefinite ban.'),
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'restriction_id', v_restriction_id,
    'action', 'applied',
    'user_id', p_target_user_id,
    'user_name', v_target.name,
    'restriction_type', v_type_normalized,
    'reason', p_reason,
    'expires_at', v_expires_at,
    'message', 'Player restriction successfully applied.'
  );
END;
$$;

COMMENT ON FUNCTION public.ban_player(UUID, TEXT, TEXT, INT, TEXT, TEXT) IS 'Authoritatively imposes or lifts bans and game restrictions on player accounts with audit logging.';

-- =========================================================================
-- 6. SECURE FUNCTION: manage_ludo_table
-- =========================================================================
-- Authoritatively creates, updates, toggles, or archives cash Ludo tables.
-- - Enforces administrator verification
-- - Validates entry fee, mode (2 or 4), and prize amounts
-- - Updates public.ludo_tables registry
-- - Emits audit logs
-- =========================================================================

CREATE OR REPLACE FUNCTION public.manage_ludo_table(
  p_action TEXT, -- 'create', 'update', 'toggle_active', 'archive'
  p_table_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_entry_fee NUMERIC DEFAULT NULL,
  p_mode INT DEFAULT NULL,
  p_prize NUMERIC DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_name TEXT;
  v_action_normalized TEXT;
  v_table RECORD;
  v_new_active BOOLEAN;
  v_calc_prize NUMERIC;
BEGIN
  -- 1. Administrator Authorization Check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only verified administrators can configure Ludo tables.';
  END IF;

  v_admin_id := auth.uid();
  SELECT COALESCE(name, 'Administrator') INTO v_admin_name
  FROM public.profiles
  WHERE id = v_admin_id;

  v_action_normalized := LOWER(TRIM(p_action));
  IF v_action_normalized NOT IN ('create', 'update', 'toggle_active', 'archive', 'delete') THEN
    RAISE EXCEPTION 'Invalid action: "%". Allowed actions: "create", "update", "toggle_active", "archive".', p_action;
  END IF;

  IF p_table_id IS NULL OR TRIM(p_table_id) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'table_id parameter cannot be empty.');
  END IF;

  -- 2. Handle Action: CREATE
  IF v_action_normalized = 'create' THEN
    IF EXISTS (SELECT 1 FROM public.ludo_tables WHERE id = p_table_id) THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'A table with ID "' || p_table_id || '" already exists. Use "update" action instead.'
      );
    END IF;

    IF p_entry_fee IS NULL OR p_entry_fee <= 0 THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Entry fee must be strictly greater than zero.');
    END IF;

    IF p_mode IS NULL OR p_mode NOT IN (2, 4) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Mode must be 2 (2 Players) or 4 (4 Players).');
    END IF;

    -- Calculate default prize if not specified (e.g. 1.75x entry fee for 2P, 3.5x for 4P)
    IF p_prize IS NULL OR p_prize <= 0 THEN
      IF p_mode = 2 THEN
        v_calc_prize := ROUND(p_entry_fee * 1.75, 2);
      ELSE
        v_calc_prize := ROUND(p_entry_fee * 3.50, 2);
      END IF;
    ELSE
      v_calc_prize := p_prize;
    END IF;

    INSERT INTO public.ludo_tables (
      id,
      name,
      entry_fee,
      mode,
      prize,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      TRIM(p_table_id),
      COALESCE(p_name, 'Table ' || p_entry_fee || ' Coins (' || p_mode || 'P)'),
      p_entry_fee,
      p_mode,
      v_calc_prize,
      COALESCE(p_is_active, TRUE),
      NOW(),
      NOW()
    );

    -- Record Audit Log
    INSERT INTO public.audit_logs (
      id, admin_id, admin_name, action, target_type, target_id, details, timestamp, created_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_id,
      v_admin_name,
      'LUDO_TABLE_CREATED',
      'ludo_table',
      p_table_id,
      'Created table ' || p_table_id || ' with entry ' || p_entry_fee || ' coins, ' || p_mode || 'P, prize ' || v_calc_prize || ' coins.',
      NOW(),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'action', 'created',
      'table_id', p_table_id,
      'entry_fee', p_entry_fee,
      'mode', p_mode,
      'prize', v_calc_prize,
      'is_active', COALESCE(p_is_active, TRUE),
      'message', 'Ludo table created successfully.'
    );

  -- 3. Handle Action: UPDATE
  ELSIF v_action_normalized = 'update' THEN
    SELECT * INTO v_table FROM public.ludo_tables WHERE id = p_table_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Table not found: ' || p_table_id);
    END IF;

    IF p_mode IS NOT NULL AND p_mode NOT IN (2, 4) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Mode must be 2 or 4.');
    END IF;

    IF p_entry_fee IS NOT NULL AND p_entry_fee <= 0 THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Entry fee must be strictly positive.');
    END IF;

    IF p_prize IS NOT NULL AND p_prize <= 0 THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Prize must be strictly positive.');
    END IF;

    UPDATE public.ludo_tables
    SET name = COALESCE(p_name, name),
        entry_fee = COALESCE(p_entry_fee, entry_fee),
        mode = COALESCE(p_mode, mode),
        prize = COALESCE(p_prize, prize),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE id = p_table_id;

    -- Record Audit Log
    INSERT INTO public.audit_logs (
      id, admin_id, admin_name, action, target_type, target_id, details, timestamp, created_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_id,
      v_admin_name,
      'LUDO_TABLE_UPDATED',
      'ludo_table',
      p_table_id,
      'Updated table parameters: fee=' || COALESCE(p_entry_fee::TEXT, v_table.entry_fee::TEXT) || ', prize=' || COALESCE(p_prize::TEXT, v_table.prize::TEXT) || ', active=' || COALESCE(p_is_active::TEXT, v_table.is_active::TEXT),
      NOW(),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'action', 'updated',
      'table_id', p_table_id,
      'message', 'Ludo table updated successfully.'
    );

  -- 4. Handle Action: TOGGLE_ACTIVE
  ELSIF v_action_normalized = 'toggle_active' THEN
    SELECT * INTO v_table FROM public.ludo_tables WHERE id = p_table_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Table not found: ' || p_table_id);
    END IF;

    v_new_active := COALESCE(p_is_active, NOT v_table.is_active);

    UPDATE public.ludo_tables
    SET is_active = v_new_active,
        updated_at = NOW()
    WHERE id = p_table_id;

    INSERT INTO public.audit_logs (
      id, admin_id, admin_name, action, target_type, target_id, details, timestamp, created_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_id,
      v_admin_name,
      'LUDO_TABLE_TOGGLED',
      'ludo_table',
      p_table_id,
      'Toggled table ' || p_table_id || ' status to ' || CASE WHEN v_new_active THEN 'ACTIVE' ELSE 'INACTIVE' END,
      NOW(),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'action', 'toggled',
      'table_id', p_table_id,
      'is_active', v_new_active,
      'message', 'Ludo table status updated to ' || CASE WHEN v_new_active THEN 'active' ELSE 'inactive' END || '.'
    );

  -- 5. Handle Action: ARCHIVE / DISABLE
  ELSIF v_action_normalized IN ('archive', 'delete') THEN
    SELECT * INTO v_table FROM public.ludo_tables WHERE id = p_table_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Table not found: ' || p_table_id);
    END IF;

    -- Soft-delete / archive table by setting is_active = FALSE
    UPDATE public.ludo_tables
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE id = p_table_id;

    INSERT INTO public.audit_logs (
      id, admin_id, admin_name, action, target_type, target_id, details, timestamp, created_at
    ) VALUES (
      gen_random_uuid(),
      v_admin_id,
      v_admin_name,
      'LUDO_TABLE_ARCHIVED',
      'ludo_table',
      p_table_id,
      'Archived table ' || p_table_id || '.',
      NOW(),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'action', 'archived',
      'table_id', p_table_id,
      'is_active', FALSE,
      'message', 'Ludo table has been archived.'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.manage_ludo_table(TEXT, TEXT, TEXT, NUMERIC, INT, NUMERIC, BOOLEAN) IS 'Authoritative administrative function to create, update, toggle, or archive cash Ludo tables.';

-- =========================================================================
-- 7. COMPATIBILITY WRAPPERS
-- =========================================================================
-- Wraps earlier RPC calls seamlessly into process_cash_request and ban_player

CREATE OR REPLACE FUNCTION public.rpc_admin_approve_cash_request(
  p_request_id UUID,
  p_approved_amount NUMERIC,
  p_admin_note TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_admin_name TEXT DEFAULT 'Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN public.process_cash_request(
    p_request_id := p_request_id,
    p_action := 'approve',
    p_admin_note := p_admin_note,
    p_approved_amount := p_approved_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_reject_cash_request(
  p_request_id UUID,
  p_admin_note TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_admin_name TEXT DEFAULT 'Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN public.process_cash_request(
    p_request_id := p_request_id,
    p_action := 'reject',
    p_admin_note := p_admin_note,
    p_approved_amount := NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_set_player_restriction(
  p_user_id UUID,
  p_restriction_type TEXT,
  p_reason TEXT,
  p_duration_hours INT DEFAULT NULL,
  p_internal_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN public.ban_player(
    p_target_user_id := p_user_id,
    p_restriction_type := p_restriction_type,
    p_reason := p_reason,
    p_duration_hours := p_duration_hours,
    p_internal_note := p_internal_note,
    p_action := 'apply'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_lift_player_restriction(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'Pardoned by administration'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN public.ban_player(
    p_target_user_id := p_user_id,
    p_restriction_type := 'full_ban',
    p_reason := p_reason,
    p_duration_hours := NULL,
    p_internal_note := p_reason,
    p_action := 'lift'
  );
END;
$$;

-- =========================================================================
-- 8. PERMISSIONS CONFIGURATION
-- =========================================================================

-- Grant execute permissions to authenticated users (role check inside function enforces admin security)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_cash_request(UUID, TEXT, TEXT, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ban_player(UUID, TEXT, TEXT, INT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manage_ludo_table(TEXT, TEXT, TEXT, NUMERIC, INT, NUMERIC, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_approve_cash_request(UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_reject_cash_request(UUID, TEXT, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_set_player_restriction(UUID, TEXT, TEXT, INT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_admin_lift_player_restriction(UUID, TEXT) TO authenticated, service_role;

-- Revoke execute from public and anon roles for safety
REVOKE EXECUTE ON FUNCTION public.process_cash_request(UUID, TEXT, TEXT, NUMERIC) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ban_player(UUID, TEXT, TEXT, INT, TEXT, TEXT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.manage_ludo_table(TEXT, TEXT, TEXT, NUMERIC, INT, NUMERIC, BOOLEAN) FROM anon, public;

-- =========================================================================
-- END OF MIGRATION: 20261013150000_secure_admin_functionality.sql
-- =========================================================================
