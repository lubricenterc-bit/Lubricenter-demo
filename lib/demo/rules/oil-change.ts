import { DEMO_SETTINGS as S } from "./settings";

/**
 * Mano de obra del cambio de aceite: gratis si el cliente compra aquí al menos el 85 %
 * del valor del cambio (aceite + filtro). Si trae el aceite, siempre se cobra.
 */
export function oilLaborRequired(x: { customerOil: boolean; boughtRef: number; broughtFilterRef?: number }) {
  if (x.customerOil) return { required: true, share: 0 };
  const brought = x.broughtFilterRef ?? 0;
  const share = x.boughtRef + brought > 0 ? x.boughtRef / (x.boughtRef + brought) : 1;
  return { required: share < S.oilLaborFreeThresholdPercent / 100, share };
}

type Line = { itemType: "PRODUCT" | "SERVICE"; businessArea?: string; quantity: number; description: string; category?: string | null; unit?: string | null; manual?: boolean; bonus?: boolean };

/** Se pide la placa solo cuando hubo cambio de aceite: servicio, o 4 L o más de aceite de motor con filtro. */
export function needsPlateCapture(lines: Line[]) {
  if (lines.some(l => l.itemType === "SERVICE" && l.businessArea === "OIL_CHANGE")) return true;
  if (lines.some(l => l.manual && /cambio\s+(de\s+)?aceite/i.test(l.description))) return true;
  const excluded = /hidr[aá]ulic|transmisi|caja|atf|2t|dos tiempos|motosierra|moto|4t|4 tiempos|filtro/i;
  const liters = lines
    .filter(l => l.itemType === "PRODUCT" && !l.bonus && (l.category === "Aceite Motor" || (l.manual && /\d{1,2}\s*W\s*[-/]?\s*\d{2}/i.test(l.description))) && !excluded.test(l.description))
    .reduce((a, l) => a + l.quantity * (l.unit === "GAL" || (l.manual && /gal[oó]n/i.test(l.description)) ? 4 : 1), 0);
  const filter = lines.some(l => l.itemType === "PRODUCT" && (l.category === "Filtro Aceite" || /filtro\s+(de\s+)?aceite/i.test(l.description)));
  return liters >= 4 && filter;
}
