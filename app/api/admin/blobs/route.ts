import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { parsePagination } from "@/lib/pagination";
import { isValidUUID } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const { page, limit, from, to } = parsePagination(searchParams);
  const ownerId = searchParams.get("owner_id");
  const search = searchParams.get("search");

  if (ownerId && !isValidUUID(ownerId)) {
    return NextResponse.json({ error: "Invalid owner_id" }, { status: 400 });
  }

  const searchByName = !!search && !isValidUUID(search);
  const selectCols = `id, owner_id, data, created_at, updated_at, api_users${
    searchByName ? "!inner" : ""
  }(name)`;

  const supabase = supabaseServer();
  let query = supabase
    .from("blobs")
    .select(selectCols, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (ownerId) {
    query = query.eq("owner_id", ownerId);
  }

  if (search) {
    if (isValidUUID(search)) {
      query = query.eq("id", search);
    } else {
      query = query.ilike("api_users.name", `%${search}%`);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to list blobs" }, { status: 500 });
  }

  const items = (data ?? []).map((row: any) => ({
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.api_users?.name ?? null,
    data: row.data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return NextResponse.json({ items, total: count ?? 0, page, limit });
}

export async function POST(request: NextRequest) {
  let body: { owner_id?: string; data?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.owner_id || !isValidUUID(body.owner_id)) {
    return NextResponse.json(
      { error: "owner_id is required and must be a valid UUID" },
      { status: 400 }
    );
  }
  if (body.data === undefined) {
    return NextResponse.json({ error: "data is required" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("blobs")
    .insert({ owner_id: body.owner_id, data: body.data })
    .select("id, owner_id, data, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to create blob (check owner_id exists)" },
      { status: 400 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}
