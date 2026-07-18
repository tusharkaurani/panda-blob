import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseServer() {
  if (!client) {
    client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return client;
}
