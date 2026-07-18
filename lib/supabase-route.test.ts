import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieStore: {
    getAll: vi.fn(() => [{ name: "sb-token", value: "abc" }]),
    set: vi.fn(),
  },
  createServerClientCalls: [] as any[],
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((url: string, key: string, options: any) => {
    mocks.createServerClientCalls.push({ url, key, options });
    return { __fake: true };
  }),
}));

import { createRouteSupabaseClient } from "./supabase-route";

beforeEach(() => {
  mocks.cookieStore.getAll.mockClear();
  mocks.cookieStore.set.mockClear();
  mocks.createServerClientCalls.length = 0;
});

describe("createRouteSupabaseClient", () => {
  it("reads cookies through to the Supabase client's getAll", async () => {
    await createRouteSupabaseClient();
    const { options } = mocks.createServerClientCalls[0];

    const result = options.cookies.getAll();
    expect(result).toEqual([{ name: "sb-token", value: "abc" }]);
    expect(mocks.cookieStore.getAll).toHaveBeenCalled();
  });

  it("persists new cookies via cookieStore.set on setAll (write-capable, unlike lib/auth.ts's no-op)", async () => {
    await createRouteSupabaseClient();
    const { options } = mocks.createServerClientCalls[0];

    options.cookies.setAll([{ name: "sb-token", value: "new-value", options: { path: "/" } }]);
    expect(mocks.cookieStore.set).toHaveBeenCalledWith("sb-token", "new-value", { path: "/" });
  });
});
