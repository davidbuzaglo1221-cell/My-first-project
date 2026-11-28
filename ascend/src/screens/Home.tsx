import { PhotoTile } from '../ui/PhotoTile'
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  bookById,
  bookSeconds,
  books,
  categories,
  categoryById,
  formatMinutes,
  lessonIndex,
} from "../content";
import { usePlayer } from "../engine/player";
import { greeting } from "../lib/dates";
import { currentStreak, todaySeconds } from "../lib/insights";
import { bookPercent, bookStatus, dueCards, libraryStats } from "../lib/learn";
import { navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { Cover, bookHue } from "../ui/Cover";
import {
  AreaIcon,
  IconBook,
  IconChat,
  IconFlame,
  IconLotus,
  IconPlay,
  IconSearch,
} from "../ui/Icons";
import { Eq, Ring, SectionHead, startLesson } from "../ui/Kit";
import { BookTile, Learned } from "../ui/Books";
import { TodayCard } from "../ui/Daily";
import { load } from "../engine/player";
import { coachNotes } from "../lib/coach";
import { nextProgramDay, todayChecks } from "../lib/daily";
import { openPlayer } from "../ui/uiState";
import { rank, tasksFor } from "../lib/mastery";

const fmtListen = (sec: number) => {
  const m = Math.floor(sec / 60);
  return m < 60
    ? { v: String(m), u: "דק׳" }
    : {
        v: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`,
        u: "שע׳",
      };
};

/** Center-focused shelf: the book nearest the middle grows, its neighbours recede. */
function Showcase({ ids }: { ids: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = el.getBoundingClientRect().left + el.clientWidth / 2;
      let best = 0;
      let bestD = Infinity;
      Array.from(el.children).forEach((child, i) => {
        const b = (child as HTMLElement).getBoundingClientRect();
        const d = Math.max(
          -1.6,
          Math.min(1.6, (b.left + b.width / 2 - mid) / b.width),
        );
        (child as HTMLElement).style.setProperty("--d", String(d));
        (child as HTMLElement).style.setProperty("--a", String(Math.abs(d)));
        if (Math.abs(d) < bestD) {
          bestD = Math.abs(d);
          best = i;
        }
      });
      setActive(best);
    };
    const onScroll = () => (raf ||= requestAnimationFrame(update));
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  const book = bookById[ids[active]];
  return (
    <section className="showcase" aria-label="ספרים נבחרים">
      <div
        className="showcase__glow"
        style={{ ["--hue" as string]: bookHue(book) }}
        aria-hidden="true"
      />
      <div className="showcase__track" ref={ref}>
        {ids.map((id, i) => (
          <button
            key={id}
            className={`showcase__item ${i === active ? "is-active" : ""}`}
            onClick={(e) =>
              i === active
                ? navigate(`/book/${id}`)
                : (e.currentTarget as HTMLElement).scrollIntoView({
                    behavior: "smooth",
                    inline: "center",
                    block: "nearest",
                  })
            }
            aria-label={bookById[id].title}
          >
            <Cover book={bookById[id]} size="lg" />
          </button>
        ))}
      </div>
      <div className="showcase__info" key={book.id}>
        <p className="showcase__area">{categoryById[book.category].short}</p>
        <h3 className="showcase__title">{book.title}</h3>
        <p className="showcase__author">{book.author}</p>
        <p className="showcase__tag">{book.tagline}</p>
        <div className="showcase__actions">
          <button
            className="btn btn--primary"
            onClick={() => startLesson(book.lessons[0].id)}
          >
            <IconPlay size={14} /> האזן עכשיו
          </button>
          <span className="showcase__len">
            {formatMinutes(bookSeconds(book))}
            <span className="sep" aria-hidden="true" />
            {book.lessons.length} פרקים
          </span>
        </div>
      </div>
    </section>
  );
}

/** Scroll-linked depth: the photograph moves slower than the page, darkens, and a glass bar takes over. */
function useHeroScroll() {
  const hero = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let raf = 0;
    const still = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = hero.current;
        if (!el) return;
        const y = window.scrollY;
        const h = el.offsetHeight;
        if (!still) el.style.setProperty("--sy", String(Math.min(y, h)));
        setStuck(y > Math.min(160, h - 120));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => (
      window.removeEventListener("scroll", on),
      cancelAnimationFrame(raf)
    );
  }, []);
  return { hero, stuck };
}

export function Home() {
  const { hero, stuck } = useHeroScroll();
  const s = useStore((x) => x);
  const p = usePlayer();
  const stats = libraryStats(s);
  const streak = currentStreak(s);
  const today = Math.round(todaySeconds(s) / 60);
  const due = dueCards(s).length;
  const initial = (s.name || "A").trim().charAt(0);

  // Books in progress, most recent first
  const recent = (b: (typeof books)[number]) =>
    Math.max(
      0,
      s.reading?.[b.id]?.last ?? 0,
      ...b.lessons.map((l) => s.progress[l.id]?.last ?? 0),
    );
  const active = books
    .filter((b) => bookStatus(s, b) === "active")
    .sort((a, b) => recent(b) - recent(a))
    .slice(0, 8);
  const nextOf = (b: (typeof books)[number]) =>
    b.lessons.find((l) => !s.progress[l.id]?.done && !s.readDone?.[l.id]) ??
    b.lessons[0];

  // The one most valuable thing right now: continue the book you are in, else today's practice, else begin.
  const notes = coachNotes(s);
  const checks = todayChecks(s);
  const dayDone =
    Number(checks.practice) + Number(checks.chapter) + Number(checks.idea);
  const prog = nextProgramDay(s);
  const next = active[0]
    ? (() => {
        const l = nextOf(active[0]);
        return {
          kicker: "להמשיך מאיפה שעצרת",
          title: `${active[0].title} · פרק ${active[0].lessons.indexOf(l) + 1}`,
          go: () => startLesson(l.id),
        };
      })()
    : !checks.practice
      ? {
          kicker: "התרגול של היום",
          title: prog.day.title,
          go: () => (
            load(`calm:${prog.day.id}`, { autoplay: true, from: 0 }),
            openPlayer()
          ),
        }
      : {
          kicker: "הספר הראשון שלך",
          title: `${books[0].title} · פרק 1`,
          go: () => startLesson(books[0].lessons[0].id),
        };

  // The one task that matters most today, from the user's own list. A precise line from real data, never a slogan.
  const top = tasksFor(s)
    .filter((t) => !t.done)
    .sort((a, b) => rank(b) - rank(a))[0];
  const openTasks = tasksFor(s).filter((t) => !t.done).length;
  const heroLine = top
    ? openTasks > 1
      ? `${openTasks} דברים פתוחים היום. מתחילים בחשוב מכולם.`
      : "נשאר דבר אחד היום. הוא שלך."
    : dayDone === 3
      ? "שלושת הדברים של היום מאחוריך."
      : streak
        ? `${streak} ימים ברצף. היום שומר עליו.`
        : "יום חדש. צעד אחד מספיק כדי להתחיל.";

  // The whole library, interleaved across areas and rotated daily
  const dayN = Math.floor(Date.now() / 86400000);
  const mixed: string[] = [];
  const byArea = categories.map((c) =>
    books.filter((b) => b.category === c.id),
  );
  for (let i = 0; mixed.length < books.length; i++)
    byArea.forEach((l) => l[i] && mixed.push(l[i].id));
  const rot = dayN % mixed.length;
  const featured = [...mixed.slice(rot), ...mixed.slice(0, rot)].slice(0, 12);

  return (
    <div className="screen home4">
      <header className="homehero" ref={hero}>
        <div className="homehero__scene" aria-hidden="true">
          <div className="homehero__frame">
            <img
              className="homehero__img"
              src="photos/home.webp"
              alt=""
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </div>
        {createPortal(
          <div className={`homebar ${stuck ? "is-on" : ""}`}>
            <button
              className="avatar"
              onClick={() => navigate("/settings")}
              aria-label="פרופיל והגדרות"
            >
              {initial}
            </button>
            <span className="wordmark wordmark--he">המסע שלי</span>
            <button
              className="icon-btn icon-btn--glass"
              onClick={() => navigate("/explore")}
              aria-label="חיפוש בספרייה"
            >
              <IconSearch size={19} />
            </button>
          </div>,
          document.body,
        )}
        <div className="homehero__text">
          <div className="homehero__chips">
            <span className="hchip">
              <IconFlame size={13} />{" "}
              {streak ? `${streak} ימים ברצף` : "היום מתחיל רצף"}
            </span>
            <span className="hchip">
              <span
                className="hchip__ring"
                style={{ ["--p" as string]: `${(dayDone / 3) * 100}%` }}
              />{" "}
              {dayDone}/3 היום
            </span>
          </div>
          <span className="homehero__kicker">MY JOURNEY</span>
          <p className="homehero__greet">
            {greeting()}
            {s.name ? `, ${s.name}` : ""}
          </p>
          <h1 className="homehero__title">המסע שלך</h1>
          <p className="homehero__line">{heroLine}</p>
        </div>
        <button className="nownext" onClick={next.go}>
          <span className="nownext__play" aria-hidden="true">
            {p.status === "playing" ? <Eq /> : <IconPlay size={15} />}
          </span>
          <span className="nownext__body">
            <small>{next.kicker}</small>
            <strong>{next.title}</strong>
          </span>
        </button>
      </header>

      <button className="toptask" onClick={() => navigate("/mastery/day")}>
        <span className="toptask__k">{top ? "החשוב ביותר היום" : "היום שלך"}</span>
        <strong>{top ? top.text : "לבחור את הדבר האחד שחשוב היום"}</strong>
        <span className="toptask__go" aria-hidden="true">‹</span>
      </button>

      <TodayCard />

      <button
        className="learnrow"
        onClick={() => navigate("/progress")}
        aria-label={`למדת ${stats.percent} אחוז מהספרייה`}
      >
        <span className="learnrow__top">
          <strong>{stats.percent}%</strong>
          <span>מהספרייה למדת</span>
          <span className="learnrow__facts">
            {stats.done} פרקים · {stats.booksDone} ספרים ·{" "}
            <IconFlame size={13} /> {streak} ימים ברצף
          </span>
        </span>
        <Learned value={stats.percent} />
      </button>

      <section className="block">
        <SectionHead title="העולמות שלך" sub="כל אחד מהם הוא דקה שמשנה את היום" />
        <div className="ptiles" role="list">
          <PhotoTile size="lg" img="assistant" kicker="עוזר אישי" title={notes.length ? `${notes.length} דברים לדבר עליהם` : 'שיחה של חמש דקות'} line="ישיר, כן, ולעניין" to="/coach" />
          <PhotoTile size="lg" img="calm" kicker="מהישרדות לחופש" title="נשימה, גוף ושקט" line="30 יום שמלמדים את הגוף להירגע" to="/freedom" pos="50% 62%" />
          <PhotoTile size="lg" img="situation" kicker="מצב מהחיים" title="מה היית עושה?" line="שלוש תגובות, רק אחת עובדת" to="/situation" pos="38% 50%" />
          <PhotoTile size="lg" img="evening" kicker="עצירה של דקה" title="איך אתה מרגיש?" line="השאלה של היום" to="/checkin" pos="50% 70%" />
          <PhotoTile size="lg" img="notebook" kicker="המחברת" title={due ? `${due} כרטיסים לחזרה` : 'מה שחשוב לזכור'} line="מה שכתבת, אהבת והקלטת" to="/notes" />
        </div>
      </section>

      {active.length > 0 && (
        <section className="block">
          <SectionHead title="ממשיכים ללמוד" sub="הספרים שאתה באמצע" />
          <div className="cn4row" role="list">
            {active.map((b) => {
              const l = nextOf(b);
              const playing =
                p.track?.bookId === b.id && p.status === "playing";
              return (
                <div key={b.id} role="listitem" className="cn4">
                  <button
                    className="cn4__cover"
                    onClick={() => navigate(`/book/${b.id}`)}
                  >
                    <Cover book={b} size="md" />
                  </button>
                  <span className="cn4__title">{b.title}</span>
                  <Learned value={bookPercent(s, b)} compact />
                  <button className="cn4__go" onClick={() => startLesson(l.id)}>
                    {playing ? <Eq /> : <IconPlay size={11} />} פרק{" "}
                    {b.lessons.indexOf(l) + 1}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="block">
        <SectionHead
          title="מהמדף היום"
          sub={`${books.length} ספרים, בכל יום מדף אחר`}
          action="לכל הספרייה"
          onAction={() => navigate("/explore")}
        />
        <Showcase ids={featured} />
      </section>

      {categories.map((c) => {
        const list = books.filter((b) => b.category === c.id);
        return (
          <section key={c.id} className="block">
            <SectionHead
              title={c.name}
              sub={`${list.length} ספרים · ${c.promise}`}
              action="לכל התחום"
              onAction={() => navigate(`/explore/${c.id}`)}
            />
            <div className="tiles tiles--row">
              {list.map((b) => (
                <BookTile key={b.id} id={b.id} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
