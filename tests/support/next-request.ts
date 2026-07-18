import { NextRequest } from "next/server";

export function makeRequest(
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const { method = "GET", body, headers } = init;
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Route handlers with a dynamic segment take a second arg shaped like this.
export function withParams<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}
