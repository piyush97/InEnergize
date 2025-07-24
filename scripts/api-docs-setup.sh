#!/bin/bash

# InErgize API Documentation Setup Script
# Sets up Swagger UI, generates client SDKs, and configures API testing tools

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
DOCS_PORT=8080
API_SPEC_FILE="docs/api.yml"

# Function to print with colors
print_header() {
    echo -e "${PURPLE}📚 $1${NC}"
    echo "$(printf '=%.0s' {1..50})"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_step() {
    echo -e "${BLUE}📋 Step ${1}:${NC} $2"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    local errors=0
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version | sed 's/v//')
        print_success "Node.js $NODE_VERSION"
    else
        print_error "Node.js is not installed"
        ((errors++))
    fi
    
    # Check npm
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        print_success "npm $NPM_VERSION"
    else
        print_error "npm is not installed"
        ((errors++))
    fi
    
    # Check Docker
    if command -v docker >/dev/null 2>&1; then
        if docker info >/dev/null 2>&1; then
            print_success "Docker is running"
        else
            print_warning "Docker is not running (optional)"
        fi
    else
        print_warning "Docker is not installed (optional)"
    fi
    
    # Check API specification file
    if [[ -f "$API_SPEC_FILE" ]]; then
        print_success "API specification file exists"
    else
        print_error "API specification file not found: $API_SPEC_FILE"
        ((errors++))
    fi
    
    if [[ $errors -gt 0 ]]; then
        print_error "Prerequisites check failed"
        exit 1
    fi
    
    print_success "All prerequisites satisfied"
    echo
}

# Install documentation tools
install_tools() {
    print_header "Installing Documentation Tools"
    
    print_step "1" "Installing OpenAPI tools"
    npm install -g @apidevtools/swagger-parser
    npm install -g swagger-ui-dist
    npm install -g @openapitools/openapi-generator-cli
    npm install -g redoc-cli
    print_success "OpenAPI tools installed"
    
    print_step "2" "Installing API testing tools"
    npm install -g newman
    npm install -g dredd
    npm install -g @stoplight/spectral-cli
    print_success "API testing tools installed"
    
    print_step "3" "Installing local development dependencies"
    if [[ ! -f "package.json" ]]; then
        npm init -y
    fi
    
    npm install --save-dev \
        swagger-ui-express \
        swagger-jsdoc \
        redoc-express \
        openapi-types \
        @types/swagger-ui-express
    
    print_success "Local dependencies installed"
    echo
}

# Validate API specification
validate_spec() {
    print_header "Validating API Specification"
    
    print_step "1" "Parsing OpenAPI specification"
    if swagger-parser validate "$API_SPEC_FILE"; then
        print_success "API specification is valid"
    else
        print_error "API specification validation failed"
        exit 1
    fi
    
    print_step "2" "Running Spectral linting"
    if spectral lint "$API_SPEC_FILE" --format=pretty; then
        print_success "Spectral linting passed"
    else
        print_warning "Spectral linting found issues (check output above)"
    fi
    
    print_step "3" "Checking API design guidelines"
    # Custom validation rules
    if grep -q "bearerAuth" "$API_SPEC_FILE"; then
        print_success "Authentication scheme defined"
    else
        print_warning "No authentication scheme found"
    fi
    
    if grep -q "description:" "$API_SPEC_FILE"; then
        print_success "API descriptions found"
    else
        print_warning "Missing API descriptions"
    fi
    
    echo
}

