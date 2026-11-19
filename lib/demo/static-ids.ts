// IDs que se generan como páginas estáticas. Incluye los de la semilla y una
// reserva de IDs para lo que se cree durante la visita (el cliente de muestra
// asigna los nuevos registros desde esta reserva), así toda URL abre al recargar.
export type DemoEntity = "orders" | "customers" | "vehicles" | "purchases" | "suppliers" | "service-history";

export const RESERVE_SIZE: Record<DemoEntity, number> = {
  orders: 120, customers: 40, vehicles: 40, purchases: 20, suppliers: 10, "service-history": 40,
};

export function reserveId(entity: DemoEntity, n: number) {
  return `${entity.slice(0, 3)}-n${String(n).padStart(3, "0")}`;
}

import seed from "./seed/seed.json";

const SEED_TABLE: Record<DemoEntity, string> = {
  orders: "orders", customers: "customers", vehicles: "vehicles", purchases: "supplier_invoices", suppliers: "suppliers", "service-history": "service_records",
};

export function staticIds(entity: DemoEntity): string[] {
  const rows = (seed.tables as Record<string, { id?: unknown }[]>)[SEED_TABLE[entity]] ?? [];
  const ids: string[] = rows.map(r => String(r.id));
  for (let i = 1; i <= RESERVE_SIZE[entity]; i++) ids.push(reserveId(entity, i));
  return ids;
}
