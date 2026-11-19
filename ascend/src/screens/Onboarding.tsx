import { useState } from 'react'
import { categories } from '../content'
import type { CategoryId } from '../content/types'
import { store, useStore } from '../lib/store'
import { CoverFan } from '../ui/Cover'
import { bookById } from '../content'
import { AreaIcon, IconCheck } from '../ui/Icons'
import { Assessment } from './Growth'

export function Onboarding() {
  const [step, setStep] = useState(0)
  const s = useStore((x) => x)
  const goals = s.goals
  const toggle = (id: CategoryId) =>
    store.set((x) => ({ goals: x.goals.includes(id) ? x.goals.filter((g) => g !== id) : [...x.goals, id] }))

  const finish = () => {
    store.set((x) => ({ onboarded: true, initialAssessment: { ...x.assessment, ...x.initialAssessment } }), { immediate: true })
  }

  return (
    <div className="onb" data-step={step}>
      <div className="onb__progress" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i <= step ? 'is-on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <div className="onb__step onb__intro">
          <div className="onb__mark" aria-hidden="true">
            <CoverFan books={['psychology-of-money', 'atomic-habits', 'how-to-win-friends'].map((id) => bookById[id])} className="onb__fan" />
          </div>
          <p className="onb__brand" lang="en">
            ASCEND
          </p>
          <h1 className="onb__title">האוניברסיטה הפרטית שלך.</h1>
          <p className="onb__lead">ספרייה שלמה של הספרים הטובים ביותר מכל תחום. כל ספר במלואו, רק העיקר, לקריאה ולהאזנה בעברית.</p>
          <button className="btn btn--primary btn--big btn--wide" onClick={() => setStep(1)}>
            בוא נתחיל
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="onb__step">
          <h1 className="onb__title onb__title--sm">במה אתה רוצה לצמוח?</h1>
          <p className="onb__lead">סמן כמה תחומים שתרצה, או את כולם. זה רק כדי להתחיל, וכל הספרייה תמיד פתוחה לך.</p>
          <div className="onb__cats">
            {categories.map((c) => {
              const on = goals.includes(c.id)
              return (
                <button key={c.id} className={`onb__cat ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)}>
                  <span className="onb__caticon">
                    <AreaIcon id={c.id} size={22} />
                  </span>
                  <span>{c.name}</span>
                  {on && (
                    <b className="onb__tick">
                      <IconCheck size={14} />
                    </b>
                  )}
                </button>
              )
            })}
          </div>
          <div className="onb__nav">
            <button className="btn btn--primary btn--wide" onClick={() => (!goals.length && store.set({ goals: categories.map((c) => c.id) }), setStep(2))}>
              {goals.length ? 'המשך' : 'הכל מעניין אותי'}
            </button>
            {goals.length < categories.length && (
              <button className="btn btn--quiet" onClick={() => store.set({ goals: categories.map((c) => c.id) })}>
                בחר את כל התחומים
              </button>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="onb__step">
          <Assessment only={goals} />
          <div className="onb__nav">
            <button className="btn btn--primary btn--wide" onClick={() => setStep(3)}>
              המשך
            </button>
            <button className="btn btn--quiet" onClick={() => setStep(1)}>
              חזרה
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="onb__step">
          <h1 className="onb__title onb__title--sm">כמה זמן ביום?</h1>
          <p className="onb__lead">יעד קטן שאפשר לעמוד בו כל יום, עדיף על יעד גדול שנזנח.</p>
          <div className="onb__goals" role="radiogroup" aria-label="יעד יומי">
            {[5, 10, 15, 20].map((m) => (
              <button key={m} role="radio" aria-checked={s.dailyGoalMin === m} className={`onb__goal ${s.dailyGoalMin === m ? 'is-on' : ''}`} onClick={() => store.set({ dailyGoalMin: m })}>
                <strong>{m}</strong>
                <span>דקות</span>
              </button>
            ))}
          </div>
          <label className="field">
            <span>איך לקרוא לך? (לא חובה)</span>
            <input value={s.name} onChange={(e) => store.set({ name: e.target.value })} placeholder="שם פרטי" />
          </label>
          <div className="onb__nav">
            <button
              className="btn btn--primary btn--big btn--wide"
              onClick={finish}
            >
              כניסה לאוניברסיטה
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
