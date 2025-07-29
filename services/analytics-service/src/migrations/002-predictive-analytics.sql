-- Migration 002: Add predictive analytics support
-- This migration adds tables for storing prediction results, recommendations, and benchmarks

-- Create table for storing prediction results
CREATE TABLE analytics.prediction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prediction_type VARCHAR(50) NOT NULL, -- 'growth', 'benchmark', 'content', 'network'
  metric_name VARCHAR(100) NOT NULL,
  timeframe VARCHAR(10) NOT NULL, -- '7d', '30d', '90d'
  current_value NUMERIC(12,4) NOT NULL,
  predicted_value NUMERIC(12,4) NOT NULL,
  confidence_score NUMERIC(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  trend VARCHAR(20) NOT NULL CHECK (trend IN ('increasing', 'decreasing', 'stable')),
  change_percent NUMERIC(8,4) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour' -- Cache for 1 hour
);

-- Create table for storing optimization recommendations
CREATE TABLE analytics.optimization_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('profile', 'content', 'engagement', 'networking')),
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  expected_impact TEXT NOT NULL,
  implementation VARCHAR(20) NOT NULL CHECK (implementation IN ('immediate', 'short_term', 'long_term')),
  metrics TEXT[] NOT NULL DEFAULT '{}',
  completed BOOLEAN DEFAULT false,
  ai_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- Create table for storing benchmark predictions
CREATE TABLE analytics.benchmark_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  current_value NUMERIC(12,4) NOT NULL,
  industry_benchmark NUMERIC(12,4) NOT NULL,
  days_to_reach INTEGER, -- null if already reached or unrealistic
  probability_of_reaching NUMERIC(3,2) NOT NULL CHECK (probability_of_reaching >= 0 AND probability_of_reaching <= 1),
  required_growth_rate NUMERIC(8,4) NOT NULL, -- daily percentage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- Create table for storing content performance predictions
CREATE TABLE analytics.content_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('article', 'post', 'video', 'carousel')),
  predicted_engagement NUMERIC(8,2) NOT NULL,
  best_time_to_post VARCHAR(50) NOT NULL,
  recommended_topics TEXT[] NOT NULL DEFAULT '{}',
  confidence_score NUMERIC(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- Create table for storing network growth forecasts
CREATE TABLE analytics.network_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  optimal_connection_times JSONB NOT NULL DEFAULT '[]',
  recommended_targets JSONB NOT NULL DEFAULT '[]',
  network_health_score INTEGER NOT NULL CHECK (network_health_score >= 0 AND network_health_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

-- Create table for storing prediction cache metadata
CREATE TABLE analytics.prediction_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cache_key VARCHAR(255) NOT NULL,
  cache_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cache_key)
);

-- Create indexes for better query performance
CREATE INDEX idx_prediction_results_user_id ON analytics.prediction_results (user_id);
CREATE INDEX idx_prediction_results_type_timeframe ON analytics.prediction_results (prediction_type, timeframe);
CREATE INDEX idx_prediction_results_expires_at ON analytics.prediction_results (expires_at);

CREATE INDEX idx_optimization_recommendations_user_id ON analytics.optimization_recommendations (user_id);
CREATE INDEX idx_optimization_recommendations_priority ON analytics.optimization_recommendations (priority);
CREATE INDEX idx_optimization_recommendations_category ON analytics.optimization_recommendations (category);
CREATE INDEX idx_optimization_recommendations_completed ON analytics.optimization_recommendations (completed);
CREATE INDEX idx_optimization_recommendations_expires_at ON analytics.optimization_recommendations (expires_at);

CREATE INDEX idx_benchmark_predictions_user_id ON analytics.benchmark_predictions (user_id);
CREATE INDEX idx_benchmark_predictions_metric ON analytics.benchmark_predictions (metric_name);
CREATE INDEX idx_benchmark_predictions_expires_at ON analytics.benchmark_predictions (expires_at);

CREATE INDEX idx_content_predictions_user_id ON analytics.content_predictions (user_id);
CREATE INDEX idx_content_predictions_type ON analytics.content_predictions (content_type);
CREATE INDEX idx_content_predictions_expires_at ON analytics.content_predictions (expires_at);

CREATE INDEX idx_network_forecasts_user_id ON analytics.network_forecasts (user_id);
CREATE INDEX idx_network_forecasts_expires_at ON analytics.network_forecasts (expires_at);

CREATE INDEX idx_prediction_cache_user_key ON analytics.prediction_cache (user_id, cache_key);
CREATE INDEX idx_prediction_cache_expires_at ON analytics.prediction_cache (expires_at);

