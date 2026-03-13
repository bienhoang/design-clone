import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'sharp'],
  },
  transpilePackages: ['../src'],
  webpack: (config, { isServer }) => {
    config.resolve.alias['@src'] = path.resolve(__dirname, '../src');
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('sharp');
    }
    return config;
  },
};

export default nextConfig;
