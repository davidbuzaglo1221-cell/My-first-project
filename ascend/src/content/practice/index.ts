/* "In practice" steps for every chapter, by area. */
import money from './money'
import persuasion from './persuasion'
import psychology from './psychology'
import communication from './communication'
import discipline from './discipline'
import leadership from './leadership'
import mindset from './mindset'

export const practice: Record<string, string[]> = { ...money, ...persuasion, ...psychology, ...communication, ...discipline, ...leadership, ...mindset }
