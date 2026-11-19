import type { DemoState, Row } from "../store";

const AREAS: Record<string, string> = { STORE: "Tienda", OIL_CHANGE: "Cambio de aceite", WORKSHOP: "Taller", ELECTROAUTO: "Electroauto" };

/** Vista workshop_board_current: órdenes abiertas con cliente y vehículo. */
export function workshopBoard(s: DemoState): Row[] {
  const customers = new Map((s.tables.customers ?? []).map(c => [c.id, c]));
  const vehicles = new Map((s.tables.vehicles ?? []).map(v => [v.id, v]));
  return (s.tables.orders ?? []).filter(o => o.status === "OPEN").map(o => {
    const c = customers.get(o.customer_id); const v = vehicles.get(o.vehicle_id);
    const items = (s.tables.order_items ?? []).filter(i => i.order_id === o.id);
    return { id: o.id, order_number: o.order_number, workflow_status: o.workflow_status, workflow_updated_at: o.workflow_updated_at, opened_at: o.opened_at, health_status: o.health_status,
      customer_id: o.customer_id, vehicle_id: o.vehicle_id, customer_name: c?.name ?? null, customer_phone: c?.phone ?? null, plate: v?.plate ?? null, make: v?.make ?? null,
      model: v?.model ?? null, year: v?.year ?? null, current_odometer: v?.current_odometer ?? null, item_count: items.length,
      current_total_ref: items.reduce((a, i) => a + Number(i.charged_ref_amount), 0), service_areas: [...new Set(items.map(i => AREAS[i.business_area as string]))].join(", "), is_walk_in: o.is_walk_in };
  });
}
