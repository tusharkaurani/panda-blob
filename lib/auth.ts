import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

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
