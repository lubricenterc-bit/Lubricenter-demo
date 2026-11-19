// Ganancias: suma simple de la ganancia de cada línea, separada en tienda y taller.
import { linesOf, localDay, r2 } from "../domain/order-engine";
import { lineEconomics, roleOf } from "./orders";
import { fail, type Handler } from "./ctx";

export const profit: Record<string, Handler> = {
  finance_profit_report: (a, c) => {
    if (!a.p_from || !a.p_to || a.p_from > a.p_to) fail("Rango de fechas inválido.");
    const orders = c.t("orders").filter(o => o.status === "CLOSED" && localDay(o.business_at ?? o.closed_at) >= a.p_from && localDay(o.business_at ?? o.closed_at) <= a.p_to);
    const lines = orders.flatMap(o => linesOf(c, o.id).map(i => ({ o, i, role: roleOf(i), e: lineEconomics(c, i) })));
    const area = (name: "TIENDA" | "TALLER") => {
      const xs = lines.filter(x => x.e.area === name);
      if (!xs.length) return undefined;
      return { revenue_ref: r2(xs.reduce((s, x) => s + Number(x.i.charged_ref_amount), 0)), cost_ref: r2(xs.reduce((s, x) => s + x.e.costRef, 0)),
        mechanics_ref: r2(xs.reduce((s, x) => s + x.e.mechanicsRef, 0)), cashea_commission_ref: r2(xs.reduce((s, x) => s + x.e.casheaRef, 0)), profit_ref: r2(xs.reduce((s, x) => s + x.e.profitRef, 0)),
        lines: xs.length, orders: new Set(xs.map(x => x.o.id)).size, estimated_cost_ref: r2(xs.filter(x => x.e.estimated).reduce((s, x) => s + x.e.costRef, 0)) || null,
        pass_through_revenue_ref: r2(xs.filter(x => x.role === "PASS_THROUGH").reduce((s, x) => s + Number(x.i.charged_ref_amount), 0)) || null };
    };
    const days = [...new Set(lines.map(x => localDay(x.o.business_at)))].sort();
    const daily = days.map(d => ({ day: d,
      tienda: r2(lines.filter(x => localDay(x.o.business_at) === d && x.e.area === "TIENDA").reduce((s, x) => s + x.e.profitRef, 0)),
      taller: r2(lines.filter(x => localDay(x.o.business_at) === d && x.e.area === "TALLER").reduce((s, x) => s + x.e.profitRef, 0)) }));
    const group = new Map<string, { description: string; quantity: number; revenue_ref: number; profit_ref: number; cost_estimated: boolean }>();
    for (const x of lines.filter(x => x.e.area === "TIENDA" && x.role === "PRODUCT")) {
      const g = group.get(String(x.i.description)) ?? { description: String(x.i.description), quantity: 0, revenue_ref: 0, profit_ref: 0, cost_estimated: false };
      g.quantity += Number(x.i.quantity); g.revenue_ref = r2(g.revenue_ref + Number(x.i.charged_ref_amount)); g.profit_ref = r2(g.profit_ref + x.e.profitRef); g.cost_estimated ||= x.e.estimated;
      group.set(g.description, g);
    }
    const missing = new Map<string, { description: string; revenue_ref: number; lines: number }>();
    for (const x of lines.filter(x => x.e.estimated)) { const m = missing.get(String(x.i.description)) ?? { description: String(x.i.description), revenue_ref: 0, lines: 0 }; m.revenue_ref = r2(m.revenue_ref + Number(x.i.charged_ref_amount)); m.lines++; missing.set(m.description, m); }
    return {
      period: { from: a.p_from, to: a.p_to }, areas: { TIENDA: area("TIENDA"), TALLER: area("TALLER") },
      total_profit_ref: r2(lines.reduce((s, x) => s + x.e.profitRef, 0)), orders: orders.length, daily,
      top_store: [...group.values()].sort((x, y) => y.profit_ref - x.profit_ref).slice(0, 10),
      top_workshop: lines.filter(x => x.role === "LABOR").sort((x, y) => y.e.profitRef - x.e.profitRef).slice(0, 5).map(x => ({ order_number: x.o.order_number, description: x.i.description, revenue_ref: Number(x.i.charged_ref_amount), profit_ref: x.e.profitRef })),
      missing_cost: [...missing.values()].sort((x, y) => y.revenue_ref - x.revenue_ref).slice(0, 15),
      lines: lines.sort((x, y) => String(y.o.business_at).localeCompare(String(x.o.business_at))).map(x => ({ order_id: x.o.id, order_number: x.o.order_number, day: localDay(x.o.business_at), area: x.e.area, role: x.role, description: x.i.description,
        revenue_ref: Number(x.i.charged_ref_amount), cost_ref: x.e.costRef, mechanics_ref: x.e.mechanicsRef, cashea_ref: x.e.casheaRef, profit_ref: x.e.profitRef, estimated: x.e.estimated })),
    };
  },
  // Líneas viejas que podrían estar mal clasificadas (recargos Cashea escritos a mano).
  profit_review_candidates: (_a, c) => c.t("order_items").filter(i => !i.line_role && i.pricing_mode === "MANUAL_NO_STOCK" && /(ajuste|importe adicional|recargo).*cashea|compra para/i.test(String(i.description)))
    .map(i => { const o = c.byId("orders", i.order_id); return { order_item_id: i.id, order_id: i.order_id, order_number: o?.order_number, business_at: o?.business_at, description: i.description, charged_ref: Number(i.charged_ref_amount), role_now: roleOf(i), suggested_role: /cashea/i.test(String(i.description)) ? "CASHEA_SURCHARGE" : "PASS_THROUGH", reason: "Línea escrita a mano que parece un recargo o una compra para el trabajo." }; }),
};
