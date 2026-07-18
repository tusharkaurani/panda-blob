import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireAdminSecret } from "@/lib/auth";

// Aggregate counts only — no user/blob content — for external consumers
// (e.g. a stats widget on another site) that hold the shared secret but
// aren't the logged-in admin.
export async function GET(request: NextRequest) {
  const auth = requireAdminSecret(request);
  if ("error" in auth) return auth.error;

  const supabase = supabaseServer();
  const [{ count: totalUsers, error: usersError }, { count: totalBlobs, error: blobsError }] =
    await Promise.all([
      supabase.from("api_users").select("*", { count: "exact", head: true }),
      supabase.from("blobs").select("*", { count: "exact", head: true }),
    ]);

  if (usersError || blobsError) {
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    totalBlobs: totalBlobs ?? 0,
  });
}
