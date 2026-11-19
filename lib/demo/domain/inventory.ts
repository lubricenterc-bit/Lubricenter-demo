import type { DemoState, Row } from "../store";

/** Existencia por artículo: suma de los movimientos. */
export function stockMap(s: DemoState) {
  const m = new Map<string, number>();
  for (const r of s.tables.inventory_movements ?? []) m.set(r.inventory_item_id as string, (m.get(r.inventory_item_id as string) ?? 0) + Number(r.quantity_delta));
  return m;
}

/** Vista inventory_current: artículo + sede + existencia + precios del día. */
export function inventoryCurrent(s: DemoState): Row[] {
  const stock = stockMap(s);
  const loc = (s.tables.locations ?? [])[0] ?? {};
  const { bcv, operative } = s.rates;
  return (s.tables.inventory_items ?? []).filter(i => i.active !== false).map(i => {
    const ref = i.price_ref as number | null;
    const qty = stock.get(i.id as string) ?? 0;
    return {
      ...i, location_id: loc.id, location_code: loc.code, location_name: loc.name, quantity_on_hand: qty, sellable_quantity: Math.max(0, qty),
      catalog_product_name: null, cash_usd_base_price: ref == null ? null : Math.round(ref * bcv / operative * 100) / 100,
      current_price_ves: ref == null ? null : Math.round(ref * bcv * 100) / 100, current_ref_bcv: ref,
      source_cost_ref: i.average_cost_ref, cost_missing: i.average_cost_ref == null,
    };
  });
}
