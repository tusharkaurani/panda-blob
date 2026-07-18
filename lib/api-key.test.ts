import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "@/tests/support/fake-supabase-server";
import { makeApp } from "@/tests/support/fixtures";
import { generateAccessKey, lookupAppByKey } from "./api-key";

const mocks = vi.hoisted(() => ({ fake: undefined as unknown as FakeSupabaseServer }));

vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: () => mocks.fake,
}));

describe("generateAccessKey", () => {
  it("returns a pb_-prefixed key of plausible length", () => {
    const key = generateAccessKey();
    expect(key).toMatch(/^pb_/);
    expect(key.length).toBeGreaterThan(20);
  });

  it("generates distinct keys on each call", () => {
    expect(generateAccessKey()).not.toBe(generateAccessKey());
  });
});

describe("lookupAppByKey", () => {
  beforeEach(() => {
    mocks.fake = createFakeSupabaseServer();
  });

  it("returns the user for a valid, active key", async () => {
    const user = makeApp({ access_key: "pb_active", is_active: true });
    mocks.fake.__state.apps.push(user);

    const result = await lookupAppByKey("pb_active");
    expect(result).toEqual({ id: user.id, name: user.name, is_active: true });
  });

  it("returns null for an inactive user's key", async () => {
    mocks.fake.__state.apps.push(makeApp({ access_key: "pb_disabled", is_active: false }));

    const result = await lookupAppByKey("pb_disabled");
    expect(result).toBeNull();
  });

  it("returns null for a key that doesn't exist", async () => {
    const result = await lookupAppByKey("pb_nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when the data layer errors", async () => {
    mocks.fake.__injectError("apps", "select");
    const result = await lookupAppByKey("pb_whatever");
    expect(result).toBeNull();
  });
});
