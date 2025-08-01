-- Migration: 002_product_analytics_schema
-- Created: 2024-08-01
-- Description: Comprehensive product analytics schema for InErgize SaaS platform

-- ================================
-- PRODUCT ANALYTICS ENUMS
-- ================================

DO $$ 
BEGIN
  -- User behavior event types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserEventType') THEN
    CREATE TYPE "UserEventType" AS ENUM (
      'PAGE_VIEW', 'FEATURE_CLICK', 'FORM_SUBMIT', 'BUTTON_CLICK', 
      'MODAL_OPEN', 'MODAL_CLOSE', 'TAB_SWITCH', 'SEARCH', 'FILTER',
      'EXPORT', 'IMPORT', 'SHARE', 'SAVE', 'DELETE', 'EDIT'
    );
  END IF;
  
  -- Onboarding stages
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnboardingStage') THEN
    CREATE TYPE "OnboardingStage" AS ENUM (
      'SIGNUP', 'EMAIL_VERIFICATION', 'PROFILE_SETUP', 'LINKEDIN_CONNECT',
      'FIRST_CONTENT_CREATE', 'FIRST_AUTOMATION_SETUP', 'FIRST_ANALYTICS_VIEW',
      'UPGRADE_PROMPT', 'COMPLETED'
    );
  END IF;
  
  -- Feature categories
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeatureCategory') THEN
    CREATE TYPE "FeatureCategory" AS ENUM (
      'PROFILE_OPTIMIZATION', 'CONTENT_CREATION', 'AUTOMATION', 'ANALYTICS',
      'NETWORKING', 'AI_TOOLS', 'INTEGRATIONS', 'COLLABORATION', 'EXPORT'
    );
  END IF;
  
  -- Churn risk levels
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChurnRiskLevel') THEN
    CREATE TYPE "ChurnRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
  
  -- A/B test status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExperimentStatus') THEN
    CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
  END IF;
  
  -- Revenue event types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevenueEventType') THEN
    CREATE TYPE "RevenueEventType" AS ENUM (
      'SUBSCRIPTION_START', 'SUBSCRIPTION_RENEWAL', 'SUBSCRIPTION_UPGRADE', 
      'SUBSCRIPTION_DOWNGRADE', 'SUBSCRIPTION_CANCEL', 'REFUND', 'CHARGEBACK'
    );
  END IF;
END $$;

-- ================================
-- USER BEHAVIOR ANALYTICS
-- ================================

