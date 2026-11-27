import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'explore' }
  | { name: 'category'; id: string }
  | { name: 'library' }
  | { name: 'growth' }
  | { name: 'progress' }
  | { name: 'book'; id: string }
  | { name: 'path'; id: string }
  | { name: 'settings' }
  | { name: 'voices' }
  | { name: 'read'; id: string }
  | { name: 'freedom' }
  | { name: 'breathe'; id: string }
  | { name: 'notes'; tab?: string }
  | { name: 'quiz'; id: string; lesson?: string }
  | { name: 'ask'; id: string }
  | { name: 'checkin' }
  | { name: 'situation'; id?: string }
  | { name: 'coach'; session?: string }

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  switch (parts[0]) {
    case 'explore':
      return parts[1] ? { name: 'category', id: parts[1] } : { name: 'explore' }
    case 'library':
      return { name: 'library' }
    case 'growth':
      return { name: 'growth' }
    case 'progress':
      return { name: 'progress' }
    case 'book':
      return { name: 'book', id: parts[1] ?? '' }
    case 'path':
      return { name: 'path', id: parts[1] ?? '' }
    case 'settings':
      return { name: 'settings' }
    case 'voices':
      return { name: 'voices' }
    case 'read':
      return { name: 'read', id: parts[1] ?? '' }
    case 'freedom':
      return { name: 'freedom' }
    case 'checkin':
      return { name: 'checkin' }
    case 'coach':
      return { name: 'coach', session: parts[1] }
    case 'situation':
      return { name: 'situation', id: parts[1] }
    case 'breathe':
      return { name: 'breathe', id: parts[1] ?? '' }
    case 'notes':
      return { name: 'notes', tab: parts[1] }
    case 'quiz':
      return { name: 'quiz', id: parts[1] ?? '', lesson: parts[2] }
    case 'ask':
      return { name: 'ask', id: parts[1] ?? '' }
    default:
      return { name: 'home' }
  }
}

const subscribe = (f: () => void) => {
  window.addEventListener('hashchange', f)
  return () => window.removeEventListener('hashchange', f)
}

export const useHash = () => useSyncExternalStore(subscribe, () => location.hash || '#/')
export const navigate = (path: string) => {
  const next = '#' + path
  if (location.hash !== next) location.hash = next
  else window.dispatchEvent(new HashChangeEvent('hashchange'))
}
export const back = (fallback = '/') => (history.length > 1 ? history.back() : navigate(fallback))

/** Tab a route belongs to, for the tab bar highlight. */
export const tabOf = (r: Route): string =>
  ['category', 'book', 'path', 'read', 'quiz', 'ask'].includes(r.name)
    ? 'explore'
    : r.name === 'breathe' || r.name === 'checkin' || r.name === 'situation'
      ? 'freedom'
      : ['settings', 'voices', 'growth', 'library'].includes(r.name)
        ? 'progress'
        : r.name === 'coach'
          ? 'home'
          : r.name
