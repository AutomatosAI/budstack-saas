const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE || 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
    serverComponentsExternalPackages: ['@prisma/client', '@prisma/engines', 'isomorphic-dompurify', 'jsdom'],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === 'true',
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
  // Security headers — CSP, framing, transport security
  async headers() {
    // SECURITY (PRD-218, AC-2): the Content-Security-Policy is now emitted
    // per-request in middleware.ts so script-src carries a fresh nonce +
    // 'strict-dynamic' instead of 'unsafe-inline'. A static config header
    // cannot vary per request, so CSP must NOT be set here too — two CSP
    // headers would be enforced as an intersection and fight the nonce policy.
    // The non-CSP security headers below stay static (they never vary).
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      // Permissions-Policy — explicitly disable powerful APIs we don't use.
      // Each `feature=()` denies it for both this origin and any iframe.
      {
        key: 'Permissions-Policy',
        value: [
          'camera=()',
          'microphone=()',
          'geolocation=()',
          'payment=()',
          'usb=()',
          'magnetometer=()',
          'gyroscope=()',
          'accelerometer=()',
          'autoplay=()',
          'fullscreen=(self)',
          'picture-in-picture=()',
          'display-capture=()',
          'screen-wake-lock=()',
          'midi=()',
          'serial=()',
          'bluetooth=()',
        ].join(', '),
      },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      // Cross-origin isolation headers (defense-in-depth against Spectre /
      // cross-origin data leaks). same-origin is the strict default; widen
      // for specific routes if SDKs need cross-origin popup access.
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
      // X-Frame-Options retained for legacy browsers; modern browsers honor
      // frame-ancestors in the CSP instead.
      { key: 'X-Frame-Options', value: 'DENY' },
    ];

    return [
      // All pages: static security headers (CSP is set per-request in middleware)
      {
        source: '/(.*)',
        headers: [
          ...securityHeaders,
        ],
      },
      // Store pages: relax X-Frame-Options to SAMEORIGIN for the editor iframe
      // viewport switcher — the legacy-browser analog of the CSP frame-ancestors
      // 'self' that middleware sets for the store variant.
      {
        source: '/store/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
