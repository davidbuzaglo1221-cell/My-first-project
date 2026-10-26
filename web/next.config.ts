import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A build id for the service worker URL, so every deploy installs a fresh offline cache.
  env: { NEXT_PUBLIC_BUILD_ID: String(Date.now()) },
};

export default nextConfig;