-- User behavior events tracking
CREATE TABLE IF NOT EXISTS analytics.user_behavior_events (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  event_type "UserEventType" NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  page_url TEXT,
  feature_name VARCHAR(100),
  element_id VARCHAR(100),
  element_class VARCHAR(100),
  event_data JSONB,
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.user_behavior_events', 'timestamp', if_not_exists => TRUE);

-- User sessions tracking
CREATE TABLE IF NOT EXISTS analytics.user_sessions (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  page_views INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  device_type VARCHAR(50),
  browser VARCHAR(50),
  os VARCHAR(50),
  country VARCHAR(2),
  city VARCHAR(100),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.user_sessions', 'timestamp', if_not_exists => TRUE);

-- ================================
-- FEATURE ADOPTION ANALYTICS
-- ================================

-- Feature usage tracking
CREATE TABLE IF NOT EXISTS analytics.feature_usage (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  feature_category "FeatureCategory" NOT NULL,
  usage_count INTEGER DEFAULT 1,
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_time_spent_seconds INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.feature_usage', 'timestamp', if_not_exists => TRUE);

-- Onboarding funnel tracking
CREATE TABLE IF NOT EXISTS analytics.onboarding_funnel (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  stage "OnboardingStage" NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_to_complete_seconds INTEGER,
  abandoned BOOLEAN DEFAULT FALSE,
  abandonment_reason TEXT,
  conversion_data JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.onboarding_funnel', 'timestamp', if_not_exists => TRUE);

-- Feature discovery analytics
CREATE TABLE IF NOT EXISTS analytics.feature_discovery (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  discovered_through VARCHAR(100) NOT NULL, -- tooltip, menu, notification, etc.
  discovery_context JSONB,
  used_immediately BOOLEAN DEFAULT FALSE,
  days_until_first_use INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.feature_discovery', 'timestamp', if_not_exists => TRUE);

-- ================================
-- AUTOMATION ANALYTICS ENHANCED
-- ================================

-- Detailed automation performance tracking
CREATE TABLE IF NOT EXISTS analytics.automation_performance (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  automation_rule_id TEXT NOT NULL,
  automation_type "AutomationType" NOT NULL,
  execution_id VARCHAR(100) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  actions_attempted INTEGER DEFAULT 0,
  actions_successful INTEGER DEFAULT 0,
  actions_failed INTEGER DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0,
  safety_score NUMERIC(3,2), -- 0.00 to 1.00
  compliance_violations INTEGER DEFAULT 0,
  error_details JSONB,
  performance_metrics JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.automation_performance', 'timestamp', if_not_exists => TRUE);

-- Safety compliance tracking
CREATE TABLE IF NOT EXISTS analytics.safety_compliance (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  automation_rule_id TEXT,
  safety_check_type VARCHAR(100) NOT NULL,
  check_result VARCHAR(50) NOT NULL, -- PASS, FAIL, WARNING
  severity VARCHAR(20), -- LOW, MEDIUM, HIGH, CRITICAL
  details JSONB,
  action_taken VARCHAR(100),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.safety_compliance', 'timestamp', if_not_exists => TRUE);

-- ================================
-- CHURN PREDICTION & RETENTION
-- ================================

-- User engagement scores
CREATE TABLE IF NOT EXISTS analytics.user_engagement_scores (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL,
  feature_usage_score NUMERIC(5,2),
  automation_usage_score NUMERIC(5,2),
  content_creation_score NUMERIC(5,2),
  analytics_engagement_score NUMERIC(5,2),
  social_engagement_score NUMERIC(5,2),
  days_since_last_login INTEGER,
  login_frequency_score NUMERIC(5,2),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.user_engagement_scores', 'timestamp', if_not_exists => TRUE);

-- Churn prediction scores
CREATE TABLE IF NOT EXISTS analytics.churn_predictions (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  churn_risk_score NUMERIC(5,4) NOT NULL, -- 0.0000 to 1.0000
  churn_risk_level "ChurnRiskLevel" NOT NULL,
  predicted_churn_date TIMESTAMPTZ,
  confidence_score NUMERIC(5,4),
  contributing_factors JSONB,
  recommended_interventions JSONB,
  model_version VARCHAR(50),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.churn_predictions', 'timestamp', if_not_exists => TRUE);

-- ================================
-- A/B TESTING FRAMEWORK
-- ================================

-- A/B test experiments
CREATE TABLE IF NOT EXISTS analytics.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  hypothesis TEXT,
  status "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
  feature_flag VARCHAR(100) NOT NULL,
  traffic_allocation NUMERIC(3,2) NOT NULL DEFAULT 0.50, -- 0.00 to 1.00
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  target_sample_size INTEGER,
  success_metric VARCHAR(100) NOT NULL,
  secondary_metrics TEXT[],
  statistical_significance NUMERIC(5,4),
  confidence_level NUMERIC(3,2) DEFAULT 0.95,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Experiment variants
CREATE TABLE IF NOT EXISTS analytics.experiment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES analytics.experiments(id) ON DELETE CASCADE,
  variant_name VARCHAR(100) NOT NULL,
  variant_description TEXT,
  traffic_weight NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  configuration JSONB,
  is_control BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User experiment assignments
CREATE TABLE IF NOT EXISTS analytics.user_experiment_assignments (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  experiment_id UUID NOT NULL REFERENCES analytics.experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES analytics.experiment_variants(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.user_experiment_assignments', 'timestamp', if_not_exists => TRUE);

-- Experiment results tracking
CREATE TABLE IF NOT EXISTS analytics.experiment_results (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  experiment_id UUID NOT NULL REFERENCES analytics.experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES analytics.experiment_variants(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  conversion_event BOOLEAN DEFAULT FALSE,
  event_data JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.experiment_results', 'timestamp', if_not_exists => TRUE);

-- ================================
-- REVENUE ANALYTICS
-- ================================

-- Revenue events tracking
CREATE TABLE IF NOT EXISTS analytics.revenue_events (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type "RevenueEventType" NOT NULL,
  subscription_tier_from "SubscriptionTier",
  subscription_tier_to "SubscriptionTier",
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  billing_period_months INTEGER,
  payment_method VARCHAR(50),
  payment_processor VARCHAR(50),
  transaction_id VARCHAR(200),
  invoice_id VARCHAR(200),
  coupon_code VARCHAR(100),
  discount_amount_cents INTEGER DEFAULT 0,
  tax_amount_cents INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.revenue_events', 'timestamp', if_not_exists => TRUE);

-- User cohorts for retention analysis
CREATE TABLE IF NOT EXISTS analytics.user_cohorts (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  cohort_month DATE NOT NULL, -- First day of the month they signed up
  acquisition_channel VARCHAR(100),
  initial_subscription_tier "SubscriptionTier" NOT NULL,
  first_payment_at TIMESTAMPTZ,
  ltv_predicted NUMERIC(10,2),
  ltv_actual NUMERIC(10,2) DEFAULT 0,
  months_retained INTEGER DEFAULT 0,
  is_churned BOOLEAN DEFAULT FALSE,
  churned_at TIMESTAMPTZ,
  churn_reason VARCHAR(200),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.user_cohorts', 'timestamp', if_not_exists => TRUE);

-- Subscription metrics
CREATE TABLE IF NOT EXISTS analytics.subscription_metrics (
  id UUID DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  subscription_tier "SubscriptionTier" NOT NULL,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions INTEGER NOT NULL DEFAULT 0,
  cancelled_subscriptions INTEGER NOT NULL DEFAULT 0,
  upgraded_subscriptions INTEGER NOT NULL DEFAULT 0,
  downgraded_subscriptions INTEGER NOT NULL DEFAULT 0,
  mrr_cents INTEGER NOT NULL DEFAULT 0, -- Monthly Recurring Revenue
  arr_cents INTEGER NOT NULL DEFAULT 0, -- Annual Recurring Revenue
  churn_rate NUMERIC(5,4) DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.subscription_metrics', 'timestamp', if_not_exists => TRUE);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- User behavior indexes
CREATE INDEX IF NOT EXISTS idx_user_behavior_user_session_timestamp 
ON analytics.user_behavior_events (user_id, session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_user_behavior_event_type_timestamp 
ON analytics.user_behavior_events (event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_started 
ON analytics.user_sessions (user_id, started_at DESC);

-- Feature adoption indexes
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_feature_timestamp 
ON analytics.feature_usage (user_id, feature_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_funnel_user_stage 
ON analytics.onboarding_funnel (user_id, stage, started_at DESC);

-- Automation analytics indexes
CREATE INDEX IF NOT EXISTS idx_automation_performance_user_rule_timestamp 
ON analytics.automation_performance (user_id, automation_rule_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_safety_compliance_user_timestamp 
ON analytics.safety_compliance (user_id, timestamp DESC);

-- Churn prediction indexes
CREATE INDEX IF NOT EXISTS idx_engagement_scores_user_timestamp 
ON analytics.user_engagement_scores (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_churn_predictions_user_risk_timestamp 
ON analytics.churn_predictions (user_id, churn_risk_level, timestamp DESC);

-- A/B testing indexes
CREATE INDEX IF NOT EXISTS idx_user_experiment_assignments_user_experiment 
ON analytics.user_experiment_assignments (user_id, experiment_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment_variant_timestamp 
ON analytics.experiment_results (experiment_id, variant_id, timestamp DESC);

-- Revenue analytics indexes
CREATE INDEX IF NOT EXISTS idx_revenue_events_user_type_timestamp 
ON analytics.revenue_events (user_id, event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_user_cohorts_cohort_month 
ON analytics.user_cohorts (cohort_month, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_metrics_date_tier 
ON analytics.subscription_metrics (date DESC, subscription_tier);

-- ================================
-- CONTINUOUS AGGREGATES
-- ================================

-- Daily user behavior summary
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.daily_user_behavior
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  time_bucket('1 day', timestamp) AS day,
  COUNT(*) as total_events,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT event_type) as unique_event_types,
  AVG(CASE WHEN event_type = 'PAGE_VIEW' THEN 1 ELSE 0 END) as avg_page_views
FROM analytics.user_behavior_events
GROUP BY user_id, day;

-- Weekly feature adoption rates
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.weekly_feature_adoption
WITH (timescaledb.continuous) AS
SELECT 
  feature_name,
  feature_category,
  time_bucket('1 week', timestamp) AS week,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(usage_count) as total_usage,
  AVG(total_time_spent_seconds) as avg_time_spent
FROM analytics.feature_usage
GROUP BY feature_name, feature_category, week;

-- Daily automation success rates
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.daily_automation_success
WITH (timescaledb.continuous) AS
SELECT 
  automation_type,
  time_bucket('1 day', timestamp) AS day,
  COUNT(*) as total_executions,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_executions,
  ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate,
  AVG(safety_score) as avg_safety_score,
  SUM(compliance_violations) as total_violations
FROM analytics.automation_performance
GROUP BY automation_type, day;

-- Monthly revenue metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.monthly_revenue_summary
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 month', timestamp) AS month,
  subscription_tier_to as subscription_tier,
  event_type,
  COUNT(*) as event_count,
  SUM(amount_cents) as total_revenue_cents,
  AVG(amount_cents) as avg_revenue_cents
FROM analytics.revenue_events
WHERE event_type IN ('SUBSCRIPTION_START', 'SUBSCRIPTION_RENEWAL', 'SUBSCRIPTION_UPGRADE')
GROUP BY month, subscription_tier, event_type;

-- ================================
-- RETENTION POLICIES
-- ================================

-- User behavior data (1 year retention)
SELECT add_retention_policy('analytics.user_behavior_events', INTERVAL '365 days');
SELECT add_retention_policy('analytics.user_sessions', INTERVAL '365 days');

-- Feature adoption data (2 years retention for product insights)
SELECT add_retention_policy('analytics.feature_usage', INTERVAL '730 days');
SELECT add_retention_policy('analytics.onboarding_funnel', INTERVAL '730 days');
SELECT add_retention_policy('analytics.feature_discovery', INTERVAL '365 days');

-- Automation data (1 year retention)
SELECT add_retention_policy('analytics.automation_performance', INTERVAL '365 days');
SELECT add_retention_policy('analytics.safety_compliance', INTERVAL '365 days');

-- ML and prediction data (6 months retention)
SELECT add_retention_policy('analytics.user_engagement_scores', INTERVAL '180 days');
SELECT add_retention_policy('analytics.churn_predictions', INTERVAL '180 days');

-- A/B testing data (1 year retention)
SELECT add_retention_policy('analytics.user_experiment_assignments', INTERVAL '365 days');
SELECT add_retention_policy('analytics.experiment_results', INTERVAL '365 days');

-- Revenue data (7 years retention for accounting)
SELECT add_retention_policy('analytics.revenue_events', INTERVAL '2555 days');
SELECT add_retention_policy('analytics.user_cohorts', INTERVAL '2555 days');
SELECT add_retention_policy('analytics.subscription_metrics', INTERVAL '2555 days');

-- ================================
-- COMPRESSION POLICIES
-- ================================

-- Compress data older than 7 days for most tables
SELECT add_compression_policy('analytics.user_behavior_events', INTERVAL '7 days');
SELECT add_compression_policy('analytics.user_sessions', INTERVAL '7 days');
SELECT add_compression_policy('analytics.feature_usage', INTERVAL '7 days');
SELECT add_compression_policy('analytics.onboarding_funnel', INTERVAL '7 days');
SELECT add_compression_policy('analytics.feature_discovery', INTERVAL '7 days');
SELECT add_compression_policy('analytics.automation_performance', INTERVAL '7 days');
SELECT add_compression_policy('analytics.safety_compliance', INTERVAL '7 days');
SELECT add_compression_policy('analytics.user_engagement_scores', INTERVAL '3 days');
SELECT add_compression_policy('analytics.churn_predictions', INTERVAL '3 days');
SELECT add_compression_policy('analytics.user_experiment_assignments', INTERVAL '7 days');
SELECT add_compression_policy('analytics.experiment_results', INTERVAL '7 days');
SELECT add_compression_policy('analytics.revenue_events', INTERVAL '30 days');
SELECT add_compression_policy('analytics.user_cohorts', INTERVAL '30 days');
SELECT add_compression_policy('analytics.subscription_metrics', INTERVAL '30 days');

-- ================================
-- CONTINUOUS AGGREGATE POLICIES
-- ================================

-- Refresh policies for materialized views
SELECT add_continuous_aggregate_policy('analytics.daily_user_behavior',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('analytics.weekly_feature_adoption',
  start_offset => INTERVAL '7 days',
  end_offset => INTERVAL '2 hours',
  schedule_interval => INTERVAL '2 hours');

SELECT add_continuous_aggregate_policy('analytics.daily_automation_success',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('analytics.monthly_revenue_summary',
  start_offset => INTERVAL '2 months',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');

-- Grant permissions
GRANT USAGE ON SCHEMA analytics TO inergize_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA analytics TO inergize_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO inergize_user;