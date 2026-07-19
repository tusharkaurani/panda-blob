import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase-route";
import { requireAuthenticatedAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { factorId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.factorId) {
    return NextResponse.json({ error: "factorId is required" }, { status: 400 });
  }

  const supabase = await createRouteSupabaseClient();
  const auth = await requireAuthenticatedAdmin(supabase);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabase.auth.mfa.challenge({ factorId: body.factorId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ challengeId: data.id });
}
