export function parsePagination(searchParams: URLSearchParams, defaultLimit = 10) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.max(
    1,
    parseInt(searchParams.get("limit") ?? String(defaultLimit), 10) || defaultLimit
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { page, limit, from, to };
}
