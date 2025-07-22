-- Initialize InErgize Database
-- This script sets up the initial database structure and extensions

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom functions for timestamp handling
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance optimization (will be created after Prisma migration)
-- These are additional indexes not covered by Prisma

-- Performance indexes for analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_user_timestamp 
ON usage_metrics (user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_type_timestamp 
ON usage_metrics (metric_type, timestamp DESC);

-- Performance indexes for content queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_items_status_scheduled 
ON content_items (status, scheduled_at) 
WHERE status = 'SCHEDULED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_items_performance 
ON content_items (engagement_rate DESC, views DESC) 
WHERE status = 'PUBLISHED';

-- Performance indexes for engagement tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_activities_profile_created 
ON engagement_activities (linkedin_profile_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_activities_type_created 
ON engagement_activities (activity_type, created_at DESC);

-- Performance indexes for automation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_rules_active_frequency 
ON automation_rules (is_active, frequency, last_executed_at) 
WHERE is_active = true;

-- Create a view for user dashboard metrics
CREATE OR REPLACE VIEW user_dashboard_metrics AS
SELECT 
  u.id as user_id,
  u.email,
  u.subscription_tier,
  COUNT(DISTINCT lp.id) as linkedin_profiles_count,
  COUNT(DISTINCT ci.id) as total_content_items,
  COUNT(DISTINCT CASE WHEN ci.status = 'PUBLISHED' THEN ci.id END) as published_content_count,
  COUNT(DISTINCT CASE WHEN ci.status = 'SCHEDULED' THEN ci.id END) as scheduled_content_count,
  COUNT(DISTINCT ar.id) as automation_rules_count,
  COUNT(DISTINCT CASE WHEN ar.is_active = true THEN ar.id END) as active_automation_rules,
  COALESCE(SUM(ci.views), 0) as total_views,
  COALESCE(SUM(ci.likes), 0) as total_likes,
  COALESCE(SUM(ci.comments), 0) as total_comments,
  COALESCE(SUM(ci.shares), 0) as total_shares
FROM users u
LEFT JOIN linkedin_profiles lp ON u.id = lp.user_id
LEFT JOIN content_items ci ON u.id = ci.user_id
LEFT JOIN automation_rules ar ON u.id = ar.user_id
GROUP BY u.id, u.email, u.subscription_tier;

-- Create a function to calculate engagement rate
CREATE OR REPLACE FUNCTION calculate_engagement_rate(
  p_likes INTEGER,
  p_comments INTEGER, 
  p_shares INTEGER,
  p_views INTEGER
) RETURNS DECIMAL(5,2) AS $$
BEGIN
  IF p_views = 0 THEN
    RETURN 0.0;
  END IF;
  
  RETURN ROUND(
    ((p_likes + p_comments + p_shares) * 100.0) / p_views, 
    2
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to get content performance insights
CREATE OR REPLACE FUNCTION get_content_performance_insights(
  p_user_id TEXT,
  p_days INTEGER DEFAULT 30
) RETURNS TABLE(
  content_type TEXT,
  total_posts BIGINT,
  avg_views NUMERIC,
  avg_likes NUMERIC,
  avg_comments NUMERIC,
  avg_shares NUMERIC,
  avg_engagement_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.content_type::TEXT,
    COUNT(*) as total_posts,
    ROUND(AVG(ci.views), 2) as avg_views,
    ROUND(AVG(ci.likes), 2) as avg_likes,
    ROUND(AVG(ci.comments), 2) as avg_comments,
    ROUND(AVG(ci.shares), 2) as avg_shares,
    ROUND(AVG(ci.engagement_rate), 2) as avg_engagement_rate
  FROM content_items ci
  WHERE 
    ci.user_id = p_user_id
    AND ci.status = 'PUBLISHED'
    AND ci.published_at >= CURRENT_DATE - INTERVAL '1 day' * p_days
  GROUP BY ci.content_type
  ORDER BY avg_engagement_rate DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Insert default notification types and system data
INSERT INTO notifications (id, user_id, title, message, type, priority, created_at) VALUES
('system_welcome', 'system', 'Welcome to InErgize!', 'Get started by connecting your LinkedIn profile and creating your first content.', 'SYSTEM', 'MEDIUM', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create database maintenance procedures
CREATE OR REPLACE FUNCTION cleanup_old_metrics(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM usage_metrics 
  WHERE timestamp < CURRENT_DATE - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create procedure to archive old notifications
CREATE OR REPLACE FUNCTION archive_old_notifications(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE notifications 
  SET is_archived = true 
  WHERE 
    created_at < CURRENT_DATE - INTERVAL '1 day' * days_to_keep
    AND is_archived = false
    AND is_read = true;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT ON user_dashboard_metrics TO inergize_user;
GRANT EXECUTE ON FUNCTION calculate_engagement_rate TO inergize_user;
GRANT EXECUTE ON FUNCTION get_content_performance_insights TO inergize_user;