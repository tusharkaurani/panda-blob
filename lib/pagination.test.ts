import { describe, it, expect } from "vitest";
import { parsePagination } from "./pagination";

describe("parsePagination", () => {
  it("defaults to page 1, limit 10 when no params are given", () => {
    const result = parsePagination(new URLSearchParams());
    expect(result).toEqual({ page: 1, limit: 10, from: 0, to: 9 });
  });

  it("computes from/to for an explicit page and limit", () => {
    const result = parsePagination(new URLSearchParams("page=3&limit=20"));
    expect(result).toEqual({ page: 3, limit: 20, from: 40, to: 59 });
  });

  it("floors page=0 to 1", () => {
    const result = parsePagination(new URLSearchParams("page=0"));
    expect(result.page).toBe(1);
  });

  it("floors a negative page to 1", () => {
    const result = parsePagination(new URLSearchParams("page=-5"));
    expect(result.page).toBe(1);
  });

  it("falls back to the default when limit=0 (falsy, caught by the `|| defaultLimit` guard before Math.max ever floors it)", () => {
    const result = parsePagination(new URLSearchParams("limit=0"));
    expect(result.limit).toBe(10);
  });

  it("floors a negative limit to 1 (Math.max path, unlike limit=0)", () => {
    const result = parsePagination(new URLSearchParams("limit=-5"));
    expect(result.limit).toBe(1);
  });

  it("falls back to defaults for a non-numeric page", () => {
    const result = parsePagination(new URLSearchParams("page=abc"));
    expect(result.page).toBe(1);
  });

  it("falls back to defaults for a non-numeric limit", () => {
    const result = parsePagination(new URLSearchParams("limit=abc"));
    expect(result.limit).toBe(10);
  });

  it("honors a custom defaultLimit when limit param is absent", () => {
    const result = parsePagination(new URLSearchParams(), 25);
    expect(result).toEqual({ page: 1, limit: 25, from: 0, to: 24 });
  });
});
