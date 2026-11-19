import { DEMO_SETTINGS } from "../rules/settings";
import { journeysToday } from "./crm";
import { fail, type Handler } from "./ctx";

const NAMES = { OWNER: "Dueño", ADMIN: "Administración", RECEPTION: "Recepción", MECHANIC: "Mecánico de taller" } as const;
const day = (iso: unknown) => new Date(Date.parse(String(iso)) - 4 * 3600000).toISOString().slice(0, 10);

export const session: Record<string, Handler> = {
  my_profile: (_a, c) => ({ profile: c.profile, name: NAMES[c.profile], staff_user_id: `stf-${c.profile.toLowerCase()}`, employee_id: c.profile === "MECHANIC" ? "emp-mecanico" : null, device: null, job_title: NAMES[c.profile], permissions: [], sensitive_until: null }),
  finance_role: (_a, c) => (c.profile === "OWNER" || c.profile === "ADMIN" ? c.profile : "OPERATOR"),
  can_administer_orders: (_a, c) => c.profile === "OWNER" || c.profile === "ADMIN",
  unlock_sensitive: (a, c) => {
    if (a.p_pin !== DEMO_SETTINGS.demoPin) fail(`PIN incorrecto. En la muestra el PIN es ${DEMO_SETTINGS.demoPin}.`);
    return new Date(Date.now() + 15 * 60000).toISOString();
  },
  lock_sensitive: () => null,
  tunnel_pending_summary: () => ({ total: 0, items: [] }),

  get_current_rates: (_a, c) => [{ bcv_rate: c.rates.bcv, operative_rate: c.rates.operative }],
  get_order_rates: (a, c) => { const o = c.byId("orders", a.p_order_id); return [{ bcv_rate: o?.sale_bcv_rate ?? c.rates.bcv, operative_rate: o?.sale_operative_rate ?? c.rates.operative }]; },
  get_exchange_rates_for_date: (_a, c) => [{ bcv_rate: c.rates.bcv, operative_rate: c.rates.operative, bcv_date: c.today, operative_date: c.today }],
  get_exchange_rate_history: (a, c) => {
    const out = []; const to = String(a.p_to ?? c.today); let d = String(a.p_from ?? c.today);
    for (let i = 0; i < 120 && d <= to; i++) { out.push({ business_date: d, bcv_rate: c.rates.bcv, operative_rate: c.rates.operative, bcv_date: d, operative_date: d }); d = new Date(Date.parse(`${d}T12:00:00Z`) + 86400000).toISOString().slice(0, 10); }
    return out.reverse();
  },
  get_pricing_sync_status: (_a, c) => [{ catalog_synced_at: c.now(), catalog_products: c.t("inventory_items").length, bcv_rate: c.rates.bcv, bcv_effective_at: `${c.today}T12:00:00.000Z`, operative_rate: c.rates.operative, operative_effective_at: `${c.today}T12:00:00.000Z` }],
  get_exchange_rate_control_status: (_a, c) => ({ exchange_rate_authority: "MANUAL", bcv_rate: c.rates.bcv, operative_rate: c.rates.operative, bcv_effective_at: `${c.today}T12:00:00.000Z`, operative_effective_at: `${c.today}T12:00:00.000Z`, last_success_at: c.now(), example: true }),
  get_bcv_official_status: (_a, c) => ({ rate: c.rates.bcv, effective_date: c.today, checked_at: c.now(), ok: true, example: true }),
  inventory_sale_policy: (_a, c) => ({ strict: true, can_override: c.profile === "OWNER" || c.profile === "ADMIN" }),

  dashboard_overview: (_a, c) => {
    const orders = c.t("orders");
    const closedToday = orders.filter(o => o.status === "CLOSED" && day(o.business_at ?? o.closed_at) === c.today);
    const payToday = c.t("payments").filter(p => day(p.paid_at) === c.today);
    const open = orders.filter(o => o.status === "OPEN");
    const wf = (s: string) => open.filter(o => o.workflow_status === s).length;
    const recv = c.t("receivables").filter(r => r.status === "OPEN" && r.debtor_type !== "CASHEA");
    const stock = c.view("inventory_current");
    const j = journeysToday(c);
    return [{
      local_date: c.today, closed_orders_today: closedToday.length,
      sales_ves_today: closedToday.reduce((a, o) => a + Number(o.total_ves), 0), sales_ref_today: closedToday.reduce((a, o) => a + Number(o.total_ref), 0),
      collected_ves_today: payToday.reduce((a, p) => a + Number(p.value_ves), 0), collected_ref_today: payToday.reduce((a, p) => a + Number(p.value_ref), 0),
      open_orders: open.length, active_vehicles: open.filter(o => o.vehicle_id).length,
      vehicles_received: wf("RECEIVED"), vehicles_diagnosis: wf("DIAGNOSIS"), vehicles_in_progress: wf("IN_PROGRESS"), vehicles_waiting_parts: wf("WAITING_PART"), vehicles_ready: wf("READY"),
      post_service_action: 0, maintenance_due: j.due, maintenance_soon: j.soon,
      receivables_open: recv.length, receivables_outstanding_ves: recv.reduce((a, r) => a + Number(r.outstanding_ves), 0),
      payroll_pending_ref: 0, inventory_review: stock.filter(i => i.needs_review || i.current_ref_bcv == null).length, inventory_negative: stock.filter(i => Number(i.quantity_on_hand) < 0).length,
      bcv_rate: c.rates.bcv, operative_rate: c.rates.operative,
    }];
  },
};
