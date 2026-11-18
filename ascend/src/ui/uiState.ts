import { useSyncExternalStore } from 'react'

interface UI {
  playerOpen: boolean
  completeId?: string
  toast?: string
}

let ui: UI = { playerOpen: false }
const subs = new Set<() => void>()
const set = (p: Partial<UI>) => {
  ui = { ...ui, ...p }
  subs.forEach((f) => f())
}
export const useUI = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => ui,
  )

/** The full player is an overlay; a history entry lets the system back gesture close it. */
export function openPlayer() {
  if (ui.playerOpen) return
  history.pushState({ ascendPlayer: true }, '')
  set({ playerOpen: true })
}
export function closePlayer() {
  if (!ui.playerOpen) return
  set({ playerOpen: false })
  if (history.state?.ascendPlayer) history.back()
}
if (typeof window !== 'undefined')
  window.addEventListener('popstate', () => {
    if (ui.playerOpen) set({ playerOpen: false })
  })

export const showComplete = (id?: string) => set({ completeId: id })
export const toast = (text?: string) => set({ toast: text })
