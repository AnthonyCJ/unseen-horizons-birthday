import type { NextConfig } from "next";

const repositoryName = "unseen-horizons-birthday";

const nextConfig: NextConfig = {
  output: "export",
  basePath: `/${repositoryName}`,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
