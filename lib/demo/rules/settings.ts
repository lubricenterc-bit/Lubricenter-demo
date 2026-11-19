// Valores por defecto del código de producción (app_settings). En la muestra se
// muestran como «configurables». Las tasas son de ejemplo, fijas y redondas.
export const DEMO_SETTINGS = {
  exampleRates: { bcv: 200, operative: 250 },
  casheaCommissionPercent: 4,
  casheaInitialPercent: 40,
  casheaInstallments: 3,
  casheaInstallmentDays: 14,
  casheaOpportunityMonthlyPercent: 5,
  casheaFinancingDays: 45,
  casheaMinimumRef: 25,
  discountFreeLimitPercent: 10,
  storeMarkupPercent: 35,
  oilLaborFreeThresholdPercent: 85,
  mechanicPercent: 40,
  techBonusPercent: 5,
  crmDailyCap: 15,
  /** PIN visible en pantalla; nunca uno real. */
  demoPin: "0000",
} as const;
