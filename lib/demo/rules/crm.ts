// Seguimiento: tramos de Recuperar y plan de mensajes por ciclo (crm_semiauto / crm_recovery).
export type RecoveryBucket = "SOON" | "D0_30" | "D31_90" | "D91_180" | "D181_365" | "D365P";

export const RECOVERY_BUCKETS: { code: RecoveryBucket; label: string }[] = [
  { code: "SOON", label: "Vencen pronto" }, { code: "D0_30", label: "Vencidos hace 0–30 días" },
  { code: "D31_90", label: "Hace 31–90 días" }, { code: "D91_180", label: "Hace 91–180 días" },
  { code: "D181_365", label: "Hace 181–365 días" }, { code: "D365P", label: "Hace más de 1 año" },
];

/** daysFromDue: días desde que le tocaba el cambio (negativo = todavía no le toca). */
export function recoveryBucket(daysFromDue: number): RecoveryBucket | null {
  if (daysFromDue >= -15 && daysFromDue <= -1) return "SOON";
  if (daysFromDue >= 0 && daysFromDue <= 30) return "D0_30";
  if (daysFromDue <= 90 && daysFromDue > 30) return "D31_90";
  if (daysFromDue <= 180 && daysFromDue > 90) return "D91_180";
  if (daysFromDue <= 365 && daysFromDue > 180) return "D181_365";
  if (daysFromDue > 365) return "D365P";
  return null;
}

export type MessageKind = "PRE" | "DUE" | "FINAL" | "RECOVERY" | "RECONNECT";

/** Mensajes por ciclo: 3 si arrancó antes de vencer (PRE → DUE → FINAL), 2 si arrancó vencido, 1 si es reconexión. */
export function maxMessages(firstKind: MessageKind) {
  return firstKind === "PRE" ? 3 : firstKind === "RECONNECT" ? 1 : 2;
}

export function firstKind(daysFromDue: number): MessageKind | null {
  if (daysFromDue < -7) return null;
  if (daysFromDue < 0) return "PRE";
  if (daysFromDue <= 30) return "DUE";
  if (daysFromDue <= 365) return "RECOVERY";
  return "RECONNECT";
}

/** Próximo mensaje del ciclo y desde cuándo se puede enviar (días entre mensajes: 10 tras el 1.º, 14 tras el 2.º). */
export function nextMessage(x: { daysFromDue: number; sentCount: number; firstKind?: MessageKind; lastSentDay?: number; cycleDueDay: number }) {
  if (x.sentCount === 0) {
    const kind = firstKind(x.daysFromDue);
    return kind ? { kind, eligibleDay: x.cycleDueDay - 7 } : null;
  }
  const first = x.firstKind ?? "DUE";
  if (x.sentCount >= maxMessages(first)) return null;
  const kind: MessageKind = x.sentCount === 1 && first === "PRE" ? "DUE" : "FINAL";
  return { kind, eligibleDay: (x.lastSentDay ?? 0) + (x.sentCount === 1 ? 10 : 14) };
}

export const canSendToday = (sentToday: number, cap: number) => sentToday < cap;
