import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The shared packages are TypeScript source in this monorepo; Next compiles
  // them alongside the app rather than requiring a build step first.
  transpilePackages: ['@bmz/contracts', '@bmz/i18n'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  },
};

export default config;
