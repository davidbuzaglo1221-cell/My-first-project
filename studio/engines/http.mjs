// Shared HTTP helper for engine adapters: JSON in/out, clear errors, auth failures flagged.
export async function api(base, key, method, p, body, { headers = {}, fetchImpl = fetch } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (key) h.Authorization = `Bearer ${key}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const res = await fetchImpl(base + p, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual' });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 300) }; }
  if (res.status === 401 || res.status === 403) { const e = new Error('המפתח חסר או לא תקין'); e.code = 'auth'; e.status = res.status; e.body = json; throw e; }
  if (res.status === 402) { const e = new Error('אין מספיק קרדיטים'); e.code = 'credits'; e.status = 402; e.body = json; throw e; }
  if (res.status >= 300 && res.status < 400) return { redirect: res.headers.get('location'), status: res.status };
  if (!res.ok) { const e = new Error(`${res.status}: ${(json.error?.message || json.message || json.raw || '').toString().slice(0, 200)}`); e.status = res.status; e.body = json; throw e; }
  return json;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Poll fn() until done(result) or timeout. */
export async function poll(fn, done, { everyMs = 8000, timeoutMs = 20 * 60000, onTick = () => {}, signal } = {}) {
  if (process.env.STUDIO_POLL_MS) everyMs = +process.env.STUDIO_POLL_MS;
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (signal?.aborted) throw new Error('בוטל');
    const r = await fn();
    onTick(r);
    if (done(r)) return r;
    if (Date.now() > end) throw new Error('תם הזמן לחכות לתוצאה');
    await sleep(everyMs);
  }
}
