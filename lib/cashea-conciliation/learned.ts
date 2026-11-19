import type { TunnelRule } from '../tunnels/types';
import type { LearnedRule } from './engine';

// Las reglas aprendidas del túnel (tunnel_rules, proceso «cashea») en la forma que entiende el
// motor de conciliación. Solo se usan las que el motor sabe aplicar: sucursal por factura u
// orden Cashea, o por cédula o descripción del movimiento del BNC.

export const CASHEA_FACT_LABELS: Record<string, string> = {
  invoice: 'la factura en Cashea', external_order: 'la orden Cashea', cedula: 'la cédula', description: 'la descripción del banco',
};

export function learnedRulesFrom(rules: TunnelRule[]): LearnedRule[] {
  const out: LearnedRule[] = [];
  for (const r of rules) {
    if (r.status !== 'ACTIVE' || r.tunnel_key !== 'cashea' || r.outcome?.action?.type !== 'cashea.assign_branch') continue;
    const payload = r.outcome.action.payload || {};
    const when: LearnedRule['when'] = {};
    let ok = r.condition?.all?.length > 0;
    for (const c of r.condition?.all || []) {
      if (c.op === 'eq' && (c.fact === 'invoice' || c.fact === 'external_order' || c.fact === 'cedula')) when[c.fact] = String(c.value);
      else if (c.op === 'contains' && c.fact === 'description' && String(c.value).trim().length >= 4) when.description = String(c.value);
      else ok = false;
    }
    const branch = String(payload.branch || '');
    if (!ok || !branch) continue;
    const subject = payload.subject === 'BANK_LINE' || when.cedula || when.description ? 'BANK_LINE' : 'ORDER';
    if (subject === 'ORDER' && !when.invoice && !when.external_order) continue;
    out.push({ id: r.id, description: r.description, subject, branch, os_order_number: payload.os_order_number ? String(payload.os_order_number) : null, when });
  }
  return out;
}
