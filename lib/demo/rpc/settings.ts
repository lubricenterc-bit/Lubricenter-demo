// Configuración: recibo, reglas de cobro y redondeo de precios. El PIN y las tasas de la
// muestra son fijos y se muestran como tales.
import { notifyUnavailable } from "../store";
import { DEMO_SETTINGS } from "../rules/settings";
import { fail, type Ctx, type Handler } from "./ctx";

function set(c: Ctx, key: string, value: unknown) {
  const row = c.t("app_settings").find(s => s.key === key);
  if (row) { row.value = value; row.updated_at = c.now(); } else c.insert("app_settings", { key, value, updated_at: c.now() });
}
const range = (v: unknown, lo: number, hi: number, label: string) => { const n = Number(v); if (!(n >= lo && n <= hi)) fail(`${label} debe estar entre ${lo} y ${hi}.`); return n; };

/** Función que existe en el sistema pero no en la muestra: avisa y explica. */
const notInDemo = (what: string): Handler => () => { notifyUnavailable(what); return fail(`${what} está en la versión completa de Lubricenter OS.`); };

export const settings: Record<string, Handler> = {
  set_receipt_settings: (a, c) => {
    const h = (a.p_header ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(h)) if (typeof v === "string" && v.length > 120) fail(`El campo ${k} es demasiado largo.`);
    set(c, "receipt_header", h); set(c, "receipt_total_style", a.p_total_style === "BORDER" ? "BORDER" : "BLOCK"); c.commit();
    return { header: h, total_style: a.p_total_style };
  },
  set_billing_settings: (a, c) => {
    set(c, "discount_free_limit_percent", range(a.p_discount_free_limit_percent, 0, 50, "El descuento libre"));
    set(c, "cashea_opportunity_monthly_percent", range(a.p_cashea_opportunity_monthly_percent, 0, 20, "El costo de esperar las cuotas (r)"));
    set(c, "cashea_financing_days", range(a.p_cashea_financing_days, 0, 120, "Los días de financiamiento"));
    set(c, "store_markup_percent", range(a.p_store_markup_percent, 0, 200, "El margen de tienda"));
    c.commit(); return null;
  },
  set_pricing_settings: (a, c) => { set(c, "price_rounding_step", Number(a.p_rounding_step ?? 0)); set(c, "price_rounding_mode", a.p_rounding_mode ?? "NONE"); c.commit(); return null; },
  set_owner_pin: () => fail(`En la muestra el PIN es fijo (${DEMO_SETTINGS.demoPin}) para que cualquiera pueda probar los descuentos.`),
  set_operative_manual: () => fail("En la muestra las tasas son de ejemplo y fijas (BCV 200 y operativa 250)."),

  // Pantallas de inicio y finanzas que consultan módulos fuera de la muestra.
  labor_proposals_list: () => [],
  finance_reconcile: () => ({ matched: 0, reviewed: 0 }),
  finance_outflow: notInDemo("Registrar gastos"),
  record_supplier_payment: notInDemo("Registrar pagos a proveedores"),
  apply_customer_balance: notInDemo("Usar el saldo a favor del cliente"),
  record_customer_balance_deposit: notInDemo("Los saldos a favor"),
  refund_customer_balance: notInDemo("Los saldos a favor"),
  cancel_order_to_customer_balance: notInDemo("Anular dejando saldo a favor"),
};
