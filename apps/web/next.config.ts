import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const worktreeRoot = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@greencity/shared"],
  // Worktree sits under .local/; pin tracing root so Next does not pick the parent monorepo.
  outputFileTracingRoot: worktreeRoot,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/:path*",
      },
    ];
  },
};

export default nextConfig;
