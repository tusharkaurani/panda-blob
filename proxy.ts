import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { hasSatisfiedAal, isAdminEmail } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/apps", "/blobs", "/docs", "/api/admin"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const emailMatches = isAdminEmail(user?.email);
  // Only ask Supabase about AAL when the email already matches — no point
  // spending a round trip on a session that's rejected either way.
  const aalSatisfied = emailMatches ? await hasSatisfiedAal(supabase) : true;
  const isAdmin = emailMatches && aalSatisfied;
  const needsMfaStepUp = emailMatches && !aalSatisfied;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !isAdmin) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const dest = needsMfaStepUp ? "/login/mfa" : "/login";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (pathname === "/login") {
    if (isAdmin) return NextResponse.redirect(new URL("/apps", request.url));
    if (needsMfaStepUp) return NextResponse.redirect(new URL("/login/mfa", request.url));
  }

  if (pathname === "/login/mfa") {
    if (isAdmin) return NextResponse.redirect(new URL("/apps", request.url));
    // No password-authenticated session at all, or nothing to step up —
    // there's nothing this page can do, send them back to start over.
    if (!needsMfaStepUp) return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/blob|api/stats).*)"],
};
