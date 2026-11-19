// Cashea: seguimiento de cuotas, importación de reportes y verificación de cuotas (reglas A y B).
import { addPayment, r2, r4 } from "../domain/order-engine";
import { normalizeRef } from "@/lib/cashea-conciliation/bnc";
import { verifyInstallment, VERIFY_REASON_TEXT, type VerifyResult } from "../rules/cashea";
import type { Row } from "../store";
import { fail, type Ctx, type Handler } from "./ctx";

const BRANCHES = [{ code: "CENTRO", name: "Centro", sort: 1 }, { code: "SEDE_2", name: "Sede 2", sort: 2 }, { code: "SEDE_3", name: "Sede 3", sort: 3 }, { code: "AFUERA", name: "Afuera", sort: 9 }];
const imported = (c: Ctx, kind: string) => c.t("cashea_imported").filter(r => r.kind === kind);

function settleIfDone(c: Ctx, sale: Row) {
  const insts = c.t("cashea_installments").filter(i => i.cashea_sale_id === sale.id);
  if (insts.length && insts.every(i => i.status === "PAID")) { sale.status = "SETTLED"; sale.settled_at = c.now(); return true; }
  return false;
}

function sync(c: Ctx, dry: boolean) {
  const snaps = imported(c, "ORDER");
  const pays = imported(c, "PAYMENT");
  const bank = c.t("cashea_bnc_lines");
  const out = { paid: 0, partial: 0, settled: 0, by_rule: { A: 0, B: 0 }, unverified: [] as Row[], bnc_range: { from: bank.map(l => String(l.line_date)).sort()[0] ?? null, to: bank.map(l => String(l.line_date)).sort().at(-1) ?? null }, dry_run: dry };
  for (const sale of c.t("cashea_sales").filter(s => s.status === "ACTIVE" && s.ownership_status === "OWN")) {
    const order = c.byId("orders", sale.order_id);
    const snap = snaps.find(s => String(s.external_order) === String(sale.cashea_reference));
    for (const inst of c.t("cashea_installments").filter(i => i.cashea_sale_id === sale.id && i.status !== "PAID")) {
      const q = (snap?.installments as Row[] | undefined)?.find(x => Number(x.number) === Number(inst.installment_no));
      const ps = pays.filter(p => String(p.external_order) === String(sale.cashea_reference) && (p.installments as number[]).includes(Number(inst.installment_no))).map(p => {
        const share = Number(p.assigned_ref ?? p.amount_ref) / (p.installments as number[]).length;
        const ves = Number(p.currency === "VES" ? p.amount : Number(p.amount) * Number(p.rate)) / (p.installments as number[]).length;
        const sameRef = bank.filter(l => normalizeRef(l.reference) === normalizeRef(p.reference));
        const hit = sameRef.find(l => Math.abs(Number(l.credit) - ves) <= 0.01);
        return { shareRef: share, bankLine: !!hit, bankRefSeen: sameRef.length > 0 && !hit, when: p.occurred_at };
      });
      const res: VerifyResult = verifyInstallment({ amountRef: Number(inst.amount_ref), snapshot: snap ? { cancelled: snap.status === "CANCELLED", done: q?.status === "DONE", paidRef: Number(q?.paid_ref ?? 0) } : null, payments: ps, dueDate: String(inst.due_date), today: c.today });
      if (res.status === "PAID") {
        out.paid++; out.by_rule[res.rule]++;
        if (!dry) { Object.assign(inst, { status: "PAID", paid_ref: inst.amount_ref, paid_ves_actual: r2(Number(inst.amount_ref) * c.rates.bcv), paid_at: ps.find(p => p.bankLine)?.when ?? c.now(), updated_at: c.now(), verified_rule: res.rule }); }
      } else {
        if (res.status === "PARTIAL") { out.partial++; out.by_rule[res.rule]++; if (!dry) Object.assign(inst, { status: "PARTIAL", paid_ref: r4(Math.max(Number(inst.paid_ref ?? 0), res.paidRef)), updated_at: c.now() }); }
        if (res.reason) out.unverified.push({ order_number: order?.order_number ?? null, cashea_reference: sale.cashea_reference, installment_no: inst.installment_no, due_date: inst.due_date,
          amount_ref: r2(Number(inst.amount_ref)), verified_ref: r2(ps.filter(p => p.bankLine).reduce((s, p) => s + p.shareRef, 0)), reason: res.reason, hint: VERIFY_REASON_TEXT[res.reason] });
      }
    }
    if (!dry && settleIfDone(c, sale)) out.settled++;
  }
  if (!dry) c.commit();
  return out;
}

