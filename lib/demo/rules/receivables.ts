import { D, r2 } from "./money";
import type { Rates } from "./rates";

/**
 * Deuda en REF BCV y en $ divisas. Un abono en Bs la baja en REF al BCV del día;
 * un abono en $ la baja en divisas. Ambas bajan en el mismo porcentaje y la deuda
 * cierra cuando lo que falta en la moneda del abono es menor a 0,01.
 */
export type Debt = { principalRef: number; principalUsd: number; fraction: number };

export const debtOutstanding = (d: Debt) => ({ ref: r2(new D(d.principalRef).mul(d.fraction)), usd: r2(new D(d.principalUsd).mul(d.fraction)) });

export function applyDebtPayment(d: Debt, amount: number, currency: "VES" | "USD", rates: Rates) {
  const out = debtOutstanding(d);
  const inCurrency = currency === "USD" ? new D(out.usd) : new D(out.ref).mul(rates.bcv);
  if (new D(amount).gt(inCurrency.plus(0.01))) throw new Error("El abono es mayor que la deuda.");
  const paidShare = new D(amount).div(currency === "USD" ? d.principalUsd : new D(d.principalRef).mul(rates.bcv));
  let fraction = D.max(0, new D(d.fraction).minus(paidShare));
  const left = currency === "USD" ? fraction.mul(d.principalUsd) : fraction.mul(d.principalRef).mul(rates.bcv);
  if (left.lt(0.01)) fraction = new D(0);
  return { ...d, fraction: fraction.toDecimalPlaces(12).toNumber(), closed: fraction.isZero() };
}
