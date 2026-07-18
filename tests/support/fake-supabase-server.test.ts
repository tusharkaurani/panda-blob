import { describe, it, expect, beforeEach } from "vitest";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "./fake-supabase-server";
import { makeApp, makeBlob } from "./fixtures";

describe("fake supabase server", () => {
  let fake: FakeSupabaseServer;

  beforeEach(() => {
    fake = createFakeSupabaseServer();
  });

  it("inserts and reads back a row via maybeSingle", async () => {
    const { data, error } = await fake
      .from("apps")
      .insert({ name: "alice", access_key: "pb_abc" })
      .select("id, name, access_key")
      .single();

    expect(error).toBeNull();
    expect(data.name).toBe("alice");

    const { data: found } = await fake
      .from("apps")
      .select("id, name")
      .eq("id", data.id)
      .maybeSingle();
    expect(found.name).toBe("alice");
  });

  it("computes count from the full filtered set, before range slicing", async () => {
    const user = makeApp();
    fake.__state.apps.push(user);
    for (let i = 0; i < 25; i++) {
      fake.__state.blobs.push(makeBlob({ app_id: user.id }));
    }

    const { data, count } = await fake
      .from("blobs")
      .select("id", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, 9);

    expect(count).toBe(25);
    expect(data).toHaveLength(10);
  });

  it("resolves the apps(name, access_key) embed on blobs", async () => {
    const user = makeApp({ name: "bob" });
    fake.__state.apps.push(user);
    fake.__state.blobs.push(makeBlob({ app_id: user.id }));

    const { data } = await fake
      .from("blobs")
      .select("id, app_id, apps(name, access_key)")
      .eq("app_id", user.id)
      .maybeSingle();

    expect(data.apps).toEqual({ name: "bob", access_key: user.access_key });
  });

  it("resolves the blobs(count) aggregate embed on apps, including zero", async () => {
    const withBlobs = makeApp();
    const withoutBlobs = makeApp();
    fake.__state.apps.push(withBlobs, withoutBlobs);
    fake.__state.blobs.push(makeBlob({ app_id: withBlobs.id }), makeBlob({ app_id: withBlobs.id }));

    const { data } = await fake.from("apps").select("id, blobs(count)").order("created_at", {
      ascending: true,
    });

    const rows = data as any[];
    expect(rows.find((r) => r.id === withBlobs.id).blobs).toEqual([{ count: 2 }]);
    expect(rows.find((r) => r.id === withoutBlobs.id).blobs).toEqual([{ count: 0 }]);
  });

  it("filters by embedded resource via dot-notation ilike (!inner search)", async () => {
    const match = makeApp({ name: "project-foo" });
    const noMatch = makeApp({ name: "something-else" });
    fake.__state.apps.push(match, noMatch);
    fake.__state.blobs.push(makeBlob({ app_id: match.id }), makeBlob({ app_id: noMatch.id }));

    const { data, count } = await fake
      .from("blobs")
      .select("id, app_id, apps!inner(name)", { count: "exact" })
      .ilike("apps.name", "%foo%");

    const rows = data as any[];
    expect(count).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].app_id).toBe(match.id);
  });

  it("rejects blob insert with a nonexistent app_id (FK violation)", async () => {
    const { data, error } = await fake
      .from("blobs")
      .insert({ app_id: "00000000-0000-0000-0000-000000000000", data: {} })
      .select("id")
      .single();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("cascade-deletes blobs when their owner is deleted", async () => {
    const user = makeApp();
    fake.__state.apps.push(user);
    fake.__state.blobs.push(makeBlob({ app_id: user.id }), makeBlob({ app_id: user.id }));

    const { count } = await fake.from("apps").delete({ count: "exact" }).eq("id", user.id);

    expect(count).toBe(1);
    expect(fake.__state.blobs).toHaveLength(0);
  });

  it("delete returns count: 0 (not null) when nothing matches", async () => {
    const { count, error } = await fake
      .from("blobs")
      .delete({ count: "exact" })
      .eq("id", "00000000-0000-0000-0000-000000000000");

    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it("supports one-shot error injection, then reverts to normal", async () => {
    fake.__injectError("blobs", "select");

    const first = await fake.from("blobs").select("id");
    expect(first.error).not.toBeNull();

    const second = await fake.from("blobs").select("id");
    expect(second.error).toBeNull();
  });

  it("head:true returns null data but a real count", async () => {
    fake.__state.apps.push(makeApp(), makeApp());

    const { data, count, error } = await fake
      .from("apps")
      .select("*", { count: "exact", head: true });

    expect(error).toBeNull();
    expect(data).toBeNull();
    expect(count).toBe(2);
  });
});
