/**
 * Unified metrics service for contact type detection and date utilities.
 * Used by useWorkingDaysTargets and useEvolutionData hooks.
 */

const CALL_TYPES = ['ligacao', 'ligação', 'call', 'telefone', 'fone'];
const WHATSAPP_TYPES = ['whatsapp', 'wpp', 'whats', 'mensagem'];

/** Check if interaction type is an effective call */
export function isEffectiveCall(interactionType: string): boolean {
  const t = (interactionType || '').toLowerCase().trim();
  return CALL_TYPES.some(ct => t.includes(ct));
}

/** Check if interaction type is an effective WhatsApp message */
export function isEffectiveWhatsapp(interactionType: string): boolean {
  const t = (interactionType || '').toLowerCase().trim();
  return WHATSAPP_TYPES.some(wt => t.includes(wt));
}

/** Get São Paulo timezone day key (yyyy-MM-dd) for a given date */
export function saoPauloDayKey(date: Date): string {
  // Use Intl to get São Paulo date parts
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // returns yyyy-MM-dd
}

/** Get São Paulo timezone day range (start and end ISO strings) */
export function saoPauloDayRange(date: Date): { startIso: string; endIso: string } {
  const dayKey = saoPauloDayKey(date);
  return {
    startIso: `${dayKey}T00:00:00-03:00`,
    endIso: `${dayKey}T23:59:59-03:00`,
  };
}
