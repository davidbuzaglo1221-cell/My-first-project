// The savings guard. Decides for every engine and job whether it is free, paid (needs David's explicit OK) or unavailable.
// Rule: free first, always. Anything that may cost money is refused unless the request carries an approval for that exact amount.

/** @returns {{ kind: 'free'|'paid'|'unavailable', reason: string, credits?: number, money?: number|null, currency?: string }} */
export function decide(engine, estimate, status, ledgerEntry = {}) {
  if (engine.id === 'local') return { kind: 'free', reason: 'מנוע מקומי — חינם תמיד', credits: 0, money: 0 };
  if (!status?.connected) return { kind: 'unavailable', reason: status?.note || 'לא מחובר' };
  const spent = ledgerEntry.spentCredits || 0;
  const freeLeft = Math.max(0, (engine.freeGrant || 0) - spent);
  const need = estimate?.credits;
  const balanceOk = status.credits == null || need == null || status.credits >= need;
  // A paid plan means the credits were bought: spending them is spending money.
  const freeAccount = status.freePlan !== false;
  if (need != null && need > 0 && freeLeft >= need && balanceOk && freeAccount) {
    return { kind: 'free', reason: `מכסה חינמית: נשארו ${freeLeft} ${engine.unit}`, credits: need, money: 0 };
  }
  if (need != null && !balanceOk && freeLeft >= need) return { kind: 'unavailable', reason: 'אין מספיק קרדיטים בחשבון' };
  return { kind: 'paid', reason: estimate?.note || 'מעבר למכסה החינמית', credits: need ?? null, money: estimate?.money ?? null, currency: engine.currency };
}

/** An approval is valid only for the engine and an amount at least as high as the estimate. */
export function approvalCovers(approval, engineId, decision) {
  if (decision.kind !== 'paid') return true;
  const a = approval?.[engineId];
  if (!a) return false;
  if (decision.money == null) return a.unknownPrice === true;
  return typeof a.maxMoney === 'number' && a.maxMoney >= decision.money;
}

const FIT = {
  // How well each engine fits a request. Higher is better. Free/paid is handled separately.
  vaideo: b => 60 + (b.language === 'he' ? 25 : 0) + (b.lengthSec >= 20 ? 5 : 0),
  aituber: b => 58 + (b.style === 'animation' || b.style === 'anime' ? 10 : 0) + (b.aspect === '1:1' ? 5 : 0),
  seedance: b => 70 + (['cinematic', 'documentary', 'editorial'].includes(b.style) ? 15 : 0),
  korpi: b => 55 + (b.lengthSec <= 15 ? 10 : 0),
  local: b => 30 + (b.language === 'he' ? 10 : 0),
};
export const fitScore = (id, brief) => (FIT[id] || (() => 0))(brief);

/** Auto mode: the best free external engines (max 2); the local engine when no external one is free. */
export function autoPick(rows, brief) {
  const free = rows.filter(r => r.engine.id !== 'local' && r.decision.kind === 'free')
    .sort((a, b) => fitScore(b.engine.id, brief) - fitScore(a.engine.id, brief));
  const picked = free.slice(0, 2).map(r => r.engine.id);
  return picked.length ? picked : ['local'];
}