# Setup Swagger UI
setup_swagger_ui() {
    print_header "Setting Up Swagger UI"
    
    print_step "1" "Creating documentation directory"
    mkdir -p public/docs
    mkdir -p docs/generated
    
    print_step "2" "Copying Swagger UI assets"
    cp -r "$(npm root -g)/swagger-ui-dist"/* public/docs/
    
    # Customize Swagger UI
    cat > public/docs/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>InErgize API Documentation</title>
    <link rel="stylesheet" type="text/css" href="./swagger-ui-bundle.css" />
    <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="./favicon-16x16.png" sizes="16x16" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
        .swagger-ui .topbar {
            background-color: #0077B5;
        }
        .swagger-ui .topbar .download-url-wrapper .select-label {
            color: white;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="./swagger-ui-bundle.js" charset="UTF-8"> </script>
    <script src="./swagger-ui-standalone-preset.js" charset="UTF-8"> </script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/docs/api.yml',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                tryItOutEnabled: true,
                requestInterceptor: function(request) {
                    // Add default headers
                    request.headers['Content-Type'] = 'application/json';
                    return request;
                },
                responseInterceptor: function(response) {
                    // Log API calls in development
                    if (window.location.hostname === 'localhost') {
                        console.log('API Response:', response);
                    }
                    return response;
                }
            });
        };
    </script>
</body>
</html>
EOF
    
    # Copy API specification
    cp "$API_SPEC_FILE" public/docs/api.yml
    
    print_success "Swagger UI setup complete"
    echo
}

# Setup ReDoc
setup_redoc() {
    print_header "Setting Up ReDoc"
    
    print_step "1" "Generating ReDoc HTML"
    redoc-cli build "$API_SPEC_FILE" \
        --title="InErgize API Documentation" \
        --options.theme.colors.primary.main="#0077B5" \
        --options.hideDownloadButton=false \
        --output=public/docs/redoc.html
    
    print_success "ReDoc documentation generated"
    echo
}

# Generate client SDKs
generate_sdks() {
    print_header "Generating Client SDKs"
    
    # Create SDK directory
    mkdir -p docs/generated/sdks
    
    # Generate JavaScript/TypeScript SDK
    print_step "1" "Generating JavaScript/TypeScript SDK"
    openapi-generator-cli generate \
        -i "$API_SPEC_FILE" \
        -g typescript-axios \
        -o docs/generated/sdks/typescript \
        --additional-properties=npmName=inergize-api-client,npmVersion=1.0.0
    
    # Generate Python SDK
    print_step "2" "Generating Python SDK"
    openapi-generator-cli generate \
        -i "$API_SPEC_FILE" \
        -g python \
        -o docs/generated/sdks/python \
        --additional-properties=packageName=inergize_api_client,packageVersion=1.0.0
    
    # Generate cURL examples
    print_step "3" "Generating cURL examples"
    openapi-generator-cli generate \
        -i "$API_SPEC_FILE" \
        -g bash \
        -o docs/generated/sdks/curl
    
    print_success "Client SDKs generated"
    echo
}

# Setup API testing
setup_testing() {
    print_header "Setting Up API Testing"
    
    print_step "1" "Creating Postman collection"
    # Generate Postman collection from OpenAPI spec
    npx openapi-to-postman -s "$API_SPEC_FILE" -o docs/generated/inergize-api.postman_collection.json
    
    # Create Postman environment
    cat > docs/generated/inergize-api.postman_environment.json << 'EOF'
{
    "id": "inergize-api-env",
    "name": "InErgize API Environment",
    "values": [
        {
            "key": "baseUrl",
            "value": "http://localhost:8000/v1",
            "enabled": true
        },
        {
            "key": "accessToken",
            "value": "",
            "enabled": true
        },
        {
            "key": "userId",
            "value": "",
            "enabled": true
        }
    ]
}
EOF
    
    print_step "2" "Creating test scripts"
    mkdir -p tests/api
    
    # Create Newman test script
    cat > tests/api/run-postman-tests.sh << 'EOF'
#!/bin/bash

# Run Postman collection tests using Newman

COLLECTION="docs/generated/inergize-api.postman_collection.json"
ENVIRONMENT="docs/generated/inergize-api.postman_environment.json"
REPORTS_DIR="test-results/api"

mkdir -p $REPORTS_DIR

echo "Running InErgize API tests with Newman..."

newman run $COLLECTION \
    --environment $ENVIRONMENT \
    --reporters html,json,cli \
    --reporter-html-export $REPORTS_DIR/newman-report.html \
    --reporter-json-export $REPORTS_DIR/newman-report.json \
    --timeout 30000 \
    --delay-request 100

echo "API tests completed. Reports available in $REPORTS_DIR"
EOF
    
    chmod +x tests/api/run-postman-tests.sh
    
    # Create Dredd test configuration
    cat > dredd.yml << 'EOF'
reporter: html
output:
  - test-results/api/dredd-report.html
dry-run: false
hookfiles: tests/api/dredd-hooks.js
language: nodejs
sandbox: false
server: npm start
server-wait: 30
init: false
custom:
  apiaryApiKey: ''
  apiaryApiName: ''
options:
  method: []
  only: []
  header: []
  sorted: false
  user: null
  inline-errors: false
  details: false
  fail-fast: false
  reporter: []
  output: []
  header: []
  level: info
  timestamp: false
EOF
    
    # Create Dredd hooks
    mkdir -p tests/api
    cat > tests/api/dredd-hooks.js << 'EOF'
const hooks = require('hooks');

let authToken = null;

// Before all tests, authenticate
hooks.beforeAll(function(transactions, done) {
    console.log('Authenticating for API tests...');
    
    const request = require('request');
    request.post({
        url: 'http://localhost:8000/v1/auth/login',
        json: {
            email: 'test@example.com',
            password: 'TestPassword123!'
        }
    }, function(error, response, body) {
        if (error) {
            console.error('Authentication failed:', error);
            return done(error);
        }
        
        if (body && body.accessToken) {
            authToken = body.accessToken;
            console.log('Authentication successful');
        }
        
        done();
    });
});

// Add auth header to all requests
hooks.beforeEach(function(transaction, done) {
    if (authToken && !transaction.skip) {
        transaction.request.headers['Authorization'] = `Bearer ${authToken}`;
    }
    done();
});

// Skip tests that require specific setup
hooks.before('/auth/register > POST > 201', function(transaction) {
    transaction.skip = true; // Skip to avoid duplicate user creation
});

hooks.before('/auth/login > POST > 401', function(transaction) {
    transaction.skip = true; // Skip invalid credentials test
});
EOF
    
    print_success "API testing setup complete"
    echo
}

# Create documentation server
create_docs_server() {
    print_header "Creating Documentation Server"
    
    print_step "1" "Creating Express server for docs"
    cat > docs-server.js << 'EOF'
const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();
const PORT = process.env.DOCS_PORT || 8080;

// Load OpenAPI specification
const swaggerSpec = YAML.load('./docs/api.yml');

// Serve static files
app.use('/docs', express.static('public/docs'));
app.use('/generated', express.static('docs/generated'));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { background-color: #0077B5; }',
    customSiteTitle: 'InErgize API Documentation',
    customfavIcon: '/docs/favicon-32x32.png'
}));

// ReDoc
app.get('/redoc', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/docs/redoc.html'));
});

// API specification endpoints
app.get('/openapi.json', (req, res) => {
    res.json(swaggerSpec);
});

app.get('/openapi.yaml', (req, res) => {
    res.type('application/x-yaml');
    res.sendFile(path.join(__dirname, 'docs/api.yml'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'docs-server',
        timestamp: new Date().toISOString()
    });
});

// Root redirect
app.get('/', (req, res) => {
    res.redirect('/api-docs');
});

app.listen(PORT, () => {
    console.log(`📚 InErgize API Documentation Server running on port ${PORT}`);
    console.log(`🔗 Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`🔗 ReDoc: http://localhost:${PORT}/redoc`);
    console.log(`🔗 OpenAPI Spec: http://localhost:${PORT}/openapi.json`);
});
EOF
    
    print_step "2" "Adding documentation scripts to package.json"
    # Add scripts to package.json
    npx json -I -f package.json -e '
        this.scripts = this.scripts || {};
        this.scripts["docs:serve"] = "node docs-server.js";
        this.scripts["docs:build"] = "./scripts/api-docs-setup.sh";
        this.scripts["docs:validate"] = "swagger-parser validate docs/api.yml";
        this.scripts["docs:test"] = "./tests/api/run-postman-tests.sh";
        this.scripts["docs:generate-sdks"] = "openapi-generator-cli generate -i docs/api.yml -g typescript-axios -o docs/generated/sdks/typescript";
    '
    
    print_success "Documentation server created"
    echo
}

# Setup continuous integration for docs
setup_docs_ci() {
    print_header "Setting Up Documentation CI"
    
    print_step "1" "Creating GitHub Actions workflow for docs"
    mkdir -p .github/workflows
    
    cat > .github/workflows/docs.yml << 'EOF'
name: API Documentation

on:
  push:
    branches: [main, develop]
    paths: ['docs/**', 'scripts/api-docs-setup.sh']
  pull_request:
    branches: [main, develop]
    paths: ['docs/**']

jobs:
  validate-docs:
    name: Validate Documentation
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          npm install -g @apidevtools/swagger-parser @stoplight/spectral-cli

      - name: Validate OpenAPI specification
        run: |
          swagger-parser validate docs/api.yml
          spectral lint docs/api.yml --format=pretty

      - name: Generate documentation
        run: |
          ./scripts/api-docs-setup.sh --validate-only
          
      - name: Upload documentation artifacts
        uses: actions/upload-artifact@v4
        with:
          name: api-documentation
          path: |
            public/docs/
            docs/generated/

  deploy-docs:
    name: Deploy Documentation
    runs-on: ubuntu-latest
    needs: validate-docs
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Build documentation
        run: |
          npm ci
          ./scripts/api-docs-setup.sh

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public/docs
          cname: docs.inergize.com
EOF
    
    print_success "Documentation CI setup complete"
    echo
}

# Generate summary
generate_summary() {
    print_header "Setup Complete! 📖"
    
    echo -e "${GREEN}✨ InErgize API documentation and testing tools are ready!${NC}"
    echo
    echo "📍 Documentation URLs:"
    echo "  • Swagger UI:         http://localhost:$DOCS_PORT/api-docs"
    echo "  • ReDoc:              http://localhost:$DOCS_PORT/redoc"
    echo "  • OpenAPI Spec:       http://localhost:$DOCS_PORT/openapi.json"
    echo "  • Documentation:      http://localhost:$DOCS_PORT/docs"
    echo
    echo "🔧 Generated Assets:"
    echo "  • TypeScript SDK:     docs/generated/sdks/typescript/"
    echo "  • Python SDK:         docs/generated/sdks/python/"
    echo "  • cURL Examples:      docs/generated/sdks/curl/"
    echo "  • Postman Collection: docs/generated/inergize-api.postman_collection.json"
    echo
    echo "🧪 Testing Tools:"
    echo "  • Newman Tests:       npm run docs:test"
    echo "  • Dredd Tests:        dredd"
    echo "  • Spec Validation:    npm run docs:validate"
    echo
    echo "🚀 Quick Commands:"
    echo "  • Start docs server:  npm run docs:serve"
    echo "  • Validate API spec:  npm run docs:validate"
    echo "  • Run API tests:      npm run docs:test"
    echo "  • Generate SDKs:      npm run docs:generate-sdks"
    echo
    echo "💡 Next Steps:"
    echo "  1. Start the documentation server: npm run docs:serve"
    echo "  2. Visit http://localhost:$DOCS_PORT/api-docs"
    echo "  3. Test API endpoints using the interactive documentation"
    echo "  4. Run API tests: npm run docs:test"
    echo
    print_success "Happy documenting! 📚"
}

# Error handler
handle_error() {
    print_error "Setup failed at line $1"
    echo
    print_info "Troubleshooting:"
    echo "  • Check Node.js and npm are properly installed"
    echo "  • Ensure the API specification file exists and is valid"
    echo "  • Verify network connectivity for package downloads"
    exit 1
}

# Set up error handling
trap 'handle_error $LINENO' ERR

# Main setup function
main() {
    clear
    echo -e "${PURPLE}"
    echo "📚 InErgize API Documentation & Testing Setup"
    echo "============================================="
    echo -e "${NC}"
    echo
    
    # Check if user wants to continue
    if [[ "${1:-}" != "--yes" && "${1:-}" != "-y" && "${1:-}" != "--validate-only" ]]; then
        echo "This script will set up comprehensive API documentation and testing tools."
        echo "This includes Swagger UI, ReDoc, client SDKs, and API testing frameworks."
        echo
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Setup cancelled."
            exit 0
        fi
        echo
    fi
    
    # Run setup steps
    check_prerequisites
    validate_spec
    
    if [[ "${1:-}" != "--validate-only" ]]; then
        install_tools
        setup_swagger_ui
        setup_redoc
        generate_sdks
        setup_testing
        create_docs_server
        setup_docs_ci
        generate_summary
    else
        print_success "Validation completed successfully"
    fi
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "InErgize API Documentation & Testing Setup"
        echo
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --yes, -y           Skip confirmation prompt"
        echo "  --validate-only     Only validate API specification"
        echo "  --help, -h          Show this help"
        echo
        echo "This script will:"
        echo "  • Validate OpenAPI specification"
        echo "  • Set up Swagger UI and ReDoc"
        echo "  • Generate client SDKs (TypeScript, Python, cURL)"
        echo "  • Configure API testing tools (Newman, Dredd)"
        echo "  • Create documentation server"
        echo "  • Set up documentation CI/CD"
        echo
        ;;
    *)
        main "$@"
        ;;
esac