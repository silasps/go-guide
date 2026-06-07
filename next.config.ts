import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'eqnekupeiehgkacegmgl.supabase.co' },
    ],
  },
};

export default nextConfig;
