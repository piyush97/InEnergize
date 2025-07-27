-- Enhanced TimescaleDB Analytics Pipeline Setup
-- This migration creates optimized hypertables, continuous aggregates, and performance features

-- Create analytics schema if not exists
CREATE SCHEMA IF NOT EXISTS analytics;

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create enhanced profile_metrics hypertable with partitioning optimization
DROP TABLE IF EXISTS analytics.profile_metrics CASCADE;
CREATE TABLE analytics.profile_metrics (
  id BIGSERIAL,
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Core LinkedIn metrics
  profile_views INTEGER DEFAULT 0,
  search_appearances INTEGER DEFAULT 0,
  connections_count INTEGER DEFAULT 0,
  completeness_score NUMERIC(5,2) DEFAULT 0,
  skills_count INTEGER DEFAULT 0,
  endorsements_count INTEGER DEFAULT 0,
  recommendations_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  articles_count INTEGER DEFAULT 0,
  
  -- Engagement metrics
  engagement_rate NUMERIC(5,4) DEFAULT 0,
  likes_received INTEGER DEFAULT 0,
  comments_received INTEGER DEFAULT 0,
  shares_received INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  
  -- Advanced metrics
  industry_rank INTEGER DEFAULT 0,
  network_growth_rate NUMERIC(5,4) DEFAULT 0,
  content_engagement_score NUMERIC(8,4) DEFAULT 0,
  influence_score NUMERIC(8,4) DEFAULT 0,
  
  -- Meta information
  source VARCHAR(50) NOT NULL DEFAULT 'linkedin',
  data_quality_score NUMERIC(3,2) DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable with optimized chunk interval
SELECT create_hypertable(
  'analytics.profile_metrics', 
  'timestamp', 
  chunk_time_interval => INTERVAL '6 hours',
  if_not_exists => TRUE
);

-- Create space partitioning for better performance with large user bases
SELECT add_dimension(
  'analytics.profile_metrics',
  'user_id',
  number_partitions => 4,
  if_not_exists => TRUE
);

-- Enhanced engagement_metrics hypertable
DROP TABLE IF EXISTS analytics.engagement_metrics CASCADE;
CREATE TABLE analytics.engagement_metrics (
  id BIGSERIAL,
  user_id UUID NOT NULL,
  content_id VARCHAR(255),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Engagement details
  type VARCHAR(50) NOT NULL,
  value INTEGER NOT NULL DEFAULT 1,
  content_type VARCHAR(50),
  industry_category VARCHAR(100),
  
  -- Context information
  device_type VARCHAR(50),
  referrer_source VARCHAR(100),
  geographic_region VARCHAR(100),
  
  -- Source and metadata
  source VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable(
  'analytics.engagement_metrics', 
  'timestamp', 
  chunk_time_interval => INTERVAL '6 hours',
  if_not_exists => TRUE
);

-- Add space partitioning
SELECT add_dimension(
  'analytics.engagement_metrics',
  'user_id',
  number_partitions => 4,
  if_not_exists => TRUE
);

-- Create real_time_events table for live dashboard updates
CREATE TABLE analytics.real_time_events (
  id BIGSERIAL,
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable with smaller chunks for real-time processing
SELECT create_hypertable(
  'analytics.real_time_events', 
  'timestamp', 
  chunk_time_interval => INTERVAL '2 hours',
  if_not_exists => TRUE
);

-- Enhanced metric_aggregations table
DROP TABLE IF EXISTS analytics.metric_aggregations CASCADE;
CREATE TABLE analytics.metric_aggregations (
  id BIGSERIAL,
  user_id UUID NOT NULL,
  interval_type VARCHAR(20) NOT NULL, -- 'minute', 'hour', 'day', 'week', 'month'
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Aggregated metrics
  metrics JSONB NOT NULL,
  calculated_scores JSONB DEFAULT '{}',
  trend_indicators JSONB DEFAULT '{}',
  
  -- Quality and source tracking
  source VARCHAR(50) NOT NULL,
  data_points_count INTEGER DEFAULT 0,
  confidence_score NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable(
  'analytics.metric_aggregations', 
  'timestamp', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Create alert_configs table with enhanced features
DROP TABLE IF EXISTS analytics.alert_configs CASCADE;
CREATE TABLE analytics.alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  alert_name VARCHAR(255) NOT NULL,
  metric_type VARCHAR(100) NOT NULL,
  
  -- Alert conditions
  threshold NUMERIC(10,4) NOT NULL,
  condition VARCHAR(20) NOT NULL CHECK (condition IN ('above', 'below', 'change', 'trend')),
  comparison_period INTERVAL DEFAULT INTERVAL '1 day',
  
  -- Notification settings
  enabled BOOLEAN DEFAULT true,
  notification_methods JSONB DEFAULT '["websocket"]',
  notification_frequency VARCHAR(50) DEFAULT 'immediate',
  quiet_hours JSONB DEFAULT '{}',
  
  -- Alert metadata
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  category VARCHAR(50) DEFAULT 'general',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create alert_history table for tracking alerts
CREATE TABLE analytics.alert_history (
  id BIGSERIAL,
  alert_config_id UUID NOT NULL REFERENCES analytics.alert_configs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Alert details
  metric_value NUMERIC(10,4) NOT NULL,
  threshold_value NUMERIC(10,4) NOT NULL,
  condition_met VARCHAR(20) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  
  -- Notification tracking
  notifications_sent JSONB DEFAULT '[]',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable(
  'analytics.alert_history', 
  'timestamp', 
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Enhanced user_goals table
DROP TABLE IF EXISTS analytics.user_goals CASCADE;
CREATE TABLE analytics.user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_name VARCHAR(255) NOT NULL,
  goal_type VARCHAR(100) NOT NULL,
  
  -- Goal targets
  target_value NUMERIC(10,4) NOT NULL,
  current_value NUMERIC(10,4) DEFAULT 0,
  baseline_value NUMERIC(10,4) DEFAULT 0,
  
  -- Timeline
  start_date DATE DEFAULT CURRENT_DATE,
  deadline DATE,
  achieved BOOLEAN DEFAULT false,
  achieved_at TIMESTAMPTZ,
  
  -- Goal metadata
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  priority VARCHAR(20) DEFAULT 'medium',
  tracking_method VARCHAR(50) DEFAULT 'automatic',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance monitoring table
CREATE TABLE analytics.performance_metrics (
  id BIGSERIAL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  service_name VARCHAR(100) NOT NULL,
  
  -- Performance metrics
  response_time_ms INTEGER NOT NULL,
  memory_usage_mb NUMERIC(10,2),
  cpu_usage_percent NUMERIC(5,2),
  active_connections INTEGER,
  
  -- Database metrics
  db_query_time_ms INTEGER,
  cache_hit_ratio NUMERIC(5,4),
  
  -- Custom metrics
  custom_metrics JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable(
  'analytics.performance_metrics', 
  'timestamp', 
  chunk_time_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Create comprehensive indexes for optimal query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_metrics_user_id_timestamp_desc 
ON analytics.profile_metrics (user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_metrics_source_timestamp 
ON analytics.profile_metrics (source, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_metrics_completeness_score 
ON analytics.profile_metrics (completeness_score) WHERE completeness_score > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_metrics_user_type_timestamp 
ON analytics.engagement_metrics (user_id, type, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_metrics_content_id 
ON analytics.engagement_metrics (content_id) WHERE content_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_real_time_events_unprocessed 
ON analytics.real_time_events (processed, timestamp) WHERE processed = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_history_user_timestamp 
ON analytics.alert_history (user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alert_configs_enabled_user 
ON analytics.alert_configs (enabled, user_id) WHERE enabled = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_service_timestamp 
ON analytics.performance_metrics (service_name, timestamp DESC);

-- Create advanced continuous aggregates
CREATE MATERIALIZED VIEW analytics.profile_metrics_5min
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  time_bucket('5 minutes', timestamp) AS bucket,
  AVG(profile_views) as avg_profile_views,
  MAX(profile_views) as max_profile_views,
  AVG(search_appearances) as avg_search_appearances,
  AVG(connections_count) as avg_connections_count,
  AVG(completeness_score) as avg_completeness_score,
  AVG(engagement_rate) as avg_engagement_rate,
  AVG(content_engagement_score) as avg_content_engagement_score,
  COUNT(*) as data_points,
  MIN(timestamp) as first_recorded,
  MAX(timestamp) as last_recorded
FROM analytics.profile_metrics
GROUP BY user_id, bucket;

CREATE MATERIALIZED VIEW analytics.profile_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  time_bucket('1 hour', timestamp) AS hour,
  AVG(profile_views) as avg_profile_views,
  MAX(profile_views) as max_profile_views,
  SUM(profile_views) as sum_profile_views,
  AVG(search_appearances) as avg_search_appearances,
  AVG(connections_count) as avg_connections_count,
  AVG(completeness_score) as avg_completeness_score,
  AVG(engagement_rate) as avg_engagement_rate,
  AVG(network_growth_rate) as avg_network_growth_rate,
  AVG(influence_score) as avg_influence_score,
  COUNT(*) as data_points,
  STDDEV(profile_views) as profile_views_stddev
FROM analytics.profile_metrics
GROUP BY user_id, hour;

CREATE MATERIALIZED VIEW analytics.profile_metrics_daily
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  time_bucket('1 day', timestamp) AS day,
  AVG(profile_views) as avg_profile_views,
  MAX(profile_views) as max_profile_views,
  SUM(profile_views) as sum_profile_views,
  AVG(search_appearances) as avg_search_appearances,
  AVG(connections_count) as avg_connections_count,
  AVG(completeness_score) as avg_completeness_score,
  AVG(engagement_rate) as avg_engagement_rate,
  AVG(network_growth_rate) as avg_network_growth_rate,
  AVG(influence_score) as avg_influence_score,
  COUNT(*) as data_points,
  
  -- Calculate trends within the day
  (MAX(connections_count) - MIN(connections_count)) as daily_connection_growth,
  (MAX(profile_views) - MIN(profile_views)) as daily_view_growth
FROM analytics.profile_metrics
GROUP BY user_id, day;

-- Create engagement aggregates
CREATE MATERIALIZED VIEW analytics.engagement_hourly
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  type,
  time_bucket('1 hour', timestamp) AS hour,
  SUM(value) as total_engagement,
  AVG(value) as avg_engagement,
  COUNT(*) as engagement_count,
  COUNT(DISTINCT content_id) as unique_content_count
FROM analytics.engagement_metrics
GROUP BY user_id, type, hour;

-- Add refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('analytics.profile_metrics_5min',
  start_offset => INTERVAL '30 minutes',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes');

SELECT add_continuous_aggregate_policy('analytics.profile_metrics_hourly',
  start_offset => INTERVAL '4 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('analytics.profile_metrics_daily',
  start_offset => INTERVAL '2 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');

SELECT add_continuous_aggregate_policy('analytics.engagement_hourly',
  start_offset => INTERVAL '4 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

-- Create compression policies for better storage efficiency
SELECT add_compression_policy('analytics.profile_metrics', INTERVAL '7 days');
SELECT add_compression_policy('analytics.engagement_metrics', INTERVAL '7 days');
SELECT add_compression_policy('analytics.real_time_events', INTERVAL '3 days');
SELECT add_compression_policy('analytics.alert_history', INTERVAL '30 days');
SELECT add_compression_policy('analytics.performance_metrics', INTERVAL '7 days');

-- Create retention policies
SELECT add_retention_policy('analytics.profile_metrics', INTERVAL '365 days');
SELECT add_retention_policy('analytics.engagement_metrics', INTERVAL '365 days');
SELECT add_retention_policy('analytics.real_time_events', INTERVAL '30 days');
SELECT add_retention_policy('analytics.alert_history', INTERVAL '180 days');
SELECT add_retention_policy('analytics.performance_metrics', INTERVAL '90 days');

-- Advanced analytics functions
CREATE OR REPLACE FUNCTION analytics.calculate_influence_score(
  p_user_id UUID,
  p_time_window INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS NUMERIC AS $$
DECLARE
  profile_weight NUMERIC := 0.3;
  engagement_weight NUMERIC := 0.4;
  growth_weight NUMERIC := 0.3;
  
  profile_score NUMERIC := 0;
  engagement_score NUMERIC := 0;
  growth_score NUMERIC := 0;
  final_score NUMERIC := 0;
BEGIN
  -- Calculate profile completeness score
  SELECT COALESCE(AVG(completeness_score), 0) * 10
  INTO profile_score
  FROM analytics.profile_metrics
  WHERE user_id = p_user_id 
    AND timestamp >= NOW() - p_time_window;
  
  -- Calculate engagement score
  SELECT COALESCE(AVG(engagement_rate), 0) * 1000
  INTO engagement_score
  FROM analytics.profile_metrics
  WHERE user_id = p_user_id 
    AND timestamp >= NOW() - p_time_window;
  
  -- Calculate growth score
  SELECT COALESCE(AVG(network_growth_rate), 0) * 1000
  INTO growth_score
  FROM analytics.profile_metrics
  WHERE user_id = p_user_id 
    AND timestamp >= NOW() - p_time_window;
  
  -- Calculate weighted final score
  final_score := (profile_score * profile_weight) + 
                 (engagement_score * engagement_weight) + 
                 (growth_score * growth_weight);
  
  RETURN ROUND(final_score, 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION analytics.get_real_time_summary(p_user_id UUID)
RETURNS TABLE(
  current_profile_views BIGINT,
  current_connections BIGINT,
  current_completeness NUMERIC,
  recent_engagement_count BIGINT,
  trend_indicator VARCHAR(10),
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_metrics AS (
    SELECT 
      profile_views,
      connections_count,
      completeness_score,
      timestamp,
      ROW_NUMBER() OVER (ORDER BY timestamp DESC) as rn
    FROM analytics.profile_metrics
    WHERE user_id = p_user_id
      AND timestamp >= NOW() - INTERVAL '1 hour'
  ),
  recent_engagement AS (
    SELECT COUNT(*) as engagement_count
    FROM analytics.engagement_metrics
    WHERE user_id = p_user_id
      AND timestamp >= NOW() - INTERVAL '1 hour'
  ),
  trend_calc AS (
    SELECT 
      CASE 
        WHEN LAG(profile_views) OVER (ORDER BY timestamp) < profile_views THEN 'up'
        WHEN LAG(profile_views) OVER (ORDER BY timestamp) > profile_views THEN 'down'
        ELSE 'stable'
      END as trend
    FROM analytics.profile_metrics
    WHERE user_id = p_user_id
      AND timestamp >= NOW() - INTERVAL '2 hours'
    ORDER BY timestamp DESC
    LIMIT 2
  )
  SELECT 
    COALESCE(lm.profile_views::BIGINT, 0),
    COALESCE(lm.connections_count::BIGINT, 0),
    COALESCE(lm.completeness_score, 0),
    COALESCE(re.engagement_count, 0),
    COALESCE(tc.trend, 'stable'::VARCHAR(10)),
    COALESCE(lm.timestamp, NOW())
  FROM latest_metrics lm
  CROSS JOIN recent_engagement re
  LEFT JOIN trend_calc tc ON true
  WHERE lm.rn = 1;
END;
$$ LANGUAGE plpgsql;

-- Function to process real-time events
CREATE OR REPLACE FUNCTION analytics.process_real_time_events()
RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER := 0;
  event_record RECORD;
BEGIN
  -- Process unprocessed real-time events
  FOR event_record IN 
    SELECT id, user_id, event_type, event_data
    FROM analytics.real_time_events
    WHERE processed = FALSE
    ORDER BY timestamp ASC
    LIMIT 1000
  LOOP
    -- Process different event types
    CASE event_record.event_type
      WHEN 'profile_view' THEN
        -- Update profile metrics
        INSERT INTO analytics.profile_metrics (user_id, profile_views, source)
        VALUES (event_record.user_id, 1, 'real_time')
        ON CONFLICT (user_id, timestamp) 
        DO UPDATE SET profile_views = analytics.profile_metrics.profile_views + 1;
        
      WHEN 'engagement' THEN
        -- Record engagement metric
        INSERT INTO analytics.engagement_metrics (
          user_id, type, value, source, metadata
        ) VALUES (
          event_record.user_id,
          event_record.event_data->>'type',
          (event_record.event_data->>'value')::INTEGER,
          'real_time',
          event_record.event_data
        );
    END CASE;
    
    -- Mark as processed
    UPDATE analytics.real_time_events 
    SET processed = TRUE 
    WHERE id = event_record.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for automatic alert checking
CREATE OR REPLACE FUNCTION analytics.check_metric_alerts()
RETURNS TRIGGER AS $$
DECLARE
  alert_config RECORD;
  metric_value NUMERIC;
  should_alert BOOLEAN := FALSE;
BEGIN
  -- Check all active alerts for this user
  FOR alert_config IN 
    SELECT * FROM analytics.alert_configs 
    WHERE user_id = NEW.user_id AND enabled = TRUE
  LOOP
    -- Get the current metric value based on alert type
    CASE alert_config.metric_type
      WHEN 'profile_views' THEN
        metric_value := NEW.profile_views;
      WHEN 'connections_count' THEN
        metric_value := NEW.connections_count;
      WHEN 'completeness_score' THEN
        metric_value := NEW.completeness_score;
      WHEN 'engagement_rate' THEN
        metric_value := NEW.engagement_rate;
      ELSE
        CONTINUE;
    END CASE;
    
    -- Check alert condition
    should_alert := CASE alert_config.condition
      WHEN 'above' THEN metric_value > alert_config.threshold
      WHEN 'below' THEN metric_value < alert_config.threshold
      ELSE FALSE
    END;
    
    -- Create alert if condition is met
    IF should_alert THEN
      INSERT INTO analytics.alert_history (
        alert_config_id, user_id, metric_value, threshold_value, condition_met
      ) VALUES (
        alert_config.id, NEW.user_id, metric_value, 
        alert_config.threshold, alert_config.condition
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic alert checking
CREATE TRIGGER trigger_check_metric_alerts
  AFTER INSERT ON analytics.profile_metrics
  FOR EACH ROW EXECUTE FUNCTION analytics.check_metric_alerts();

-- Grant permissions
GRANT USAGE ON SCHEMA analytics TO inergize_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO inergize_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO inergize_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO inergize_user;

-- Create helpful views for common queries
CREATE VIEW analytics.user_current_metrics AS
SELECT DISTINCT ON (user_id)
  user_id,
  profile_views,
  search_appearances,
  connections_count,
  completeness_score,
  engagement_rate,
  influence_score,
  timestamp as last_updated
FROM analytics.profile_metrics
ORDER BY user_id, timestamp DESC;

CREATE VIEW analytics.user_daily_summaries AS
SELECT 
  user_id,
  day,
  avg_profile_views,
  avg_connections_count,
  avg_completeness_score,
  daily_connection_growth,
  daily_view_growth
FROM analytics.profile_metrics_daily
ORDER BY user_id, day DESC;

-- Create indexes on views
CREATE INDEX idx_user_current_metrics_user_id ON analytics.user_current_metrics (user_id);

COMMENT ON SCHEMA analytics IS 'Enhanced TimescaleDB analytics schema for LinkedIn SaaS platform with real-time capabilities';