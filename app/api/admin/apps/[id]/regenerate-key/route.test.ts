import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "@/tests/support/fake-supabase-server";
import { makeApp } from "@/tests/support/fixtures";
import { makeRequest, withParams } from "@/tests/support/next-request";

const mocks = vi.hoisted(() => ({
  fake: undefined as unknown as FakeSupabaseServer,
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ supabaseServer: () => mocks.fake }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));

import { POST } from "./route";

const INVALID_UUID = "not-a-uuid";
const RANDOM_UUID = "00000000-0000-0000-0000-000000000000";

beforeEach(() => {
  mocks.fake = createFakeSupabaseServer();
  mocks.requireAdmin.mockReset();
  mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-id", email: "admin@example.com" } });
});

describe("POST /api/admin/apps/[id]/regenerate-key", () => {
  it("passes through requireAdmin's error unchanged", async () => {
    mocks.requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await POST(makeRequest("http://localhost/x", { method: "POST" }), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid UUID", async () => {
    const res = await POST(makeRequest("http://localhost/x", { method: "POST" }), withParams({ id: INVALID_UUID }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a nonexistent user", async () => {
    const res = await POST(makeRequest("http://localhost/x", { method: "POST" }), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(404);
  });

  it("replaces the access key with a new pb_-prefixed value", async () => {
    const user = makeApp({ access_key: "pb_original" });
    mocks.fake.__state.apps.push(user);

    const res = await POST(makeRequest("http://localhost/x", { method: "POST" }), withParams({ id: user.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_key).toMatch(/^pb_/);
    expect(body.access_key).not.toBe("pb_original");
    expect(mocks.fake.__state.apps[0].access_key).toBe(body.access_key);
  });
});
