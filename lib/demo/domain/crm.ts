// Seguimiento: recorrido de cada vehículo desde su último cambio de aceite
// (equivale a la vista crm_vehicle_journeys). Las reglas salen de rules/crm.ts.
import type { DemoState, Row } from "../store";
import { firstKind, maxMessages, recoveryBucket, type MessageKind } from "../rules/crm";

const dayMs = 86400000;
const toDay = (iso: string) => new Date(Date.parse(iso) - 4 * 3600000).toISOString().slice(0, 10);
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / dayMs);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * dayMs).toISOString().slice(0, 10);
export const waPhone = (p: unknown) => { const d = String(p ?? "").replace(/\D/g, ""); return d ? (d.startsWith("0") ? "58" + d.slice(1) : d) : ""; };

export function lastServices(s: DemoState) {
  const last = new Map<string, Row>();
  for (const r of s.tables.service_records ?? []) {
    if (r.service_type !== "OIL_CHANGE" || !r.vehicle_id) continue;
    const p = last.get(r.vehicle_id as string);
    if (!p || String(r.performed_at) > String(p.performed_at)) last.set(r.vehicle_id as string, r);
  }
  return last;
}

export function vehicleJourneys(s: DemoState): Row[] {
  const today = s.today;
  const customers = new Map((s.tables.customers ?? []).map(c => [c.id, c]));
  const vehicles = new Map((s.tables.vehicles ?? []).map(v => [v.id, v]));
  const perms = new Map((s.tables.crm_contact_permissions ?? []).map(p => [p.customer_id, p.status]));
  const follow = s.tables.customer_followups ?? [];
  const out: Row[] = [];
  for (const sr of lastServices(s).values()) {
    const v = vehicles.get(sr.vehicle_id); const c = customers.get(v?.customer_id ?? sr.customer_id);
    if (!v) continue;
    const cycleDue = (sr.next_service_date as string) ?? addDays(toDay(sr.performed_at as string), 90);
    const days = diffDays(today, cycleDue);
    const sent = follow.filter(f => f.service_record_id === sr.id && f.sent_at).sort((a, b) => String(a.sent_at).localeCompare(String(b.sent_at)));
    const last = sent.at(-1);
    const withOutcome = [...follow.filter(f => f.service_record_id === sr.id && f.outcome)].sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at))).at(-1);
    const first = (sent[0]?.kind as MessageKind | undefined) ?? firstKind(days) ?? "DUE";
    const max = maxMessages(first);
    const lastDay = last ? toDay(last.sent_at as string) : null;
    let nextKind: string | null = null;
    if (sent.length === 0) nextKind = firstKind(days);
    else if (sent.length < max) nextKind = sent.length === 1 && first === "PRE" ? "DUE" : "FINAL";
    const eligible = sent.length === 0 ? addDays(cycleDue, -7) : lastDay ? addDays(lastDay, sent.length === 1 ? 10 : 14) : null;
    const outcome = withOutcome?.outcome as string | undefined;
    const phone = c?.phone as string | null;
    const permission = perms.get(c?.id) ?? "IMPLIED";
    let status: string;
    if (!phone) status = "NO_PHONE";
    else if (permission === "OPT_OUT") status = "OPTED_OUT";
    else if (outcome === "BOOKED" && withOutcome?.outcome_on && String(withOutcome.outcome_on) >= today) status = "BOOKED";
    else if (outcome === "RETURNED") status = "RETURNED";
    else if (outcome === "DECLINED" || outcome === "SOLD_VEHICLE") status = "CLOSED";
    else if (sent.length && !outcome && nextKind && eligible && eligible > today) status = "WAITING_REPLY";
    else if (sent.length >= max && !outcome) status = days > 365 ? "DORMANT" : "CLOSED_NO_REPLY";
    else if (days < -7) status = "UPCOMING";
    else if (nextKind && eligible && eligible > today) status = "SCHEDULED";
    else status = days > 365 && sent.length === 0 ? "DORMANT" : "READY";
    out.push({
      service_record_id: sr.id, vehicle_id: v.id, customer_id: c?.id ?? null, customer_name: c?.name ?? null, customer_phone: phone, wa_phone: waPhone(phone),
      plate: v.plate, make: v.make, model: v.model, year: v.year, performed_at: sr.performed_at, oil_brand: sr.oil_brand, oil_viscosity: sr.oil_viscosity,
      next_service_odometer: sr.next_service_odometer, cycle_due: cycleDue, days_from_due: days, forecast_confidence: "MEDIUM", due_reason: "CALENDAR",
      permission, sent_count: sent.length, max_msgs: sent.length ? max : null, last_sent_at: last?.sent_at ?? null, next_kind: nextKind, eligible_on: eligible,
      last_outcome: outcome ?? null, last_outcome_on: withOutcome?.outcome_on ?? null, awaiting_reply: status === "WAITING_REPLY", status,
      bucket: recoveryBucket(days),
    });
  }
  return out;
}

/** Pronóstico de próximo cambio por vehículo (vista vehicle_oil_usage_forecasts), simplificado. */
export function oilForecasts(s: DemoState): Row[] {
  const out: Row[] = [];
  for (const sr of lastServices(s).values()) {
    const due = (sr.next_service_date as string) ?? addDays(toDay(sr.performed_at as string), 90);
    out.push({ service_record_id: sr.id, vehicle_id: sr.vehicle_id, customer_id: sr.customer_id, last_service_date: toDay(sr.performed_at as string), last_odometer: sr.odometer,
      due_km: sr.next_service_odometer, calendar_due_date: due, service_count: (s.tables.service_records ?? []).filter(x => x.vehicle_id === sr.vehicle_id).length,
      mileage_points: 1, slope_pairs: 0, odometer_regressions: 0, km_per_day: 45, days_per_5000km: 111, typical_visit_days: 95,
      projected_km_due_date: due, projected_habit_due_date: due, recommended_due_date: due, confidence: "MEDIUM", due_reason: "CALENDAR" });
  }
  return out;
}
