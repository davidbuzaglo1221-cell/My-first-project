/**
 * Notifications from the app itself (Web Push). The device subscribes with the app's public key and hands the
 * subscription to the daily sender through a relay topic; the sender (a GitHub Actions job) decides what to say
 * and when. On iPhone this works once the app is installed from Safari (Share → Add to Home Screen), iOS 16.4+.
 */
import { store } from './store'

/** Relay topic the sender reads subscriptions from. Subscriptions alone cannot send: only the sender's key can. */
export const RELAY = 'https://ntfy.sh/hamasa-b6yabftyvx7gkkn2chriyk'

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
export const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

const b64 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export type PushResult = 'on' | 'denied' | 'install' | 'unsupported' | 'error'

/** Ask permission, subscribe, and register with the sender. Must run from a tap. */
export async function enablePush(hours: number[] = [9, 21]): Promise<PushResult> {
  if (isIOS() && !isStandalone()) return 'install'
  if (!pushSupported()) return 'unsupported'
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'denied'
    const key = await fetch('push/vapid.json', { cache: 'no-store' }).then((r) => r.json() as Promise<{ publicKey: string }>)
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key.publicKey) }))
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem'
    await fetch(RELAY, { method: 'POST', body: JSON.stringify({ sub: sub.toJSON(), hours, tz, v: 1 }) })
    store.set({ push: { on: true, hours } }, { immediate: true })
    reg.showNotification('המסע שלי', { body: 'מעולה. מעכשיו אשלח לך כל יום משהו קטן: מצב, שאלה, או רעיון.', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'welcome' })
    return 'on'
  } catch {
    return 'error'
  }
}
