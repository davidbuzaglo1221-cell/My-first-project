// The free local engine: programmed motion and kinetic Hebrew typography, Hebrew narration and house music.
// This is NOT generative video and is always labelled that way. It guarantees a finished MP4 at zero cost.
export default {
  id: 'local',
  name: 'מקומי',
  kind: 'local',
  official: 'רץ אצלנו, בלי שירות חיצוני',
  site: null,
  freeGrant: Infinity,
  unit: '',
  currency: '',
  strengths: ['חינם תמיד', 'עברית', 'אנימציה מתוכנתת — לא AI'],
  maxSec: 180,
  textOnly: true,
  hebrew: true,
  estimate() { return { credits: 0, money: 0 }; },
  async status() { return { connected: true, credits: null, plan: 'חינם' }; },
};
