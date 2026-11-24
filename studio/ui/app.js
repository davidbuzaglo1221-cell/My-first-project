const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v); }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};
const api = async (p, opt = {}) => {
  const r = await fetch(p, { ...opt, headers: { 'Content-Type': 'application/json' } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
};
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); };
const fmtMoney = (m, cur = '$') => m == null ? 'מחיר לא ידוע' : `${cur}${(+m).toFixed(2)}`;
const fmtSec = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} דק׳` : `${Math.round(s)} שנ׳`;

const state = { len: 30, aspect: '9:16', style: 'cinematic', auto: true, picked: new Set(), quote: null, engines: [], job: null };

// ---------- Segmented controls ----------
function radio(groupSel, key, after) {
  const g = $(groupSel);
  g.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    g.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    state[key] = key === 'len' ? +b.dataset.v : b.dataset.v;
    after?.();
  });
}

// ---------- Engines list ----------
function engineRow(e, q) {
  const d = q?.decision;
  const st = state.engines.find(x => x.id === e.id)?.status || {};
  const on = !!st.connected;
  const checked = state.auto ? (state.quote?.auto || []).includes(e.id) : state.picked.has(e.id);
  let tag;
  if (!on) tag = el('span', { class: 'tag' }, 'לא מחובר');
  else if (d?.kind === 'free') tag = el('span', { class: 'tag free' }, e.id === 'local' ? 'חינם' : `חינם · ${d.reason.replace('מכסה חינמית: ', '')}`);
  else if (d?.kind === 'paid') tag = el('span', { class: 'tag paid' }, `בתשלום · ${fmtMoney(d.money, d.currency)}`);
  else tag = el('span', { class: 'tag' }, on ? 'מחובר' : '');
  const sub = e.id === 'local' ? 'אנימציה מתוכנתת וטיפוגרפיה — לא וידאו AI' : on ? (e.strengths || []).join(' · ') : (st.note || 'לא מחובר');
  const li = el('li', { class: 'engine', role: 'checkbox', 'aria-checked': String(checked), 'aria-disabled': String(!on || state.auto), tabindex: on && !state.auto ? 0 : -1 },
    el('span', { class: 'dot' + (on ? ' on' : '') }),
    el('div', { class: 'grow' }, el('div', { class: 'title' }, e.name), el('div', { class: 'sub' }, sub)),
    tag,
    el('span', { class: 'check' + (checked ? ' on' : '') }));
  const toggle = () => { if (!on || state.auto) return; state.picked.has(e.id) ? state.picked.delete(e.id) : state.picked.add(e.id); renderEngines(); };
  li.addEventListener('click', toggle);
  li.addEventListener('keydown', ev => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggle(); } });
  return li;
}

function renderEngines() {
  const ul = $('#engines'); ul.replaceChildren();
  const autoLi = el('li', { class: 'engine auto-row', role: 'switch', 'aria-checked': String(state.auto), tabindex: 0 },
    el('div', { class: 'grow' }, el('div', { class: 'title' }, 'אוטומטי'), el('div', { class: 'sub' }, 'בוחר את המנוע המתאים, חינם קודם')),
    el('span', { class: 'check' + (state.auto ? ' on' : '') }));
  const flip = () => { state.auto = !state.auto; if (!state.auto && !state.picked.size) (state.quote?.auto || ['local']).forEach(id => state.picked.add(id)); renderEngines(); };
  autoLi.addEventListener('click', flip);
  autoLi.addEventListener('keydown', ev => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); flip(); } });
  ul.append(autoLi);
  for (const e of state.engines) ul.append(engineRow(e, state.quote?.engines.find(x => x.id === e.id)));
  renderCost();
}

function chosen() { return state.auto ? (state.quote?.auto || []) : [...state.picked]; }

function renderCost() {
  const ids = chosen();
  const qs = (state.quote?.engines || []).filter(e => ids.includes(e.id));
  const paid = qs.filter(e => e.decision.kind === 'paid');
  const names = qs.map(e => state.engines.find(x => x.id === e.id)?.name || e.id).join(' + ');
  const c = $('#cost');
  if (!state.quote) c.textContent = 'כתוב רעיון כדי לראות תוכנית ועלות';
  else if (!ids.length) c.textContent = 'בחר מנוע';
  else c.replaceChildren(el('b', {}, names || '—'), el('br'), paid.length ? `דורש אישור: ${paid.map(p => fmtMoney(p.decision.money, p.decision.currency)).join(' + ')}` : 'חינם');
  $('#go').disabled = !state.quote || !ids.length;
  const auto = state.quote?.auto || [];
  $('#auto-hint').textContent = state.auto && state.quote
    ? (auto.length === 1 && auto[0] === 'local' ? 'אין עדיין מנוע AI מחובר עם מכסה חינמית — המנוע המקומי ייצר את הסרטון בחינם.' : `נבחרו: ${auto.map(id => state.engines.find(x => x.id === id)?.name).join(' ו-')} — במקביל, להשוואה.`)
    : '';
}

// ---------- Plan preview ----------
let qTimer;
function requestQuote() {
  clearTimeout(qTimer);
  qTimer = setTimeout(async () => {
    const idea = $('#idea').value.trim();
    if (idea.length < 3) { state.quote = null; $('#scenes').replaceChildren(); $('#plan-meta').textContent = ''; renderEngines(); return; }
    const r = await api('/api/quote', { method: 'POST', body: JSON.stringify({ idea, lengthSec: state.len, style: state.style, aspect: state.aspect }) });
    if (r.status !== 200) return toast(r.body.error || 'שגיאה');
    state.quote = r.body;
    const sc = r.body.plan.scenes;
    $('#plan-meta').textContent = `${sc.length} סצנות · ${r.body.plan.brief.goalHe}`;
    $('#scenes').replaceChildren(...sc.map(s => el('li', {}, el('span', {}, s.narration), el('span', { class: 't' }, `${s.durationSec}s`), el('span', { class: 'cap' }, `על המסך: ${s.caption}`))));
    renderEngines();
  }, 350);
}

// ---------- Create ----------
async function create(approval = {}) {
  const body = { idea: $('#idea').value.trim(), lengthSec: state.len, style: state.style, aspect: state.aspect, engines: state.auto ? 'auto' : chosen(), approval };
  $('#go').disabled = true;
  const r = await api('/api/jobs', { method: 'POST', body: JSON.stringify(body) });
  $('#go').disabled = false;
  if (r.status === 402) return askApproval(r.body.needsApproval, body);
  if (r.status !== 201) return toast(r.body.error || 'שגיאה');
  state.job = r.body; show('results'); pollJob(r.body.id);
}

function askApproval(list, body) {
  const ul = $('#ap-list');
  ul.replaceChildren(...list.map(n => el('li', {}, el('div', { class: 'grow' }, el('div', { class: 'title' }, state.engines.find(e => e.id === n.id)?.name || n.id), el('div', { class: 'sub' }, n.decision.reason)),
    el('span', { class: 'tag paid' }, n.decision.money == null ? 'המחיר יוצג בשירות' : `עד ${fmtMoney(n.decision.money, n.decision.currency)}`))));
  const total = list.reduce((a, n) => a + (n.decision.money || 0), 0);
  $('#ap-ok').textContent = list.some(n => n.decision.money == null) ? 'אישור' : `אישור תשלום עד ${fmtMoney(total, list[0].decision.currency)}`;
  const d = $('#approve');
  d.onclose = () => {
    if (d.returnValue !== 'ok') return toast('בוטל. לא נשלח כלום.');
    const approval = Object.fromEntries(list.map(n => [n.id, n.decision.money == null ? { unknownPrice: true } : { maxMoney: n.decision.money }]));
    create(approval);
  };
  d.showModal();
}

// ---------- Results ----------
let pollT;
async function pollJob(id) {
  clearTimeout(pollT);
  const r = await api(`/api/jobs/${id}`);
  if (r.status !== 200) return;
  state.job = r.body; renderJob();
  if (r.body.state === 'running') pollT = setTimeout(() => pollJob(id), 2000);
  else { loadJobs(); loadSavings(); }
}

function renderJob() {
  const j = state.job; const box = $('#job');
  if (!j) { box.replaceChildren(el('p', { class: 'lead' }, 'עוד לא נוצר סרטון. התחל בלשונית יצירה.')); return; }
  const rows = el('ul', { class: 'list' }, ...j.engines.map(e => el('li', { class: `state-${e.state}` },
    el('div', { class: 'grow' }, el('div', { class: 'title' }, e.name), el('div', { class: 'sub' }, e.state === 'done' ? `מוכן · ${fmtSec(e.result.probe.duration)}` : e.step),
      e.state === 'running' || e.state === 'queued' ? el('div', { class: 'bar' }, el('i', { style: `width:${e.progress}%` })) : null),
    el('span', { class: 'tag' + (e.state === 'done' ? ' free' : e.state === 'failed' ? ' paid' : '') }, { queued: 'בתור', running: `${e.progress}%`, done: 'מוכן', failed: 'נכשל', skipped: 'דולג' }[e.state]))));
  const done = j.engines.filter(e => e.state === 'done').sort((a, b) => (b.id === j.winner) - (a.id === j.winner));
  const grid = el('div', { class: 'compare' }, ...done.map(e => {
    const p = e.result.probe;
    return el('article', { class: 'result' + (e.id === j.winner && done.length > 1 ? ' win' : '') },
      el('video', { src: `/files/${e.result.file}`, poster: `/files/${e.result.thumb}`, controls: '', playsinline: '', preload: 'metadata' }),
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, e.name, e.id === j.winner && done.length > 1 ? el('span', { class: 'badge' }, 'הכי טוב') : null),
        el('div', { class: 'specs' },
          el('span', {}, 'אורך ', el('b', {}, fmtSec(p.duration))), el('span', {}, 'רזולוציה ', el('b', {}, `${p.width}×${p.height}`)),
          el('span', {}, 'ציון טכני ', el('b', {}, `${e.result.score}/100`)), el('span', {}, 'עלות ', el('b', {}, e.result.money ? fmtMoney(e.result.money) : 'חינם')),
          el('span', {}, 'זמן הפקה ', el('b', {}, fmtSec(e.result.seconds))), el('span', {}, 'סאונד ', el('b', {}, p.hasAudio ? 'כן' : 'לא'))),
        el('a', { class: 'primary dl', href: `/files/${e.result.file}?download=1`, download: '' }, 'הורדת MP4'),
        e.id === 'local' ? el('div', { class: 'note' }, 'אנימציה מתוכנתת, לא וידאו שנוצר ב-AI.') : null));
  }));
  box.replaceChildren(el('div', { class: 'job-head' }, el('div', { class: 'idea-q' }, j.idea), el('div', { class: 'when' }, `${j.aspect} · ${new Date(j.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`)), rows, grid);
}

async function loadJobs() {
  const r = await api('/api/jobs');
  $('#jobs').replaceChildren(...(r.body || []).filter(j => j.id !== state.job?.id).slice(0, 12).map(j => {
    const li = el('li', { tabindex: 0, class: 'engine' }, el('div', { class: 'grow' }, el('div', { class: 'title' }, j.idea), el('div', { class: 'sub' }, `${j.engines.map(e => e.name).join(' · ')} · ${new Date(j.createdAt).toLocaleDateString('he-IL')}`)),
      el('span', { class: 'tag' }, j.state === 'done' ? 'מוכן' : j.state === 'running' ? 'בעבודה' : 'נכשל'));
    li.addEventListener('click', () => { state.job = j; renderJob(); pollJob(j.id); scrollTo({ top: 0, behavior: 'smooth' }); });
    return li;
  }));
}

// ---------- Savings ----------
async function loadSavings(fresh = false) {
  const r = await api('/api/engines' + (fresh ? '?fresh=1' : ''));
  state.engines = r.body || [];
  renderEngines();
  const costOf = e => ({ vaideo: '1 קרדיט עד דקה (‎€0.29)', aituber: '≈35 קרדיטים ל-30 שנ׳', seedance: '$0.07–0.23 לשנייה', korpi: 'לפי מודל, מוצג לפני הפקה', local: 'חינם' }[e.id]);
  $('#ledger tbody').replaceChildren(...state.engines.map(e => {
    const s = e.status || {}; const l = e.ledger || {};
    const left = e.id === 'local' ? '∞' : s.credits ?? '—';
    const freeLeft = e.freeGrant == null ? 'ללא הגבלה' : e.freeGrant ? `${Math.max(0, e.freeGrant - (l.spentCredits || 0))} מתוך ${e.freeGrant}` : 'אין (רק תכנון חינם)';
    return el('tr', {},
      el('td', {}, el('div', {}, e.name), el('div', { class: 'sub' }, e.official)),
      el('td', {}, el('span', { class: 'dot' + (s.connected ? ' on' : ''), style: 'display:inline-block;margin-inline-end:6px' }), s.connected ? 'מחובר' : 'לא מחובר', s.connected ? null : el('div', { class: 'sub' }, s.note || '')),
      el('td', {}, String(left), el('div', { class: 'sub' }, s.plan || '')),
      el('td', {}, freeLeft),
      el('td', {}, costOf(e), l.spentMoney ? el('div', { class: 'sub' }, `שולם: ${fmtMoney(l.spentMoney)}`) : null),
      el('td', {}, l.lastQuality != null ? `${l.lastQuality}/100 · ${fmtSec(l.lastDurationSec)}` : '—', l.lastResolution ? el('div', { class: 'sub' }, l.lastResolution) : null));
  }));
  const h = await api('/api/history');
  $('#history').replaceChildren(...(h.body || []).slice(-20).reverse().map(x => el('li', {},
    el('div', { class: 'grow' }, el('div', { class: 'title' }, state.engines.find(e => e.id === x.engine)?.name || x.engine), el('div', { class: 'sub' }, x.ok ? `${x.resolution} · ${fmtSec(x.durationSec)} · איכות ${x.quality}` : (x.error || 'נכשל'))),
    el('span', { class: 'tag' + (x.money ? ' paid' : ' free') }, x.money ? fmtMoney(x.money) : 'חינם'))));
}

// ---------- Nav ----------
function show(v) {
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === `view-${v}`));
  document.querySelectorAll('.tabs button').forEach(b => b.dataset.view === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (v === 'results') { renderJob(); loadJobs(); }
  if (v === 'savings') loadSavings();
  scrollTo({ top: 0 });
}

async function init() {
  const o = (await api('/api/options')).body;
  $('#style').replaceChildren(...Object.entries(o.styles).map(([k, v]) => el('button', { role: 'radio', 'data-v': k, 'aria-checked': String(k === state.style) }, v)));
  radio('#length', 'len', requestQuote); radio('#aspect', 'aspect', requestQuote); radio('#style', 'style', requestQuote);
  $('#idea').addEventListener('input', e => { $('#count').textContent = e.target.value.length; requestQuote(); });
  $('#go').addEventListener('click', () => create());
  $('#refresh').addEventListener('click', async () => { toast('בודק חיבורים…'); await loadSavings(true); requestQuote(); toast('החיבורים עודכנו'); });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
  await loadSavings();
  renderCost();
}
init();
