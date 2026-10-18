import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep visited/prefetched pages on the client so switching tabs is instant
  experimental: { serverActions: { bodySizeLimit: "50mb" }, staleTimes: { dynamic: 60, static: 300 } },
};

export default nextConfig;
