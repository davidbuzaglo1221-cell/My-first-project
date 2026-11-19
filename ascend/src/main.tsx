import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/frank-ruhl-libre/hebrew-400.css'
import '@fontsource/frank-ruhl-libre/hebrew-500.css'
import '@fontsource/frank-ruhl-libre/latin-500.css'
import '@fontsource/assistant/hebrew-400.css'
import '@fontsource/assistant/hebrew-600.css'
import '@fontsource/assistant/hebrew-700.css'
import '@fontsource/assistant/latin-400.css'
import '@fontsource/assistant/latin-600.css'
import './styles.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:' && import.meta.env.MODE !== 'single') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

// Records the address this page is served from (once per load), so the home-screen shortcut can open it directly.
;(globalThis as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude
  ?.use('db')
  .then((db) => {
    const d = db as { doc(p: string): { set(v: unknown): Promise<unknown> } } | null
    d?.doc('meta/frame').set({ href: location.href, origin: location.origin, framed: window.top !== window, ua: navigator.userAgent.slice(0, 120), at: Date.now() }).catch(() => {})
  })
  .catch(() => {})
