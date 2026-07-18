import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

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

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user?.email !== adminEmail) {
    return null;
  }

  return user;
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
