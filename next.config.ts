import type { NextConfig } from "next";

// Served from /portfolio/old by the master Pages workflow, which sets GITHUB_PAGES=true.
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  /* config options here */
  // PPR-based features can't be combined with static export.
  ...(isPages
    ? {
        output: "export" as const,
        basePath: "/portfolio/old",
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        cacheComponents: true,
        partialPrefetching: true,
      }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
