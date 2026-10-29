import { NextResponse } from 'next/server';
import { NO_STORE, fail, guard } from '@/lib/auth';
import { BuildError, deleteBuild, renameBuild, saveBuild } from '@/lib/builds';

// POST   /api/builds       { kind, path, name }  save a build from a planner (the same link again only moves it to the top)
// PATCH  /api/builds/<id>  { name }              rename it
// DELETE /api/builds/<id>                        remove it
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id?: string[] }> };

const ID = /^[A-Za-z0-9_-]{12}$/;
const oops = (what: string, e: unknown) => {
  if (e instanceof BuildError) return fail(e.status, e.message);
  console.error(`[grimoire] could not ${what}:`, e instanceof Error ? e.message : e);
  return fail(500, 'Something went wrong. Try again.');
};
const idOf = async (params: Ctx['params']) => {
  const parts = (await params).id ?? [];
  return parts.length === 1 && ID.test(parts[0]) ? parts[0] : null;
};

export async function POST(req: Request, { params }: Ctx) {
  if ((await params).id) return fail(404, 'Not found.');
  const user = await guard(req, { write: true, rate: ['save', 60, 600] });
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => null)) as { kind?: unknown; path?: unknown; name?: unknown } | null;
  try {
    return NextResponse.json(await saveBuild(user.id, body?.kind, body?.path, body?.name), { headers: NO_STORE });
  } catch (e) {
    return oops('save a build', e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const id = await idOf(params);
  if (!id) return fail(404, 'Not found.');
  const user = await guard(req, { write: true, rate: ['rename', 120, 600] });
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  try {
    const build = await renameBuild(user.id, id, body?.name);
    return build ? NextResponse.json({ build }, { headers: NO_STORE }) : fail(404, 'That build is not saved any more.');
  } catch (e) {
    return oops('rename a build', e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const id = await idOf(params);
  if (!id) return fail(404, 'Not found.');
  const user = await guard(req, { write: true, rate: ['remove', 120, 600] });
  if (user instanceof Response) return user;
  try {
    await deleteBuild(user.id, id); // already gone counts as done
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return oops('delete a build', e);
  }
}
