// Venta rápida: cobro directo, efectivo con vuelto, «Por cobrar», crédito parcial y Cashea.
import { addPayment, addQuickLines, closeOrder, createOrder, dueIn, r2, saleResult } from "../domain/order-engine";
import { createReceivable } from "./receivables";
import { DEMO_SETTINGS } from "../rules/settings";
import { fail, type Handler } from "./ctx";

const BANK = ["TRANSFER_BDV", "TRANSFER_BNC"];
function checkReference(method: string, reference: unknown) {
  if (BANK.includes(method) && !/^\d{4,}$/.test(String(reference ?? "").trim())) fail("Indica al menos los últimos 4 dígitos de la referencia bancaria.");
}

export const sales: Record<string, Handler> = {
  quick_sale_direct_v2: (a, c) => {
    checkReference(a.p_method, a.p_reference);
    const o = createOrder(c, { businessAt: a.p_business_at });
    addQuickLines(c, o, a.p_items);
    addPayment(c, o, a.p_method, dueIn(c, o, a.p_method), { reference: a.p_reference, when: String(o.business_at) });
    closeOrder(c, o);
    c.commit();
    return saleResult(o);
  },

  quick_sale_with_tender: (a, c) => {
    const o = createOrder(c, { businessAt: a.p_business_at });
    addQuickLines(c, o, a.p_items);
    const method = String(a.p_method);
    const usd = method === "CASH_USD";
    const due = a.p_agreed_usd != null && usd ? Number(a.p_agreed_usd) : dueIn(c, o, method);
    if (usd && a.p_agreed_usd != null) {
      // Precio final pactado en $: la diferencia queda como redondeo en efectivo.
      const ref = r2((Number(a.p_agreed_usd) * c.rates.operative) / c.rates.bcv);
      o.adjust_cash_rounding_ref = r2(ref - Number(o.total_ref));
      o.total_ref = ref; o.total_ves = r2(ref * c.rates.bcv); o.total_cash_usd_equivalent = Number(a.p_agreed_usd);
    }
    const received = Number(a.p_received);
    if (!(received >= due - 0.009)) fail(`Lo recibido no cubre el total: faltan ${r2(due - received)} ${usd ? "$" : "Bs"}.`);
    const p = addPayment(c, o, method, due, { reference: a.p_reference, when: String(o.business_at) });
    const returned = Number(a.p_return_usd ?? 0);
    const changeRate = Number(a.p_change_rate ?? c.rates.operative);
    const extra = r2(received - due);
    c.insert("order_tenders", {
      id: c.id("ten"), order_id: o.id, payment_id: p.id, customer_id: null, customer_label: a.p_customer_label ?? null, method, currency: usd ? "USD" : "VES",
      received, applied: due, payment_rate: usd ? c.rates.operative : 1, change_usd: usd ? extra : r2(extra / changeRate), returned_usd: returned,
      change_rate: changeRate, rounding_ves: usd ? 0 : r2(extra - returned * changeRate), request_payload: { confirmed_counted: true, return_currency: a.p_return_currency ?? "USD" }, created_at: c.now(), created_by: null,
    });
    closeOrder(c, o);
    c.commit();
    return saleResult(o);
  },

  quick_sale_por_cobrar: (a, c) => {
    const note = String(a.p_note ?? "").trim();
    if (note.length < 3) fail("Escribe la nota: quién cobró y por qué queda por cobrar.");
    const o = createOrder(c, { businessAt: a.p_business_at });
    addQuickLines(c, o, a.p_items);
    addPayment(c, o, "POR_COBRAR", dueIn(c, o, "POR_COBRAR"), { reference: note, when: String(o.business_at) });
    c.insert("order_notes", { id: c.id("note"), order_id: o.id, note, kind: "POR_COBRAR", created_by: null, created_at: c.now() });
    closeOrder(c, o);
    c.commit();
    return saleResult(o);
  },

  quick_sale_partial_credit: (a, c) => {
    if (!a.p_customer_id) fail("Busca o crea el cliente que asumirá el saldo.");
    checkReference(a.p_method, a.p_reference);
    const o = createOrder(c, { businessAt: a.p_business_at, customerId: a.p_customer_id });
    addQuickLines(c, o, a.p_items);
    const amount = Number(a.p_amount_original);
    if (amount >= dueIn(c, o, a.p_method)) fail("El abono cubre todo: registra la venta como pago normal.");
    if (amount > 0) addPayment(c, o, a.p_method, amount, { reference: a.p_reference, when: String(o.business_at) });
    const rec = createReceivable(c, o, a.p_due_date);
    closeOrder(c, o, { allowUnpaid: true });
    c.commit();
    return { ...saleResult(o), receivable_id: rec.id, outstanding_ref: rec.principal_ref, outstanding_ves: rec.outstanding_ves };
  },

  quick_sale_dated: (a, c) => {
    const o = createOrder(c, { businessAt: a.p_business_at });
    addQuickLines(c, o, a.p_items);
    c.commit();
    return saleResult(o);
  },

  prepare_quick_sale: (a, c) => {
    const o = createOrder(c, { businessAt: a.p_business_at });
    addQuickLines(c, o, a.p_items);
    c.commit();
    return saleResult(o);
  },

  authorize_price_override: (a, c) => {
    if (a.p_owner_pin !== DEMO_SETTINGS.demoPin) return { ok: false, error: `PIN incorrecto. En la muestra el PIN es ${DEMO_SETTINGS.demoPin}.` };
    return { ok: true, actor: "Dueño", expires_at: new Date(Date.now() + 10 * 60000).toISOString(), price_override: c.id("pov") };
  },
};
