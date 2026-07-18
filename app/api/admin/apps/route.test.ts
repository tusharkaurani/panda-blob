import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "@/tests/support/fake-supabase-server";
import { makeApp, makeBlob } from "@/tests/support/fixtures";
import { makeRequest } from "@/tests/support/next-request";

const mocks = vi.hoisted(() => ({
  fake: undefined as unknown as FakeSupabaseServer,
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ supabaseServer: () => mocks.fake }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));

import { GET, POST } from "./route";

beforeEach(() => {
  mocks.fake = createFakeSupabaseServer();
  mocks.requireAdmin.mockReset();
  mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-id", email: "admin@example.com" } });
});

describe("GET /api/admin/apps", () => {
  it("passes through requireAdmin's error unchanged", async () => {
    mocks.requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(makeRequest("http://localhost/api/admin/apps"));
    expect(res.status).toBe(401);
  });

  it("derives blob_count as 0 for a user with no blobs", async () => {
    mocks.fake.__state.apps.push(makeApp());
    const res = await GET(makeRequest("http://localhost/api/admin/apps"));
    const body = await res.json();
    expect(body.items[0].blob_count).toBe(0);
  });

  it("derives blob_count correctly for a user with several blobs", async () => {
    const user = makeApp();
    mocks.fake.__state.apps.push(user);
    mocks.fake.__state.blobs.push(makeBlob({ app_id: user.id }), makeBlob({ app_id: user.id }), makeBlob({ app_id: user.id }));

    const res = await GET(makeRequest("http://localhost/api/admin/apps"));
    const body = await res.json();
    expect(body.items[0].blob_count).toBe(3);
  });

  it("filters by name search", async () => {
    mocks.fake.__state.apps.push(makeApp({ name: "project-foo" }), makeApp({ name: "other" }));
    const res = await GET(makeRequest("http://localhost/api/admin/apps?search=foo"));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("project-foo");
  });

  it("returns default pagination shape", async () => {
    const res = await GET(makeRequest("http://localhost/api/admin/apps"));
    const body = await res.json();
    expect(body).toMatchObject({ items: [], total: 0, page: 1, limit: 10 });
  });

  it("returns 500 on a data-layer error", async () => {
    mocks.fake.__injectError("apps", "select");
    const res = await GET(makeRequest("http://localhost/api/admin/apps"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/admin/apps", () => {
  it("passes through requireAdmin's error unchanged", async () => {
    mocks.requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await POST(makeRequest("http://localhost/api/admin/apps", { method: "POST", body: { name: "x" } }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a missing name", async () => {
    const res = await POST(makeRequest("http://localhost/api/admin/apps", { method: "POST", body: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a whitespace-only name", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/apps", { method: "POST", body: { name: "   " } })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/apps", { method: "POST", body: "{not json" })
    );
    expect(res.status).toBe(400);
  });

  it("creates a user with a generated pb_-prefixed access key, returns 201", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/apps", { method: "POST", body: { name: "project-foo" } })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("project-foo");
    expect(body.access_key).toMatch(/^pb_/);
    expect(body.is_active).toBe(true);
  });

  it("returns 500 when the insert fails", async () => {
    mocks.fake.__injectError("apps", "insert");
    const res = await POST(
      makeRequest("http://localhost/api/admin/apps", { method: "POST", body: { name: "x" } })
    );
    expect(res.status).toBe(500);
  });
});
