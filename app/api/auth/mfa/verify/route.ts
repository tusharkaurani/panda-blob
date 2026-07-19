import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase-route";
import { requireAuthenticatedAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { factorId?: string; challengeId?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.factorId || !body.challengeId || !body.code) {
    return NextResponse.json(
      { error: "factorId, challengeId, and code are required" },
      { status: 400 }
    );
  }

  const supabase = await createRouteSupabaseClient();
  const auth = await requireAuthenticatedAdmin(supabase);
  if ("error" in auth) return auth.error;

  const { error } = await supabase.auth.mfa.verify({
    factorId: body.factorId,
    challengeId: body.challengeId,
    code: body.code,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // mfa.verify() upgrades the session to aal2. Because this client was built
  // with createRouteSupabaseClient()'s write-capable cookie adapter, the
  // Supabase SDK persists the new tokens into the response cookies as a side
  // effect of this call — no extra plumbing needed here.
  return NextResponse.json({ success: true });
}
