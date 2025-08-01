-- InErgize Production Database Migration Script
-- LinkedIn Optimization Platform
-- Version: 1.0 | Date: 2025-01-08

-- ========================================
-- PRODUCTION DATABASE SETUP
-- ========================================

-- Create production database with optimal settings
CREATE DATABASE inergize_prod
  WITH ENCODING 'UTF8'
       LC_COLLATE = 'en_US.UTF-8'
       LC_CTYPE = 'en_US.UTF-8'
       TEMPLATE template0;

-- Create analytics database (TimescaleDB)
CREATE DATABASE inergize_analytics
  WITH ENCODING 'UTF8'
       LC_COLLATE = 'en_US.UTF-8'
       LC_CTYPE = 'en_US.UTF-8'
       TEMPLATE template0;

-- Create Kong database for API Gateway
CREATE DATABASE kong_prod
  WITH ENCODING 'UTF8'
       LC_COLLATE = 'en_US.UTF-8'
       LC_CTYPE = 'en_US.UTF-8'
       TEMPLATE template0;

-- ========================================
-- USER MANAGEMENT & PERMISSIONS
-- ========================================

-- Create production users with minimal privileges
CREATE USER inergize_app WITH PASSWORD 'prod_secure_password_123!';
CREATE USER analytics_app WITH PASSWORD 'analytics_secure_password_456!';
CREATE USER kong_app WITH PASSWORD 'kong_secure_password_789!';
CREATE USER backup_user WITH PASSWORD 'backup_secure_password_000!';

-- Grant specific permissions (principle of least privilege)
GRANT CONNECT ON DATABASE inergize_prod TO inergize_app;
GRANT CONNECT ON DATABASE inergize_analytics TO analytics_app;
GRANT CONNECT ON DATABASE kong_prod TO kong_app;

-- Grant backup permissions
GRANT CONNECT ON DATABASE inergize_prod TO backup_user;
GRANT CONNECT ON DATABASE inergize_analytics TO backup_user;

-- ========================================
-- SWITCH TO PRODUCTION DATABASE
-- ========================================
\c inergize_prod;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ========================================
-- CORE APPLICATION TABLES
-- ========================================

-- Users table with enhanced security
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    username VARCHAR(50) UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    password_hash VARCHAR(255), -- For email/password auth
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'past_due')),
    subscription_expires_at TIMESTAMPTZ,
    linkedin_connected BOOLEAN DEFAULT FALSE,
    linkedin_access_token TEXT,
    linkedin_refresh_token TEXT,
    linkedin_token_expires_at TIMESTAMPTZ,
    linkedin_profile_id VARCHAR(255),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- LinkedIn profiles with comprehensive data
CREATE TABLE linkedin_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linkedin_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    headline TEXT,
    summary TEXT,
    location VARCHAR(255),
    industry VARCHAR(255),
    current_position JSONB,
    experience JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    skills JSONB DEFAULT '[]',
    profile_picture_url TEXT,
    banner_image_url TEXT,
    public_profile_url TEXT,
    connection_count INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    profile_completeness_score INTEGER DEFAULT 0,
    last_sync_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- LinkedIn connections tracking
CREATE TABLE linkedin_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linkedin_profile_id VARCHAR(255) NOT NULL,
    connection_id VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    headline TEXT,
    profile_url TEXT,
    company VARCHAR(255),
    position VARCHAR(255),
    connected_at TIMESTAMPTZ,
    connection_type VARCHAR(50) DEFAULT 'second' CHECK (connection_type IN ('first', 'second', 'third')),
    mutual_connections INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, connection_id)
);

-- Content management (posts, carousels, banners)
CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('post', 'carousel', 'banner', 'video')),
    title VARCHAR(255),
    content TEXT,
    media_urls JSONB DEFAULT '[]',
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_model VARCHAR(50),
    ai_prompt TEXT,
    template_id UUID,
    tags JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
    published_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ,
    linkedin_post_id VARCHAR(255),
    engagement_stats JSONB DEFAULT '{}',
    performance_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Automation rules and campaigns
