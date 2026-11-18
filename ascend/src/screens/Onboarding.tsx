import { useState } from 'react'
import { categories } from '../content'
import type { CategoryId } from '../content/types'
import { store, useStore } from '../lib/store'
import { Art } from '../ui/Cover'
import { IconCheck } from '../ui/Icons'
import { Assessment } from './Growth'

export function Onboarding() {
  const [step, setStep] = useState(0)
  const s = useStore((x) => x)
  const goals = s.goals
  const toggle = (id: CategoryId) =>
    store.set((x) => ({ goals: x.goals.includes(id) ? x.goals.filter((g) => g !== id) : x.goals.length >= 3 ? x.goals : [...x.goals, id] }))

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
            <Art seed="ascend-intro" motif="stairs" hue={156} square />
          </div>
          <p className="onb__brand" lang="en">
            ASCEND
          </p>
          <h1 className="onb__title">האוניברסיטה הפרטית שלך.</h1>
          <p className="onb__lead">הרעיונות החשובים ביותר מהספרים הגדולים על כסף, השפעה, משמעת ומנהיגות. בשיעורי אודיו קצרים בעברית, עם תרגיל אחרי כל שיעור.</p>
          <button className="btn btn--primary btn--big btn--wide" onClick={() => setStep(1)}>
            בוא נתחיל
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="onb__step">
          <h1 className="onb__title onb__title--sm">במה אתה רוצה לצמוח?</h1>
          <p className="onb__lead">בחר עד שלושה תחומים. המסלול האישי שלך ייבנה מהם.</p>
          <div className="onb__cats">
            {categories.map((c) => {
              const on = goals.includes(c.id)
              return (
                <button key={c.id} className={`onb__cat ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)}>
                  <Art seed={'cat-' + c.id} motif={c.motif} hue={c.hue} square className="onb__catart" />
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
            <button className="btn btn--primary btn--wide" disabled={!goals.length} onClick={() => setStep(2)}>
              {goals.length ? 'המשך' : 'בחר לפחות תחום אחד'}
            </button>
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
