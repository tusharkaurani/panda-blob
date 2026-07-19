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
  //
  // Note: listFactors()'s `.totp` array only contains *verified* TOTP
  // factors (it's meant for AAL bookkeeping) — unverified ones only show up
  // in `.all`. Filtering on `.totp` here silently finds nothing, so we have
  // to filter `.all` by factor_type ourselves.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  const staleFactors = (existing?.all ?? []).filter(
    (f) => f.factor_type === "totp" && f.status !== "verified"
  );
  for (const factor of staleFactors) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  // Without an explicit issuer, Supabase falls back to the GoTrue site URL
  // (e.g. "localhost:3000"), so authenticator apps show a confusing/incorrect
  // label instead of the app name. Pin it explicitly.
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "pandablob",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  });
}
