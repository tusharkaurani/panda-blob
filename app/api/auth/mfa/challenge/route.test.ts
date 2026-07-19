import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedAdmin: vi.fn(),
  challenge: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthenticatedAdmin: mocks.requireAuthenticatedAdmin }));
vi.mock("@/lib/supabase-route", () => ({
  createRouteSupabaseClient: vi.fn(async () => ({ auth: { mfa: { challenge: mocks.challenge } } })),
}));

import { POST } from "./route";

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/auth/mfa/challenge", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.requireAuthenticatedAdmin.mockReset();
  mocks.challenge.mockReset();
});

describe("POST /api/auth/mfa/challenge", () => {
  it("returns 400 for an invalid JSON body", async () => {
    const res = await POST(new NextRequest("http://localhost/api/auth/mfa/challenge", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
    expect(mocks.requireAuthenticatedAdmin).not.toHaveBeenCalled();
  });

  it("returns 400 when factorId is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "factorId is required" });
    expect(mocks.requireAuthenticatedAdmin).not.toHaveBeenCalled();
  });

  it("validates the body before checking auth", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    await POST(req({}));
    expect(mocks.requireAuthenticatedAdmin).not.toHaveBeenCalled();
  });

  it("returns the auth helper's error response when unauthorized", async () => {
    const error = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ error });
    const res = await POST(req({ factorId: "factor-1" }));
    expect(res).toBe(error);
    expect(mocks.challenge).not.toHaveBeenCalled();
  });

  it("returns 400 with the Supabase error message when challenge fails", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.challenge.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST(req({ factorId: "factor-1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "boom" });
  });

  it("returns the challengeId on success", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.challenge.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
    const res = await POST(req({ factorId: "factor-1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ challengeId: "challenge-1" });
    expect(mocks.challenge).toHaveBeenCalledWith({ factorId: "factor-1" });
  });
});