-- Create function to clean up expired predictions
CREATE OR REPLACE FUNCTION analytics.cleanup_expired_predictions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Clean up expired prediction results
  DELETE FROM analytics.prediction_results WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up expired recommendations
  DELETE FROM analytics.optimization_recommendations WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up expired benchmark predictions
  DELETE FROM analytics.benchmark_predictions WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up expired content predictions
  DELETE FROM analytics.content_predictions WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up expired network forecasts
  DELETE FROM analytics.network_forecasts WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up expired cache entries
  DELETE FROM analytics.prediction_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's latest growth predictions
CREATE OR REPLACE FUNCTION analytics.get_user_growth_predictions(
  p_user_id UUID,
  p_timeframe VARCHAR(10) DEFAULT '30d'
)
RETURNS TABLE (
  metric_name VARCHAR(100),
  current_value NUMERIC(12,4),
  predicted_value NUMERIC(12,4),
  confidence_score NUMERIC(3,2),
  trend VARCHAR(20),
  change_percent NUMERIC(8,4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.metric_name,
    pr.current_value,
    pr.predicted_value,
    pr.confidence_score,
    pr.trend,
    pr.change_percent
  FROM analytics.prediction_results pr
  WHERE pr.user_id = p_user_id
    AND pr.prediction_type = 'growth'
    AND pr.timeframe = p_timeframe
    AND pr.expires_at > NOW()
  ORDER BY pr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to store growth predictions
CREATE OR REPLACE FUNCTION analytics.store_growth_predictions(
  p_user_id UUID,
  p_timeframe VARCHAR(10),
  p_predictions JSONB
)
RETURNS INTEGER AS $$
DECLARE
  prediction JSONB;
  inserted_count INTEGER := 0;
BEGIN
  -- Delete existing predictions for this user and timeframe
  DELETE FROM analytics.prediction_results 
  WHERE user_id = p_user_id 
    AND prediction_type = 'growth' 
    AND timeframe = p_timeframe;
  
  -- Insert new predictions
  FOR prediction IN SELECT * FROM jsonb_array_elements(p_predictions)
  LOOP
    INSERT INTO analytics.prediction_results (
      user_id, prediction_type, metric_name, timeframe,
      current_value, predicted_value, confidence_score,
      trend, change_percent, metadata
    ) VALUES (
      p_user_id,
      'growth',
      prediction->>'metric',
      p_timeframe,
      (prediction->>'currentValue')::NUMERIC,
      (prediction->>'predictedValue')::NUMERIC,
      (prediction->>'confidenceScore')::NUMERIC,
      prediction->>'trend',
      (prediction->>'changePercent')::NUMERIC,
      prediction->'metadata'
    );
    
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's active recommendations
CREATE OR REPLACE FUNCTION analytics.get_user_recommendations(
  p_user_id UUID,
  p_category VARCHAR(50) DEFAULT NULL,
  p_priority VARCHAR(10) DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  category VARCHAR(50),
  priority VARCHAR(10),
  title VARCHAR(255),
  description TEXT,
  expected_impact TEXT,
  implementation VARCHAR(20),
  metrics TEXT[],
  completed BOOLEAN,
  ai_generated BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id, r.category, r.priority, r.title, r.description,
    r.expected_impact, r.implementation, r.metrics,
    r.completed, r.ai_generated, r.created_at
  FROM analytics.optimization_recommendations r
  WHERE r.user_id = p_user_id
    AND r.expires_at > NOW()
    AND (p_category IS NULL OR r.category = p_category)
    AND (p_priority IS NULL OR r.priority = p_priority)
  ORDER BY 
    CASE r.priority 
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 1
    END DESC,
    r.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add cleanup job (this would typically be managed by a job scheduler)
-- For now, we'll create a note about it
COMMENT ON FUNCTION analytics.cleanup_expired_predictions() IS 
'This function should be called periodically (e.g., every hour) to clean up expired prediction data. 
Consider setting up a cron job or using pg_cron extension to automate this.';

-- Create a view for easy access to current predictions
CREATE VIEW analytics.current_user_predictions AS
SELECT 
  pr.user_id,
  pr.prediction_type,
  pr.metric_name,
  pr.timeframe,
  pr.current_value,
  pr.predicted_value,
  pr.confidence_score,
  pr.trend,
  pr.change_percent,
  pr.created_at
FROM analytics.prediction_results pr
WHERE pr.expires_at > NOW();

-- Create a view for active recommendations
CREATE VIEW analytics.active_recommendations AS
SELECT 
  r.user_id,
  r.category,
  r.priority,
  r.title,
  r.description,
  r.expected_impact,
  r.implementation,
  r.metrics,
  r.completed,
  r.ai_generated,
  r.created_at
FROM analytics.optimization_recommendations r
WHERE r.expires_at > NOW()
  AND r.completed = false;

-- Grant permissions (uncomment when setting up roles)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO analytics_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO analytics_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA analytics TO analytics_user;