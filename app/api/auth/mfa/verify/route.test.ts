import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedAdmin: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthenticatedAdmin: mocks.requireAuthenticatedAdmin }));
vi.mock("@/lib/supabase-route", () => ({
  createRouteSupabaseClient: vi.fn(async () => ({ auth: { mfa: { verify: mocks.verify } } })),
}));

import { POST } from "./route";

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/auth/mfa/verify", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.requireAuthenticatedAdmin.mockReset();
  mocks.verify.mockReset();
});

describe("POST /api/auth/mfa/verify", () => {
  it("returns 400 for an invalid JSON body", async () => {
    const res = await POST(new NextRequest("http://localhost/api/auth/mfa/verify", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it.each([
    [{}],
    [{ factorId: "f1" }],
    [{ factorId: "f1", challengeId: "c1" }],
    [{ challengeId: "c1", code: "123456" }],
  ])("returns 400 when required fields are missing (%o)", async (body) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "factorId, challengeId, and code are required" });
    expect(mocks.requireAuthenticatedAdmin).not.toHaveBeenCalled();
  });

  it("returns the auth helper's error response when unauthorized", async () => {
    const error = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ error });
    const res = await POST(req({ factorId: "f1", challengeId: "c1", code: "123456" }));
    expect(res).toBe(error);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("returns 400 with the Supabase error message for an invalid code", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.verify.mockResolvedValue({ data: null, error: { message: "Invalid code" } });
    const res = await POST(req({ factorId: "f1", challengeId: "c1", code: "000000" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid code" });
  });

  it("returns {success:true} on a correct code, forwarding factorId/challengeId/code", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.verify.mockResolvedValue({ data: {}, error: null });
    const res = await POST(req({ factorId: "f1", challengeId: "c1", code: "123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.verify).toHaveBeenCalledWith({ factorId: "f1", challengeId: "c1", code: "123456" });
  });
});