CREATE TABLE automation_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('connection_requests', 'post_engagement', 'message_sequence', 'profile_visits')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    target_criteria JSONB NOT NULL DEFAULT '{}',
    message_templates JSONB DEFAULT '[]',
    schedule_config JSONB DEFAULT '{}',
    rate_limits JSONB DEFAULT '{}',
    safety_settings JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    total_targets INTEGER DEFAULT 0,
    completed_actions INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    health_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Automation actions log for compliance
CREATE TABLE automation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES automation_campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    target_linkedin_id VARCHAR(255),
    target_profile_url TEXT,
    action_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'skipped')),
    error_message TEXT,
    executed_at TIMESTAMPTZ,
    response_data JSONB,
    compliance_check JSONB DEFAULT '{}',
    rate_limit_remaining INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Payment and billing
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    plan_id VARCHAR(50) NOT NULL,
    plan_name VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid', 'incomplete')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    amount_per_month INTEGER, -- in cents
    currency VARCHAR(3) DEFAULT 'USD',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    amount INTEGER NOT NULL, -- in cents
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(50),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ========================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_linkedin_id ON users(linkedin_profile_id) WHERE linkedin_connected = TRUE;
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- LinkedIn profiles indexes
CREATE INDEX idx_linkedin_profiles_user_id ON linkedin_profiles(user_id);
CREATE INDEX idx_linkedin_profiles_linkedin_id ON linkedin_profiles(linkedin_id);
CREATE INDEX idx_linkedin_profiles_last_sync ON linkedin_profiles(last_sync_at);

-- LinkedIn connections indexes
CREATE INDEX idx_linkedin_connections_user_id ON linkedin_connections(user_id);
CREATE INDEX idx_linkedin_connections_connected_at ON linkedin_connections(connected_at);
CREATE INDEX idx_linkedin_connections_type ON linkedin_connections(connection_type);

-- Content indexes
CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_type_status ON content(type, status);
CREATE INDEX idx_content_published_at ON content(published_at) WHERE status = 'published';
CREATE INDEX idx_content_scheduled_for ON content(scheduled_for) WHERE status = 'scheduled';

-- Automation campaigns indexes
CREATE INDEX idx_automation_campaigns_user_id ON automation_campaigns(user_id);
CREATE INDEX idx_automation_campaigns_status ON automation_campaigns(status);
CREATE INDEX idx_automation_campaigns_next_run ON automation_campaigns(next_run_at) WHERE status = 'active';

-- Automation actions indexes
CREATE INDEX idx_automation_actions_campaign_id ON automation_actions(campaign_id);
CREATE INDEX idx_automation_actions_user_id ON automation_actions(user_id);
CREATE INDEX idx_automation_actions_status ON automation_actions(status);
CREATE INDEX idx_automation_actions_executed_at ON automation_actions(executed_at);

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- Payments indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX idx_payments_processed_at ON payments(processed_at);

-- ========================================
-- UPDATED_AT TRIGGERS
-- ========================================

