// Cambio de aceite: aceite y filtro de la orden, regla del 85 % y próximo cambio.
import { addLine, linesOf, openOrder, recompute } from "../domain/order-engine";
import { fail, type Handler } from "./ctx";

const isOil = (d: string, cat?: unknown) => cat === "Aceite Motor" || /\b\d{1,2}\s*w\s*-?\s*\d{2}\b/i.test(d);
const isFilter = (d: string, cat?: unknown) => cat === "Filtro Aceite" || /filtro\s+(de\s+)?aceite/i.test(d);
const addMonths = (d: string, m: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };

export const oil: Record<string, Handler> = {
  order_oil_change_candidates: (a, c) => linesOf(c, a.p_order_id).filter(l => l.item_type === "PRODUCT").map(l => {
    const inv = c.byId("inventory_items", l.inventory_item_id);
    const d = String(l.description);
    const kind = isOil(d, inv?.category) ? "OIL" : isFilter(d, inv?.category) ? "FILTER" : null;
    return kind ? { order_item_id: l.id, kind, description: d, quantity: Number(l.quantity), unit_ref: Number(l.charged_ref_amount) / Number(l.quantity), inventory_item_id: l.inventory_item_id, product_id: null, source: l.inventory_item_id ? "INVENTORY" : "MANUAL" } : null;
  }).filter(Boolean),

  add_oil_change_service: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    if (!a.p_service_vehicle_id) fail("Selecciona el vehículo para el cambio de aceite.");
    if (a.p_odometer == null || Number(a.p_odometer) < 0) fail("Ingresa el kilometraje actual.");
    const labor = Number(a.p_labor_ref ?? 0);
    if (labor < 0) fail("La mano de obra no puede ser negativa.");
    const ids: string[] = a.p_replace_item_ids ?? [];
    c.s.tables.order_items = c.t("order_items").filter(i => !(i.order_id === o.id && ids.includes(i.id as string)));
    const customerOil = String(a.p_oil_source).toUpperCase() === "CUSTOMER";
    if (customerOil && labor <= 0) fail("El cliente trae el aceite: indica el precio de la mano de obra.");
    const vehicle = a.p_service_vehicle_id;
    let filterCode = a.p_filter_code ?? null, oilBrand = a.p_oil_brand ?? null;
    if (!customerOil) {
      const inv = a.p_oil_inventory_item_id ? c.byId("inventory_items", a.p_oil_inventory_item_id) : null;
      if (a.p_oil_source === "INVENTORY" && !inv) fail("Aceite de inventario no encontrado.");
      if (!(Number(a.p_oil_unit_ref) > 0)) fail("Indica el precio REF del aceite.");
      addLine(c, o, { type: "PRODUCT", area: "OIL_CHANGE", description: String(inv?.description ?? a.p_oil_description ?? "Aceite"), qty: Number(a.p_oil_units ?? 1), unitRef: Number(a.p_oil_unit_ref), inventoryItemId: inv?.id as string | undefined, extra: { service_vehicle_id: vehicle } });
      oilBrand = oilBrand ?? inv?.brand ?? null;
    }
    const fs = String(a.p_filter_source ?? "NONE").toUpperCase();
    if (fs !== "NONE") {
      const inv = a.p_filter_inventory_item_id ? c.byId("inventory_items", a.p_filter_inventory_item_id) : null;
      if (!(Number(a.p_filter_unit_ref) > 0)) fail("Indica el precio REF del filtro.");
      addLine(c, o, { type: "PRODUCT", area: "OIL_CHANGE", description: String(inv?.description ?? a.p_filter_description ?? "Filtro de aceite"), qty: Number(a.p_filter_units ?? 1), unitRef: Number(a.p_filter_unit_ref), inventoryItemId: inv?.id as string | undefined, extra: { service_vehicle_id: vehicle } });
      filterCode = filterCode ?? inv?.sku ?? a.p_filter_description ?? null;
    }
    const odo = Number(a.p_odometer);
    const svc = addLine(c, o, { type: "SERVICE", area: "OIL_CHANGE", description: `${a.p_description || "Cambio de aceite"}${customerOil ? " · aceite del cliente" : ""}`, qty: 1, unitRef: labor, pricingMode: "STANDARD",
      extra: { service_vehicle_id: vehicle, service_odometer: odo, oil_brand: customerOil ? `${a.p_oil_brand ?? a.p_oil_description ?? "Aceite"} (traído por el cliente)` : oilBrand, oil_viscosity: a.p_oil_viscosity ?? null,
        oil_quantity_liters: a.p_oil_quantity_liters ?? null, oil_filter_code: filterCode, next_service_odometer: odo + Number(a.p_next_km_interval ?? 5000), next_service_date: addMonths(c.today, Number(a.p_next_months ?? 3)) } });
    if (!o.vehicle_id) { o.vehicle_id = vehicle; o.customer_id = o.customer_id ?? c.byId("vehicles", vehicle)?.customer_id ?? null; o.is_walk_in = !o.customer_id; }
    const v = c.byId("vehicles", vehicle); if (v && odo > Number(v.current_odometer ?? 0)) v.current_odometer = odo;
    recompute(c, o); c.commit();
    return svc.id;
  },
};
