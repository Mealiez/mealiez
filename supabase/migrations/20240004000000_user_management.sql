-- ================================================
-- SECTION 1: ROLE RANK HELPER FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION public.get_role_rank(
  p_role text
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'owner'   THEN 4
    WHEN 'admin'   THEN 3
    WHEN 'manager' THEN 2
    WHEN 'member'  THEN 1
    ELSE 0
  END
$$;

-- ================================================
-- SECTION 2: EMAIL CONFLICT CHECK FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION public.check_user_email_in_tenant(
  p_email     text,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN auth.users a ON a.id = u.auth_id
    WHERE a.email = p_email
      AND u.tenant_id = p_tenant_id
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_email_in_tenant
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_user_email_in_tenant
  FROM PUBLIC, anon, authenticated;

-- ================================================
-- SECTION 3: ROLE CHANGE AUDIT LOG TABLE
-- ================================================

CREATE TABLE public.user_role_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL 
                  REFERENCES public.tenants(id) 
                  ON DELETE CASCADE,
  target_user_id uuid NOT NULL
                  REFERENCES public.users(id)
                  ON DELETE CASCADE,
  changed_by_id  uuid NOT NULL
                  REFERENCES public.users(id)
                  ON DELETE CASCADE,
  old_role       text NOT NULL,
  new_role       text NOT NULL,
  changed_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_role_audit_tenant 
  ON public.user_role_audit(tenant_id);
CREATE INDEX idx_role_audit_target 
  ON public.user_role_audit(target_user_id);
CREATE INDEX idx_role_audit_changed_at
  ON public.user_role_audit(changed_at DESC);

-- Enable RLS
ALTER TABLE public.user_role_audit 
  ENABLE ROW LEVEL SECURITY;

-- RLS: standard tenant policy (read-only for tenant)
CREATE POLICY "role_audit_select_own_tenant"
ON public.user_role_audit FOR SELECT
USING (tenant_id = public.get_tenant_id());

-- ================================================
-- SECTION 4: METADATA REPAIR FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION public.repair_user_metadata(
  p_auth_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user
  FROM public.users
  WHERE auth_id = p_auth_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_auth_id;
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', v_user.tenant_id,
    'role',      v_user.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_user_metadata
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.repair_user_metadata
  FROM PUBLIC, anon, authenticated;
