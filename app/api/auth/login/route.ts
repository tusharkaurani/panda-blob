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

  return NextResponse.json({ success: true });
}
