import { days1 } from './days1'
import { days2 } from './days2'
import type { ProgramDay } from './types'

export type { ProgramDay }

/** Thirty days, from survival to freedom: body, mind, action, people and meaning. */
export const programDays: ProgramDay[] = [...days1, ...days2]
export const programDayById: Record<string, ProgramDay> = Object.fromEntries(programDays.map((d) => [d.id, d]))
