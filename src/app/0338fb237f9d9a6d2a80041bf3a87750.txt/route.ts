// IndexNow's key (Bing, Yandex, Seznam, Naver): ship.sh sends the sitemap's addresses after each deploy, and the search
// engines check that this site holds the key it sends. The key is public by design.
export const dynamic = 'force-static';

export function GET() {
  return new Response('0338fb237f9d9a6d2a80041bf3a87750', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
