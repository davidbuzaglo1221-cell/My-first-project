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
