import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { generateAccessKey } from "@/lib/api-key";
import { parsePagination } from "@/lib/pagination";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const { page, limit, from, to } = parsePagination(searchParams);
  const search = searchParams.get("search");

  const supabase = supabaseServer();
  let query = supabase
    .from("api_users")
    .select("id, name, access_key, is_active, created_at, updated_at, blobs(count)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }

  const items = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    access_key: row.access_key,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    blob_count: row.blobs?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ items, total: count ?? 0, page, limit });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("api_users")
    .insert({ name, access_key: generateAccessKey() })
    .select("id, name, access_key, is_active, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
