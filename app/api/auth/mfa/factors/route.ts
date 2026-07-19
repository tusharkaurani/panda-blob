import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase-route";
import { requireAuthenticatedAdmin } from "@/lib/auth";

export async function GET() {
  const supabase = await createRouteSupabaseClient();
  const auth = await requireAuthenticatedAdmin(supabase);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const factors = (data?.totp ?? []).map(
    (f: { id: string; friendly_name?: string | null; status: string }) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? null,
      status: f.status,
    })
  );

  return NextResponse.json({ factors });
}
