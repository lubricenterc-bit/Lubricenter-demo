import type { SupabaseClient } from '@supabase/supabase-js';
import { parseBdv, parseCashea, type Preview } from '../finance/importers';
import { isXlsBinary, readXlsFirstSheet } from '../xls-biff';
import type { SyncResult } from '../cashea-sync';
import { mergeBnc, parseBnc, type BncPreview } from './bnc';
import { canonicalCasheaHeaders, detectKind } from './report';

// Carga de reportes de la conciliación Cashea. La usan la vista manual y el túnel: un solo
// importador, las mismas validaciones y el mismo registro de cargas.

export type Upload = { name: string; kind: 'BNC' | 'CASHEA_TRANSACTIONS' | 'CASHEA_ORDERS' | 'BDV'; bnc?: BncPreview; cashea?: Preview };
export const UPLOAD_KIND_LABEL: Record<Upload['kind'], string> = {
  BNC: 'Estado de cuenta BNC', CASHEA_TRANSACTIONS: 'Pagos Cashea (export)', CASHEA_ORDERS: 'Órdenes Cashea', BDV: 'BDV Centro (texto)',
};
export const UPLOAD_ACCEPT = '.xls,.xlsx';

/** Lee y revisa los archivos (sin guardar nada todavía). */
export async function readCasheaFiles(files: File[]): Promise<Upload[]> {
  const out: Upload[] = [];
  for (const file of files) {
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: archivo mayor de 15 MB.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let cells: unknown[][];
    if (isXlsBinary(bytes)) cells = readXlsFirstSheet(bytes);
    else if (file.name.toLowerCase().endsWith('.xlsx')) {
      const { readSheet } = await import('read-excel-file/browser');
      cells = await readSheet(file, { parseNumber: (v: string) => v }) as unknown[][];
    } else throw new Error(`${file.name}: usa el .xls del BNC o los .xlsx de Cashea.`);
    const kind = detectKind(cells);
    if (kind === 'BNC') out.push({ name: file.name, kind, bnc: parseBnc(cells as Parameters<typeof parseBnc>[0]) });
    else if (kind === 'CASHEA_TRANSACTIONS' || kind === 'CASHEA_ORDERS') out.push({ name: file.name, kind, cashea: parseCashea(canonicalCasheaHeaders(cells, kind), kind) });
    else throw new Error(`${file.name}: no se reconoce el reporte (BNC, pagos Cashea u órdenes Cashea).`);
  }
  return out;
}

export function bdvUpload(text: string): Upload {
  return { name: 'BDV Centro (pegado)', kind: 'BDV', cashea: parseBdv(text) };
}

/**
 * Guarda los reportes: el BNC unido (sin repetir líneas) y los de Cashea por finance_import. Al
 * terminar sincroniza las cuotas verificadas (regla A o B de cashea_conc_sync_installments_v2).
 */
/**
 * Importa los archivos y después sincroniza las cuotas. `onImported` corre apenas quedan
 * importados (antes de sincronizar): ahí se limpia el formulario, para que un error de la
 * sincronización no invite a importar dos veces.
 */
export async function importCasheaUploads(client: Pick<SupabaseClient, 'rpc' | 'from'>, uploads: Upload[], onImported?: () => void): Promise<{ steps: string[]; synced: SyncResult }> {
  const blocking = uploads.filter(u => (u.bnc?.errors.length ?? 0) + (u.cashea?.errors.length ?? 0) > 0);
  if (blocking.length) throw new Error(`Corrige los errores de: ${blocking.map(u => u.name).join(', ')}`);
  const steps: string[] = [];
  const bnc = uploads.filter(u => u.kind === 'BNC');
  if (bnc.length) {
    const merged = mergeBnc(bnc.map(u => u.bnc!));
    const r = await client.rpc('cashea_conc_import_bnc', { p_file_name: bnc.map(u => u.name).join(' + '), p_lines: merged.lines, p_chain_ok: merged.chain_ok });
    if (r.error) throw r.error;
    steps.push(`BNC: ${r.data.inserted} movimientos nuevos, ${r.data.duplicates} ya estaban`);
  }
  const others = uploads.filter(u => u.kind !== 'BNC');
  if (others.length) {
    const sources = await client.from('external_sources').select('id,provider').eq('active', true);
    if (sources.error) throw sources.error;
    for (const u of others) {
      const provider = u.kind === 'BDV' ? 'BDV' : u.kind;
      const source = (sources.data || []).find((s: { provider: string }) => s.provider === provider) as { id: string } | undefined;
      if (!source) throw new Error(`Falta configurar la fuente ${provider} en Revisión financiera.`);
      const p = u.cashea!;
      const r = await client.rpc('finance_import', { p_source_id: source.id, p_name: u.name, p_from: p.observed_from, p_to: p.observed_to, p_preview: p });
      if (r.error) throw r.error;
      const log = await client.rpc('cashea_conc_log_import', { p_kind: u.kind === 'CASHEA_TRANSACTIONS' ? 'CASHEA_PAYMENTS' : u.kind, p_file_name: u.name, p_batch_id: r.data });
      if (log.error) throw log.error;
      steps.push(`${UPLOAD_KIND_LABEL[u.kind]}: ${p.rows.length + p.orders.length} filas`);
    }
  }
  onImported?.();
  const sync = await client.rpc('cashea_conc_sync_installments_v2', { p_dry_run: false });
  if (sync.error) throw sync.error;
  return { steps, synced: sync.data as SyncResult };
}
