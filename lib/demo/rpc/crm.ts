// Seguimiento: a quién escribir hoy, Recuperar por tramos, mensajes con plantilla,
// resultados y tope diario. WhatsApp está simulado: se registra el envío, no sale nada.
import { localDay, r2 } from "../domain/order-engine";
import { RECOVERY_BUCKETS } from "../rules/crm";
import type { Row } from "../store";
import { fail, type Ctx, type Handler } from "./ctx";

const KIND_TEXT: Record<string, string> = {
  PRE: "Le toca pronto el cambio de aceite", DUE: "Le toca el cambio de aceite", FINAL: "Último mensaje del ciclo", RECOVERY: "No vuelve desde hace tiempo", RECONNECT: "Cliente para reconectar",
};
const FALLBACK: Record<string, string> = {
  AGREED: "¡Hola, {{nombre}}! Te esperamos en la fecha acordada para el cambio de aceite de tu *{{vehiculo}}* ({{placa}}).",
  SECOND: "¡Hola, {{nombre}}! Te escribimos hace un tiempo por tu *{{vehiculo}}* ({{placa}}). ¿Te ayudamos con el cambio de aceite?",
};

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

const sentToday = (c: Ctx) => c.t("customer_followups").filter(f => f.status === "SENT" && f.sent_at && localDay(f.sent_at) === c.today).length;
const cap = (c: Ctx) => Number(c.setting("crm_daily_cap", 15));
const firstName = (n: unknown) => String(n ?? "").trim().split(/\s+/)[0] || "";

function template(c: Ctx, kind: string) {
  return String(c.t("crm_message_templates").find(t => t.kind === kind)?.body ?? FALLBACK[kind] ?? c.t("crm_message_templates").find(t => t.kind === "DUE")?.body ?? "");
}

function queueItem(c: Ctx, j: Row) {
  const kind = String(j.next_kind ?? "DUE");
  const vehicle = [j.make, j.model].filter(Boolean).join(" ") || "vehículo";
  const message = template(c, kind).replaceAll("{{nombre}}", firstName(j.customer_name)).replaceAll("{{vehiculo}}", vehicle).replaceAll("{{placa}}", String(j.plate ?? ""));
  const days = Number(j.days_from_due);
  const why = days < 0 ? `Le toca el cambio en ${-days} días` : days === 0 ? "Le toca el cambio hoy" : days <= 365 ? `Le tocaba el cambio hace ${days} días` : `No vuelve desde hace más de un año`;
  return { type: "REMINDER", id: j.service_record_id, vehicle_id: j.vehicle_id, customer_id: j.customer_id, customer_name: j.customer_name, phone: j.customer_phone, wa_phone: j.wa_phone,
    vehicle, plate: j.plate, kind, step: Number(j.sent_count) + 1, max_steps: j.max_msgs ?? (kind === "PRE" ? 3 : kind === "RECONNECT" ? 1 : 2), why: `${KIND_TEXT[kind] ?? ""} · ${why}`, warning: null, message, last_sent_at: j.last_sent_at };
}

const priority = (j: Row) => (j.next_kind === "PRE" || j.next_kind === "DUE" ? 0 : 1) * 1000 + Math.abs(Number(j.days_from_due));
const readyJourneys = (c: Ctx) => c.view("crm_vehicle_journeys").filter(j => j.status === "READY" && j.wa_phone).sort((a, b) => priority(a) - priority(b));

function latestFollowup(c: Ctx, srId: unknown) {
  return c.t("customer_followups").filter(f => f.service_record_id === srId).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).at(-1) ?? null;
}

