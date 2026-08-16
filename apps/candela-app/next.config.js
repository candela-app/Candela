/** @type {import('next').NextConfig} */
const path = require('path');
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@candela/shared'],
  webpack: (config) => {
    config.resolve.alias['@candela/shared/assets'] = path.resolve(
      __dirname,
      '../../packages/shared/assets',
    );
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
