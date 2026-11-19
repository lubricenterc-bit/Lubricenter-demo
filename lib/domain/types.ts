export type BusinessArea = "STORE" | "OIL_CHANGE" | "WORKSHOP" | "ELECTROAUTO";
export type ItemType = "PRODUCT" | "SERVICE";
export type PricingMode = "STANDARD" | "CASH_USD_SPECIAL";
export type PaymentMethod =
  | "CASH_USD"
  | "CASH_VES"
  | "TRANSFER_BDV"
  | "TRANSFER_BNC";

export interface RateSnapshot {
  bcv: number;
  operative: number;
}

export interface ProductPriceSnapshot {
  cashUsd: number;
  ves: number;
  refBcv: number;
  rates: RateSnapshot;
}

export interface WorkshopAllocationInput {
  baseRef: number;
  customerRef: number;
  mechanicPercent?: number;
  mechanicOverrideRef?: number | null;
  techBonusEnabled?: boolean;
  techBonusPercent?: number;
}

export interface WorkshopAllocationResult {
  customerRef: number;
  mechanicRef: number;
  techBonusRef: number;
  lubricenterRef: number;
}

export interface ElectroautoAllocationInput {
  baseRef: number;
  customerRef: number;
  techPercent?: number;
  techOverrideRef?: number | null;
}

export interface ElectroautoAllocationResult {
  customerRef: number;
  techRef: number;
  lubricenterRef: number;
}
