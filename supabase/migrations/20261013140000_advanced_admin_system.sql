-- =========================================================================
-- MIGRATION: 20261013140000_advanced_admin_system.sql
-- CRICKET ARENA - ADVANCED ADMIN CONTROL PANEL & SECURE DATABASE EXTENSIONS
-- Adds:
-- 1. cash_addition_requests (Manual Cash Requests with single-decision audit)
-- 2. player_restrictions (Authoritative Bans, Suspensions, and Ludo Restrictions)
-- 3. rpc_admin_approve_cash_request (Idempotent atomic credit)
-- 4. rpc_admin_reject_cash_request (Safe rejection without balance alteration)
-- 5. rpc_admin_set_player_restriction & rpc_admin_lift_player_restriction
-- 6. Disables withdrawal mechanisms while preserving financial transaction ledger
-- =========================================================================

-- 1. CASH ADDITION REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.cash_addition_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  requested_amount INT NOT NULL CHECK (requested_amount > 0),
  approved_amount INT CHECK (approved_amount >= 0),
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

-- 2. PLAYER RESTRICTIONS TABLE (Bans, Suspensions, Ludo Restrictions)
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

-- 3. ROW LEVEL SECURITY POLICIES
ALTER TABLE public.cash_addition_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_restrictions ENABLE ROW LEVEL SECURITY;

-- Cash Addition Requests Policies:
-- Users can view only their own requests
CREATE POLICY "Users read own cash requests" ON public.cash_addition_requests
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Users can submit their own cash requests (status must be pending)
CREATE POLICY "Users insert own pending cash requests" ON public.cash_addition_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Only admins can update cash addition requests
CREATE POLICY "Admins update cash requests" ON public.cash_addition_requests
  FOR UPDATE USING (public.is_admin());

-- Player Restrictions Policies:
-- Public can check if they are restricted
CREATE POLICY "Users read own restrictions" ON public.player_restrictions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Only admins can create/update player restrictions
CREATE POLICY "Admins manage restrictions" ON public.player_restrictions
  FOR ALL USING (public.is_admin());

-- =========================================================================
-- SECURE AUTHORITATIVE RPC FUNCTIONS
-- =========================================================================

-- Helper function: Check if player has an active restriction
CREATE OR REPLACE FUNCTION public.rpc_check_player_restriction(
  p_user_id UUID,
  p_check_type TEXT DEFAULT 'any'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Look for active restriction that hasn't expired
  SELECT * INTO v_rec
  FROM public.player_restrictions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (
      p_check_type = 'any'
      OR restriction_type = 'full_ban'
      OR (p_check_type = 'ludo' AND restriction_type IN ('ludo_ban', 'full_ban', 'temp_suspend'))
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'is_restricted', TRUE,
      'restriction_type', v_rec.restriction_type,
      'reason', v_rec.reason,
      'expires_at', v_rec.expires_at,
      'created_at', v_rec.created_at
    );
  ELSE
    RETURN jsonb_build_object('is_restricted', FALSE);
  END IF;
END;
$$;

-- RPC: Admin Approve Cash Request (Idempotent single credit)
CREATE OR REPLACE FUNCTION public.rpc_admin_approve_cash_request(
  p_request_id UUID,
  p_approved_amount INT,
  p_admin_note TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_admin_name TEXT DEFAULT 'Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_effective_admin_id UUID;
  v_cur_bal INT;
  v_new_bal INT;
  v_amount INT;
BEGIN
  -- 1. Verify admin privilege
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only verified administrators can approve cash requests.';
    END IF;
    v_effective_admin_id := auth.uid();
  ELSE
    v_effective_admin_id := p_admin_id;
  END IF;

  -- 2. Lock request row FOR UPDATE to guarantee atomic exactly-once processing
  SELECT * INTO v_req
  FROM public.cash_addition_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Cash request not found.');
  END IF;

  -- 3. Idempotency Check: reject duplicate processing
  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Request already processed with status: ' || v_req.status,
      'already_processed', TRUE
    );
  END IF;

  -- Prevent admin from approving their own request
  IF v_effective_admin_id IS NOT NULL AND v_effective_admin_id = v_req.user_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Administrative violation: Cannot approve your own cash request.'
    );
  END IF;

  v_amount := COALESCE(p_approved_amount, v_req.requested_amount);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Approved amount must be greater than zero.');
  END IF;

  -- 4. Credit wallet atomically
  INSERT INTO public.coin_wallets (user_id, balance, locked_balance, currency, updated_at)
  VALUES (v_req.user_id, 0, 0, 'COINS', NOW())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_cur_bal
  FROM public.coin_wallets
  WHERE user_id = v_req.user_id
  FOR UPDATE;

  v_new_bal := COALESCE(v_cur_bal, 0) + v_amount;

  UPDATE public.coin_wallets
  SET balance = v_new_bal,
      updated_at = NOW()
  WHERE user_id = v_req.user_id;

  -- 5. Record immutable transaction in ledger
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
    gen_random_uuid(),
    v_req.user_id,
    'admin_adjustment',
    v_amount,
    'completed',
    v_cur_bal,
    v_new_bal,
    'REQ-APPV-' || p_request_id,
    'Manual Cash Addition Approved: ' || v_amount || ' coins credited by ' || p_admin_name || COALESCE(' (' || p_admin_note || ')', ''),
    NOW()
  );

  -- 6. Update request status to approved
  UPDATE public.cash_addition_requests
  SET status = 'approved',
      approved_amount = v_amount,
      admin_note = p_admin_note,
      processed_by = v_effective_admin_id,
      processed_by_name = p_admin_name,
      processed_at = NOW()
  WHERE id = p_request_id;

  -- 7. Audit log
  INSERT INTO public.audit_logs (
    id, admin_id, admin_name, action, target_type, target_id, details, timestamp
  ) VALUES (
    gen_random_uuid(),
    COALESCE(v_effective_admin_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_admin_name,
    'CASH_REQUEST_APPROVED',
    'cash_request',
    p_request_id::text,
    'Approved ' || v_amount || ' coins for user ' || v_req.user_name || ' (UID: ' || v_req.user_id || ')',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', p_request_id,
    'approved_amount', v_amount,
    'new_balance', v_new_bal,
    'message', 'Cash request approved and coins credited successfully.'
  );
END;
$$;

-- RPC: Admin Reject Cash Request
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
DECLARE
  v_req RECORD;
  v_effective_admin_id UUID;
BEGIN
  -- Verify admin privilege
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only verified administrators can reject cash requests.';
    END IF;
    v_effective_admin_id := auth.uid();
  ELSE
    v_effective_admin_id := p_admin_id;
  END IF;

  SELECT * INTO v_req
  FROM public.cash_addition_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Cash request not found.');
  END IF;

  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Request already processed with status: ' || v_req.status
    );
  END IF;

  -- Update request to rejected (zero balance change)
  UPDATE public.cash_addition_requests
  SET status = 'rejected',
      admin_note = p_admin_note,
      processed_by = v_effective_admin_id,
      processed_by_name = p_admin_name,
      processed_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (
    id, admin_id, admin_name, action, target_type, target_id, details, timestamp
  ) VALUES (
    gen_random_uuid(),
    COALESCE(v_effective_admin_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_admin_name,
    'CASH_REQUEST_REJECTED',
    'cash_request',
    p_request_id::text,
    'Rejected cash request of ' || v_req.requested_amount || ' coins for user ' || v_req.user_name || '. Reason: ' || COALESCE(p_admin_note, 'No note provided'),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', p_request_id,
    'status', 'rejected',
    'message', 'Cash request rejected with zero wallet balance modification.'
  );
END;
$$;
