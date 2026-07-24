import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const worktreeRoot = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

// Server-side rewrite target for /api/*. Local default is the dev API; a deploy
// (web on Vercel, API on Render) sets API_PROXY_TARGET to the API's URL. This is
// a build/server env var, NOT NEXT_PUBLIC — the browser still only ever sees the
// same-origin /api/* path, so the same-origin contract holds in production.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@greencity/shared"],
  // Worktree sits under .local/; pin tracing root so Next does not pick the parent monorepo.
  outputFileTracingRoot: worktreeRoot,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
  // Cheap, always-safe response headers. A full CSP is deliberately left for
  // after the contest — it needs per-source tuning and can break the app if
  // rushed — but these four cost nothing and close the easy findings.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
