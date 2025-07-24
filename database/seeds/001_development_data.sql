-- Development Seed Data for InErgize Platform
-- This file contains sample data for development and testing purposes

-- Insert sample users
INSERT INTO users (id, email, "firstName", "lastName", "subscriptionTier", "isActive", "createdAt") VALUES
  ('usr_001', 'john.doe@example.com', 'John', 'Doe', 'FREE', true, NOW() - INTERVAL '30 days'),
  ('usr_002', 'jane.smith@example.com', 'Jane', 'Smith', 'BASIC', true, NOW() - INTERVAL '25 days'),
  ('usr_003', 'mike.johnson@example.com', 'Mike', 'Johnson', 'PROFESSIONAL', true, NOW() - INTERVAL '20 days'),
  ('usr_004', 'sarah.wilson@example.com', 'Sarah', 'Wilson', 'ENTERPRISE', true, NOW() - INTERVAL '15 days'),
  ('usr_005', 'demo@example.com', 'Demo', 'User', 'FREE', true, NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- Insert sample LinkedIn profiles
INSERT INTO linkedin_profiles (
  id, "userId", "linkedinId", "linkedinUrl", "firstName", "lastName", 
  headline, summary, industry, location, "connectionCount", "followerCount",
  "isActive", "autoPostEnabled", "createdAt"
) VALUES
  (
    'lnk_001', 'usr_001', 'john-doe-123', 'https://linkedin.com/in/john-doe-123',
    'John', 'Doe', 'Senior Software Engineer at TechCorp',
    'Passionate software engineer with 10+ years of experience in full-stack development.',
    'Technology', 'San Francisco, CA', 500, 1200, true, true, NOW() - INTERVAL '30 days'
  ),
  (
    'lnk_002', 'usr_002', 'jane-smith-456', 'https://linkedin.com/in/jane-smith-456',
    'Jane', 'Smith', 'Marketing Director | Growth Strategist',
    'Driving growth through data-driven marketing strategies and innovative campaigns.',
    'Marketing', 'New York, NY', 800, 2500, true, true, NOW() - INTERVAL '25 days'
  ),
  (
    'lnk_003', 'usr_003', 'mike-johnson-789', 'https://linkedin.com/in/mike-johnson-789',
    'Mike', 'Johnson', 'Product Manager | AI & Machine Learning',
    'Building the future with AI-powered products that solve real-world problems.',
    'Artificial Intelligence', 'Seattle, WA', 1200, 3000, true, false, NOW() - INTERVAL '20 days'
  ),
  (
    'lnk_004', 'usr_004', 'sarah-wilson-101', 'https://linkedin.com/in/sarah-wilson-101',
    'Sarah', 'Wilson', 'Chief Technology Officer | Startup Advisor',
    'Scaling technology teams and products from 0 to millions of users.',
    'Technology', 'Austin, TX', 2000, 5000, true, true, NOW() - INTERVAL '15 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert sample content items
INSERT INTO content_items (
  id, "userId", "linkedinProfileId", title, content, "contentType", status,
  views, likes, comments, shares, "engagementRate", "publishedAt", "createdAt"
) VALUES
  (
    'cnt_001', 'usr_001', 'lnk_001', '5 Tips for Better Code Reviews',
    'Code reviews are essential for maintaining code quality. Here are my top 5 tips:\n\n1. Focus on the logic, not the style\n2. Be constructive with feedback\n3. Review in small chunks\n4. Test the changes yourself\n5. Appreciate good work\n\n#CodeReview #SoftwareDevelopment #BestPractices',
    'POST', 'PUBLISHED', 1250, 45, 12, 8, 5.2, NOW() - INTERVAL '5 days', NOW() - INTERVAL '6 days'
  ),
  (
    'cnt_002', 'usr_002', 'lnk_002', 'The Future of Digital Marketing',
    'Marketing is evolving rapidly with AI and automation. Here''s what I see coming:\n\n• Hyper-personalization at scale\n• Voice search optimization\n• AI-powered content creation\n• Privacy-first marketing strategies\n\nWhat trends are you seeing? Let me know in the comments! 👇\n\n#DigitalMarketing #MarketingTrends #AI',
    'POST', 'PUBLISHED', 2100, 78, 23, 15, 5.5, NOW() - INTERVAL '3 days', NOW() - INTERVAL '4 days'
  ),
  (
    'cnt_003', 'usr_003', 'lnk_003', 'Building AI Products: Lessons Learned',
    'After launching 3 AI products, here are the key lessons I''ve learned:\n\n1. Start with a clear problem statement\n2. Data quality > Data quantity\n3. User experience is everything\n4. Bias testing is crucial\n5. Iterate based on real user feedback\n\n#AI #ProductManagement #MachineLearning #StartupLife',
    'POST', 'PUBLISHED', 3200, 120, 35, 22, 5.8, NOW() - INTERVAL '2 days', NOW() - INTERVAL '3 days'
  ),
  (
    'cnt_004', 'usr_001', 'lnk_001', 'My Development Setup in 2024',
    'Just updated my development environment. Here''s my current stack:\n\n💻 MacBook Pro M3\n⚡ VS Code with extensions\n🐳 Docker for containerization\n🌳 Git with conventional commits\n☁️ AWS for deployment\n🚀 GitHub Actions for CI/CD\n\nWhat''s in your setup? #DevTools #Programming',
    'POST', 'SCHEDULED', 0, 0, 0, 0, 0.0, NOW() + INTERVAL '1 day', NOW() - INTERVAL '1 day'
  ),
  (
    'cnt_005', 'usr_004', 'lnk_004', 'Scaling Engineering Teams: A CTO''s Perspective',
    'Scaling from 5 to 50 engineers taught me these valuable lessons:\n\n🏗️ Architecture decisions compound over time\n👥 Culture is your most important product\n📊 Metrics matter, but context matters more\n🔄 Process should enable, not hinder\n🎯 Clear communication prevents 90% of issues\n\n#CTO #EngineeringLeadership #TeamScaling',
    'POST', 'PUBLISHED', 4500, 180, 45, 30, 5.7, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert sample automation rules
INSERT INTO automation_rules (
  id, "userId", "linkedinProfileId", name, description, "ruleType", "isActive",
  "triggerConditions", actions, frequency, "maxExecutionsPerDay", "createdAt"
) VALUES
  (
    'auto_001', 'usr_001', 'lnk_001', 'Auto-like tech posts',
    'Automatically like posts from connections in the technology industry',
    'AUTO_LIKE', true,
    '{"keywords": ["technology", "programming", "software"], "connections_only": true, "industries": ["Technology", "Software"]}',
    '{"like": true, "delay_minutes": 5}',
    'DAILY', 50, NOW() - INTERVAL '20 days'
  ),
  (
    'auto_002', 'usr_002', 'lnk_002', 'Engage with marketing content',
    'Auto-engage with marketing and growth-related posts',
    'AUTO_COMMENT', true,
    '{"keywords": ["marketing", "growth", "strategy"], "min_likes": 10}',
    '{"comment_templates": ["Great insights! 👏", "Thanks for sharing this!", "Very valuable perspective 💡"]}',
    'DAILY', 20, NOW() - INTERVAL '15 days'
  ),
  (
    'auto_003', 'usr_003', 'lnk_003', 'Connect with AI professionals',
    'Automatically send connection requests to AI and ML professionals',
    'AUTO_CONNECT', true,
    '{"industries": ["Artificial Intelligence", "Machine Learning"], "job_titles": ["AI Engineer", "Data Scientist", "ML Engineer"]}',
    '{"message": "Hi! I noticed we both work in AI/ML. Would love to connect and share insights!"}',
    'WEEKLY', 10, NOW() - INTERVAL '10 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert sample engagement activities
INSERT INTO engagement_activities (
  id, "linkedinProfileId", "activityType", "targetType", "targetId", "targetUrl",
  message, "isSuccessful", "createdAt"
) VALUES
  (
    'eng_001', 'lnk_001', 'LIKE', 'POST', 'post_12345', 'https://linkedin.com/posts/example-post-1',
    null, true, NOW() - INTERVAL '2 hours'
  ),
  (
    'eng_002', 'lnk_001', 'COMMENT', 'POST', 'post_67890', 'https://linkedin.com/posts/example-post-2',
    'Great insights! Thanks for sharing.', true, NOW() - INTERVAL '4 hours'
  ),
  (
    'eng_003', 'lnk_002', 'LIKE', 'POST', 'post_54321', 'https://linkedin.com/posts/example-post-3',
    null, true, NOW() - INTERVAL '6 hours'
  ),
  (
    'eng_004', 'lnk_003', 'CONNECT', 'PROFILE', 'profile_98765', 'https://linkedin.com/in/example-profile',
    'Hi! Would love to connect and share AI/ML insights.', true, NOW() - INTERVAL '1 day'
  ),
  (
    'eng_005', 'lnk_002', 'SHARE', 'POST', 'post_11111', 'https://linkedin.com/posts/example-post-4',
    'This aligns perfectly with our marketing strategy discussion!', true, NOW() - INTERVAL '8 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert sample usage metrics
INSERT INTO usage_metrics (
  id, "userId", "metricType", "metricValue", "metricUnit", context, timestamp
) VALUES
  ('metric_001', 'usr_001', 'API_USAGE', 150.0, 'requests', '{"endpoint": "/api/content", "method": "GET"}', NOW() - INTERVAL '1 hour'),
  ('metric_002', 'usr_001', 'PROFILE_VIEWS', 25.0, 'views', '{"profile_id": "lnk_001"}', NOW() - INTERVAL '2 hours'),
  ('metric_003', 'usr_002', 'POST_IMPRESSIONS', 2100.0, 'impressions', '{"content_id": "cnt_002"}', NOW() - INTERVAL '3 hours'),
  ('metric_004', 'usr_002', 'ENGAGEMENT_RATE', 5.5, 'percentage', '{"content_id": "cnt_002", "period": "24h"}', NOW() - INTERVAL '4 hours'),
  ('metric_005', 'usr_003', 'CONNECTION_GROWTH', 15.0, 'connections', '{"profile_id": "lnk_003", "period": "week"}', NOW() - INTERVAL '5 hours'),
  ('metric_006', 'usr_004', 'AUTOMATION_EXECUTIONS', 45.0, 'executions', '{"rule_id": "auto_001", "period": "day"}', NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;

-- Insert sample notifications
INSERT INTO notifications (
  id, "userId", title, message, type, priority, "isRead", "createdAt"
) VALUES
  (
    'notif_001', 'usr_001', 'Content Published Successfully',
    'Your post "5 Tips for Better Code Reviews" has been published and is performing well!',
    'CONTENT_PUBLISHED', 'MEDIUM', false, NOW() - INTERVAL '5 days'
  ),
  (
    'notif_002', 'usr_002', 'Automation Rule Completed',
    'Your automation rule "Engage with marketing content" has completed 15 actions today.',
    'AUTOMATION_COMPLETED', 'LOW', true, NOW() - INTERVAL '1 day'
  ),
  (
    'notif_003', 'usr_003', 'Milestone Achievement',
    'Congratulations! Your profile reached 3,000 followers.',
    'MILESTONE_ACHIEVED', 'HIGH', false, NOW() - INTERVAL '2 days'
  ),
  (
    'notif_004', 'usr_004', 'Quota Warning',
    'You are approaching your monthly API usage limit. Consider upgrading your plan.',
    'QUOTA_WARNING', 'HIGH', false, NOW() - INTERVAL '3 hours'
  ),
  (
    'notif_005', 'usr_001', 'New Connection Request',
    'You received a new connection request from Sarah Johnson.',
    'CONNECTION_REQUEST', 'MEDIUM', false, NOW() - INTERVAL '1 hour'
  )
ON CONFLICT (id) DO NOTHING;

-- Update engagement rates for published content
UPDATE content_items 
SET "engagementRate" = ROUND(((likes + comments + shares) * 100.0 / GREATEST(views, 1)), 2)
WHERE status = 'PUBLISHED' AND views > 0;

-- Insert some time-series data for the last 7 days (usage metrics)
DO $$
DECLARE
    user_ids TEXT[] := ARRAY['usr_001', 'usr_002', 'usr_003', 'usr_004'];
    metric_types "MetricType"[] := ARRAY['PROFILE_VIEWS', 'POST_IMPRESSIONS', 'ENGAGEMENT_RATE', 'API_USAGE'];
    i INTEGER;
    j INTEGER;
    k INTEGER;
    random_value NUMERIC;
BEGIN
    FOR i IN 1..7 LOOP
        FOR j IN 1..array_length(user_ids, 1) LOOP
            FOR k IN 1..array_length(metric_types, 1) LOOP
                random_value := CASE metric_types[k]
                    WHEN 'PROFILE_VIEWS' THEN random() * 100 + 10
                    WHEN 'POST_IMPRESSIONS' THEN random() * 1000 + 100
                    WHEN 'ENGAGEMENT_RATE' THEN random() * 10 + 1
                    WHEN 'API_USAGE' THEN random() * 200 + 50
                    ELSE random() * 100
                END;
                
                INSERT INTO usage_metrics (
                    id, "userId", "metricType", "metricValue", timestamp
                ) VALUES (
                    gen_random_uuid()::TEXT,
                    user_ids[j],
                    metric_types[k],
                    ROUND(random_value, 2),
                    NOW() - INTERVAL '1 day' * i + INTERVAL '1 hour' * (random() * 24)::INTEGER
                );
            END LOOP;
        END LOOP;
    END LOOP;
END $$;