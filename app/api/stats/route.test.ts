import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "@/tests/support/fake-supabase-server";
import { makeApp, makeBlob } from "@/tests/support/fixtures";
import { makeRequest } from "@/tests/support/next-request";

const mocks = vi.hoisted(() => ({ fake: undefined as unknown as FakeSupabaseServer }));

vi.mock("@/lib/supabase-server", () => ({ supabaseServer: () => mocks.fake }));

import { GET } from "./route";

const savedEnv = { ...process.env };

beforeEach(() => {
  mocks.fake = createFakeSupabaseServer();
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("GET /api/stats", () => {
  it("returns 503 when ADMIN_API_SECRET is unset, without touching the data layer", async () => {
    delete process.env.ADMIN_API_SECRET;
    const res = await GET(makeRequest("http://localhost/api/stats"));
    expect(res.status).toBe(503);
  });

  it("returns 401 for a wrong secret", async () => {
    process.env.ADMIN_API_SECRET = "correct";
    const res = await GET(makeRequest("http://localhost/api/stats?secret=wrong"));
    expect(res.status).toBe(401);
  });

  it("returns aggregate counts for the correct secret", async () => {
    process.env.ADMIN_API_SECRET = "correct";
    mocks.fake.__state.apps.push(makeApp(), makeApp());
    const user = makeApp();
    mocks.fake.__state.apps.push(user);
    mocks.fake.__state.blobs.push(makeBlob({ app_id: user.id }));

    const res = await GET(makeRequest("http://localhost/api/stats?secret=correct"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ totalApps: 3, totalBlobs: 1 });
  });

  it("returns 500 when one of the two counts errors", async () => {
    process.env.ADMIN_API_SECRET = "correct";
    mocks.fake.__injectError("blobs", "select");

    const res = await GET(makeRequest("http://localhost/api/stats?secret=correct"));
    expect(res.status).toBe(500);
  });
});
