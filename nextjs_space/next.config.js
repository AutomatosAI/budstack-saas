const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE || 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
    serverComponentsExternalPackages: ['@prisma/client', '@prisma/engines'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === 'true',
    domains: ['stage-api.drgreennft.com', 'api.drgreennft.com', 'cdn.abacus.ai', 'prod-profiles-backend.s3.amazonaws.com', 'img.clerk.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'stage-api.drgreennft.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.drgreennft.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.abacus.ai',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'prod-profiles-backend.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Skip pre-rendering for all API routes to avoid Prisma initialization during build
  async rewrites() {
    return [];
  },
  // Disable static optimization for API routes
  async headers() {
    return [];
  },
};

module.exports = nextConfig;
