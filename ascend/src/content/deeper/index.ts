/* A deeper explanatory paragraph per chapter: the mechanism, an example, and why it matters. */
import money from './money'
import persuasion from './persuasion'
import psychology from './psychology'
import communication from './communication'
import confidence from './confidence'
import discipline from './discipline'
import business from './business'
import leadership from './leadership'
import mindset from './mindset'

export const deeper: Record<string, string> = {
  ...money, ...persuasion, ...psychology, ...communication, ...confidence,
  ...discipline, ...business, ...leadership, ...mindset,
}
