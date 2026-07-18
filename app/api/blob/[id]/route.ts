import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { lookupUserByKey, type ApiUser } from "@/lib/api-key";
import { isValidUUID, readJsonBody } from "@/lib/validation";

type AuthResult = { user: ApiUser } | { error: NextResponse };

async function authenticate(request: NextRequest): Promise<AuthResult> {
  const apiKey = request.nextUrl.searchParams.get("apiKey");
  if (!apiKey) {
    return { error: NextResponse.json({ error: "Missing API key" }, { status: 401 }) };
  }

  const user = await lookupUserByKey(apiKey);
  if (!user) {
    return { error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) };
  }

  return { user };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid blob id" }, { status: 400 });
  }

  const auth = await authenticate(request);
  if ("error" in auth) return auth.error;

  const supabase = supabaseServer();
  const { data: blob } = await supabase
    .from("blobs")
    .select("id, owner_id, data")
    .eq("id", id)
    .maybeSingle();

  if (!blob || blob.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Blob not found" }, { status: 404 });
  }

  return NextResponse.json(blob.data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid blob id" }, { status: 400 });
  }

  const auth = await authenticate(request);
  if ("error" in auth) return auth.error;

  const parsed = await readJsonBody(request);
  if ("error" in parsed) {
    if (parsed.error === "too_large") {
      return NextResponse.json({ error: "Body too large (max 3MB)" }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data = parsed.data;

  const supabase = supabaseServer();
  const { data: existing } = await supabase
    .from("blobs")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Blob not found" }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .from("blobs")
    .update({ data })
    .eq("id", id)
    .select("data")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Failed to update blob" }, { status: 500 });
  }

  return NextResponse.json(updated.data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid blob id" }, { status: 400 });
  }

  const auth = await authenticate(request);
  if ("error" in auth) return auth.error;

  const supabase = supabaseServer();
  const { data: existing } = await supabase
    .from("blobs")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Blob not found" }, { status: 404 });
  }

  await supabase.from("blobs").delete().eq("id", id);

  return new NextResponse(null, { status: 204 });
}
