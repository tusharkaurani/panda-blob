const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

export const MAX_BLOB_BODY_BYTES = 3_000_000; // 3 MB

// Reads and parses a JSON body while enforcing a size cap, so a valid access
// key (public API) or the admin API can't be used to insert unbounded blobs.
export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_BLOB_BODY_BYTES
): Promise<{ data: unknown } | { error: "too_large" | "invalid_json" }> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { error: "too_large" };
  }
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: "invalid_json" };
  }
}
