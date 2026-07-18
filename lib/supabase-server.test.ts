import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(() => ({ __fake: true })) }));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { supabaseServer } from "./supabase-server";

// These two tests are intentionally order-dependent (unlike the rest of the
// suite): supabaseServer() caches its client in a module-level singleton, so
// the second test relies on the first having already populated it — that's
// exactly the caching behavior being verified, not a mistake.
describe("supabaseServer", () => {
  it("constructs a client using NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "secret-key";

    supabaseServer();

    expect(mocks.createClient).toHaveBeenCalledWith("https://example.supabase.co", "secret-key", {
      auth: { persistSession: false },
    });
  });

  it("caches the client across calls instead of constructing a new one each time", () => {
    const first = supabaseServer();
    mocks.createClient.mockClear();

    const second = supabaseServer();

    expect(second).toBe(first);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
