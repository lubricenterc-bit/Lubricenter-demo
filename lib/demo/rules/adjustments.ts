// Descuento y redondeo: se usan las mismas funciones del sistema (lib/domain/economics).
export { previewAdjustments, roundTarget, type RoundingMode } from "@/lib/domain/economics";
import { DEMO_SETTINGS as S } from "./settings";

/** Hasta 10% es libre; más pide el PIN del dueño. */
export const discountNeedsPin = (percent: number, limit: number = S.discountFreeLimitPercent) => percent > limit;
export const pinOk = (pin: string) => pin === S.demoPin;
