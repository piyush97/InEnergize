/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  
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
  
  // Image optimization
  images: {
    domains: [
      'media.licdn.com',
      'cdn.openai.com',
    ],
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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
        ],
      },
    ];
  },
};

module.exports = nextConfig;