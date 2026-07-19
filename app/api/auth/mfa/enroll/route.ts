import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase-route";
import { requireAuthenticatedAdmin } from "@/lib/auth";

export async function POST() {
  const supabase = await createRouteSupabaseClient();
  const auth = await requireAuthenticatedAdmin(supabase);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  });
}
