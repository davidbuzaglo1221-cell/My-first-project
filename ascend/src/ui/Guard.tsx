import { Component, type ReactNode } from 'react'

/**
 * If a screen fails, the app does not go black: the user sees a calm way back, and their data stays untouched.
 * The error is kept on the device (last 5) so it can be inspected, never sent anywhere.
 */
export class Guard extends Component<{ children: ReactNode; resetKey?: string }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) {
    return { err }
  }
  componentDidCatch(err: Error) {
    try {
      const log = JSON.parse(localStorage.getItem('hamasa:errors') || '[]') as unknown[]
      log.push({ at: Date.now(), msg: String(err?.message).slice(0, 300), where: location.hash })
      localStorage.setItem('hamasa:errors', JSON.stringify(log.slice(-5)))
    } catch {
      /* storage full or blocked: nothing to do */
    }
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.err && prev.resetKey !== this.props.resetKey) this.setState({ err: null })
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="guard" role="alert">
        <span className="guard__mark">MY JOURNEY</span>
        <h1>משהו נתקע במסך הזה</h1>
        <p>הנתונים שלך שמורים. אפשר לחזור הביתה או לטעון מחדש.</p>
        <div className="guard__row">
          <button className="btn btn--primary" onClick={() => ((location.hash = '#/'), this.setState({ err: null }))}>
            חזרה הביתה
          </button>
          <button className="btn" onClick={() => location.reload()}>
            טעינה מחדש
          </button>
        </div>
      </div>
    )
  }
}
