# Kong Manager Dashboard Setup Guide

Your current Kong setup uses **DB-less mode** which doesn't support the web dashboard. This guide shows you how to enable Kong Manager (the web UI).

## 🚀 Quick Setup (Recommended)

### Option 1: Use the Setup Script

```bash
# Run the automated setup script
./scripts/kong-manager-setup.sh
```

### Option 2: Manual Setup

```bash
# 1. Stop current Kong
docker-compose down kong

# 2. Start Kong with Manager UI
docker-compose -f docker-compose.yml -f docker-compose.kong-manager.yml up -d

# 3. Wait for services to start (about 30 seconds)
# 4. Access the dashboard at: http://localhost:8002
```

## 🌐 Access Information

Once running, you can access:

- **🎯 Kong Manager Dashboard**: http://localhost:8002
- **🔧 Kong Admin API**: http://localhost:8001  
- **🚀 Kong Proxy**: http://localhost:8000

## 📊 What Changed?

The new setup:
- ✅ Adds a PostgreSQL database for Kong (port 5434)
- ✅ Enables Kong Manager web UI (port 8002)
- ✅ Migrates your existing configuration automatically
- ✅ Keeps all your current services working

## 🔧 Configuration Management

### Via Web Dashboard (Easy)
1. Open http://localhost:8002
2. Navigate to "Services" → "Routes" → "Plugins"
3. Configure visually with forms and dropdowns

### Via Admin API (Advanced)
```bash
# View current configuration
curl http://localhost:8001/services
curl http://localhost:8001/routes
curl http://localhost:8001/plugins

# Add a new service
curl -X POST http://localhost:8001/services \
  -H "Content-Type: application/json" \
  -d '{"name": "my-service", "url": "http://backend:3000"}'
```

## 🛠️ Troubleshooting

### Dashboard Not Loading?
```bash
# Check Kong status
docker-compose logs kong

# Verify Kong is running
curl http://localhost:8001/status

# Restart if needed
docker-compose restart kong
```

### Want to Switch Back?
```bash
# Return to DB-less mode
docker-compose -f docker-compose.yml up -d kong
```

### Port Conflicts?
The setup uses these ports:
- 5434: Kong database (separate from your main DB on 5432)
- 8000: Kong proxy (same as before)
- 8001: Kong admin API (same as before)  
- 8002: Kong Manager UI (new)

## 📝 Notes

- **Development Mode**: Authentication is disabled for ease of use
- **Production**: You'd want to enable RBAC and proper authentication
- **Data Persistence**: Kong configuration is stored in the database
- **Migration**: Your existing routes/services/plugins are preserved

## 🎉 Next Steps

1. Access http://localhost:8002
2. Explore the Kong Manager interface
3. Configure your services visually
4. Set up rate limiting, authentication, etc.

Happy API management! 🚀