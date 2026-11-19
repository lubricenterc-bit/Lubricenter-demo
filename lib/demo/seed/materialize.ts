// Corre todas las fechas de la semilla para que su «hoy» (anchor) sea hoy en Caracas.
export type Seed = { version: number; anchor: string; rates: { bcv: number; operative: number }; tables: Record<string, Record<string, unknown>[]> };

/** Fecha de hoy en Caracas (UTC−4), como AAAA-MM-DD. */
export function todayInCaracas(now: Date = new Date()) {
  return new Date(now.getTime() - 4 * 3600000).toISOString().slice(0, 10);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function dayShift(anchor: string, today: string) {
  return Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${anchor}T12:00:00Z`)) / 86400000);
}

function shiftValue(v: unknown, ms: number): unknown {
  if (typeof v === "string") {
    if (STAMP.test(v)) return new Date(Date.parse(v) + ms).toISOString();
    if (DATE.test(v)) return new Date(Date.parse(`${v}T12:00:00Z`) + ms).toISOString().slice(0, 10);
    return v;
  }
  if (Array.isArray(v)) return v.map(x => shiftValue(x, ms));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shiftValue(x, ms)]));
  return v;
}

/** Copia profunda de las tablas con las fechas corridas. */
export function materialize(seed: Seed, today: string = todayInCaracas()) {
  const ms = dayShift(seed.anchor, today) * 86400000;
  return { ...seed, today, tables: shiftValue(seed.tables, ms) as Seed["tables"] };
}
