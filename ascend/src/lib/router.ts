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
export const tabOf = (r: Route) =>
  r.name === 'category' || r.name === 'book' || r.name === 'path' ? 'explore' : r.name === 'settings' || r.name === 'voices' ? 'home' : r.name
