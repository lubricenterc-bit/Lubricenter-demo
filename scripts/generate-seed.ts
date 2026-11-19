// Generador de la semilla de la muestra. Todo es inventado y sale de una semilla fija:
// el mismo comando produce siempre el mismo archivo. Nada se copia de producción.
//
// Uso: node scripts/generate-seed.ts
//
// Las fechas se escriben relativas a ANCHOR (un día fijo). Al abrir la muestra,
// lib/demo/seed/materialize.ts las corre para que ANCHOR sea «hoy» en Caracas.
import fs from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";

export const SEED_VERSION = 1;
const ANCHOR = "2026-06-15"; // «hoy» dentro de la semilla
const BCV = 200, OPERATIVE = 250; // tasas de ejemplo, fijas y redondas

// ── Azar determinista ───────────────────────────────────────────────────────
let state = 0x1c0ffee;
function rand() { state |= 0; state = (state + 0x6d2b79f5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const D = Decimal.clone({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
const r2 = (n: Decimal.Value) => new D(n).toDecimalPlaces(2).toNumber();
const r4 = (n: Decimal.Value) => new D(n).toDecimalPlaces(4).toNumber();
const pad = (n: number, w: number) => String(n).padStart(w, "0");

// ── Fechas (zona America/Caracas, UTC−4 sin horario de verano) ──────────────
const anchorMs = Date.parse(`${ANCHOR}T00:00:00-04:00`);
const day = (offset: number) => new Date(anchorMs + offset * 86400000 + 12 * 3600000).toISOString().slice(0, 10);
function at(offset: number, hour = int(8, 17), minute = int(0, 59)) {
  return new Date(anchorMs + offset * 86400000 + (hour * 60 + minute) * 60000).toISOString();
}

// ── Catálogos fijos ─────────────────────────────────────────────────────────
const FIRST = ["Ana", "Luis", "Carla", "José", "María", "Pedro", "Elena", "Andrés", "Lucía", "Jorge", "Sofía", "Miguel", "Valeria", "Rafael", "Daniela", "Gabriel", "Paola", "Héctor", "Irene", "Tomás", "Rosa", "Víctor", "Noelia", "Simón", "Adriana", "Óscar", "Gisela", "Ramón", "Beatriz", "Iván"];
const LAST = ["Almendral", "Robledo", "Saucedo", "Cerezal", "Olivar", "Peñalta", "Valdecasa", "Montemar", "Riofrío", "Arenal", "Fresneda", "Castaño", "Brisas", "Laurel", "Pinar", "Alameda", "Campoverde", "Rocamar", "Viñedo", "Encinar"];
const MAKES: [string, string[]][] = [["Toyota", ["Corolla", "Hilux", "Yaris", "Fortuner"]], ["Chevrolet", ["Aveo", "Optra", "Spark", "Silverado"]], ["Ford", ["Fiesta", "Explorer", "Ranger", "EcoSport"]], ["Hyundai", ["Accent", "Tucson", "Getz"]], ["Kia", ["Rio", "Sportage", "Picanto"]], ["Mitsubishi", ["Lancer", "Montero"]], ["Renault", ["Logan", "Sandero"]], ["Fiat", ["Palio", "Uno"]], ["Jeep", ["Grand Cherokee", "Cherokee"]], ["Chery", ["Tiggo", "Arauca"]]];
const OIL_BRANDS = ["Valvoline", "Motul", "Castrol", "Shell", "Mobil", "Pennzoil", "Total", "Havoline"];
const FILTER_BRANDS = ["Wix", "Bosch", "Mann", "Fram", "Purolator"];
const VISC = ["5W-30", "10W-30", "10W-40", "15W-40", "20W-50", "5W-20"];
const SUPPLIERS = ["Distribuidora Lubrimar", "Filtros del Valle", "Importadora Motorpar", "Comercial Aceites Andinos", "Repuestos La Ruta", "Químicos Automotrices Sol"];

// ── Tablas ──────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const T: Record<string, Row[]> = {};
const add = (table: string, row: Row) => ((T[table] ??= []).push(row), row);

add("locations", { id: "loc-centro", code: "CENTRO", name: "Lubricenter Centro", active: true, created_at: at(-400, 8, 0) });
const EMP_MECH = "emp-mecanico", EMP_TECH = "emp-tecnico";
add("employees", { id: EMP_MECH, code: "MEC", name: "Mecánico de taller", active: true, created_at: at(-400, 8, 0), updated_at: at(-400, 8, 0) });
add("employees", { id: EMP_TECH, code: "TEC", name: "Técnico de electroauto", active: true, created_at: at(-400, 8, 0), updated_at: at(-400, 8, 0) });
for (const [rid, emp, type, value] of [["cr-1", EMP_MECH, "WORKSHOP_SHARE", 40], ["cr-2", EMP_TECH, "ELECTROAUTO_SHARE", 40], ["cr-3", EMP_TECH, "ASSISTANT_BONUS", 5]] as const)
  add("compensation_rules", { id: rid, employee_id: emp, rule_type: type, value, valid_from: day(-400), valid_to: null, note: null, created_at: at(-400, 8, 0) });
for (const [type, value] of [["BCV", BCV], ["OPERATIVE", OPERATIVE]] as const)
  add("exchange_rates", { id: `rate-${type.toLowerCase()}`, rate_type: type, value, effective_at: at(-120, 8, 0), source: "EJEMPLO", created_by: null, created_at: at(-120, 8, 0) });

const settings: Record<string, unknown> = {
  cashea_commission_percent: 4, cashea_financing_days: 45, cashea_minimum_ref: 25, cashea_opportunity_monthly_percent: 5,
  catalog_authority: "OS", crm_consent_mode: "IMPLIED", crm_daily_cap: 15, crm_post_service_valid_days: 3, crm_second_chance_days: 30,
  discount_free_limit_percent: 10, exchange_rate_authority: "MANUAL", inventory_strict_mode: true,
  oil_change_default_km: 5000, oil_change_default_months: 3, oil_labor_free_threshold_percent: 85,
  price_rounding_mode: "NONE", price_rounding_step: 0, store_markup_percent: 35,
  receipt_header: { branch: "Centro", address: "Av. Principal, local 1", whatsapp: "0414-000-0000", instagram: "@lubricenter.ejemplo", footer: "Nota de entrega · Documento no fiscal" },
  receipt_total_style: "BLOCK",
};
for (const [key, value] of Object.entries(settings)) add("app_settings", { key, value, updated_at: at(-90, 9, 0) });

// Inventario
type Item = Row & { id: string; price_ref: number | null; cost: number | null; stock: number; category: string; unit: string; brand: string; viscosity?: string };
const items: Item[] = [];
function item(category: string, brand: string, description: string, unit: string, priceRef: number | null, opts: { cost?: number | null; stock?: number; viscosity?: string; sku?: string } = {}) {
  const n = items.length + 1;
  const cost = opts.cost === undefined ? (priceRef ? r2(new D(priceRef).div(1.3 + rand() * 0.25)) : null) : opts.cost;
  const it: Item = { id: `itm-${pad(n, 3)}`, sku: opts.sku ?? `${category.slice(0, 3).toUpperCase()}-${pad(n, 4)}`, brand, description, category, unit, price_ref: priceRef, cost, stock: opts.stock ?? int(4, 40), viscosity: opts.viscosity };
  items.push(it);
  return it;
}
for (const b of OIL_BRANDS) for (const v of pick([VISC.slice(0, 3), VISC.slice(2, 5), VISC.slice(3)])) {
  const premium = ["Motul", "Castrol", "Mobil"].includes(b);
  item("Aceite Motor", b, `Aceite ${b} ${v} ${v.startsWith("5") ? "sintético" : "semisintético"} 1 L`, "UND", r2((premium ? 9 : 7) + rand() * 3), { viscosity: v });
  if (chance(0.45)) item("Aceite Motor", b, `Aceite ${b} ${v} galón 4 L`, "GAL", r2((premium ? 32 : 26) + rand() * 8), { viscosity: v, stock: int(2, 15) });
}
for (const b of FILTER_BRANDS) for (let k = 0; k < 7; k++) item("Filtro Aceite", b, `Filtro de aceite ${b} ${pick(["WL", "PH", "OC", "W"])}${int(7000, 7999)}`, "UND", r2(5 + rand() * 6));
for (const b of FILTER_BRANDS) for (let k = 0; k < 3; k++) item("Filtro Aire", b, `Filtro de aire ${b} ${pick(["CA", "AF", "C"])}${int(1000, 9999)}`, "UND", r2(8 + rand() * 8));
for (const b of FILTER_BRANDS.slice(0, 3)) item("Filtro Gasolina", b, `Filtro de gasolina ${b} G${int(100, 999)}`, "UND", r2(6 + rand() * 5));
for (const b of FILTER_BRANDS.slice(0, 3)) item("Filtro Cabina", b, `Filtro de cabina ${b} CF${int(100, 999)}`, "UND", r2(9 + rand() * 5));
for (const b of ["Prestone", "Valvoline", "Shell"]) { item("Refrigerante", b, `Refrigerante ${b} verde 1 galón`, "GAL", r2(12 + rand() * 4)); item("Refrigerante", b, `Refrigerante ${b} rojo 1 L`, "UND", r2(4 + rand() * 2)); }
for (const [b, d] of [["STP", "Limpiador de inyectores 354 ml"], ["Bardahl", "Aditivo para aceite 443 ml"], ["STP", "Tratamiento de aceite 428 ml"], ["Bardahl", "Limpiador de carburador 400 ml"], ["Wynn's", "Limpia frenos 500 ml"], ["Simoniz", "Champú para carros 1 L"], ["Armor All", "Protector de tablero 300 ml"]] as const) item("Limpiadores", b, d, "UND", r2(5 + rand() * 6));
for (const b of ["Valvoline", "Castrol"]) item("Aceite Hidraulico", b, `Aceite hidráulico ${b} ATF 1 L`, "UND", r2(7 + rand() * 3));
for (const b of ["Motul", "Castrol"]) item("Aceite Motos", b, `Aceite ${b} 20W-50 4T 1 L`, "UND", r2(6 + rand() * 3));
for (const b of ["Valvoline", "Shell"]) item("Valvulina", b, `Valvulina ${b} 80W-90 1 L`, "UND", r2(7 + rand() * 3));
for (const [d, p] of [["Liga de frenos DOT 4 350 ml", 4.5], ["Agua desmineralizada 1 galón", 2.5], ["Bombillo H4 12 V", 3.8], ["Escobilla limpiaparabrisas 20\"", 6.5]] as const) item("Otros", pick(["Bosch", "Wagner", "Genérico"]), d, "UND", p);
// Casos visibles: un artículo agotado, uno sin precio y algunos sin costo real (ganancia «costo estimado»).
const outOfStock = item("Aceite Motor", "Motul", "Aceite Motul 0W-20 sintético 1 L", "UND", 13.5, { stock: 0, viscosity: "0W-20" });
const noPrice = item("Otros", "Genérico", "Ambientador de vainilla", "UND", null, { cost: 1.2, stock: 12 });
for (const it of items) if (it !== noPrice && it.category !== "Aceite Motor" && chance(0.15)) it.cost = null;

// Proveedores y sus marcas
const suppliers = SUPPLIERS.map((name, i) => add("suppliers", {
  id: `sup-${pad(i + 1, 2)}`, name, legal_name: `${name} C.A.`, rif: `J-DEMO-${pad(i + 1, 3)}`, phone: `0414-000-1${pad(i + 1, 3)}`,
  email: `ventas${i + 1}@ejemplo.com`, address: "Zona industrial, galpón " + (i + 1), contact_name: pick(FIRST) + " " + pick(LAST),
  bank_details: null, default_currency: i % 2 ? "VES" : "USD", payment_terms_days: pick([0, 7, 15, 30]), notes: null, active: true,
  created_by: null, created_at: at(-380, 9, 0), updated_at: at(-380, 9, 0),
}));
const brandSupplier = (brand: string) => suppliers[[...brand].reduce((a, c) => a + c.charCodeAt(0), 0) % suppliers.length].id as string;
for (const b of new Set(items.map(i => i.brand))) add("supplier_brands", { supplier_id: brandSupplier(b), brand_key: b.toLowerCase(), created_at: at(-380, 9, 0) });

// Clientes y vehículos
const customers = Array.from({ length: 40 }, (_, i) => add("customers", {
  id: `cus-${pad(i + 1, 3)}`, name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
  phone: i % 13 === 12 ? null : `0414-000-0${pad(i + 1, 3)}`, document_id: `V-DEMO-${pad(i + 1, 4)}`,
  created_at: at(-int(100, 420), 10, 0), updated_at: at(-int(0, 90), 10, 0),
}));
const plateLetters = "BCDFGHJKLMNPRSTVWXYZ";
const vehicles = Array.from({ length: 55 }, (_, i) => {
  const [make, models] = MAKES[i % MAKES.length];
  const plate = `ZX${pad(100 + i * 7 % 900, 3)}${plateLetters[i % 20]}${plateLetters[(i * 3) % 20]}`;
  return add("vehicles", {
    id: `veh-${pad(i + 1, 3)}`, customer_id: customers[i < 40 ? i : int(0, 39)].id, plate, make, model: pick(models),
    year: int(2006, 2023), engine: pick(["1.6", "1.8", "2.0", "2.4", "4.0"]), current_odometer: int(40, 220) * 1000,
    created_at: at(-int(100, 420), 10, 0), updated_at: at(-int(0, 90), 10, 0),
  });
});
for (const v of vehicles) add("vehicle_customer_history", { id: `vch-${(v.id as string).slice(4)}`, vehicle_id: v.id, customer_id: v.customer_id, source_system: "OS", first_seen_at: v.created_at, last_seen_at: v.updated_at, created_at: v.created_at });

// Movimientos de inventario: apertura (se ajusta al final para cuadrar con la existencia)
const stockDelta = new Map<string, number>();
const move = (it: Item, delta: number, type: string, when: string, extra: Row = {}) => {
  stockDelta.set(it.id, (stockDelta.get(it.id) ?? 0) + delta);
  return add("inventory_movements", { id: `mov-${pad((T.inventory_movements?.length ?? 0) + 1, 5)}`, inventory_item_id: it.id, location_id: "loc-centro", quantity_delta: delta, movement_type: type, order_item_id: null, note: null, occurred_at: when, created_by: null, created_at: when, supplier_receipt_item_id: null, reversal_of: null, ...extra });
};

// ── Órdenes ─────────────────────────────────────────────────────────────────
let orderSeq = 0, itemSeq = 0, paySeq = 0;
const orders: Row[] = [];
type Line = Row & { charged_ref_amount: number };

function lineFor(orderId: string, o: { type: "PRODUCT" | "SERVICE"; area: string; description: string; qty: number; unitRef: number; it?: Item; role?: string | null; passCost?: number; mech?: { ref: number; emp: string; pct: number }; bonus?: { ref: number; emp: string; pct: number }; oil?: Row; vehicleId?: string | null }): Line {
  const ref = r4(new D(o.unitRef).mul(o.qty));
  const cost = o.it?.cost != null ? r4(new D(o.it.cost).mul(o.qty)) : 0;
  const line: Line = {
    id: `oi-${pad(++itemSeq, 5)}`, order_id: orderId, item_type: o.type, business_area: o.area, description: o.description,
    product_id: null, quantity: o.qty, pricing_mode: o.it ? "STANDARD" : "MANUAL_NO_STOCK",
    base_ref_amount: ref, customer_ref_amount: ref, charged_ref_amount: ref, charged_ves_amount: r2(new D(ref).mul(BCV)),
    list_ref_amount: ref, list_ves_amount: r2(new D(ref).mul(BCV)), list_unit_ref_snapshot: o.unitRef, entered_ref_amount: ref,
    cash_usd_unit_snapshot: r2(new D(o.unitRef).mul(BCV).div(OPERATIVE)), cash_usd_special_total: null,
    bcv_rate_snapshot: BCV, operative_rate_snapshot: OPERATIVE, cash_price_revealed: false,
    worker_employee_id: o.mech?.emp ?? null, worker_share_percent_snapshot: o.mech?.pct ?? null, worker_share_ref_snapshot: o.mech?.ref ?? null,
    assistant_bonus_employee_id: o.bonus?.emp ?? null, assistant_bonus_percent_snapshot: o.bonus?.pct ?? null, assistant_bonus_ref_snapshot: o.bonus?.ref ?? null,
    inventory_item_id: o.it?.id ?? null, inventory_location_id: o.it ? "loc-centro" : null,
    unit_cost_ref_snapshot: o.it?.cost ?? null, total_cost_ref_snapshot: cost, price_denomination: "REF", agreed_usd: null,
    line_role: o.role ?? null, pass_through_cost_ref: o.passCost ?? null, service_vehicle_id: o.vehicleId ?? null,
    service_odometer: null, oil_brand: null, oil_viscosity: null, oil_quantity_liters: null, oil_filter_code: null,
    next_service_odometer: null, next_service_date: null, oil_base_type: null, created_at: null,
    ...(o.oil ?? {}),
  };
  return line;
}

const stockItems = (cat: string) => items.filter(i => i.category === cat && i.price_ref != null && i !== outOfStock);
type Kind = "STORE" | "OIL" | "OIL_PAID" | "OIL_CUSTOMER" | "WORKSHOP" | "ELECTRO" | "MIXED" | "LITERS";
type PayPlan = "CASH_USD" | "CASH_VES" | "BDV" | "BNC" | "ZELLE" | "BINANCE" | "MIXED" | "CASHEA" | "CREDIT" | "CREDIT_PARTIAL" | "CHANGE_USD" | "CHANGE_VES";

function makeOrder(offset: number, kind: Kind, pay: PayPlan, opts: { customer?: Row | null; vehicle?: Row | null; discount?: number; rounding?: "DOWN" | "HALF" | "UP"; status?: "CLOSED" | "OPEN" | "CANCELLED"; passThrough?: boolean; ownerApproved?: boolean; workflow?: string } = {}) {
  const id = `ord-${pad(++orderSeq, 4)}`;
  const opened = at(offset);
  const vehicle = opts.vehicle === undefined ? (["STORE", "LITERS"].includes(kind) && chance(0.6) ? null : pick(vehicles.slice(0, 27))) : opts.vehicle;
  const customer = opts.customer === undefined ? (vehicle ? customers.find(c => c.id === vehicle.customer_id)! : chance(0.5) ? pick(customers) : null) : opts.customer;
  const lines: Line[] = [];
  const vId = (vehicle?.id as string) ?? null;
  const addStore = (n: number) => { for (let k = 0; k < n; k++) { const it = pick([...stockItems("Limpiadores"), ...stockItems("Refrigerante"), ...stockItems("Filtro Aire"), ...stockItems("Otros")]); lines.push(lineFor(id, { type: "PRODUCT", area: "STORE", description: it.description as string, qty: int(1, 2), unitRef: it.price_ref!, it })); } };
  const addOil = (labor: "FREE" | "PAID" | "CUSTOMER") => {
    const oil = pick(stockItems("Aceite Motor").filter(i => i.unit === "UND"));
    const filter = pick(stockItems("Filtro Aceite"));
    const liters = int(4, 6);
    if (labor !== "CUSTOMER") lines.push(lineFor(id, { type: "PRODUCT", area: "OIL_CHANGE", description: oil.description as string, qty: liters, unitRef: oil.price_ref!, it: oil, vehicleId: vId }));
    if (labor !== "PAID" || chance(0.3)) lines.push(lineFor(id, { type: "PRODUCT", area: "OIL_CHANGE", description: filter.description as string, qty: 1, unitRef: filter.price_ref!, it: filter, vehicleId: vId }));
    const laborRef = labor === "FREE" ? 0 : pick([5, 6, 8]);
    const odo = ((vehicle?.current_odometer as number) ?? 100000) - int(0, 3000);
    lines.push(lineFor(id, { type: "SERVICE", area: "OIL_CHANGE", description: labor === "CUSTOMER" ? "Cambio de aceite · aceite del cliente" : "Cambio de aceite", qty: 1, unitRef: laborRef, vehicleId: vId,
      oil: { service_odometer: odo, oil_brand: labor === "CUSTOMER" ? "Aceite traído por el cliente" : oil.brand, oil_viscosity: oil.viscosity ?? null, oil_quantity_liters: liters, oil_filter_code: filter.sku, next_service_odometer: odo + 5000, next_service_date: day(offset + 90) } }));
  };
  const addWorkshop = (area: "WORKSHOP" | "ELECTROAUTO") => {
    const desc = area === "WORKSHOP" ? pick(["Cambio de pastillas de freno", "Cambio de amortiguadores delanteros", "Cambio de correa de tiempo", "Revisión de tren delantero", "Cambio de bomba de agua"]) : pick(["Revisión de sistema eléctrico", "Cambio de alternador", "Reparación de arranque", "Instalación de luces", "Diagnóstico con escáner"]);
    const ref = pick([20, 25, 30, 40, 45, 60, 80]);
    const mech = r2(new D(ref).mul(40).div(100));
    const bonus = area === "WORKSHOP" && chance(0.7) ? { ref: r2(new D(ref).mul(5).div(100)), emp: EMP_TECH, pct: 5 } : undefined;
    lines.push(lineFor(id, { type: "SERVICE", area, description: desc, qty: 1, unitRef: ref, vehicleId: vId, mech: { ref: mech, emp: area === "WORKSHOP" ? EMP_MECH : EMP_TECH, pct: 40 }, bonus }));
    if (opts.passThrough) { const cost = pick([18, 20, 35]); const pct = pick([0, 10, 20]); lines.push(lineFor(id, { type: "PRODUCT", area, description: `Compra para el trabajo: ${pick(["kit de pastillas", "correa", "rolinera", "relé"])}${pct ? ` (+${pct} %)` : " (al costo)"}`, qty: 1, unitRef: r2(new D(cost).mul(1 + pct / 100)), role: "PASS_THROUGH", passCost: cost })); }
  };
  if (kind === "STORE") addStore(int(1, 3));
  if (kind === "OIL") addOil("FREE");
  if (kind === "OIL_PAID") addOil("PAID");
  if (kind === "OIL_CUSTOMER") addOil("CUSTOMER");
  if (kind === "WORKSHOP") addWorkshop("WORKSHOP");
  if (kind === "ELECTRO") addWorkshop("ELECTROAUTO");
  if (kind === "MIXED") { addOil("FREE"); addWorkshop(pick(["WORKSHOP", "ELECTROAUTO"] as const)); if (chance(0.5)) addStore(1); }
  if (kind === "LITERS") { const oil = pick(stockItems("Aceite Motor").filter(i => i.unit === "UND")); lines.push(lineFor(id, { type: "PRODUCT", area: "STORE", description: oil.description as string, qty: int(1, 2), unitRef: oil.price_ref!, it: oil })); }

  // Cashea acepta compras desde 25 REF: se completa con productos de tienda.
  while (pay === "CASHEA" && lines.reduce((a, l) => a + l.charged_ref_amount, 0) < 25) addStore(1);
  // Cashea: recargo solo sobre la mano de obra de taller y electroauto.
  if (pay === "CASHEA") {
    const labor = lines.filter(l => l.item_type === "SERVICE" && ["WORKSHOP", "ELECTROAUTO"].includes(l.business_area as string)).reduce((a, l) => a.plus(l.charged_ref_amount), new D(0));
    if (labor.gt(0)) { const pct = new D(1).div(new D(1).minus(0.04).minus(new D(0.6).mul(0.05).mul(1.5))).minus(1); lines.push(lineFor(id, { type: "PRODUCT", area: "STORE", description: "Recargo por pago con Cashea", qty: 1, unitRef: r2(labor.mul(pct)), role: "CASHEA_SURCHARGE" })); }
  }
  for (const l of lines) l.created_at = opened;
  const subtotal = lines.reduce((a, l) => a.plus(l.charged_ref_amount), new D(0));
  const surcharge = lines.filter(l => l.line_role === "CASHEA_SURCHARGE").reduce((a, l) => a.plus(l.charged_ref_amount), new D(0));
  const discountPct = opts.discount ?? 0;
  const discount = discountPct ? r2(subtotal.minus(surcharge).mul(discountPct).div(100)) : 0;
  const after = subtotal.minus(discount);
  const mode = opts.rounding ?? "NONE";
  const target = mode === "DOWN" ? after.floor() : mode === "UP" ? after.ceil() : mode === "HALF" ? after.mul(2).toDecimalPlaces(0).div(2) : after.toDecimalPlaces(2);
  const rounding = r2(target.minus(after));
  const totalRef = r2(target);
  const status = opts.status ?? "CLOSED";
  const closed = status === "CLOSED" ? at(offset, Math.min(18, new Date(opened).getUTCHours() - 4 + 1)) : null;
  const order = add("orders", {
    id, order_seq: orderSeq, order_number: `DEMO-${pad(orderSeq, 6)}`, status, customer_id: customer?.id ?? null, vehicle_id: vehicle?.id ?? null,
    location_id: "loc-centro", total_ves: r2(new D(totalRef).mul(BCV)), total_ref: totalRef, total_cash_usd_equivalent: r2(new D(totalRef).mul(BCV).div(OPERATIVE)),
    opened_at: opened, closed_at: closed, created_by: null, created_at: opened, health_status: "GREEN", health_notes: null,
    crm_additional_services: [], crm_bonuses: [], crm_observations: null, workflow_status: opts.workflow ?? (status === "CLOSED" ? "DELIVERED" : "RECEIVED"), workflow_updated_at: closed ?? opened,
    health_reviewed_at: null, business_at: closed ?? opened, corrects_order_id: null, cancellation_reason: status === "CANCELLED" ? "El cliente desistió de la compra" : null,
    cancelled_at: status === "CANCELLED" ? at(offset, 17) : null, is_walk_in: !customer, sale_bcv_rate: BCV, sale_operative_rate: OPERATIVE,
    adjust_discount_percent: discountPct, adjust_discount_reason: discountPct ? pick(["Cliente frecuente", "Compensación"]) : null, adjust_discount_ref: discount,
    adjust_rounding_mode: mode, adjust_rounding_ref: rounding, adjust_owner_approved: opts.ownerApproved ?? false, attended_by: pick(["Dueño", "Administración", "Recepción"]),
    adjust_cash_rounding_ref: 0, price_expected_ref: null, price_reduction_ref: null, price_override_approval_id: null,
  });
  for (const l of lines) {
    add("order_items", l);
    if (status === "CLOSED" && l.inventory_item_id) {
      const it = items.find(i => i.id === l.inventory_item_id)!;
      move(it, -(l.quantity as number), "SALE", closed!, { order_item_id: l.id });
    }
  }
  if (status === "CLOSED" && lines.some(l => l.item_type === "SERVICE" && l.business_area === "OIL_CHANGE") && vehicle) {
    const s = lines.find(l => l.item_type === "SERVICE" && l.business_area === "OIL_CHANGE")!;
    add("service_records", { id: `sr-${pad((T.service_records?.length ?? 0) + 1, 4)}`, order_id: id, order_item_id: s.id, customer_id: customer?.id ?? null, vehicle_id: vehicle.id, service_type: "OIL_CHANGE", description: s.description,
      odometer: s.service_odometer, oil_brand: s.oil_brand, oil_viscosity: s.oil_viscosity, oil_quantity_liters: s.oil_quantity_liters, oil_filter_code: s.oil_filter_code,
      next_service_odometer: s.next_service_odometer, next_service_date: s.next_service_date, charged_ref_amount: s.charged_ref_amount, charged_ves_amount: s.charged_ves_amount,
      performed_at: closed, created_by: null, created_at: closed, source_system: "OS", source_key: null, source_invoice: null, service_notes: null, included_services: [], bonuses: [], source_payload: null, imported_at: null });
  }
  if (status === "CLOSED") payOrder(order, pay, offset);
  orders.push(order);
  return order;
}

function payment(order: Row, method: string, currency: "USD" | "VES", amount: number, when: string, extra: Row = {}) {
  const valueVes = currency === "USD" ? r2(new D(amount).mul(OPERATIVE)) : r2(amount);
  return add("payments", { id: `pay-${pad(++paySeq, 5)}`, order_id: order.id, method, currency, amount_original: amount, bcv_rate_snapshot: BCV, operative_rate_snapshot: OPERATIVE,
    value_ves: valueVes, value_ref: r4(new D(valueVes).div(BCV)), reference: ["TRANSFER_BDV", "TRANSFER_BNC"].includes(method) ? pad(int(1000, 9999), 4) : method === "ZELLE" || method === "BINANCE" ? `EJ-${int(10000, 99999)}` : null,
    paid_at: when, created_by: null, created_at: when, receivable_id: null, financial_account_id: null, applied_ref: null, applied_usd: null, ...extra });
}
const usd = (ref: number) => r2(new D(ref).mul(BCV).div(OPERATIVE));
const ves = (ref: number) => r2(new D(ref).mul(BCV));

function payOrder(order: Row, plan: PayPlan, offset: number) {
  const ref = order.total_ref as number, when = order.closed_at as string;
  const simple: Record<string, [string, "USD" | "VES"]> = { CASH_USD: ["CASH_USD", "USD"], CASH_VES: ["CASH_VES", "VES"], BDV: ["TRANSFER_BDV", "VES"], BNC: ["TRANSFER_BNC", "VES"], ZELLE: ["ZELLE", "USD"], BINANCE: ["BINANCE", "USD"] };
  if (simple[plan]) { const [m, c] = simple[plan]; payment(order, m, c, c === "USD" ? usd(ref) : ves(ref), when); return; }
  if (plan === "MIXED") { const part = r2(new D(ref).mul(0.5)); payment(order, "TRANSFER_BDV", "VES", ves(part), when); payment(order, "CASH_USD", "USD", usd(r2(new D(ref).minus(part))), when); return; }
  if (plan === "CHANGE_USD" || plan === "CHANGE_VES") {
    const due = plan === "CHANGE_USD" ? usd(ref) : ves(ref);
    const received = plan === "CHANGE_USD" ? Math.ceil(due / 10) * 10 + (due % 10 === 0 ? 10 : 0) : Math.ceil(due / 1000) * 1000 + 1000;
    const p = payment(order, plan === "CHANGE_USD" ? "CASH_USD" : "CASH_VES", plan === "CHANGE_USD" ? "USD" : "VES", due, when);
    const extra = new D(received).minus(due);
    const changeUsd = plan === "CHANGE_USD" ? r2(extra) : r2(extra.div(OPERATIVE));
    add("order_tenders", { id: `ten-${pad((T.order_tenders?.length ?? 0) + 1, 4)}`, order_id: order.id, payment_id: p.id, customer_id: order.customer_id, customer_label: null, method: p.method, currency: p.currency,
      received, applied: due, payment_rate: plan === "CHANGE_USD" ? OPERATIVE : 1, change_usd: changeUsd, returned_usd: changeUsd, change_rate: OPERATIVE,
      rounding_ves: plan === "CHANGE_VES" ? r2(extra.minus(new D(changeUsd).mul(OPERATIVE))) : 0, request_payload: { confirmed_counted: true }, created_at: when, created_by: null });
    return;
  }
  if (plan === "CASHEA") { casheaSale(order, offset); return; }
  if (plan === "CREDIT" || plan === "CREDIT_PARTIAL") {
    const paidNow = plan === "CREDIT_PARTIAL" ? r2(new D(ref).mul(0.4)) : 0;
    if (paidNow) payment(order, "TRANSFER_BNC", "VES", ves(paidNow), when);
    const debtRef = r2(new D(ref).minus(paidNow));
    add("receivables", { id: `rcv-${pad((T.receivables?.length ?? 0) + 1, 3)}`, order_id: order.id, debtor_type: "CUSTOMER", customer_id: order.customer_id, principal_ves: ves(debtRef), principal_ref: debtRef,
      outstanding_ves: ves(debtRef), status: "OPEN", due_date: day(offset + 15), created_at: when, closed_at: null, principal_usd: usd(debtRef), outstanding_fraction: 1 });
  }
}

let casheaSeq = 0;
function casheaSale(order: Row, offset: number) {
  const ref = order.total_ref as number, when = order.closed_at as string;
  const initial = r2(new D(ref).mul(0.4)), financed = r2(new D(ref).minus(initial)), each = r2(new D(financed).div(3));
  const id = `csh-${pad(++casheaSeq, 3)}`;
  payment(order, pick(["TRANSFER_BDV", "TRANSFER_BNC"]), "VES", ves(initial), when);
  let paidCount = 0;
  const insts = [1, 2, 3].map(no => {
    const amount = no === 3 ? r2(new D(financed).minus(new D(each).mul(2))) : each;
    const due = offset + no * 14;
    // Cuotas vencidas: casi todas pagadas y verificadas; algunas quedan por confirmar o vencidas.
    const roll = rand();
    const status = due > 0 ? "PENDING" : roll < 0.8 ? "PAID" : "PENDING";
    if (status === "PAID") paidCount++;
    return add("cashea_installments", { id: `${id}-c${no}`, cashea_sale_id: id, installment_no: no, due_date: day(due), amount_ref: amount, amount_ves_snapshot: ves(amount),
      paid_ref: status === "PAID" ? amount : 0, paid_ves_actual: status === "PAID" ? ves(amount) : null, status, paid_at: status === "PAID" ? at(Math.min(due, 0), 11) : null, updated_at: at(Math.min(due, 0), 11),
      verified_rule: status === "PAID" ? pick(["A", "B"]) : null });
  });
  add("cashea_sales", { id, order_id: order.id, receivable_id: null, status: paidCount === 3 ? "SETTLED" : "ACTIVE", initial_percent: 40, commission_percent: 4,
    gross_ref: ref, gross_ves_snapshot: ves(ref), initial_ref: initial, initial_ves_snapshot: ves(initial), financed_ref: financed, commission_ref: r2(new D(ref).mul(0.04)),
    commission_ves_snapshot: ves(r2(new D(ref).mul(0.04))), bcv_rate_snapshot: BCV, initial_payment_method: "TRANSFER_BDV", cashea_reference: String(9100000 + casheaSeq * 37),
    created_at: when, settled_at: paidCount === 3 ? insts[2].paid_at : null, created_by: null, ownership_status: "OWN", ownership_reason: null, ownership_evidence: null });
}

// Casos fijos que deben existir (sección 5 del encargo)
const fixed = (o: Row, note: string) => (o.demo_case = note, o);
fixed(makeOrder(-1, "STORE", "CHANGE_USD"), "Venta en efectivo con vuelto en dólares");
fixed(makeOrder(-2, "STORE", "CHANGE_VES"), "Pago en bolívares con vuelto en dólares");
fixed(makeOrder(-3, "OIL", "MIXED"), "Pago mixto: Banco de Venezuela y efectivo en dólares");
fixed(makeOrder(-50, "WORKSHOP", "CASHEA"), "Cashea con cuota vencida");
fixed(makeOrder(-60, "MIXED", "CASHEA"), "Cashea con cuotas verificadas con el banco");
fixed(makeOrder(-20, "STORE", "CREDIT_PARTIAL"), "Crédito LC con abono");
fixed(makeOrder(-6, "MIXED", "BNC", { discount: 15, ownerApproved: true }), "Descuento de 15 % aprobado con PIN");
fixed(makeOrder(-7, "STORE", "CASH_USD", { rounding: "DOWN" }), "Redondeo del total hacia abajo");
fixed(makeOrder(-8, "OIL", "BDV", { rounding: "HALF" }), "Cambio de aceite con mano de obra gratis (85 %)");
fixed(makeOrder(-9, "OIL_PAID", "BDV"), "Cambio de aceite con mano de obra cobrada");
fixed(makeOrder(-10, "OIL_CUSTOMER", "CASH_VES"), "El cliente trae el aceite: se cobra la mano de obra");
fixed(makeOrder(-11, "WORKSHOP", "ZELLE", { passThrough: true }), "Compra para el trabajo con recargo");
fixed(makeOrder(-12, "LITERS", "BINANCE"), "Litros sueltos: no pide placa");
fixed(makeOrder(-40, "STORE", "CASH_VES", { status: "CANCELLED" }), "Orden anulada");
// Abierta hoy en el taller y otra esperando repuesto.
fixed(makeOrder(0, "WORKSHOP", "BDV", { status: "OPEN", workflow: "IN_PROGRESS" }), "Orden abierta en el taller");
fixed(makeOrder(0, "OIL", "BDV", { status: "OPEN" }), "Cambio de aceite en curso");

// Ventas de hoy temprano, para que Inicio tenga cifras del día.
for (const [k, pay] of (["BDV", "CASH_USD", "BNC", "ZELLE"] as PayPlan[]).entries()) {
  const o = makeOrder(0, pick(["STORE", "OIL", "LITERS"] as Kind[]), pay);
  const t = at(0, 8, 5 + k * 12);
  o.opened_at = o.created_at = o.closed_at = o.business_at = o.workflow_updated_at = t;
  for (const p of (T.payments ?? []).filter(p => p.order_id === o.id)) p.paid_at = p.created_at = t;
  for (const m of (T.inventory_movements ?? []).filter(m => (T.order_items ?? []).some(i => i.id === m.order_item_id && i.order_id === o.id))) m.occurred_at = m.created_at = t;
  for (const sr of (T.service_records ?? []).filter(r => r.order_id === o.id)) sr.performed_at = sr.created_at = t;
}

// Volumen: ~200 órdenes en 90 días
const KINDS: Kind[] = ["STORE", "STORE", "STORE", "OIL", "OIL", "OIL", "OIL_PAID", "WORKSHOP", "ELECTRO", "MIXED", "LITERS"];
const PAYS: PayPlan[] = ["BDV", "BDV", "BNC", "BNC", "CASH_VES", "CASH_USD", "ZELLE", "BINANCE", "MIXED", "CHANGE_USD"];
while (orders.length < 196) {
  const offset = -int(1, 89);
  const kind = pick(KINDS);
  const pay: PayPlan = chance(0.11) && !["LITERS", "STORE"].includes(kind) ? "CASHEA" : chance(0.04) ? "CREDIT" : pick(PAYS);
  const o = makeOrder(offset, kind, pay, { discount: chance(0.06) ? pick([5, 8, 10]) : 0, rounding: chance(0.12) ? pick(["DOWN", "HALF", "UP"] as const) : undefined });
}

// Deudas: algunas abonadas, una pagada
for (const r of (T.receivables ?? []).filter(r => r.debtor_type === "CUSTOMER")) {
  if (chance(0.4)) {
    const part = r2(new D(r.principal_ref as number).mul(0.5));
    const p = payment(orders.find(o => o.id === r.order_id)!, "TRANSFER_BDV", "VES", ves(part), at(-int(1, 5), 10), { receivable_id: r.id, applied_ref: part, applied_usd: usd(part) });
    r.outstanding_fraction = 0.5; r.outstanding_ves = ves(r2(new D(r.principal_ref as number).minus(part)));
    void p;
  }
}

// Historial de cambios de aceite anterior a los 90 días, para llenar todos los tramos de Seguimiento.
// Un vehículo por fecha: el próximo cambio vence a los 90 días del último.
const TRAMOS = [-80, -86, -95, -100, -110, -120, -130, -150, -165, -175, -200, -215, -230, -260, -280, -300, -330, -350, -380, -400, -430, -455, -480, -500, -520, -540, -560, -600];
for (const [i, offset] of TRAMOS.entries()) {
  const k = 0;
  const v = vehicles[27 + i];
  const when = at(offset, 10);
  const odo = (v.current_odometer as number) - int(5000, 15000);
  add("service_records", { id: `sr-${pad((T.service_records?.length ?? 0) + 1, 4)}`, order_id: null, order_item_id: null, customer_id: v.customer_id, vehicle_id: v.id, service_type: "OIL_CHANGE", description: "Cambio de aceite",
    odometer: odo, oil_brand: pick(OIL_BRANDS), oil_viscosity: pick(VISC), oil_quantity_liters: 4, oil_filter_code: null, next_service_odometer: odo + 5000, next_service_date: day(offset - k * 3 + 90),
    charged_ref_amount: null, charged_ves_amount: null, performed_at: when, created_by: null, created_at: when, source_system: "HISTORICO", source_key: null, source_invoice: null, service_notes: null, included_services: [], bonuses: [], source_payload: null, imported_at: when });
}

// Seguimiento: mensajes enviados, respuestas y una cita para hoy.
const lastByVehicle = new Map<string, Row>();
for (const s of T.service_records ?? []) { const prev = lastByVehicle.get(s.vehicle_id as string); if (!prev || (s.performed_at as string) > (prev.performed_at as string)) lastByVehicle.set(s.vehicle_id as string, s); }
let fu = 0;
for (const s of [...lastByVehicle.values()].filter(s => (s.next_service_date as string) < day(0)).slice(0, 20)) {
  const sentDay = int(-25, -2);
  add("customer_followups", { id: `fu-${pad(++fu, 3)}`, service_record_id: s.id, vehicle_id: s.vehicle_id, customer_id: s.customer_id, kind: fu % 3 === 0 ? "RECOVERY" : "DUE", status: "SENT", sent_at: at(sentDay, 10), created_at: at(sentDay, 10), updated_at: at(sentDay, 10),
    outcome: fu === 1 ? "BOOKED" : fu % 4 === 0 ? "REPLIED" : fu % 5 === 0 ? "POSTPONED" : null, outcome_on: fu === 1 ? day(0) : fu % 5 === 0 ? day(20) : null });
}
add("crm_message_templates", { kind: "PRE", body: "¡Hola, {{nombre}}! Se acerca el cambio de aceite de tu *{{vehiculo}}* ({{placa}}). ¿Te reservamos un espacio esta semana? 🚗", updated_at: at(-90, 9), updated_by: null });
add("crm_message_templates", { kind: "DUE", body: "¡Hola, {{nombre}}! Ya le toca el cambio de aceite a tu *{{vehiculo}}* ({{placa}}). Te esperamos en Lubricenter. 🙌", updated_at: at(-90, 9), updated_by: null });
add("crm_message_templates", { kind: "FINAL", body: "¡Hola, {{nombre}}! Te escribimos por última vez sobre el cambio de aceite de tu *{{vehiculo}}* ({{placa}}). Si ya lo hiciste, ¡genial! 🙂", updated_at: at(-90, 9), updated_by: null });
add("crm_message_templates", { kind: "RECOVERY", body: "¡Hola, {{nombre}}! Hace tiempo no vemos tu *{{vehiculo}}* ({{placa}}). ¿Agendamos el cambio de aceite?", updated_at: at(-90, 9), updated_by: null });
add("crm_message_templates", { kind: "RECONNECT", body: "¡Hola, {{nombre}}! Te extrañamos en Lubricenter. Si tu *{{vehiculo}}* necesita mantenimiento, aquí estamos.", updated_at: at(-90, 9), updated_by: null });

// Compras: facturas de proveedor con entrada al inventario
for (let k = 0; k < 10; k++) {
  const sup = suppliers[k % suppliers.length];
  const offset = k < 2 ? -(k + 1) : -int(3, 85);
  const id = `inv-${pad(k + 1, 3)}`;
  const brands = (T.supplier_brands ?? []).filter(b => b.supplier_id === sup.id).map(b => b.brand_key);
  const pool = items.filter(i => brands.includes(i.brand.toLowerCase()) && i.cost != null && i !== outOfStock);
  const lines = Array.from({ length: Math.min(pool.length, int(2, 5)) }, (_, j) => pool[(j * 5 + k) % pool.length]);
  let total = new D(0);
  const currency = sup.default_currency as string;
  for (const [j, it] of [...new Set(lines)].entries()) {
    const qty = int(6, 24);
    const unitRef = it.cost!;
    const unitOriginal = currency === "USD" ? unitRef : r2(new D(unitRef).mul(BCV));
    total = total.plus(new D(unitOriginal).mul(qty));
    const sii = add("supplier_invoice_items", { id: `${id}-l${j + 1}`, supplier_invoice_id: id, line_type: "INVENTORY", inventory_item_id: it.id, description: it.description, expense_category: null, quantity: qty, unit_cost_original: unitOriginal, unit_cost_ref: unitRef, line_total_original: r2(new D(unitOriginal).mul(qty)), received_quantity: qty, created_at: at(offset, 9) });
    move(it, qty, "PURCHASE", at(offset, 9), { supplier_receipt_item_id: sii.id, note: `Factura ${sup.name}` });
  }
  const paid = k % 3 === 0 ? total : new D(0);
  add("supplier_invoices", { id, supplier_id: sup.id, invoice_number: `F-${pad(1000 + k * 13, 6)}`, invoice_date: day(offset), due_date: day(offset + (sup.payment_terms_days as number)), currency, bcv_rate_snapshot: BCV, operative_rate_snapshot: OPERATIVE,
    subtotal_original: r2(total), tax_original: 0, discount_original: 0, freight_original: 0, total_original: r2(total), paid_original: r2(paid), status: paid.gt(0) ? "PAID" : "OPEN", notes: null, created_by: null, created_at: at(offset, 9), updated_at: at(offset, 9), voided_at: null, voided_by: null, void_reason: null });
}

// Ajustes de inventario con motivo
for (const [k, reason] of ["Conteo físico: diferencia de 1 unidad", "Producto dañado en el depósito", "Devolución de cliente en buen estado", "Conteo físico: sobrante"].entries()) {
  const it = items[(k * 11 + 3) % items.length];
  move(it, k === 2 || k === 3 ? 1 : -1, k === 2 ? "RETURN" : "ADJUSTMENT", at(-int(2, 60), 16), { note: reason });
}

// Apertura: la existencia final es la de cada artículo; la apertura compensa los movimientos.
for (const it of items) {
  const delta = stockDelta.get(it.id) ?? 0;
  const opening = it.stock - delta;
  if (opening < 0) it.stock = delta; // si las ventas superan la existencia, la apertura queda en 0
  move(it, Math.max(0, opening), "OPENING_IMPORT", at(-120, 7, 0), { note: "Inventario inicial" });
}

// inventory_items con el formato de la base
for (const it of items) {
  add("inventory_items", { id: it.id, sku: it.sku, brand: it.brand, description: it.description, category: it.category, unit: it.unit, source_cost_ref: it.cost, source_stock_imported: null,
    source_alert: null, source_price_status: it.price_ref == null ? "SIN_PRECIO" : "OK", source_row: null, product_id: null, needs_review: false, cost_missing: it.cost == null, active: true,
    source_name: "EJEMPLO", imported_at: at(-120, 7), updated_at: at(-5, 7), source_rows: null, source_duplicate_count: 0, average_cost_ref: it.cost, last_purchase_cost_ref: it.cost, last_purchased_at: null,
    merged_into: null, last_counted_at: at(-30, 7), alt_codes: [], display_name: it.description, price_usd: it.price_ref == null ? null : r2(new D(it.price_ref).mul(BCV).div(OPERATIVE)), price_ref: it.price_ref,
    price_updated_at: at(-30, 7), image_url: null, in_catalog: true, viscosity: it.viscosity ?? null });
}

// Fuentes de los reportes que se importan en la conciliación Cashea.
for (const [provider, name] of [["CASHEA_TRANSACTIONS", "Pagos Cashea"], ["CASHEA_ORDERS", "Órdenes Cashea"], ["BDV", "Banco de Venezuela"]] as const)
  add("external_sources", { id: `src-${provider.toLowerCase()}`, provider, name, account_id: null, external_account: null, currency: "VES", active: true, created_at: at(-120, 8, 0), created_by: null });

// Personal (selector de perfil de la muestra)
for (const [id, profile, name] of [["stf-owner", "OWNER", "Dueño"], ["stf-admin", "ADMIN", "Administración"], ["stf-reception", "RECEPTION", "Recepción"], ["stf-mechanic", "MECHANIC", "Mecánico de taller"]] as const)
  add("staff_users", { id, auth_user_id: id, full_name: name, email: `${profile.toLowerCase()}@ejemplo.com`, job_title: name, active: true, profile, employee_id: profile === "MECHANIC" ? EMP_MECH : null, device: null, created_at: at(-60, 9), updated_at: at(-60, 9), created_by: null });

// ── Salida ──────────────────────────────────────────────────────────────────
const seed = { version: SEED_VERSION, anchor: ANCHOR, rates: { bcv: BCV, operative: OPERATIVE }, tables: T };
const out = path.join(process.cwd(), "lib/demo/seed/seed.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(seed) + "\n");
const summary = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.length]));
console.log(JSON.stringify(summary, null, 1));
console.log(`${(fs.statSync(out).size / 1024).toFixed(0)} KB → ${path.relative(process.cwd(), out)}`);
