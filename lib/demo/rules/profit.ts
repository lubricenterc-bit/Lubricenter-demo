import { D, r2, r4 } from "./money";
import { DEMO_SETTINGS as S } from "./settings";

export type LineRole = "PRODUCT" | "LABOR" | "OIL_LABOR" | "PASS_THROUGH" | "CASHEA_SURCHARGE";
export type ProfitLine = {
  role: LineRole; revenueRef: number; costRef?: number | null; listRef?: number | null;
  passThroughCostRef?: number | null; mechanicsRef?: number; paidWithCashea?: boolean;
};

/**
 * Ganancia por línea (igual que la vista order_line_economics):
 * tienda = precio − costo (sin costo real: precio ÷ 1,35, marcado «costo estimado»);
 * taller = mano de obra − mecánicos − comisión Cashea (solo si se pagó con Cashea);
 * compra para el trabajo = solo el recargo.
 */
export function lineProfit(l: ProfitLine) {
  const area = l.role === "LABOR" || l.role === "CASHEA_SURCHARGE" ? "TALLER" : "TIENDA";
  const estimated = l.role === "PRODUCT" && !(l.costRef && l.costRef > 0);
  const cost = l.role === "PRODUCT"
    ? (estimated ? new D(l.listRef ?? l.revenueRef).div(1 + S.storeMarkupPercent / 100) : new D(l.costRef!))
    : l.role === "PASS_THROUGH" ? new D(l.passThroughCostRef ?? l.revenueRef) : new D(0);
  const mechanics = new D(l.mechanicsRef ?? 0);
  const cashea = l.paidWithCashea && area === "TALLER" ? new D(l.revenueRef).mul(S.casheaCommissionPercent).div(100) : new D(0);
  const profit = new D(l.revenueRef).minus(cost).minus(mechanics).minus(cashea);
  return { area, estimated, costRef: r4(cost), casheaRef: r4(cashea), mechanicsRef: r4(mechanics), profitRef: r4(profit) } as const;
}

export function sumProfit(lines: ProfitLine[]) {
  const out = { TIENDA: new D(0), TALLER: new D(0) };
  for (const l of lines) { const p = lineProfit(l); out[p.area] = out[p.area].plus(p.profitRef); }
  return { tienda: r2(out.TIENDA), taller: r2(out.TALLER), total: r2(out.TIENDA.plus(out.TALLER)) };
}
