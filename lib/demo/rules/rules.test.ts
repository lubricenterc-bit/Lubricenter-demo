import { describe, expect, it } from "vitest";
import { refToDivisas, refToVes, divisasToRef } from "./rates";
import { cashChange, paymentRef, remaining } from "./payments";
import { casheaPlan, casheaSurchargePercent, casheaSurchargeRef, verifyInstallment } from "./cashea";
import { discountNeedsPin, pinOk, previewAdjustments, roundTarget } from "./adjustments";
import { needsPlateCapture, oilLaborRequired } from "./oil-change";
import { applyDebtPayment, debtOutstanding } from "./receivables";
import { lineProfit, sumProfit } from "./profit";
import { maxMessages, nextMessage, recoveryBucket } from "./crm";

const rates = { bcv: 200, operative: 250 };

describe("tasas", () => {
  it("REF a Bs y a divisas", () => {
    expect(refToVes(10, rates)).toBe(2000);
    expect(refToDivisas(10, rates)).toBe(8);      // 10 × 200 ÷ 250
    expect(divisasToRef(8, rates)).toBe(10);
  });
});

describe("pagos y vuelto", () => {
  it("valor en REF de cada pago", () => {
    expect(paymentRef({ method: "CASH_VES", amount: 2000 }, rates)).toBe(10);
    expect(paymentRef({ method: "ZELLE", amount: 8 }, rates)).toBe(10);
  });
  it("pago mixto: lo que falta", () => {
    const r = remaining(30, [{ method: "PAGO_MOVIL", amount: 2000 }, { method: "CASH_USD", amount: 8 }], rates);
    expect(r).toEqual({ ref: 10, ves: 2000, usd: 8, done: false });
    expect(remaining(20, [{ method: "PAGO_MOVIL", amount: 4000 }], rates).done).toBe(true);
  });
  it("vuelto en dólares", () => {
    expect(cashChange(10, 10, "USD", rates)).toMatchObject({ due: 8, applied: 8, changeUsd: 2, roundingVes: 0 });
  });
  it("pago en Bs con exceso: vuelto en $ y resto en Bs", () => {
    // Debe Bs 2000, entrega Bs 2600: sobran 600 = $2,40 a 250.
    expect(cashChange(10, 2600, "VES", rates)).toMatchObject({ due: 2000, changeUsd: 2.4, roundingVes: 0 });
    // Sobran 601: $2,40 y Bs 1 de redondeo.
    expect(cashChange(10, 2601, "VES", rates)).toMatchObject({ changeUsd: 2.4, roundingVes: 1 });
  });
});

describe("Cashea", () => {
  it("recargo con r = 5 % e inicial 40 %: 9,29 %", () => {
    expect(casheaSurchargePercent()).toBe(9.2896);  // 1 / (1 − 0,04 − 0,6 × 0,05 × 1,5) − 1
    expect(casheaSurchargeRef(100)).toBe(9.29);
  });
  it("inicial 40 % y tres cuotas a 14, 28 y 42 días", () => {
    const p = casheaPlan(100, "2026-11-01");
    expect(p.initialRef).toBe(40);
    expect(p.installments.map(i => [i.amountRef, i.dueDate])).toEqual([[20, "2026-11-15"], [20, "2026-11-29"], [20, "2026-12-13"]]);
  });
  it("la última cuota absorbe el centavo", () => {
    const p = casheaPlan(50.01, "2026-11-01");
    expect(p.initialRef).toBe(20);
    expect(p.installments.map(i => i.amountRef)).toEqual([10, 10, 10.01]);
  });
  it("mínimo de compra", () => {
    expect(() => casheaPlan(24.99, "2026-11-01")).toThrow(/desde 25/);
  });
  it("cuota verificada con regla A, regla B y «por confirmar»", () => {
    const base = { amountRef: 20, dueDate: "2026-11-10", today: "2026-11-19" };
    expect(verifyInstallment({ ...base, snapshot: { done: true } })).toEqual({ status: "PAID", rule: "A" });
    expect(verifyInstallment({ ...base, payments: [{ shareRef: 20, bankLine: true }] })).toEqual({ status: "PAID", rule: "B" });
    expect(verifyInstallment({ ...base, payments: [{ shareRef: 20, bankLine: false }] })).toEqual({ status: "PENDING", reason: "NO_BNC_LINE" });
    expect(verifyInstallment({ ...base, payments: [{ shareRef: 20, bankLine: false, bankRefSeen: true }] })).toMatchObject({ reason: "BNC_AMOUNT_MISMATCH" });
    expect(verifyInstallment({ ...base, payments: [{ shareRef: 10, bankLine: true }] })).toEqual({ status: "PARTIAL", rule: "B", paidRef: 10, reason: "AMOUNT_SHORT" });
    expect(verifyInstallment({ ...base })).toEqual({ status: "PENDING", reason: "NO_SNAPSHOT_NO_PAYMENT" });
    expect(verifyInstallment({ ...base, dueDate: "2026-11-25" })).toEqual({ status: "PENDING", reason: null });
    expect(verifyInstallment({ ...base, snapshot: { cancelled: true, done: true } })).toEqual({ status: "PENDING", reason: "ORDER_CANCELLED_IN_CASHEA" });
  });
});

