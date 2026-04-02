import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    BIGINT_SLOW_NOT_QUICK: "true",
  },
};

export default nextConfig;
