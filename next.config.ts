import type { NextConfig } from "next";

// Versión de muestra: sitio estático para GitHub Pages, sin servidor ni red.
const basePath = process.env.DEMO_BASE_PATH ?? "/Lubricenter-demo";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
