import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { lookupUserByKey } from "@/lib/api-key";

export async function POST(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get("apiKey");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const user = await lookupUserByKey(apiKey);
  if (!user) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: blob, error } = await supabase
    .from("blobs")
    .insert({ owner_id: user.id, data })
    .select("id, data")
    .single();

  if (error || !blob) {
    return NextResponse.json({ error: "Failed to create blob" }, { status: 500 });
  }

  return NextResponse.json(blob.data, {
    status: 201,
    headers: { Location: `/api/blob/${blob.id}?apiKey=${apiKey}` },
  });
}
