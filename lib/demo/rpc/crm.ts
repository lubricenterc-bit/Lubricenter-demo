import type { Ctx, Handler } from "./ctx";

/** Resumen del Seguimiento para Inicio. */
export function journeysToday(c: Ctx) {
  const j = c.view("crm_vehicle_journeys");
  return {
    ready: j.filter(r => r.status === "READY").length,
    due: j.filter(r => Number(r.days_from_due) >= 0 && Number(r.days_from_due) <= 30 && r.status === "READY").length,
    soon: j.filter(r => Number(r.days_from_due) < 0 && Number(r.days_from_due) >= -15).length,
    recover: j.filter(r => Number(r.days_from_due) > 30 && !["RETURNED", "CLOSED", "OPTED_OUT"].includes(String(r.status))).length,
    booked: j.filter(r => r.status === "BOOKED" && r.last_outcome_on === c.today).length,
  };
}

const sentToday = (c: Ctx) => c.t("customer_followups").filter(f => f.sent_at && new Date(Date.parse(String(f.sent_at)) - 4 * 3600000).toISOString().slice(0, 10) === c.today).length;

export const crm: Record<string, Handler> = {
  crm_today_count: (_a, c) => {
    const j = journeysToday(c); const cap = c.setting("crm_daily_cap", 15);
    return { to_send: Math.min(j.ready, Math.max(0, cap - sentToday(c))), booked_today: j.booked, to_recover: j.recover, sent_today: sentToday(c), cap, to_confirm: 0 };
  },
};
