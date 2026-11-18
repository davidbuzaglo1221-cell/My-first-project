import { useRef, useState } from 'react'
import { categories } from '../content'
import type { CategoryId } from '../content/types'
import { navigate } from '../lib/router'
import { store, updateSettings, useStore, type AppState } from '../lib/store'
import { IconAscend } from '../ui/Icons'
import { BackButton, Segmented } from '../ui/Kit'
import { toast } from '../ui/uiState'
import { Assessment } from './Growth'

export function Settings() {
  const s = useStore((x) => x)
  const file = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  function exportData() {
    const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ascend-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  async function importData(f?: File) {
    if (!f) return
    try {
      const data = JSON.parse(await f.text()) as AppState
      if (data.v !== 1 || typeof data.progress !== 'object') throw new Error('bad')
      store.replace(data)
      toast('הגיבוי שוחזר')
    } catch {
      toast('הקובץ הזה לא נראה כמו גיבוי של ASCEND.')
    }
  }

  return (
    <div className="screen settings">
      <header className="page-head page-head--back">
        <BackButton fallback="/" />
        <h1 className="page-title">הגדרות</h1>
      </header>

      <section className="group">
        <h2 className="group__title">אתה</h2>
        <label className="field">
          <span>איך לקרוא לך</span>
          <input value={s.name} onChange={(e) => store.set({ name: e.target.value })} placeholder="שם פרטי" />
        </label>
        <div className="field">
          <span>יעד האזנה יומי</span>
          <Segmented
            label="יעד יומי"
            value={String(s.dailyGoalMin)}
            onChange={(v) => store.set({ dailyGoalMin: Number(v) }, { immediate: true })}
            options={['5', '10', '15', '20', '30'].map((m) => ({ id: m, label: `${m} דק׳` }))}
          />
        </div>
        <div className="field">
          <span>המטרות שלך</span>
          <div className="chips">
            {categories.map((c) => {
              const on = s.goals.includes(c.id)
              return (
                <button
                  key={c.id}
                  className={`chip ${on ? 'is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => store.set((x) => ({ goals: on ? x.goals.filter((g) => g !== c.id) : [...x.goals, c.id as CategoryId] }), { immediate: true })}
                >
                  {c.short}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="group">
        <h2 className="group__title">קריינות</h2>
        <button className="btn btn--ghost btn--wide" onClick={() => navigate('/voices')}>
          האזן ובחר קריין
        </button>
        <div className="field">
          <span>דילוג קדימה ואחורה</span>
          <Segmented label="דילוג" value={String(s.settings.skip)} onChange={(v) => updateSettings({ skip: Number(v) })} options={['10', '15', '30'].map((m) => ({ id: m, label: `${m} שנ׳` }))} />
        </div>
        <label className="toggle">
          <span>
            המשך אוטומטי לשיעור הבא
            <small>כבוי כברירת מחדל, כדי שיהיה רגע לתרגיל</small>
          </span>
          <input type="checkbox" checked={s.settings.autoContinue} onChange={(e) => updateSettings({ autoContinue: e.target.checked })} />
          <i aria-hidden="true" />
        </label>
      </section>

      <section className="group">
        <h2 className="group__title">הערכה עצמית</h2>
        <Assessment />
      </section>

      <section className="group">
        <h2 className="group__title">הנתונים שלך</h2>
        <p className="group__note">ההתקדמות נשמרת במכשיר הזה בלבד. שמור גיבוי מדי פעם כדי לא לאבד אותה.</p>
        <div className="row">
          <button className="btn btn--ghost" onClick={exportData}>
            שמור גיבוי לקובץ
          </button>
          <button className="btn btn--ghost" onClick={() => file.current?.click()}>
            שחזר מגיבוי
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => importData(e.target.files?.[0])} />
        </div>
        {confirmReset ? (
          <div className="row">
            <button className="btn btn--danger" onClick={() => (store.reset(), navigate('/'), toast('הנתונים נמחקו'))}>
              כן, מחק הכל
            </button>
            <button className="btn btn--quiet" onClick={() => setConfirmReset(false)}>
              ביטול
            </button>
          </div>
        ) : (
          <button className="link link--danger" onClick={() => setConfirmReset(true)}>
            מחיקת כל הנתונים
          </button>
        )}
      </section>

      <section className="group about">
        <IconAscend size={28} />
        <p>
          <strong>ASCEND</strong> היא אוניברסיטה פרטית לצמיחה אישית. כל השיעורים הם הסברים מקוריים שנכתבו על בסיס הרעיונות שבספרים, ואינם קריינות, תרגום או תקציר מילולי שלהם. הקריינות נעשית בקול העברי של המכשיר, או מקבצי אודיו מורשים שאתה מוסיף לספרייה.
        </p>
      </section>
    </div>
  )
}
