import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedAdmin: vi.fn(),
  unenroll: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthenticatedAdmin: mocks.requireAuthenticatedAdmin }));
vi.mock("@/lib/supabase-route", () => ({
  createRouteSupabaseClient: vi.fn(async () => ({ auth: { mfa: { unenroll: mocks.unenroll } } })),
}));

import { POST } from "./route";

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/auth/mfa/unenroll", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.requireAuthenticatedAdmin.mockReset();
  mocks.unenroll.mockReset();
});

describe("POST /api/auth/mfa/unenroll", () => {
  it("returns 400 for an invalid JSON body", async () => {
    const res = await POST(new NextRequest("http://localhost/api/auth/mfa/unenroll", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 when factorId is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "factorId is required" });
    expect(mocks.requireAuthenticatedAdmin).not.toHaveBeenCalled();
  });

  it("returns the auth helper's error response when unauthorized", async () => {
    const error = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ error });
    const res = await POST(req({ factorId: "factor-1" }));
    expect(res).toBe(error);
    expect(mocks.unenroll).not.toHaveBeenCalled();
  });

  it("returns 400 with the Supabase error message when unenroll fails", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.unenroll.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(req({ factorId: "factor-1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "boom" });
  });

  it("returns {success:true} on success, forwarding factorId", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.unenroll.mockResolvedValue({ data: {}, error: null });
    const res = await POST(req({ factorId: "factor-1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "factor-1" });
  });
});
