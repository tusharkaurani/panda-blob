import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
