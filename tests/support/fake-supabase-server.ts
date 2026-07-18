// A minimal in-memory stand-in for the Supabase JS client, implementing only
// the query-builder surface the app's route handlers actually use:
//   .from(table).select(cols, opts?).eq().ilike().order().range()
//   .from(table).insert(row).select(cols).single()
//   .from(table).update(partial).eq().select(cols).maybeSingle()
//   .from(table).delete(opts?).eq()
//
// This is deliberately not a general SQL/PostgREST emulator. Column
// projection in `select(cols)` is NOT enforced (rows are returned in full;
// route handlers only ever read specific named fields, so extra fields on
// the fake's rows are harmless). What IS emulated faithfully, because route
// logic and tests depend on it:
//   - `count: "exact"` reflects the full filtered set, computed BEFORE
//     `.range()` slicing (this is the #1 way a fake could make pagination
//     tests pass while testing the wrong thing).
//   - embedded-resource shapes: `apps(name, access_key)` on `blobs`
//     attaches a single object (`row.apps = {...}`); `blobs(count)` on
//     `apps` attaches a one-element aggregate array
//     (`row.blobs = [{ count: N }]`), matching what the routes destructure
//     (`row.apps?.name`, `row.blobs?.[0]?.count ?? 0`).
//   - `.ilike("apps.name", "%x%")` filters the outer row by its
//     *embedded* resource's column — the one dot-notation case the admin
//     blob search endpoint relies on.
//   - `app_id` foreign-key violations on `blobs` insert, so the "check
//     app_id exists" 400 branch is reachable without manual error
//     injection.
//   - cascade delete (`blobs.app_id references apps(id) on delete
//     cascade`), so deleting an app also removes its blobs from state —
//     keeps shared fixture state from accumulating orphans.

import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/database.types";

export type AppRow = Database["public"]["Tables"]["apps"]["Row"];
export type BlobRow = Database["public"]["Tables"]["blobs"]["Row"];

export interface FakeState {
  apps: AppRow[];
  blobs: BlobRow[];
}

type TableName = "apps" | "blobs";
type Verb = "select" | "insert" | "update" | "delete";
type FakeError = { message: string };

interface Filter {
  kind: "eq" | "ilike";
  col: string;
  value: unknown;
}

interface ExecResult {
  data: unknown;
  error: FakeError | null;
  count: number | null;
}

function cloneRow<T>(row: T): T {
  return { ...(row as object) } as T;
}

