import type { NextConfig } from "next";

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' *.supabase.co;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: *.supabase.co blob:;
  connect-src 'self' *.supabase.co wss://${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]};
  font-src 'self' data:;
  frame-src 'self' *.supabase.co;
  object-src 'none';
  form-action 'self';
  frame-ancestors 'none';
  base-uri 'self';
`.replace(/\s{2,}/g, ' ').trim(); // Replace multiple spaces/newlines with single space

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY', // Or 'SAMEORIGIN' if you need to frame your own site
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block', // Modern browsers might not need this if CSP is strong
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()', // Adjust as needed
  },
  // Strict-Transport-Security (HSTS) - only enable if your site is HTTPS only
  // {
  //   key: 'Strict-Transport-Security',
  //   value: 'max-age=63072000; includeSubDomains; preload'
  // }
];

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        // Apply these headers to all routes in your application.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
