/** One day of the thirty-day program "From survival to freedom": a short narrated lesson with a practice inside. */
export interface ProgramDay {
  id: string
  title: string
  /** The week's theme (shown above the day). */
  week: string
  /** The day's mission for real life, in one sentence. */
  mission: string
  /** Narration: one line per sentence group; a line "~ N" is N seconds of quiet for the practice. */
  script: string
}
