import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase-route";
import { requireAuthenticatedAdmin } from "@/lib/auth";

export async function POST() {
  const supabase = await createRouteSupabaseClient();
  const auth = await requireAuthenticatedAdmin(supabase);
  if ("error" in auth) return auth.error;

  // Supabase enforces a unique friendly_name per user, and unverified factors
  // default to an empty friendly_name. If a previous enrollment attempt was
  // abandoned (modal closed before the code was confirmed), that leftover
  // "unverified" factor collides with any new enrollment and enroll() fails
  // with "A factor with the friendly name ... already exists". Clear out any
  // stale unverified TOTP factors first so re-enrolling is always possible.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  const staleFactors = (existing?.totp ?? []).filter((f) => f.status !== "verified");
  for (const factor of staleFactors) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

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
