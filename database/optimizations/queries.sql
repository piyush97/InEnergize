-- InErgize Database Query Optimizations
-- Performance tuning for PostgreSQL and TimescaleDB

-- =====================================================
-- 1. ENHANCED INDEXES FOR MAIN TABLES
-- =====================================================

-- Users table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON users (email) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_subscription_active 
ON users (subscription_tier) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at_desc 
ON users (created_at DESC);

-- LinkedIn profiles optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_linkedin_profiles_user_active 
ON linkedin_profiles (user_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_linkedin_profiles_linkedin_id_active 
ON linkedin_profiles (linkedin_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_linkedin_profiles_last_synced 
ON linkedin_profiles (last_synced_at DESC NULLS LAST);

-- Content items optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_items_user_status 
ON content_items (user_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_items_scheduled_at 
ON content_items (scheduled_at) WHERE scheduled_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_items_published_at_desc 
ON content_items (published_at DESC) WHERE published_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_items_content_type_status 
ON content_items (content_type, status);

-- Automation rules optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_rules_active_user 
ON automation_rules (user_id) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_rules_type_active 
ON automation_rules (rule_type) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_rules_next_execution 
ON automation_rules (last_executed_at ASC NULLS FIRST) WHERE is_active = true;

-- Usage metrics optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_user_timestamp 
ON usage_metrics (user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_type_timestamp 
ON usage_metrics (metric_type, timestamp DESC);

-- Engagement activities optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_activities_profile_type 
ON engagement_activities (linkedin_profile_id, activity_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_activities_created_at_desc 
ON engagement_activities (created_at DESC);

-- Banners optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_banners_user_created 
ON banners (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_banners_industry_public 
ON banners (industry) WHERE is_public = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_banners_tags_gin 
ON banners USING GIN (tags);

-- =====================================================
-- 2. TIMESCALEDB SPECIFIC OPTIMIZATIONS
-- =====================================================

-- Optimize chunk intervals for better performance
SELECT set_chunk_time_interval('analytics.profile_metrics', INTERVAL '1 day');
SELECT set_chunk_time_interval('analytics.engagement_metrics', INTERVAL '1 day');
SELECT set_chunk_time_interval('analytics.metric_aggregations', INTERVAL '7 days');

-- Create additional indexes on TimescaleDB hypertables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_metrics_user_source_timestamp 
ON analytics.profile_metrics (user_id, source, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_metrics_user_type_timestamp 
ON analytics.engagement_metrics (user_id, type, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_metrics_content_timestamp 
ON analytics.engagement_metrics (content_id, timestamp DESC) 
WHERE content_id IS NOT NULL;

-- Optimize continuous aggregates with better refresh policies
SELECT remove_continuous_aggregate_policy('analytics.profile_metrics_hourly');
SELECT add_continuous_aggregate_policy('analytics.profile_metrics_hourly',
  start_offset => INTERVAL '2 hours',
  end_offset => INTERVAL '30 minutes',
  schedule_interval => INTERVAL '30 minutes');

SELECT remove_continuous_aggregate_policy('analytics.profile_metrics_daily');
SELECT add_continuous_aggregate_policy('analytics.profile_metrics_daily',
  start_offset => INTERVAL '2 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

-- Create weekly continuous aggregate for long-term trends
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.profile_metrics_weekly
WITH (timescaledb.continuous) AS
SELECT 
  user_id,
  time_bucket('1 week', timestamp) AS week,
  AVG(profile_views) as avg_profile_views,
  AVG(search_appearances) as avg_search_appearances,
  AVG(connections_count) as avg_connections_count,
  AVG(completeness_score) as avg_completeness_score,
  AVG(engagement_rate) as avg_engagement_rate,
  COUNT(*) as data_points,
  MIN(timestamp) as period_start,
  MAX(timestamp) as period_end
FROM analytics.profile_metrics
GROUP BY user_id, week;

SELECT add_continuous_aggregate_policy('analytics.profile_metrics_weekly',
  start_offset => INTERVAL '1 week',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');

-- =====================================================
-- 3. MATERIALIZED VIEWS FOR COMPLEX QUERIES
-- =====================================================

-- User dashboard summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS user_dashboard_summary AS
SELECT 
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name,
  u.subscription_tier,
  u.created_at,
  lp.id as linkedin_profile_id,
  lp.linkedin_id,
  lp.connection_count,
  lp.last_synced_at,
  COALESCE(content_stats.total_posts, 0) as total_posts,
  COALESCE(content_stats.published_posts, 0) as published_posts,
  COALESCE(content_stats.scheduled_posts, 0) as scheduled_posts,
  COALESCE(automation_stats.active_rules, 0) as active_automation_rules,
  COALESCE(engagement_stats.total_activities, 0) as total_engagement_activities,
  COALESCE(engagement_stats.recent_activities, 0) as recent_engagement_activities
FROM users u
LEFT JOIN linkedin_profiles lp ON u.id = lp.user_id AND lp.is_active = true
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published_posts,
    COUNT(*) FILTER (WHERE status = 'SCHEDULED') as scheduled_posts
  FROM content_items 
  GROUP BY user_id
) content_stats ON u.id = content_stats.user_id
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) as active_rules
  FROM automation_rules 
  WHERE is_active = true 
  GROUP BY user_id
) automation_stats ON u.id = automation_stats.user_id
LEFT JOIN (
  SELECT 
    lp.user_id,
    COUNT(*) as total_activities,
    COUNT(*) FILTER (WHERE ea.created_at > NOW() - INTERVAL '7 days') as recent_activities
  FROM engagement_activities ea
  JOIN linkedin_profiles lp ON ea.linkedin_profile_id = lp.id
  GROUP BY lp.user_id
) engagement_stats ON u.id = engagement_stats.user_id
WHERE u.is_active = true;

-- Refresh policy for dashboard summary
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_dashboard_summary_user_id 
ON user_dashboard_summary (user_id);

-- Content performance summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS content_performance_summary AS
SELECT 
  ci.id,
  ci.user_id,
  ci.title,
  ci.content_type,
  ci.published_at,
  ci.views,
  ci.likes,
  ci.comments,
  ci.shares,
  ci.engagement_rate,
  CASE 
    WHEN ci.views > 0 THEN (ci.likes + ci.comments + ci.shares)::float / ci.views 
    ELSE 0 
  END as calculated_engagement_rate,
  RANK() OVER (PARTITION BY ci.user_id ORDER BY ci.engagement_rate DESC) as engagement_rank,
  RANK() OVER (PARTITION BY ci.user_id ORDER BY ci.views DESC) as views_rank
FROM content_items ci
WHERE ci.status = 'PUBLISHED' 
  AND ci.published_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_performance_user_engagement 
ON content_performance_summary (user_id, engagement_rank);

-- =====================================================
-- 4. QUERY OPTIMIZATION FUNCTIONS
-- =====================================================

-- Function to get user analytics summary with caching
CREATE OR REPLACE FUNCTION get_user_analytics_summary(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  profile_views_total BIGINT,
  profile_views_change NUMERIC,
  connections_total INTEGER,
  connections_change INTEGER,
  content_engagement_rate NUMERIC,
  content_performance_trend NUMERIC
) AS $$
DECLARE
  start_date TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
  comparison_date TIMESTAMPTZ := NOW() - (p_days * 2 || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT 
      COALESCE(SUM(profile_views), 0) as profile_views,
      COALESCE(AVG(connections_count), 0)::INTEGER as connections,
      COALESCE(AVG(engagement_rate), 0) as engagement_rate
    FROM analytics.profile_metrics 
    WHERE user_id = p_user_id 
      AND timestamp >= start_date
  ),
  previous_period AS (
    SELECT 
      COALESCE(SUM(profile_views), 0) as profile_views,
      COALESCE(AVG(connections_count), 0)::INTEGER as connections,
      COALESCE(AVG(engagement_rate), 0) as engagement_rate
    FROM analytics.profile_metrics 
    WHERE user_id = p_user_id 
      AND timestamp >= comparison_date 
      AND timestamp < start_date
  ),
  content_performance AS (
    SELECT 
      AVG(engagement_rate) as avg_engagement_rate,
      (SELECT AVG(engagement_rate) 
       FROM content_items 
       WHERE user_id = p_user_id 
         AND published_at >= comparison_date 
         AND published_at < start_date
         AND status = 'PUBLISHED'
      ) as prev_avg_engagement_rate
    FROM content_items
    WHERE user_id = p_user_id 
      AND published_at >= start_date
      AND status = 'PUBLISHED'
  )
  SELECT 
    cp.profile_views as profile_views_total,
    CASE 
      WHEN pp.profile_views > 0 THEN 
        ((cp.profile_views - pp.profile_views)::NUMERIC / pp.profile_views) * 100
      ELSE 0 
    END as profile_views_change,
    cp.connections as connections_total,
    (cp.connections - pp.connections) as connections_change,
    COALESCE(cp_perf.avg_engagement_rate, 0) as content_engagement_rate,
    CASE 
      WHEN cp_perf.prev_avg_engagement_rate > 0 THEN
        ((cp_perf.avg_engagement_rate - cp_perf.prev_avg_engagement_rate) / cp_perf.prev_avg_engagement_rate) * 100
      ELSE 0
    END as content_performance_trend
  FROM current_period cp
  CROSS JOIN previous_period pp
  CROSS JOIN content_performance cp_perf;
END;
$$ LANGUAGE plpgsql;

-- Function to get top performing content for a user
CREATE OR REPLACE FUNCTION get_top_content(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  content_id TEXT,
  title TEXT,
  content_type content_type,
  published_at TIMESTAMPTZ,
  total_engagement INTEGER,
  engagement_rate NUMERIC,
  performance_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id as content_id,
    ci.title,
    ci.content_type,
    ci.published_at,
    (ci.likes + ci.comments + ci.shares) as total_engagement,
    ci.engagement_rate,
    -- Performance score based on multiple factors
    (
      (ci.engagement_rate * 0.4) +  -- 40% weight on engagement rate
      (LEAST(ci.views / NULLIF((
        SELECT AVG(views) 
        FROM content_items 
        WHERE user_id = p_user_id AND status = 'PUBLISHED'
      ), 0), 2) * 0.3) +  -- 30% weight on views (capped at 2x average)
      (EXTRACT(epoch FROM (NOW() - ci.published_at)) / 86400 * -0.01) + 1  -- Recent content gets slight boost
    ) as performance_score
  FROM content_items ci
  WHERE ci.user_id = p_user_id 
    AND ci.status = 'PUBLISHED'
    AND ci.published_at IS NOT NULL
  ORDER BY performance_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. VACUUM AND MAINTENANCE SCHEDULES
-- =====================================================

-- Create maintenance functions
CREATE OR REPLACE FUNCTION maintain_analytics_tables()
RETURNS void AS $$
BEGIN
  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY content_performance_summary;
  
  -- Update table statistics
  ANALYZE analytics.profile_metrics;
  ANALYZE analytics.engagement_metrics;
  ANALYZE analytics.metric_aggregations;
  
  -- Log maintenance completion
  INSERT INTO analytics.maintenance_log (operation, completed_at) 
  VALUES ('daily_maintenance', NOW());
END;
$$ LANGUAGE plpgsql;

-- Create maintenance log table
CREATE TABLE IF NOT EXISTS analytics.maintenance_log (
  id BIGSERIAL PRIMARY KEY,
  operation VARCHAR(100) NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  details JSONB
);

-- =====================================================
-- 6. QUERY PERFORMANCE MONITORING
-- =====================================================

-- Create slow query log table
CREATE TABLE IF NOT EXISTS analytics.slow_query_log (
  id BIGSERIAL PRIMARY KEY,
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  execution_time_ms NUMERIC NOT NULL,
  user_id UUID,
  service_name VARCHAR(100),
  endpoint VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slow_query_log_hash_time 
ON analytics.slow_query_log (query_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_slow_query_log_execution_time 
ON analytics.slow_query_log (execution_time_ms DESC);

-- Function to log slow queries
CREATE OR REPLACE FUNCTION log_slow_query(
  p_query_text TEXT,
  p_execution_time_ms NUMERIC,
  p_user_id UUID DEFAULT NULL,
  p_service_name VARCHAR(100) DEFAULT NULL,
  p_endpoint VARCHAR(200) DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO analytics.slow_query_log (
    query_hash,
    query_text,
    execution_time_ms,
    user_id,
    service_name,
    endpoint
  ) VALUES (
    MD5(p_query_text),
    p_query_text,
    p_execution_time_ms,
    p_user_id,
    p_service_name,
    p_endpoint
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. POSTGRES CONFIGURATION RECOMMENDATIONS
-- =====================================================

/*
Add these to postgresql.conf for optimal performance:

# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Checkpoints
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Query Planner
random_page_cost = 1.1
effective_io_concurrency = 200

# Connections
max_connections = 200

# TimescaleDB
timescaledb.max_background_workers = 8
*/

-- Grant necessary permissions
-- GRANT USAGE ON SCHEMA analytics TO inergize_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO inergize_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO inergize_user;