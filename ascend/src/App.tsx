import { useEffect, useMemo, useRef } from 'react'
import { bookById } from './content'
import { load, player, registerArtwork, usePlayer } from './engine/player'
import { evaluateAchievements } from './lib/insights'
import { parse, useHash } from './lib/router'
import { store, useStore } from './lib/store'
import { BookScreen } from './screens/Book'
import { CategoryScreen, Explore } from './screens/Explore'
import { Growth, PathScreen } from './screens/Growth'
import { Home } from './screens/Home'
import { LessonComplete } from './screens/LessonComplete'
import { Library } from './screens/Library'
import { NowPlaying } from './screens/NowPlaying'
import { Onboarding } from './screens/Onboarding'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { Voices } from './screens/Voices'
import { Reader } from './screens/Reader'
import { Breathe, Freedom } from './screens/Freedom'
import { Notebook } from './screens/Notebook'
import { Quiz } from './screens/Quiz'
import { Ask } from './screens/Ask'
import { dueNow, chime } from './lib/remind'
import { MiniPlayer, TabBar } from './ui/Chrome'
import { bookHue, bookMotif } from './ui/Cover'
import { coverPng } from './ui/coverArt'
import { Toast } from './ui/Kit'
import { showComplete, toast, useUI } from './ui/uiState'

registerArtwork((t) => {
  const b = t.bookId ? bookById[t.bookId] : undefined
  return b ? coverPng(b.id, bookMotif(b), bookHue(b)) : undefined
})

export function App() {
  const hash = useHash()
  const route = useMemo(() => parse(hash), [hash])
  const onboarded = useStore((s) => s.onboarded)
  const ui = useUI()
  const p = usePlayer()
  const main = useRef<HTMLElement>(null)

  // New route: start at the top, and move focus for screen readers.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    main.current?.focus({ preventScroll: true })
  }, [hash])

  // Resume exactly where you stopped: restore the last track, paused, after a reload.
  useEffect(() => {
    const last = store.get().lastTrack
    if (onboarded && last && !player.get().track) load(last)
  }, [onboarded])

  // A lesson ended: offer the exercise.
  useEffect(() => {
    if (p.endedId && p.track?.kind === 'lesson' && !store.get().settings.autoContinue) showComplete(p.endedId)
  }, [p.endedId, p.track?.kind])

  // Unlock achievements whenever state changes.
  useEffect(() => {
    const check = () => {
        const fresh = evaluateAchievements(store.get())
        if (!fresh.length) return
        const now = Date.now()
        store.set((s) => ({ achievements: { ...s.achievements, ...Object.fromEntries(fresh.map((a) => [a.id, now])) } }), { immediate: true })
        toast(`הישג חדש: ${fresh[0].title}`)
    }
    check()
    return store.subscribe(check)
  }, [])

  // Reminders ring while the app is open (the calendar export covers the rest).
  useEffect(() => {
    let last = ''
    const t = setInterval(() => {
      const d = new Date()
      const stamp = `${d.getHours()}:${d.getMinutes()}`
      if (stamp === last) return
      last = stamp
      const r = (store.get().reminders ?? []).find((x) => dueNow(x, d))
      if (r) (chime(), toast(`⏰ ${r.text}`))
    }, 15000)
    return () => clearInterval(t)
  }, [])

  if (!onboarded) return <Onboarding />

  let screen
  switch (route.name) {
    case 'home':
      screen = <Home />
      break
    case 'explore':
      screen = <Explore />
      break
    case 'category':
      screen = <CategoryScreen id={route.id} />
      break
    case 'library':
      screen = <Library />
      break
    case 'growth':
      screen = <Growth />
      break
    case 'progress':
      screen = <Progress />
      break
    case 'book':
      screen = <BookScreen id={route.id} />
      break
    case 'path':
      screen = <PathScreen id={route.id} />
      break
    case 'settings':
      screen = <Settings />
      break
    case 'voices':
      screen = <Voices />
      break
    case 'read':
      screen = <Reader id={route.id} />
      break
    case 'freedom':
      screen = <Freedom />
      break
    case 'breathe':
      screen = <Breathe id={route.id} />
      break
    case 'notes':
      screen = <Notebook tab={route.tab} />
      break
    case 'quiz':
      screen = <Quiz bookId={route.id} lessonId={route.lesson} />
      break
    case 'ask':
      screen = <Ask bookId={route.id} />
      break
  }

  return (
    <div className={`app ${p.track ? 'has-mini' : ''} ${ui.playerOpen ? 'player-open' : ''} ${route.name === 'read' ? 'is-reading' : ''} ${route.name === 'breathe' ? 'is-breathing' : ''}`}>
      <main ref={main} tabIndex={-1} key={hash} className="view" inert={ui.playerOpen || undefined}>
        {screen}
      </main>
      <div className="dock" inert={ui.playerOpen || undefined}>
        <MiniPlayer />
        <TabBar route={route} />
      </div>
      <NowPlaying />
      <LessonComplete />
      {ui.toast && <Toast text={ui.toast} onDone={() => toast(undefined)} />}
    </div>
  )
}
