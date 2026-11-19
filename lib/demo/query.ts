// Motor de consultas de la muestra: el subconjunto de la interfaz de supabase-js
// (.from().select().eq()…) que usan las pantallas, sobre las tablas en memoria.
import { commit, getState, newId, notifyUnavailable, type DemoState, type Row } from "./store";
import { readTable, isWritable } from "./tables";

type Filter = (row: Row) => boolean;
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number | null; status?: number };

const UNAVAILABLE = { message: "Esta función está en la versión completa de Lubricenter OS.", code: "DEMO_NO_DISPONIBLE" };

const singular = (t: string) => t.replace(/ies$/, "y").replace(/s$/, "");

function get(row: Row, path: string): unknown {
  if (!path.includes("->")) return row[path];
  const [col, ...rest] = path.split(/->>?/);
  return rest.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Row)[k] : undefined), row[col]);
}

function like(pattern: string, insensitive: boolean) {
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*");
  return new RegExp(`^${esc}$`, insensitive ? "is" : "s");
}

function parseValue(v: string): unknown {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

function cmp(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a), nb = Number(b);
  if (typeof a !== "string" || typeof b !== "string") { if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb; }
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
const eq = (a: unknown, b: unknown) => a === b || (a != null && b != null && String(a) === String(b));

function opFilter(col: string, op: string, value: unknown): Filter {
  switch (op) {
    case "eq": return r => eq(get(r, col), value);
    case "neq": return r => !eq(get(r, col), value);
    case "gt": return r => get(r, col) != null && cmp(get(r, col), value) > 0;
    case "gte": return r => get(r, col) != null && cmp(get(r, col), value) >= 0;
    case "lt": return r => get(r, col) != null && cmp(get(r, col), value) < 0;
    case "lte": return r => get(r, col) != null && cmp(get(r, col), value) <= 0;
    case "is": return r => (value === null ? get(r, col) == null : get(r, col) === value);
    case "like": return r => like(String(value), false).test(String(get(r, col) ?? ""));
    case "ilike": return r => like(String(value), true).test(String(get(r, col) ?? ""));
    case "in": {
      const list = Array.isArray(value) ? value : String(value).replace(/^\(|\)$/g, "").split(",").map(s => s.trim().replace(/^"|"$/g, ""));
      return r => list.some(v => eq(get(r, col), v));
    }
    case "cs": case "contains": return r => {
      const v = get(r, col);
      if (Array.isArray(v)) { const want = Array.isArray(value) ? value : [value]; return want.every(w => v.some(x => eq(x, w))); }
      if (v && typeof v === "object" && value && typeof value === "object") return Object.entries(value as Row).every(([k, x]) => eq((v as Row)[k], x));
      return false;
    };
    default: throw new Error(`Operador no soportado en la muestra: ${op}`);
  }
}

function splitTop(s: string) {
  const out: string[] = []; let depth = 0, cur = "";
  for (const c of s) { if (c === "(") depth++; if (c === ")") depth--; if (c === "," && depth === 0) { out.push(cur); cur = ""; } else cur += c; }
  if (cur) out.push(cur);
  return out;
}

function parseOr(expr: string): Filter {
  const parts = splitTop(expr).map(p => p.trim()).filter(Boolean).map(part => {
    const and = part.match(/^and\((.*)\)$/);
    if (and) { const fs = splitTop(and[1]).map(x => parseCond(x.trim())); return (r: Row) => fs.every(f => f(r)); }
    return parseCond(part);
  });
  return r => parts.some(f => f(r));
}
function parseCond(part: string): Filter {
  const m = part.match(/^([^.]+)\.(not\.)?([a-z]+)\.(.*)$/s);
  if (!m) return () => false;
  const f = opFilter(m[1], m[3], m[3] === "in" ? m[4] : parseValue(m[4]));
  return m[2] ? r => !f(r) : f;
}

// ── select con relaciones: "a,b,alias:tabla!fk(cols),tabla!inner(cols)" ─────────
type Sel = { all: boolean; cols: { name: string; alias: string }[]; embeds: { alias: string; table: string; hint?: string; inner: boolean; sel: Sel }[] };
function parseSelect(s: string): Sel {
  const sel: Sel = { all: false, cols: [], embeds: [] };
  for (const raw of splitTop(s.replace(/\s+/g, ""))) {
    if (!raw) continue;
    if (raw === "*") { sel.all = true; continue; }
    const m = raw.match(/^(?:([a-zA-Z0-9_]+):)?([a-zA-Z0-9_]+)(?:!([a-zA-Z0-9_]+))?\((.*)\)$/);
    if (m) { sel.embeds.push({ alias: m[1] ?? m[2], table: m[2], hint: m[3] === "inner" ? undefined : m[3], inner: m[3] === "inner", sel: parseSelect(m[4]) }); continue; }
    const c = raw.match(/^(?:([a-zA-Z0-9_]+):)?([a-zA-Z0-9_>-]+?)(?:::[a-z]+)?$/);
    if (c) sel.cols.push({ alias: c[1] ?? c[2].split(/->>?/).pop()!, name: c[2] });
  }
  return sel;
}

function project(s: DemoState, parent: string, row: Row, sel: Sel): Row | null {
  const out: Row = sel.all ? { ...row } : {};
  for (const c of sel.cols) out[c.alias] = get(row, c.name);
  for (const e of sel.embeds) {
    const rows = readTable(s, e.table) ?? [];
    const fkFromHint = e.hint?.match(/^[a-z_]+?_([a-z_]+_id)_fkey$/)?.[1];
    const fk = fkFromHint && fkFromHint in row ? fkFromHint : `${singular(e.table)}_id`;
    let value: unknown;
    if (fk in row) {
      const target = rows.find(r => eq(r.id, row[fk]));
      value = target ? project(s, e.table, target, e.sel) : null;
    } else {
      const back = fkFromHint ?? `${singular(parent)}_id`;
      value = rows.filter(r => eq(r[back], row.id)).map(r => project(s, e.table, r, e.sel));
    }
    if (e.inner && (value == null || (Array.isArray(value) && value.length === 0))) return null;
    out[e.alias] = value;
  }
  return out;
}

type Order = { col: string; asc: boolean; nullsFirst?: boolean; foreign?: string };

export class DemoQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private lim?: number; private from_?: number; private to_?: number;
  private sel = "*"; private countMode = false; private head = false; private mode: "many" | "single" | "maybe" = "many";
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null; private returning = false; private onConflict?: string;

  constructor(private name: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) { this.sel = cols; if (this.op !== "select") this.returning = true; this.countMode = !!opts?.count; this.head = !!opts?.head; return this; }
  insert(values: Row | Row[]) { this.op = "insert"; this.payload = values; return this; }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) { this.op = "upsert"; this.payload = values; this.onConflict = opts?.onConflict; return this; }
  update(values: Row) { this.op = "update"; this.payload = values; return this; }
  delete() { this.op = "delete"; return this; }

  eq(c: string, v: unknown) { this.filters.push(opFilter(c, "eq", v)); return this; }
  neq(c: string, v: unknown) { this.filters.push(opFilter(c, "neq", v)); return this; }
  gt(c: string, v: unknown) { this.filters.push(opFilter(c, "gt", v)); return this; }
  gte(c: string, v: unknown) { this.filters.push(opFilter(c, "gte", v)); return this; }
  lt(c: string, v: unknown) { this.filters.push(opFilter(c, "lt", v)); return this; }
  lte(c: string, v: unknown) { this.filters.push(opFilter(c, "lte", v)); return this; }
  is(c: string, v: unknown) { this.filters.push(opFilter(c, "is", v)); return this; }
  like(c: string, v: string) { this.filters.push(opFilter(c, "like", v)); return this; }
  ilike(c: string, v: string) { this.filters.push(opFilter(c, "ilike", v)); return this; }
  in(c: string, v: unknown[]) { this.filters.push(opFilter(c, "in", v)); return this; }
  contains(c: string, v: unknown) { this.filters.push(opFilter(c, "cs", v)); return this; }
  match(obj: Row) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
  not(c: string, op: string, v: unknown) { const f = opFilter(c, op, v); this.filters.push(r => !f(r)); return this; }
  filter(c: string, op: string, v: unknown) { this.filters.push(opFilter(c, op, v)); return this; }
  or(expr: string) { this.filters.push(parseOr(expr)); return this; }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string; referencedTable?: string }) { this.orders.push({ col, asc: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst, foreign: opts?.foreignTable ?? opts?.referencedTable }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(from: number, to: number) { this.from_ = from; this.to_ = to; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  abortSignal() { return this; }
  returns() { return this; }
  throwOnError() { return this; }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.run().then(ok, fail);
  }

  private async run(): Promise<Result> {
    try {
      const s = await getState();
      if (this.op !== "select" && !isWritable(this.name)) { notifyUnavailable(this.name); return { data: null, error: UNAVAILABLE }; }
      let rows: Row[];
      if (this.op === "insert" || this.op === "upsert") rows = this.write(s);
      else {
        const source = readTable(s, this.name);
        if (!source) { notifyUnavailable(this.name); return { data: null, error: UNAVAILABLE }; }
        rows = source.filter(r => this.filters.every(f => f(r)));
        if (this.op === "update") { for (const r of rows) Object.assign(r, this.payload); commit(); }
        if (this.op === "delete") { const del = new Set(rows); s.tables[this.name] = source.filter(r => !del.has(r)); commit(); }
        if (this.op !== "select" && !this.returning) return { data: null, error: null, count: null, status: 204 };
      }
      const total = rows.length;
      rows = [...rows];
      for (const o of [...this.orders].filter(o => !o.foreign).reverse()) rows.sort((a, b) => {
        const va = get(a, o.col), vb = get(b, o.col);
        if (va == null || vb == null) { if (va == null && vb == null) return 0; const nullFirst = o.nullsFirst ?? !o.asc; return (va == null ? -1 : 1) * (nullFirst ? 1 : -1); }
        return (o.asc ? 1 : -1) * cmp(va, vb);
      });
      if (this.from_ != null) rows = rows.slice(this.from_, (this.to_ ?? rows.length) + 1);
      if (this.lim != null) rows = rows.slice(0, this.lim);
      const sel = parseSelect(this.sel);
      let data: unknown = rows.map(r => project(s, this.name, r, sel)).filter(Boolean);
      for (const o of this.orders.filter(o => o.foreign)) for (const r of data as Row[]) {
        const arr = r[o.foreign!]; if (Array.isArray(arr)) arr.sort((a, b) => (o.asc ? 1 : -1) * cmp((a as Row)[o.col], (b as Row)[o.col]));
      }
      const list = data as Row[];
      if (this.head) data = null;
      else if (this.mode === "single") {
        if (list.length !== 1) return { data: null, error: { message: list.length ? "Se encontró más de un registro." : "No se encontró el registro.", code: "PGRST116" } };
        data = list[0];
      } else if (this.mode === "maybe") data = list[0] ?? null;
      return { data, error: null, count: this.countMode ? total : null, status: 200 };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : "Error en la muestra" } };
    }
  }

  private write(s: DemoState): Row[] {
    const list = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    const tableRows = (s.tables[this.name] ??= []);
    const now = new Date().toISOString();
    const out: Row[] = [];
    for (const v of list) {
      if (this.op === "upsert") {
        const keys = (this.onConflict ?? "id").split(",");
        const hit = tableRows.find(r => keys.every(k => eq(r[k], v[k])));
        if (hit) { Object.assign(hit, v, "updated_at" in hit ? { updated_at: now } : {}); out.push(hit); continue; }
      }
      const row: Row = { id: newId(s, this.name.slice(0, 4)), created_at: now, ...v };
      tableRows.push(row);
      out.push(row);
    }
    commit();
    return out;
  }
}
