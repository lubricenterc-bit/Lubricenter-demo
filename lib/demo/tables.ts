// Tablas que las pantallas leen con .from(). Las vistas se calculan a partir de las tablas base.
import type { DemoState, Row } from "./store";
import { inventoryCurrent } from "./domain/inventory";
import { workshopBoard } from "./domain/orders";
import { vehicleJourneys, oilForecasts } from "./domain/crm";

type Source = "base" | ((s: DemoState) => Row[]);

export const TABLES: Record<string, Source> = {
  app_settings: "base",
  cashea_sales: "base",
  cashea_installments: "base",
  compensation_rules: "base",
  crm_capture_skips: "base",
  crm_contact_permissions: "base",
  customer_followups: "base",
  crm_message_templates: "base",
  crm_vehicle_journeys: vehicleJourneys,
  customer_balance_accounts: "base",
  customer_balance_movements: "base",
  customers: "base",
  employees: "base",
  external_sources: "base",
  finance_cash_close_alerts: "base",
  finance_job_runs: "base",
  finance_push_subscriptions: "base",
  inventory_current: inventoryCurrent,
  inventory_items: "base",
  inventory_movements: "base",
  locations: "base",
  order_history: "base",
  order_items: "base",
  order_notes: "base",
  order_tenders: "base",
  orders: "base",
  payments: "base",
  receivables: "base",
  service_records: "base",
  staff_users: "base",
  supplier_brands: "base",
  supplier_invoices: "base",
  supplier_invoice_items: "base",
  supplier_payments: "base",
  suppliers: "base",
  tunnel_rules: "base",
  vehicle_customer_history: "base",
  vehicle_oil_usage_forecasts: oilForecasts,
  vehicles: "base",
  workshop_board_current: workshopBoard,
};

export function readTable(s: DemoState, name: string): Row[] | null {
  const src = TABLES[name];
  if (!src) return null;
  return src === "base" ? (s.tables[name] ??= []) : src(s);
}

export const isWritable = (name: string) => TABLES[name] === "base";
