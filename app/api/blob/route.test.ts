import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "@/tests/support/fake-supabase-server";
import { makeApiUser } from "@/tests/support/fixtures";
import { makeRequest } from "@/tests/support/next-request";

const mocks = vi.hoisted(() => ({
  fake: undefined as unknown as FakeSupabaseServer,
  lookupUserByKey: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ supabaseServer: () => mocks.fake }));
vi.mock("@/lib/api-key", () => ({ lookupUserByKey: mocks.lookupUserByKey }));

import { POST } from "./route";

beforeEach(() => {
  mocks.fake = createFakeSupabaseServer();
  mocks.lookupUserByKey.mockReset();
});

describe("POST /api/blob", () => {
  it("returns 401 when apiKey is missing", async () => {
    const res = await POST(makeRequest("http://localhost/api/blob", { method: "POST", body: {} }));
    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown/invalid apiKey", async () => {
    mocks.lookupUserByKey.mockResolvedValue(null);
    const res = await POST(
      makeRequest("http://localhost/api/blob?apiKey=bad", { method: "POST", body: {} })
    );
    expect(res.status).toBe(401);
  });

  it("creates a blob and returns 201 with a Location header", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    mocks.lookupUserByKey.mockResolvedValue({ id: user.id, name: user.name, is_active: true });

    const res = await POST(
      makeRequest("http://localhost/api/blob?apiKey=pb_valid", {
        method: "POST",
        body: { hello: "world" },
      })
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ hello: "world" });
    const location = res.headers.get("Location");
    expect(location).toContain("apiKey=pb_valid");
    expect(location).toMatch(/^\/api\/blob\/[0-9a-f-]{36}\?/);
  });

  it("returns 400 for malformed JSON", async () => {
    const user = makeApiUser();
    mocks.lookupUserByKey.mockResolvedValue({ id: user.id, name: user.name, is_active: true });

    const res = await POST(
      makeRequest("http://localhost/api/blob?apiKey=pb_valid", { method: "POST", body: "{not json" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 413 for a body over the size cap", async () => {
    const user = makeApiUser();
    mocks.lookupUserByKey.mockResolvedValue({ id: user.id, name: user.name, is_active: true });

    const res = await POST(
      makeRequest("http://localhost/api/blob?apiKey=pb_valid", {
        method: "POST",
        body: { big: "x".repeat(3_000_001) },
      })
    );
    expect(res.status).toBe(413);
  });

  it("returns 500 when the insert fails", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    mocks.lookupUserByKey.mockResolvedValue({ id: user.id, name: user.name, is_active: true });
    mocks.fake.__injectError("blobs", "insert");

    const res = await POST(
      makeRequest("http://localhost/api/blob?apiKey=pb_valid", { method: "POST", body: {} })
    );
    expect(res.status).toBe(500);
  });
});
