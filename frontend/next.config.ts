import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next ignores stray lockfiles in parent directories.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
