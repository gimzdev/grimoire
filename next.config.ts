import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The installer's builds skip type checking: these sources are checked before release (npm run build still checks).
  typescript: { ignoreBuildErrors: process.env.GRIMOIRE_SKIP_TYPECHECK === '1' },
  // Datasets, guides and your own pictures are read from disk at runtime; make sure serverless deploys ship them.
  outputFileTracingIncludes: { '/**': ['./data/**/*', './content/**/*', './public/art/**/*'] },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Official artwork from Blizzard's CDNs and screenshots from Wowhead's gallery (resized here); icons load straight from Wowhead's CDN without the optimizer.
    remotePatterns: [
      { protocol: 'https', hostname: 'blz-contentstack-images.akamaized.net' },
      { protocol: 'https', hostname: 'bnetcmsus-a.akamaihd.net' },
      // In-game screenshots from Wowhead's gallery, used on the race, class and zone pages.
      { protocol: 'https', hostname: 'wow.zamimg.com', pathname: '/uploads/screenshots/**' },
    ],
    deviceSizes: [640, 828, 1080, 1440, 1920, 2560],
    imageSizes: [96, 160, 256, 384],
    qualities: [60, 75, 85],
    minimumCacheTTL: 2_592_000,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
