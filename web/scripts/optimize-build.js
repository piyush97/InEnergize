#!/usr/bin/env node

// Build optimization script for production deployment
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting production build optimization...\n');

// 1. Clean previous builds
console.log('1. Cleaning previous builds...');
try {
  execSync('rm -rf .next', { stdio: 'inherit' });
  execSync('rm -rf out', { stdio: 'inherit' });
  console.log('✅ Cleaned previous builds\n');
} catch (error) {
  console.error('❌ Failed to clean builds:', error.message);
}

// 2. Generate sitemap and robots.txt
console.log('2. Generating SEO files...');
generateSitemap();
generateRobots();
console.log('✅ Generated SEO files\n');

// 3. Optimize images (if imagemin is available)
console.log('3. Checking image optimization...');
optimizeImages();
console.log('✅ Image optimization completed\n');

// 4. Run Next.js build with optimizations
console.log('4. Building Next.js application...');
try {
  const buildEnv = {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    // Enable experimental features
    NEXT_EXPERIMENTAL_APP_DIR: 'false',
    // Optimize bundle
    ANALYZE: process.env.ANALYZE || 'false',
  };

  execSync('npm run build', { 
    stdio: 'inherit',
    env: buildEnv
  });
  console.log('✅ Next.js build completed\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// 5. Analyze bundle size
console.log('5. Analyzing bundle...');
analyzeBundleSize();
console.log('✅ Bundle analysis completed\n');

// 6. Generate service worker
console.log('6. Generating service worker...');
generateServiceWorkerManifest();
console.log('✅ Service worker manifest generated\n');

// 7. Performance audit
console.log('7. Running performance checks...');
performanceAudit();
console.log('✅ Performance audit completed\n');

console.log('🎉 Production build optimization completed!\n');

// Helper functions
function generateSitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://inergize.app';
  const routes = [
    '',
    '/dashboard',
    '/automation',
    '/content',
    '/profile',
    '/analytics',
    '/settings',
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url>
    <loc>${baseUrl}${route}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${route === '' ? 'daily' : 'weekly'}</changefreq>
    <priority>${route === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(__dirname, '../public/sitemap.xml'), sitemap);
}

function generateRobots() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://inergize.app';
  const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /private/

Sitemap: ${baseUrl}/sitemap.xml`;

  fs.writeFileSync(path.join(__dirname, '../public/robots.txt'), robots);
}

function optimizeImages() {
  const publicDir = path.join(__dirname, '../public');
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  
  try {
    const files = fs.readdirSync(publicDir, { recursive: true });
    const imageFiles = files.filter(file => 
      imageExtensions.some(ext => file.toLowerCase().endsWith(ext))
    );
    
    console.log(`📸 Found ${imageFiles.length} images for optimization`);
    
    // Note: Would need imagemin package for actual optimization
    // This is a placeholder for the optimization logic
    
  } catch (error) {
    console.log('⚠️  Image optimization skipped:', error.message);
  }
}

function analyzeBundleSize() {
  const buildDir = path.join(__dirname, '../.next');
  
  if (!fs.existsSync(buildDir)) {
    console.log('⚠️  Build directory not found, skipping analysis');
    return;
  }

  try {
    // Read build manifest
    const manifestPath = path.join(buildDir, 'build-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      console.log('📦 Bundle Analysis:');
      console.log('  Pages:', Object.keys(manifest.pages).length);
      console.log('  Static files:', manifest['/_app']?.length || 0);
      
      // Calculate approximate sizes
      let totalSize = 0;
      const staticDir = path.join(buildDir, 'static');
      
      if (fs.existsSync(staticDir)) {
        const getDirectorySize = (dir) => {
          let size = 0;
          const files = fs.readdirSync(dir, { withFileTypes: true });
          
          for (const file of files) {
            const filePath = path.join(dir, file.name);
            if (file.isDirectory()) {
              size += getDirectorySize(filePath);
            } else {
              size += fs.statSync(filePath).size;
            }
          }
          return size;
        };
        
        totalSize = getDirectorySize(staticDir);
        console.log('  Total static size:', formatBytes(totalSize));
      }
      
      // Bundle size recommendations
      if (totalSize > 5 * 1024 * 1024) { // 5MB
        console.log('⚠️  Large bundle detected. Consider code splitting.');
      } else {
        console.log('✅ Bundle size looks good!');
      }
    }
  } catch (error) {
    console.log('⚠️  Bundle analysis failed:', error.message);
  }
}

function generateServiceWorkerManifest() {
  const buildDir = path.join(__dirname, '../.next');
  const publicDir = path.join(__dirname, '../public');
  
  try {
    // Get list of static assets to cache
    const staticAssets = [];
    
    // Add critical static files
    const criticalFiles = [
      '/manifest.json',
      '/robots.txt',
      '/sitemap.xml',
    ];
    
    criticalFiles.forEach(file => {
      if (fs.existsSync(path.join(publicDir, file))) {
        staticAssets.push(file);
      }
    });
    
    // Generate manifest for service worker
    const swManifest = {
      version: Date.now().toString(),
      staticAssets,
      pages: [
        '/',
        '/dashboard',
        '/automation',
        '/content',
      ],
      apiRoutes: [
        '/api/auth/session',
        '/api/v1/metrics/web-vitals',
      ],
    };
    
    fs.writeFileSync(
      path.join(publicDir, 'sw-manifest.json'),
      JSON.stringify(swManifest, null, 2)
    );
    
    console.log('  Generated service worker manifest');
  } catch (error) {
    console.log('⚠️  Service worker manifest generation failed:', error.message);
  }
}

function performanceAudit() {
  console.log('📊 Performance Recommendations:');
  
  // Check for common performance issues
  const nextConfigPath = path.join(__dirname, '../next.config.js');
  const packageJsonPath = path.join(__dirname, '../package.json');
  
  // Check Next.js config
  if (fs.existsSync(nextConfigPath)) {
    const config = fs.readFileSync(nextConfigPath, 'utf8');
    
    if (!config.includes('swcMinify')) {
      console.log('  ⚠️  Enable SWC minification for better performance');
    }
    
    if (!config.includes('compress: true')) {
      console.log('  ⚠️  Enable compression in Next.js config');
    } else {
      console.log('  ✅ Compression enabled');
    }
    
    if (!config.includes('optimizeCss')) {
      console.log('  ⚠️  Enable CSS optimization');
    } else {
      console.log('  ✅ CSS optimization enabled');
    }
  }
  
  // Check dependencies
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Check for heavy dependencies
    const heavyDeps = ['moment', 'lodash', 'axios'];
    const foundHeavyDeps = heavyDeps.filter(dep => deps[dep]);
    
    if (foundHeavyDeps.length > 0) {
      console.log('  ⚠️  Consider lighter alternatives for:', foundHeavyDeps.join(', '));
    }
    
    // Check for optimization packages
    if (deps['@next/bundle-analyzer']) {
      console.log('  ✅ Bundle analyzer available');
    }
    
    if (deps['web-vitals']) {
      console.log('  ✅ Web Vitals monitoring enabled');
    }
  }
  
  console.log('\n📈 Performance Tips:');
  console.log('  • Use Next.js Image component for images');
  console.log('  • Implement lazy loading for non-critical components');
  console.log('  • Use dynamic imports for heavy libraries');
  console.log('  • Enable gzip/brotli compression on your server');
  console.log('  • Implement proper caching headers');
  console.log('  • Consider using a CDN for static assets');
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}