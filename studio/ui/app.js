const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v); }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};
const api = async (p, opt = {}) => {
  try {
    const r = await fetch(p, { ...opt, headers: { 'Content-Type': 'application/json' } });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch { return { status: 0, body: { error: 'אין חיבור לשרת הסטודיו' } }; }
};
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3400); };
const money = (m, cur = '$') => m == null ? 'מחיר לא ידוע' : `${cur}${(+m).toFixed(2)}`;
const secs = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} דק׳` : `${Math.round(s)} שנ׳`;
const onKey = fn => ev => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); fn(); } };
const avatar = (c, size) => el('span', { class: 'av', style: size ? `width:${size}px;height:${size}px` : null }, c?.image ? el('img', { src: `/chars/${c.image}`, alt: '' }) : (c?.name || '?').slice(0, 1));

const state = { len: 30, aspect: '9:16', style: 'auto', auto: true, picked: new Set(), cast: new Set(), lipsync: false, quote: null, engines: [], options: null, chars: [], job: null };

// ---------- Create ----------
function radio(groupSel, key, after) {
  $(groupSel).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $(groupSel).querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    state[key] = key === 'len' ? +b.dataset.v : b.dataset.v;
    after?.();
  });
}

function renderCast() {
  const box = $('#cast');
  box.replaceChildren(
    ...state.chars.map(c => {
      const on = state.cast.has(c.id);
      return el('button', { class: 'cast-item', 'aria-pressed': String(on), onclick: () => { on ? state.cast.delete(c.id) : state.cast.size < 4 ? state.cast.add(c.id) : toast('עד 4 דמויות בסרטון'); renderCast(); requestQuote(); } },
        avatar(c), el('span', { class: 'nm' }, c.name));
    }),
    el('button', { class: 'cast-item cast-add', onclick: () => openChar() }, el('span', { class: 'av' }, '+'), el('span', { class: 'nm' }, 'דמות חדשה')));
  const auto = state.quote?.plan.cast?.filter(c => c.auto) || [];
  $('#cast-hint').textContent = state.cast.size ? `${state.cast.size} נבחרו` : auto.length ? `זוהו מהרעיון: ${auto.map(c => c.name).join(', ')}` : 'בלי בחירה — מזהים דמויות מהרעיון';
}

function engineRow(e, q) {
  const d = q?.decision; const st = e.status || {}; const on = !!st.connected;
  const checked = state.auto ? (state.quote?.auto || []).includes(e.id) : state.picked.has(e.id);
  let tag;
  if (!on) tag = el('span', { class: 'tag' }, 'לא מחובר');
  else if (d?.kind === 'free') tag = el('span', { class: 'tag free' }, e.id === 'local' ? 'חינם' : 'חינם · מכסה');
  else if (d?.kind === 'paid') tag = el('span', { class: 'tag paid' }, `בתשלום · ${money(d.money, d.currency)}`);
  else tag = el('span', { class: 'tag' }, 'מחובר');
  const sub = e.id === 'local' ? 'אנימציה מתוכנתת וקריינות — לא וידאו AI' : on ? (e.strengths || []).join(' · ') : (st.note || 'לא מחובר');
  const toggle = () => { if (!on || state.auto) return; state.picked.has(e.id) ? state.picked.delete(e.id) : state.picked.add(e.id); renderEngines(); };
  return el('li', { class: 'engine clickable', role: 'checkbox', 'aria-checked': String(checked), 'aria-disabled': String(!on || state.auto), tabindex: on && !state.auto ? 0 : -1, onclick: toggle, onkeydown: onKey(toggle) },
    el('span', { class: 'dot' + (on ? ' on' : '') }),
    el('div', { class: 'grow' }, el('div', { class: 'title' }, e.name), el('div', { class: 'sub' }, sub)),
    tag, el('span', { class: 'check' + (checked ? ' on' : '') }));
}

function renderEngines() {
  const flip = () => { state.auto = !state.auto; if (!state.auto && !state.picked.size) (state.quote?.auto || ['local']).forEach(id => state.picked.add(id)); renderEngines(); };
  $('#engines').replaceChildren(
    el('li', { class: 'engine auto-row clickable', role: 'switch', 'aria-checked': String(state.auto), tabindex: 0, onclick: flip, onkeydown: onKey(flip) },
      el('div', { class: 'grow' }, el('div', { class: 'title' }, 'אוטומטי'), el('div', { class: 'sub' }, 'בוחר את המנוע המתאים — חינם קודם')),
      el('span', { class: 'check' + (state.auto ? ' on' : '') })),
    ...state.engines.map(e => engineRow(e, state.quote?.engines.find(x => x.id === e.id))));
  renderCost();
}

const chosen = () => state.auto ? (state.quote?.auto || []) : [...state.picked];

function renderCost() {
  const ids = chosen();
  const qs = (state.quote?.engines || []).filter(e => ids.includes(e.id));
  const paid = qs.filter(e => e.decision.kind === 'paid');
  const names = qs.map(e => state.engines.find(x => x.id === e.id)?.name || e.id).join(' + ');
  const c = $('#cost');
  if (!state.quote) c.textContent = 'כתוב רעיון כדי לראות תוכנית ועלות';
  else if (!ids.length) c.textContent = 'בחר מנוע';
  else c.replaceChildren(el('b', {}, names), el('br'), paid.length ? `דורש אישור: ${paid.map(p => money(p.decision.money, p.decision.currency)).join(' + ')}` : 'חינם');
  $('#go').disabled = !state.quote || !ids.length;
  const auto = state.quote?.auto || [];
  $('#auto-hint').textContent = !state.quote || !state.auto ? '' : auto.length === 1 && auto[0] === 'local'
    ? 'אין עדיין מנוע AI מחובר עם מכסה חינמית — המנוע המקומי ייצר טיוטה בחינם.'
    : `נבחרו: ${auto.map(id => state.engines.find(x => x.id === id)?.name).join(' ו-')} — במקביל, להשוואה.`;
  if (state.lipsync && state.quote && !ids.some(id => ['aituber', 'seedance', 'korpi'].includes(id))) $('#auto-hint').textContent += ' סנכרון שפתיים דורש AITuber, Seedance או Korpi מחובר.';
}

let qTimer;
function requestQuote() {
  clearTimeout(qTimer);
  qTimer = setTimeout(async () => {
    const idea = $('#idea').value.trim();
    if (idea.length < 3) { state.quote = null; $('#scenes').replaceChildren(); $('#plan-meta').textContent = ''; $('#style-hint').textContent = ''; renderEngines(); renderCast(); return; }
    const r = await api('/api/quote', { method: 'POST', body: JSON.stringify(payload()) });
    if (r.status !== 200) return toast(r.body.error || 'שגיאה');
    state.quote = r.body;
    const pl = r.body.plan;
    $('#plan-meta').textContent = `${pl.scenes.length} סצנות · ${pl.brief.goalHe}`;
    $('#style-hint').textContent = pl.brief.styleAuto ? `אוטומטי: ${pl.brief.styleHe}` : '';
    $('#scenes').replaceChildren(...pl.scenes.map(s => el('li', {}, el('span', { class: 'who' }, s.speakerName), el('span', {}, s.narration), el('span', { class: 't' }, `${s.durationSec}s`), el('span', { class: 'cap' }, `על המסך: ${s.caption}`))));
    renderEngines(); renderCast();
  }, 350);
}

const payload = (extra = {}) => ({ idea: $('#idea').value.trim(), lengthSec: state.len, style: state.style, aspect: state.aspect, cast: [...state.cast], lipsync: state.lipsync, engines: state.auto ? 'auto' : chosen(), ...extra });

async function create(approval = {}) {
  $('#go').disabled = true;
  const r = await api('/api/jobs', { method: 'POST', body: JSON.stringify(payload({ approval })) });
  $('#go').disabled = false;
  if (r.status === 402) return askApproval(r.body.needsApproval);
  if (r.status !== 201) return toast(r.body.error || 'שגיאה');
  state.job = r.body; show('gallery'); pollJob(r.body.id);
}

function askApproval(list) {
  $('#ap-list').replaceChildren(...list.map(n => el('li', {}, el('div', { class: 'grow' }, el('div', { class: 'title' }, state.engines.find(e => e.id === n.id)?.name || n.id), el('div', { class: 'sub' }, n.decision.reason)),
    el('span', { class: 'tag paid' }, n.decision.money == null ? 'מחיר יוצג בשירות' : `עד ${money(n.decision.money, n.decision.currency)}`))));
  const total = list.reduce((a, n) => a + (n.decision.money || 0), 0);
  $('#ap-ok').textContent = list.some(n => n.decision.money == null) ? 'אישור' : `אישור תשלום עד ${money(total, list[0].decision.currency)}`;
  const d = $('#approve');
  d.onclose = () => {
    if (d.returnValue !== 'ok') return toast('בוטל. לא נשלח כלום.');
    create(Object.fromEntries(list.map(n => [n.id, n.decision.money == null ? { unknownPrice: true } : { maxMoney: n.decision.money }])));
  };
  d.returnValue = ''; d.showModal();
}

// ---------- Gallery ----------
let pollT;
async function pollJob(id) {
  clearTimeout(pollT);
  const r = await api(`/api/jobs/${id}`);
  if (r.status !== 200) return;
  state.job = r.body; renderJob();
  if (r.body.state === 'running') pollT = setTimeout(() => pollJob(id), 2000);
  else loadJobs();
}

const STATE_HE = { queued: 'בתור', running: null, done: 'מוכן', failed: 'נכשל', skipped: 'דולג', interrupted: 'נקטע' };

function renderJob() {
  const j = state.job; const box = $('#job');
  if (!j) return box.replaceChildren();
  const rows = el('ul', { class: 'list' }, ...j.engines.map(e => el('li', { class: `state-${e.state}` },
    el('div', { class: 'grow' }, el('div', { class: 'title' }, e.name), el('div', { class: 'sub' }, e.state === 'done' ? `מוכן ונבדק · ${secs(e.result.probe.duration)}` : e.step),
      e.state === 'running' || e.state === 'queued' ? el('div', { class: 'bar' }, el('i', { style: `width:${e.progress}%` })) : null),
    el('span', { class: 'tag' + (e.state === 'done' ? ' free' : ['failed', 'interrupted'].includes(e.state) ? ' paid' : '') }, STATE_HE[e.state] ?? `${e.progress}%`))));
  // Only engines whose final file exists and was probed are shown as videos.
  const done = j.engines.filter(e => e.state === 'done' && e.result?.file).sort((a, b) => (b.id === j.winner) - (a.id === j.winner));
  const grid = el('div', { class: 'compare' }, ...done.map(e => {
    const p = e.result.probe; const win = e.id === j.winner && done.length > 1;
    return el('article', { class: 'result' + (win ? ' win' : '') },
      el('video', { src: `/files/${e.result.file}`, poster: `/files/${e.result.thumb}`, controls: '', playsinline: '', preload: 'metadata' }),
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, e.name, win ? el('span', { class: 'badge' }, 'הכי טוב') : null),
        el('div', { class: 'specs' },
          el('span', {}, 'אורך ', el('b', {}, secs(p.duration))), el('span', {}, 'רזולוציה ', el('b', {}, `${p.width}×${p.height}`)),
          el('span', {}, 'ציון טכני ', el('b', {}, `${e.result.score}/100`)), el('span', {}, 'עלות ', el('b', {}, e.result.money ? money(e.result.money) : 'חינם')),
          el('span', {}, 'זמן הפקה ', el('b', {}, secs(e.result.seconds))), el('span', {}, 'סאונד ', el('b', {}, p.hasAudio ? 'כן' : 'לא'))),
        el('a', { class: 'primary', href: `/files/${e.result.file}?download=1`, download: '', style: 'width:100%' }, 'הורדת MP4'),
        e.id === 'local' ? el('div', { class: 'note' }, 'אנימציה מתוכנתת, לא וידאו שנוצר ב-AI.') : null));
  }));
  const canResume = ['interrupted', 'failed'].includes(j.state) || j.engines.some(e => ['failed', 'interrupted'].includes(e.state)) && j.state !== 'running';
  const actions = el('div', { class: 'job-actions' },
    canResume ? el('button', { class: 'primary small', onclick: () => resume(j.id) }, j.state === 'interrupted' ? 'המשך מאיפה שנעצר' : 'נסה שוב את מה שנכשל') : null,
    j.state !== 'running' ? el('button', { class: 'ghost danger', onclick: () => removeJob(j.id) }, 'מחק') : null,
    el('button', { class: 'ghost', onclick: () => { state.job = null; renderJob(); } }, 'סגור'));
  box.replaceChildren(el('div', { class: 'job-panel' },
    el('div', { class: 'job-head' }, el('div', { class: 'idea-q' }, j.idea), el('div', { class: 'when' }, `${j.aspect} · ${j.plan?.brief?.styleHe || ''}`)),
    rows, grid, actions));
}

async function resume(id) {
  const r = await api(`/api/jobs/${id}/resume`, { method: 'POST' });
  if (r.status !== 200) return toast(r.body.error || 'שגיאה');
  toast('ממשיך'); pollJob(id);
}
async function removeJob(id) {
  if (!confirm('למחוק את היצירה והקבצים שלה?')) return;
  const r = await api(`/api/jobs/${id}`, { method: 'DELETE' });
  if (r.status !== 200) return toast(r.body.error || 'שגיאה');
  state.job = null; renderJob(); loadJobs();
}

async function loadJobs() {
  const r = await api('/api/jobs');
  const list = r.body || [];
  $('#jobs-empty').hidden = list.length > 0;
  $('#jobs').replaceChildren(...list.map(j => {
    const best = j.engines.find(e => e.id === j.winner) || j.engines.find(e => e.state === 'done');
    const label = { running: 'בעבודה', done: 'מוכן', failed: 'נכשל', interrupted: 'נקטע' }[j.state] || j.state;
    return el('button', { class: 'card', onclick: () => { state.job = j; renderJob(); if (j.state === 'running') pollJob(j.id); scrollTo({ top: 0, behavior: 'smooth' }); } },
      el('div', { class: 'thumb' }, best?.result?.thumb ? el('img', { src: `/files/${best.result.thumb}`, alt: '', loading: 'lazy' }) : label),
      el('div', { class: 'meta' }, el('div', { class: 't' }, j.idea),
        el('div', { class: 's' }, el('span', {}, new Date(j.createdAt).toLocaleDateString('he-IL')), el('span', { class: 'tag' + (j.state === 'done' ? ' free' : j.state === 'running' ? ' vio' : ' paid') }, label))));
  }));
}

// ---------- Characters ----------
async function loadChars() {
  state.chars = (await api('/api/characters')).body || [];
  $('#chars-empty').hidden = state.chars.length > 0;
  const kinds = state.options?.kinds || {}; const voices = state.options?.voices || {};
  $('#chars').replaceChildren(...state.chars.map(c => el('li', { class: 'clickable', tabindex: 0, onclick: () => openChar(c), onkeydown: onKey(() => openChar(c)) },
    avatar(c, 52),
    el('div', { class: 'grow' }, el('div', { class: 'title' }, c.name), el('div', { class: 'sub' }, [kinds[c.kind], voices[c.voice] && `קול: ${voices[c.voice]}`, c.personality].filter(Boolean).join(' · '))),
    el('span', { class: 'tag' + (c.image ? ' free' : '') }, c.image ? 'יש רפרנס' : 'בלי תמונה'))));
  renderCast();
}

let editing = null; let pendingImage = null;
function openChar(c = null) {
  editing = c; pendingImage = null;
  $('#cd-title').textContent = c ? c.name : 'דמות חדשה';
  $('#cf-name').value = c?.name || ''; $('#cf-kind').value = c?.kind || 'cartoon3d'; $('#cf-look').value = c?.look || '';
  $('#cf-colors').value = c?.colors || ''; $('#cf-face').value = c?.face || ''; $('#cf-personality').value = c?.personality || ''; $('#cf-voice').value = c?.voice || 'bright-m';
  $('#cf-preview').hidden = !c?.image; if (c?.image) $('#cf-preview').src = `/chars/${c.image}`;
  $('#cf-photo-label').hidden = !!c?.image; $('#cf-delete').hidden = !c; $('#cf-error').textContent = ''; $('#cf-image').value = '';
  $('#char-dialog').showModal();
}

function readImage(file) {
  return new Promise((res, rej) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return rej(new Error('PNG, JPG או WEBP בלבד'));
    if (file.size > 8 * 1024 * 1024) return rej(new Error('התמונה גדולה מ-8MB'));
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('לא הצלחתי לקרוא את התמונה')); fr.readAsDataURL(file);
  });
}

async function saveChar(ev) {
  ev.preventDefault();
  const body = { name: $('#cf-name').value, kind: $('#cf-kind').value, look: $('#cf-look').value, colors: $('#cf-colors').value, face: $('#cf-face').value, personality: $('#cf-personality').value, voice: $('#cf-voice').value };
  $('#cf-save').disabled = true;
  const r = editing ? await api(`/api/characters/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) }) : await api('/api/characters', { method: 'POST', body: JSON.stringify(body) });
  if (r.status >= 300) { $('#cf-save').disabled = false; return ($('#cf-error').textContent = r.body.error || 'שגיאה'); }
  if (pendingImage) {
    const im = await api(`/api/characters/${r.body.id}/image`, { method: 'POST', body: JSON.stringify({ image: pendingImage }) });
    if (im.status !== 200) { $('#cf-save').disabled = false; editing = r.body; return ($('#cf-error').textContent = im.body.error || 'שמירת התמונה נכשלה'); }
  }
  $('#cf-save').disabled = false;
  $('#char-dialog').close(); toast(editing ? 'הדמות עודכנה' : 'הדמות נשמרה');
  await loadChars(); requestQuote();
}

