import { randomUUID } from "node:crypto";
import type { ApiUserRow, BlobRow } from "./fake-supabase-server";

let counter = 0;

export function makeApiUser(overrides: Partial<ApiUserRow> = {}): ApiUserRow {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: `user-${counter}`,
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
    owner_id: overrides.owner_id ?? randomUUID(),
    data: { hello: "world" },
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
