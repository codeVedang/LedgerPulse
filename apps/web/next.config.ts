import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@ledgerpulse/contracts'],
};

export default nextConfig;
