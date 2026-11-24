// Minimal Model Context Protocol client over Streamable HTTP (JSON or SSE responses).
// Used for Korpi, whose official integration is its MCP server.
export class McpClient {
  constructor(url, token, { fetchImpl = fetch } = {}) {
    this.url = url; this.token = token; this.fetch = fetchImpl; this.session = null; this.id = 0;
  }

  async rpc(method, params, { notify = false } = {}) {
    const body = { jsonrpc: '2.0', method, ...(params ? { params } : {}) };
    if (!notify) body.id = ++this.id;
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    const res = await this.fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body) });
    const sid = res.headers.get('mcp-session-id'); if (sid) this.session = sid;
    if (res.status === 401 || res.status === 403) { const e = new Error('auth'); e.code = 'auth'; e.status = res.status; throw e; }
    if (notify) return null;
    const text = await res.text();
    if (!res.ok) { const e = new Error(`MCP HTTP ${res.status}: ${text.slice(0, 200)}`); e.status = res.status; throw e; }
    const msg = parseMcpBody(text, body.id, res.headers.get('content-type') || '');
    if (msg.error) { const e = new Error(msg.error.message || 'MCP error'); e.code = msg.error.code; throw e; }
    return msg.result;
  }

  async connect() {
    const r = await this.rpc('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'titan-video-studio', version: '1.0.0' },
    });
    await this.rpc('notifications/initialized', null, { notify: true }).catch(() => {});
    return r;
  }

  async listTools() { return (await this.rpc('tools/list', {})).tools || []; }

  /** Calls a tool and returns parsed JSON from its first text block when possible. */
  async call(name, args = {}) {
    const r = await this.rpc('tools/call', { name, arguments: args });
    if (r.isError) { const t = (r.content || []).map(c => c.text).join(' '); const e = new Error(t || `tool ${name} failed`); e.tool = name; throw e; }
    if (r.structuredContent) return r.structuredContent;
    const t = (r.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    try { return JSON.parse(t); } catch { return { text: t }; }
  }
}

export function parseMcpBody(text, id, contentType = '') {
  if (contentType.includes('text/event-stream') || text.startsWith('event:') || text.startsWith('data:')) {
    const msgs = text.split(/\n\n+/).map(block => block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join(''))
      .filter(Boolean).map(d => { try { return JSON.parse(d); } catch { return null; } }).filter(Boolean);
    return msgs.find(m => m.id === id) || msgs[msgs.length - 1] || {};
  }
  return JSON.parse(text);
}
