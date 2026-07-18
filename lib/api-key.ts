import "server-only";
import { randomBytes } from "crypto";
import { supabaseServer } from "./supabase-server";

export function generateAccessKey(): string {
  return `pb_${randomBytes(32).toString("base64url")}`;
}

export type App = {
  id: string;
  name: string;
  is_active: boolean;
};

export async function lookupAppByKey(accessKey: string): Promise<App | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("apps")
    .select("id, name, is_active")
    .eq("access_key", accessKey)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as App;
}
