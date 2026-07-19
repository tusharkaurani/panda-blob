import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedAdmin: vi.fn(),
  listFactors: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthenticatedAdmin: mocks.requireAuthenticatedAdmin }));
vi.mock("@/lib/supabase-route", () => ({
  createRouteSupabaseClient: vi.fn(async () => ({ auth: { mfa: { listFactors: mocks.listFactors } } })),
}));

import { GET } from "./route";

beforeEach(() => {
  mocks.requireAuthenticatedAdmin.mockReset();
  mocks.listFactors.mockReset();
});

describe("GET /api/auth/mfa/factors", () => {
  it("returns the auth helper's error response when unauthorized", async () => {
    const error = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ error });
    const res = await GET();
    expect(res).toBe(error);
    expect(mocks.listFactors).not.toHaveBeenCalled();
  });

  it("returns 400 with the Supabase error message when listFactors fails", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.listFactors.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await GET();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "boom" });
  });

  it("returns an empty array when there are no totp factors", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ factors: [] });
  });

  it("maps totp factors to {id, friendlyName, status}, defaulting a missing friendly_name to null", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.listFactors.mockResolvedValue({
      data: {
        totp: [
          { id: "f1", friendly_name: "My Phone", status: "verified" },
          { id: "f2", friendly_name: null, status: "unverified" },
        ],
      },
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      factors: [
        { id: "f1", friendlyName: "My Phone", status: "verified" },
        { id: "f2", friendlyName: null, status: "unverified" },
      ],
    });
  });

  it("defaults to an empty array when data.totp is undefined", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.listFactors.mockResolvedValue({ data: {}, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ factors: [] });
  });
});
