import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isValidUUID, readJsonBody } from "@/lib/validation";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid blob id" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("blobs")
    .select("id, app_id, data, created_at, updated_at, apps(name, access_key)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Blob not found" }, { status: 404 });
  }

  const row = data as any;
  return NextResponse.json({
    id: row.id,
    app_id: row.app_id,
    app_name: row.apps?.name ?? null,
    app_access_key: row.apps?.access_key ?? null,
    data: row.data,
    created_at: row.created_at,
    updated_at: row.updated_at,
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
    return NextResponse.json({ error: "Invalid blob id" }, { status: 400 });
  }

  const parsed = await readJsonBody(request);
  if ("error" in parsed) {
    if (parsed.error === "too_large") {
      return NextResponse.json({ error: "Body too large (max 3MB)" }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = parsed.data as { data?: unknown };
  if (body.data === undefined) {
    return NextResponse.json({ error: "data is required" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("blobs")
    .update({ data: body.data })
    .eq("id", id)
    .select("id, app_id, data, created_at, updated_at")
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
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

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
