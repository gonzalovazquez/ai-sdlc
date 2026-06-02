import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output is for Docker/self-hosted only; Vercel handles its own output
  ...(process.env.DOCKER_BUILD === "1" && { output: "standalone" }),
};

export default nextConfig;
