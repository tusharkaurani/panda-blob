import { describe, it, expect } from "vitest";
import { isValidUUID, readJsonBody, MAX_BLOB_BODY_BYTES } from "./validation";

describe("isValidUUID", () => {
  it("accepts a valid lowercase UUID", () => {
    expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("accepts a valid uppercase UUID (case-insensitive)", () => {
    expect(isValidUUID("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });

  it("rejects a UUID missing dashes", () => {
    expect(isValidUUID("123e4567e89b12d3a456426614174000")).toBe(false);
  });

  it("rejects a string with wrong segment lengths", () => {
    expect(isValidUUID("123e456-e89b-12d3-a456-426614174000")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidUUID("")).toBe(false);
  });

  it("rejects a same-length non-UUID string", () => {
    expect(isValidUUID("not-a-uuid-but-same-length-xxxxx")).toBe(false);
  });
});

describe("readJsonBody", () => {
  it("parses a valid JSON body", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    const result = await readJsonBody(req);
    expect(result).toEqual({ data: { a: 1 } });
  });

  it("returns invalid_json for malformed JSON", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "{not json" });
    const result = await readJsonBody(req);
    expect(result).toEqual({ error: "invalid_json" });
  });

  it("returns invalid_json for an empty body", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "" });
    const result = await readJsonBody(req);
    expect(result).toEqual({ error: "invalid_json" });
  });

  it("accepts a body exactly at the byte cap", async () => {
    // `"x"` wrapped in a JSON string literal of exactly maxBytes total length.
    const maxBytes = 20;
    const padding = "a".repeat(maxBytes - 2); // 2 quote chars
    const body = `"${padding}"`;
    expect(new TextEncoder().encode(body).length).toBe(maxBytes);
    const req = new Request("http://localhost/x", { method: "POST", body });
    const result = await readJsonBody(req, maxBytes);
    expect(result).toEqual({ data: padding });
  });

  it("rejects a body one byte over the cap", async () => {
    const maxBytes = 20;
    const padding = "a".repeat(maxBytes - 1);
    const body = `"${padding}"`; // one byte over maxBytes
    expect(new TextEncoder().encode(body).length).toBe(maxBytes + 1);
    const req = new Request("http://localhost/x", { method: "POST", body });
    const result = await readJsonBody(req, maxBytes);
    expect(result).toEqual({ error: "too_large" });
  });

  it("respects the default MAX_BLOB_BODY_BYTES when no override is given", async () => {
    const body = JSON.stringify({ big: "x".repeat(MAX_BLOB_BODY_BYTES) });
    const req = new Request("http://localhost/x", { method: "POST", body });
    const result = await readJsonBody(req);
    expect(result).toEqual({ error: "too_large" });
  });
});
