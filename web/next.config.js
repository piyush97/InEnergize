/** @type {import('next').NextConfig} */
const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  
  // Disable linting during build for demonstration
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
    emotion: true,
  },
  
  // Experimental features for performance
  experimental: {
    // Optimize bundle
    optimizeCss: true,
    // Enable runtime chunk optimization
    nextScriptWorkers: true,
  },
  
  // Enable SWC minification (built-in since Next.js 13)
  // swcMinify is now default and doesn't need to be specified
  
  // Bundle optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle analyzer
    if (process.env.ANALYZE === 'true') {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: path.join(__dirname, 'bundle-analyzer-report.html'),
        })
      );
    }
    
    // Production optimizations
    if (!dev && !isServer) {
      // Advanced chunk splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\\/]node_modules[\\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'initial',
            reuseExistingChunk: true,
          },
          react: {
            test: /[\\\/]node_modules[\\\/](react|react-dom)[\\\/]/,
            name: 'react',
            priority: 20,
            chunks: 'all',
            reuseExistingChunk: true,
          },
          ui: {
            test: /[\\\/](components\/ui|@radix-ui)[\\\/]/,
            name: 'ui',
            priority: 15,
            chunks: 'all',
            reuseExistingChunk: true,
          },
          three: {
            test: /[\\\/]node_modules[\\\/](three|@react-three)[\\\/]/,
            name: 'three',
            priority: 25,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          recharts: {
            test: /[\\\/]node_modules[\\\/](recharts|d3-)[\\\/]/,
            name: 'charts',
            priority: 15,
            chunks: 'async',
            reuseExistingChunk: true,
          },
          framer: {
            test: /[\\\/]node_modules[\\\/]framer-motion[\\\/]/,
            name: 'framer',
            priority: 10,
            chunks: 'async',
            reuseExistingChunk: true,
          },
        },
      };
      
      // Tree shaking improvements
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      config.optimization.innerGraph = true;
      
      // Module concatenation
      config.optimization.concatenateModules = true;
      
      // Minimize and optimize
      config.optimization.minimize = true;
      
      // Better hashing for long-term caching
      config.optimization.moduleIds = 'deterministic';
      config.optimization.chunkIds = 'deterministic';
    }
    
    // Resolve optimization
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
      '@/components': path.join(__dirname, 'src/components'),
      '@/hooks': path.join(__dirname, 'src/hooks'),
      '@/lib': path.join(__dirname, 'src/lib'),
      '@/types': path.join(__dirname, 'src/types'),
      '@/contexts': path.join(__dirname, 'src/contexts'),
    };
    
    // Enable resolve cache
    config.resolve.cache = !dev;
    
    // Optimize module resolution
    config.resolve.modules = ['node_modules', path.join(__dirname, 'src')];
    
    // Add performance hints
    if (!dev) {
      config.performance = {
        hints: 'warning',
        maxAssetSize: 500000,
        maxEntrypointSize: 500000,
      };
    }
    
    // Add webpack plugins
    if (!dev) {
      // Preload webpack plugin for critical chunks
      config.plugins.push(
        new webpack.optimize.ModuleConcatenationPlugin(),
      );
    }
    
    return config;
  },
  
  // API configuration
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: `${process.env.AUTH_SERVICE_URL || 'http://localhost:3001'}/:path*`,
      },
      {
        source: '/api/users/:path*',
        destination: `${process.env.USER_SERVICE_URL || 'http://localhost:3002'}/:path*`,
      },
      {
        source: '/api/v1/linkedin/:path*',
        destination: `${process.env.LINKEDIN_SERVICE_URL || 'http://localhost:3003'}/api/linkedin/:path*`,
      },
      {
        source: '/api/v1/metrics/:path*',
        destination: `${process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3004'}/api/v1/metrics/:path*`,
      },
      {
        source: '/api/v1/ws/:path*',
        destination: `${process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3004'}/api/v1/ws/:path*`,
      },
    ];
  },
  
  // Environment variables
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  },
  
  // Enhanced image optimization
  images: {
    domains: [
      'media.licdn.com',
      'cdn.openai.com',
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    loader: 'default',
    loaderFile: '',
    disableStaticImages: false,
    unoptimized: false,
  },
  
  // Enhanced security and performance headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Performance headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;