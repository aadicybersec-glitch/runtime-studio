import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Keep instant navigations debug toggles active
    instantNavigationDevToolsToggle: true,
  }
};

export default nextConfig;
