# Kong Custom Plugins for InErgize Platform

This directory contains custom Kong plugins specifically designed for the InErgize LinkedIn optimization SaaS platform.

## Available Plugins

### linkedin-compliance.lua

A specialized plugin for LinkedIn API compliance monitoring and protection.

#### Features

- **Advanced Rate Limiting**: LinkedIn-specific rate limiting with Redis backend
- **Circuit Breaker**: Automatic service protection during high error rates
- **Compliance Logging**: Detailed logging for audit and compliance purposes
- **Real-time Monitoring**: Track API usage patterns and violations
- **Alert Integration**: Webhook notifications for compliance violations

#### Configuration

```yaml
plugins:
  - name: linkedin-compliance
    config:
      redis_host: redis
      redis_port: 6379
      redis_password: your_redis_password
      redis_database: 2
      max_requests_per_minute: 5
      max_requests_per_hour: 100
      max_requests_per_day: 1000
      circuit_breaker_threshold: 10
      circuit_breaker_timeout: 300
      enable_detailed_logging: true
      alert_webhook_url: https://alerts.example.com/webhook
      compliance_log_level: info
```

#### Usage

The plugin automatically applies to requests routed to the `linkedin-service`. It provides:

1. **Pre-request Validation**:
   - Circuit breaker status check
   - Rate limit validation
   - Compliance logging

2. **Post-response Processing**:
   - Circuit breaker state updates
   - Response logging
   - Error alerting

#### Monitoring

The plugin stores compliance data in Redis with the following keys:

- `linkedin:circuit:{consumer_id}` - Circuit breaker status
- `linkedin:errors:{consumer_id}` - Error tracking
- `linkedin:rate:minute:{consumer_id}:{timestamp}` - Minute-based rate limiting
- `linkedin:rate:hour:{consumer_id}:{timestamp}` - Hour-based rate limiting
- `linkedin:rate:day:{consumer_id}:{timestamp}` - Day-based rate limiting
- `linkedin:compliance:{date}` - Daily compliance logs

## Installation

### Method 1: Volume Mount (Development)

1. Mount the plugins directory in your Kong container:

```yaml
# docker-compose.yml
kong:
  volumes:
    - ./infrastructure/kong/plugins:/usr/local/share/lua/5.1/kong/plugins/custom
  environment:
    KONG_PLUGINS: bundled,linkedin-compliance
    KONG_LUA_PACKAGE_PATH: /usr/local/share/lua/5.1/kong/plugins/custom/?.lua;;
```

### Method 2: Custom Docker Image (Production)

1. Create a custom Kong Docker image:

```dockerfile
FROM kong:latest

# Copy custom plugins
COPY infrastructure/kong/plugins/ /usr/local/share/lua/5.1/kong/plugins/custom/

# Update Kong configuration
ENV KONG_PLUGINS=bundled,linkedin-compliance
ENV KONG_LUA_PACKAGE_PATH=/usr/local/share/lua/5.1/kong/plugins/custom/?.lua;;
```

2. Build and use the custom image:

```bash
docker build -t inergize-kong .
```

### Method 3: Kong Plugin Repository (Future)

For production deployments, consider packaging plugins as rocks and using Kong's plugin installation mechanism.

## Development

### Plugin Structure

Kong plugins follow a specific structure:

```lua
local plugin = {
  PRIORITY = 1000,  -- Execution priority
  VERSION = "1.0.0" -- Plugin version
}

-- Schema definition
plugin.schema = {
  name = "plugin-name",
  fields = {
    -- Configuration fields
  }
}

-- Phase handlers
function plugin:access(config)
  -- Pre-request logic
end

function plugin:log(config)
  -- Post-response logic
end

return plugin
```

### Testing Custom Plugins

1. **Local Testing**:
   ```bash
   # Start Kong with custom plugins
   docker-compose up -d kong
   
   # Test plugin functionality
   curl -X POST http://localhost:8001/services/linkedin-service/plugins \
     -d "name=linkedin-compliance" \
     -d "config.max_requests_per_minute=5"
   ```

2. **Plugin Validation**:
   ```bash
   # Check plugin is loaded
   curl http://localhost:8001/plugins
   
   # Validate configuration
   curl http://localhost:8001/services/linkedin-service/plugins/{plugin-id}
   ```

### Adding New Plugins

1. Create a new `.lua` file in this directory
2. Follow Kong's plugin development guidelines
3. Update the KONG_PLUGINS environment variable
4. Test thoroughly before production deployment

## Best Practices

### Security

- Validate all input parameters
- Use secure Redis connections in production
- Implement proper error handling
- Log security events appropriately

### Performance

- Minimize database/Redis calls
- Use connection pooling
- Implement proper timeout handling
- Consider plugin execution order (PRIORITY)

### Reliability

- Implement circuit breaker patterns
- Provide graceful degradation
- Use appropriate retry mechanisms
- Monitor plugin performance

### Compliance

- Log all relevant compliance events
- Implement audit trails
- Provide compliance reporting capabilities
- Ensure data retention policies

## Troubleshooting

### Common Issues

1. **Plugin Not Loading**:
   - Check KONG_PLUGINS environment variable
   - Verify LUA_PACKAGE_PATH is correct
   - Check plugin syntax with `lua -c plugin.lua`

2. **Redis Connection Issues**:
   - Verify Redis host and port
   - Check authentication credentials
   - Test Redis connectivity from Kong container

3. **Rate Limiting Not Working**:
   - Check Redis key expiration
   - Verify consumer identification
   - Monitor Redis for key creation

### Debugging

1. **Enable Debug Logging**:
   ```yaml
   kong:
     environment:
       KONG_LOG_LEVEL: debug
   ```

2. **Check Plugin Logs**:
   ```bash
   docker logs inergize-kong | grep linkedin-compliance
   ```

3. **Redis Monitoring**:
   ```bash
   docker exec -it inergize-redis redis-cli monitor
   ```

## Future Enhancements

### Planned Features

- **Machine Learning**: Anomaly detection for unusual request patterns
- **Dynamic Rate Limiting**: Adaptive rate limits based on LinkedIn's current policies
- **Advanced Analytics**: Detailed compliance reporting and insights
- **Integration APIs**: RESTful APIs for plugin management and monitoring

### Contributing

When contributing new plugins or enhancements:

1. Follow Kong's coding standards
2. Include comprehensive tests
3. Update documentation
4. Consider backward compatibility
5. Test in multiple environments

## References

- [Kong Plugin Development Guide](https://docs.konghq.com/gateway/latest/plugin-development/)
- [Kong PDK Reference](https://docs.konghq.com/gateway/latest/plugin-development/pdk/)
- [LinkedIn API Documentation](https://docs.microsoft.com/en-us/linkedin/)
- [Redis Lua Scripting](https://redis.io/commands/eval)