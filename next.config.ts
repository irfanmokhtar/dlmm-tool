import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    BIGINT_SLOW_NOT_QUICK: "true",
  },
  logging: {
    incomingRequests: process.env.NEXT_REQUEST_LOG === "true",
  },
};

export default nextConfig;
