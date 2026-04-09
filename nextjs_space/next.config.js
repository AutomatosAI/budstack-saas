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
    domains: ['stage-api.drgreennft.com', 'api.drgreennft.com', 'cdn.abacus.ai', 'prod-profiles-backend.s3.amazonaws.com', 'img.clerk.com', 'budstack-uploads.s3.eu-west-1.amazonaws.com'],
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
      {
        protocol: 'https',
        hostname: 'budstack-uploads.s3.eu-west-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
      // Clerk proxy: route auth API calls through the current domain so
      // custom domains work without a separate clerk.{domain} CNAME.
      // The Clerk SDK sends requests to /__clerk/* when proxyUrl is set.
      {
        source: '/__clerk/:path*',
        destination: `${process.env.NEXT_PUBLIC_CLERK_FRONTEND_API || 'https://flying-jennet-34.clerk.accounts.dev'}/:path*`,
      },
    ];
  },
  // Disable static optimization for API routes
  async headers() {
    return [
      // All other pages: block framing (listed FIRST so preview rule overrides)
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.amazonaws.com https://img.clerk.com https://stage-api.drgreennft.com https://api.drgreennft.com https://cdn.abacus.ai; media-src 'self' blob: https://*.amazonaws.com; connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com https://*.drgreennft.com wss://*.clerk.accounts.dev; frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev;" },
        ],
      },
      // Store pages: allow self-framing for iframe-based viewport switcher in editor
      // Listed AFTER catch-all so these values override X-Frame-Options: DENY
      {
        source: '/store/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.amazonaws.com https://img.clerk.com https://stage-api.drgreennft.com https://api.drgreennft.com https://cdn.abacus.ai; media-src 'self' blob: https://*.amazonaws.com; connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com https://*.drgreennft.com wss://*.clerk.accounts.dev; frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev; frame-ancestors 'self';" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
