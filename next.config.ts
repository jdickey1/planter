import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "linkplanter.com" },
      { protocol: "https", hostname: "www.linkplanter.com" },
    ],
  },
};

export default nextConfig;