// Translates a PostgREST-style ILIKE pattern (`%`, `_` wildcards) to a
// case-insensitive regex. Real usage here is always `%text%` (substring
// match), but this stays faithful to the operator's actual semantics rather
// than hardcoding "contains".
function ilikeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const translated = escaped.replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${translated}$`, "is");
}

// Attaches embedded-resource sub-objects but keeps every base column intact
// (no projection yet) — filters (`.eq()`/`.ilike()`, including dot-notation
// embed filters) run against this fully-hydrated row, because real Postgrest
// lets you filter on columns you didn't select. Projection to just the
// requested columns happens separately, after filtering/ordering/range, via
// `projectRow` below.
function resolveEmbeds(table: TableName, cols: string, row: AppRow | BlobRow, state: FakeState): any {
  const hydrated: any = cloneRow(row);

  if (table === "blobs" && /apps(!inner)?\(/.test(cols)) {
    const blob = row as BlobRow;
    const app = state.apps.find((a) => a.id === blob.app_id) ?? null;
    hydrated.apps = app ? { name: app.name, access_key: app.access_key } : null;
  }

  if (table === "apps" && /blobs\(count\)/.test(cols)) {
    const app = row as AppRow;
    const count = state.blobs.filter((b) => b.app_id === app.id).length;
    hydrated.blobs = [{ count }];
  }

  return hydrated;
}

// Splits a `select()` column string on top-level commas only, respecting
// parens, so `"id, apps(name, access_key)"` splits into
// `["id", "apps(name, access_key)"]` — not four pieces.
function splitTopLevel(cols: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of cols) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

// Strips a hydrated row down to just the columns/embeds the `select(cols)`
// string actually asked for, mirroring Postgrest's real behavior of only
// returning requested columns (as opposed to filtering, which operates on
// the full row regardless of what's selected).
function projectRow(cols: string, hydratedRow: any): any {
  const tokens = splitTopLevel(cols);
  if (tokens.includes("*")) return hydratedRow;

  const result: any = {};
  for (const token of tokens) {
    if (token.includes("(")) {
      const embedTable = token.split("(")[0].replace("!inner", "").trim();
      result[embedTable] = hydratedRow[embedTable];
    } else {
      result[token] = hydratedRow[token];
    }
  }
  return result;
}

class FakeQueryBuilder implements PromiseLike<ExecResult> {
  private verb: Verb = "select";
  private insertPayload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private updatePayload: Record<string, unknown> | null = null;
  private selectCols = "*";
  private selectOpts: { count?: "exact"; head?: boolean } = {};
  private deleteOpts: { count?: "exact" } = {};
  private filters: Filter[] = [];
  private orderCol: string | null = null;
  private orderAscending = true;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;

  constructor(
    private table: TableName,
    private state: FakeState,
    private pendingErrors: Map<string, FakeError>
  ) {}

  select(cols: string, opts: { count?: "exact"; head?: boolean } = {}) {
    this.selectCols = cols;
    this.selectOpts = opts;
    return this;
  }

  insert(row: Record<string, unknown> | Record<string, unknown>[]) {
    this.verb = "insert";
    this.insertPayload = row;
    return this;
  }

  update(partial: Record<string, unknown>) {
    this.verb = "update";
    this.updatePayload = partial;
    return this;
  }

  delete(opts: { count?: "exact" } = {}) {
    this.verb = "delete";
    this.deleteOpts = opts;
    return this;
  }

  eq(col: string, value: unknown) {
    this.filters.push({ kind: "eq", col, value });
    return this;
  }

  ilike(col: string, pattern: string) {
    this.filters.push({ kind: "ilike", col, value: pattern });
    return this;
  }

  order(col: string, opts: { ascending: boolean }) {
    this.orderCol = col;
    this.orderAscending = opts.ascending;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  async single(): Promise<{ data: any; error: FakeError | null }> {
    const result = await this._execute();
    if (result.error) return { data: null, error: result.error };
    const rows = this._asRows(result.data);
    if (rows.length !== 1) {
      return { data: null, error: { message: "Expected exactly one row" } };
    }
    return { data: rows[0], error: null };
  }

  async maybeSingle(): Promise<{ data: any; error: FakeError | null }> {
    const result = await this._execute();
    if (result.error) return { data: null, error: result.error };
    const rows = this._asRows(result.data);
    if (rows.length === 0) return { data: null, error: null };
    if (rows.length > 1) return { data: null, error: { message: "Expected at most one row" } };
    return { data: rows[0], error: null };
  }

  then<TResult1 = ExecResult, TResult2 = never>(
    onFulfilled?: ((value: ExecResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this._execute().then(onFulfilled, onRejected);
  }

  private _asRows(data: unknown): any[] {
    if (Array.isArray(data)) return data;
    if (data == null) return [];
    return [data];
  }

  private _consumeInjectedError(): FakeError | null {
    const key = `${this.table}:${this.verb}`;
    const err = this.pendingErrors.get(key);
    if (err) this.pendingErrors.delete(key);
    return err ?? null;
  }

  private _matchesFilters(row: any): boolean {
    return this.filters.every((f) => {
      const [embedTable, embedCol] = f.col.includes(".") ? f.col.split(".") : [null, f.col];
      const actual = embedTable ? row[embedTable]?.[embedCol] : row[f.col];
      if (f.kind === "eq") return actual === f.value;
      if (f.kind === "ilike") {
        if (typeof actual !== "string") return false;
        return ilikeToRegExp(String(f.value)).test(actual);
      }
      return true;
    });
  }

  private async _execute(): Promise<ExecResult> {
    const injected = this._consumeInjectedError();
    if (injected) return { data: null, error: injected, count: null };

    if (this.verb === "insert") return this._executeInsert();
    if (this.verb === "update") return this._executeUpdate();
    if (this.verb === "delete") return this._executeDelete();
    return this._executeSelect();
  }

  private _executeSelect(): ExecResult {
    const table = this.state[this.table] as any[];
    const hydrated = table.map((row) => resolveEmbeds(this.table, this.selectCols, row, this.state));
    let filtered = hydrated.filter((row) => this._matchesFilters(row));

    const isInner = /!inner\(/.test(this.selectCols);
    if (isInner && this.table === "blobs") {
      filtered = filtered.filter((row) => row.apps != null);
    }

    const count = this.selectOpts.count === "exact" ? filtered.length : null;

    if (this.orderCol) {
      const col = this.orderCol;
      const dir = this.orderAscending ? 1 : -1;
      filtered = [...filtered].sort((a, b) => (a[col] > b[col] ? dir : a[col] < b[col] ? -dir : 0));
    }

    let page = filtered;
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      page = filtered.slice(this.rangeFrom, this.rangeTo + 1);
    }

    const projected = page.map((row) => projectRow(this.selectCols, row));
    return { data: this.selectOpts.head ? null : projected, error: null, count };
  }

  private _executeInsert(): ExecResult {
    const rows = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload];
    const now = new Date().toISOString();
    const created: any[] = [];

    for (const payload of rows) {
      if (this.table === "blobs") {
        const appId = (payload as any).app_id;
        const appExists = this.state.apps.some((a) => a.id === appId);
        if (!appExists) {
          return { data: null, error: { message: "foreign key violation: app_id" }, count: null };
        }
      }

      const base: any = {
        id: randomUUID(),
        created_at: now,
        updated_at: now,
        ...(this.table === "apps" ? { is_active: true } : {}),
        ...payload,
      };
      (this.state[this.table] as any[]).push(base);
      const hydrated = resolveEmbeds(this.table, this.selectCols, base, this.state);
      created.push(projectRow(this.selectCols, hydrated));
    }

    return { data: created.length === 1 ? created[0] : created, error: null, count: null };
  }

  private _executeUpdate(): ExecResult {
    const table = this.state[this.table] as any[];
    const now = new Date().toISOString();
    const updated: any[] = [];

    for (const row of table) {
      if (!this._matchesFilters(row)) continue;
      Object.assign(row, this.updatePayload, { updated_at: now });
      const hydrated = resolveEmbeds(this.table, this.selectCols, row, this.state);
      updated.push(projectRow(this.selectCols, hydrated));
    }

    return { data: updated, error: null, count: updated.length };
  }

  private _executeDelete(): ExecResult {
    const table = this.state[this.table] as any[];
    const toDelete = table.filter((row) => this._matchesFilters(row));
    const deleteIds = new Set(toDelete.map((row) => row.id));

    if (this.table === "apps") {
      this.state.apps = this.state.apps.filter((a) => !deleteIds.has(a.id));
      this.state.blobs = this.state.blobs.filter((b) => !deleteIds.has(b.app_id));
    } else {
      this.state.blobs = this.state.blobs.filter((b) => !deleteIds.has(b.id));
    }

    const count = this.deleteOpts.count === "exact" ? toDelete.length : null;
    return { data: null, error: null, count };
  }
}

export interface FakeSupabaseServer {
  from(table: TableName): FakeQueryBuilder;
  __state: FakeState;
  __injectError(table: TableName, verb: Verb, message?: string): void;
}

export function createFakeSupabaseServer(seed: Partial<FakeState> = {}): FakeSupabaseServer {
  const state: FakeState = {
    apps: (seed.apps ?? []).map(cloneRow),
    blobs: (seed.blobs ?? []).map(cloneRow),
  };
  const pendingErrors = new Map<string, FakeError>();

  return {
    from(table: TableName) {
      return new FakeQueryBuilder(table, state, pendingErrors);
    },
    __state: state,
    __injectError(table: TableName, verb: Verb, message = "simulated error") {
      pendingErrors.set(`${table}:${verb}`, { message });
    },
  };
}
