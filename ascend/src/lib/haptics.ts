/* Light haptic feedback, only where the device supports it and only when the person allows it.
   Android: the Vibration API. iPhone (iOS 18+): Safari plays the system tick when a native switch toggles,
   so a hidden <input switch> is toggled for the tap. Everywhere else this does nothing. */
import { store } from './store'

export type Haptic = 'tick' | 'tap' | 'success' | 'warn'

const PATTERNS: Record<Haptic, number | number[]> = { tick: 8, tap: 12, success: [10, 40, 18], warn: [24, 50, 24] }

let iosSwitch: HTMLLabelElement | null = null
const isIOS = () => typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;inset:0 auto auto 0'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    label.appendChild(input)
    document.body.appendChild(label)
    iosSwitch = label
  }
  iosSwitch.click()
}

export function haptic(kind: Haptic = 'tap') {
  if (store.get().settings.haptics === false) return
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && kind === 'tick') return
  try {
    if (typeof navigator.vibrate === 'function' && !isIOS()) navigator.vibrate(PATTERNS[kind])
    else if (isIOS()) iosTick()
  } catch {
    /* never let feedback break an action */
  }
}

/** Whether this device can give haptic feedback at all (to show or hide the setting). */
export const hapticsAvailable = () => typeof navigator !== 'undefined' && (typeof navigator.vibrate === 'function' || isIOS())
