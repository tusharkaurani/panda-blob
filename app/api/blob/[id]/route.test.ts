import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseServer, type FakeSupabaseServer } from "@/tests/support/fake-supabase-server";
import { makeApiUser, makeBlob } from "@/tests/support/fixtures";
import { makeRequest, withParams } from "@/tests/support/next-request";

const mocks = vi.hoisted(() => ({
  fake: undefined as unknown as FakeSupabaseServer,
  lookupUserByKey: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({ supabaseServer: () => mocks.fake }));
vi.mock("@/lib/api-key", () => ({ lookupUserByKey: mocks.lookupUserByKey }));

import { GET, PUT, DELETE } from "./route";

const INVALID_UUID = "not-a-uuid";
const RANDOM_UUID = "00000000-0000-0000-0000-000000000000";

beforeEach(() => {
  mocks.fake = createFakeSupabaseServer();
  mocks.lookupUserByKey.mockReset();
});

function asUser(user: ReturnType<typeof makeApiUser>) {
  return { id: user.id, name: user.name, is_active: true };
}

describe("GET /api/blob/[id]", () => {
  it("returns 400 for an invalid UUID", async () => {
    const res = await GET(
      makeRequest(`http://localhost/api/blob/${INVALID_UUID}?apiKey=x`),
      withParams({ id: INVALID_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 for a missing apiKey, without touching the data layer", async () => {
    const res = await GET(makeRequest(`http://localhost/api/blob/${RANDOM_UUID}`), withParams({ id: RANDOM_UUID }));
    expect(res.status).toBe(401);
    expect(mocks.fake.__state.blobs).toHaveLength(0);
  });

  it("returns 401 for an invalid apiKey", async () => {
    mocks.lookupUserByKey.mockResolvedValue(null);
    const res = await GET(
      makeRequest(`http://localhost/api/blob/${RANDOM_UUID}?apiKey=bad`),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(401);
  });

  it("returns the blob's data when it exists and is owned by the authenticated user", async () => {
    const user = makeApiUser();
    const blob = makeBlob({ owner_id: user.id, data: { a: 1 } });
    mocks.fake.__state.api_users.push(user);
    mocks.fake.__state.blobs.push(blob);
    mocks.lookupUserByKey.mockResolvedValue(asUser(user));

    const res = await GET(
      makeRequest(`http://localhost/api/blob/${blob.id}?apiKey=pb_valid`),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ a: 1 });
  });

  it("returns 404 when the blob belongs to a different user", async () => {
    const owner = makeApiUser();
    const otherUser = makeApiUser();
    const blob = makeBlob({ owner_id: owner.id });
    mocks.fake.__state.api_users.push(owner, otherUser);
    mocks.fake.__state.blobs.push(blob);
    mocks.lookupUserByKey.mockResolvedValue(asUser(otherUser));

    const res = await GET(
      makeRequest(`http://localhost/api/blob/${blob.id}?apiKey=pb_other`),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Blob not found" });
  });

  it("returns an identical 404 when the blob doesn't exist at all (ownership-mismatch and not-found are indistinguishable by design)", async () => {
    const user = makeApiUser();
    mocks.fake.__state.api_users.push(user);
    mocks.lookupUserByKey.mockResolvedValue(asUser(user));

    const res = await GET(
      makeRequest(`http://localhost/api/blob/${RANDOM_UUID}?apiKey=pb_valid`),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Blob not found" });
  });
});

describe("PUT /api/blob/[id]", () => {
  it("returns 400 for an invalid UUID", async () => {
    const res = await PUT(
      makeRequest(`http://localhost/api/blob/${INVALID_UUID}`, { method: "PUT", body: {} }),
      withParams({ id: INVALID_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 for a missing apiKey", async () => {
    const res = await PUT(
      makeRequest(`http://localhost/api/blob/${RANDOM_UUID}`, { method: "PUT", body: {} }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for ownership mismatch", async () => {
    const owner = makeApiUser();
    const otherUser = makeApiUser();
    const blob = makeBlob({ owner_id: owner.id });
    mocks.fake.__state.api_users.push(owner, otherUser);
    mocks.fake.__state.blobs.push(blob);
    mocks.lookupUserByKey.mockResolvedValue(asUser(otherUser));

    const res = await PUT(
      makeRequest(`http://localhost/api/blob/${blob.id}?apiKey=pb_other`, { method: "PUT", body: {} }),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for malformed JSON", async () => {
    const user = makeApiUser();
    const blob = makeBlob({ owner_id: user.id });
    mocks.fake.__state.api_users.push(user);
    mocks.fake.__state.blobs.push(blob);
    mocks.lookupUserByKey.mockResolvedValue(asUser(user));

    const res = await PUT(
      makeRequest(`http://localhost/api/blob/${blob.id}?apiKey=pb_valid`, {
        method: "PUT",
        body: "{not json",
      }),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(400);
  });

  it("returns 413 for an oversized body", async () => {
    const user = makeApiUser();
    const blob = makeBlob({ owner_id: user.id });
    mocks.fake.__state.api_users.push(user);
    mocks.fake.__state.blobs.push(blob);
    mocks.lookupUserByKey.mockResolvedValue(asUser(user));

    const res = await PUT(
      makeRequest(`http://localhost/api/blob/${blob.id}?apiKey=pb_valid`, {
        method: "PUT",
        body: { big: "x".repeat(3_000_001) },
      }),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(413);
  });

  it("replaces the blob's data and returns 200 with the updated data", async () => {
    const user = makeApiUser();
    const blob = makeBlob({ owner_id: user.id, data: { old: true } });
    mocks.fake.__state.api_users.push(user);
    mocks.fake.__state.blobs.push(blob);
    mocks.lookupUserByKey.mockResolvedValue(asUser(user));

    const res = await PUT(
      makeRequest(`http://localhost/api/blob/${blob.id}?apiKey=pb_valid`, {
        method: "PUT",
        body: { updated: true },
      }),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: true });
  });

  it("returns 500 when the update itself fails after the existence check passes", async () => {
    const user = makeApiUser();
    const blob = makeBlob({ owner_id: user.id });
    mocks.fake.__state.api_users.push(user);
    mocks.fake.__state.blobs.push(blob);
    mocks.lookupUserByKey.mockResolvedValue(asUser(user));
    mocks.fake.__injectError("blobs", "update");

    const res = await PUT(
      makeRequest(`http://localhost/api/blob/${blob.id}?apiKey=pb_valid`, { method: "PUT", body: {} }),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/blob/[id]", () => {
  it("returns 400 for an invalid UUID", async () => {
    const res = await DELETE(
      makeRequest(`http://localhost/api/blob/${INVALID_UUID}`, { method: "DELETE" }),
      withParams({ id: INVALID_UUID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 for a missing apiKey", async () => {
    const res = await DELETE(
      makeRequest(`http://localhost/api/blob/${RANDOM_UUID}`, { method: "DELETE" }),
      withParams({ id: RANDOM_UUID })
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for ownership mismatch", async () => {
    const owner = makeApiUser();
    const otherUser = makeApiUser();
    const blob = makeBlob({ owner_id: owner.id });
    mocks.fake.__state.api_users.push(owner, otherUser);
    mocks.fake.__state.blobs.push(blob);
    mocks.lookupUserByKey.mockResolvedValue(asUser(otherUser));

    const res = await DELETE(
      makeRequest(`http://localhost/api/blob/${blob.id}?apiKey=pb_other`, { method: "DELETE" }),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(404);
  });

  it("deletes the blob and returns 204 with an empty body", async () => {
    const user = makeApiUser();
    const blob = makeBlob({ owner_id: user.id });
    mocks.fake.__state.api_users.push(user);
    mocks.fake.__state.blobs.push(blob);
    mocks.lookupUserByKey.mockResolvedValue(asUser(user));

    const res = await DELETE(
      makeRequest(`http://localhost/api/blob/${blob.id}?apiKey=pb_valid`, { method: "DELETE" }),
      withParams({ id: blob.id })
    );
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(mocks.fake.__state.blobs).toHaveLength(0);
  });
});
