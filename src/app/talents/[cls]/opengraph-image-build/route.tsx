// The link picture of a talent calculator link (/talents/<class>?b=...&o=...): the build's trees as they end, its points per
// tree and the level it needs; without a build, the class's trees with what is new in Forever outlined. The talents page
// points its og:image here with the same query (its own name keeps it on the firewall's list of open paths).
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { buildTitle } from '@/lib/build-pages';
import { getBuildsFor, getClass, getTalents } from '@/lib/data';
import { clip, INK, OG_SIZE, OgFrame, OgTrees, ogFonts } from '@/lib/og';
import { decodeBuild, encodeBuild, requiredLevel, treePoints, upgradeCodes } from '@/lib/talents';

export async function GET(req: NextRequest, { params }: { params: Promise<{ cls: string }> }) {
  const { cls } = await params;
  const c = getClass(cls);
  const t = getTalents(cls);
  if (!c || !t) return new Response('Not found', { status: 404 });
  const q = req.nextUrl.searchParams;
  const { code } = upgradeCodes(t.trees, t.layouts, q.get('v'), q.get('b'), q.get('o'));
  const ranks = decodeBuild(t.trees, code);
  const points = t.trees.map((tree) => treePoints(tree, ranks));
  const total = points.reduce((a, b) => a + b, 0);
  // one of Grimoire's own builds, when the link is exactly one
  const own = total ? getBuildsFor(cls).find((b) => encodeBuild(t.trees, decodeBuild(t.trees, b.code)) === encodeBuild(t.trees, ranks)) : undefined;
  const main = t.trees[points.indexOf(Math.max(...points))];
  const title = own ? buildTitle(own, c) : total ? `${main.name} ${c.name} build` : `${c.name} talents`;
  const line = own
    ? clip(own.summary, 120)
    : total
      ? `${total} point${total === 1 ? '' : 's'}, level ${requiredLevel(total)}, on Forever’s rebuilt trees.`
      : `${t.stats.new} new talents and ${t.stats.changed} reworked ones. Plan a build point by point and share it.`;
  return new ImageResponse(
    (
      <OgFrame color={c.color} foot="Talent calculator">
        <div style={{ display: 'flex', flexDirection: 'column', width: 420, marginRight: 36 }}>
          <span style={{ fontSize: 26, fontWeight: 500, color: c.color }}>WoW Forever · {c.name}</span>
          <span style={{ fontSize: 58, fontWeight: 600, lineHeight: 1.04, marginTop: 10, letterSpacing: -1.5 }}>{title}</span>
          <span style={{ fontSize: 23, lineHeight: 1.35, color: INK.parch, marginTop: 20 }}>{line}</span>
          {total > 0 && <span style={{ fontSize: 40, fontWeight: 600, color: INK.giltBright, marginTop: 'auto' }}>{points.join(' / ')}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <OgTrees t={t} ranks={ranks} color={c.color} cell={34} fresh={!total} />
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: ogFonts(), headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400' } },
  );
}
