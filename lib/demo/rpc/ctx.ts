import { commit, getProfile, newId, table, type DemoState, type Row } from "../store";
import { readTable } from "../tables";

/** Error de negocio: la pantalla lo muestra tal cual, como hace con los de la base. */
export class DemoError extends Error {}
export const fail = (message: string): never => { throw new DemoError(message); };

export type Ctx = ReturnType<typeof makeCtx>;
export type Handler = (args: Record<string, any>, ctx: Ctx) => unknown;

export function makeCtx(s: DemoState) {
  return {
    s,
    today: s.today,
    now: () => new Date().toISOString(),
    rates: s.rates,
    profile: getProfile() ?? "OWNER",
    t: (name: string) => table(s, name),
    view: (name: string) => readTable(s, name) ?? [],
    byId: (name: string, id: unknown) => table(s, name).find(r => r.id === id) ?? null,
    where: (name: string, pred: (r: Row) => boolean) => table(s, name).filter(pred),
    insert: (name: string, row: Row) => { table(s, name).push(row); return row; },
    id: (prefix: string, entity?: Parameters<typeof newId>[2]) => newId(s, prefix, entity),
    setting: <T,>(key: string, fallback: T): T => (table(s, "app_settings").find(r => r.key === key)?.value as T) ?? fallback,
    commit,
  };
}
