import { D, r2, r4 } from "./money";
import { DEMO_SETTINGS as S } from "./settings";

/** recargo = 1 / (1 − comisión − financiado × r × días/30) − 1, en %. */
export function casheaSurchargePercent(initialPercent: number = S.casheaInitialPercent, r: number = S.casheaOpportunityMonthlyPercent) {
  const financed = Math.max(0, 1 - initialPercent / 100);
  const keep = new D(1).minus(S.casheaCommissionPercent / 100).minus(new D(financed).mul(r / 100).mul(S.casheaFinancingDays / 30));
  if (keep.lte(0)) return null;
  return r4(new D(1).div(keep).minus(1).mul(100));
}

/** El recargo se aplica SOLO a la mano de obra de taller y electroauto. */
export function casheaSurchargeRef(workshopLaborRef: number, initialPercent?: number, r?: number) {
  const pct = casheaSurchargePercent(initialPercent, r) ?? 0;
  return r2(new D(workshopLaborRef).mul(pct).div(100));
}

export type Installment = { no: number; amountRef: number; dueDate: string };

/** Inicial del 40% y tres cuotas de 20% a los 14, 28 y 42 días. La última absorbe el centavo. */
export function casheaPlan(totalRef: number, saleDate: string, initialPercent: number = S.casheaInitialPercent) {
  if (totalRef < S.casheaMinimumRef) throw new Error(`Cashea acepta compras desde ${S.casheaMinimumRef} REF.`);
  const initial = r2(new D(totalRef).mul(initialPercent).div(100));
  const financed = new D(totalRef).minus(initial);
  const each = r2(financed.div(S.casheaInstallments));
  const base = new Date(`${saleDate}T12:00:00-04:00`);
  const installments: Installment[] = Array.from({ length: S.casheaInstallments }, (_, i) => {
    const due = new Date(base.getTime() + (i + 1) * S.casheaInstallmentDays * 86400000);
    const amount = i === S.casheaInstallments - 1 ? r2(financed.minus(new D(each).mul(S.casheaInstallments - 1))) : each;
    return { no: i + 1, amountRef: amount, dueDate: due.toISOString().slice(0, 10) };
  });
  return { initialRef: initial, financedRef: r2(financed), installments };
}

export type VerifyInput = {
  amountRef: number;
  /** Regla A: el export de órdenes de Cashea muestra la cuota DONE o pagada completa. */
  snapshot?: { cancelled?: boolean; done?: boolean; paidRef?: number } | null;
  /** Regla B: pagos del export de pagos, con su línea del banco si se encontró. */
  payments?: { shareRef: number; bankLine: boolean; bankRefSeen?: boolean }[];
  dueDate: string; today: string;
};
export type VerifyResult =
  | { status: "PAID"; rule: "A" | "B" }
  | { status: "PARTIAL"; rule: "A" | "B"; paidRef: number; reason: VerifyReason | null }
  | { status: "PENDING"; reason: VerifyReason | null };
export type VerifyReason = "ORDER_CANCELLED_IN_CASHEA" | "BNC_AMOUNT_MISMATCH" | "NO_BNC_LINE" | "AMOUNT_SHORT" | "NO_SNAPSHOT_NO_PAYMENT";

/** Una cuota se marca pagada solo con verificación al 100 %: regla A o regla B. Lo demás queda «Por confirmar». */
export function verifyInstallment(x: VerifyInput): VerifyResult {
  const pays = x.payments ?? [];
  const snap = x.snapshot && !x.snapshot.cancelled ? x.snapshot : null;
  const snapPaid = snap ? Math.min(snap.paidRef ?? 0, x.amountRef) : 0;
  const verified = pays.filter(p => p.bankLine).reduce((a, p) => a + p.shareRef, 0);
  if (snap && (snap.done || snapPaid >= x.amountRef - 0.01)) return { status: "PAID", rule: "A" };
  if (verified >= x.amountRef - 0.01) return { status: "PAID", rule: "B" };
  let reason: VerifyReason | null = null;
  if (x.snapshot?.cancelled) reason = "ORDER_CANCELLED_IN_CASHEA";
  else if (pays.some(p => !p.bankLine && p.bankRefSeen)) reason = "BNC_AMOUNT_MISMATCH";
  else if (pays.some(p => !p.bankLine)) reason = "NO_BNC_LINE";
  else if (pays.length) reason = "AMOUNT_SHORT";
  else if (!x.snapshot && x.dueDate < x.today) reason = "NO_SNAPSHOT_NO_PAYMENT";
  const partial = Math.max(snapPaid, verified);
  if (partial > 0.005) return { status: "PARTIAL", rule: verified >= snapPaid ? "B" : "A", paidRef: r4(partial), reason };
  return { status: "PENDING", reason };
}

export const VERIFY_REASON_TEXT: Record<VerifyReason, string> = {
  ORDER_CANCELLED_IN_CASHEA: "Cashea muestra la orden cancelada. Revísala antes de cobrar o anular.",
  BNC_AMOUNT_MISMATCH: "La referencia está en el banco, pero el monto o la fecha no coinciden.",
  NO_BNC_LINE: "El pago está en Cashea pero no aparece en el estado de cuenta del banco.",
  AMOUNT_SHORT: "Lo verificado en el banco no cubre la cuota completa.",
  NO_SNAPSHOT_NO_PAYMENT: "Vencida y sin datos de Cashea. Sube un export de órdenes que incluya esta venta.",
};
