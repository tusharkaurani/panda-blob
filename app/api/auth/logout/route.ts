import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase-route";

export async function POST() {
  const supabase = await createRouteSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
