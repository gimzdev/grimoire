import type { NextConfig } from 'next';

// The leveling routes were once one per starting zone (/tools/leveling/human/20); each is now one per race and class,
// so an old address opens its race's warrior route at the same levels.
const OLD_ROUTES: Record<string, string> = {
  human: 'human-warrior',
  'dwarf-gnome': 'dwarf-warrior',
  'night-elf': 'night-elf-warrior',
  'orc-troll': 'orc-warrior',
  tauren: 'tauren-warrior',
  undead: 'undead-warrior',
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // No interactive "upgrade Next.js?" stop in the middle of an installer run: versions are pinned and changed on purpose
  experimental: { agentUpgrade: false },
  // The installer's builds skip type checking: these sources are checked before release (npm run build still checks).
  typescript: { ignoreBuildErrors: process.env.GRIMOIRE_SKIP_TYPECHECK === '1' },
  // Datasets, guides and your own pictures are read from disk at runtime; make sure serverless deploys ship them.
  outputFileTracingIncludes: { '/**': ['./data/**/*', './content/**/*', './public/art/**/*'] },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Official World of Warcraft: Forever artwork from Blizzard's own sites (resized here); icons load straight from Blizzard's icon server.
    remotePatterns: [
      { protocol: 'https', hostname: 'blz-contentstack-images.akamaized.net' },
      { protocol: 'https', hostname: 'bnetcmsus-a.akamaihd.net' },
    ],
    deviceSizes: [640, 828, 1080, 1440, 1920, 2560],
    imageSizes: [96, 160, 256, 384],
    qualities: [60, 75, 85],
    minimumCacheTTL: 2_592_000,
  },
  async redirects() {
    return Object.entries(OLD_ROUTES).map(([from, to]) => ({ source: `/tools/leveling/${from}/:band*`, destination: `/tools/leveling/${to}/:band*`, permanent: true }));
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
