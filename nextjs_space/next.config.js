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
    ignoreDuringBuilds: true,
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
    // Base CSP — defaults to deny everything not explicitly allowed.
    // - frame-ancestors 'none' is the modern replacement for X-Frame-Options
    // - object-src 'none' blocks Flash/PDF embed exploits
    // - base-uri 'self' prevents <base> tag hijacking
    // - upgrade-insecure-requests forces HTTPS for any HTTP subresource
    // - form-action 'self' restricts where forms can POST
    // 'unsafe-inline' on script-src is retained because Clerk + Next inject
    // inline scripts; migrating to nonce-based CSP is a larger refactor.
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.amazonaws.com https://img.clerk.com https://stage-api.drgreennft.com https://api.drgreennft.com https://cdn.abacus.ai",
      "media-src 'self' blob: https://*.amazonaws.com",
      "connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com https://*.drgreennft.com https://*.amazonaws.com wss://*.clerk.accounts.dev",
      "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.clerk.accounts.dev",
      "upgrade-insecure-requests",
    ];
    const baseCSP = cspDirectives.join("; ");

    // Admin analytics pages need unsafe-eval for plotly.js charting library
    const adminCSP = baseCSP.replace(
      "script-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    );

    // Store pages: allow self-framing for iframe-based viewport switcher
    const storeCSP = baseCSP.replace(
      "frame-ancestors 'none'",
      "frame-ancestors 'self'"
    );

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
      // All pages: hardened base CSP + cross-origin isolation
      {
        source: '/(.*)',
        headers: [
          ...securityHeaders,
          { key: 'Content-Security-Policy', value: baseCSP },
        ],
      },
      // Admin analytics: allow unsafe-eval for plotly.js
      {
        source: '/tenant-admin/analytics',
        headers: [
          { key: 'Content-Security-Policy', value: adminCSP },
        ],
      },
      {
        source: '/super-admin/analytics',
        headers: [
          { key: 'Content-Security-Policy', value: adminCSP },
        ],
      },
      // Store pages: allow self-framing for iframe-based viewport switcher in editor
      {
        source: '/store/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: storeCSP },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
