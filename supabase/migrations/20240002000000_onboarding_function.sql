-- ================================================
-- SECTION 1: ATOMIC ONBOARDING FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION public.onboard_new_tenant(
  p_auth_id     uuid,
  p_full_name   text,
  p_org_name    text,
  p_plan        text DEFAULT 'free'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id   uuid;
  v_user_id     uuid;
  v_slug        text;
BEGIN

  -- STEP 1: Generate unique slug from org name
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]', '-', 'g'));
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  -- Append random suffix to guarantee uniqueness
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  -- STEP 2: Create tenant
  INSERT INTO public.tenants (name, slug, plan)
  VALUES (p_org_name, v_slug, p_plan)
  RETURNING id INTO v_tenant_id;

  -- STEP 3: Create user linked to tenant
  INSERT INTO public.users (tenant_id, auth_id, full_name, role)
  VALUES (v_tenant_id, p_auth_id, p_full_name, 'owner')
  RETURNING id INTO v_user_id;

  -- STEP 4: Seed default feature flags
  PERFORM public.seed_tenant_features(v_tenant_id);

  -- STEP 5: Return result for API route to use
  RETURN jsonb_build_object(
    'tenant_id',  v_tenant_id,
    'user_id',    v_user_id,
    'slug',       v_slug,
    'role',       'owner'
  );

EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Onboarding failed: %', SQLERRM;
END;
$$;

-- ================================================
-- SECTION 2: GRANT EXECUTE
-- ================================================

-- Only service role can call this function
-- Revoke from public and anon, grant to service_role

REVOKE EXECUTE ON FUNCTION public.onboard_new_tenant 
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.onboard_new_tenant 
  TO service_role;
