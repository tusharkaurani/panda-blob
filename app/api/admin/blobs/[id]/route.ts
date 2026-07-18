import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid blob id" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("blobs")
    .select("id, owner_id, data, created_at, updated_at, api_users(name)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Blob not found" }, { status: 404 });
  }

  const row = data as any;
  return NextResponse.json({
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.api_users?.name ?? null,
    data: row.data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid blob id" }, { status: 400 });
  }

  let body: { data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.data === undefined) {
    return NextResponse.json({ error: "data is required" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("blobs")
    .update({ data: body.data })
    .eq("id", id)
    .select("id, owner_id, data, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Blob not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid blob id" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error, count } = await supabase
    .from("blobs")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete blob" }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "Blob not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
