import type { Category } from './types'

export const categories: Category[] = [
  { id: 'money', name: 'כסף, עושר והשקעות', short: 'כסף ועושר', promise: 'להבין איך כסף באמת עובד, ולגרום לו לעבוד בשבילך.', motif: 'rings', hue: 152 },
  { id: 'persuasion', name: 'מכירות, שכנוע ומשא ומתן', short: 'שכנוע ומו״מ', promise: 'להשיג הסכמה בלי לוותר על עצמך.', motif: 'arc', hue: 164 },
  { id: 'psychology', name: 'פסיכולוגיה והתנהגות אנושית', short: 'פסיכולוגיה', promise: 'לראות את המנגנונים שמניעים אנשים, כולל אותך.', motif: 'prism', hue: 170 },
  { id: 'communication', name: 'תקשורת ומערכות יחסים', short: 'תקשורת', promise: 'שיחות שבונות אמון במקום להרוס אותו.', motif: 'wave', hue: 158 },
  { id: 'confidence', name: 'ביטחון עצמי וכריזמה', short: 'ביטחון וכריזמה', promise: 'נוכחות שקטה שאנשים מרגישים כשאתה נכנס לחדר.', motif: 'sun', hue: 146 },
  { id: 'discipline', name: 'משמעת ופרודוקטיביות', short: 'משמעת', promise: 'מערכות קטנות שמייצרות תוצאות גדולות.', motif: 'stairs', hue: 160 },
  { id: 'business', name: 'עסקים ויזמות', short: 'יזמות', promise: 'לבנות משהו שאנשים באמת צריכים.', motif: 'grid', hue: 176 },
  { id: 'leadership', name: 'מנהיגות והשפעה', short: 'מנהיגות', promise: 'לקחת אחריות ולהוביל אנשים אל מעבר למה שחשבו שאפשר.', motif: 'pillar', hue: 150 },
  { id: 'mindset', name: 'בריאות, מיינדסט וצמיחה אישית', short: 'מיינדסט', promise: 'שקט פנימי, משמעות ויכולת לצמוח מכל דבר.', motif: 'orbit', hue: 168 },
]

export const categoryById = Object.fromEntries(categories.map((c) => [c.id, c])) as Record<Category['id'], Category>
