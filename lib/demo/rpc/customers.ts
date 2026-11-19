// Clientes y vehículos, y la captura de placa del Seguimiento.
import { linesOf, localDay, r2 } from "../domain/order-engine";
import { needsPlateCapture } from "../rules/oil-change";
import type { Row } from "../store";
import { fail, type Ctx, type Handler } from "./ctx";

const cleanPlate = (p: unknown) => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const cleanPhone = (p: unknown) => { const d = String(p ?? "").replace(/\D/g, ""); return d ? (d.length === 11 ? `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}` : String(p).trim()) : null; };
const fold = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function upsertCustomer(c: Ctx, name: unknown, phone: unknown, doc: unknown) {
  const n = String(name ?? "").trim(); if (n.length < 2) fail("Escribe el nombre del cliente.");
  const ph = cleanPhone(phone);
  const hit = ph ? c.t("customers").find(x => String(x.phone ?? "").replace(/\D/g, "") === ph.replace(/\D/g, "")) : null;
  if (hit) { hit.name = n; if (doc) hit.document_id = doc; hit.updated_at = c.now(); return hit; }
  return c.insert("customers", { id: c.id("cus", "customers"), name: n, phone: ph, document_id: doc ? String(doc).trim() : null, created_at: c.now(), updated_at: c.now() });
}

function upsertVehicle(c: Ctx, a: Row) {
  const plate = cleanPlate(a.p_plate); if (plate.length < 5) fail("Escribe una placa válida.");
  const hit = c.t("vehicles").find(v => cleanPlate(v.plate) === plate);
  if (hit) { Object.assign(hit, { customer_id: a.p_customer_id ?? hit.customer_id, make: a.p_make ?? hit.make, model: a.p_model ?? hit.model, year: a.p_year ?? hit.year, engine: a.p_engine ?? hit.engine, current_odometer: a.p_current_odometer ?? hit.current_odometer, updated_at: c.now() }); return hit; }
  const v = c.insert("vehicles", { id: c.id("veh", "vehicles"), customer_id: a.p_customer_id ?? null, plate, make: a.p_make ?? null, model: a.p_model ?? null, year: a.p_year ?? null, engine: a.p_engine ?? null, current_odometer: a.p_current_odometer ?? null, created_at: c.now(), updated_at: c.now() });
  if (v.customer_id) c.insert("vehicle_customer_history", { id: c.id("vch"), vehicle_id: v.id, customer_id: v.customer_id, source_system: "OS", first_seen_at: c.now(), last_seen_at: c.now(), created_at: c.now() });
  return v;
}

function captureStatus(c: Ctx, orderId: unknown) {
  const o = c.byId("orders", orderId) ?? fail("Orden no encontrada.");
  const lines = linesOf(c, o!.id).map(l => {
    const inv = c.byId("inventory_items", l.inventory_item_id);
    return { itemType: l.item_type as "PRODUCT" | "SERVICE", businessArea: l.business_area as string, quantity: Number(l.quantity), description: String(l.description), category: inv?.category as string, unit: inv?.unit as string, manual: !l.inventory_item_id, bonus: l.pricing_mode === "BONUS" };
  });
  const oil = linesOf(c, o!.id).find(l => /aceite/i.test(String(l.description)) && l.item_type === "PRODUCT");
  const needs = needsPlateCapture(lines);
  const skipped = c.t("crm_capture_skips").some(s => s.order_id === o!.id);
  const has = !!o!.vehicle_id;
  return { has_oil: !!oil, oil: oil?.description ?? null, has_vehicle: has, skipped, needs: needs && !has && o!.status !== "CANCELLED" && !skipped, optional: !!oil && !needs && !has && !skipped };
}

