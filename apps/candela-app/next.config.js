/** @type {import('next').NextConfig} */
process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = '1';

const path = require('path');
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@candela/shared', '@mediapipe/tasks-vision', 'webeyetrack'],
  webpack: (config) => {
    config.resolve.alias['@candela/shared/assets'] = path.resolve(
      __dirname,
      '../../packages/shared/assets',
    );
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