export const cashea: Record<string, Handler> = {
  cashea_tracking_status: (_a, c) => {
    const max = (rows: Row[], k: string) => rows.map(r => String(r[k]).slice(0, 10)).sort().at(-1) ?? null;
    const snaps = imported(c, "ORDER");
    const active = c.t("cashea_sales").filter(s => s.status === "ACTIVE");
    const missing = active.filter(s => !snaps.some(o => String(o.external_order) === String(s.cashea_reference)));
    const paid: Record<string, string> = {};
    for (const i of c.t("cashea_installments").filter(i => i.status === "PAID")) paid[String(i.id)] = i.verified_rule === "B" ? "BNC" : i.verified_rule === "A" ? "CASHEA" : "MANUAL";
    return { orders_to: max(snaps, "purchased_on"), payments_to: max(imported(c, "PAYMENT"), "occurred_at"), bnc_to: max(c.t("cashea_bnc_lines"), "line_date"),
      never_in_orders_export: missing.length, oldest_missing_since: missing.map(s => String(s.created_at).slice(0, 10)).sort()[0] ?? null,
      without_reference: active.filter(s => !s.cashea_reference).length, paid_sources: paid };
  },
  record_cashea_installment_payment: (a, c) => {
    const inst = c.byId("cashea_installments", a.p_installment_id) ?? fail("Cuota no encontrada.");
    const sale = c.byId("cashea_sales", inst!.cashea_sale_id)!;
    const order = c.byId("orders", sale.order_id)!;
    const amount = Number(a.p_amount_original); if (!(amount > 0)) fail("Indica el monto recibido.");
    const p = addPayment(c, order, String(a.p_method), amount, { reference: a.p_reference ?? null, receivableId: `cashea:${sale.id}` });
    const paid = r4(Number(inst!.paid_ref ?? 0) + Number(p.value_ref));
    Object.assign(inst!, { paid_ref: Math.min(paid, Number(inst!.amount_ref)), status: paid >= Number(inst!.amount_ref) - 0.01 ? "PAID" : "PARTIAL", paid_at: c.now(), updated_at: c.now(), verified_rule: null });
    settleIfDone(c, sale); c.commit();
    const remaining = c.t("cashea_installments").filter(i => i.cashea_sale_id === sale.id).reduce((s, i) => s + Number(i.amount_ref) - Number(i.paid_ref ?? 0), 0);
    return [{ payment_id: p.id, installment_status: inst!.status, remaining_sale_ref: r2(remaining), sale_status: sale.status }];
  },

  // Importación de reportes (los lee el mismo importador del sistema).
  cashea_conc_import_bnc: (a, c) => {
    const keys = new Set(c.t("cashea_bnc_lines").map(l => `${l.line_date}|${normalizeRef(l.reference)}|${l.credit}|${l.debit}`));
    let inserted = 0, duplicates = 0;
    for (const l of (a.p_lines ?? []) as Row[]) {
      const k = `${l.line_date}|${normalizeRef(l.reference)}|${l.credit}|${l.debit}`;
      if (keys.has(k)) { duplicates++; continue; }
      keys.add(k); inserted++;
      c.insert("cashea_bnc_lines", { id: c.id("bnc"), line_date: l.line_date, day_index: l.day_index, reference: l.reference, op_type: l.op_type, tx_type: l.tx_type, description: l.description, debit: l.debit, credit: l.credit, balance: l.balance, created_at: c.now() });
    }
    c.insert("cashea_conc_imports", { id: c.id("imp"), kind: "BNC", file_name: a.p_file_name, row_count: (a.p_lines ?? []).length, inserted, observed_from: null, observed_to: null, chain_ok: !!a.p_chain_ok, created_at: c.now() });
    c.commit(); return { inserted, duplicates };
  },
  finance_import: (a, c) => {
    const p = a.p_preview as Row; const id = c.id("batch");
    const inv = (x: Row) => { const v = (x.raw as Row | null)?.["# Factura"]; return v == null || v === "" ? null : String(v); };
    for (const r of (p.rows ?? []) as Row[]) c.insert("cashea_imported", { id: c.id("cpay"), kind: "PAYMENT", batch_id: id, ...r, invoice: inv(r), raw: null });
    for (const o of (p.orders ?? []) as Row[]) {
      c.s.tables.cashea_imported = c.t("cashea_imported").filter(x => !(x.kind === "ORDER" && x.external_order === o.external_order));
      c.insert("cashea_imported", { id: c.id("cord"), kind: "ORDER", batch_id: id, ...o, invoice: inv(o), raw: null });
    }
    c.commit(); return id;
  },
  cashea_conc_log_import: (a, c) => {
    const rows = c.t("cashea_imported").filter(r => r.batch_id === a.p_batch_id);
    c.insert("cashea_conc_imports", { id: c.id("imp"), kind: a.p_kind, file_name: a.p_file_name, row_count: rows.length, inserted: rows.length, observed_from: null, observed_to: null, chain_ok: null, created_at: c.now() });
    c.commit(); return null;
  },
  cashea_conc_sync_installments_v2: (a, c) => sync(c, !!a.p_dry_run),

  cashea_conc_dataset: (_a, c) => {
    const sales = c.t("cashea_sales");
    const orders = c.t("orders");
    return {
      from: c.t("cashea_bnc_lines").map(l => String(l.line_date)).sort()[0] ?? c.today, branches: BRANCHES,
      bank_lines: c.t("cashea_bnc_lines").map(l => ({ id: l.id, line_date: l.line_date, day_index: l.day_index, reference: l.reference, op_type: l.op_type, tx_type: l.tx_type, description: l.description, debit: l.debit, credit: l.credit, balance: l.balance })),
      cashea_payments: imported(c, "PAYMENT").map(p => ({ id: p.id, occurred_at: p.occurred_at, reference: p.reference, external_order: p.external_order, installments: p.installments, currency: p.currency, amount: p.amount, amount_ref: p.amount_ref, rate: p.rate ?? null, rate_date: p.rate_date ?? null, invoice: p.invoice ?? null })),
      cashea_orders: imported(c, "ORDER").map(o => ({ external_order: o.external_order, invoice: o.invoice ?? null, buyer: null, purchased_on: o.purchased_on, status: o.status, total_ref: o.total_ref, initial_ref: o.initial_ref, installments: o.installments })),
      os_sales: sales.map(s => { const o = orders.find(x => x.id === s.order_id); return { sale_id: s.id, order_id: s.order_id, order_number: o?.order_number, cashea_reference: s.cashea_reference, status: s.status, order_date: String(o?.business_at ?? s.created_at).slice(0, 10), gross_ref: s.gross_ref, initial_ref: s.initial_ref }; }),
      os_orders: orders.filter(o => o.status === "CLOSED").map(o => ({ order_id: o.id, order_number: o.order_number, order_date: String(o.business_at).slice(0, 10), total_ref: o.total_ref, status: o.status, has_cashea: sales.some(s => s.order_id === o.id) })),
      os_payments: c.t("payments").filter(p => sales.some(s => s.order_id === p.order_id)).map(p => ({ payment_id: p.id, order_id: p.order_id, order_number: orders.find(o => o.id === p.order_id)?.order_number, method: p.method, currency: p.currency, amount: p.amount_original, reference: p.reference, paid_at: p.paid_at, cashea_order: true })),
      overrides: c.t("cashea_overrides"), adjustments: c.t("cashea_adjustments").filter(x => !x.voided_at), cutoffs: c.t("cashea_cutoffs").filter(x => !x.voided_at), destinations: c.t("cashea_destinations"),
      imports: c.t("cashea_conc_imports").slice().reverse(), bdv_lines: [],
    };
  },
  cashea_conc_set_override: (a, c) => {
    c.s.tables.cashea_overrides = c.t("cashea_overrides").filter(o => !(o.subject === a.p_subject && o.subject_key === a.p_key));
    if (a.p_branch) c.insert("cashea_overrides", { id: c.id("ovr"), subject: a.p_subject, subject_key: a.p_key, branch: a.p_branch, note: a.p_note ?? "", created_at: c.now() });
    c.commit(); return null;
  },
  cashea_conc_apply_ownership: (a, c) => { let n = 0; for (const it of (a.p_items ?? []) as Row[]) { const s = c.t("cashea_sales").find(x => x.id === it.sale_id || x.cashea_reference === it.external_order); if (s) { n++; s.ownership_status = it.ownership_status ?? s.ownership_status; s.ownership_reason = it.reason ?? null; } } c.commit(); return { other_location: n, returned: 0 }; },
  cashea_conc_set_reference: (a, c) => { const s = c.byId("cashea_sales", a.p_sale_id) ?? fail("Venta Cashea no encontrada."); s!.cashea_reference = String(a.p_reference); c.commit(); return null; },
  cashea_conc_set_destination: (a, c) => { c.s.tables.cashea_destinations = c.t("cashea_destinations").filter(d => d.cedula !== a.p_cedula); c.insert("cashea_destinations", { cedula: a.p_cedula, branch: a.p_branch, label: a.p_label }); c.commit(); return null; },
  cashea_conc_adjustment: (a, c) => { const x = c.insert("cashea_adjustments", { id: c.id("adj"), occurred_on: a.p_occurred_on, amount_ves: String(a.p_amount), debit_branch: a.p_debit_branch, credit_branch: a.p_credit_branch, note: a.p_note ?? "", reference: a.p_reference ?? null, created_at: c.now() }); c.commit(); return x.id; },
  cashea_conc_mark_cutoff: (a, c) => { const l = c.byId("cashea_bnc_lines", a.p_bank_line_id) ?? fail("Línea del banco no encontrada."); const x = c.insert("cashea_cutoffs", { id: c.id("cut"), cut_date: l!.line_date, reference: l!.reference, balance_ves: l!.balance, bank_line_id: l!.id, created_at: c.now(), note: a.p_note ?? null, summary: a.p_summary ?? null }); c.commit(); return x.id; },
  cashea_conc_void: (a, c) => { const t = a.p_kind === "CUTOFF" ? "cashea_cutoffs" : "cashea_adjustments"; const x = c.byId(t, a.p_id); if (x) { x.voided_at = c.now(); x.void_reason = a.p_reason ?? null; } c.commit(); return null; },
  cashea_conc_fix_payment: (a, c) => { const p = c.byId("payments", a.p_payment_id); const l = c.byId("cashea_bnc_lines", a.p_bank_line_id); if (p && l) p.reference = l.reference; c.commit(); return null; },
};
