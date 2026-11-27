import { useEffect, useState } from 'react'
import { lessonIndex } from '../content'
import { load } from '../engine/player'
import { addHabit, markActionDone, saveJournal, useStore } from '../lib/store'
import { IconCheck, IconPlay, IconPlus } from '../ui/Icons'
import { Sheet } from '../ui/Kit'
import { openPlayer, showComplete, toast, useUI } from '../ui/uiState'

export function LessonComplete() {
  const { completeId } = useUI()
  const [lastId, setLastId] = useState<string>()
  useEffect(() => {
    if (completeId) setLastId(completeId)
  }, [completeId])
  const id = completeId ?? lastId
  const ref = id ? lessonIndex[id] : undefined
  const done = useStore((s) => (id ? s.progress[id]?.done : false))
  const actionDone = useStore((s) => (id ? !!s.actions[id] : false))
  const habitAdded = useStore((s) => !!ref?.lesson.exercise.habit && s.habits.some((h) => h.text === ref.lesson.exercise.habit && !h.archived))
  const existing = useStore((s) => (id && ref?.lesson.exercise.reflect ? s.journal.find((j) => j.lessonId === id)?.text ?? '' : ''))
  const [text, setText] = useState('')
  useEffect(() => {
    setText(existing)
  }, [existing, id])

  if (!ref) return null
  const { lesson, book, index } = ref
  const next = book.lessons[index + 1]
  const close = () => showComplete(undefined)

  return (
    <Sheet open={!!completeId} onClose={close} label="סיום שיעור" className="done-sheet">
      <div className="done">
        <div className={`done__seal ${done ? 'is-done' : ''}`} aria-hidden="true">
          <IconCheck size={30} />
        </div>
        <p className="done__kicker">{done ? 'הפרק הושלם' : `פרק ${index + 1} ב״${book.title}״`}</p>
        <blockquote className="done__quote">{lesson.takeaway}</blockquote>

        <div className="done__task">
          <h3>התרגיל שלך</h3>
          <p>{lesson.exercise.task}</p>
          <button className={`btn ${actionDone ? 'btn--done' : 'btn--primary'}`} onClick={() => (markActionDone(lesson.id, !actionDone), !actionDone && toast('כל הכבוד. ככה ידע הופך להרגל.'))}>
            {actionDone ? (
              <>
                <IconCheck size={18} /> ביצעתי
              </>
            ) : (
              'סמן שביצעתי'
            )}
          </button>
        </div>

        {lesson.exercise.habit && (
          <div className="done__habit">
            <div>
              <h3>להפוך את זה להרגל</h3>
              <p>{lesson.exercise.habit}</p>
            </div>
            <button
              className={`btn btn--ghost ${habitAdded ? 'btn--done' : ''}`}
              disabled={habitAdded}
              onClick={() => (addHabit(lesson.exercise.habit!, lesson.id), toast('ההרגל נוסף. תסמן אותו כל יום במסך צמיחה.'))}
            >
              {habitAdded ? (
                <>
                  <IconCheck size={16} /> במעקב
                </>
              ) : (
                <>
                  <IconPlus size={16} /> הוסף למעקב
                </>
              )}
            </button>
          </div>
        )}

        {lesson.exercise.reflect && (
          <div className="done__reflect">
            <label htmlFor="reflect">{lesson.exercise.reflect}</label>
            <textarea id="reflect" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="כמה מילים, רק בשבילך" />
            <button className="btn btn--ghost" disabled={!text.trim() || text.trim() === existing} onClick={() => (saveJournal(lesson.id, lesson.exercise.reflect!, text), toast('נשמר ביומן התובנות'))}>
              שמור ביומן
            </button>
          </div>
        )}

        <div className="done__next">
          {next ? (
            <button className="btn btn--wide btn--primary" onClick={() => (close(), load(next.id, { autoplay: true, from: 0 }), openPlayer())}>
              <IconPlay size={16} /> לפרק הבא: {next.title}
            </button>
          ) : (
            <p className="done__end">סיימת את כל הפרקים של ״{book.title}״.</p>
          )}
          <button className="btn btn--wide btn--quiet" onClick={close}>
            סגור
          </button>
        </div>
      </div>
    </Sheet>
  )
}
