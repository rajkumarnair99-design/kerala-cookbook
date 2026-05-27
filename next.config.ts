import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.51"],
  // Hide the floating "N" route-status badge in dev — it overlays the
  // bottom-left of the editor. Dev-only feature; production is unaffected.
  devIndicators: false,
};

export default nextConfig;
