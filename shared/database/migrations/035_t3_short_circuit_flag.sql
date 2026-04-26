-- Sprint 8 T3: feature flag for short-circuit on high fraud score.
-- Default OFF; operator enables via UPDATE infra.feature_flags after
-- validating behavior in staging.
INSERT INTO infra.feature_flags (name, enabled, updated_by) VALUES
  ('T3_SHORT_CIRCUIT_ENABLED', false, 'sprint-8-t3-bootstrap')
ON CONFLICT (name) DO NOTHING;