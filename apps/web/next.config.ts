import type { NextConfig } from 'next';

/**
 * The API origin the web app proxies to.
 *
 * In development this is the local API on :4000; in production it is the
 * deployed API's URL, supplied as the API_ORIGIN environment variable at build
 * and run time.
 *
 * The browser always talks to the web app's own origin (`/api/*`) and Next
 * rewrites those requests to the API. That keeps the authentication cookies
 * first-party — they are set with SameSite=Lax, which a browser would refuse to
 * send on a cross-site request to a separate API domain — so login works the
 * same in production as it does locally.
 */
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

const config: NextConfig = {
  reactStrictMode: true,
  // The shared packages are TypeScript source in this monorepo; Next compiles
  // them alongside the app rather than requiring a build step first.
  transpilePackages: ['@bmz/contracts', '@bmz/i18n'],
  async rewrites() {
    return [
      {
        // The NestJS API serves everything under /api (with URI versioning, so
        // /api/v1/...). Proxying the whole prefix keeps the app on one origin.
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default config;
