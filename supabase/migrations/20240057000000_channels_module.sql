/*
 * PRD: Channel Management Module
 * Enterprise-grade GPS/Geofence based channel attendance.
 */

-- ====================================================
-- SECTION 1 — EXTENSIONS
-- ====================================================

-- Ensure PostGIS is available for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ====================================================
-- SECTION 2 — UPDATE ALLOWED FEATURES
-- ====================================================

ALTER TABLE public.tenant_features
  DROP CONSTRAINT IF EXISTS feature_key_allowed_values;

ALTER TABLE public.tenant_features
  ADD CONSTRAINT feature_key_allowed_values CHECK (feature_key IN (
    'meal_management', 'attendance_tracking', 
    'inventory_management', 'pre_meal_requests',
    'custom_reports', 'billing', 'branch_management',
    'settings_module', 'channel_attendance'
  ));

-- ====================================================
-- SECTION 3 — CHANNELS TABLE
-- ====================================================

CREATE TABLE public.channels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_name    text, -- Optional logical grouping since no explicit projects table exists
  name            text NOT NULL,
  code            text NOT NULL, -- unique per tenant
  description     text,
  geometry_type   text NOT NULL CHECK (geometry_type IN ('POINT_RADIUS', 'POLYGON')),
  latitude        numeric,
  longitude       numeric,
  radius          numeric, -- in meters
  geometry        extensions.geometry(Geometry, 4326),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_channel_code_per_tenant UNIQUE (tenant_id, code),
  CONSTRAINT channel_name_length CHECK (char_length(name) >= 2)
);

CREATE INDEX idx_channels_tenant ON public.channels(tenant_id);
CREATE INDEX idx_channels_is_active ON public.channels(tenant_id, is_active);
CREATE INDEX idx_channels_geom ON public.channels USING GIST (geometry);

-- Trigger for updated_at
CREATE TRIGGER trigger_channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_select"
ON public.channels FOR SELECT
USING (tenant_id = public.get_tenant_id());

CREATE POLICY "channels_insert"
ON public.channels FOR INSERT
WITH CHECK (
  tenant_id = public.get_tenant_id()
  AND public.get_user_role() IN ('owner', 'admin')
);

CREATE POLICY "channels_update"
ON public.channels FOR UPDATE
USING (tenant_id = public.get_tenant_id())
WITH CHECK (
  tenant_id = public.get_tenant_id()
  AND public.get_user_role() IN ('owner', 'admin')
);

CREATE POLICY "channels_delete"
ON public.channels FOR DELETE
USING (
  tenant_id = public.get_tenant_id()
  AND public.get_user_role() IN ('owner', 'admin')
);

-- ====================================================
-- SECTION 4 — EXTEND EXISTING TABLES
-- ====================================================

-- 1. Users
ALTER TABLE public.users
  ADD COLUMN channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL;

CREATE INDEX idx_users_channel ON public.users(channel_id);

-- 2. Attendance Sessions
ALTER TABLE public.attendance_sessions
  ADD COLUMN attendance_mode text NOT NULL DEFAULT 'BRANCH' CHECK (attendance_mode IN ('BRANCH', 'CHANNEL')),
  ADD COLUMN project_name text;

CREATE INDEX idx_att_sessions_mode ON public.attendance_sessions(attendance_mode);

-- 3. Attendance Records
ALTER TABLE public.attendance_records
  ADD COLUMN attendance_mode text DEFAULT 'BRANCH' CHECK (attendance_mode IN ('BRANCH', 'CHANNEL')),
  ADD COLUMN assigned_channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  ADD COLUMN detected_channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  ADD COLUMN latitude numeric,
  ADD COLUMN longitude numeric,
  ADD COLUMN gps_accuracy numeric,
  ADD COLUMN location_source text CHECK (location_source IN ('BRANCH_ASSIGNMENT', 'GPS_GEOFENCE', 'ASSIGNED_CHANNEL', 'ADMIN_OVERRIDE')),
  ADD COLUMN verification_status text CHECK (verification_status IN ('VERIFIED', 'CHANNEL_MISMATCH', 'LOCATION_UNAVAILABLE', 'LOW_ACCURACY', 'FALLBACK', 'OVERRIDE', 'REJECTED')),
  ADD COLUMN location_timestamp timestamptz;

-- ====================================================
-- SECTION 5 — BACKFILL & DEFAULT DATA
-- ====================================================

INSERT INTO public.tenant_features (tenant_id, feature_key, is_enabled)
SELECT id, 'channel_attendance', false
FROM public.tenants
ON CONFLICT (tenant_id, feature_key) DO NOTHING;

-- Update get_session_attendance_summary function to include new fields
DROP FUNCTION IF EXISTS public.get_session_attendance_summary(uuid);

CREATE OR REPLACE FUNCTION
public.get_session_attendance_summary(
  p_session_id uuid
)
RETURNS TABLE (
  session_id    uuid,
  session_label text,
  session_date  date,
  meal_type     text,
  attendance_mode text,
  total_count   bigint,
  records       jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id            AS session_id,
    s.label         AS session_label,
    s.session_date,
    s.meal_type,
    s.attendance_mode,
    COUNT(r.id)     AS total_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'record_id',  r.id,
          'user_id',    r.user_id,
          'full_name',  u.full_name,
          'marked_at',  r.marked_at,
          'method',     r.method,
          'attendance_mode', r.attendance_mode,
          'verification_status', r.verification_status,
          'assigned_channel_id', r.assigned_channel_id,
          'detected_channel_id', r.detected_channel_id
        )
        ORDER BY r.marked_at ASC
      ) FILTER (WHERE r.id IS NOT NULL),
      '[]'::jsonb
    )               AS records
  FROM public.attendance_sessions s
  LEFT JOIN public.attendance_records r
    ON r.session_id = s.id
  LEFT JOIN public.users u
    ON u.id = r.user_id
  WHERE s.id = p_session_id
  GROUP BY s.id, s.label, s.session_date, s.meal_type, s.attendance_mode;
END;
$$;

-- ====================================================
-- SECTION 6 — GPS LOCATION RPC
-- ====================================================

CREATE OR REPLACE FUNCTION public.detect_channel(
  p_tenant_id uuid,
  p_project_name text,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy numeric
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_point extensions.geometry;
  v_channel_id uuid;
BEGIN
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326);

  SELECT id INTO v_channel_id
  FROM public.channels
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND (p_project_name IS NULL OR project_name = p_project_name)
    AND (
      (geometry_type = 'POLYGON' AND extensions.st_contains(geometry, v_point))
      OR
      (geometry_type = 'POINT_RADIUS' AND extensions.st_dwithin(geometry::extensions.geography, v_point::extensions.geography, radius))
    )
  LIMIT 1;

  RETURN v_channel_id;
END;
$$;

