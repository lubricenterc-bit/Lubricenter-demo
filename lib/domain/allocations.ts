import type {
  ElectroautoAllocationInput,
  ElectroautoAllocationResult,
  WorkshopAllocationInput,
  WorkshopAllocationResult,
} from "./types";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function workshopAllocation(input: WorkshopAllocationInput): WorkshopAllocationResult {
  const mechanicPercent = input.mechanicPercent ?? 40;
  const techBonusPercent = input.techBonusPercent ?? 5;
  const mechanicRef = money(input.mechanicOverrideRef ?? (input.baseRef * mechanicPercent) / 100);
  const techBonusRef = input.techBonusEnabled
    ? money((input.baseRef * techBonusPercent) / 100)
    : 0;
  const lubricenterRef = money(input.customerRef - mechanicRef - techBonusRef);

  if (input.baseRef < 0 || input.customerRef < 0) throw new Error("Los montos no pueden ser negativos");
  if (mechanicRef < 0 || techBonusRef < 0) throw new Error("Las participaciones no pueden ser negativas");
  if (lubricenterRef < 0) {
    throw new Error(
      "El precio al cliente no cubre las participaciones protegidas. Reduce explícitamente la parte de Mecánico o elimina el bono de Técnico.",
    );
  }

  return { customerRef: money(input.customerRef), mechanicRef, techBonusRef, lubricenterRef };
}

export function electroautoAllocation(
  input: ElectroautoAllocationInput,
): ElectroautoAllocationResult {
  const techPercent = input.techPercent ?? 40;
  const techRef = money(input.techOverrideRef ?? (input.baseRef * techPercent) / 100);
  const lubricenterRef = money(input.customerRef - techRef);

  if (input.baseRef < 0 || input.customerRef < 0) throw new Error("Los montos no pueden ser negativos");
  if (techRef < 0) throw new Error("La participación de Técnico no puede ser negativa");
  if (lubricenterRef < 0) {
    throw new Error(
      "El precio al cliente no cubre la participación protegida de Técnico. Ajusta explícitamente su parte.",
    );
  }

  return { customerRef: money(input.customerRef), techRef, lubricenterRef };
}

