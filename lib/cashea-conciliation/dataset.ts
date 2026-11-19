import type { BdvLine } from './report';
import type { Adjustment, BankLine, Branch, CasheaOrder, CasheaPayment, Cutoff, Destination, EngineInput, LearnedRule, OsOrder, OsPayment, OsSale, Override } from './engine';

// Lo que devuelve la RPC cashea_conc_dataset y cómo se convierte en la entrada del motor.
// Lo usan la vista manual y el túnel: así clasifican exactamente igual.

export type Dataset = {
  from: string; branches: Branch[]; bank_lines: BankLine[]; cashea_payments: CasheaPayment[]; cashea_orders: CasheaOrder[];
  os_sales: OsSale[]; os_orders: OsOrder[]; os_payments: OsPayment[]; overrides: (Override & { created_at: string })[];
  adjustments: Adjustment[]; cutoffs: (Cutoff & { summary: Record<string, unknown> | null })[]; destinations: Destination[];
  imports: { id: string; kind: string; file_name: string; row_count: number; inserted: number; observed_from: string | null; observed_to: string | null; chain_ok: boolean | null; created_at: string }[];
  bdv_lines: BdvLine[];
};

export function engineInputFrom(data: Dataset, today: string, learnedRules: LearnedRule[] = []): EngineInput {
  return {
    branches: data.branches,
    bankLines: data.bank_lines.map(l => ({ ...l, debit: String(l.debit), credit: String(l.credit), balance: String(l.balance) })),
    casheaPayments: data.cashea_payments.map(p => ({ ...p, amount: String(p.amount), amount_ref: String(p.amount_ref ?? 0), rate: p.rate === null ? null : String(p.rate), installments: p.installments ?? [] })),
    casheaOrders: data.cashea_orders.map(o => ({ ...o, total_ref: String(o.total_ref), initial_ref: String(o.initial_ref), installments: (o.installments ?? []).map(q => ({ ...q, amount_ref: String(q.amount_ref), paid_ref: String(q.paid_ref) })) })),
    osSales: data.os_sales.map(s => ({ ...s, gross_ref: String(s.gross_ref), initial_ref: String(s.initial_ref) })),
    osOrders: data.os_orders.map(o => ({ ...o, total_ref: String(o.total_ref) })),
    osPayments: data.os_payments.map(p => ({ ...p, amount: String(p.amount) })),
    overrides: data.overrides,
    adjustments: data.adjustments.map(a => ({ ...a, amount_ves: String(a.amount_ves) })),
    cutoffs: data.cutoffs.map(c => ({ ...c, balance_ves: String(c.balance_ves) })),
    destinations: data.destinations,
    today,
    learnedRules,
  };
}
