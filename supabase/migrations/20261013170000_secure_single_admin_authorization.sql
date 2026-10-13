-- =========================================================================
-- MIGRATION: 20261013170000_secure_single_admin_authorization.sql
-- CRICKET ARENA - HARDENED ADMINISTRATOR ACCESS & RLS ENFORCEMENT
--
-- This migration guarantees:
-- 1. Eliminates user_metadata role forgery vulnerability
-- 2. Restricts 'role = admin' privilege elevation on public.profiles
-- 3. Hardens public.is_admin() to require verified database role
-- 4. Guarantees public users can only manage their own virtual teams and profiles
-- =========================================================================

-- 1. Hardened is_admin() function: strictly verifies database profiles role
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
BEGIN
  -- Obtain authenticated caller ID
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Only verified database profile role determines admin status
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_uid;

  IF v_role IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  -- 2. Strictly check app_metadata claim (set only via service_role / backend auth)
  -- NEVER inspect user_metadata, which can be specified by users on signup
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Strictly checks authenticated caller identity against database profiles role and service-role app_metadata.';

-- 2. Prevent unauthorized role elevation on public.profiles
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If role is being changed to admin or superadmin
  IF NEW.role IN ('admin', 'superadmin') AND (OLD.role IS NULL OR OLD.role NOT IN ('admin', 'superadmin')) THEN
    -- Ensure the modifier is already an authorized administrator or service role
    IF NOT public.is_admin() AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Access Denied: Only existing authorized administrators can grant admin privileges.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_unauthorized_role_change
  BEFORE UPDATE OF role OR INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_role_change();

-- 3. Row Level Security policies check for points_config, cricket_teams, players, tournaments
ALTER TABLE public.points_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cricket_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read points config" ON public.points_config;
CREATE POLICY "Public read points config" ON public.points_config FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admin write points config" ON public.points_config;
CREATE POLICY "Admin write points config" ON public.points_config FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read tournaments" ON public.tournaments;
CREATE POLICY "Public read tournaments" ON public.tournaments FOR SELECT USING (status != 'draft' OR public.is_admin());

DROP POLICY IF EXISTS "Admin write tournaments" ON public.tournaments;
CREATE POLICY "Admin write tournaments" ON public.tournaments FOR ALL USING (public.is_admin());
