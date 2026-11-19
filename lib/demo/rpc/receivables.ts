// Cuentas por cobrar y Crédito LC: deuda en REF BCV y en $ divisas, abonos en cualquier moneda.
import { addPayment, paidRef, r2, USD_METHODS } from "../domain/order-engine";
import { applyDebtPayment } from "../rules/receivables";
import type { Row } from "../store";
import { fail, type Ctx, type Handler } from "./ctx";

export function createReceivable(c: Ctx, o: Row, dueDate?: unknown) {
  const debtRef = r2(Number(o.total_ref) - paidRef(c, o));
  if (debtRef <= 0) fail("La orden ya está pagada: no queda saldo a crédito.");
  const { bcv, operative } = { bcv: Number(o.sale_bcv_rate ?? c.rates.bcv), operative: Number(o.sale_operative_rate ?? c.rates.operative) };
  const due = dueDate ? String(dueDate) : new Date(Date.parse(`${c.today}T12:00:00Z`) + 15 * 86400000).toISOString().slice(0, 10);
  return c.insert("receivables", {
    id: c.id("rcv"), order_id: o.id, debtor_type: "CUSTOMER", customer_id: o.customer_id, principal_ves: r2(debtRef * bcv), principal_ref: debtRef,
    outstanding_ves: r2(debtRef * bcv), status: "OPEN", due_date: due, created_at: c.now(), closed_at: null, principal_usd: r2(debtRef * bcv / operative), outstanding_fraction: 1,
  });
}

export const receivables: Record<string, Handler> = {
  record_receivable_payment: (a, c) => {
    const r = c.byId("receivables", a.p_receivable_id) ?? fail("No se encontró la deuda.");
    if (r!.status !== "OPEN") fail("Esta deuda ya está pagada.");
    const method = String(a.p_method);
    const amount = Number(a.p_amount_original);
    if (!(amount > 0)) fail("Indica un monto mayor que cero.");
    const usd = USD_METHODS.includes(method);
    const before = Number(r!.outstanding_fraction);
    const next = applyDebtPayment({ principalRef: Number(r!.principal_ref), principalUsd: Number(r!.principal_usd), fraction: before }, amount, usd ? "USD" : "VES", c.rates);
    const share = before - next.fraction;
    const order = c.byId("orders", r!.order_id)!;
    const p = addPayment(c, order, method, amount, { reference: a.p_reference ?? null, receivableId: r!.id as string,
      extra: { applied_ref: r2(Number(r!.principal_ref) * share), applied_usd: r2(Number(r!.principal_usd) * share) } });
    r!.outstanding_fraction = next.fraction;
    r!.outstanding_ves = r2(Number(r!.principal_ves) * next.fraction);
    if (next.closed) { r!.status = "PAID"; r!.closed_at = c.now(); }
    c.commit();
    return [{ payment_id: p.id, outstanding_ves: r!.outstanding_ves, outstanding_ref: r2(Number(r!.principal_ref) * next.fraction), outstanding_usd: r2(Number(r!.principal_usd) * next.fraction), status: r!.status }];
  },
};
