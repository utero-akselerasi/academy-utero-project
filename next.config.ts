import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/dashboard/admin/penempatan", destination: "/dashboard/admin", permanent: false },
      { source: "/dashboard/mentor", destination: "/dashboard/admin", permanent: false },
      { source: "/dashboard/mentor/:path*", destination: "/dashboard/admin/:path*", permanent: false },
    ];
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
      bodySizeLimit: "128mb",
    },
    proxyClientMaxBodySize: "128mb",
  },
};

export default nextConfig;
