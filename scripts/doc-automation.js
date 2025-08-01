#!/usr/bin/env node

/**
 * Documentation Automation for InErgize
 * 
 * Features:
 * - Auto-generate API documentation from code
 * - Keep README files synchronized with code changes
 * - Generate changelog from git commits
 * - Create and update architectural diagrams
 * - Validate documentation completeness
 * - Multi-language documentation support
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

class DocumentationAutomation {
  constructor() {
    this.config = this.loadConfig();
    this.services = [
      'auth-service', 'user-service', 'linkedin-service', 
      'analytics-service', 'ai-service', 'websocket-service'
    ];
  }

  loadConfig() {
    return {
      docs: {
        outputDir: join(PROJECT_ROOT, 'docs'),
        apiDocsDir: join(PROJECT_ROOT, 'docs', 'api'),
        changelogPath: join(PROJECT_ROOT, 'CHANGELOG.md'),
        readmePath: join(PROJECT_ROOT, 'README.md')
      },
      generation: {
        includePrivate: false,
        includeTests: false,
        includeExamples: true,
        generateDiagrams: true
      },
      validation: {
        checkLinks: true,
        checkImages: true,
        checkCodeBlocks: true,
        requireExamples: true
      }
    };
  }

  async executeCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        timeout: options.timeout || 60000,
        ...options
      });
      return { success: true, output: result.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async generateApiDocumentation() {
    console.log('📚 Generating API documentation...');
    
    // Ensure docs directory exists
    if (!existsSync(this.config.docs.outputDir)) {
      mkdirSync(this.config.docs.outputDir, { recursive: true });
    }
    
    if (!existsSync(this.config.docs.apiDocsDir)) {
      mkdirSync(this.config.docs.apiDocsDir, { recursive: true });
    }

    const apiDocs = {};

    for (const service of this.services) {
      console.log(`Analyzing ${service}...`);
      
      const servicePath = join(PROJECT_ROOT, 'services', service);
      if (!existsSync(servicePath)) {
        console.warn(`⚠️  Service path not found: ${servicePath}`);
        continue;
      }

      try {
        const serviceDoc = await this.analyzeService(service, servicePath);
        apiDocs[service] = serviceDoc;
        
        // Generate individual service documentation
        await this.generateServiceDocumentation(service, serviceDoc);
      } catch (error) {
        console.error(`❌ Failed to analyze ${service}:`, error.message);
      }
    }

    // Generate comprehensive API overview
    await this.generateApiOverview(apiDocs);
    
    console.log('✅ API documentation generated successfully');
    return apiDocs;
  }

  async analyzeService(serviceName, servicePath) {
    const serviceDoc = {
      name: serviceName,
      description: '',
      version: '1.0.0',
      endpoints: [],
      models: [],
      examples: [],
      dependencies: []
    };

    // Read package.json for basic info
    const packageJsonPath = join(servicePath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        serviceDoc.description = packageJson.description || '';
        serviceDoc.version = packageJson.version || '1.0.0';
        serviceDoc.dependencies = Object.keys(packageJson.dependencies || {});
      } catch (error) {
        console.warn(`⚠️  Could not read package.json for ${serviceName}`);
      }
    }

    // Analyze source files
    const srcPath = join(servicePath, 'src');
    if (existsSync(srcPath)) {
      await this.analyzeSourceDirectory(srcPath, serviceDoc);
    }

    // Look for API examples
    const examplesPath = join(servicePath, 'examples');
    if (existsSync(examplesPath)) {
      serviceDoc.examples = await this.findExamples(examplesPath);
    }

    return serviceDoc;
  }

  async analyzeSourceDirectory(srcPath, serviceDoc) {
    const files = this.findFiles(srcPath, ['.ts', '.js']);
    
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      
      // Extract API endpoints
      const endpoints = this.extractEndpoints(content, file);
      serviceDoc.endpoints.push(...endpoints);
      
      // Extract data models
      const models = this.extractModels(content, file);
      serviceDoc.models.push(...models);
    }
  }

  extractEndpoints(content, filePath) {
    const endpoints = [];
    const lines = content.split('\\n');
    
    // Look for Express.js route definitions
    const routeRegex = /(app|router)\\.([get|post|put|delete|patch]+)\\s*\\(\\s*['\\\"]([^'\\\"]+)['\\\"]\\s*,/gi;
    
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const [, , method, path] = match;
      
      // Find the line number
      const lineIndex = content.substring(0, match.index).split('\\n').length - 1;
      const line = lines[lineIndex];
      
      // Extract comments above the route
      let description = '';
      for (let i = lineIndex - 1; i >= 0; i--) {
        const commentLine = lines[i].trim();
        if (commentLine.startsWith('//') || commentLine.startsWith('*')) {
          description = commentLine.replace(/^\\/\\/\\s*|^\\*\\s*/, '') + ' ' + description;
        } else if (commentLine === '' || commentLine.startsWith('/*')) {
          continue;
        } else {
          break;
        }
      }
      
      endpoints.push({
        method: method.toUpperCase(),
        path,
        description: description.trim(),
        file: filePath,
        line: lineIndex + 1
      });
    }
    
    return endpoints;
  }

  extractModels(content, filePath) {
    const models = [];
    
    // Extract TypeScript interfaces
    const interfaceRegex = /export\\s+interface\\s+(\\w+)\\s*\\{([^}]+)\\}/g;
    let match;
    
    while ((match = interfaceRegex.exec(content)) !== null) {
      const [, name, body] = match;
      
      // Parse interface properties
      const properties = [];
      const propLines = body.split('\\n');
      
      for (const line of propLines) {
        const propMatch = line.trim().match(/(\\w+)(\\??):\\s*([^;]+);?/);
        if (propMatch) {
          const [, propName, optional, propType] = propMatch;
          properties.push({
            name: propName,
            type: propType.trim(),
            optional: optional === '?',
            description: ''
          });
        }
      }
      
      models.push({
        name,
        type: 'interface',
        properties,
        file: filePath
      });
    }
    
    // Extract TypeScript types
    const typeRegex = /export\\s+type\\s+(\\w+)\\s*=\\s*([^;]+);/g;
    while ((match = typeRegex.exec(content)) !== null) {
      const [, name, definition] = match;
      
      models.push({
        name,
        type: 'type',
        definition: definition.trim(),
        file: filePath
      });
    }
    
    return models;
  }

  async generateServiceDocumentation(serviceName, serviceDoc) {
    const docPath = join(this.config.docs.apiDocsDir, `${serviceName}.md`);
    
    let markdown = `# ${serviceDoc.name}\\n\\n`;
    markdown += `${serviceDoc.description}\\n\\n`;
    markdown += `**Version:** ${serviceDoc.version}\\n\\n`;
    
    // Table of Contents
    markdown += `## Table of Contents\\n\\n`;
    markdown += `- [Endpoints](#endpoints)\\n`;
    markdown += `- [Data Models](#data-models)\\n`;
    markdown += `- [Examples](#examples)\\n`;
    markdown += `- [Dependencies](#dependencies)\\n\\n`;
    
    // Endpoints
    if (serviceDoc.endpoints.length > 0) {
      markdown += `## Endpoints\\n\\n`;
      
      const endpointsByPath = {};
      serviceDoc.endpoints.forEach(endpoint => {
        if (!endpointsByPath[endpoint.path]) {
          endpointsByPath[endpoint.path] = [];
        }
        endpointsByPath[endpoint.path].push(endpoint);
      });
      
      for (const [path, endpoints] of Object.entries(endpointsByPath)) {
        markdown += `### \\`${path}\\`\\n\\n`;
        
        for (const endpoint of endpoints) {
          markdown += `#### ${endpoint.method} ${endpoint.path}\\n\\n`;
          if (endpoint.description) {
            markdown += `${endpoint.description}\\n\\n`;
          }
          
          markdown += `**Request:**\\n`;
          markdown += `\`\`\`\\n`;
          markdown += `${endpoint.method} ${endpoint.path}\\n`;
          markdown += `\`\`\`\\n\\n`;
          
          markdown += `**Response:**\\n`;
          markdown += `\`\`\`json\\n`;
          markdown += `{\\n`;
          markdown += `  "status": "success",\\n`;
          markdown += `  "data": {}\\n`;
          markdown += `}\\n`;
          markdown += `\`\`\`\\n\\n`;
        }
      }
    }
    
    // Data Models
    if (serviceDoc.models.length > 0) {
      markdown += `## Data Models\\n\\n`;
      
      for (const model of serviceDoc.models) {
        markdown += `### ${model.name}\\n\\n`;
        
        if (model.type === 'interface' && model.properties) {
          markdown += `| Property | Type | Required | Description |\\n`;
          markdown += `|----------|------|----------|-------------|\\n`;
          
          for (const prop of model.properties) {
            const required = prop.optional ? 'No' : 'Yes';
            markdown += `| ${prop.name} | \`${prop.type}\` | ${required} | ${prop.description || '-'} |\\n`;
          }
          markdown += `\\n`;
        } else if (model.type === 'type') {
          markdown += `\`\`\`typescript\\n`;
          markdown += `type ${model.name} = ${model.definition}\\n`;
          markdown += `\`\`\`\\n\\n`;
        }
      }
    }
    
    // Examples
    if (serviceDoc.examples.length > 0) {
      markdown += `## Examples\\n\\n`;
      
      for (const example of serviceDoc.examples) {
        markdown += `### ${example.name}\\n\\n`;
        markdown += `${example.description}\\n\\n`;
        markdown += `\`\`\`${example.language || 'javascript'}\\n`;
        markdown += `${example.code}\\n`;
        markdown += `\`\`\`\\n\\n`;
      }
    }
    
    // Dependencies
    if (serviceDoc.dependencies.length > 0) {
      markdown += `## Dependencies\\n\\n`;
      
      for (const dep of serviceDoc.dependencies) {
        markdown += `- ${dep}\\n`;
      }
      markdown += `\\n`;
    }
    
    writeFileSync(docPath, markdown);
    console.log(`📄 Generated documentation: ${docPath}`);
  }

  async generateApiOverview(apiDocs) {
    const overviewPath = join(this.config.docs.apiDocsDir, 'README.md');
    
    let markdown = `# InErgize API Documentation\\n\\n`;
    markdown += `This directory contains comprehensive API documentation for all InErgize microservices.\\n\\n`;
    
    // Services overview
    markdown += `## Services Overview\\n\\n`;
    markdown += `| Service | Description | Version | Endpoints |\\n`;
    markdown += `|---------|-------------|---------|-----------|\\n`;
    
    for (const [serviceName, serviceDoc] of Object.entries(apiDocs)) {
      const endpointCount = serviceDoc.endpoints.length;
      markdown += `| [${serviceName}](./${serviceName}.md) | ${serviceDoc.description || 'No description'} | ${serviceDoc.version} | ${endpointCount} |\\n`;
    }
    markdown += `\\n`;
    
    // Architecture overview
    markdown += `## Architecture Overview\\n\\n`;
    markdown += `InErgize follows a microservices architecture with the following components:\\n\\n`;
    
    // Generate service dependency diagram
    if (this.config.generation.generateDiagrams) {
      const diagramPath = await this.generateArchitectureDiagram(apiDocs);
      if (diagramPath) {
        markdown += `![Architecture Diagram](${diagramPath})\\n\\n`;
      }
    }
    
    // Quick start guide
    markdown += `## Quick Start\\n\\n`;
    markdown += `1. **Authentication**: All API requests require authentication via JWT tokens\\n`;
    markdown += `2. **Base URL**: \`http://localhost:8000/api\` (via Kong API Gateway)\\n`;
    markdown += `3. **Response Format**: All responses follow a consistent JSON structure\\n`;
    markdown += `4. **Error Handling**: Standard HTTP status codes with detailed error messages\\n\\n`;
    
    // Common patterns
    markdown += `## Common Patterns\\n\\n`;
    markdown += `### Authentication\\n`;
    markdown += `\`\`\`bash\\n`;
    markdown += `curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\\\\\n`;
    markdown += `     -H "Content-Type: application/json" \\\\\\n`;
    markdown += `     http://localhost:8000/api/endpoint\\n`;
    markdown += `\`\`\`\\n\\n`;
    
    markdown += `### Error Response Format\\n`;
    markdown += `\`\`\`json\\n`;
    markdown += `{\\n`;
    markdown += `  "success": false,\\n`;
    markdown += `  "error": {\\n`;
    markdown += `    "code": "ERROR_CODE",\\n`;
    markdown += `    "message": "Human readable error message",\\n`;
    markdown += `    "details": {}\\n`;
    markdown += `  }\\n`;
    markdown += `}\\n`;
    markdown += `\`\`\`\\n\\n`;
    
    writeFileSync(overviewPath, markdown);
    console.log(`📄 Generated API overview: ${overviewPath}`);
  }

  async generateArchitectureDiagram(apiDocs) {
    // Generate Mermaid diagram
    let mermaid = `graph TB\\n`;
    mermaid += `    Client[Client Applications]\\n`;
    mermaid += `    Kong[Kong API Gateway]\\n`;
    mermaid += `    Client --> Kong\\n\\n`;
    
    // Add services
    for (const serviceName of Object.keys(apiDocs)) {
      const serviceLabel = serviceName.replace('-service', '');
      mermaid += `    ${serviceLabel.toUpperCase()}[${serviceName}]\\n`;
      mermaid += `    Kong --> ${serviceLabel.toUpperCase()}\\n`;
    }
    
    // Add databases
    mermaid += `\\n    PostgreSQL[(PostgreSQL)]\\n`;
    mermaid += `    TimescaleDB[(TimescaleDB)]\\n`;
    mermaid += `    Redis[(Redis)]\\n\\n`;
    
    // Add database connections
    mermaid += `    AUTH --> PostgreSQL\\n`;
    mermaid += `    USER --> PostgreSQL\\n`;
    mermaid += `    LINKEDIN --> PostgreSQL\\n`;
    mermaid += `    LINKEDIN --> Redis\\n`;
    mermaid += `    ANALYTICS --> TimescaleDB\\n`;
    mermaid += `    AI --> Redis\\n`;
    
    const diagramPath = join(this.config.docs.outputDir, 'architecture.mermaid');
    writeFileSync(diagramPath, mermaid);
    
    return 'architecture.mermaid';
  }

  async generateChangelog() {
    console.log('📝 Generating changelog from git commits...');
    
    // Get git commits since last tag or beginning
    const result = await this.executeCommand('git log --oneline --no-merges --reverse');
    
    if (!result.success) {
      console.error('❌ Failed to get git log');
      return false;
    }
    
    const commits = result.output.split('\\n').filter(line => line.trim());
    
    // Group commits by type
    const changelog = {
      features: [],
      fixes: [],
      improvements: [],
      breaking: [],
      other: []
    };
    
    for (const commit of commits) {
      const [hash, ...messageParts] = commit.split(' ');
      const message = messageParts.join(' ');
      
      if (message.match(/^(feat|feature):/i)) {
        changelog.features.push({ hash, message: message.replace(/^(feat|feature):\\s*/i, '') });
      } else if (message.match(/^fix:/i)) {
        changelog.fixes.push({ hash, message: message.replace(/^fix:\\s*/i, '') });
      } else if (message.match(/^(improve|enhancement|perf):/i)) {
        changelog.improvements.push({ hash, message: message.replace(/^(improve|enhancement|perf):\\s*/i, '') });
      } else if (message.match /^breaking:/i) {
        changelog.breaking.push({ hash, message: message.replace(/^breaking:\\s*/i, '') });
      } else {
        changelog.other.push({ hash, message });
      }
    }
    
    // Generate markdown
    let markdown = `# Changelog\\n\\n`;
    markdown += `All notable changes to InErgize will be documented in this file.\\n\\n`;
    markdown += `The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\\n`;
    markdown += `and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\\n\\n`;
    
    // Get current version
    const packageJsonPath = join(PROJECT_ROOT, 'package.json');
    let version = '1.0.0';
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        version = packageJson.version || '1.0.0';
      } catch (error) {
        console.warn('⚠️  Could not read version from package.json');
      }
    }
    
    markdown += `## [${version}] - ${new Date().toISOString().split('T')[0]}\\n\\n`;
    
    if (changelog.breaking.length > 0) {
      markdown += `### ⚠️ BREAKING CHANGES\\n\\n`;
      for (const commit of changelog.breaking) {
        markdown += `- ${commit.message} (${commit.hash})\\n`;
      }
      markdown += `\\n`;
    }
    
    if (changelog.features.length > 0) {
      markdown += `### ✨ Features\\n\\n`;
      for (const commit of changelog.features) {
        markdown += `- ${commit.message} (${commit.hash})\\n`;
      }
      markdown += `\\n`;
    }
    
    if (changelog.improvements.length > 0) {
      markdown += `### 🚀 Improvements\\n\\n`;
      for (const commit of changelog.improvements) {
        markdown += `- ${commit.message} (${commit.hash})\\n`;
      }
      markdown += `\\n`;
    }
    
    if (changelog.fixes.length > 0) {
      markdown += `### 🐛 Bug Fixes\\n\\n`;
      for (const commit of changelog.fixes) {
        markdown += `- ${commit.message} (${commit.hash})\\n`;
      }
      markdown += `\\n`;
    }
    
    if (changelog.other.length > 0) {
      markdown += `### 🔧 Other Changes\\n\\n`;
      for (const commit of changelog.other) {
        markdown += `- ${commit.message} (${commit.hash})\\n`;
      }
      markdown += `\\n`;
    }
    
    // Append to existing changelog or create new
    let existingChangelog = '';
    if (existsSync(this.config.docs.changelogPath)) {
      existingChangelog = readFileSync(this.config.docs.changelogPath, 'utf8');
      
      // Find where to insert new version
      const versionRegex = /^## \\[/gm;
      const match = versionRegex.exec(existingChangelog);
      
      if (match) {
        // Insert new version before first existing version
        const insertIndex = match.index;
        markdown += existingChangelog.substring(insertIndex);
      } else {
        // Append to end if no versions found
        markdown += existingChangelog;
      }
    }
    
    writeFileSync(this.config.docs.changelogPath, markdown);
    console.log(`✅ Changelog generated: ${this.config.docs.changelogPath}`);
    
    return true;
  }

  async updateReadme() {
    console.log('📖 Updating README.md...');
    
    // Read current README
    let readme = '';
    if (existsSync(this.config.docs.readmePath)) {
      readme = readFileSync(this.config.docs.readmePath, 'utf8');
    }
    
    // Extract sections to update
    const updates = {
      services: await this.generateServicesSection(),
      quickStart: await this.generateQuickStartSection(),
      development: await this.generateDevelopmentSection()
    };
    
    // Update or add sections
    for (const [sectionName, content] of Object.entries(updates)) {
      const sectionRegex = new RegExp(`(## ${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}.*?)(?=\\n## |$)`, 'is');
      
      if (sectionRegex.test(readme)) {
        readme = readme.replace(sectionRegex, content);
      } else {
        readme += `\\n\\n${content}`;
      }
    }
    
    writeFileSync(this.config.docs.readmePath, readme);
    console.log(`✅ README.md updated: ${this.config.docs.readmePath}`);
  }

  async generateServicesSection() {
    const servicesInfo = [];
    
    for (const service of this.services) {
      const servicePath = join(PROJECT_ROOT, 'services', service);
      const packageJsonPath = join(servicePath, 'package.json');
      
      let description = 'No description available';
      let version = '1.0.0';
      
      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
          description = packageJson.description || description;
          version = packageJson.version || version;
        } catch (error) {
          // Use defaults
        }
      }
      
      servicesInfo.push({ service, description, version });
    }
    
    let section = `## Services\\n\\n`;
    section += `InErgize consists of ${this.services.length} microservices:\\n\\n`;
    section += `| Service | Description | Version | Port |\\n`;
    section += `|---------|-------------|---------|------|\\n`;
    
    const ports = {
      'auth-service': 3001,
      'user-service': 3002,
      'linkedin-service': 3003,
      'analytics-service': 3004,
      'ai-service': 3005,
      'websocket-service': 3007
    };
    
    for (const { service, description, version } of servicesInfo) {
      const port = ports[service] || 'N/A';
      section += `| ${service} | ${description} | ${version} | ${port} |\\n`;
    }
    
    return section;
  }

  async generateQuickStartSection() {
    return `## Quick Start\\n\\n` +
           `### Prerequisites\\n\\n` +
           `- Node.js 22+\\n` +
           `- Bun package manager\\n` +
           `- Docker & Docker Compose\\n` +
           `- Git\\n\\n` +
           `### Development Setup\\n\\n` +
           `\`\`\`bash\\n` +
           `# Clone the repository\\n` +
           `git clone https://github.com/piyush97/inergize.git\\n` +
           `cd inergize\\n\\n` +
           `# Start development environment\\n` +
           `node scripts/dev-env-manager.js start\\n\\n` +
           `# Run tests\\n` +
           `node scripts/test-runner.js\\n` +
           `\`\`\`\\n\\n` +
           `### Access URLs\\n\\n` +
           `- **Web Application**: http://localhost:3000\\n` +
           `- **API Gateway**: http://localhost:8000\\n` +
           `- **Kong Admin**: http://localhost:8001\\n` +
           `- **Kibana**: http://localhost:5601\\n`;
  }

  async generateDevelopmentSection() {
    return `## Development\\n\\n` +
           `### Workflow Scripts\\n\\n` +
           `InErgize includes several automation scripts to streamline development:\\n\\n` +
           `\`\`\`bash\\n` +
           `# Environment management\\n` +
           `node scripts/dev-env-manager.js start    # Start all services\\n` +
           `node scripts/dev-env-manager.js stop     # Stop all services\\n` +
           `node scripts/dev-env-manager.js health   # Check service health\\n\\n` +
           `# Testing\\n` +
           `node scripts/test-runner.js              # Intelligent test runner\\n` +
           `node scripts/test-runner.js --fast       # Quick test mode\\n\\n` +
           `# Monitoring\\n` +
           `node scripts/monitoring-automation.js start  # Start monitoring\\n\\n` +
           `# Developer productivity\\n` +
           `node scripts/dev-productivity.js logs    # Aggregate logs\\n` +
           `node scripts/dev-productivity.js profile # Performance profiling\\n` +
           `\`\`\`\\n\\n` +
           `### Code Quality\\n\\n` +
           `The project maintains high code quality through:\\n\\n` +
           `- **ESLint** for code linting\\n` +
           `- **Prettier** for code formatting\\n` +
           `- **TypeScript** for type safety\\n` +
           `- **Jest** for unit testing\\n` +
           `- **Playwright** for E2E testing\\n` +
           `- **Automated code review** via GitHub Actions\\n`;
  }

  findFiles(dir, extensions, files = []) {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        this.findFiles(fullPath, extensions, files);
      } else if (stat.isFile() && extensions.includes(extname(item))) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async findExamples(examplesDir) {
    const examples = [];
    const files = this.findFiles(examplesDir, ['.js', '.ts', '.md']);
    
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const name = basename(file, extname(file));
      const language = extname(file).slice(1);
      
      examples.push({
        name,
        description: `Example: ${name}`,
        code: content,
        language,
        file
      });
    }
    
    return examples;
  }

  async validateDocumentation() {
    console.log('✅ Validating documentation...');
    
    const validation = {
      issues: [],
      warnings: [],
      stats: {
        totalFiles: 0,
        brokenLinks: 0,
        missingImages: 0,
        emptyFiles: 0
      }
    };

    // Find all markdown files
    const docFiles = this.findFiles(this.config.docs.outputDir, ['.md']);
    validation.stats.totalFiles = docFiles.length;

    for (const file of docFiles) {
      const content = readFileSync(file, 'utf8');
      const relativePath = file.replace(PROJECT_ROOT, '');
      
      // Check for empty files
      if (content.trim().length === 0) {
        validation.issues.push(`Empty documentation file: ${relativePath}`);
        validation.stats.emptyFiles++;
      }
      
      // Check for broken internal links
      if (this.config.validation.checkLinks) {
        const links = content.match(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g);
        if (links) {
          for (const link of links) {
            const match = link.match(/\\[([^\\]]+)\\]\\(([^)]+)\\)/);
            if (match) {
              const [, text, url] = match;
              
              // Check internal links
              if (!url.startsWith('http') && !url.startsWith('#')) {
                const linkedFile = join(dirname(file), url);
                if (!existsSync(linkedFile)) {
                  validation.issues.push(`Broken link in ${relativePath}: ${url}`);
                  validation.stats.brokenLinks++;
                }
              }
            }
          }
        }
      }
      
      // Check for missing images
      if (this.config.validation.checkImages) {
        const images = content.match(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g);
        if (images) {
          for (const image of images) {
            const match = image.match(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/);
            if (match) {
              const [, alt, src] = match;
              
              if (!src.startsWith('http')) {
                const imagePath = join(dirname(file), src);
                if (!existsSync(imagePath)) {
                  validation.issues.push(`Missing image in ${relativePath}: ${src}`);
                  validation.stats.missingImages++;
                }
              }
            }
          }
        }
      }
      
      // Check for code blocks without language
      if (this.config.validation.checkCodeBlocks) {
        const codeBlocks = content.match(/```[\\s]*\\n/g);
        if (codeBlocks) {
          validation.warnings.push(`Code blocks without language specification in ${relativePath}`);
        }
      }
    }

    // Generate validation report
    const reportPath = join(this.config.docs.outputDir, 'validation-report.md');
    let report = `# Documentation Validation Report\\n\\n`;
    report += `Generated: ${new Date().toISOString()}\\n\\n`;
    
    report += `## Summary\\n\\n`;
    report += `- **Total Files**: ${validation.stats.totalFiles}\\n`;
    report += `- **Issues Found**: ${validation.issues.length}\\n`;
    report += `- **Warnings**: ${validation.warnings.length}\\n\\n`;
    
    if (validation.issues.length > 0) {
      report += `## Issues\\n\\n`;
      for (const issue of validation.issues) {
        report += `- ❌ ${issue}\\n`;
      }
      report += `\\n`;
    }
    
    if (validation.warnings.length > 0) {
      report += `## Warnings\\n\\n`;
      for (const warning of validation.warnings) {
        report += `- ⚠️ ${warning}\\n`;
      }
      report += `\\n`;
    }
    
    writeFileSync(reportPath, report);
    
    console.log(`📊 Validation Summary:`);
    console.log(`   Files checked: ${validation.stats.totalFiles}`);
    console.log(`   Issues found: ${validation.issues.length}`);
    console.log(`   Warnings: ${validation.warnings.length}`);
    console.log(`   Report saved: ${reportPath}`);
    
    return validation;
  }

  async runFullDocumentationUpdate() {
    console.log('🚀 Running full documentation update...');
    
    try {
      // Generate API documentation
      await this.generateApiDocumentation();
      
      // Generate changelog
      await this.generateChangelog();
      
      // Update README
      await this.updateReadme();
      
      // Validate documentation
      const validation = await this.validateDocumentation();
      
      console.log('✅ Documentation update completed successfully');
      
      if (validation.issues.length > 0) {
        console.log(`⚠️  Found ${validation.issues.length} issues that need attention`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Documentation update failed:', error.message);
      return false;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'update';
  
  const docBot = new DocumentationAutomation();
  
  try {
    switch (command) {
      case 'update':
        await docBot.runFullDocumentationUpdate();
        break;
        
      case 'api':
        await docBot.generateApiDocumentation();
        break;
        
      case 'changelog':
        await docBot.generateChangelog();
        break;
        
      case 'readme':
        await docBot.updateReadme();
        break;
        
      case 'validate':
        await docBot.validateDocumentation();
        break;
        
      default:
        console.log('Usage: doc-automation.js [command]');
        console.log('Commands:');
        console.log('  update    - Run full documentation update');
        console.log('  api       - Generate API documentation');
        console.log('  changelog - Generate changelog from git');
        console.log('  readme    - Update README.md');
        console.log('  validate  - Validate documentation');
        process.exit(1);
    }
  } catch (error) {
    console.error(`\\n❌ Command failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default DocumentationAutomation;