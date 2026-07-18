import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "@/tests/support/fake-supabase-server";
import { makeApiUser, makeBlob } from "@/tests/support/fixtures";
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

const RANDOM_UUID = "00000000-0000-0000-0000-000000000000";

describe("GET /api/admin/blobs", () => {
  it("passes through requireAdmin's error unchanged", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    mocks.requireAdmin.mockResolvedValue({ error: unauthorized });

    const res = await GET(makeRequest("http://localhost/api/admin/blobs"));
    expect(res.status).toBe(401);
  });

  it("lists blobs with owner_name/owner_access_key populated, default pagination", async () => {
    const user = makeApiUser({ name: "project-foo" });
    const blob = makeBlob({ owner_id: user.id });
    mocks.fake.__state.api_users.push(user);
    mocks.fake.__state.blobs.push(blob);

    const res = await GET(makeRequest("http://localhost/api/admin/blobs"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      items: [
        {
          id: blob.id,
          owner_id: user.id,
          owner_name: "project-foo",
          owner_access_key: user.access_key,
          data: blob.data,
          created_at: blob.created_at,
          updated_at: blob.updated_at,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
  });

  it("returns 400 for an invalid owner_id filter", async () => {
    const res = await GET(makeRequest("http://localhost/api/admin/blobs?owner_id=not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("filters by a valid owner_id", async () => {
    const owner = makeApiUser();
    const other = makeApiUser();
    mocks.fake.__state.api_users.push(owner, other);
    mocks.fake.__state.blobs.push(makeBlob({ owner_id: owner.id }), makeBlob({ owner_id: other.id }));

    const res = await GET(makeRequest(`http://localhost/api/admin/blobs?owner_id=${owner.id}`));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].owner_id).toBe(owner.id);
  });

  it("treats a UUID search as an id-equality filter, not a name search", async () => {
    const user = makeApiUser();
    const target = makeBlob({ owner_id: user.id });
    const other = makeBlob({ owner_id: user.id });
    mocks.fake.__state.api_users.push(user);
    mocks.fake.__state.blobs.push(target, other);

    const res = await GET(makeRequest(`http://localhost/api/admin/blobs?search=${target.id}`));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(target.id);
  });

  it("treats a non-UUID search as an owner-name search, excluding non-matching owners", async () => {
    const match = makeApiUser({ name: "project-foo" });
    const noMatch = makeApiUser({ name: "something-else" });
    mocks.fake.__state.api_users.push(match, noMatch);
    mocks.fake.__state.blobs.push(makeBlob({ owner_id: match.id }), makeBlob({ owner_id: noMatch.id }));

    const res = await GET(makeRequest("http://localhost/api/admin/blobs?search=foo"));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].owner_name).toBe("project-foo");
  });

  it("reports total count across all pages, not just the returned page", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    for (let i = 0; i < 25; i++) {
      mocks.fake.__state.blobs.push(makeBlob({ owner_id: user.id }));
    }

    const res = await GET(makeRequest("http://localhost/api/admin/blobs?page=1&limit=10"));
    const body = await res.json();
    expect(body.items).toHaveLength(10);
    expect(body.total).toBe(25);
  });

  it("returns 500 on a data-layer error", async () => {
    mocks.fake.__injectError("blobs", "select");
    const res = await GET(makeRequest("http://localhost/api/admin/blobs"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/admin/blobs", () => {
  it("passes through requireAdmin's error unchanged", async () => {
    mocks.requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await POST(makeRequest("http://localhost/api/admin/blobs", { method: "POST", body: {} }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when owner_id is missing", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/blobs", { method: "POST", body: { data: {} } })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when owner_id is not a valid UUID", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/blobs", {
        method: "POST",
        body: { owner_id: "not-a-uuid", data: {} },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when data is undefined (key absent)", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    const res = await POST(
      makeRequest("http://localhost/api/admin/blobs", {
        method: "POST",
        body: { owner_id: user.id },
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts data: null as a legitimate value (distinct from undefined/absent)", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    const res = await POST(
      makeRequest("http://localhost/api/admin/blobs", {
        method: "POST",
        body: { owner_id: user.id, data: null },
      })
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 when owner_id doesn't reference an existing user", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/blobs", {
        method: "POST",
        body: { owner_id: RANDOM_UUID, data: {} },
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/owner_id exists/);
  });

  it("creates a blob and returns 201", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    const res = await POST(
      makeRequest("http://localhost/api/admin/blobs", {
        method: "POST",
        body: { owner_id: user.id, data: { hello: "world" } },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.owner_id).toBe(user.id);
    expect(body.data).toEqual({ hello: "world" });
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/blobs", { method: "POST", body: "{not json" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 413 for an oversized body", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    const res = await POST(
      makeRequest("http://localhost/api/admin/blobs", {
        method: "POST",
        body: { owner_id: user.id, data: "x".repeat(3_000_001) },
      })
    );
    expect(res.status).toBe(413);
  });
});
