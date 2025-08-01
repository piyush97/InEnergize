-- Performance Optimization Queries for InErgize Enterprise Backend
-- Optimized indexes and queries for 10,000+ concurrent users

-- User Authentication Performance Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active ON users(email) WHERE active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_user_id_expires ON user_sessions(user_id, expires_at) WHERE expires_at > NOW();
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens USING hash(token_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mfa_codes_user_id_created ON mfa_codes(user_id, created_at) WHERE used = false;

-- LinkedIn Profile Optimization Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_linkedin_profiles_user_id_updated ON linkedin_profiles(user_id, updated_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_completeness_user_id ON profile_completeness_scores(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_linkedin_tokens_user_id_expires ON linkedin_oauth_tokens(user_id, expires_at) WHERE expires_at > NOW();

-- Automation Performance Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_rules_user_id_active ON automation_rules(user_id, active) WHERE active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_queue_status_priority ON automation_queue(status, priority, scheduled_at) WHERE status IN ('pending', 'processing');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_user_id_window ON rate_limits(user_id, window_start) WHERE window_start >= NOW() - INTERVAL '1 day';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_safety_metrics_user_id_timestamp ON safety_metrics(user_id, timestamp DESC);

-- Content Generation Performance Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_content_user_id_type ON generated_content(user_id, content_type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_cache_hash ON content_cache USING hash(content_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_requests_user_id_timestamp ON ai_requests(user_id, created_at DESC);

-- Analytics Performance Indexes (TimescaleDB)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_metrics_user_timestamp ON profile_metrics(user_id, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_metrics_user_timestamp ON engagement_metrics(user_id, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_metrics_user_timestamp ON automation_metrics(user_id, timestamp DESC);

-- Performance Monitoring Views
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT us.id) as active_sessions,
    COUNT(DISTINCT ar.id) as active_automations,
    COUNT(DISTINCT ai.id) as ai_requests_today,
    MAX(pm.timestamp) as last_activity
FROM users u
LEFT JOIN user_sessions us ON u.id = us.user_id AND us.expires_at > NOW()
LEFT JOIN automation_rules ar ON u.id = ar.user_id AND ar.active = true
LEFT JOIN ai_requests ai ON u.id = ai.user_id AND ai.created_at >= CURRENT_DATE
LEFT JOIN profile_metrics pm ON u.id = pm.user_id
WHERE u.active = true
GROUP BY u.id, u.email;

-- Automation Performance View
CREATE OR REPLACE VIEW automation_performance_summary AS
SELECT 
    user_id,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_actions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_actions,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::numeric / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as success_rate,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
FROM automation_queue 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY user_id;

-- System Performance Monitoring Queries
CREATE OR REPLACE FUNCTION get_system_performance_metrics()
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    metric_unit TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'active_connections'::TEXT,
        COUNT(*)::NUMERIC,
        'connections'::TEXT
    FROM pg_stat_activity 
    WHERE state = 'active'
    
    UNION ALL
    
    SELECT 
        'database_size'::TEXT,
        pg_database_size(current_database())::NUMERIC / (1024*1024*1024),
        'GB'::TEXT
    
    UNION ALL
    
    SELECT 
        'cache_hit_ratio'::TEXT,
        ROUND(
            (sum(blks_hit) * 100.0 / NULLIF(sum(blks_hit + blks_read), 0))::NUMERIC,
            2
        ),
        'percent'::TEXT
    FROM pg_stat_database
    WHERE datname = current_database()
    
    UNION ALL
    
    SELECT 
        'avg_query_time'::TEXT,
        ROUND(mean_exec_time::NUMERIC, 2),
        'ms'::TEXT
    FROM pg_stat_statements 
    ORDER BY mean_exec_time DESC 
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Connection Pool Optimization
CREATE OR REPLACE FUNCTION optimize_connection_pool()
RETURNS TEXT AS $$
DECLARE
    idle_connections INTEGER;
    result TEXT;
BEGIN
    SELECT COUNT(*) INTO idle_connections
    FROM pg_stat_activity 
    WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';
    
    IF idle_connections > 50 THEN
        -- Terminate long-idle connections
        PERFORM pg_terminate_backend(pid)
        FROM pg_stat_activity 
        WHERE state = 'idle' 
        AND state_change < NOW() - INTERVAL '10 minutes'
        AND application_name NOT LIKE 'pgAdmin%';
        
        result := 'Terminated ' || idle_connections || ' idle connections';
    ELSE
        result := 'Connection pool is optimal';
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Automated Maintenance Procedures
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS TEXT AS $$
DECLARE
    maintenance_log TEXT := '';
BEGIN
    -- Update table statistics
    ANALYZE;
    maintenance_log := maintenance_log || 'Statistics updated. ';
    
    -- Reindex heavily used tables
    REINDEX INDEX CONCURRENTLY idx_users_email_active;
    REINDEX INDEX CONCURRENTLY idx_automation_queue_status_priority;
    maintenance_log := maintenance_log || 'Indexes optimized. ';
    
    -- Clean up old sessions
    DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '1 day';
    maintenance_log := maintenance_log || 'Old sessions cleaned. ';
    
    -- Clean up old rate limit records
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '2 days';
    maintenance_log := maintenance_log || 'Rate limits cleaned. ';
    
    -- Clean up completed automation queue items older than 7 days
    DELETE FROM automation_queue 
    WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '7 days';
    maintenance_log := maintenance_log || 'Automation queue cleaned. ';
    
    RETURN maintenance_log;
END;
$$ LANGUAGE plpgsql;

-- Performance Monitoring Alerts
CREATE OR REPLACE FUNCTION check_performance_alerts()
RETURNS TABLE (
    alert_type TEXT,
    alert_message TEXT,
    severity TEXT
) AS $$
BEGIN
    -- Check for high connection usage
    RETURN QUERY
    SELECT 
        'high_connections'::TEXT,
        'Connection usage at ' || COUNT(*)::TEXT || ' connections'::TEXT,
        CASE 
            WHEN COUNT(*) > 400 THEN 'CRITICAL'
            WHEN COUNT(*) > 300 THEN 'WARNING'
            ELSE 'INFO'
        END
    FROM pg_stat_activity
    HAVING COUNT(*) > 250
    
    UNION ALL
    
    -- Check for slow queries
    SELECT 
        'slow_queries'::TEXT,
        'Detected ' || COUNT(*)::TEXT || ' slow queries'::TEXT,
        'WARNING'::TEXT
    FROM pg_stat_activity 
    WHERE state = 'active' 
    AND query_start < NOW() - INTERVAL '30 seconds'
    AND query NOT LIKE '%pg_stat_activity%'
    HAVING COUNT(*) > 0
    
    UNION ALL
    
    -- Check for lock waits
    SELECT 
        'lock_waits'::TEXT,
        'Found ' || COUNT(*)::TEXT || ' processes waiting for locks'::TEXT,
        'WARNING'::TEXT
    FROM pg_stat_activity 
    WHERE wait_event_type = 'Lock'
    HAVING COUNT(*) > 0;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job for maintenance (requires pg_cron extension)
-- SELECT cron.schedule('maintenance', '0 2 * * *', 'SELECT perform_maintenance();');

-- Materialized views for dashboard performance
CREATE MATERIALIZED VIEW IF NOT EXISTS user_metrics_daily AS
SELECT 
    DATE(timestamp) as date,
    user_id,
    COUNT(*) as total_events,
    AVG(profile_views) as avg_profile_views,
    AVG(connection_requests) as avg_connections,
    AVG(engagement_rate) as avg_engagement
FROM profile_metrics 
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(timestamp), user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_metrics_daily_unique 
ON user_metrics_daily (date, user_id);

-- Refresh materialized views procedure
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS TEXT AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_metrics_daily;
    RETURN 'Materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- Performance optimization settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements,pg_buffercache';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET pg_stat_statements.max = 10000;
ALTER SYSTEM SET track_io_timing = 'on';
ALTER SYSTEM SET track_functions = 'all';

-- Create performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(20),
    instance_id VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp 
ON performance_metrics (timestamp DESC);

-- Function to log performance metrics
CREATE OR REPLACE FUNCTION log_performance_metric(
    p_metric_name TEXT,
    p_metric_value NUMERIC,
    p_metric_unit TEXT DEFAULT NULL,
    p_instance_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, instance_id)
    VALUES (p_metric_name, p_metric_value, p_metric_unit, p_instance_id);
END;
$$ LANGUAGE plpgsql;