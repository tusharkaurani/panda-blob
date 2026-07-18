import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { generateAccessKey } from "@/lib/api-key";
import { isValidUUID } from "@/lib/validation";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("apps")
    .update({ access_key: generateAccessKey() })
    .eq("id", id)
    .select("id, access_key")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
