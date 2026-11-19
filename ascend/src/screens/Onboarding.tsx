import { books, bookById } from '../content'
import { store } from '../lib/store'
import { categories } from '../content'
import { Cover } from '../ui/Cover'

const WALL = ['how-to-win-friends', 'atomic-habits', 'psychology-of-money', 'think-and-grow-rich', 'rich-dad-poor-dad', 'good-to-great', 'start-with-why', 'power-of-now', 'seven-habits', '48-laws-of-power', 'thinking-fast-and-slow', 'zero-to-one']

/** One wlc screen. No questions: the whole library opens at once. */
export function Onboarding() {
  const enter = () => store.set({ onboarded: true }, { immediate: true })
  const chapters = books.reduce((a, b) => a + b.lessons.length, 0)
  return (
    <div className="wlc">
      <div className="wlc__wall" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className={`wlc__row wlc__row--${row}`}>
            {[...WALL, ...WALL].slice(row * 4, row * 4 + 8).map((id, i) => (
              <Cover key={i} book={bookById[id]} size="md" />
            ))}
          </div>
        ))}
      </div>
      <div className="wlc__body">
        <p className="wlc__brand" lang="en">
          ALEXANDRIA
        </p>
        <h1 className="wlc__title">הספרייה הגדולה של הצמיחה האישית.</h1>
        <p className="wlc__lead">
          {books.length} מהספרים הטובים בעולם, ב־{categories.length} תחומים. כל ספר במלואו, פרק אחר פרק, רק העיקר. לקריאה ולהאזנה בעברית.
        </p>
        <ul className="wlc__facts">
          <li>
            <strong>{books.length}</strong>
            <span>ספרים</span>
          </li>
          <li>
            <strong>{chapters}</strong>
            <span>פרקים</span>
          </li>
          <li>
            <strong>4</strong>
            <span>קריינים</span>
          </li>
        </ul>
        <button className="btn btn--primary btn--big btn--wide" onClick={enter}>
          כניסה לספרייה
        </button>
      </div>
    </div>
  )
}