// ---------- Engines ----------
async function loadEngines(fresh = false) {
  const r = await api('/api/engines' + (fresh ? '?fresh=1' : ''));
  state.engines = r.body || [];
  const live = state.engines.filter(e => e.status?.connected && e.id !== 'local').length;
  $('#conn').replaceChildren(el('span', { class: 'pill' }, el('span', { class: 'dot' + (live ? ' on' : '') }), live ? `${live} מנועי AI מחוברים` : 'אין מנוע AI מחובר'));
  renderEngines();
}

async function renderEngineScreen() {
  const cat = (await api('/api/catalog')).body;
  const LABELS = [['t2v', 'טקסט לווידאו'], ['i2v', 'תמונה לווידאו'], ['image', 'יצירת תמונות'], ['lipsync', 'סנכרון שפתיים'], ['voice', 'קול וקריינות'], ['consistency', 'עקביות דמויות'], ['resolution', 'רזולוציה'], ['length', 'אורך'], ['free', 'חינם'], ['price', 'מחיר']];
  $('#engine-cards').replaceChildren(...cat.catalog.map(c => {
    const live = state.engines.find(e => e.id === c.id);
    const st = live?.status;
    const tag = c.chatOnly ? el('span', { class: 'tag vio' }, 'בשיחה עם Claude') : st?.connected ? el('span', { class: 'tag free' }, 'מחובר') : el('span', { class: 'tag' }, st?.note || 'לא מחובר');
    return el('article', { class: 'eng-card' },
      el('header', {}, el('span', { class: 'dot' + (st?.connected ? ' on' : '') }), el('div', { class: 'grow' }, el('h3', {}, c.name), el('div', { class: 'access' }, c.access)), tag),
      el('dl', { class: 'caps' }, ...LABELS.flatMap(([k, he]) => [el('dt', {}, he), el('dd', {}, c[k])])),
      live?.site && !st?.connected ? el('a', { class: 'ghost', href: live.site, target: '_blank', rel: 'noopener', style: 'margin-top:10px' }, 'יצירת מפתח באתר השירות') : null);
  }));
  $('#recommend').replaceChildren(...cat.recommend.map(r => {
    const first = r.engines.find(id => state.engines.find(e => e.id === id)?.status?.connected) || null;
    const names = r.engines.map(id => cat.catalog.find(c => c.id === id)?.name).join(' → ');
    return el('li', {}, el('div', { class: 'grow' }, el('div', { class: 'title' }, r.task), el('div', { class: 'sub' }, names)),
      el('span', { class: 'tag' + (first ? ' free' : '') }, first ? `עכשיו: ${cat.catalog.find(c => c.id === first).name}` : 'אין מחובר'));
  }));
}

