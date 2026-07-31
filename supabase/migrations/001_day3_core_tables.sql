-- =============================================================================
-- Manas Day 3 Core Tables Migration
-- Version: 001
-- Description: Creates 6 core tables with RLS enabled
-- =============================================================================

-- Enable UUID extension (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. PROFILES
-- =============================================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'clinician', 'admin')) DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- =============================================================================
-- 2. CHECK_IN_SESSIONS
-- =============================================================================
CREATE TABLE check_in_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  mode TEXT NOT NULL,
  language TEXT NOT NULL,
  status TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  structured_summary JSONB
);

ALTER TABLE check_in_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_in_sessions_all_own"
  ON check_in_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_check_in_sessions_user_id ON check_in_sessions(user_id);

-- =============================================================================
-- 3. SAFETY_ASSESSMENTS
-- =============================================================================
CREATE TABLE safety_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES check_in_sessions(id),
  pre_gen_result JSONB,
  post_gen_result JSONB,
  routing_state TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE safety_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "safety_assessments_select_own"
  ON safety_assessments FOR SELECT
  USING (session_id IN (SELECT id FROM check_in_sessions WHERE user_id = auth.uid()));

CREATE INDEX idx_safety_assessments_session_id ON safety_assessments(session_id);

-- =============================================================================
-- 4. PROVIDERS
-- =============================================================================
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  languages TEXT[] NOT NULL DEFAULT '{}',
  focus_areas TEXT[] NOT NULL DEFAULT '{}',
  availability TEXT NOT NULL,
  session_type TEXT NOT NULL,
  price_range TEXT NOT NULL,
  bio TEXT NOT NULL,
  is_fictional_demo BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Public read — fictional demo data, no auth check required
CREATE POLICY "providers_select_public"
  ON providers FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for regular users (admin/service_role only)

-- =============================================================================
-- 5. HANDOFFS
-- =============================================================================
CREATE TABLE handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  provider_id UUID NOT NULL REFERENCES providers(id),
  status TEXT NOT NULL,
  structured_summary JSONB NOT NULL,
  excluded_entries TEXT[] NOT NULL DEFAULT '{}',
  user_note TEXT,
  version INT NOT NULL DEFAULT 1,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "handoffs_all_own"
  ON handoffs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_handoffs_user_id ON handoffs(user_id);

-- =============================================================================
-- 6. AUDIT_EVENTS
-- =============================================================================
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id TEXT,
  user_id UUID,
  actor TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB,
  policy_version TEXT,
  model_version TEXT,
  prompt_version TEXT
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit events
CREATE POLICY "audit_events_select_own"
  ON audit_events FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT only via service_role (no user-facing INSERT policy)

CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
