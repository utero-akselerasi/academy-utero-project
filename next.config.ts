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
    "localhost:3002",
    "*.localhost",
    "*.localhost:3002",
    "lvh.me",
    "lvh.me:3000",
    "*.lvh.me",
    "*.lvh.me:3000",
    "*.maskhar.it.com",
    "*.soundpub.xyz",
    "*.carubra.com",
    "http://10.10.10.102:3002"
  ],
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
