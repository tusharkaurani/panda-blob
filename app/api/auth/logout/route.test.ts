import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/lib/supabase-route", () => ({
  createRouteSupabaseClient: async () => ({ auth: { signOut: mocks.signOut } }),
}));

import { POST } from "./route";

beforeEach(() => {
  mocks.signOut.mockReset();
});

describe("POST /api/auth/logout", () => {
  it("signs out and returns 200 {success:true}", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
