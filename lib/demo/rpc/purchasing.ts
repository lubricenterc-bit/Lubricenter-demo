// Compras: proveedores y marcas, «Ingresar mercancía» (factura + entrada al inventario) y editar factura.
import { r2, r4 } from "../domain/order-engine";
import { stockMap } from "../domain/inventory";
import type { Row } from "../store";
import { fail, type Ctx, type Handler } from "./ctx";

const fold = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const toRef = (c: Ctx, amount: number, currency: string) => (currency === "USD" ? amount : amount / c.rates.bcv);
const unitsOf = (c: Ctx, invId: unknown) => c.t("supplier_invoice_items").filter(i => i.supplier_invoice_id === invId);

function invoiceSummary(c: Ctx, i: Row) {
  const sup = c.byId("suppliers", i.supplier_id);
  const lines = unitsOf(c, i.id);
  return { id: i.id, supplier_id: i.supplier_id, supplier_name: sup?.name ?? "", invoice_number: i.invoice_number, invoice_date: i.invoice_date, due_date: i.due_date, currency: i.currency,
    total_original: Number(i.total_original), paid_original: Number(i.paid_original ?? 0), outstanding_original: r2(Number(i.total_original) - Number(i.paid_original ?? 0)), status: i.voided_at ? "VOID" : i.status,
    received_units: lines.reduce((s, l) => s + Number(l.received_quantity ?? 0), 0), invoiced_units: lines.reduce((s, l) => s + Number(l.quantity), 0) };
}

/** Entrada al inventario con costo promedio ponderado (sin dilución si no había costo). */
function receive(c: Ctx, line: Row, qty: number, when: string, invoice: Row) {
  const it = c.byId("inventory_items", line.inventory_item_id);
  if (!it || qty <= 0) return;
  const stock = Math.max(0, stockMap(c.s).get(it.id as string) ?? 0);
  const unit = Number(line.unit_cost_ref);
  const prev = it.average_cost_ref == null ? null : Number(it.average_cost_ref);
  it.average_cost_ref = prev == null ? unit : r4((prev * stock + unit * qty) / (stock + qty));
  it.last_purchase_cost_ref = unit; it.last_purchased_at = when; it.cost_missing = false; it.updated_at = c.now();
  c.insert("inventory_movements", { id: c.id("mov"), inventory_item_id: it.id, location_id: "loc-centro", quantity_delta: qty, movement_type: "PURCHASE", order_item_id: null,
    note: `Factura ${invoice.invoice_number}`, occurred_at: when, created_by: null, created_at: c.now(), supplier_receipt_item_id: line.id, reversal_of: null });
  line.received_quantity = Number(line.received_quantity ?? 0) + qty;
}

function writeLines(c: Ctx, inv: Row, items: Row[]) {
  let subtotal = 0;
  for (const it of items) {
    const qty = Number(it.quantity), cost = Number(it.unit_cost);
    if (!(qty > 0)) fail("Falta la cantidad en una línea.");
    if (!(cost >= 0)) fail("Falta el costo en una línea.");
    const line = c.insert("supplier_invoice_items", { id: it.id ?? c.id("sii"), supplier_invoice_id: inv.id, line_type: it.line_type, inventory_item_id: it.inventory_item_id ?? null, description: it.description,
      expense_category: it.expense_category ?? null, quantity: qty, unit_cost_original: cost, unit_cost_ref: r4(toRef(c, cost, String(inv.currency))), line_total_original: r2(qty * cost), received_quantity: 0, created_at: c.now() });
    subtotal += Number(line.line_total_original);
  }
  return r2(subtotal);
}

