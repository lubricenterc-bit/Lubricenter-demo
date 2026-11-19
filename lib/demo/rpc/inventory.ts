// Inventario y Catálogo: una sola fuente; ajustes de existencia siempre con motivo.
import { r2 } from "../domain/order-engine";
import { stockMap } from "../domain/inventory";
import { fail, type Ctx, type Handler } from "./ctx";

function fullRow(c: Ctx, i: Record<string, any>, stock: Map<string, number>) {
  const moves = c.t("inventory_movements").filter(m => m.inventory_item_id === i.id);
  const ref = i.price_ref as number | null;
  return { id: i.id, sku: i.sku, display_name: i.display_name, description: i.description, brand: i.brand, category: i.category, unit: i.unit, quantity_on_hand: stock.get(i.id) ?? 0,
    movement_count: moves.length, last_movement_at: moves.map(m => String(m.occurred_at)).sort().at(-1) ?? null, last_counted_at: i.last_counted_at, price_usd: i.price_usd,
    current_price_ves: ref == null ? null : r2(ref * c.rates.bcv), current_ref_bcv: ref, price_updated_at: i.price_updated_at, average_cost_ref: i.average_cost_ref, last_purchase_cost_ref: i.last_purchase_cost_ref,
    last_purchased_at: i.last_purchased_at, source_cost_ref: i.source_cost_ref, cost_missing: i.average_cost_ref == null, needs_review: !!i.needs_review, active: i.active !== false, in_catalog: i.in_catalog !== false,
    merged_into: null, merged_into_sku: null, alt_codes: i.alt_codes ?? [], image_url: i.image_url ?? null, product_id: null, updated_at: i.updated_at };
}
const setPrice = (c: Ctx, i: Record<string, any>, usd: number | null) => {
  i.price_usd = usd; i.price_ref = usd == null ? null : r2(usd * c.rates.operative / c.rates.bcv); i.price_updated_at = c.now(); i.updated_at = c.now();
  i.source_price_status = usd == null ? "SIN_PRECIO" : "OK";
};

export const inventory: Record<string, Handler> = {
  get_inventory_full: (_a, c) => { const stock = stockMap(c.s); return c.t("inventory_items").map(i => fullRow(c, i, stock)); },
  get_catalog_view: (_a, c) => c.view("inventory_current").filter(i => i.in_catalog !== false && i.active !== false).map(i => ({ id: i.id, sku: i.sku, name: i.display_name ?? i.description, brand: i.brand, category: i.category, unit: i.unit,
    quantity_on_hand: i.quantity_on_hand, price_usd: i.price_usd, current_price_ves: i.current_price_ves, current_ref_bcv: i.current_ref_bcv, image_url: null, price_updated_at: i.price_updated_at })),
  get_catalog_snapshot: (_a, c) => c.view("inventory_current").filter(i => i.current_ref_bcv != null).map(i => ({ id: i.id, name: i.display_name ?? i.description, category: i.category, available: Number(i.quantity_on_hand) > 0, active: true,
    cash_usd_base_price: i.cash_usd_base_price, current_price_ves: i.current_price_ves, current_ref_bcv: i.current_ref_bcv, image_url: null, catalog_source: "OS", catalog_synced_at: c.now() })),

  inventory_save_item_full: (a, c) => {
    if (!String(a.p_sku ?? "").trim()) fail("Escribe el código del artículo.");
    if (!String(a.p_description ?? "").trim()) fail("Escribe la descripción.");
    const dup = c.t("inventory_items").find(i => String(i.sku).toUpperCase() === String(a.p_sku).toUpperCase() && i.id !== a.p_id);
    if (dup) fail(`El código ${a.p_sku} ya existe.`);
    let i = a.p_id ? c.byId("inventory_items", a.p_id) : null;
    if (a.p_id && !i) fail("Artículo no encontrado.");
    if (!i) i = c.insert("inventory_items", { id: c.id("itm"), created_at: c.now(), source_name: "MUESTRA", alt_codes: [], in_catalog: true, active: true });
    Object.assign(i!, { sku: String(a.p_sku).toUpperCase(), display_name: a.p_display_name || null, description: a.p_description, brand: a.p_brand || null, category: a.p_category || "Otros", unit: a.p_unit || "UND",
      image_url: null, alt_codes: a.p_alt_codes ?? [], active: a.p_active !== false, needs_review: !!a.p_needs_review, in_catalog: !!a.p_in_catalog });
    if (a.p_cost_ref != null) { i!.average_cost_ref = Number(a.p_cost_ref); i!.cost_missing = false; }
    setPrice(c, i!, a.p_price_usd == null ? null : Number(a.p_price_usd));
    c.commit(); return { id: i!.id, updated_at: i!.updated_at };
  },
  inventory_set_count_at_location: (a, c) => {
    const note = String(a.p_note ?? "").trim(); if (!note) fail("Escribe el motivo del cambio de existencia.");
    const now = stockMap(c.s).get(a.p_inventory_item_id) ?? 0;
    if (a.p_expected_quantity != null && Number(a.p_expected_quantity) !== now) fail("La existencia cambió mientras editabas. Vuelve a abrir el artículo.");
    const delta = Number(a.p_new_count) - now;
    if (delta !== 0) c.insert("inventory_movements", { id: c.id("mov"), inventory_item_id: a.p_inventory_item_id, location_id: "loc-centro", quantity_delta: delta, movement_type: "ADJUSTMENT", order_item_id: null, note, occurred_at: c.now(), created_by: null, created_at: c.now(), supplier_receipt_item_id: null, reversal_of: null });
    const i = c.byId("inventory_items", a.p_inventory_item_id); if (i) i.last_counted_at = c.now();
    c.commit(); return Number(a.p_new_count);
  },
  inventory_set_price_bulk: (a, c) => { const ids: string[] = a.p_item_ids ?? []; for (const i of c.t("inventory_items").filter(i => ids.includes(i.id as string))) setPrice(c, i, Number(a.p_price_usd)); c.commit(); return ids.length; },
  inventory_set_catalog_bulk: (a, c) => { const ids: string[] = a.p_item_ids ?? []; for (const i of c.t("inventory_items").filter(i => ids.includes(i.id as string))) i.in_catalog = !!a.p_in_catalog; c.commit(); return ids.length; },
  inventory_item_history: (a, c) => {
    let qty = 0;
    const loc = c.byId("locations", "loc-centro");
    const rows = c.t("inventory_movements").filter(m => m.inventory_item_id === a.p_inventory_item_id).sort((x, y) => String(x.occurred_at).localeCompare(String(y.occurred_at)))
      .map(m => { qty += Number(m.quantity_delta);
        const sii = m.supplier_receipt_item_id ? c.byId("supplier_invoice_items", m.supplier_receipt_item_id) : null;
        const inv = sii ? c.byId("supplier_invoices", sii.supplier_invoice_id) : null;
        const oi = m.order_item_id ? c.byId("order_items", m.order_item_id) : null;
        const ord = oi ? c.byId("orders", oi.order_id) : null;
        return { id: m.id, quantity_delta: Number(m.quantity_delta), movement_type: m.movement_type, note: m.note ?? (ord ? `Venta ${ord.order_number}` : null), occurred_at: m.occurred_at, location_name: loc?.name ?? "Centro",
          unit_cost_ref: sii ? Number(sii.unit_cost_ref) : null, average_cost_before: null, average_cost_after: null, supplier_invoice_id: inv?.id ?? null, invoice_number: inv?.invoice_number ?? null, balance: qty }; });
    return rows.reverse();
  },
};
