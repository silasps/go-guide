import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'eqnekupeiehgkacegmgl.supabase.co' },
      // Thumbnail automática dos vídeos de capa (Bunny Stream) — o hostname
      // da pull zone segue sempre esse padrão, qualquer que seja a library.
      { protocol: 'https', hostname: '*.b-cdn.net' },
    ],
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