export const purchasing: Record<string, Handler> = {
  purchasing_dashboard: (a, c) => {
    const invs = c.t("supplier_invoices").filter(i => !i.voided_at);
    const inPeriod = invs.filter(i => (!a.p_from || String(i.invoice_date) >= a.p_from) && (!a.p_to || String(i.invoice_date) <= a.p_to));
    const rows = inPeriod.map(i => invoiceSummary(c, i)).sort((x, y) => String(y.invoice_date).localeCompare(String(x.invoice_date)));
    const open = invs.map(i => invoiceSummary(c, i)).filter(i => i.outstanding_original > 0.005);
    const payableRef = (i: ReturnType<typeof invoiceSummary>) => toRef(c, i.outstanding_original, String(i.currency));
    return {
      period: { from: a.p_from, to: a.p_to },
      summary: { invoiced_ref: r2(rows.reduce((s, i) => s + toRef(c, i.total_original, String(i.currency)), 0)), paid_ves: 0, payable_ref: r2(open.reduce((s, i) => s + payableRef(i), 0)),
        overdue: open.filter(i => i.due_date && String(i.due_date) < c.today).length, suppliers: new Set(rows.map(i => i.supplier_id)).size },
      suppliers: c.t("suppliers").map(s => ({ ...s, invoice_count: invs.filter(i => i.supplier_id === s.id).length, payable_ref: r2(open.filter(i => i.supplier_id === s.id).reduce((t, i) => t + payableRef(i), 0)) })),
      invoices: rows, accounts: [],
    };
  },
  purchasing_brands: (_a, c) => {
    const m = new Map<string, { brand_key: string; name: string; items: number }>();
    for (const i of c.t("inventory_items")) { if (!i.brand) continue; const k = fold(i.brand); const x = m.get(k) ?? { brand_key: k, name: String(i.brand), items: 0 }; x.items++; m.set(k, x); }
    return [...m.values()].sort((x, y) => x.name.localeCompare(y.name));
  },
  purchasing_item_search: (a, c) => {
    const q = fold(a.p_query); const brands: string[] | null = a.p_brand_keys?.length ? a.p_brand_keys : null; const cats: string[] | null = a.p_categories?.length ? a.p_categories : null;
    const stock = stockMap(c.s);
    const bought = new Set(c.t("supplier_invoices").filter(i => i.supplier_id === a.p_supplier_id).flatMap(i => unitsOf(c, i.id).map(l => l.inventory_item_id)));
    return c.t("inventory_items").filter(i => i.active !== false)
      .filter(i => !q || fold(`${i.sku} ${i.brand} ${i.description} ${(i.alt_codes as string[] ?? []).join(" ")}`).includes(q))
      .filter(i => !brands || brands.includes(fold(i.brand))).filter(i => !cats || cats.includes(String(i.category)))
      .map(i => ({ id: i.id, sku: i.sku, display_name: i.display_name ?? i.description, description: i.description, brand: i.brand, brand_key: fold(i.brand), category: i.category, unit: i.unit,
        stock: stock.get(i.id as string) ?? 0, average_cost_ref: i.average_cost_ref, last_purchase_cost_ref: i.last_purchase_cost_ref, price_usd: i.price_usd, bought_from_supplier: bought.has(i.id), last_bought_at: i.last_purchased_at }))
      .sort((x, y) => Number(y.bought_from_supplier) - Number(x.bought_from_supplier) || String(x.display_name).localeCompare(String(y.display_name))).slice(0, Number(a.p_limit ?? 50));
  },
  purchase_invoice_and_receive: (a, c) => {
    if (!a.p_supplier_id) fail("Elige el proveedor.");
    const number = String(a.p_invoice_number ?? "").trim(); if (!number) fail("Escribe el número de la factura.");
    if (c.t("supplier_invoices").some(i => i.supplier_id === a.p_supplier_id && i.invoice_number === number && !i.voided_at)) fail(`La factura ${number} de este proveedor ya está registrada.`);
    const items: Row[] = a.p_items ?? []; if (!items.length) fail("Agrega al menos una línea.");
    const inv = c.insert("supplier_invoices", { id: c.id("inv", "purchases"), supplier_id: a.p_supplier_id, invoice_number: number, invoice_date: a.p_invoice_date ?? c.today, due_date: a.p_due_date ?? null, currency: a.p_currency ?? "USD",
      bcv_rate_snapshot: c.rates.bcv, operative_rate_snapshot: c.rates.operative, subtotal_original: 0, tax_original: Number(a.p_tax ?? 0), discount_original: Number(a.p_discount ?? 0), freight_original: Number(a.p_freight ?? 0),
      total_original: 0, paid_original: 0, status: "OPEN", notes: a.p_notes ?? null, created_by: null, created_at: c.now(), updated_at: c.now(), voided_at: null, voided_by: null, void_reason: null });
    inv.subtotal_original = writeLines(c, inv, items);
    inv.total_original = r2(Number(inv.subtotal_original) + Number(inv.tax_original) - Number(inv.discount_original) + Number(inv.freight_original));
    if (a.p_receive_all) for (const l of unitsOf(c, inv.id).filter(l => l.line_type === "INVENTORY")) receive(c, l, Number(l.quantity), c.now(), inv);
    c.commit();
    const stock = stockMap(c.s);
    return { invoice_id: inv.id, stock_after: unitsOf(c, inv.id).filter(l => l.inventory_item_id).map(l => ({ id: l.inventory_item_id, stock: stock.get(l.inventory_item_id as string) ?? 0 })) };
  },
  inventory_receive_purchase: (a, c) => {
    const inv = c.byId("supplier_invoices", a.p_invoice_id) ?? fail("Factura no encontrada.");
    for (const it of (a.p_items ?? []) as Row[]) { const l = c.byId("supplier_invoice_items", it.supplier_invoice_item_id ?? it.id); if (l) receive(c, l, Number(it.quantity ?? it.received_quantity), a.p_received_on ? `${a.p_received_on}T12:00:00.000Z` : c.now(), inv!); }
    c.commit(); return inv!.id;
  },
  supplier_invoice_detail: (a, c) => {
    const i = c.byId("supplier_invoices", a.p_invoice_id) ?? fail("Factura no encontrada.");
    const sup = c.byId("suppliers", i!.supplier_id);
    const moves = c.t("inventory_movements").filter(m => unitsOf(c, i!.id).some(l => l.id === m.supplier_receipt_item_id));
    const days = [...new Set(moves.map(m => String(m.occurred_at).slice(0, 10)))];
    return {
      invoice: { ...invoiceSummary(c, i!), supplier_rif: sup?.rif ?? null, subtotal_original: i!.subtotal_original, tax_original: i!.tax_original, discount_original: i!.discount_original, freight_original: i!.freight_original, notes: i!.notes, updated_at: i!.updated_at },
      items: unitsOf(c, i!.id).map(l => ({ id: l.id, line_type: l.line_type, inventory_item_id: l.inventory_item_id, description: l.description, expense_category: l.expense_category, quantity: Number(l.quantity), received_quantity: Number(l.received_quantity ?? 0), unit_cost_original: Number(l.unit_cost_original), line_total_original: Number(l.line_total_original) })),
      receipts: days.map((d, k) => ({ id: `${i!.id}-r${k + 1}`, received_on: d, status: "RECEIVED", notes: null })),
      payments: [], accounts: [], locations: c.t("locations").map(l => ({ id: l.id, name: l.name, code: l.code })), edits: (i!.edits as Row[] | undefined) ?? [],
    };
  },
  purchase_receipt_history: (a, c) => {
    const lines = unitsOf(c, a.p_invoice_id);
    const moves = c.t("inventory_movements").filter(m => lines.some(l => l.id === m.supplier_receipt_item_id));
    const byDay = new Map<string, Row[]>();
    for (const m of moves) { const d = String(m.occurred_at).slice(0, 10); byDay.set(d, [...(byDay.get(d) ?? []), m]); }
    return [...byDay.entries()].map(([d, ms], k) => ({ id: `${a.p_invoice_id}-r${k + 1}`, received_on: d, location_name: "Centro", notes: null,
      items: ms.map(m => { const l = lines.find(x => x.id === m.supplier_receipt_item_id)!; return { id: m.id, description: l.description, quantity: Number(m.quantity_delta), unit_cost_ref: Number(l.unit_cost_ref), average_before: null, average_after: null }; }) }));
  },
  supplier_invoice_update: (a, c) => {
    if (c.profile !== "OWNER") fail("Solo el dueño puede editar facturas de proveedor.");
    const inv = c.byId("supplier_invoices", a.p_invoice_id) ?? fail("Factura no encontrada.");
    if (!String(a.p_reason ?? "").trim()) fail("Escribe el motivo del cambio.");
    const before = Number(inv!.total_original);
    const old = unitsOf(c, inv!.id);
    // Revierte lo recibido y vuelve a recibir según las cantidades nuevas.
    for (const l of old) if (Number(l.received_quantity) > 0 && l.inventory_item_id) c.insert("inventory_movements", { id: c.id("mov"), inventory_item_id: l.inventory_item_id, location_id: "loc-centro", quantity_delta: -Number(l.received_quantity), movement_type: "ADJUSTMENT", order_item_id: null, note: `Edición de factura ${inv!.invoice_number}`, occurred_at: c.now(), created_by: null, created_at: c.now(), supplier_receipt_item_id: null, reversal_of: null });
    c.s.tables.supplier_invoice_items = c.t("supplier_invoice_items").filter(l => l.supplier_invoice_id !== inv!.id);
    Object.assign(inv!, { supplier_id: a.p_supplier_id ?? inv!.supplier_id, invoice_number: a.p_invoice_number ?? inv!.invoice_number, invoice_date: a.p_invoice_date ?? inv!.invoice_date, due_date: a.p_due_date ?? null, currency: a.p_currency ?? inv!.currency,
      tax_original: Number(a.p_tax ?? 0), discount_original: Number(a.p_discount ?? 0), freight_original: Number(a.p_freight ?? 0), notes: a.p_notes ?? null, updated_at: c.now() });
    inv!.subtotal_original = writeLines(c, inv!, (a.p_items ?? []).map((x: Row) => ({ ...x, id: null })));
    inv!.total_original = r2(Number(inv!.subtotal_original) + Number(inv!.tax_original) - Number(inv!.discount_original) + Number(inv!.freight_original));
    for (const l of unitsOf(c, inv!.id).filter(l => l.line_type === "INVENTORY")) if (old.some(o => o.inventory_item_id === l.inventory_item_id && Number(o.received_quantity) > 0)) receive(c, l, Number(l.quantity), c.now(), inv!);
    inv!.edits = [...((inv!.edits as Row[]) ?? []), { at: c.now(), reason: String(a.p_reason).trim(), total_before: before, total_after: inv!.total_original, adjustments: 1 }];
    c.commit(); return { ok: true, invoice_id: inv!.id, total_before: before, total_after: inv!.total_original };
  },
  void_supplier_invoice: (a, c) => {
    const inv = c.byId("supplier_invoices", a.p_invoice_id) ?? fail("Factura no encontrada.");
    if (unitsOf(c, inv!.id).some(l => Number(l.received_quantity) > 0)) fail("La mercancía de esta factura ya entró al inventario: edítala en lugar de anularla.");
    Object.assign(inv!, { voided_at: c.now(), void_reason: a.p_reason ?? null, status: "VOID" }); c.commit(); return null;
  },
  upsert_supplier: (a, c) => {
    if (String(a.p_name ?? "").trim().length < 2) fail("Escribe el nombre del proveedor.");
    let s = a.p_id ? c.byId("suppliers", a.p_id) : null;
    if (!s) s = c.insert("suppliers", { id: c.id("sup", "suppliers"), created_at: c.now(), created_by: null });
    Object.assign(s!, { name: String(a.p_name).trim(), legal_name: a.p_legal_name ?? null, rif: a.p_rif ?? null, phone: a.p_phone ?? null, email: a.p_email ?? null, address: a.p_address ?? null, contact_name: a.p_contact_name ?? null,
      bank_details: a.p_bank_details ?? null, default_currency: a.p_default_currency ?? "USD", payment_terms_days: Number(a.p_payment_terms_days ?? 0), notes: a.p_notes ?? null, active: a.p_active !== false, updated_at: c.now() });
    c.commit(); return s!.id;
  },
  supplier_brands_set: (a, c) => {
    c.s.tables.supplier_brands = c.t("supplier_brands").filter(b => b.supplier_id !== a.p_supplier_id);
    for (const k of (a.p_brand_keys ?? []) as string[]) c.insert("supplier_brands", { supplier_id: a.p_supplier_id, brand_key: k, created_at: c.now() });
    c.commit(); return null;
  },
};
