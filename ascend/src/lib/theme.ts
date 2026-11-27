/* Appearance: follows the device by default, or stays dark / light by choice.
   index.html applies the saved choice before the first paint, so there is never a flash. */
import { useEffect } from 'react'
import { useStore } from './store'

export type ThemePref = 'system' | 'dark' | 'light'

const COLORS = { dark: '#000000', light: '#f5f2eb' }

export function resolveTheme(pref: ThemePref = 'dark'): 'dark' | 'light' {
  if (pref !== 'system') return pref
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(pref: ThemePref = 'dark', animate = false) {
  const next = resolveTheme(pref)
  const root = document.documentElement
  if (root.dataset.theme === next) return
  const set = () => {
    root.dataset.theme = next
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[next])
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', next)
  }
  const reduce = matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const vt = (document as Document & { startViewTransition?: (f: () => void) => unknown }).startViewTransition
  if (animate && vt && !reduce) vt.call(document, set)
  else set()
}

/** Keeps the page in step with the setting and, on "system", with the device. */
export function useTheme() {
  const pref = useStore((s) => s.settings.theme) ?? 'dark'
  useEffect(() => {
    applyTheme(pref, true)
    if (pref !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: light)')
    const on = () => applyTheme('system', true)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [pref])
}
