/** @type {import('next').NextConfig} */

// App and auth flow routes carry noindex so they stay out of search results.
const NOINDEX_ROUTES = [
  'pos', 'kot', 'tables', 'orders', 'variance', 'inventory', 'recipes',
  'ingredients', 'wastage', 'stock-count', 'purchases', 'menu', 'customers',
  'attendance', 'users', 'outlets', 'reports', 'audit-logs', 'settings',
  'plans', 'subscriptions', 'waiter', 'login', 'signup', 'forgot-password',
  'reset-password', 'join', 'billing-test', 'refund-admin',
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/register', destination: '/signup', permanent: true },
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },
    ];
  },
  async headers() {
    return [{source: '/:path*', headers: [
      {key: 'Strict-Transport-Security', value: 'max-age=31536000'},
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'X-Frame-Options', value: 'DENY'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
      {key: 'Content-Security-Policy-Report-Only', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.razorpay.com https://challenges.cloudflare.com; frame-src https://api.razorpay.com https://*.razorpay.com https://challenges.cloudflare.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report"},
      {key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"},
    ]}, {source: '/api/:path*', headers: [{key: 'Cache-Control', value: 'private, no-store'}]},
      // These are client-only shells. Never render personal data into a shared cached shell.
      ...NOINDEX_ROUTES.map((route) => ({
        source: `/${route}/:path*`,
        headers: [{key: 'X-Robots-Tag', value: 'noindex, nofollow'}],
      }))];
  },
  typescript: {
    // Type errors must block production builds
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
