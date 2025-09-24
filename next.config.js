/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        canvas: false,
      };
    }

    // Handle PDF.js worker
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    return config;
  },
  // Production optimizations
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,

  // Handle PDF.js compatibility
  experimental: {
    esmExternals: 'loose',
  },

  // Headers now consolidated in vercel.json for deployment consistency
}

module.exports = nextConfig