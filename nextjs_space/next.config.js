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
  images: { unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === 'true' },
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
