import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedAdmin: vi.fn(),
  enroll: vi.fn(),
  listFactors: vi.fn(),
  unenroll: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthenticatedAdmin: mocks.requireAuthenticatedAdmin }));
vi.mock("@/lib/supabase-route", () => ({
  createRouteSupabaseClient: vi.fn(async () => ({
    auth: {
      mfa: { enroll: mocks.enroll, listFactors: mocks.listFactors, unenroll: mocks.unenroll },
    },
  })),
}));

import { POST } from "./route";

beforeEach(() => {
  mocks.requireAuthenticatedAdmin.mockReset();
  mocks.enroll.mockReset();
  mocks.listFactors.mockReset();
  mocks.unenroll.mockReset();
  mocks.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  mocks.unenroll.mockResolvedValue({ data: {}, error: null });
});

describe("POST /api/auth/mfa/enroll", () => {
  it("returns the auth helper's error response when unauthorized", async () => {
    const error = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ error });
    const res = await POST();
    expect(res).toBe(error);
    expect(mocks.enroll).not.toHaveBeenCalled();
  });

  it("returns 400 with the Supabase error message when enroll fails", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.enroll.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await POST();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "boom" });
  });

  it("returns the factorId, qrCode, and secret on success", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.enroll.mockResolvedValue({
      data: { id: "factor-1", totp: { qr_code: "data:image/svg+xml,...", secret: "SECRET123" } },
      error: null,
    });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      factorId: "factor-1",
      qrCode: "data:image/svg+xml,...",
      secret: "SECRET123",
    });
    expect(mocks.enroll).toHaveBeenCalledWith({ factorType: "totp" });
  });

  it("unenrolls stale unverified factors before enrolling a new one", async () => {
    mocks.requireAuthenticatedAdmin.mockResolvedValue({ user: { email: "admin@example.com" } });
    mocks.listFactors.mockResolvedValue({
      data: {
        totp: [
          { id: "stale-1", status: "unverified" },
          { id: "verified-1", status: "verified" },
        ],
      },
      error: null,
    });
    mocks.enroll.mockResolvedValue({
      data: { id: "factor-2", totp: { qr_code: "data:image/svg+xml,...", secret: "SECRET456" } },
      error: null,
    });

    const res = await POST();

    expect(mocks.unenroll).toHaveBeenCalledTimes(1);
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "stale-1" });
    expect(mocks.unenroll).not.toHaveBeenCalledWith({ factorId: "verified-1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      factorId: "factor-2",
      qrCode: "data:image/svg+xml,...",
      secret: "SECRET456",
    });
  });
});
