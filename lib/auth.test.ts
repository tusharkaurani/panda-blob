import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  cookieStore: { getAll: vi.fn(() => [{ name: "sb-token", value: "abc" }]) },
  createServerClientCalls: [] as any[],
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((url: string, key: string, options: any) => {
    mocks.createServerClientCalls.push({ url, key, options });
    return { auth: { getUser: mocks.getUser } };
  }),
}));

import { getSessionUser, requireAdmin, requireAdminSecret } from "./auth";

const savedEnv = { ...process.env };

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.cookieStore.getAll.mockClear();
  mocks.createServerClientCalls.length = 0;
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("getSessionUser", () => {
  it("returns null when there is no session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect(await getSessionUser()).toBeNull();
  });

  it("wires cookies().getAll() through to the Supabase client, and setAll is a genuine no-op", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await getSessionUser();

    const { options } = mocks.createServerClientCalls[0];
    expect(options.cookies.getAll()).toEqual([{ name: "sb-token", value: "abc" }]);
    expect(mocks.cookieStore.getAll).toHaveBeenCalled();

    // Route handlers can write cookies; Server Components (where
    // getSessionUser runs) cannot, so setAll here is a deliberate no-op —
    // unlike lib/supabase-route.ts's write-capable version.
    expect(() => options.cookies.setAll([{ name: "x", value: "y", options: {} }])).not.toThrow();
  });

  it("returns the user when ADMIN_EMAIL is unset (any authenticated user is admin)", async () => {
    delete process.env.ADMIN_EMAIL;
    const user = { email: "anyone@example.com" };
    mocks.getUser.mockResolvedValue({ data: { user } });
    expect(await getSessionUser()).toEqual(user);
  });

  it("returns the user when ADMIN_EMAIL is set and matches", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    const user = { email: "admin@example.com" };
    mocks.getUser.mockResolvedValue({ data: { user } });
    expect(await getSessionUser()).toEqual(user);
  });

  it("returns null when ADMIN_EMAIL is set and does not match", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    const user = { email: "someone-else@example.com" };
    mocks.getUser.mockResolvedValue({ data: { user } });
    expect(await getSessionUser()).toBeNull();
  });
});

describe("requireAdmin", () => {
  it("returns {user} when a session exists", async () => {
    delete process.env.ADMIN_EMAIL;
    const user = { email: "anyone@example.com" };
    mocks.getUser.mockResolvedValue({ data: { user } });

    const result = await requireAdmin();
    expect("user" in result && result.user).toEqual(user);
  });

  it("returns a 401 {error} when there is no session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const result = await requireAdmin();
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(401);
      expect(await result.error.json()).toEqual({ error: "Unauthorized" });
    }
  });
});

describe("requireAdminSecret", () => {
  it("fails closed (503) when ADMIN_API_SECRET is unset", () => {
    delete process.env.ADMIN_API_SECRET;
    const req = new NextRequest("http://localhost/api/stats?secret=anything");
    const result = requireAdminSecret(req);
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(503);
  });

  it("returns 401 when ?secret= is missing", () => {
    process.env.ADMIN_API_SECRET = "correct-secret";
    const req = new NextRequest("http://localhost/api/stats");
    const result = requireAdminSecret(req);
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(401);
  });

  it("returns 401 for a wrong secret", () => {
    process.env.ADMIN_API_SECRET = "correct-secret";
    const req = new NextRequest("http://localhost/api/stats?secret=wrong-secret");
    const result = requireAdminSecret(req);
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(401);
  });

  it("returns 401 for a secret of a different length (exercises the length short-circuit before timingSafeEqual)", () => {
    process.env.ADMIN_API_SECRET = "correct-secret";
    const req = new NextRequest("http://localhost/api/stats?secret=short");
    const result = requireAdminSecret(req);
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(401);
  });

  it("returns {ok: true} for the correct secret", () => {
    process.env.ADMIN_API_SECRET = "correct-secret";
    const req = new NextRequest("http://localhost/api/stats?secret=correct-secret");
    const result = requireAdminSecret(req);
    expect(result).toEqual({ ok: true });
  });
});
