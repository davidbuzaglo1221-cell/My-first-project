export type CategoryId =
  | 'money'
  | 'persuasion'
  | 'psychology'
  | 'communication'
  | 'confidence'
  | 'discipline'
  | 'business'
  | 'leadership'
  | 'mindset'

export type Motif = 'rings' | 'arc' | 'grid' | 'wave' | 'orbit' | 'stairs' | 'prism' | 'pillar' | 'sun'

export interface Category {
  id: CategoryId
  name: string
  short: string
  promise: string
  motif: Motif
  hue: number
}

export interface Exercise {
  /** What to do after the lesson, in one or two sentences. */
  task: string
  /** A small repeatable behaviour that can become a tracked habit. */
  habit?: string
  /** A short reflection question for the journal. */
  reflect?: string
}

export interface Lesson {
  id: string
  title: string
  /** Original narration script — our own explanation of the book's ideas. */
  script: string
  takeaway: string
  exercise: Exercise
  /** Optional licensed or pre-rendered audio file. Preferred over device narration. */
  audioUrl?: string
}

export interface KeyIdea {
  title: string
  body: string
}

export interface Book {
  id: string
  title: string
  originalTitle: string
  author: string
  authorEn: string
  year: number
  category: CategoryId
  tagline: string
  why: string
  ideas: KeyIdea[]
  lessons: Lesson[]
  level: 'יסודות' | 'מתקדם'
  /** Small offset so each cover in a category looks different. */
  shade: number
}

export interface LearningPath {
  id: string
  title: string
  subtitle: string
  description: string
  lessonIds: string[]
  hue: number
  motif: Motif
}