export const crm: Record<string, Handler> = {
  crm_today_count: (_a, c) => {
    const j = journeysToday(c);
    return { to_send: Math.min(j.ready, Math.max(0, cap(c) - sentToday(c))), booked_today: j.booked, to_recover: j.recover, sent_today: sentToday(c), cap: cap(c), to_confirm: c.t("customer_followups").filter(f => f.status === "OPEN").length };
  },
  crm_board: (_a, c) => {
    const j = c.view("crm_vehicle_journeys");
    const remaining = Math.max(0, cap(c) - sentToday(c));
    const ready = readyJourneys(c);
    const pending = c.t("customer_followups").filter(f => f.status === "OPEN").map(f => { const jr = j.find(x => x.service_record_id === f.service_record_id); return jr ? { ...queueItem(c, jr), attempt_id: f.id, opened_at: f.created_at, mine: true } : null; }).filter(Boolean);
    return {
      today: c.today, cap: cap(c), sent_today: sentToday(c), remaining, ready_total: ready.length,
      queue: ready.slice(0, remaining).map(x => queueItem(c, x)), pending,
      waiting: j.filter(x => x.status === "WAITING_REPLY").map(x => ({ id: x.service_record_id, customer_id: x.customer_id, customer_name: x.customer_name, phone: x.customer_phone, wa_phone: x.wa_phone, vehicle: [x.make, x.model].filter(Boolean).join(" "), plate: x.plate, sent_count: x.sent_count, last_sent_at: x.last_sent_at, eligible_on: x.eligible_on, status: x.status })),
      booked: j.filter(x => x.status === "BOOKED").map(x => ({ id: x.service_record_id, customer_name: x.customer_name, phone: x.customer_phone, wa_phone: x.wa_phone, vehicle: [x.make, x.model].filter(Boolean).join(" "), plate: x.plate, date: x.last_outcome_on })),
      fix: c.t("customers").filter(cu => !cu.phone && c.t("vehicles").some(v => v.customer_id === cu.id)).map(cu => ({ customer_id: cu.id, customer_name: cu.name, phone: null, vehicles: c.t("vehicles").filter(v => v.customer_id === cu.id).map(v => v.plate).join(", "), flagged: false })),
    };
  },
  crm_bucket_queue: (a, c) => {
    const rows = c.view("crm_vehicle_journeys").filter(j => j.bucket === a.p_bucket && j.status === "READY" && j.wa_phone).sort((x, y) => Number(x.days_from_due) - Number(y.days_from_due));
    const remaining = Math.max(0, cap(c) - sentToday(c));
    const take = a.p_limit === 0 ? 0 : Math.min(remaining, a.p_limit ?? remaining);
    return { bucket: a.p_bucket, cap: cap(c), sent_today: sentToday(c), remaining, eligible: rows.length, reserved_post_service: 0, queue: rows.slice(0, take).map(j => queueItem(c, j)) };
  },
  crm_queue_item: (a, c) => {
    const j = c.view("crm_vehicle_journeys").find(x => x.service_record_id === a.p_service_record_id) ?? fail("No se encontró el vehículo.");
    if (!j!.wa_phone) fail("Este cliente no tiene WhatsApp. Corrígelo en su ficha.");
    return { ...queueItem(c, { ...j!, next_kind: j!.next_kind ?? "RECOVERY" }), sent_today: sentToday(c), cap: cap(c) };
  },
  crm_recovery_summary: (_a, c) => {
    const j = c.view("crm_vehicle_journeys");
    const value = (custId: unknown) => c.t("orders").filter(o => o.status === "CLOSED" && o.customer_id === custId).reduce((s, o) => s + Number(o.total_ref), 0);
    return RECOVERY_BUCKETS.map(b => {
      const xs = j.filter(x => x.bucket === b.code);
      const ok = xs.filter(x => x.status !== "NO_PHONE");
      return { bucket: b.code, label: b.label, vehicles: ok.length, customers: new Set(ok.map(x => x.customer_id)).size, contacted: ok.filter(x => Number(x.sent_count) > 0).length,
        awaiting_reply: ok.filter(x => x.awaiting_reply).length, lifetime_ref: r2([...new Set(ok.map(x => x.customer_id as string))].reduce((s: number, id) => s + value(id), 0)), estimated: 0,
        no_phone: xs.filter(x => x.status === "NO_PHONE").length, dormant: xs.filter(x => x.status === "DORMANT").length, second_pending: xs.filter(x => x.status === "CLOSED_NO_REPLY").length };
    });
  },
  crm_recovery_list: (a, c) => {
    const q = String(a.p_query ?? "").toLowerCase();
    let rows = c.view("crm_vehicle_journeys").filter(x => (a.p_bucket === "POOL" ? ["CLOSED_NO_REPLY", "DORMANT"].includes(String(x.status)) : x.bucket === a.p_bucket))
      .filter(x => !q || [x.customer_name, x.plate, x.make, x.model].some(v => String(v ?? "").toLowerCase().includes(q)));
    rows = rows.sort((x, y) => a.p_sort === "VALUE" ? 0 : Number(x.days_from_due) - Number(y.days_from_due));
    const off = Number(a.p_offset ?? 0), lim = Number(a.p_limit ?? 50);
    return { total: rows.length, rows: rows.slice(off, off + lim).map(x => {
      const os = c.t("orders").filter(o => o.status === "CLOSED" && o.customer_id === x.customer_id);
      return { service_record_id: x.service_record_id, vehicle_id: x.vehicle_id, customer_id: x.customer_id, customer_name: x.customer_name, wa_phone: x.wa_phone || null, plate: x.plate, make: x.make, model: x.model,
        performed_at: x.performed_at, cycle_due: x.cycle_due, days_from_due: x.days_from_due, estimated: false, oil_brand: x.oil_brand, oil_viscosity: x.oil_viscosity, sent_count: x.sent_count, last_sent_at: x.last_sent_at,
        last_outcome: x.last_outcome, status: x.status, eligible_on: x.eligible_on, lifetime_ref: r2(os.reduce((s, o) => s + Number(o.total_ref), 0)), visits: os.length };
    }) };
  },
  crm_results: (a, c) => {
    const days = Number(a.p_days ?? 30);
    const from = new Date(Date.parse(`${c.today}T12:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
    const f = c.t("customer_followups").filter(x => x.status === "SENT" && x.sent_at && localDay(x.sent_at) >= from);
    const oil = c.t("orders").filter(o => o.status === "CLOSED" && localDay(o.business_at) >= from && c.t("order_items").some(i => i.order_id === o.id && i.business_area === "OIL_CHANGE" && i.item_type === "SERVICE"));
    const returned = f.filter(x => x.outcome === "RETURNED" || c.t("service_records").some(s => s.vehicle_id === x.vehicle_id && String(s.performed_at) > String(x.sent_at)));
    return { days, reminders_sent: f.length, post_service_sent: 0, answered: f.filter(x => x.outcome).length, booked: f.filter(x => x.outcome === "BOOKED").length, opted_out: c.t("crm_contact_permissions").filter(p => p.status === "OPT_OUT").length,
      returned: returned.length, returned_ref: r2(returned.reduce((s, x) => s + Number(c.t("orders").filter(o => o.vehicle_id === x.vehicle_id && o.status === "CLOSED" && String(o.business_at) > String(x.sent_at)).reduce((t, o) => t + Number(o.total_ref), 0)), 0)),
      oil_orders: oil.length, oil_orders_with_vehicle: oil.filter(o => o.vehicle_id).length, oil_orders_skipped: c.t("crm_capture_skips").length };
  },

  crm_open_send: (a, c) => {
    if (sentToday(c) >= cap(c)) fail(`Llegaste al máximo de mensajes de hoy (${cap(c)}). Mañana siguen.`);
    const sr = c.byId("service_records", a.p_id);
    const f = c.insert("customer_followups", { id: c.id("fu"), service_record_id: a.p_id, vehicle_id: sr?.vehicle_id ?? null, customer_id: sr?.customer_id ?? null, kind: a.p_kind, status: "OPEN", message: a.p_message, sent_at: null, created_at: c.now(), updated_at: c.now(), outcome: null, outcome_on: null });
    c.commit(); return { attempt_id: f.id, crm_daily_cap: cap(c) };
  },
  crm_confirm_send: (a, c) => {
    const f = c.byId("customer_followups", a.p_attempt_id) ?? fail("No se encontró el envío.");
    if (a.p_sent) Object.assign(f!, { status: "SENT", sent_at: c.now(), updated_at: c.now() });
    else c.s.tables.customer_followups = c.t("customer_followups").filter(x => x.id !== f!.id);
    c.commit(); return a.p_sent ? "SENT" : "CANCELLED";
  },
  crm_dismiss: (a, c) => {
    const sr = c.byId("service_records", a.p_id);
    c.insert("customer_followups", { id: c.id("fu"), service_record_id: a.p_id, vehicle_id: sr?.vehicle_id ?? null, customer_id: sr?.customer_id ?? null, kind: "DISMISS", status: "DISMISSED", sent_at: null, created_at: c.now(), updated_at: c.now(), outcome: "DISMISSED", outcome_on: c.today, reason: a.p_reason });
    c.commit(); return "DISMISSED";
  },
  crm_record_outcome: (a, c) => {
    const sr = c.byId("service_records", a.p_service_record_id) ?? fail("No se encontró el vehículo.");
    const outcome = a.p_outcome === "SNOOZE" ? "POSTPONED" : String(a.p_outcome);
    if (outcome === "OPT_OUT" && sr!.customer_id) {
      c.s.tables.crm_contact_permissions = c.t("crm_contact_permissions").filter(p => p.customer_id !== sr!.customer_id);
      c.insert("crm_contact_permissions", { customer_id: sr!.customer_id, status: "OPT_OUT", evidence: "El cliente pidió no recibir mensajes", recorded_by: null, updated_at: c.now() });
    }
    const f = c.insert("customer_followups", { id: c.id("fu"), service_record_id: sr!.id, vehicle_id: sr!.vehicle_id, customer_id: sr!.customer_id, kind: "OUTCOME", status: "OUTCOME", sent_at: null, created_at: c.now(), updated_at: c.now(), outcome, outcome_on: a.p_date ?? c.today, notes: a.p_notes ?? null });
    c.commit(); return f.id;
  },
  crm_undo_last: (a, c) => {
    const f = latestFollowup(c, a.p_service_record_id) ?? fail("No hay nada que deshacer.");
    c.s.tables.customer_followups = c.t("customer_followups").filter(x => x.id !== f!.id);
    c.commit(); return "UNDONE";
  },
  crm_undo_post_service: () => null,
  crm_skip_post_service: () => null,
  crm_save_template: (a, c) => {
    if (String(a.p_body ?? "").trim().length < 20) fail("El mensaje es muy corto.");
    c.s.tables.crm_message_templates = c.t("crm_message_templates").filter(t => t.kind !== a.p_kind);
    c.insert("crm_message_templates", { kind: a.p_kind, body: String(a.p_body), updated_at: c.now(), updated_by: null }); c.commit(); return null;
  },
  crm_set_daily_cap: (a, c) => {
    const n = Number(a.p_cap); if (!(n >= 1 && n <= 100)) fail("El tope diario debe estar entre 1 y 100 mensajes.");
    const row = c.t("app_settings").find(s => s.key === "crm_daily_cap"); if (row) row.value = n; else c.insert("app_settings", { key: "crm_daily_cap", value: n, updated_at: c.now() });
    c.commit(); return null;
  },
  crm_fix_phone: (a, c) => {
    const cu = c.byId("customers", a.p_customer_id) ?? fail("Cliente no encontrado.");
    const d = String(a.p_phone ?? "").replace(/\D/g, ""); if (d.length !== 11 || !d.startsWith("04")) fail("Escribe un teléfono venezolano de 11 dígitos (0414…).");
    cu!.phone = `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`; c.commit(); return "OK";
  },
  set_crm_contact_permission: (a, c) => {
    c.s.tables.crm_contact_permissions = c.t("crm_contact_permissions").filter(p => p.customer_id !== a.p_customer_id);
    c.insert("crm_contact_permissions", { customer_id: a.p_customer_id, status: a.p_status, evidence: a.p_evidence ?? null, recorded_by: null, updated_at: c.now() }); c.commit(); return null;
  },
  set_maintenance_reminder_status: (a, c) => { if (a.p_status === "PENDING") c.s.tables.customer_followups = c.t("customer_followups").filter(f => !(f.service_record_id === a.p_service_record_id && f.outcome === "DISMISSED")); c.commit(); return null; },
  set_crm_post_service_template: (a, c) => { const row = c.t("app_settings").find(s => s.key === "crm_post_service_template"); if (row) row.value = a.p_template; else c.insert("app_settings", { key: "crm_post_service_template", value: a.p_template, updated_at: c.now() }); c.commit(); return null; },
};
