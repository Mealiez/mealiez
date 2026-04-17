-- ====================================================
-- SECTION 1 — MEAL PLANS TABLE
-- ====================================================

CREATE TABLE public.meal_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL
                 REFERENCES public.tenants(id)
                 ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  is_active    boolean NOT NULL DEFAULT false,
  created_by   uuid NOT NULL
                 REFERENCES public.users(id)
                 ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT meal_plans_date_range_check
    CHECK (end_date >= start_date),

  CONSTRAINT meal_plans_name_length
    CHECK (char_length(name) >= 2)
);

-- Indexes
CREATE INDEX idx_meal_plans_tenant
  ON public.meal_plans(tenant_id);

CREATE INDEX idx_meal_plans_active
  ON public.meal_plans(tenant_id, is_active);

CREATE INDEX idx_meal_plans_dates
  ON public.meal_plans(tenant_id, start_date, end_date);

-- Only ONE active plan per tenant at a time
CREATE UNIQUE INDEX idx_meal_plans_one_active
  ON public.meal_plans(tenant_id)
  WHERE is_active = true;

-- ====================================================
-- SECTION 2 — MEAL PLAN ITEMS TABLE
-- ====================================================

CREATE TABLE public.meal_plan_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL
                 REFERENCES public.tenants(id)
                 ON DELETE CASCADE,
  plan_id      uuid NOT NULL
                 REFERENCES public.meal_plans(id)
                 ON DELETE CASCADE,
  meal_date    date NOT NULL,
  meal_type    text NOT NULL
                 CHECK (meal_type IN (
                   'breakfast','lunch','dinner','snack'
                 )),
  name         text NOT NULL,
  description  text,
  is_available boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Same meal_type cannot appear twice on same date
  -- within the same plan
  CONSTRAINT meal_plan_items_unique_slot
    UNIQUE (plan_id, meal_date, meal_type)
);

-- Indexes
CREATE INDEX idx_meal_plan_items_plan
  ON public.meal_plan_items(plan_id);

CREATE INDEX idx_meal_plan_items_tenant
  ON public.meal_plan_items(tenant_id);

CREATE INDEX idx_meal_plan_items_date
  ON public.meal_plan_items(tenant_id, meal_date);

CREATE INDEX idx_meal_plan_items_today
  ON public.meal_plan_items(tenant_id, meal_date, is_available);

-- ====================================================
-- SECTION 3 — UPDATED_AT TRIGGERS
-- ====================================================

CREATE TRIGGER meal_plans_updated_at
  BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER meal_plan_items_updated_at
  BEFORE UPDATE ON public.meal_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ====================================================
-- SECTION 4 — ENABLE RLS
-- ====================================================

ALTER TABLE public.meal_plans
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.meal_plan_items
  ENABLE ROW LEVEL SECURITY;

-- ====================================================
-- SECTION 5 — RLS POLICIES
-- ====================================================

--- MEAL PLANS ---

-- All tenant members can view plans
CREATE POLICY "meal_plans_select_own_tenant"
ON public.meal_plans FOR SELECT
USING (tenant_id = public.get_tenant_id());

-- Only manager and above can create plans
CREATE POLICY "meal_plans_insert_own_tenant"
ON public.meal_plans FOR INSERT
WITH CHECK (
  tenant_id = public.get_tenant_id()
  AND public.get_user_role() IN (
    'owner', 'admin', 'manager'
  )
);

-- Only manager and above can update plans
CREATE POLICY "meal_plans_update_own_tenant"
ON public.meal_plans FOR UPDATE
USING (tenant_id = public.get_tenant_id())
WITH CHECK (
  tenant_id = public.get_tenant_id()
  AND public.get_user_role() IN (
    'owner', 'admin', 'manager'
  )
);

-- Only admin and above can delete plans
CREATE POLICY "meal_plans_delete_own_tenant"
ON public.meal_plans FOR DELETE
USING (
  tenant_id = public.get_tenant_id()
  AND public.get_user_role() IN ('owner', 'admin')
);

--- MEAL PLAN ITEMS ---

CREATE POLICY "meal_plan_items_select_own_tenant"
ON public.meal_plan_items FOR SELECT
USING (tenant_id = public.get_tenant_id());

CREATE POLICY "meal_plan_items_insert_own_tenant"
ON public.meal_plan_items FOR INSERT
WITH CHECK (
  tenant_id = public.get_tenant_id()
  AND public.get_user_role() IN (
    'owner', 'admin', 'manager'
  )
);

CREATE POLICY "meal_plan_items_update_own_tenant"
ON public.meal_plan_items FOR UPDATE
USING (tenant_id = public.get_tenant_id())
WITH CHECK (
  tenant_id = public.get_tenant_id()
  AND public.get_user_role() IN (
    'owner', 'admin', 'manager'
  )
);

CREATE POLICY "meal_plan_items_delete_own_tenant"
ON public.meal_plan_items FOR DELETE
USING (
  tenant_id = public.get_tenant_id()
  AND public.get_user_role() IN (
    'owner', 'admin', 'manager'
  )
);

-- ====================================================
-- SECTION 6 — ACTIVATE PLAN FUNCTION
-- ====================================================

CREATE OR REPLACE FUNCTION public.activate_meal_plan(
  p_plan_id   uuid,
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deactivate all other plans for this tenant
  UPDATE public.meal_plans
  SET is_active = false
  WHERE tenant_id = p_tenant_id
    AND id != p_plan_id;

  -- Activate the target plan
  UPDATE public.meal_plans
  SET is_active = true
  WHERE id = p_plan_id
    AND tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_meal_plan
  TO authenticated;

-- ====================================================
-- SECTION 7 — TODAY'S MEALS HELPER FUNCTION
-- ====================================================

CREATE OR REPLACE FUNCTION public.get_todays_meals(
  p_tenant_id uuid
)
RETURNS TABLE (
  item_id      uuid,
  plan_id      uuid,
  plan_name    text,
  meal_type    text,
  name         text,
  description  text,
  is_available boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id          AS item_id,
    i.plan_id,
    p.name        AS plan_name,
    i.meal_type,
    i.name,
    i.description,
    i.is_available
  FROM public.meal_plan_items i
  JOIN public.meal_plans p
    ON p.id = i.plan_id
  WHERE i.tenant_id    = p_tenant_id
    AND p.is_active    = true
    AND i.meal_date    = CURRENT_DATE
    AND i.is_available = true
  ORDER BY
    CASE i.meal_type
      WHEN 'breakfast' THEN 1
      WHEN 'lunch'     THEN 2
      WHEN 'snack'     THEN 3
      WHEN 'dinner'    THEN 4
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_todays_meals
  TO authenticated;

-- ====================================================
-- SECTION 8 — FEATURE FLAG GATE FUNCTION
-- ====================================================

CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_tenant_id  uuid,
  p_feature    text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT is_enabled INTO v_enabled
  FROM public.tenant_features
  WHERE tenant_id  = p_tenant_id
    AND feature_key = p_feature;

  RETURN COALESCE(v_enabled, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled
  TO authenticated, service_role;
