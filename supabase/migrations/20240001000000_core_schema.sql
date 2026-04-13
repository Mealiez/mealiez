-- ================================================
-- SECTION 1: EXTENSIONS
-- ================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================
-- SECTION 2: TENANTS TABLE
-- ================================================

CREATE TABLE public.tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text NOT NULL UNIQUE,
  plan          text NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
  is_active     boolean NOT NULL DEFAULT true,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT slug_lowercase_no_spaces CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_is_active ON public.tenants(is_active);

-- ================================================
-- SECTION 3: USERS TABLE
-- ================================================

CREATE TABLE public.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) 
                  ON DELETE RESTRICT,
  auth_id       uuid NOT NULL UNIQUE 
                  REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  full_name     text NOT NULL,
  phone         text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_users_auth_id ON public.users(auth_id);
CREATE INDEX idx_users_tenant_role ON public.users(tenant_id, role);

-- ================================================
-- SECTION 4: TENANT_FEATURES TABLE
-- ================================================

CREATE TABLE public.tenant_features (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) 
                  ON DELETE CASCADE,
  feature_key   text NOT NULL,
  is_enabled    boolean NOT NULL DEFAULT false,
  config        jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_tenant_feature 
    UNIQUE (tenant_id, feature_key),
  
  CONSTRAINT feature_key_allowed_values CHECK (feature_key IN (
    'meal_management', 'attendance_tracking', 
    'inventory_management', 'pre_meal_requests',
    'custom_reports', 'billing'
  ))
);

CREATE INDEX idx_tenant_features_tenant_id ON public.tenant_features(tenant_id);
CREATE INDEX idx_tenant_features_tenant_feature_key ON public.tenant_features(tenant_id, feature_key);

-- ================================================
-- SECTION 5: UPDATED_AT TRIGGER
-- ================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_tenant_features_updated_at
  BEFORE UPDATE ON public.tenant_features
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ================================================
-- SECTION 6: RLS ENABLE
-- ================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

-- ================================================
-- SECTION 7: STANDARD RLS POLICIES
-- ================================================

--- TENANTS TABLE POLICIES ---

CREATE POLICY "tenants_select_own_tenant"
ON public.tenants FOR SELECT
USING (id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenants_update_own_tenant"
ON public.tenants FOR UPDATE
USING (id = (auth.jwt() ->> 'tenant_id')::uuid)
WITH CHECK (id = (auth.jwt() ->> 'tenant_id')::uuid);

--- USERS TABLE POLICIES ---

CREATE POLICY "users_select_own_tenant"
ON public.users FOR SELECT
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "users_insert_own_tenant"
ON public.users FOR INSERT
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "users_update_own_tenant"
ON public.users FOR UPDATE
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "users_delete_own_tenant"
ON public.users FOR DELETE
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

--- TENANT_FEATURES TABLE POLICIES ---

CREATE POLICY "tenant_features_select_own_tenant"
ON public.tenant_features FOR SELECT
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_features_insert_own_tenant"
ON public.tenant_features FOR INSERT
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_features_update_own_tenant"
ON public.tenant_features FOR UPDATE
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_features_delete_own_tenant"
ON public.tenant_features FOR DELETE
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ================================================
-- SECTION 8: SEED: DEFAULT FEATURE FLAGS FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION public.seed_tenant_features(
  p_tenant_id uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.tenant_features 
    (tenant_id, feature_key, is_enabled)
  VALUES
    (p_tenant_id, 'meal_management',      true),
    (p_tenant_id, 'attendance_tracking',  true),
    (p_tenant_id, 'inventory_management', false),
    (p_tenant_id, 'pre_meal_requests',    false),
    (p_tenant_id, 'custom_reports',       false),
    (p_tenant_id, 'billing',              true)
  ON CONFLICT (tenant_id, feature_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