// ---------- Costs ----------
async function loadCosts() {
  const costOf = { vaideo: '1 קרדיט עד דקה (€0.29)', aituber: '≈35 קרדיטים ל-30 שנ׳', seedance: '$0.07–0.23 לשנייה', korpi: 'לפי מודל, מוצג לפני הפקה', local: 'חינם' };
  $('#ledger tbody').replaceChildren(...state.engines.map(e => {
    const s = e.status || {}; const l = e.ledger || {};
    const bal = e.id === 'local' ? '∞' : s.connected && s.verified ? String(s.credits) : s.connected ? 'השירות לא החזיר יתרה' : 'לא אומת';
    const quota = e.freeGrant == null ? 'ללא הגבלה' : e.freeGrant ? `${e.freeGrant} ${e.unit} (לפי האתר)` : 'אין';
    return el('tr', {},
      el('td', {}, el('div', {}, e.name), el('div', { class: 'sub' }, e.official)),
      el('td', {}, s.connected ? 'מחובר' : 'לא מחובר', s.connected ? null : el('div', { class: 'sub' }, s.note || '')),
      el('td', {}, bal, s.plan && s.connected ? el('div', { class: 'sub' }, s.plan) : null),
      el('td', {}, quota),
      el('td', {}, costOf[e.id]),
      el('td', {}, `${l.spentCredits || 0} ${e.unit}`, l.spentMoney ? el('div', { class: 'sub' }, `שולם ${money(l.spentMoney)}`) : null));
  }));
  const h = (await api('/api/history')).body || [];
  $('#history').replaceChildren(...h.slice(-30).reverse().map(x => el('li', {},
    el('div', { class: 'grow' }, el('div', { class: 'title' }, state.engines.find(e => e.id === x.engine)?.name || x.engine),
      el('div', { class: 'sub' }, `${new Date(x.at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })} · ${x.ok ? `${x.resolution} · ${secs(x.durationSec)} · איכות ${x.quality}` : (x.error || 'נכשל')}`)),
    el('span', { class: 'tag' + (x.ok ? (x.money ? ' paid' : ' free') : ' bad') }, x.ok ? (x.money ? money(x.money) : 'חינם') : 'נכשל'))));
}