export const customers: Record<string, Handler> = {
  upsert_customer: (a, c) => { const x = upsertCustomer(c, a.p_name, a.p_phone, a.p_document_id); c.commit(); return x.id; },
  update_customer_profile: (a, c) => {
    const x = c.byId("customers", a.p_customer_id) ?? fail("Cliente no encontrado.");
    if (String(a.p_name ?? "").trim().length < 2) fail("Escribe el nombre del cliente.");
    Object.assign(x!, { name: String(a.p_name).trim(), phone: cleanPhone(a.p_phone), document_id: a.p_document_id || null, updated_at: c.now() }); c.commit(); return null;
  },
  upsert_vehicle: (a, c) => { const v = upsertVehicle(c, a); c.commit(); return v.id; },
  create_customer_vehicle: (a, c) => { const v = upsertVehicle(c, a); c.commit(); return v.id; },
  update_vehicle_profile: (a, c) => {
    const v = c.byId("vehicles", a.p_vehicle_id) ?? fail("Vehículo no encontrado.");
    Object.assign(v!, { customer_id: a.p_customer_id ?? v!.customer_id, plate: cleanPlate(a.p_plate) || v!.plate, make: a.p_make, model: a.p_model, year: a.p_year, engine: a.p_engine, current_odometer: a.p_current_odometer, updated_at: c.now() }); c.commit(); return null;
  },
  reassign_vehicle_customer: (a, c) => {
    const v = c.byId("vehicles", a.p_vehicle_id) ?? fail("Vehículo no encontrado.");
    if (String(a.p_reason ?? "").trim().length < 3) fail("Escribe el motivo del cambio.");
    v!.customer_id = a.p_customer_id ?? null; v!.updated_at = c.now();
    if (a.p_customer_id) c.insert("vehicle_customer_history", { id: c.id("vch"), vehicle_id: v!.id, customer_id: a.p_customer_id, source_system: "OS", first_seen_at: c.now(), last_seen_at: c.now(), created_at: c.now() });
    c.commit(); return null;
  },
  search_customer_master: (a, c) => {
    const q = fold(a.p_query);
    const vehicles = c.t("vehicles");
    const closed = c.t("orders").filter(o => o.status === "CLOSED");
    return c.t("customers").map(cu => {
      const vs = vehicles.filter(v => v.customer_id === cu.id);
      const os = closed.filter(o => o.customer_id === cu.id);
      return { customer_id: cu.id, name: cu.name, phone: cu.phone, document_id: cu.document_id, created_at: cu.created_at, vehicle_count: vs.length, order_count: os.length,
        total_ref: r2(os.reduce((s, o) => s + Number(o.total_ref), 0)), last_visit_at: os.map(o => String(o.business_at)).sort().at(-1) ?? null,
        vehicles_text: vs.map(v => `${v.plate} ${v.make ?? ""} ${v.model ?? ""}`.trim()).join(" · ") };
    }).filter(r => !q || fold(`${r.name} ${r.phone} ${r.document_id} ${r.vehicles_text}`).includes(q))
      .sort((x, y) => String(y.last_visit_at ?? "").localeCompare(String(x.last_visit_at ?? ""))).slice(0, Number(a.p_limit ?? 1000));
  },
  search_vehicles_for_customer: (a, c) => {
    const q = fold(a.p_query);
    return c.t("vehicles").filter(v => !q || fold(`${v.plate} ${v.make} ${v.model}`).includes(q))
      .sort((x, y) => (x.customer_id === a.p_customer_id ? -1 : 0) - (y.customer_id === a.p_customer_id ? -1 : 0)).slice(0, Number(a.p_limit ?? 12))
      .map(v => ({ ...v, customer_name: c.byId("customers", v.customer_id)?.name ?? null }));
  },

  crm_capture_status: (a, c) => captureStatus(c, a.p_order_id),
  crm_capture_lookup: (a, c) => {
    const v = c.t("vehicles").find(x => cleanPlate(x.plate) === cleanPlate(a.p_plate));
    if (!v) return null;
    const cu = c.byId("customers", v.customer_id);
    return { vehicle_id: v.id, plate: v.plate, make: v.make, model: v.model, customer_name: cu?.name ?? null, phone: cu?.phone ?? null };
  },
  crm_capture_sale: (a, c) => {
    const o = c.byId("orders", a.p_order_id) ?? fail("Orden no encontrada.");
    let v = c.t("vehicles").find(x => cleanPlate(x.plate) === cleanPlate(a.p_plate));
    let cu = v?.customer_id ? c.byId("customers", v.customer_id) : null;
    if (!cu) cu = upsertCustomer(c, a.p_name || "Cliente sin nombre", a.p_phone, null);
    if (!v) v = upsertVehicle(c, { p_plate: a.p_plate, p_customer_id: cu!.id, p_make: a.p_make, p_model: a.p_model });
    o!.customer_id = cu!.id; o!.vehicle_id = v.id; o!.is_walk_in = false;
    for (const sr of c.t("service_records").filter(r => r.order_id === o!.id)) { sr.vehicle_id = v.id; sr.customer_id = cu!.id; }
    if (o!.status === "CLOSED" && !c.t("service_records").some(r => r.order_id === o!.id)) {
      const oil = linesOf(c, o!.id).find(l => /aceite/i.test(String(l.description)));
      c.insert("service_records", { id: c.id("sr", "service-history"), order_id: o!.id, order_item_id: oil?.id ?? null, customer_id: cu!.id, vehicle_id: v.id, service_type: "OIL_CHANGE", description: "Cambio de aceite",
        odometer: v.current_odometer ?? null, oil_brand: null, oil_viscosity: null, oil_quantity_liters: null, oil_filter_code: null, next_service_odometer: null,
        next_service_date: new Date(Date.parse(`${localDay(o!.business_at)}T12:00:00Z`) + 90 * 86400000).toISOString().slice(0, 10), charged_ref_amount: null, charged_ves_amount: null,
        performed_at: o!.business_at, created_by: null, created_at: c.now(), source_system: "OS", source_key: null, source_invoice: null, service_notes: null, included_services: [], bonuses: [], source_payload: null, imported_at: null });
    }
    c.commit(); return { customer_id: cu!.id, vehicle_id: v.id };
  },
  crm_capture_skip: (a, c) => { c.insert("crm_capture_skips", { order_id: a.p_order_id, reason: a.p_reason ?? null, created_at: c.now() }); c.commit(); return null; },
};
