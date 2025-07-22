-- Initialize TimescaleDB for Analytics
-- This script sets up TimescaleDB extensions and hypertables for time-series analytics

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create analytics schema
CREATE SCHEMA IF NOT EXISTS analytics;

-- Analytics Events Table (Time-series data)
CREATE TABLE IF NOT EXISTS analytics.events (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_category VARCHAR(50) NOT NULL,
  event_data JSONB,
  session_id VARCHAR(100),
  user_agent TEXT,
  ip_address INET,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('analytics.events', 'timestamp', if_not_exists => TRUE);

-- LinkedIn Analytics Table (Time-series data)
CREATE TABLE IF NOT EXISTS analytics.linkedin_metrics (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  linkedin_profile_id TEXT NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  metric_value NUMERIC NOT NULL,
  content_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.linkedin_metrics', 'timestamp', if_not_exists => TRUE);

-- Content Performance Analytics (Time-series data)
CREATE TABLE IF NOT EXISTS analytics.content_performance (
  id UUID DEFAULT gen_random_uuid(),
  content_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.content_performance', 'timestamp', if_not_exists => TRUE);

-- API Usage Analytics (Time-series data)
CREATE TABLE IF NOT EXISTS analytics.api_usage (
  id UUID DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint VARCHAR(200) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  request_size BIGINT,
  response_size BIGINT,
  error_message TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.api_usage', 'timestamp', if_not_exists => TRUE);

-- System Metrics (Time-series data)
CREATE TABLE IF NOT EXISTS analytics.system_metrics (
  id UUID DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  service_name VARCHAR(50),
  instance_id VARCHAR(100),
  tags JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('analytics.system_metrics', 'timestamp', if_not_exists => TRUE);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_events_user_id_timestamp 
ON analytics.events (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_type_timestamp 
ON analytics.events (event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_linkedin_metrics_user_timestamp 
ON analytics.linkedin_metrics (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_linkedin_metrics_profile_type_timestamp 
ON analytics.linkedin_metrics (linkedin_profile_id, metric_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_content_performance_content_timestamp 
ON analytics.content_performance (content_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_endpoint_timestamp 
ON analytics.api_usage (user_id, endpoint, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp 
ON analytics.system_metrics (metric_name, timestamp DESC);

-- Create continuous aggregates for better performance
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.daily_user_activity
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  event_type,
  time_bucket('1 day', timestamp) AS day,
  COUNT(*) as event_count,
  COUNT(DISTINCT session_id) as unique_sessions
FROM analytics.events
GROUP BY user_id, event_type, day;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.daily_content_performance
WITH (timescaledb.continuous) AS
SELECT 
  content_id,
  user_id,
  time_bucket('1 day', timestamp) AS day,
  MAX(views_count) as total_views,
  MAX(likes_count) as total_likes,
  MAX(comments_count) as total_comments,
  MAX(shares_count) as total_shares,
  AVG(engagement_rate) as avg_engagement_rate
FROM analytics.content_performance
GROUP BY content_id, user_id, day;

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.hourly_api_usage
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  endpoint,
  time_bucket('1 hour', timestamp) AS hour,
  COUNT(*) as request_count,
  AVG(response_time_ms) as avg_response_time,
  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
FROM analytics.api_usage
GROUP BY user_id, endpoint, hour;

-- Set up retention policies (keep data for 1 year, then compress/drop)
SELECT add_retention_policy('analytics.events', INTERVAL '365 days');
SELECT add_retention_policy('analytics.linkedin_metrics', INTERVAL '365 days');
SELECT add_retention_policy('analytics.content_performance', INTERVAL '365 days');
SELECT add_retention_policy('analytics.api_usage', INTERVAL '90 days');
SELECT add_retention_policy('analytics.system_metrics', INTERVAL '30 days');

-- Set up compression policies (compress data older than 7 days)
SELECT add_compression_policy('analytics.events', INTERVAL '7 days');
SELECT add_compression_policy('analytics.linkedin_metrics', INTERVAL '7 days');
SELECT add_compression_policy('analytics.content_performance', INTERVAL '7 days');
SELECT add_compression_policy('analytics.api_usage', INTERVAL '3 days');
SELECT add_compression_policy('analytics.system_metrics', INTERVAL '1 day');

-- Create refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('analytics.daily_user_activity',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('analytics.daily_content_performance',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('analytics.hourly_api_usage',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '10 minutes',
  schedule_interval => INTERVAL '10 minutes');

-- Create analytics helper functions
CREATE OR REPLACE FUNCTION analytics.get_user_engagement_trend(
  p_user_id TEXT,
  p_days INTEGER DEFAULT 30
) RETURNS TABLE(
  date DATE,
  total_views BIGINT,
  total_likes BIGINT,
  total_comments BIGINT,
  total_shares BIGINT,
  engagement_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    day::DATE as date,
    SUM(total_views) as total_views,
    SUM(total_likes) as total_likes,
    SUM(total_comments) as total_comments,
    SUM(total_shares) as total_shares,
    AVG(avg_engagement_rate) as engagement_rate
  FROM analytics.daily_content_performance
  WHERE 
    user_id = p_user_id
    AND day >= CURRENT_DATE - INTERVAL '1 day' * p_days
  GROUP BY day
  ORDER BY day DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION analytics.get_api_usage_stats(
  p_user_id TEXT,
  p_hours INTEGER DEFAULT 24
) RETURNS TABLE(
  endpoint TEXT,
  total_requests BIGINT,
  avg_response_time NUMERIC,
  error_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.endpoint,
    SUM(a.request_count) as total_requests,
    AVG(a.avg_response_time) as avg_response_time,
    CASE 
      WHEN SUM(a.request_count) = 0 THEN 0.0
      ELSE ROUND((SUM(a.error_count) * 100.0) / SUM(a.request_count), 2)
    END as error_rate
  FROM analytics.hourly_api_usage a
  WHERE 
    a.user_id = p_user_id
    AND a.hour >= NOW() - INTERVAL '1 hour' * p_hours
  GROUP BY a.endpoint
  ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to application user
GRANT USAGE ON SCHEMA analytics TO inergize_user;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA analytics TO inergize_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO inergize_user;