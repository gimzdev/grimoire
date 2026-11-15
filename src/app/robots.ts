import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

// Crawlers that read every page again and again for their own indexes (SEO backlink tools, Exa's AI search) and that do honour
// robots.txt: kept out entirely, search engines unaffected. SE Ranking's alone made 16,000 requests in one day of November 2026.
// What ignores this file meets the Vercel firewall instead (AI bots, Chinese cloud networks, bot protection, a check for China).
const KEPT_OUT = ['SERankingBacklinksBot', 'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'DataForSeoBot', 'BLEXBot', 'Barkrowler', 'ExaBot', 'ExaSearchBot'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/search', '/signin', '/profile'] },
      { userAgent: KEPT_OUT, disallow: '/' },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
