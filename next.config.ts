import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Required with several root layouts (site / admin / staff): the 404 for an
    // unmatched URL can no longer be composed from a single app/layout.tsx.
    globalNotFound: true,
    serverActions: {
      bodySizeLimit: "24mb",
    },
  },
};

export default nextConfig;
