import { describe, expect, it } from "vitest";
import seedJson from "./seed.json";
import { materialize, todayInCaracas, type Seed } from "./materialize";
import { lineProfit, sumProfit, type LineRole } from "../rules/profit";
import { needsPlateCapture } from "../rules/oil-change";
import { recoveryBucket } from "../rules/crm";

const seed = seedJson as unknown as Seed;
const t = seed.tables;
type R = Record<string, any>;
const role = (i: R): LineRole => i.line_role ?? (i.item_type === "SERVICE" ? (["WORKSHOP", "ELECTROAUTO"].includes(i.business_area) ? "LABOR" : "OIL_LABOR") : "PRODUCT");
const itemsOf = (o: R) => (t.order_items as R[]).filter(i => i.order_id === o.id);

describe("fechas", () => {
  it("«hoy» en Caracas a las 9 p. m. sigue siendo el mismo día", () => {
    expect(todayInCaracas(new Date("2026-11-20T01:00:00Z"))).toBe("2026-11-19"); // 9 p. m. del 19 en Caracas
    expect(todayInCaracas(new Date("2026-11-20T04:00:00Z"))).toBe("2026-11-20"); // medianoche
  });
  it("las fechas se corren a hoy", () => {
    const m = materialize(seed, "2026-11-19");
    const last = (m.tables.orders as R[]).map(o => o.opened_at as string).sort().at(-1)!;
    expect(todayInCaracas(new Date(last))).toBe("2026-11-19");
    const first = (m.tables.orders as R[]).map(o => o.opened_at as string).sort()[0];
    expect(todayInCaracas(new Date(first)) >= "2026-08-21").toBe(true); // dentro de 90 días
  });
});

describe("cuadre", () => {
  it("en cada orden: líneas − descuento + redondeo = total (±0,01)", () => {
    for (const o of t.orders as R[]) {
      const lines = itemsOf(o).reduce((a, i) => a + i.charged_ref_amount, 0);
      expect(Math.abs(lines - o.adjust_discount_ref + o.adjust_rounding_ref - o.total_ref), o.order_number).toBeLessThanOrEqual(0.01);
    }
  });
  it("órdenes cerradas: lo cobrado + lo financiado + lo adeudado = total", () => {
    for (const o of (t.orders as R[]).filter(o => o.status === "CLOSED")) {
      const paid = (t.payments as R[]).filter(p => p.order_id === o.id && !p.receivable_id).reduce((a, p) => a + p.value_ref, 0);
      const debt = (t.receivables as R[]).filter(r => r.order_id === o.id).reduce((a, r) => a + r.principal_ref, 0);
      expect(Math.abs(paid + debt - o.total_ref), o.order_number).toBeLessThanOrEqual(0.01);
    }
  });
  it("Ganancias suma lo mismo que el detalle por orden", () => {
    const cashea = new Set((t.cashea_sales as R[]).filter(c => c.status !== "CANCELLED").map(c => c.order_id));
    const closed = (t.orders as R[]).filter(o => o.status === "CLOSED");
    const toLine = (i: R) => ({ role: role(i), revenueRef: i.charged_ref_amount, costRef: i.total_cost_ref_snapshot, listRef: i.list_ref_amount, passThroughCostRef: i.pass_through_cost_ref, mechanicsRef: (i.worker_share_ref_snapshot ?? 0) + (i.assistant_bonus_ref_snapshot ?? 0), paidWithCashea: cashea.has(i.order_id) });
    const all = closed.flatMap(o => itemsOf(o).map(toLine));
    const total = sumProfit(all).total;
    const perOrder = closed.reduce((a, o) => a + itemsOf(o).reduce((b, i) => b + lineProfit(toLine(i)).profitRef, 0), 0);
    expect(Math.abs(total - perOrder)).toBeLessThanOrEqual(0.01 * closed.length);
    expect(total).toBeGreaterThan(0);
  });
  it("cuotas Cashea: inicial 40 % y cuotas que suman lo financiado", () => {
    for (const c of t.cashea_sales as R[]) {
      expect(c.gross_ref).toBeGreaterThanOrEqual(25);
      expect(Math.abs(c.initial_ref - c.gross_ref * 0.4)).toBeLessThanOrEqual(0.01);
      const inst = (t.cashea_installments as R[]).filter(i => i.cashea_sale_id === c.id);
      expect(inst).toHaveLength(3);
      expect(Math.abs(inst.reduce((a, i) => a + i.amount_ref, 0) - c.financed_ref)).toBeLessThanOrEqual(0.001);
    }
  });
  it("la existencia nunca queda negativa", () => {
    const stock = new Map<string, number>();
    for (const m of t.inventory_movements as R[]) stock.set(m.inventory_item_id, (stock.get(m.inventory_item_id) ?? 0) + m.quantity_delta);
    for (const [, q] of stock) expect(q).toBeGreaterThanOrEqual(0);
  });
});

