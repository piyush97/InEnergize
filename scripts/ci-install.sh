#!/bin/bash

# CI-friendly installation script
# Handles both npm and bun environments

set -e

echo "🚀 Starting CI installation process..."

# Check if we're in a CI environment
if [ "$CI" = "true" ]; then
    echo "📦 CI environment detected"
    
    # Try to use bun if available, fallback to npm
    if command -v bun &> /dev/null; then
        echo "✅ Using Bun for installation"
        bun install --production --frozen-lockfile
    else
        echo "📦 Bun not available, using npm"
        npm ci --audit-level=moderate
    fi
    
    echo "✅ CI installation completed successfully"
else
    echo "🏠 Local development environment detected"
    
    # In local development, use the full setup
    if command -v bun &> /dev/null; then
        echo "✅ Using Bun for local setup"
        bun run setup
    else
        echo "📦 Bun not available, using npm for local setup"
        npm install
        # Try to setup services manually
        if [ -d "services" ]; then
            for service in services/*/; do
                if [ -f "$service/package.json" ]; then
                    echo "Installing dependencies for $(basename $service)"
                    (cd "$service" && npm install) || echo "Failed to install dependencies for $(basename $service)"
                fi
            done
        fi
        
        # Try to setup web
        if [ -d "web" ] && [ -f "web/package.json" ]; then
            echo "Installing web dependencies"
            (cd web && npm install) || echo "Failed to install web dependencies"
        fi
    fi
    
    echo "✅ Local installation completed successfully"
fi

echo "🎉 Installation process finished!"