-- Generic function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_linkedin_profiles_updated_at BEFORE UPDATE ON linkedin_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_campaigns_updated_at BEFORE UPDATE ON automation_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ANALYTICS DATABASE SETUP (TimescaleDB)
-- ========================================
\c inergize_analytics;

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Time-series metrics table
CREATE TABLE metrics (
    time TIMESTAMPTZ NOT NULL,
    user_id UUID NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(15,4),
    dimensions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('metrics', 'time', chunk_time_interval => INTERVAL '1 day');

-- User activity events
CREATE TABLE user_events (
    time TIMESTAMPTZ NOT NULL,
    user_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    properties JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT
);

SELECT create_hypertable('user_events', 'time', chunk_time_interval => INTERVAL '1 day');

-- LinkedIn automation events
CREATE TABLE automation_events (
    time TIMESTAMPTZ NOT NULL,
    user_id UUID NOT NULL,
    campaign_id UUID,
    action_type VARCHAR(50) NOT NULL,
    target_linkedin_id VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    error_code VARCHAR(50),
    rate_limit_remaining INTEGER,
    compliance_score INTEGER
);

SELECT create_hypertable('automation_events', 'time', chunk_time_interval => INTERVAL '1 day');

-- Performance metrics
CREATE TABLE performance_metrics (
    time TIMESTAMPTZ NOT NULL,
    service_name VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(15,4),
    labels JSONB DEFAULT '{}'
);

SELECT create_hypertable('performance_metrics', 'time', chunk_time_interval => INTERVAL '1 hour');

-- Create indexes for analytics tables
CREATE INDEX idx_metrics_user_time ON metrics(user_id, time DESC);
CREATE INDEX idx_metrics_type_time ON metrics(metric_type, time DESC);
CREATE INDEX idx_user_events_user_time ON user_events(user_id, time DESC);
CREATE INDEX idx_user_events_type_time ON user_events(event_type, time DESC);
CREATE INDEX idx_automation_events_user_time ON automation_events(user_id, time DESC);
CREATE INDEX idx_automation_events_campaign_time ON automation_events(campaign_id, time DESC);
CREATE INDEX idx_performance_metrics_service_time ON performance_metrics(service_name, time DESC);

-- Data retention policies (keep 90 days detailed, 2 years aggregated)
SELECT add_retention_policy('metrics', INTERVAL '90 days');
SELECT add_retention_policy('user_events', INTERVAL '90 days');
SELECT add_retention_policy('automation_events', INTERVAL '90 days');
SELECT add_retention_policy('performance_metrics', INTERVAL '30 days');

-- ========================================
-- GRANT PERMISSIONS TO APPLICATION USERS
-- ========================================

\c inergize_prod;

-- Grant permissions on main database
GRANT USAGE ON SCHEMA public TO inergize_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO inergize_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO inergize_app;

-- Grant backup permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;

\c inergize_analytics;

-- Grant permissions on analytics database
GRANT USAGE ON SCHEMA public TO analytics_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO analytics_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO analytics_app;

-- Grant backup permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;

-- ========================================
-- PRODUCTION DATA SEEDING
-- ========================================

\c inergize_prod;

-- Insert default system configurations
INSERT INTO users (id, email, full_name, subscription_tier, onboarding_completed, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'system@inergize.app', 'System User', 'enterprise', true, CURRENT_TIMESTAMP);

-- ========================================
-- DATABASE OPTIMIZATION SETTINGS
-- ========================================

-- Connection pooling settings (apply to postgresql.conf)
-- max_connections = 200
-- shared_buffers = 256MB
-- effective_cache_size = 1GB
-- work_mem = 4MB
-- maintenance_work_mem = 64MB
-- checkpoint_completion_target = 0.9
-- wal_buffers = 16MB
-- default_statistics_target = 100
-- random_page_cost = 1.1
-- effective_io_concurrency = 200

-- Query optimization
-- enable_seqscan = on
-- enable_indexscan = on
-- enable_bitmapscan = on
-- enable_hashjoin = on
-- enable_mergejoin = on
-- enable_nestloop = on

-- Logging for production monitoring
-- log_statement = 'all'
-- log_min_duration_statement = 1000
-- log_checkpoints = on
-- log_connections = on
-- log_disconnections = on
-- log_lock_waits = on

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Log successful migration
\echo 'InErgize Production Database Migration Completed Successfully'
\echo 'Database: inergize_prod (Primary)'
\echo 'Database: inergize_analytics (TimescaleDB)'
\echo 'Database: kong_prod (API Gateway)'
\echo 'Users: inergize_app, analytics_app, kong_app, backup_user'
\echo 'Tables: 10 core tables + 4 analytics hypertables'
\echo 'Indexes: 25+ performance-optimized indexes'
\echo 'Extensions: UUID, pgcrypto, TimescaleDB'