describe("casos que deben existir", () => {
  const cases = (t.orders as R[]).map(o => o.demo_case).filter(Boolean);
  it.each([
    "Venta en efectivo con vuelto en dólares", "Pago mixto: Banco de Venezuela y efectivo en dólares", "Cashea con cuota vencida",
    "Crédito LC con abono", "Descuento de 15 % aprobado con PIN", "Redondeo del total hacia abajo", "Cambio de aceite con mano de obra gratis (85 %)",
    "Cambio de aceite con mano de obra cobrada", "Compra para el trabajo con recargo", "Litros sueltos: no pide placa",
  ])("%s", c => expect(cases).toContain(c));
  it("cuota Cashea vencida sin pagar", () => {
    expect((t.cashea_installments as R[]).some(i => i.status === "PENDING" && i.due_date < seed.anchor)).toBe(true);
  });
  it("artículo agotado y artículo sin precio", () => {
    const stock = new Map<string, number>();
    for (const m of t.inventory_movements as R[]) stock.set(m.inventory_item_id, (stock.get(m.inventory_item_id) ?? 0) + m.quantity_delta);
    expect((t.inventory_items as R[]).some(i => (stock.get(i.id) ?? 0) === 0)).toBe(true);
    expect((t.inventory_items as R[]).some(i => i.price_ref == null)).toBe(true);
  });
  it("litros sueltos no piden placa; cambio de aceite sí", () => {
    const toLine = (i: R) => ({ itemType: i.item_type, businessArea: i.business_area, quantity: i.quantity, description: i.description, category: (t.inventory_items as R[]).find(x => x.id === i.inventory_item_id)?.category, unit: (t.inventory_items as R[]).find(x => x.id === i.inventory_item_id)?.unit, manual: !i.inventory_item_id });
    const liters = (t.orders as R[]).find(o => o.demo_case === "Litros sueltos: no pide placa")!;
    const oil = (t.orders as R[]).find(o => o.demo_case === "Cambio de aceite con mano de obra gratis (85 %)")!;
    expect(needsPlateCapture(itemsOf(liters).map(toLine))).toBe(false);
    expect(needsPlateCapture(itemsOf(oil).map(toLine))).toBe(true);
  });
  it("vehículos en todos los tramos de Recuperar y una cita hoy", () => {
    const last = new Map<string, R>();
    for (const s of t.service_records as R[]) { const p = last.get(s.vehicle_id); if (!p || s.performed_at > p.performed_at) last.set(s.vehicle_id, s); }
    const anchorMs = Date.parse(`${seed.anchor}T12:00:00Z`);
    const buckets = new Set([...last.values()].map(s => recoveryBucket(Math.round((anchorMs - Date.parse(`${s.next_service_date}T12:00:00Z`)) / 86400000))));
    for (const b of ["SOON", "D0_30", "D31_90", "D91_180", "D181_365", "D365P"]) expect(buckets, b).toContain(b);
    expect((t.customer_followups as R[]).some(f => f.outcome === "BOOKED" && f.outcome_on === seed.anchor)).toBe(true);
  });
});

describe("privacidad de la semilla", () => {
  const text = JSON.stringify(seedJson);
  it("sin patrones de datos reales", () => {
    expect(text).not.toMatch(/@(?!ejemplo\.com|lubricenter\.ejemplo)[a-z0-9-]+\.[a-z]{2,}/i);   // solo correos @ejemplo.com
    expect(text).not.toMatch(/\b04(12|14|16|24|26)-(?!000-)\d{3}-\d{4}\b/);                    // teléfonos solo 0414-000-xxxx
    expect(text).not.toMatch(/\b[VE]-?\d{6,9}\b/);                                               // cédulas
    expect(text).not.toMatch(/\b[JGVE]-?\d{8}-?\d\b/);                                           // RIF
    expect(text).not.toMatch(/\b\d{20}\b/);                                                      // cuentas bancarias
    expect(text).not.toMatch(/\bOS-\d|supabase|railway|notion|eyJ/i);
  });
  it("placas con prefijo ficticio ZX", () => {
    for (const v of t.vehicles as R[]) expect(v.plate).toMatch(/^ZX\d{3}[A-Z]{2}$/);
  });
});
