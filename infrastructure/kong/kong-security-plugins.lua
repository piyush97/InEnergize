-- Custom Kong Security Plugins for InErgize
-- Implements LinkedIn compliance monitoring and advanced security features

local kong = kong
local ngx = ngx
local redis = require "resty.redis"
local json = require "cjson"

-- LinkedIn Compliance Monitor Plugin
local LinkedInCompliancePlugin = {
  PRIORITY = 1000,
  VERSION = "1.0.0"
}

function LinkedInCompliancePlugin:access(conf)
  local red = redis:new()
  red:set_timeout(1000) -- 1 second timeout
  
  local ok, err = red:connect(conf.redis_host, conf.redis_port)
  if not ok then
    kong.log.err("Failed to connect to Redis: ", err)
    return
  end
  
  if conf.redis_password then
    local res, err = red:auth(conf.redis_password)
    if not res then
      kong.log.err("Failed to authenticate with Redis: ", err)
      return
    end
  end
  
  -- Select LinkedIn compliance database
  red:select(conf.redis_database or 10)
  
  local request_uri = ngx.var.request_uri
  local client_ip = ngx.var.remote_addr
  local user_agent = ngx.var.http_user_agent or ""
  local user_id = kong.ctx.shared.authenticated_user_id
  
  -- Check if this is a LinkedIn automation request
  if string.match(request_uri, "/linkedin/automation") then
    local current_time = ngx.time()
    local minute_key = "linkedin:automation:" .. (user_id or client_ip) .. ":" .. math.floor(current_time / 60)
    local hour_key = "linkedin:automation:" .. (user_id or client_ip) .. ":" .. math.floor(current_time / 3600)
    local day_key = "linkedin:automation:" .. (user_id or client_ip) .. ":" .. math.floor(current_time / 86400)
    
    -- Increment counters
    local minute_count = red:incr(minute_key)
    red:expire(minute_key, 60)
    
    local hour_count = red:incr(hour_key)
    red:expire(hour_key, 3600)
    
    local day_count = red:incr(day_key)
    red:expire(day_key, 86400)
    
    -- LinkedIn compliance limits (15% of LinkedIn's actual limits)
    local minute_limit = 1
    local hour_limit = 15
    local day_limit = 100
    
    -- Check limits
    if minute_count > minute_limit or hour_count > hour_limit or day_count > day_limit then
      -- Log compliance violation
      local violation_data = {
        timestamp = current_time,
        user_id = user_id,
        client_ip = client_ip,
        user_agent = user_agent,
        violation_type = "rate_limit_exceeded",
        limits = {
          minute = {current = minute_count, limit = minute_limit},
          hour = {current = hour_count, limit = hour_limit},
          day = {current = day_count, limit = day_limit}
        },
        severity = "high"
      }
      
      red:lpush("linkedin:violations", json.encode(violation_data))
      red:ltrim("linkedin:violations", 0, 999) -- Keep last 1000 violations
      
      -- Update user health score
      local health_key = "user:health:" .. (user_id or client_ip)
      local current_health = tonumber(red:get(health_key)) or 100
      local new_health = math.max(0, current_health - 10)
      red:setex(health_key, 86400, new_health)
      
      -- Block request if health score too low
      if new_health < 40 then
        kong.log.warn("LinkedIn automation blocked - health score too low: ", new_health)
        return kong.response.exit(429, {
          error = "LinkedIn automation suspended due to compliance violations",
          health_score = new_health,
          retry_after = 3600
        })
      end
      
      -- Rate limit exceeded
      kong.log.warn("LinkedIn automation rate limit exceeded")
      return kong.response.exit(429, {
        error = "LinkedIn automation rate limit exceeded - compliance protection active",
        limits = violation_data.limits,
        retry_after = 3600
      })
    end
    
    -- Log successful automation request
    local success_data = {
      timestamp = current_time,
      user_id = user_id,
      client_ip = client_ip,
      request_uri = request_uri,
      counts = {
        minute = minute_count,
        hour = hour_count,
        day = day_count
      }
    }
    
    red:lpush("linkedin:automation:log", json.encode(success_data))
    red:ltrim("linkedin:automation:log", 0, 9999) -- Keep last 10000 requests
    
    -- Add compliance headers
    kong.response.set_header("X-LinkedIn-Compliance", "active")
    kong.response.set_header("X-Automation-Health-Score", red:get("user:health:" .. (user_id or client_ip)) or "100")
    kong.response.set_header("X-Daily-Automation-Count", day_count)
    kong.response.set_header("X-Daily-Automation-Limit", day_limit)
  end
  
  -- Close Redis connection
  red:close()
end

-- Security Event Logger Plugin
local SecurityEventLoggerPlugin = {
  PRIORITY = 999,
  VERSION = "1.0.0"
}

function SecurityEventLoggerPlugin:access(conf)
  local client_ip = ngx.var.remote_addr
  local user_agent = ngx.var.http_user_agent or ""
  local request_method = ngx.var.request_method
  local request_uri = ngx.var.request_uri
  local user_id = kong.ctx.shared.authenticated_user_id
  
  -- Detect suspicious patterns
  local suspicious_patterns = {
    "sqlmap",
    "nikto",
    "nmap", 
    "sqlinjection",
    "xss",
    "../../../",
    "eval\\(",
    "base64_decode",
    "system\\(",
    "exec\\(",
    "passthru\\(",
    "shell_exec"
  }
  
  local is_suspicious = false
  for _, pattern in ipairs(suspicious_patterns) do
    if string.match(string.lower(user_agent .. request_uri), pattern) then
      is_suspicious = true
      break
    end
  end
  
  -- Log security events
  if is_suspicious then
    local red = redis:new()
    red:set_timeout(1000)
    
    local ok, err = red:connect(conf.redis_host, conf.redis_port)
    if ok then
      if conf.redis_password then
        red:auth(conf.redis_password)
      end
      
      red:select(conf.redis_database or 11)
      
      local security_event = {
        timestamp = ngx.time(),
        event_type = "suspicious_request",
        severity = "high",
        source_ip = client_ip,
        user_agent = user_agent,
        request_method = request_method,
        request_uri = request_uri,
        user_id = user_id,
        detected_patterns = suspicious_patterns
      }
      
      red:lpush("security:events", json.encode(security_event))
      red:ltrim("security:events", 0, 9999)
      
      -- Increment threat score
      local threat_key = "threat:score:" .. client_ip
      local threat_score = red:incr(threat_key)
      red:expire(threat_key, 3600) -- 1 hour window
      
      -- Block if threat score too high
      if threat_score > 5 then
        kong.log.err("Blocking high-threat IP: ", client_ip)
        red:setex("blocked:ip:" .. client_ip, 86400, "high_threat_score") -- Block for 24 hours
        
        red:close()
        return kong.response.exit(403, {
          error = "Access denied due to security policy violation",
          request_id = kong.ctx.shared.request_id
        })
      end
      
      red:close()
    end
  end
end

-- Real-time Health Monitor Plugin
local HealthMonitorPlugin = {
  PRIORITY = 998,
  VERSION = "1.0.0"
}

function HealthMonitorPlugin:access(conf)
  local service_name = kong.router.get_service().name
  local current_time = ngx.time()
  
  local red = redis:new()
  red:set_timeout(500)
  
  local ok, err = red:connect(conf.redis_host, conf.redis_port)
  if ok then
    if conf.redis_password then
      red:auth(conf.redis_password)
    end
    
    red:select(conf.redis_database or 12)
    
    -- Track service health metrics
    local health_key = "service:health:" .. service_name
    local metrics = {
      timestamp = current_time,
      request_count = red:incr(health_key .. ":requests") or 1,
      last_request = current_time
    }
    
    red:expire(health_key .. ":requests", 300) -- 5 minute window
    red:setex(health_key .. ":last_request", 300, current_time)
    
    -- Store in service context for response handling
    kong.ctx.shared.health_start_time = ngx.now()
    kong.ctx.shared.service_health_key = health_key
    
    red:close()
  end
end

function HealthMonitorPlugin:header_filter(conf)
  local status = ngx.status
  local response_time = (ngx.now() - (kong.ctx.shared.health_start_time or ngx.now())) * 1000
  local health_key = kong.ctx.shared.service_health_key
  
  if health_key then
    local red = redis:new()
    red:set_timeout(500)
    
    local ok, err = red:connect(conf.redis_host, conf.redis_port)
    if ok then
      if conf.redis_password then
        red:auth(conf.redis_password)
      end
      
      red:select(conf.redis_database or 12)
      
      -- Track error rates
      if status >= 500 then
        red:incr(health_key .. ":errors")
        red:expire(health_key .. ":errors", 300)
      end
      
      -- Track response times
      red:lpush(health_key .. ":response_times", response_time)
      red:ltrim(health_key .. ":response_times", 0, 99) -- Keep last 100 response times
      red:expire(health_key .. ":response_times", 300)
      
      red:close()
    end
  end
  
  -- Add health headers
  kong.response.set_header("X-Response-Time", string.format("%.2fms", response_time))
  kong.response.set_header("X-Request-ID", kong.ctx.shared.request_id or "unknown")
end

-- Export plugins
return {
  ["linkedin-compliance"] = LinkedInCompliancePlugin,
  ["security-event-logger"] = SecurityEventLoggerPlugin,
  ["health-monitor"] = HealthMonitorPlugin
}