import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// For Route Handlers only: unlike Server Components, Route Handlers are
// allowed to write cookies, so setAll actually persists the session here
// (used by /api/auth/login and /api/auth/logout to establish/clear it).
export async function createRouteSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
