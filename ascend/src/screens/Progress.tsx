import { categories } from '../content'
import { hebrewWeekday } from '../lib/dates'
import { achievementList, categoryMastery, completedIds, consistency, currentStreak, heatmap, longestStreak, totalSeconds, weekSeries } from '../lib/insights'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { IconAscend, IconLock } from '../ui/Icons'
import { Bar, SectionHead } from '../ui/Kit'

const fmtHours = (sec: number) => {
  const m = Math.round(sec / 60)
  if (m < 60) return { v: String(m), u: 'דקות' }
  return { v: (m / 60).toFixed(m < 600 ? 1 : 0), u: 'שעות' }
}

export function Progress() {
  const s = useStore((x) => x)
  const week = weekSeries(s)
  const goal = s.dailyGoalMin * 60
  const max = Math.max(goal * 1.25, ...week.map((d) => d.seconds))
  const total = fmtHours(totalSeconds(s))
  const cons = Math.round(consistency(s) * 100)
  const cells = heatmap(s, 15)
  const weekTotal = Math.round(week.reduce((a, d) => a + d.seconds, 0) / 60)
  const exercises = Object.keys(s.actions).length

  return (
    <div className="screen progress">
      <header className="page-head">
        <h1 className="page-title">ההתקדמות שלך</h1>
        <p className="page-sub">עקביות חשובה יותר מעוצמה. יום פעיל הוא דקה של האזנה או הרגל אחד שסימנת.</p>
      </header>

      <section className="stats">
        <div className="stat stat--lead">
          <strong>{currentStreak(s)}</strong>
          <span>ימים ברצף</span>
          <small>השיא שלך: {longestStreak(s)}</small>
        </div>
        <div className="stat">
          <strong>{total.v}</strong>
          <span>{total.u} של למידה</span>
        </div>
        <div className="stat">
          <strong>{completedIds(s).length}</strong>
          <span>שיעורים הושלמו</span>
        </div>
        <div className="stat">
          <strong>{exercises}</strong>
          <span>תרגילים בוצעו</span>
        </div>
        <div className="stat">
          <strong>{cons}%</strong>
          <span>עקביות בחודש</span>
        </div>
      </section>

      <section className="block">
        <SectionHead title="השבוע" sub={`${weekTotal} דקות, יעד של ${s.dailyGoalMin} דקות ביום`} />
        <div className="weekchart" role="img" aria-label={`האזנה בשבעת הימים האחרונים, סך הכל ${weekTotal} דקות`}>
          <div className="weekchart__goal" style={{ bottom: `${(goal / max) * 100}%` }}>
            <span>יעד</span>
          </div>
          {week.map((d, i) => (
            <div key={d.key} className={`weekchart__col ${d.seconds >= goal ? 'is-met' : ''} ${i === 6 ? 'is-today' : ''}`}>
              <div className="weekchart__bar" style={{ height: `${Math.max(2, (d.seconds / max) * 100)}%` }} title={`${Math.round(d.seconds / 60)} דקות`} />
              <span>{hebrewWeekday(d.date)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <SectionHead title="מפת העקביות" sub="חמישה עשר השבועות האחרונים" />
        <div className="heat" role="img" aria-label="מפת ימי פעילות">
          {cells.map((c) => (
            <i
              key={c.key}
              className={c.future ? 'is-future' : c.seconds >= goal ? 'l3' : c.seconds >= goal / 2 ? 'l2' : c.seconds >= 60 ? 'l1' : ''}
              title={`${c.key}: ${Math.round(c.seconds / 60)} דקות`}
            />
          ))}
        </div>
        <div className="heat__legend">
          <span>פחות</span>
          <i />
          <i className="l1" />
          <i className="l2" />
          <i className="l3" />
          <span>יותר</span>
        </div>
      </section>

      <section className="block">
        <SectionHead title="שליטה בתחומים" sub="שיעורים שהושלמו בכל תחום" />
        <ul className="mastery">
          {categories.map((c) => {
            const m = categoryMastery(s, c.id)
            return (
              <li key={c.id}>
                <button onClick={() => navigate(`/explore/${c.id}`)}>
                  <span className="mastery__name">{c.name}</span>
                  <span className="mastery__n">
                    {m.done}/{m.total}
                  </span>
                  <Bar value={m.ratio} />
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="block">
        <SectionHead title="הישגים" sub={`${Object.keys(s.achievements).length} מתוך ${achievementList.length}`} />
        <ul className="badges">
          {achievementList.map((a) => {
            const at = s.achievements[a.id]
            return (
              <li key={a.id} className={`badge ${at ? 'is-on' : ''}`}>
                <span className="badge__mark">{at ? <IconAscend size={20} /> : <IconLock size={16} />}</span>
                <strong>{a.title}</strong>
                <span>{a.detail}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
