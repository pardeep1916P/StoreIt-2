import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Source map configuration
  productionBrowserSourceMaps: false,
  
  // Turbopack configuration (when using --turbopack flag)
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Enable source maps in development with better error handling
      config.devtool = 'eval-source-map';
      
      // Ignore source map warnings
      config.ignoreWarnings = [
        /Failed to parse source map/,
        /Unknown url scheme/,
        /GenericFailure/,
        /source map/,
      ];
    }
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100MB",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.pixabay.com",
      },
      {
        protocol: "https",
        hostname: "img.freepik.com",
      },
      {
        protocol: "https",
        hostname: "cloud.appwrite.io",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "www.w3.org",
      },
      {
        protocol: "https",
        hostname: "sample-videos.com",
      },
      {
        protocol: "https",
        hostname: "www.soundjay.com",
      },
      {
        protocol: "https",
        hostname: "www.learningcontainer.com",
      },
      {
        protocol: "https",
        hostname: "storeit-user-files.s3.ap-south-1.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
