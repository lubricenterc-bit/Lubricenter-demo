import { D, r2, r4 } from "./money";

export type Rates = { bcv: number; operative: number };

/** Precio en bolívares: REF × tasa BCV. */
export const refToVes = (ref: number, rates: Rates) => r2(new D(ref).mul(rates.bcv));

/** Precio en divisas (Zelle, Binance, efectivo $): REF × BCV ÷ operativa. */
export const refToDivisas = (ref: number, rates: Rates) => r2(new D(ref).mul(rates.bcv).div(rates.operative));

export const vesToRef = (ves: number, rates: Rates) => r4(new D(ves).div(rates.bcv));
export const divisasToRef = (usd: number, rates: Rates) => r4(new D(usd).mul(rates.operative).div(rates.bcv));
