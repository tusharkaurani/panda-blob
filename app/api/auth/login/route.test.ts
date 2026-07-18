import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/tests/support/next-request";

const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));

vi.mock("@/lib/supabase-route", () => ({
  createRouteSupabaseClient: async () => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  mocks.signInWithPassword.mockReset();
});

describe("POST /api/auth/login", () => {
  it("returns 400 for malformed JSON", async () => {
    const res = await POST(makeRequest("http://localhost/x", { method: "POST", body: "{not json" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when email or password is missing", async () => {
    const res = await POST(
      makeRequest("http://localhost/x", { method: "POST", body: { email: "a@b.com" } })
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 with the Supabase error message when sign-in fails", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const res = await POST(
      makeRequest("http://localhost/x", {
        method: "POST",
        body: { email: "a@b.com", password: "wrong" },
      })
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid login credentials" });
  });

  it("returns 200 {success:true} on successful sign-in", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    const res = await POST(
      makeRequest("http://localhost/x", {
        method: "POST",
        body: { email: "a@b.com", password: "correct" },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "correct" });
  });
});
