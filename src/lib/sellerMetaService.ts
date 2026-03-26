/**
 * Seller meta service — level targets and configuration.
 * Source of truth for monthly targets by seller level.
 */

export type SellerLevel = 'ovo' | 'pena' | 'aguia';

interface LevelTargets {
  baseCallsPerDay: number;
  baseWhatsappPerDay: number;
  callsPerMonth?: number;
  whatsappPerMonth?: number;
}

/**
 * LEVEL_MONTHLY_TARGETS — fonte única de verdade para metas por nível.
 * Usado por useWorkingDaysTargets para calcular metas diárias e mensais.
 */
export const LEVEL_MONTHLY_TARGETS: Record<SellerLevel, LevelTargets> = {
  ovo: {
    baseCallsPerDay: 18,
    baseWhatsappPerDay: 18,
    // callsPerMonth e whatsappPerMonth são calculados: basePerDay × workingDays
  },
  pena: {
    baseCallsPerDay: 20,
    baseWhatsappPerDay: 20,
    callsPerMonth: 400,
    whatsappPerMonth: 400,
  },
  aguia: {
    baseCallsPerDay: 22,
    baseWhatsappPerDay: 22,
    callsPerMonth: 440,
    whatsappPerMonth: 440,
  },
};

/** Get work days config (placeholder — actual config comes from work_month_config table) */
export function getWorkDaysConfig(_yearMonth: string) {
  return null;
}