// ---------- Nav ----------
function show(v) {
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === `view-${v}`));
  document.querySelectorAll('.tabs button').forEach(b => b.dataset.view === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (v === 'gallery') { renderJob(); loadJobs(); }
  if (v === 'characters') loadChars();
  if (v === 'engines') renderEngineScreen();
  if (v === 'costs') loadCosts();
  scrollTo({ top: 0 });
}

async function init() {
  state.options = (await api('/api/options')).body;
  const o = state.options || { styles: {}, kinds: {}, voices: {} };
  $('#style').replaceChildren(el('button', { role: 'radio', 'data-v': 'auto', 'aria-checked': 'true' }, 'אוטומטי'), ...Object.entries(o.styles).map(([k, v]) => el('button', { role: 'radio', 'data-v': k, 'aria-checked': 'false' }, v)));
  $('#cf-kind').replaceChildren(...Object.entries(o.kinds).map(([k, v]) => el('option', { value: k }, v)));
  $('#cf-voice').replaceChildren(...Object.entries(o.voices).map(([k, v]) => el('option', { value: k }, v)));
  radio('#length', 'len', requestQuote); radio('#aspect', 'aspect', requestQuote); radio('#style', 'style', requestQuote);
  $('#idea').addEventListener('input', e => { $('#count').textContent = e.target.value.length; requestQuote(); });
  const lip = () => { state.lipsync = !state.lipsync; $('#lipsync').setAttribute('aria-checked', String(state.lipsync)); requestQuote(); };
  $('#lipsync').addEventListener('click', lip); $('#lipsync').addEventListener('keydown', onKey(lip));
  $('#go').addEventListener('click', () => create());
  $('#refresh').addEventListener('click', async () => { toast('בודק חיבורים מול השירותים…'); await loadEngines(true); renderEngineScreen(); requestQuote(); toast('החיבורים נבדקו'); });
  $('#new-char').addEventListener('click', () => openChar());
  $('#char-form').addEventListener('submit', saveChar);
  $('#cf-cancel').addEventListener('click', () => $('#char-dialog').close());
  $('#cf-delete').addEventListener('click', async () => {
    if (!editing || !confirm(`למחוק את ${editing.name}?`)) return;
    const r = await api(`/api/characters/${editing.id}`, { method: 'DELETE' });
    if (r.status !== 200) return ($('#cf-error').textContent = r.body.error || 'שגיאה');
    state.cast.delete(editing.id); $('#char-dialog').close(); toast('נמחקה'); loadChars();
  });
  $('#cf-image').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { pendingImage = await readImage(f); $('#cf-preview').src = pendingImage; $('#cf-preview').hidden = false; $('#cf-photo-label').hidden = true; $('#cf-error').textContent = ''; }
    catch (err) { $('#cf-error').textContent = err.message; }
  });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
  await Promise.all([loadEngines(), loadChars()]);
  renderCost();
}
init();
