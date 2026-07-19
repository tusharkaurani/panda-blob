import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase-route";

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const supabase = await createRouteSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // A verified TOTP factor bumps nextLevel to "aal2"; password alone only
  // gets the session to "aal1". Tell the client so it can route to the
  // /login/mfa step-up screen instead of straight into the dashboard.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired = !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";

  return NextResponse.json({ success: true, mfaRequired });
}
