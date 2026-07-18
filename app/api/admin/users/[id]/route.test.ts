import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "@/tests/support/fake-supabase-server";
import { makeApiUser, makeBlob } from "@/tests/support/fixtures";
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

describe("GET /api/admin/users/[id]", () => {
  it("passes through requireAdmin's error unchanged", async () => {
    mocks.requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(makeRequest("http://localhost/x"), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid UUID", async () => {
    const res = await GET(makeRequest("http://localhost/x"), withParams({ id: INVALID_UUID }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent user", async () => {
    const res = await GET(makeRequest("http://localhost/x"), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(404);
  });

  it("returns the user with blob_count", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    mocks.fake.__state.blobs.push(makeBlob({ owner_id: user.id }));

    const res = await GET(makeRequest("http://localhost/x"), withParams({ id: user.id }));
    expect(res.status).toBe(200);
    expect((await res.json()).blob_count).toBe(1);
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  it("returns 400 for an invalid UUID", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { is_active: false } }),
      withParams({ id: INVALID_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when no recognized fields are provided", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: {} }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is the only field but is blank", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { name: "   " } }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: "{not json" }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent user", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { is_active: false } }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(404);
  });

  it("toggles is_active true -> false", async () => {
    const user = makeApiUser({ is_active: true });
    mocks.fake.__state.api_users.push(user);
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { is_active: false } }),
      withParams({ id: user.id })
    );
    expect((await res.json()).is_active).toBe(false);
  });

  it("toggles is_active false -> true", async () => {
    const user = makeApiUser({ is_active: false });
    mocks.fake.__state.api_users.push(user);
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { is_active: true } }),
      withParams({ id: user.id })
    );
    expect((await res.json()).is_active).toBe(true);
  });

  it("updates the name", async () => {
    const user = makeApiUser({ name: "old-name" });
    mocks.fake.__state.api_users.push(user);
    const res = await PATCH(
      makeRequest("http://localhost/x", { method: "PATCH", body: { name: "new-name" } }),
      withParams({ id: user.id })
    );
    expect((await res.json()).name).toBe("new-name");
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  it("returns 400 for an invalid UUID", async () => {
    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), withParams({ id: INVALID_UUID }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent user", async () => {
    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(404);
  });

  it("returns 500 on a data-layer error", async () => {
    mocks.fake.__injectError("api_users", "delete");
    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(500);
  });

  it("deletes the user and returns 204", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    const res = await DELETE(makeRequest("http://localhost/x", { method: "DELETE" }), withParams({ id: user.id }));
    expect(res.status).toBe(204);
    expect(mocks.fake.__state.api_users).toHaveLength(0);
  });
});
