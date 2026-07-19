import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

// Shared by every place that needs to know if a Supabase Auth user is *the*
// admin — the middleware, getSessionUser, and the MFA endpoints all funnel
// through this so the ADMIN_EMAIL rule can't drift between them.
export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  return !!email && (!adminEmail || email === adminEmail);
}

type MfaAwareClient = {
  auth: { mfa: { getAuthenticatorAssuranceLevel: () => Promise<{ data: MfaAal | null; error: unknown }> } };
};

type MfaAal = { currentLevel: string | null; nextLevel: string | null };

// True once the session has satisfied whatever AAL the account requires.
// - No verified factor enrolled yet -> nextLevel stays "aal1" -> trivially true.
// - A verified factor exists but this session hasn't stepped up -> false.
// - Stepped up (currentLevel === "aal2") -> true.
// Any error asking Supabase is treated as *not* satisfied — fail closed,
// same posture as requireAdminSecret's "unset secret disables the route".
export async function hasSatisfiedAal(supabase: MfaAwareClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel !== "aal2" || data.currentLevel === "aal2";
}

export async function getSessionUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Session refresh happens in middleware; route handlers only read here.
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    return null;
  }

  if (!(await hasSatisfiedAal(supabase))) {
    return null;
  }

  return user;
}

// Used only by the MFA enroll/challenge/verify/unenroll/factors endpoints.
// Deliberately skips the AAL check that getSessionUser enforces: those
// endpoints exist specifically to move a session from aal1 to aal2 (the
// post-password step-up screen) or to manage factors before any step-up
// requirement exists (initial enrollment, where nextLevel is still aal1) —
// gating them on aal2 would make both cases permanently unreachable. Callers
// must pass a route-handler client (createRouteSupabaseClient) so a
// successful mfa.verify() can persist the upgraded session into cookies.
export async function requireAuthenticatedAdmin(supabase: {
  auth: { getUser: () => Promise<{ data: { user: { email?: string | null } | null } }> };
}): Promise<{ user: { email?: string | null } } | { error: NextResponse }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user };
}

// Every /api/admin/* route handler must call this first. proxy.ts already
// gates these paths, but a route that trusted the middleware alone would
// have zero protection if the matcher config ever regressed — this makes
// each handler independently safe.
export async function requireAdmin(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>> } | { error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}

// For server-to-server / external callers that can't hold a Supabase Auth
// session (that's cookie-based and browser-only). Gates on a static shared
// secret instead — e.g. `?secret=...` — checked in constant time so response
// timing can't be used to guess it byte-by-byte.
export function requireAdminSecret(request: NextRequest): { error: NextResponse } | { ok: true } {
  const configured = process.env.ADMIN_API_SECRET;
  if (!configured) {
    // Fail closed: an unset secret disables the endpoint rather than opening it.
    return { error: NextResponse.json({ error: "Not configured" }, { status: 503 }) };
  }

  const provided = request.nextUrl.searchParams.get("secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  const valid = a.length === b.length && timingSafeEqual(a, b);

  if (!valid) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
}