describe("descuento y redondeo", () => {
  it("hasta 10 % libre; más pide PIN", () => {
    expect(discountNeedsPin(10)).toBe(false);
    expect(discountNeedsPin(10.5)).toBe(true);
    expect(pinOk("0000")).toBe(true);
    expect(pinOk("1234")).toBe(false);
  });
  it("redondeo abajo, 0,50 y arriba", () => {
    expect(roundTarget(12.3, "DOWN")).toBe(12);
    expect(roundTarget(12.3, "HALF")).toBe(12.5);
    expect(roundTarget(12.2, "HALF")).toBe(12);
    expect(roundTarget(12.3, "UP")).toBe(13);
  });
  it("primero el descuento y después el redondeo", () => {
    expect(previewAdjustments(55.55, 5, "HALF")).toEqual({ subtotal: 55.55, discount: 2.78, afterDiscount: 52.77, rounding: 0.23, total: 53 });
    // El descuento no se aplica sobre el recargo Cashea.
    expect(previewAdjustments(109.29, 10, "NONE", 9.29).discount).toBe(10);
  });
});

describe("cambio de aceite", () => {
  it("regla del 85 %", () => {
    expect(oilLaborRequired({ customerOil: false, boughtRef: 40, broughtFilterRef: 5 }).required).toBe(false); // 88,9 %
    expect(oilLaborRequired({ customerOil: false, boughtRef: 30, broughtFilterRef: 10 }).required).toBe(true); // 75 %
    expect(oilLaborRequired({ customerOil: false, boughtRef: 85, broughtFilterRef: 15 }).required).toBe(false); // justo 85 %
    expect(oilLaborRequired({ customerOil: true, boughtRef: 10 }).required).toBe(true);
  });
  it("la placa se pide solo con cambio de aceite", () => {
    const oil = (q: number, unit = "L") => ({ itemType: "PRODUCT" as const, quantity: q, description: "Aceite 15W-40", category: "Aceite Motor", unit });
    const filter = { itemType: "PRODUCT" as const, quantity: 1, description: "Filtro de aceite", category: "Filtro Aceite" };
    expect(needsPlateCapture([oil(4), filter])).toBe(true);
    expect(needsPlateCapture([oil(4)])).toBe(false);
    expect(needsPlateCapture([oil(1), filter])).toBe(false);
    expect(needsPlateCapture([oil(1, "GAL"), filter])).toBe(true);
    expect(needsPlateCapture([{ itemType: "SERVICE", businessArea: "OIL_CHANGE", quantity: 1, description: "Cambio de aceite" }])).toBe(true);
  });
});

describe("deudas en REF BCV y $ divisas", () => {
  it("abono en Bs y cierre en $", () => {
    let d = { principalRef: 100, principalUsd: 80, fraction: 1 };
    const a = applyDebtPayment(d, 10000, "VES", rates);   // 10.000 Bs = 50 REF
    expect(debtOutstanding(a)).toEqual({ ref: 50, usd: 40 });
    const b = applyDebtPayment(a, 40, "USD", rates);
    expect(b.closed).toBe(true);
    expect(() => applyDebtPayment(a, 41, "USD", rates)).toThrow(/mayor que la deuda/);
  });
});

describe("ganancia", () => {
  it("por línea", () => {
    expect(lineProfit({ role: "PRODUCT", revenueRef: 13.5 })).toMatchObject({ area: "TIENDA", estimated: true, costRef: 10, profitRef: 3.5 });
    expect(lineProfit({ role: "PRODUCT", revenueRef: 12, costRef: 8 })).toMatchObject({ estimated: false, profitRef: 4 });
    expect(lineProfit({ role: "LABOR", revenueRef: 50, mechanicsRef: 20, paidWithCashea: true })).toMatchObject({ area: "TALLER", casheaRef: 2, profitRef: 28 });
    expect(lineProfit({ role: "PASS_THROUGH", revenueRef: 22, passThroughCostRef: 20 })).toMatchObject({ area: "TIENDA", profitRef: 2 });
    expect(lineProfit({ role: "OIL_LABOR", revenueRef: 10 })).toMatchObject({ area: "TIENDA", profitRef: 10 });
  });
  it("suma por área", () => {
    expect(sumProfit([{ role: "PRODUCT", revenueRef: 13.5 }, { role: "LABOR", revenueRef: 50, mechanicsRef: 20 }])).toEqual({ tienda: 3.5, taller: 30, total: 33.5 });
  });
});

describe("seguimiento", () => {
  it("tramos de Recuperar", () => {
    expect([-16, -15, -1, 0, 30, 31, 90, 91, 180, 181, 365, 366].map(recoveryBucket))
      .toEqual([null, "SOON", "SOON", "D0_30", "D0_30", "D31_90", "D31_90", "D91_180", "D91_180", "D181_365", "D181_365", "D365P"]);
  });
  it("mensajes por ciclo y días entre mensajes", () => {
    expect(maxMessages("PRE")).toBe(3);
    expect(maxMessages("DUE")).toBe(2);
    expect(nextMessage({ daysFromDue: -3, sentCount: 0, cycleDueDay: 100 })).toEqual({ kind: "PRE", eligibleDay: 93 });
    expect(nextMessage({ daysFromDue: 5, sentCount: 1, firstKind: "PRE", lastSentDay: 95, cycleDueDay: 100 })).toEqual({ kind: "DUE", eligibleDay: 105 });
    expect(nextMessage({ daysFromDue: 20, sentCount: 2, firstKind: "PRE", lastSentDay: 105, cycleDueDay: 100 })).toEqual({ kind: "FINAL", eligibleDay: 119 });
    expect(nextMessage({ daysFromDue: 40, sentCount: 3, firstKind: "PRE", lastSentDay: 119, cycleDueDay: 100 })).toBeNull();
    expect(nextMessage({ daysFromDue: 400, sentCount: 0, cycleDueDay: 100 })?.kind).toBe("RECONNECT");
  });
});
