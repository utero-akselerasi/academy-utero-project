import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  allowedDevOrigins: [
    "localhost",
    "localhost:3000",
    "*.localhost",
    "*.localhost:3000",
    "lvh.me",
    "lvh.me:3000",
    "*.lvh.me",
    "*.lvh.me:3000",
    "*.maskhar.it.com",
  ],
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
    proxyClientMaxBodySize: 524288000,
  },
};

export default nextConfig;
