-- Create analytics schema
CREATE SCHEMA IF NOT EXISTS analytics;

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create profile_metrics hypertable
CREATE TABLE analytics.profile_metrics (
  id BIGSERIAL,
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  profile_views INTEGER DEFAULT 0,
  search_appearances INTEGER DEFAULT 0,
  connections_count INTEGER DEFAULT 0,
  completeness_score NUMERIC(5,2) DEFAULT 0,
  skills_count INTEGER DEFAULT 0,
  endorsements_count INTEGER DEFAULT 0,
  recommendations_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  articles_count INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,4) DEFAULT 0,
  source VARCHAR(50) NOT NULL DEFAULT 'linkedin',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.profile_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- Create engagement_metrics hypertable
CREATE TABLE analytics.engagement_metrics (
  id BIGSERIAL,
  user_id UUID NOT NULL,
  content_id VARCHAR(255),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type VARCHAR(50) NOT NULL,
  value INTEGER NOT NULL DEFAULT 1,
  source VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.engagement_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- Create metric_aggregations hypertable for pre-computed aggregations
CREATE TABLE analytics.metric_aggregations (
  id BIGSERIAL,
  user_id UUID NOT NULL,
  interval_type VARCHAR(20) NOT NULL, -- 'minute', 'hour', 'day', 'week', 'month'
  timestamp TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL,
  source VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.metric_aggregations', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- Create alert_configs table (regular table, not hypertable)
CREATE TABLE analytics.alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  metric_type VARCHAR(100) NOT NULL,
  threshold NUMERIC(10,4) NOT NULL,
  condition VARCHAR(20) NOT NULL CHECK (condition IN ('above', 'below', 'change')),
  enabled BOOLEAN DEFAULT true,
  notification_methods JSONB DEFAULT '["websocket"]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_goals table (regular table)
CREATE TABLE analytics.user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_type VARCHAR(100) NOT NULL,
  target_value NUMERIC(10,4) NOT NULL,
  current_value NUMERIC(10,4) DEFAULT 0,
  deadline DATE,
  achieved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_profile_metrics_user_id_timestamp ON analytics.profile_metrics (user_id, timestamp DESC);
CREATE INDEX idx_profile_metrics_timestamp ON analytics.profile_metrics (timestamp DESC);
CREATE INDEX idx_profile_metrics_source ON analytics.profile_metrics (source);

CREATE INDEX idx_engagement_metrics_user_id_timestamp ON analytics.engagement_metrics (user_id, timestamp DESC);
CREATE INDEX idx_engagement_metrics_type ON analytics.engagement_metrics (type);
CREATE INDEX idx_engagement_metrics_content_id ON analytics.engagement_metrics (content_id);

CREATE INDEX idx_metric_aggregations_user_id_interval ON analytics.metric_aggregations (user_id, interval_type, timestamp DESC);
CREATE INDEX idx_metric_aggregations_timestamp ON analytics.metric_aggregations (timestamp DESC);

CREATE INDEX idx_alert_configs_user_id ON analytics.alert_configs (user_id);
CREATE INDEX idx_alert_configs_enabled ON analytics.alert_configs (enabled) WHERE enabled = true;

CREATE INDEX idx_user_goals_user_id ON analytics.user_goals (user_id);
CREATE INDEX idx_user_goals_achieved ON analytics.user_goals (achieved) WHERE achieved = false;

-- Create continuous aggregates for better performance
CREATE MATERIALIZED VIEW analytics.profile_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  time_bucket('1 hour', timestamp) AS hour,
  AVG(profile_views) as avg_profile_views,
  AVG(search_appearances) as avg_search_appearances,
  AVG(connections_count) as avg_connections_count,
  AVG(completeness_score) as avg_completeness_score,
  AVG(engagement_rate) as avg_engagement_rate,
  COUNT(*) as data_points
FROM analytics.profile_metrics
GROUP BY user_id, hour;

CREATE MATERIALIZED VIEW analytics.profile_metrics_daily
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  time_bucket('1 day', timestamp) AS day,
  AVG(profile_views) as avg_profile_views,
  AVG(search_appearances) as avg_search_appearances,
  AVG(connections_count) as avg_connections_count,
  AVG(completeness_score) as avg_completeness_score,
  AVG(engagement_rate) as avg_engagement_rate,
  COUNT(*) as data_points
FROM analytics.profile_metrics
GROUP BY user_id, day;

-- Add refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('analytics.profile_metrics_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('analytics.profile_metrics_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');

-- Add data retention policies
SELECT add_retention_policy('analytics.profile_metrics', INTERVAL '90 days');
SELECT add_retention_policy('analytics.engagement_metrics', INTERVAL '90 days');
SELECT add_retention_policy('analytics.metric_aggregations', INTERVAL '365 days');

-- Create functions for common queries
CREATE OR REPLACE FUNCTION analytics.get_user_latest_metrics(p_user_id UUID)
RETURNS SETOF analytics.profile_metrics AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM analytics.profile_metrics
  WHERE user_id = p_user_id
  ORDER BY timestamp DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION analytics.calculate_trend(
  p_user_id UUID,
  p_metric_name TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS NUMERIC AS $$
DECLARE
  current_value NUMERIC;
  previous_value NUMERIC;
  trend_value NUMERIC;
BEGIN
  -- Get current value (latest record)
  EXECUTE format('SELECT %I FROM analytics.profile_metrics 
                  WHERE user_id = $1 
                  ORDER BY timestamp DESC 
                  LIMIT 1', p_metric_name)
  INTO current_value
  USING p_user_id;
  
  -- Get previous value (record from p_days ago)
  EXECUTE format('SELECT %I FROM analytics.profile_metrics 
                  WHERE user_id = $1 
                  AND timestamp <= NOW() - INTERVAL ''%s days''
                  ORDER BY timestamp DESC 
                  LIMIT 1', p_metric_name, p_days)
  INTO previous_value
  USING p_user_id;
  
  -- Calculate trend percentage
  IF previous_value IS NULL OR previous_value = 0 THEN
    RETURN 0;
  END IF;
  
  trend_value := ((current_value - previous_value) / previous_value) * 100;
  RETURN ROUND(trend_value, 2);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (assuming we have an analytics_user role)
-- GRANT USAGE ON SCHEMA analytics TO analytics_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO analytics_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO analytics_user;