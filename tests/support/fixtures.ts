import { randomUUID } from "node:crypto";
import type { AppRow, BlobRow } from "./fake-supabase-server";

let counter = 0;

export function makeApp(overrides: Partial<AppRow> = {}): AppRow {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: `app-${counter}`,
    access_key: `pb_test_${counter}`,
    is_active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function makeBlob(overrides: Partial<BlobRow> = {}): BlobRow {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    app_id: overrides.app_id ?? randomUUID(),
    data: { hello: "world" },
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
