import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo>; the workflow sets GITHUB_PAGES=true.
const isPages = process.env.GITHUB_PAGES === "true";
const basePath = isPages ? "/portfolio" : "";

const nextConfig: NextConfig = {
  // Plain <img>/<a> paths to /public files need the prefix added by hand.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  /* config options here */
  // PPR-based features can't be combined with static export.
  ...(isPages
    ? {
        output: "export" as const,
        basePath,
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
        // CSS modules must keep their module type; renaming them to *.css makes them global.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
