import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "@/tests/support/fake-supabase-server";
import { makeApp, makeBlob } from "@/tests/support/fixtures";
import { makeRequest, withParams } from "@/tests/support/next-request";

const mocks = vi.hoisted(() => ({
  fake: undefined as unknown as FakeSupabaseServer,
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ supabaseServer: () => mocks.fake }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));

import { GET, PATCH, DELETE } from "./route";

const INVALID_UUID = "not-a-uuid";
const RANDOM_UUID = "00000000-0000-0000-0000-000000000000";

beforeEach(() => {
  mocks.fake = createFakeSupabaseServer();
  mocks.requireAdmin.mockReset();
  mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-id", email: "admin@example.com" } });
});

describe("GET /api/admin/blobs/[id]", () => {
  it("passes through requireAdmin's error unchanged", async () => {
    mocks.requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(makeRequest(`http://localhost/x`), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid UUID", async () => {
    const res = await GET(makeRequest("http://localhost/x"), withParams({ id: INVALID_UUID }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the blob doesn't exist", async () => {
    const res = await GET(makeRequest("http://localhost/x"), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(404);
  });

  it("returns the blob with embedded app_name/app_access_key", async () => {
    const user = makeApp({ name: "project-foo" });
    const blob = makeBlob({ app_id: user.id });
    mocks.fake.__state.apps.push(user);
    mocks.fake.__state.blobs.push(blob);

    const res = await GET(makeRequest("http://localhost/x"), withParams({ id: blob.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.app_name).toBe("project-foo");
    expect(body.app_access_key).toBe(user.access_key);
  });
});

describe("PATCH /api/admin/blobs/[id]", () => {
  it("returns 400 for an invalid UUID", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { data: {} } }),
      withParams({ id: INVALID_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when data is undefined", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: {} }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent blob", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { data: {} } }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: "{not json" }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 413 for an oversized body", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { data: "x".repeat(3_000_001) } }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(413);
  });

  it("updates the blob and returns 200 with the updated row", async () => {
    const user = makeApp();
    const blob = makeBlob({ app_id: user.id, data: { old: true } });
    mocks.fake.__state.apps.push(user);
    mocks.fake.__state.blobs.push(blob);

    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { data: { new: true } } }),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ new: true });
  });
});

describe("DELETE /api/admin/blobs/[id]", () => {
  it("returns 400 for an invalid UUID", async () => {
    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), withParams({ id: INVALID_UUID }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent blob", async () => {
    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(404);
  });

  it("returns 500 on a data-layer error", async () => {
    mocks.fake.__injectError("blobs", "delete");
    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(500);
  });

  it("deletes the blob and returns 204", async () => {
    const user = makeApp();
    const blob = makeBlob({ app_id: user.id });
    mocks.fake.__state.apps.push(user);
    mocks.fake.__state.blobs.push(blob);

    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), withParams({ id: blob.id }));
    expect(res.status).toBe(204);
    expect(mocks.fake.__state.blobs).toHaveLength(0);
  });
});
