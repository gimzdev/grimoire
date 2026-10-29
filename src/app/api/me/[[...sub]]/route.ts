import { NextResponse } from 'next/server';
import { NO_STORE, auth, fail, guard } from '@/lib/auth';
import { BuildError, deleteAccount, exportData, getLegacyProgress, putLegacyProgress, savedPaths } from '@/lib/builds';

// GET /api/me: who you are and the links you saved (every Save button reads it once). GET /api/me/export: everything held
// about you, as a file. GET and PUT /api/me/legacy: the Legacy Challenges you ticked (PUT { base, done } applies what changed
// since base). DELETE /api/me: the account, for good.
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ sub?: string[] }> };

export async function GET(req: Request, { params }: Ctx) {
  const sub = (await params).sub?.join('/');
  if (sub && sub !== 'export' && sub !== 'legacy') return fail(404, 'Not found.');
  const user = await guard(req, sub === 'export' ? { rate: ['export', 10, 3600] } : sub === 'legacy' ? { rate: ['legacy-read', 120, 600] } : {});
  if (user instanceof Response) return user;
  try {
    if (sub === 'legacy') return NextResponse.json({ progress: await getLegacyProgress(user.id) }, { headers: NO_STORE });
    if (sub)
      return new NextResponse(JSON.stringify(await exportData(user), null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="grimoire-my-data.json"', ...NO_STORE },
      });
    return NextResponse.json({ email: user.email, since: user.since, saved: await savedPaths(user.id) }, { headers: NO_STORE });
  } catch (e) {
    console.error('[grimoire] could not read the account:', e instanceof Error ? e.message : e);
    return fail(503, 'Accounts are unavailable right now. Try again in a minute.'); // never a 401: the browser would think the session ended
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  if ((await params).sub?.join('/') !== 'legacy') return fail(404, 'Not found.');
  const user = await guard(req, { write: true, rate: ['legacy', 240, 600] });
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => null)) as { done?: unknown; base?: unknown } | null;
  try {
    return NextResponse.json({ progress: await putLegacyProgress(user.id, body?.done, body?.base) }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof BuildError) return fail(e.status, e.message);
    console.error('[grimoire] could not keep the Legacy Challenges:', e instanceof Error ? e.message : e);
    return fail(503, 'Accounts are unavailable right now. Try again in a minute.');
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if ((await params).sub) return fail(404, 'Not found.');
  const user = await guard(req, { write: true, rate: ['delete', 5, 3600] });
  if (user instanceof Response) return user;
  // Erase first (the sessions go with the account); only then is this browser told to forget its cookie
  try {
    await deleteAccount(user);
  } catch (e) {
    console.error('[grimoire] could not delete an account:', e instanceof Error ? e.message : e);
    return fail(500, 'We could not delete the account. Nothing was changed. Try again in a minute.');
  }
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  // Next turns "Max-Age=0" into an ordinary empty cookie when the same request also renewed the session, so each carries a past date too
  try {
    const { authCookies: c } = await auth().$context;
    for (const { name, attributes: a } of [c.sessionToken, c.sessionData, c.dontRememberToken])
      res.headers.append('set-cookie', `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${a.path || '/'}; HttpOnly; SameSite=Lax${a.secure || name.startsWith('__Secure-') ? '; Secure' : ''}`);
  } catch {
    /* the account is gone, so the cookie no longer opens anything */
  }
  return res;
}
