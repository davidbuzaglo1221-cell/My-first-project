import type { FullText } from './types'
import { asAManThinketh } from './as-a-man-thinketh'

/** Complete book texts that may be published in full (public domain, translated by ASCEND). */
export const fullTexts: Record<string, FullText> = { [asAManThinketh.bookId]: asAManThinketh }
export type { FullText }
