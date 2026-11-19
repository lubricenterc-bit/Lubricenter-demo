import Decimal from "decimal.js";

export const D = Decimal.clone({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
export const r2 = (n: Decimal.Value) => new D(n).toDecimalPlaces(2).toNumber();
export const r4 = (n: Decimal.Value) => new D(n).toDecimalPlaces(4).toNumber();
