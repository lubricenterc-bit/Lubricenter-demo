import { changeQuote } from "@/lib/finance/change";
import { D, r2 } from "./money";
import { refToDivisas, refToVes, type Rates } from "./rates";

export type Method = "CASH_USD" | "CASH_VES" | "TRANSFER_BDV" | "TRANSFER_BNC" | "PAGO_MOVIL" | "ZELLE" | "BINANCE";
export const USD_METHODS: Method[] = ["CASH_USD", "ZELLE", "BINANCE"];
export const isUsd = (m: Method) => USD_METHODS.includes(m);

export type Payment = { method: Method; amount: number };

/** Lo que vale un pago en REF BCV: Bs ÷ BCV; $ divisas × operativa ÷ BCV. */
export function paymentRef(p: Payment, rates: Rates) {
  return isUsd(p.method)
    ? new D(p.amount).mul(rates.operative).div(rates.bcv).toNumber()
    : new D(p.amount).div(rates.bcv).toNumber();
}

/** Lo que falta por cobrar, en REF y en cada moneda. Tolerancia de 0,01. */
export function remaining(totalRef: number, payments: Payment[], rates: Rates) {
  const paid = payments.reduce((a, p) => a.plus(paymentRef(p, rates)), new D(0));
  const ref = D.max(0, new D(totalRef).minus(paid)).toNumber();
  const done = new D(totalRef).minus(paid).lte(0.005);
  return { ref: done ? 0 : r2(ref), ves: done ? 0 : refToVes(ref, rates), usd: done ? 0 : refToDivisas(ref, rates), done };
}

/**
 * Vuelto en efectivo: usa la misma función del sistema (lib/finance/change). El vuelto sale
 * en dólares a la tasa operativa; si se paga en bolívares, lo que no completa un centavo
 * de dólar queda como redondeo en Bs.
 */
export function cashChange(dueRef: number, received: number, currency: "USD" | "VES", rates: Rates) {
  const remainingVes = refToVes(dueRef, rates);
  const q = changeQuote(remainingVes, received, currency, rates.operative, rates.operative);
  return { due: Number(q.due), applied: Number(q.applied), changeUsd: Number(q.changeUsd), roundingVes: Number(q.roundingVes) };
}
