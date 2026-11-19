// Motor de órdenes de la muestra: crear, agregar líneas, ajustes, cobros y cierre.
// Reproduce las reglas de las funciones de la base con los datos en memoria.
import Decimal from "decimal.js";
import { fail, type Ctx } from "../rpc/ctx";
import type { Row } from "../store";
import { stockMap } from "./inventory";
import { DEMO_SETTINGS } from "../rules/settings";

const D = Decimal.clone({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
export const r2 = (n: Decimal.Value) => new D(n).toDecimalPlaces(2).toNumber();
export const r4 = (n: Decimal.Value) => new D(n).toDecimalPlaces(4).toNumber();
export const USD_METHODS = ["CASH_USD", "ZELLE", "BINANCE"];
export const METHOD_LABEL: Record<string, string> = {
  TRANSFER_BDV: "Banco de Venezuela", TRANSFER_BNC: "BNC", CASH_VES: "Efectivo Bs", CASH_USD: "Efectivo $", ZELLE: "Zelle", BINANCE: "Binance",
  PAGO_MOVIL: "Pago móvil", POR_COBRAR: "Por cobrar", CASHEA: "Cashea", CREDIT: "Crédito LC",
};
export const localDay = (iso: unknown) => new Date(Date.parse(String(iso)) - 4 * 3600000).toISOString().slice(0, 10);

export function orderRates(c: Ctx, o: Row) {
  return { bcv: Number(o.sale_bcv_rate ?? c.rates.bcv), operative: Number(o.sale_operative_rate ?? c.rates.operative) };
}

export function createOrder(c: Ctx, opts: { businessAt?: string | null; customerId?: string | null; vehicleId?: string | null } = {}) {
  const seq = Math.max(0, ...c.t("orders").map(o => Number(o.order_seq) || 0)) + 1;
  const now = c.now();
  const order: Row = {
    id: c.id("ord", "orders"), order_seq: seq, order_number: `DEMO-${String(seq).padStart(6, "0")}`, status: "OPEN",
    customer_id: opts.customerId ?? null, vehicle_id: opts.vehicleId ?? null, location_id: "loc-centro",
    total_ves: 0, total_ref: 0, total_cash_usd_equivalent: 0, opened_at: now, closed_at: null, created_by: null, created_at: now,
    health_status: "GREEN", health_notes: null, crm_additional_services: [], crm_bonuses: [], crm_observations: null,
    workflow_status: "RECEIVED", workflow_updated_at: now, health_reviewed_at: null, business_at: opts.businessAt ?? now,
    corrects_order_id: null, cancellation_reason: null, cancelled_at: null, is_walk_in: !opts.customerId,
    sale_bcv_rate: c.rates.bcv, sale_operative_rate: c.rates.operative,
    adjust_discount_percent: 0, adjust_discount_reason: null, adjust_discount_ref: 0, adjust_rounding_mode: "NONE", adjust_rounding_ref: 0,
    adjust_owner_approved: false, attended_by: null, adjust_cash_rounding_ref: 0, price_expected_ref: null, price_reduction_ref: null, price_override_approval_id: null,
  };
  c.insert("orders", order);
  return order;
}

export function openOrder(c: Ctx, id: unknown) {
  const o = c.byId("orders", id) ?? fail("No se encontró la orden.");
  if (o!.status !== "OPEN") fail("La orden ya está cerrada; no se puede modificar.");
  return o!;
}

type LineSpec = {
  type: "PRODUCT" | "SERVICE"; area: string; description: string; qty: number; unitRef: number; inventoryItemId?: string | null;
  role?: string | null; passCost?: number | null; pricingMode?: string; mech?: { ref: number; emp: string; pct: number } | null;
  bonus?: { ref: number; emp: string; pct: number } | null; extra?: Row; denomination?: string;
};

export function addLine(c: Ctx, o: Row, spec: LineSpec) {
  const { bcv, operative } = orderRates(c, o);
  if (!(spec.qty > 0)) fail("La cantidad debe ser mayor que cero.");
  if (spec.unitRef < 0) fail("El precio no puede ser negativo.");
  const inv = spec.inventoryItemId ? c.byId("inventory_items", spec.inventoryItemId) : null;
  const ref = r4(new D(spec.unitRef).mul(spec.qty));
  const cost = inv?.average_cost_ref != null ? r4(new D(inv.average_cost_ref as number).mul(spec.qty)) : 0;
  const line: Row = {
    id: c.id("oi"), order_id: o.id, item_type: spec.type, business_area: spec.area, description: spec.description, product_id: null, quantity: spec.qty,
    pricing_mode: spec.pricingMode ?? (inv ? "STANDARD" : "MANUAL_NO_STOCK"),
    base_ref_amount: ref, customer_ref_amount: ref, charged_ref_amount: ref, charged_ves_amount: r2(new D(ref).mul(bcv)),
    list_ref_amount: ref, list_ves_amount: r2(new D(ref).mul(bcv)), list_unit_ref_snapshot: spec.unitRef, entered_ref_amount: ref,
    cash_usd_unit_snapshot: r2(new D(spec.unitRef).mul(bcv).div(operative)), cash_usd_special_total: null,
    bcv_rate_snapshot: bcv, operative_rate_snapshot: operative, cash_price_revealed: false,
    worker_employee_id: spec.mech?.emp ?? null, worker_share_percent_snapshot: spec.mech?.pct ?? null, worker_share_ref_snapshot: spec.mech?.ref ?? null,
    assistant_bonus_employee_id: spec.bonus?.emp ?? null, assistant_bonus_percent_snapshot: spec.bonus?.pct ?? null, assistant_bonus_ref_snapshot: spec.bonus?.ref ?? null,
    inventory_item_id: inv?.id ?? null, inventory_location_id: inv ? "loc-centro" : null,
    unit_cost_ref_snapshot: inv?.average_cost_ref ?? null, total_cost_ref_snapshot: cost, price_denomination: spec.denomination ?? "REF", agreed_usd: null,
    line_role: spec.role ?? null, pass_through_cost_ref: spec.passCost ?? null, service_vehicle_id: null,
    service_odometer: null, oil_brand: null, oil_viscosity: null, oil_quantity_liters: null, oil_filter_code: null,
    next_service_odometer: null, next_service_date: null, oil_base_type: null, created_at: c.now(), ...(spec.extra ?? {}),
  };
  c.insert("order_items", line);
  recompute(c, o);
  return line;
}

export const linesOf = (c: Ctx, orderId: unknown) => c.t("order_items").filter(i => i.order_id === orderId);
export const paymentsOf = (c: Ctx, orderId: unknown) => c.t("payments").filter(p => p.order_id === orderId && !p.receivable_id);

/** Recalcula el total: primero el descuento (sin tocar el recargo Cashea) y después el redondeo. */
export function recompute(c: Ctx, o: Row) {
  const { bcv, operative } = orderRates(c, o);
  const lines = linesOf(c, o.id);
  const subtotal = lines.reduce((a, l) => a.plus(Number(l.charged_ref_amount)), new D(0));
  const surcharge = lines.filter(l => l.line_role === "CASHEA_SURCHARGE").reduce((a, l) => a.plus(Number(l.charged_ref_amount)), new D(0));
  const pct = Number(o.adjust_discount_percent ?? 0);
  const discount = pct > 0 ? r2(subtotal.minus(surcharge).mul(pct).div(100)) : 0;
  const after = subtotal.minus(discount);
  const mode = String(o.adjust_rounding_mode ?? "NONE");
  const target = mode === "DOWN" ? after.floor() : mode === "UP" ? after.ceil() : mode === "HALF" ? after.mul(2).toDecimalPlaces(0).div(2) : after.toDecimalPlaces(2);
  const cashRound = new D(Number(o.adjust_cash_rounding_ref ?? 0));
  o.adjust_discount_ref = discount;
  o.adjust_rounding_ref = r2(target.minus(after));
  const total = target.plus(cashRound);
  o.total_ref = r2(total);
  o.total_ves = r2(total.mul(bcv));
  o.total_cash_usd_equivalent = r2(total.mul(bcv).div(operative));
  return o;
}

export function paidRef(c: Ctx, o: Row) {
  return paymentsOf(c, o.id).reduce((a, p) => a + Number(p.value_ref), 0);
}

export function addPayment(c: Ctx, o: Row, method: string, amount: number, opts: { reference?: string | null; when?: string; receivableId?: string | null; extra?: Row } = {}) {
  const { bcv, operative } = orderRates(c, o);
  const usd = USD_METHODS.includes(method);
  if (!(amount > 0)) fail("Indica un monto mayor que cero.");
  const valueVes = usd ? r2(new D(amount).mul(operative)) : r2(amount);
  const p: Row = {
    id: c.id("pay"), order_id: o.id, method, currency: usd ? "USD" : "VES", amount_original: amount, bcv_rate_snapshot: bcv, operative_rate_snapshot: operative,
    value_ves: valueVes, value_ref: r4(new D(valueVes).div(bcv)), reference: opts.reference ?? null, paid_at: opts.when ?? c.now(),
    created_by: null, created_at: c.now(), receivable_id: opts.receivableId ?? null, financial_account_id: null, applied_ref: null, applied_usd: null, ...(opts.extra ?? {}),
  };
  c.insert("payments", p);
  return p;
}

/** Monto que falta, en la moneda del método: Bs a BCV; $ divisas a REF × BCV ÷ operativa. */
export function dueIn(c: Ctx, o: Row, method: string) {
  const { bcv, operative } = orderRates(c, o);
  const left = D.max(0, new D(Number(o.total_ref)).minus(paidRef(c, o)));
  return USD_METHODS.includes(method) ? r2(left.mul(bcv).div(operative)) : r2(left.mul(bcv));
}

export function checkStock(c: Ctx, o: Row) {
  const stock = stockMap(c.s);
  const need = new Map<string, number>();
  for (const l of linesOf(c, o.id)) if (l.inventory_item_id) need.set(l.inventory_item_id as string, (need.get(l.inventory_item_id as string) ?? 0) + Number(l.quantity));
  for (const [id, q] of need) if ((stock.get(id) ?? 0) < q) {
    const it = c.byId("inventory_items", id);
    fail(`No hay existencia suficiente de «${it?.description ?? id}»: quedan ${stock.get(id) ?? 0}.`);
  }
}

export function validateLines(c: Ctx, o: Row) {
  if (!linesOf(c, o.id).length) fail("La orden no tiene productos ni servicios.");
}

/** Cierra la orden: descuenta inventario y registra el cambio de aceite para el Seguimiento. */
export function closeOrder(c: Ctx, o: Row, opts: { allowUnpaid?: boolean } = {}) {
  validateLines(c, o);
  checkStock(c, o);
  const left = Number(o.total_ref) - paidRef(c, o);
  if (!opts.allowUnpaid && left > 0.01) fail(`Falta cobrar ${r2(left).toLocaleString("es-VE", { minimumFractionDigits: 2 })} REF para cerrar la orden.`);
  const when = c.now();
  o.status = "CLOSED"; o.closed_at = when; o.workflow_status = "DELIVERED"; o.workflow_updated_at = when;
  if (!o.business_at) o.business_at = when;
  for (const l of linesOf(c, o.id)) if (l.inventory_item_id) c.insert("inventory_movements", {
    id: c.id("mov"), inventory_item_id: l.inventory_item_id, location_id: "loc-centro", quantity_delta: -Number(l.quantity), movement_type: "SALE",
    order_item_id: l.id, note: null, occurred_at: o.business_at, created_by: null, created_at: when, supplier_receipt_item_id: null, reversal_of: null,
  });
  const svc = linesOf(c, o.id).find(l => l.item_type === "SERVICE" && l.business_area === "OIL_CHANGE");
  const vehicleId = (svc?.service_vehicle_id as string) ?? (o.vehicle_id as string);
  if (svc && vehicleId) c.insert("service_records", {
    id: c.id("sr", "service-history"), order_id: o.id, order_item_id: svc.id, customer_id: o.customer_id, vehicle_id: vehicleId, service_type: "OIL_CHANGE",
    description: svc.description, odometer: svc.service_odometer, oil_brand: svc.oil_brand, oil_viscosity: svc.oil_viscosity, oil_quantity_liters: svc.oil_quantity_liters,
    oil_filter_code: svc.oil_filter_code, next_service_odometer: svc.next_service_odometer, next_service_date: svc.next_service_date,
    charged_ref_amount: svc.charged_ref_amount, charged_ves_amount: svc.charged_ves_amount, performed_at: o.business_at, created_by: null, created_at: when,
    source_system: "OS", source_key: null, source_invoice: null, service_notes: null, included_services: o.crm_additional_services ?? [], bonuses: o.crm_bonuses ?? [], source_payload: null, imported_at: null,
  });
  return o;
}

/** Líneas de Venta rápida: STOCK (inventario), CATALOG o MANUAL. El precio se valida contra el inventario. */
export function addQuickLines(c: Ctx, o: Row, items: Row[]) {
  if (!Array.isArray(items) || !items.length) fail("Agrega al menos un producto.");
  for (const it of items) {
    const inv = it.inventory_item_id ? c.byId("inventory_items", it.inventory_item_id) : null;
    if (it.kind === "STOCK" && !inv) fail("Uno de los productos ya no está en el inventario.");
    addLine(c, o, { type: "PRODUCT", area: "STORE", description: String(it.description ?? inv?.description ?? "Producto"), qty: Number(it.quantity), unitRef: Number(it.unit_ref), inventoryItemId: inv?.id as string | undefined, pricingMode: inv ? "STANDARD" : "MANUAL_NO_STOCK" });
  }
}

export const saleResult = (o: Row) => ({ order_id: o.id, order_number: o.order_number, total_ref: o.total_ref, total_ves: o.total_ves });

export function casheaPlanFor(c: Ctx, o: Row, initialPercent: number) {
  const total = Number(o.total_ref);
  if (total < DEMO_SETTINGS.casheaMinimumRef) fail(`Cashea acepta compras desde ${DEMO_SETTINGS.casheaMinimumRef} REF.`);
  const initial = r2(new D(total).mul(initialPercent).div(100));
  const financed = r2(new D(total).minus(initial));
  const each = r2(new D(financed).div(3));
  return { total, initial, financed, each };
}
