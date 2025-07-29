-- LinkedIn Compliance Plugin for Kong
-- Provides enhanced monitoring and safety features for LinkedIn API interactions

local plugin = {
  PRIORITY = 1000,
  VERSION = "1.0.0"
}

-- Plugin configuration schema
plugin.PRIORITY = 1000
plugin.VERSION = "1.0.0"

local kong = kong
local ngx = ngx
local cjson = require "cjson"
local redis = require "resty.redis"

-- Configuration schema
local schema = {
  name = "linkedin-compliance",
  fields = {
    { config = {
        type = "record",
        fields = {
          { redis_host = { type = "string", default = "redis" } },
          { redis_port = { type = "integer", default = 6379 } },
          { redis_password = { type = "string" } },
          { redis_database = { type = "integer", default = 2 } },
          { max_requests_per_minute = { type = "integer", default = 5 } },
          { max_requests_per_hour = { type = "integer", default = 100 } },
          { max_requests_per_day = { type = "integer", default = 1000 } },
          { circuit_breaker_threshold = { type = "integer", default = 10 } },
          { circuit_breaker_timeout = { type = "integer", default = 300 } },
          { enable_detailed_logging = { type = "boolean", default = true } },
          { alert_webhook_url = { type = "string" } },
          { compliance_log_level = { type = "string", default = "info" } }
        }
      }
    }
  }
}

-- Redis connection helper
local function get_redis_connection(config)
  local red = redis:new()
  red:set_timeout(1000) -- 1 second timeout
  
  local ok, err = red:connect(config.redis_host, config.redis_port)
  if not ok then
    kong.log.err("Failed to connect to Redis: ", err)
    return nil, err
  end
  
  if config.redis_password then
    local res, err = red:auth(config.redis_password)
    if not res then
      kong.log.err("Failed to authenticate with Redis: ", err)
      return nil, err
    end
  end
  
  if config.redis_database then
    local res, err = red:select(config.redis_database)
    if not res then
      kong.log.err("Failed to select Redis database: ", err)
      return nil, err
    end
  end
  
  return red
end

-- Circuit breaker check
local function check_circuit_breaker(config, consumer_id)
  local red, err = get_redis_connection(config)
  if not red then
    return false, err
  end
  
  local circuit_key = "linkedin:circuit:" .. consumer_id
  local circuit_status, err = red:get(circuit_key)
  
  if circuit_status == "open" then
    kong.log.warn("Circuit breaker is open for consumer: ", consumer_id)
    return false, "Circuit breaker is open"
  end
  
  -- Always close connection
  red:set_keepalive(10000, 100)
  return true
end

-- Update circuit breaker based on response status
local function update_circuit_breaker(config, consumer_id, status_code)
  local red, err = get_redis_connection(config)
  if not red then
    return
  end
  
  local circuit_key = "linkedin:circuit:" .. consumer_id
  local error_key = "linkedin:errors:" .. consumer_id
  
  -- Track errors for circuit breaker
  if status_code >= 400 then
    local error_count, err = red:incr(error_key)
    red:expire(error_key, 300) -- 5 minute window
    
    if error_count >= config.circuit_breaker_threshold then
      -- Open circuit breaker
      red:setex(circuit_key, config.circuit_breaker_timeout, "open")
      kong.log.warn("Circuit breaker opened for consumer: ", consumer_id, " after ", error_count, " errors")
      
      -- Send alert if webhook configured
      if config.alert_webhook_url then
        local alert_data = {
          event = "circuit_breaker_opened",
          consumer_id = consumer_id,
          error_count = error_count,
          timestamp = ngx.time()
        }
        -- Note: In production, you'd use ngx.timer.at to send this asynchronously
        kong.log.info("Circuit breaker alert: ", cjson.encode(alert_data))
      end
    end
  else
    -- Reset error count on successful response
    red:del(error_key)
  end
  
  red:set_keepalive(10000, 100)
end

-- Rate limiting check with LinkedIn-specific logic
local function check_rate_limits(config, consumer_id)
  local red, err = get_redis_connection(config)
  if not red then
    return true -- Allow request if Redis is unavailable (fail open)
  end
  
  local current_time = ngx.time()
  local minute_key = "linkedin:rate:minute:" .. consumer_id .. ":" .. math.floor(current_time / 60)
  local hour_key = "linkedin:rate:hour:" .. consumer_id .. ":" .. math.floor(current_time / 3600)
  local day_key = "linkedin:rate:day:" .. consumer_id .. ":" .. math.floor(current_time / 86400)
  
  -- Check all time windows
  local minute_count = red:get(minute_key) or 0
  local hour_count = red:get(hour_key) or 0
  local day_count = red:get(day_key) or 0
  
  -- Convert to numbers
  minute_count = tonumber(minute_count) or 0
  hour_count = tonumber(hour_count) or 0
  day_count = tonumber(day_count) or 0
  
  -- Check limits
  if minute_count >= config.max_requests_per_minute then
    kong.log.warn("LinkedIn rate limit exceeded (minute): ", consumer_id, " - ", minute_count)
    red:set_keepalive(10000, 100)
    return false, "Minute rate limit exceeded"
  end
  
  if hour_count >= config.max_requests_per_hour then
    kong.log.warn("LinkedIn rate limit exceeded (hour): ", consumer_id, " - ", hour_count)
    red:set_keepalive(10000, 100)
    return false, "Hour rate limit exceeded"
  end
  
  if day_count >= config.max_requests_per_day then
    kong.log.warn("LinkedIn rate limit exceeded (day): ", consumer_id, " - ", day_count)
    red:set_keepalive(10000, 100)
    return false, "Day rate limit exceeded"
  end
  
  -- Increment counters
  red:incr(minute_key)
  red:expire(minute_key, 60)
  red:incr(hour_key)
  red:expire(hour_key, 3600)
  red:incr(day_key)
  red:expire(day_key, 86400)
  
  red:set_keepalive(10000, 100)
  return true
