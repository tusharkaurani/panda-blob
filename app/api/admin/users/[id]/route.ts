import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/validation";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("api_users")
    .select("id, name, access_key, is_active, created_at, updated_at, blobs(count)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const row = data as any;
  return NextResponse.json({
    id: row.id,
    name: row.name,
    access_key: row.access_key,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    blob_count: row.blobs?.[0]?.count ?? 0,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: { name?: string; is_active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: { name?: string; is_active?: boolean } = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("api_users")
    .update(update)
    .eq("id", id)
    .select("id, name, access_key, is_active, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error, count } = await supabase
    .from("api_users")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
