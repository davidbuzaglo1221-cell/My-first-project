/** Complete books, chapter by chapter: everything the book teaches, only what matters, in original ASCEND wording. */
import money from './money'
import persuasion from './persuasion'
import psychology from './psychology'
import communication from './communication'
import confidence from './confidence'
import discipline from './discipline'
import business from './business'
import leadership from './leadership'
import mindset from './mindset'

export const completeBooks: Record<string, string> = { ...money, ...persuasion, ...psychology, ...communication, ...confidence, ...discipline, ...business, ...leadership, ...mindset }