end

-- Log LinkedIn API request for compliance
local function log_linkedin_request(config, consumer_id, request_data)
  if not config.enable_detailed_logging then
    return
  end
  
  local log_entry = {
    timestamp = ngx.time(),
    consumer_id = consumer_id,
    method = ngx.var.request_method,
    uri = ngx.var.request_uri,
    user_agent = ngx.var.http_user_agent,
    remote_addr = ngx.var.remote_addr,
    request_id = kong.request.get_header("X-Request-ID"),
    compliance_check = "passed"
  }
  
  -- Log at appropriate level
  if config.compliance_log_level == "debug" then
    kong.log.debug("LinkedIn API Request: ", cjson.encode(log_entry))
  else
    kong.log.info("LinkedIn API Request: ", cjson.encode(log_entry))
  end
  
  -- Store in Redis for compliance reporting
  local red, err = get_redis_connection(config)
  if red then
    local compliance_key = "linkedin:compliance:" .. os.date("%Y-%m-%d")
    red:lpush(compliance_key, cjson.encode(log_entry))
    red:expire(compliance_key, 2592000) -- 30 days retention
    red:set_keepalive(10000, 100)
  end
end

-- Access phase - before request is proxied
function plugin:access(config)
  -- Only process LinkedIn service requests
  local service = kong.router.get_service()
  if not service or service.name ~= "linkedin-service" then
    return
  end
  
  -- Get consumer ID
  local consumer = kong.client.get_consumer()
  local consumer_id = consumer and consumer.id or "anonymous"
  
  -- Check circuit breaker
  local circuit_ok, circuit_err = check_circuit_breaker(config, consumer_id)
  if not circuit_ok then
    kong.response.exit(503, {
      message = "Service temporarily unavailable due to circuit breaker",
      error = "service_unavailable",
      retry_after = config.circuit_breaker_timeout
    })
    return
  end
  
  -- Check rate limits
  local rate_ok, rate_err = check_rate_limits(config, consumer_id)
  if not rate_ok then
    kong.response.exit(429, {
      message = rate_err,
      error = "too_many_requests",
      retry_after = 60
    })
    return
  end
  
  -- Log request for compliance
  log_linkedin_request(config, consumer_id, {
    allowed = true,
    checks_passed = {"circuit_breaker", "rate_limiting"}
  })
  
  -- Add compliance headers
  kong.service.request.set_header("X-LinkedIn-Compliance", "monitored")
  kong.service.request.set_header("X-Consumer-ID", consumer_id)
  kong.service.request.set_header("X-Request-Timestamp", ngx.time())
end

-- Log phase - after response is received
function plugin:log(config)
  -- Only process LinkedIn service requests
  local service = kong.router.get_service()
  if not service or service.name ~= "linkedin-service" then
    return
  end
  
  local consumer = kong.client.get_consumer()
  local consumer_id = consumer and consumer.id or "anonymous"
  local status_code = kong.response.get_status()
  
  -- Update circuit breaker based on response
  update_circuit_breaker(config, consumer_id, status_code)
  
  -- Log response for compliance
  if config.enable_detailed_logging then
    local log_entry = {
      timestamp = ngx.time(),
      consumer_id = consumer_id,
      status_code = status_code,
      response_time = kong.ctx.shared.response_time or 0,
      upstream_response_time = kong.response.get_header("X-Kong-Upstream-Latency"),
      proxy_latency = kong.response.get_header("X-Kong-Proxy-Latency")
    }
    
    kong.log.info("LinkedIn API Response: ", cjson.encode(log_entry))
    
    -- Store compliance log
    local red, err = get_redis_connection(config)
    if red then
      local compliance_key = "linkedin:compliance:responses:" .. os.date("%Y-%m-%d")
      red:lpush(compliance_key, cjson.encode(log_entry))
      red:expire(compliance_key, 2592000) -- 30 days retention
      red:set_keepalive(10000, 100)
    end
  end
  
  -- Alert on LinkedIn API errors
  if status_code == 429 then
    kong.log.warn("LinkedIn API rate limit hit for consumer: ", consumer_id)
    
    if config.alert_webhook_url then
      local alert_data = {
        event = "linkedin_rate_limit_hit",
        consumer_id = consumer_id,
        timestamp = ngx.time(),
        status_code = status_code
      }
      kong.log.info("LinkedIn rate limit alert: ", cjson.encode(alert_data))
    end
  elseif status_code >= 500 then
    kong.log.err("LinkedIn API server error for consumer: ", consumer_id, " - Status: ", status_code)
  end
end

-- Return the plugin table
plugin.schema = schema
return plugin