import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ getSessionUser: vi.fn() }));

// This route intentionally uses getSessionUser directly, not requireAdmin,
// since it needs a 200 with {authenticated:false} rather than a 401.
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.getSessionUser }));

import { GET } from "./route";

beforeEach(() => {
  mocks.getSessionUser.mockReset();
});

describe("GET /api/admin/session", () => {
  it("returns 401 {authenticated:false} when there is no session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it("returns 200 {authenticated:true, email} when there is a session", async () => {
    mocks.getSessionUser.mockResolvedValue({ email: "admin@example.com" });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true, email: "admin@example.com" });
  });
});
