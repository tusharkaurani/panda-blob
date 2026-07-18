import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { lookupAppByKey } from "@/lib/api-key";
import { readJsonBody } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get("apiKey");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const app = await lookupAppByKey(apiKey);
  if (!app) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const parsed = await readJsonBody(request);
  if ("error" in parsed) {
    if (parsed.error === "too_large") {
      return NextResponse.json({ error: "Body too large (max 3MB)" }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data = parsed.data;

  const supabase = supabaseServer();
  const { data: blob, error } = await supabase
    .from("blobs")
    .insert({ app_id: app.id, data })
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
