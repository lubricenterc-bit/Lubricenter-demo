// Archivos de ejemplo de la conciliación Cashea, generados en el navegador a partir de
// los datos de la muestra (sus fechas siguen a «hoy»). Tienen el mismo formato que los
// reportes reales, así que pasan por el mismo importador y las mismas validaciones.
import { getState, type Row } from "./store";

const pad2 = (n: number) => String(n).padStart(2, "0");
const ddmmyyyy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

type Plan = { sale: Row; inst: Row; order: Row; mode: "A" | "B" | "B_MISSING" | "PAID" | "PENDING" };

/** Qué muestra cada archivo: cuotas ya pagadas, verificables por regla A o B, y una sin línea en el banco. */
async function plan(): Promise<{ plans: Plan[]; today: string; bcv: number }> {
  const s = await getState();
  const out: Plan[] = [];
  let k = 0;
  for (const sale of (s.tables.cashea_sales ?? []).filter(x => x.status !== "CANCELLED")) {
    const order = (s.tables.orders ?? []).find(o => o.id === sale.order_id)!;
    for (const inst of (s.tables.cashea_installments ?? []).filter(i => i.cashea_sale_id === sale.id).sort((a, b) => Number(a.installment_no) - Number(b.installment_no))) {
      if (inst.status === "PAID") { out.push({ sale, inst, order, mode: "PAID" }); continue; }
      if (String(inst.due_date) > s.today) { out.push({ sale, inst, order, mode: "PENDING" }); continue; }
      const mode = (["A", "B", "B_MISSING", "PENDING"] as const)[k++ % 4];
      out.push({ sale, inst, order, mode });
    }
  }
  return { plans: out, today: s.today, bcv: s.rates.bcv };
}

async function xlsx(rows: unknown[][], name: string) {
  const { default: write } = await import("write-excel-file/browser");
  const blob = await write(rows.map(r => r.map(v => (v == null ? null : { value: v as string | number }))) as never).toBlob();
  return new File([blob], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function buildSampleFiles(): Promise<File[]> {
  const { plans, today, bcv } = await plan();
  const paidLike = plans.filter(p => p.mode !== "PENDING");
  let ref = 400100;
  const refs = new Map<Plan, string>();
  for (const p of paidLike) refs.set(p, String(ref += 7));
  const when = (p: Plan) => (p.mode === "PAID" && p.inst.paid_at ? String(p.inst.paid_at).slice(0, 10) : String(p.inst.due_date) > today ? today : String(p.inst.due_date));

  // 1 · Pagos Cashea: una fila por cuota pagada (regla B necesita además su línea en el banco).
  const payHeader = ["Fecha de Transaccion", "Moneda", "Método de pago", "Cuenta", "Monto pagado en VES", "Monto Pagado en USD", "Fecha Tasa de Cambio", "Tasa de Cambio", "# Referencia", "# Cuota Pagada", "# Orden", "# Factura", "Sucursal", "Monto asignado"];
  const payRows = paidLike.filter(p => p.mode !== "A").map(p => {
    const d = when(p); const usd = Number(p.inst.amount_ref);
    return [`${d}T10:${pad2(Number(p.inst.installment_no) * 7)}:00`, "VES", "Pago móvil", "Cuenta de ejemplo", money(usd * bcv), money(usd), d, money(bcv), refs.get(p)!, String(p.inst.installment_no), String(p.sale.cashea_reference), String(p.order.order_number), "Centro", money(usd)];
  });

  // 2 · Órdenes Cashea: estado de cada orden y sus cuotas (regla A).
  const ordHeader = ["# Orden", "# Factura", "Nombre del comprador", "Nombre de la tienda", "Venta total", "Fecha compra", "Estado orden", "Pago en caja", "Estado pago inicial",
    ...[1, 2, 3].flatMap(n => [`Fecha cuota ${n}`, `Monto cuota ${n}`, `Pagado cuota ${n}`, `Estado cuota ${n}`])];
  const bySale = new Map<string, Plan[]>();
  for (const p of plans) bySale.set(String(p.sale.id), [...(bySale.get(String(p.sale.id)) ?? []), p]);
  const ordRows = [...bySale.values()].map(ps => {
    const sale = ps[0].sale;
    const cells = ps.flatMap(p => {
      const paid = p.mode === "PAID" || p.mode === "A";
      return [String(p.inst.due_date), money(Number(p.inst.amount_ref)), money(paid ? Number(p.inst.amount_ref) : 0), paid ? "DONE" : "PENDING"];
    });
    const done = ps.every(p => p.mode === "PAID" || p.mode === "A");
    return [String(sale.cashea_reference), String(ps[0].order.order_number), "Cliente de ejemplo", "Lubricenter", money(Number(sale.gross_ref)), String(sale.created_at).slice(0, 10), done ? "CLOSED" : "IN PROGRESS", money(Number(sale.initial_ref)), "PAID", ...cells];
  });

  // 3 · Estado de cuenta del banco de cobro: abonos de Cashea con su referencia (falta uno a propósito).
  const lines = paidLike.filter(p => p.mode === "B" || p.mode === "PAID").map(p => ({ d: when(p), ref: refs.get(p)!, credit: Number(p.inst.amount_ref) * bcv }))
    .sort((a, b) => a.d.localeCompare(b.d));
  let balance = 150000;
  const bncRows: unknown[][] = [["Banco de ejemplo · Estado de cuenta"], ["Cuenta de ejemplo"], [],
    ["Fecha", "Código Transacción", "Tipo Transacción", "Tipo Operación", "Descripción", "Referencia", "Debe", "Haber", "Saldo"]];
  for (const l of lines) { balance += l.credit; bncRows.push([ddmmyyyy(l.d), "CR01", "Crédito", "Pago móvil", "PAGO CASHEA CUOTA", l.ref, "0.00", money(l.credit), money(balance)]); }

  return [
    await xlsx([payHeader, ...payRows], "Pagos_Cashea_ejemplo.xlsx"),
    await xlsx([ordHeader, ...ordRows], "Ordenes_Cashea_ejemplo.xlsx"),
    await xlsx(bncRows, "Estado_banco_ejemplo.xlsx"),
  ];
}

export async function downloadSampleFiles() {
  for (const f of await buildSampleFiles()) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a"); a.href = url; a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
