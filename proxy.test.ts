import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })),
}));

import { proxy } from "./proxy";

const savedEnv = { ...process.env };

function req(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

beforeEach(() => {
  mocks.getUser.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("proxy middleware", () => {
  it("redirects a protected page to /login when there is no session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req("/users"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("returns 401 JSON (not a redirect) for a protected admin API route with no session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req("/api/admin/users"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("redirects when ADMIN_EMAIL is set and the session email doesn't match", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    mocks.getUser.mockResolvedValue({ data: { user: { email: "someone-else@example.com" } } });
    const res = await proxy(req("/blobs"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("passes through a protected page when authenticated and ADMIN_EMAIL is unset (any user is admin)", async () => {
    delete process.env.ADMIN_EMAIL;
    mocks.getUser.mockResolvedValue({ data: { user: { email: "anyone@example.com" } } });
    const res = await proxy(req("/docs"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects /login -> /users for an already-admin session", async () => {
    delete process.env.ADMIN_EMAIL;
    mocks.getUser.mockResolvedValue({ data: { user: { email: "anyone@example.com" } } });
    const res = await proxy(req("/login"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/users");
  });

  it("passes through /login when there is no session (renders the login page)", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req("/login"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through public paths (/api/blob, /api/stats) even with no session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await proxy(req("/api/blob/123"))).status).toBe(200);
    expect((await proxy(req("/api/stats"))).status).toBe(200);
  });

  it("documents current loose-prefix behavior: /blobsx string-prefix-matches /blobs and is treated as protected", async () => {
    // PROTECTED_PREFIXES uses pathname.startsWith(prefix), not a segment-aware
    // match. This pins today's actual behavior rather than asserting an
    // "ideal" one — a future change to segment-aware matching should update
    // this test deliberately, not by accident.
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(req("/blobsx"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
