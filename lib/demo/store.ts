// Estado de la muestra: la semilla se carga en memoria al entrar y lo que la persona
// hace se guarda en su navegador (clave lc-demo:v1). En modo prototipo nada se guarda.
import { materialize, todayInCaracas, dayShift, type Seed } from "./seed/materialize";
import { RESERVE_SIZE, reserveId, type DemoEntity } from "./static-ids";

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;
export type DemoState = { version: number; anchor: string; today: string; rates: { bcv: number; operative: number }; tables: Tables; counters: Record<string, number> };

const STORAGE_KEY = "lc-demo:v1";
const MODE_KEY = "lc-demo:modo";
const PROFILE_KEY = "lc-demo:perfil";
export const DEMO_EVENT_UNAVAILABLE = "lc-demo:no-disponible";
export const DEMO_EVENT_CHANGED = "lc-demo:cambio";

export type DemoMode = "muestra" | "prototipo";
export type DemoProfile = "OWNER" | "ADMIN" | "RECEPTION" | "MECHANIC";

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
const ls = () => (typeof window === "undefined" ? null : safe(() => window.localStorage, null));

export function getMode(): DemoMode {
  if (typeof window !== "undefined") {
    const fromUrl = new URLSearchParams(window.location.search).get("modo");
    if (fromUrl === "prototipo" || fromUrl === "muestra") { safe(() => ls()?.setItem(MODE_KEY, fromUrl), undefined); return fromUrl; }
  }
  return safe(() => (ls()?.getItem(MODE_KEY) as DemoMode | null), null) ?? "muestra";
}
export function setMode(mode: DemoMode) {
  safe(() => ls()?.setItem(MODE_KEY, mode), undefined);
  // Al cambiar de modo se vuelve a cargar: el prototipo arranca siempre de la semilla.
  state = null; loading = null;
  emitChange();
}

export function getProfile(): DemoProfile | null {
  return safe(() => (ls()?.getItem(PROFILE_KEY) as DemoProfile | null), null);
}
export function setProfile(profile: DemoProfile | null) {
  safe(() => (profile ? ls()?.setItem(PROFILE_KEY, profile) : ls()?.removeItem(PROFILE_KEY)), undefined);
  emitChange();
}

let state: DemoState | null = null;
let loading: Promise<DemoState> | null = null;

async function fresh(today: string): Promise<DemoState> {
  const seed = (await import("./seed/seed.json")).default as unknown as Seed;
  const m = materialize(seed, today);
  return { version: seed.version, anchor: seed.anchor, today, rates: seed.rates, tables: m.tables as Tables, counters: {} };
}

/** Si lo guardado es de otro día, se corren sus fechas para que siga pareciendo de hoy. */
function shiftSaved(saved: DemoState, today: string): DemoState {
  if (saved.today === today) return saved;
  const ms = dayShift(saved.today, today) * 86400000;
  const DATE = /^\d{4}-\d{2}-\d{2}$/, STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  const walk = (v: unknown): unknown => typeof v === "string"
    ? (STAMP.test(v) ? new Date(Date.parse(v) + ms).toISOString() : DATE.test(v) ? new Date(Date.parse(`${v}T12:00:00Z`) + ms).toISOString().slice(0, 10) : v)
    : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;
  return { ...saved, today, tables: walk(saved.tables) as Tables };
}

export function getState(): Promise<DemoState> {
  if (state) return Promise.resolve(state);
  if (loading) return loading;
  loading = (async () => {
    const today = todayInCaracas();
    const seedVersion = (await import("./seed/seed.json")).default.version as number;
    let next: DemoState | null = null;
    if (getMode() === "muestra") {
      const raw = safe(() => ls()?.getItem(STORAGE_KEY) ?? null, null);
      const saved = raw ? safe(() => JSON.parse(raw) as DemoState, null) : null;
      if (saved && saved.version === seedVersion && saved.tables) next = shiftSaved(saved, today);
    }
    state = next ?? await fresh(today);
    return state;
  })();
  return loading;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Guarda en el navegador (solo en modo muestra) y avisa a las pantallas. */
export function commit() {
  emitChange();
  if (getMode() !== "muestra" || !state) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { const s = state; if (s) safe(() => ls()?.setItem(STORAGE_KEY, JSON.stringify(s)), undefined); }, 150);
}

/** «Reiniciar la muestra»: borra lo guardado y vuelve a la semilla. */
export function resetDemo() {
  safe(() => ls()?.removeItem(STORAGE_KEY), undefined);
  state = null; loading = null;
  emitChange();
}

function emitChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEMO_EVENT_CHANGED));
}

export function notifyUnavailable(what: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(DEMO_EVENT_UNAVAILABLE, { detail: what }));
}

/** ID nuevo. Para lo que tiene página propia se toma de la reserva pregenerada. */
export function newId(s: DemoState, prefix: string, entity?: DemoEntity) {
  if (entity) {
    const used = new Set((s.tables[entityTable(entity)] ?? []).map(r => r.id));
    for (let i = 1; i <= RESERVE_SIZE[entity]; i++) { const id = reserveId(entity, i); if (!used.has(id)) return id; }
  }
  s.counters[prefix] = (s.counters[prefix] ?? 0) + 1;
  return `${prefix}-x${String(s.counters[prefix]).padStart(4, "0")}`;
}
const entityTable = (e: DemoEntity) => ({ orders: "orders", customers: "customers", vehicles: "vehicles", purchases: "supplier_invoices", suppliers: "suppliers", "service-history": "service_records" })[e];

export const table = (s: DemoState, name: string) => (s.tables[name] ??= []);
