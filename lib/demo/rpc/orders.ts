// Órdenes: crear, agregar productos y servicios, ajustes, cobros, cierre, vista previa, recibo y listado.
import Decimal from "decimal.js";
import { addLine, addPayment, closeOrder, createOrder, dueIn, linesOf, localDay, METHOD_LABEL, openOrder, orderRates, paidRef, paymentsOf, r2, r4, recompute, USD_METHODS } from "../domain/order-engine";
import { lineProfit, type LineRole } from "../rules/profit";
import { casheaSurchargePercent } from "../rules/cashea";
import { DEMO_SETTINGS } from "../rules/settings";
import type { Row } from "../store";
import { createReceivable } from "./receivables";
import { fail, type Ctx, type Handler } from "./ctx";

const D = Decimal.clone({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
const EMP_MECH = "emp-mecanico", EMP_TECH = "emp-tecnico";
const tail = (s: unknown) => (s ? String(s).slice(-4) : null);

export const roleOf = (i: Row): LineRole => (i.line_role as LineRole) ?? (i.item_type === "SERVICE" ? (["WORKSHOP", "ELECTROAUTO"].includes(String(i.business_area)) ? "LABOR" : "OIL_LABOR") : "PRODUCT");
const casheaOf = (c: Ctx, orderId: unknown) => c.t("cashea_sales").find(s => s.order_id === orderId && s.status !== "CANCELLED") ?? null;

function orderKind(lines: Row[]): "STORE" | "WORKSHOP" | "MIXED" {
  const shop = lines.some(l => ["WORKSHOP", "ELECTROAUTO"].includes(String(l.business_area)));
  const store = lines.some(l => !["WORKSHOP", "ELECTROAUTO"].includes(String(l.business_area)));
  return shop && store ? "MIXED" : shop ? "WORKSHOP" : "STORE";
}

function paymentType(c: Ctx, o: Row) {
  if (casheaOf(c, o.id)) return "CASHEA";
  if (c.t("receivables").some(r => r.order_id === o.id)) return "CREDIT";
  return "CASH";
}

export function lineEconomics(c: Ctx, i: Row) {
  return lineProfit({ role: roleOf(i), revenueRef: Number(i.charged_ref_amount), costRef: Number(i.total_cost_ref_snapshot) || null, listRef: Number(i.list_ref_amount ?? i.charged_ref_amount),
    passThroughCostRef: i.pass_through_cost_ref as number | null, mechanicsRef: Number(i.worker_share_ref_snapshot ?? 0) + Number(i.assistant_bonus_ref_snapshot ?? 0), paidWithCashea: !!casheaOf(c, i.order_id) });
}

function installmentsView(c: Ctx, sale: Row) {
  return c.t("cashea_installments").filter(i => i.cashea_sale_id === sale.id).sort((a, b) => Number(a.installment_no) - Number(b.installment_no))
    .map(i => ({ no: i.installment_no, due: i.due_date, amount_ref: Number(i.amount_ref), paid_ref: Number(i.paid_ref ?? 0), status: i.status, overdue: i.status !== "PAID" && String(i.due_date) < c.today }));
}

function previewOf(c: Ctx, o: Row) {
  const lines = linesOf(c, o.id);
  const customer = c.byId("customers", o.customer_id);
  const vehicle = c.byId("vehicles", o.vehicle_id);
  const pays = paymentsOf(c, o.id);
  const { bcv } = orderRates(c, o);
  const pl = (l: Row) => ({ name: l.description, qty: Number(l.quantity), unit_price_ref: r2(Number(l.charged_ref_amount) / Number(l.quantity)), total_ref: Number(l.charged_ref_amount), kind: l.item_type, area: l.business_area,
    mechanic: l.worker_employee_id === EMP_MECH ? "Mecánico de taller" : l.worker_employee_id === EMP_TECH ? "Técnico de electroauto" : null });
  const visible = lines.filter(l => !["CASHEA_SURCHARGE"].includes(String(l.line_role)));
  const store = visible.filter(l => !["WORKSHOP", "ELECTROAUTO"].includes(String(l.business_area)));
  const shop = visible.filter(l => ["WORKSHOP", "ELECTROAUTO"].includes(String(l.business_area)));
  const sale = casheaOf(c, o.id);
  const credit = c.t("receivables").find(r => r.order_id === o.id);
  const collected = paidRef(c, o);
  const econ = lines.map(l => ({ l, e: lineEconomics(c, l) }));
  const owner = c.profile === "OWNER" || c.profile === "ADMIN";
  return {
    order: { id: o.id, number: o.order_number, status: o.status, at: o.business_at ?? o.opened_at, attendant: o.attended_by ?? null, kind: orderKind(lines), payment_type: paymentType(c, o), cancellation_reason: o.cancellation_reason ?? null },
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
    vehicle: vehicle ? { id: vehicle.id, plate: vehicle.plate, label: [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" "), odometer: vehicle.current_odometer ?? null } : null,
    groups: {
      store: { subtotal_ref: r2(store.reduce((a, l) => a + Number(l.charged_ref_amount), 0)), lines: store.map(pl) },
      workshop: { subtotal_ref: r2(shop.reduce((a, l) => a + Number(l.charged_ref_amount), 0)), lines: shop.map(pl) },
      internal: lines.filter(l => l.line_role === "CASHEA_SURCHARGE").map(l => ({ name: l.description, total_ref: Number(l.charged_ref_amount), role: l.line_role })),
    },
    adjustments: { discount_ref: Number(o.adjust_discount_ref ?? 0), discount_pct: Number(o.adjust_discount_percent ?? 0), discount_reason: o.adjust_discount_reason ?? null, owner_approved: !!o.adjust_owner_approved, rounding_ref: r2(Number(o.adjust_rounding_ref ?? 0) + Number(o.adjust_cash_rounding_ref ?? 0)) },
    totals: { ref: Number(o.total_ref), ves: Number(o.total_ves), bcv_rate: bcv, collected_ref: r2(collected), collected_ves: r2(pays.reduce((a, p) => a + Number(p.value_ves), 0)), pending_ref: o.status === "CLOSED" ? r2((sale ? Number(sale.financed_ref) - installmentsView(c, sale).reduce((a, i) => a + i.paid_ref, 0) : 0) + (credit ? Number(credit.principal_ref) * Number(credit.outstanding_fraction) : 0)) : r2(Math.max(0, Number(o.total_ref) - collected)) },
    payments: pays.map(p => ({ method: p.method, label: METHOD_LABEL[String(p.method)] ?? p.method, ref_tail: tail(p.reference), currency: p.currency, amount: Number(p.amount_original), equivalent_ref: r2(Number(p.value_ref)), paid_at: p.paid_at })),
    cashea: sale ? { reference: sale.cashea_reference, initial_percent: Number(sale.initial_percent), initial_ref: Number(sale.initial_ref), financed_ref: Number(sale.financed_ref), status: sale.status, installments: installmentsView(c, sale) } : null,
    credit: credit ? { status: credit.status, outstanding_ref: r2(Number(credit.principal_ref) * Number(credit.outstanding_fraction)), outstanding_ves: Number(credit.outstanding_ves) } : null,
    profit: owner && o.status === "CLOSED" ? {
      store_ref: r2(econ.filter(x => x.e.area === "TIENDA").reduce((a, x) => a + x.e.profitRef, 0)), workshop_ref: r2(econ.filter(x => x.e.area === "TALLER").reduce((a, x) => a + x.e.profitRef, 0)),
      total_ref: r2(econ.reduce((a, x) => a + x.e.profitRef, 0)), cashea_commission_ref: r2(econ.reduce((a, x) => a + x.e.casheaRef, 0)), estimated_cost: econ.some(x => x.e.estimated),
      mechanics: [[EMP_MECH, "Mecánico de taller"], [EMP_TECH, "Técnico de electroauto"]].map(([id, name]) => ({ name, ref: r2(lines.reduce((a, l) => a + (l.worker_employee_id === id ? Number(l.worker_share_ref_snapshot ?? 0) : 0) + (l.assistant_bonus_employee_id === id ? Number(l.assistant_bonus_ref_snapshot ?? 0) : 0), 0)) })).filter(m => m.ref > 0),
    } : null,
  };
}

function receiptOf(c: Ctx, o: Row) {
  const header = c.setting<Row>("receipt_header", {});
  const p = previewOf(c, o);
  const lines = linesOf(c, o.id);
  const svc = lines.find(l => l.item_type === "SERVICE" && l.business_area === "OIL_CHANGE");
  const tenders = c.t("order_tenders").filter(t => t.order_id === o.id);
  const customer = c.byId("customers", o.customer_id);
  return {
    header: { branch: header.branch ?? null, address: header.address ?? null, whatsapp: header.whatsapp ?? null, instagram: header.instagram ?? null, rif: header.rif ?? null, legend: header.footer ?? "Nota de entrega · Documento no fiscal", total_style: c.setting("receipt_total_style", "BLOCK") },
    order: { number: o.order_number, status: o.status, at: o.business_at ?? o.opened_at, attendant: o.attended_by ?? null },
    customer: customer ? { name: customer.name, phone_tail: tail(customer.phone) } : null,
    vehicle: p.vehicle ? { label: p.vehicle.label, plate: p.vehicle.plate, odometer: svc?.service_odometer ?? p.vehicle.odometer } : null,
    lines: lines.map(l => ({ name: l.description, qty: Number(l.quantity), unit_label: null, unit_price_ref: r2(Number(l.charged_ref_amount) / Number(l.quantity)), total_ref: Number(l.charged_ref_amount), kind: l.item_type, courtesy: Number(l.charged_ref_amount) === 0 })),
    adjustments: { discount_ref: p.adjustments.discount_ref, rounding_ref: p.adjustments.rounding_ref },
    totals: { ref: p.totals.ref, ves: p.totals.ves, bcv_rate: p.totals.bcv_rate },
    payments: p.payments.map(x => ({ label: x.label, ref_tail: x.ref_tail, currency: x.currency, amount: x.amount })),
    change: tenders.map(t => ({ received: Number(t.received), currency: t.currency, returned_usd: Number(t.returned_usd ?? 0), pending_usd: r2(Math.max(0, Number(t.change_usd ?? 0) - Number(t.returned_usd ?? 0))) })),
    cashea: p.cashea ? { initial_percent: p.cashea.initial_percent, initial_ref: p.cashea.initial_ref, installments: p.cashea.installments.map(i => ({ no: i.no, due: i.due, amount_ref: i.amount_ref, status: i.status })) } : null,
    credit: p.credit ? { outstanding_ves: p.credit.outstanding_ves, outstanding_ref: p.credit.outstanding_ref } : null,
    next_service: svc ? { odometer: svc.next_service_odometer ?? null, date: svc.next_service_date ?? null, oil: [svc.oil_brand, svc.oil_viscosity].filter(Boolean).join(" ") || null, filter: svc.oil_filter_code ?? null } : null,
  };
}

/** Datos para la lista de Órdenes y cobranza. */
function saleRow(c: Ctx, o: Row) {
  const lines = linesOf(c, o.id);
  const customer = c.byId("customers", o.customer_id);
  const vehicle = c.byId("vehicles", o.vehicle_id);
  const pays = paymentsOf(c, o.id);
  const sale = casheaOf(c, o.id);
  const { bcv } = orderRates(c, o);
  const AREA: Record<string, string> = { STORE: "Tienda", OIL_CHANGE: "Cambio de aceite", WORKSHOP: "Taller", ELECTROAUTO: "Electroauto" };
  return {
    id: o.id, order_number: o.order_number, status: o.status, sale_at: o.business_at ?? o.opened_at, customer_id: o.customer_id, customer_name: customer?.name ?? null, plate: vehicle?.plate ?? null,
    kind: orderKind(lines), services: [...new Set(lines.map(l => AREA[String(l.business_area)]))].join(", ") || null, total_ref: Number(o.total_ref), total_ves: Number(o.total_ves),
    payment_type: paymentType(c, o), has_financed_sale: !!sale, cancellation_reason: o.cancellation_reason ?? null,
    collected_ves: r2(pays.filter(p => p.currency === "VES").reduce((a, p) => a + Number(p.amount_original), 0)), collected_usd: r2(pays.filter(p => p.currency === "USD").reduce((a, p) => a + Number(p.amount_original), 0)),
    payment_details: pays.map(p => ({ method: p.method, currency: p.currency, amount_original: Number(p.amount_original), equivalent_bcv: r2(Number(p.value_ref)), reference_tail: tail(p.reference), paid_at: p.paid_at })),
    cashea: sale ? { initial_percent: Number(sale.initial_percent), initial_bcv_usd: Number(sale.initial_ref), initial_ves: Number(sale.initial_ves_snapshot), financed_bcv_usd: Number(sale.financed_ref), total_bcv_usd: Number(sale.gross_ref), bcv_rate: bcv, reference: sale.cashea_reference, initial_method: sale.initial_payment_method, ownership_status: sale.ownership_status, status: sale.status } : null,
  };
}

const PAGE = 50;

export const orders: Record<string, Handler> = {
  create_order: (_a, c) => { const o = createOrder(c); c.commit(); return [{ id: o.id, order_number: o.order_number }]; },

  add_inventory_product_item: (a, c) => {
    const o = openOrder(c, a.p_order_id); const it = c.byId("inventory_items", a.p_inventory_item_id) ?? fail("Artículo no encontrado.");
    const unit = a.p_manual_unit_ref != null ? Number(a.p_manual_unit_ref) : Number(it!.price_ref);
    if (!(unit > 0)) fail("Este artículo no tiene precio. Ponle precio en Inventario antes de venderlo.");
    const l = addLine(c, o, { type: "PRODUCT", area: String(a.p_business_area ?? "STORE"), description: String(it!.description), qty: Number(a.p_quantity), unitRef: unit, inventoryItemId: it!.id as string });
    c.commit(); return l.id;
  },
  add_catalog_product_item_override: (a, c) => {
    const o = openOrder(c, a.p_order_id); const it = c.byId("inventory_items", a.p_product_id);
    const l = addLine(c, o, { type: "PRODUCT", area: "STORE", description: String(it?.description ?? "Producto de catálogo"), qty: Number(a.p_quantity), unitRef: Number(a.p_manual_unit_ref), inventoryItemId: it?.id as string | undefined });
    c.commit(); return l.id;
  },
  add_manual_product_item: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    if (!String(a.p_description ?? "").trim()) fail("Escribe la descripción del producto.");
    const l = addLine(c, o, { type: "PRODUCT", area: "STORE", description: String(a.p_description).trim(), qty: Number(a.p_quantity), unitRef: Number(a.p_unit_ref), pricingMode: "MANUAL_NO_STOCK" });
    c.commit(); return l.id;
  },
  add_inventory_bonus_item: (a, c) => {
    const o = openOrder(c, a.p_order_id); const it = c.byId("inventory_items", a.p_inventory_item_id) ?? fail("Artículo no encontrado.");
    const l = addLine(c, o, { type: "PRODUCT", area: String(a.p_business_area ?? "STORE"), description: `${it!.description} (obsequio: ${a.p_reason ?? "cortesía"})`, qty: Number(a.p_quantity), unitRef: 0, inventoryItemId: it!.id as string, pricingMode: "BONUS" });
    c.commit(); return l.id;
  },
  add_service_priced: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    const area = String(a.p_business_area); const base = Number(a.p_base_ref); const customer = Number(a.p_customer_ref);
    if (!String(a.p_description ?? "").trim()) fail("Escribe qué trabajo se hizo.");
    if (!(customer > 0)) fail("Indica el precio de la mano de obra.");
    const pct = DEMO_SETTINGS.mechanicPercent;
    const mechRef = r2(a.p_worker_share_override_ref != null ? Number(a.p_worker_share_override_ref) : base * pct / 100);
    const bonusOn = area === "WORKSHOP" && (a.p_tech_bonus_enabled ?? a.p_alexis_bonus_enabled ?? false);
    const bonusRef = bonusOn ? r2(base * DEMO_SETTINGS.techBonusPercent / 100) : 0;
    if (customer - mechRef - bonusRef < 0) fail("El precio al cliente no cubre la parte del mecánico. Ajusta el precio o la participación.");
    const l = addLine(c, o, { type: "SERVICE", area, description: String(a.p_description).trim(), qty: 1, unitRef: customer, denomination: a.p_denomination ?? "REF",
      mech: { ref: mechRef, emp: area === "WORKSHOP" ? EMP_MECH : EMP_TECH, pct }, bonus: bonusOn ? { ref: bonusRef, emp: EMP_TECH, pct: DEMO_SETTINGS.techBonusPercent } : null,
      extra: { base_ref_amount: base, service_vehicle_id: o.vehicle_id ?? null } });
    c.commit(); return l.id;
  },
  add_pass_through_item: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    const cost = String(a.p_cost_currency) === "VES" ? Number(a.p_cost_amount) / c.rates.bcv : Number(a.p_cost_amount);
    const charge = Number(a.p_charge_ref);
    if (charge < cost - 0.005) fail("El precio al cliente no puede ser menor que el costo de la compra.");
    const area = linesOf(c, o.id).some(l => l.business_area === "ELECTROAUTO") ? "ELECTROAUTO" : "WORKSHOP";
    const l = addLine(c, o, { type: "PRODUCT", area, description: String(a.p_description), qty: 1, unitRef: charge, role: "PASS_THROUGH", passCost: r4(cost), pricingMode: "MANUAL_NO_STOCK" });
    c.commit(); return l.id;
  },
  delete_order_item: (a, c) => {
    const l = c.byId("order_items", a.p_item_id) ?? fail("Línea no encontrada.");
    const o = openOrder(c, l!.order_id);
    c.s.tables.order_items = c.t("order_items").filter(i => i.id !== l!.id);
    recompute(c, o); c.commit(); return null;
  },
  delete_payment: (a, c) => {
    const p = c.byId("payments", a.p_payment_id) ?? fail("Pago no encontrado.");
    openOrder(c, p!.order_id);
    c.s.tables.payments = c.t("payments").filter(x => x.id !== p!.id);
    c.s.tables.order_tenders = c.t("order_tenders").filter(x => x.payment_id !== p!.id);
    c.commit(); return null;
  },
  delete_open_order: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    if (paymentsOf(c, o.id).length) fail("La orden tiene pagos: elimínalos antes de borrarla.");
    c.s.tables.order_items = c.t("order_items").filter(i => i.order_id !== o.id);
    c.s.tables.orders = c.t("orders").filter(x => x.id !== o.id);
    c.commit(); return o.order_number;
  },
  cancel_order: (a, c) => {
    const o = c.byId("orders", a.p_order_id) ?? fail("Orden no encontrada.");
    if (o!.status === "CANCELLED") fail("La orden ya está anulada.");
    if (casheaOf(c, o!.id)) fail("Las ventas con Cashea se anulan desde la conciliación de Cashea en la versión completa.");
    if (o!.status === "CLOSED") for (const l of linesOf(c, o!.id)) if (l.inventory_item_id) c.insert("inventory_movements", {
      id: c.id("mov"), inventory_item_id: l.inventory_item_id, location_id: "loc-centro", quantity_delta: Number(l.quantity), movement_type: "RETURN", order_item_id: l.id,
      note: `Anulación de ${o!.order_number}`, occurred_at: c.now(), created_by: null, created_at: c.now(), supplier_receipt_item_id: null, reversal_of: null });
    o!.status = "CANCELLED"; o!.cancellation_reason = String(a.p_reason ?? ""); o!.cancelled_at = c.now();
    c.s.tables.service_records = c.t("service_records").filter(r => r.order_id !== o!.id);
    c.commit(); return null;
  },

  set_order_party: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    o.customer_id = a.p_customer_id ?? null; o.vehicle_id = a.p_vehicle_id ?? null; o.is_walk_in = !a.p_customer_id;
    if (a.p_vehicle_id && !a.p_customer_id) o.customer_id = c.byId("vehicles", a.p_vehicle_id)?.customer_id ?? null;
    c.commit(); return null;
  },
  set_order_walk_in: (a, c) => { const o = openOrder(c, a.p_order_id); o.is_walk_in = !!a.p_is_walk_in; if (a.p_is_walk_in) { o.customer_id = null; o.vehicle_id = null; } c.commit(); return null; },
  set_order_date: (a, c) => { const o = c.byId("orders", a.p_order_id) ?? fail("Orden no encontrada."); o!.business_at = a.p_business_at ?? o!.opened_at; c.commit(); return null; },
  set_order_attendant: (a, c) => { const o = c.byId("orders", a.p_order_id); if (o) { o.attended_by = a.p_attendant ?? null; c.commit(); } return null; },
  set_order_crm_extras: (a, c) => { const o = c.byId("orders", a.p_order_id) ?? fail("Orden no encontrada."); o!.crm_additional_services = a.p_additional_services ?? []; o!.crm_bonuses = a.p_bonuses ?? []; o!.crm_observations = a.p_observations ?? null; c.commit(); return null; },

  apply_order_adjustments: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    const pct = Number(a.p_discount_percent ?? 0);
    const limit = c.setting("discount_free_limit_percent", DEMO_SETTINGS.discountFreeLimitPercent);
    if (pct < 0 || pct > 100) fail("El descuento debe estar entre 0 y 100 %.");
    if (pct > 0 && !String(a.p_discount_reason ?? "").trim()) fail("Elige el motivo del descuento.");
    let approved = false;
    if (pct > limit) {
      if (a.p_owner_pin !== DEMO_SETTINGS.demoPin) return { ok: false, error: `Un descuento mayor a ${limit} % pide el PIN del dueño. En la muestra es ${DEMO_SETTINGS.demoPin}.`, discount_free_limit_percent: limit };
      approved = true;
    }
    o.adjust_discount_percent = pct; o.adjust_discount_reason = pct > 0 ? a.p_discount_reason : null; o.adjust_rounding_mode = a.p_rounding_mode ?? "NONE"; o.adjust_owner_approved = approved;
    recompute(c, o); c.commit();
    return { ok: true, order: o.id, discount_percent: pct, rounding_mode: o.adjust_rounding_mode, owner_approved: approved, discount_free_limit_percent: limit, result: { total_ref: o.total_ref, total_ves: o.total_ves, discount_ref: o.adjust_discount_ref, rounding_ref: o.adjust_rounding_ref } };
  },

  round_order_cash_remainder: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    const { bcv, operative } = orderRates(c, o);
    const leftUsd = new D(Math.max(0, Number(o.total_ref) - paidRef(c, o))).mul(bcv).div(operative);
    const target = a.p_direction === "UP" ? leftUsd.ceil() : leftUsd.floor();
    const deltaRef = r2(target.minus(leftUsd).mul(operative).div(bcv));
    o.adjust_cash_rounding_ref = r2(Number(o.adjust_cash_rounding_ref ?? 0) + deltaRef);
    recompute(c, o); c.commit();
    return { order: o.id, direction: a.p_direction, cash_before: r2(leftUsd), cash_after: target.toNumber(), delta_ref: deltaRef, bcv_rate: bcv, operative_rate: operative, result: { total_ref: o.total_ref } };
  },

  set_cashea_surcharge: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    c.s.tables.order_items = c.t("order_items").filter(i => !(i.order_id === o.id && i.line_role === "CASHEA_SURCHARGE"));
    let pct = 0, ref = 0;
    if (a.p_initial_percent != null) {
      const labor = linesOf(c, o.id).filter(i => roleOf(i) === "LABOR").reduce((s, i) => s + Number(i.charged_ref_amount), 0);
      if (labor > 0) {
        pct = casheaSurchargePercent(Number(a.p_initial_percent), c.setting("cashea_opportunity_monthly_percent", 5)) ?? 0;
        ref = r2(labor * pct / 100);
        addLine(c, o, { type: "PRODUCT", area: "STORE", description: "Recargo por pago con Cashea", qty: 1, unitRef: ref, role: "CASHEA_SURCHARGE", pricingMode: "MANUAL_NO_STOCK" });
      }
    }
    recompute(c, o); c.commit();
    return [{ surcharge_percent: pct, surcharge_ref: ref, total_ref: o.total_ref, total_ves: o.total_ves }];
  },

  complete_prepared_cashea: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    const reference = String(a.p_cashea_reference ?? "").trim();
    if (reference.length < 4) fail("Escribe el número de orden de Cashea.");
    const pct = Number(a.p_initial_percent ?? 40);
    const total = Number(o.total_ref);
    if (total < DEMO_SETTINGS.casheaMinimumRef) fail(`Cashea acepta compras desde ${DEMO_SETTINGS.casheaMinimumRef} REF.`);
    const initial = r2(total * pct / 100), financed = r2(total - initial), each = r2(financed / 3);
    const pays = Array.isArray(a.p_initial_payments) ? a.p_initial_payments : [];
    for (const p of pays) addPayment(c, o, String(p.method), Number(p.amount), { reference: p.reference ?? null });
    const paidInitial = paidRef(c, o);
    if (Math.abs(paidInitial - initial) > 0.02) fail(`La inicial debe ser ${initial.toFixed(2)} REF; registraste ${paidInitial.toFixed(2)}.`);
    const { bcv } = orderRates(c, o);
    const sale = c.insert("cashea_sales", {
      id: c.id("csh"), order_id: o.id, receivable_id: null, status: "ACTIVE", initial_percent: pct, commission_percent: 4, gross_ref: total, gross_ves_snapshot: o.total_ves,
      initial_ref: initial, initial_ves_snapshot: r2(initial * bcv), financed_ref: financed, commission_ref: r2(total * 0.04), commission_ves_snapshot: r2(total * 0.04 * bcv), bcv_rate_snapshot: bcv,
      initial_payment_method: pays[0]?.method ?? null, cashea_reference: reference, created_at: c.now(), settled_at: null, created_by: null, ownership_status: "OWN", ownership_reason: null, ownership_evidence: null,
    });
    for (const no of [1, 2, 3]) c.insert("cashea_installments", {
      id: `${sale.id}-c${no}`, cashea_sale_id: sale.id, installment_no: no, due_date: new Date(Date.parse(`${c.today}T12:00:00Z`) + no * 14 * 86400000).toISOString().slice(0, 10),
      amount_ref: no === 3 ? r2(financed - each * 2) : each, amount_ves_snapshot: r2((no === 3 ? financed - each * 2 : each) * bcv), paid_ref: 0, paid_ves_actual: null, status: "PENDING", paid_at: null, updated_at: c.now(),
    });
    closeOrder(c, o, { allowUnpaid: true });
    c.commit();
    return { order_id: o.id, order_number: o.order_number, cashea_sale_id: sale.id, total_ref: total, initial_ref: initial, financed_ref: financed };
  },

  collect_order_tender: (a, c) => {
    const o = openOrder(c, a.p_order);
    const method = String(a.p_method);
    const usd = USD_METHODS.includes(method);
    const due = dueIn(c, o, method);
    if (due <= 0) fail("La orden ya está cobrada.");
    const received = Number(a.p_received);
    if (!(received > 0)) fail("Indica cuánto recibiste.");
    const applied = Math.min(received, due);
    const p = addPayment(c, o, method, applied, { reference: a.p_reference ?? null });
    const extra = r2(received - applied);
    const rate = Number(a.p_change_rate ?? c.rates.operative);
    if (method.startsWith("CASH")) c.insert("order_tenders", {
      id: c.id("ten"), order_id: o.id, payment_id: p.id, customer_id: o.customer_id, customer_label: a.p_customer_label ?? null, method, currency: usd ? "USD" : "VES", received, applied,
      payment_rate: usd ? c.rates.operative : 1, change_usd: usd ? extra : r2(extra / rate), returned_usd: Number(a.p_return_usd ?? 0), change_rate: rate,
      rounding_ves: usd ? 0 : r2(extra - Number(a.p_return_usd ?? 0) * rate), request_payload: { confirmed_counted: true }, created_at: c.now(), created_by: null,
    });
    c.commit(); return p.id;
  },
  order_add_por_cobrar: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    const note = String(a.p_note ?? "").trim();
    if (note.length < 3) fail("Escribe la nota: quién cobró y por qué queda por cobrar.");
    const p = addPayment(c, o, "POR_COBRAR", dueIn(c, o, "POR_COBRAR"), { reference: note });
    c.insert("order_notes", { id: c.id("note"), order_id: o.id, note, kind: "POR_COBRAR", created_by: null, created_at: c.now() });
    c.commit(); return p.id;
  },
  validate_order_ready_to_close: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    // Revisa los datos de la orden (no el cobro, que viene después).
    if (!linesOf(c, o.id).length) fail("La orden no tiene productos ni servicios.");
    const oil = linesOf(c, o.id).find(l => l.item_type === "SERVICE" && l.business_area === "OIL_CHANGE");
    if (oil && !(oil.service_vehicle_id ?? o.vehicle_id)) fail("El cambio de aceite necesita el vehículo.");
    return null;
  },
  close_order: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    closeOrder(c, o); c.commit();
    return [{ order_number: o.order_number, total_ves: o.total_ves, total_ref: o.total_ref, total_cash_usd_equivalent: o.total_cash_usd_equivalent }];
  },
  close_order_with_credit: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    if (!o.customer_id) fail("Asigna el cliente antes de dejar la venta a crédito.");
    const rec = createReceivable(c, o, a.p_due_date);
    closeOrder(c, o, { allowUnpaid: true }); c.commit();
    return [{ order_number: o.order_number, total_ves: o.total_ves, total_ref: o.total_ref, receivable_id: rec.id, outstanding_ves: rec.outstanding_ves, outstanding_ref: rec.principal_ref }];
  },
  close_order_with_partial_credit: (a, c) => {
    const o = openOrder(c, a.p_order_id);
    if (!o.customer_id) fail("Asigna el cliente antes de dejar saldo a crédito.");
    const p = Number(a.p_amount_original) > 0 ? addPayment(c, o, String(a.p_method), Number(a.p_amount_original), { reference: a.p_reference ?? null }) : null;
    const rec = createReceivable(c, o, a.p_due_date);
    closeOrder(c, o, { allowUnpaid: true }); c.commit();
    return [{ order_number: o.order_number, total_ves: o.total_ves, total_ref: o.total_ref, payment_id: p?.id ?? null, receivable_id: rec.id, outstanding_ves: rec.outstanding_ves, outstanding_ref: rec.principal_ref }];
  },

  add_order_note: (a, c) => {
    const text = String(a.p_note ?? "").trim();
    if (!text) fail("Escribe la nota.");
    const n = c.insert("order_notes", { id: c.id("note"), order_id: a.p_order_id, note: text, kind: "NOTE", created_by: null, created_at: c.now() });
    c.commit(); return { order: a.p_order_id, note_id: n.id, actor: "Muestra" };
  },
  return_order_change: (a, c) => {
    const t = c.byId("order_tenders", a.p_tender) ?? fail("Vuelto no encontrado.");
    const pending = Number(t!.change_usd ?? 0) - Number(t!.returned_usd ?? 0);
    if (Number(a.p_usd) > pending + 0.005) fail("Es más de lo que falta por entregar.");
    t!.returned_usd = r2(Number(t!.returned_usd ?? 0) + Number(a.p_usd));
    c.commit(); return t!.id;
  },
  order_change_history: (a, c) => {
    const rows = c.t("order_tenders").filter(t => !a.p_order || t.order_id === a.p_order).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
    const page = rows.slice(Number(a.p_offset ?? 0), Number(a.p_offset ?? 0) + 30).map(t => ({ ...t, order_number: c.byId("orders", t.order_id)?.order_number, pending_usd: r2(Math.max(0, Number(t.change_usd ?? 0) - Number(t.returned_usd ?? 0))) }));
    return { rows: page, total: rows.length, pending_usd: r2(rows.reduce((s, t) => s + Math.max(0, Number(t.change_usd ?? 0) - Number(t.returned_usd ?? 0)), 0)) };
  },
  order_installment_payment_ids: (a, c) => paymentsOf(c, a.p_order_id).map(p => p.id),
  reclassify_order_item: (a, c) => {
    const l = c.byId("order_items", a.p_order_item_id) ?? fail("Línea no encontrada.");
    l!.line_role = a.p_role; if (a.p_role === "PASS_THROUGH") l!.pass_through_cost_ref = Number(a.p_cost_ref ?? 0);
    c.commit(); return null;
  },

  order_preview: (a, c) => previewOf(c, c.byId("orders", a.p_order_id) ?? fail("No se encontró la orden.")),
  order_receipt: (a, c) => receiptOf(c, c.byId("orders", a.p_order_id) ?? fail("No se encontró la orden.")),

  search_order_collection_v2: (a, c) => {
    const q = String(a.p_query ?? "").trim().toLowerCase();
    const status = String(a.p_status ?? "CLOSED");
    let list = c.t("orders").filter(o => status === "ALL" || o.status === status)
      .filter(o => { const d = localDay(o.business_at ?? o.opened_at); return (!a.p_from || d >= a.p_from) && (!a.p_to || d <= a.p_to); });
    if (q) list = list.filter(o => {
      const cu = c.byId("customers", o.customer_id); const v = c.byId("vehicles", o.vehicle_id);
      return [o.order_number, cu?.name, cu?.phone, v?.plate].some(x => String(x ?? "").toLowerCase().includes(q));
    });
    const filter = String(a.p_payment_filter ?? "ALL");
    let rows = list.map(o => saleRow(c, o));
    if (filter === "CASHEA") rows = rows.filter(r => r.payment_type === "CASHEA");
    if (filter === "CONTADO") rows = rows.filter(r => r.payment_type === "CASH");
    if (filter === "CREDIT") rows = rows.filter(r => r.payment_type === "CREDIT");
    rows.sort((x, y) => String(y.sale_at).localeCompare(String(x.sale_at)));
    const closed = rows.filter(r => r.status === "CLOSED");
    const cashea = closed.filter(r => r.cashea);
    const summary = {
      orders: rows.length, closed: closed.length, cashea: cashea.length, sales_ref: r2(closed.reduce((s, r) => s + r.total_ref, 0)),
      collected_ves: r2(closed.reduce((s, r) => s + r.collected_ves, 0)), collected_usd: r2(closed.reduce((s, r) => s + r.collected_usd, 0)),
      cashea_initial_bcv: r2(cashea.reduce((s, r) => s + (r.cashea?.initial_bcv_usd ?? 0), 0)), cashea_initial_ves: r2(cashea.reduce((s, r) => s + (r.cashea?.initial_ves ?? 0), 0)),
      cashea_financed_bcv: r2(cashea.reduce((s, r) => s + (r.cashea?.financed_bcv_usd ?? 0), 0)),
    };
    const page = Number(a.p_page ?? 0);
    return { rows: rows.slice(page * PAGE, page * PAGE + PAGE), count: rows.length, summary };
  },
};

export { previewOf };
