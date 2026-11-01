// Server-side coach endpoint (Vercel-style serverless function: export default handler(req, res)).
// The API key lives only in the server environment. The browser never sees it.
//
// Env vars:
//   ANTHROPIC_API_KEY      required to enable the AI coach. Without it, the endpoint answers 503 and the app uses the basic coach.
//   ASCEND_ACCESS_TOKEN    recommended. When set, requests must send header "x-ascend-token" with this value.
//   ASCEND_COACH_MODEL     optional. Defaults to claude-sonnet-5-5.

const SYSTEM = `אתה מאמן אישי לשיפור עצמי, כותב בעברית מקצועית, ברורה ובגובה העיניים.
שיטת העבודה שלך:
1. להבין את המצב. לשאול שאלה אחת מדויקת אם חסר מידע חשוב.
2. להפריד בין עובדות להנחות.
3. להסביר עיקרון רלוונטי, ולציין כמה הוא מבוסס (מבוסס היטב / חלקי / השערה).
4. להציע עד שני צעדים קטנים.
5. לבקש מהמשתמש לבחור צעד אחד ולקבוע מתי יבדוק אותו.
כללים:
- בלי הבטחות לתוצאות, בלי מספרים שאינך בטוח בהם, ובלי ציטוטים או מחקרים שאינך יכול לאמת. אם אינך בטוח, אמור זאת.
- בלי דיבור מתנשא וללא מחמאות מופרזות. בלי ציטוטי השראה כתחליף לעבודה.
- לא לאבחן מצבים רפואיים או נפשיים. במצבים כאלה, להמליץ לפנות לאיש מקצוע.
- בנושאי טסטוסטרון, לא לתת טיפול או מינונים. להפנות לרופא.
- בנושאי כסף, לא להבטיח תשואה ולא לתת המלצת השקעה אישית.
- בזוגיות: לא לנחש מה האדם השני חושב. להבחין בין תצפית להנחה. לא לעודד תמרון, קנאה כמשחק, או שליטה.
- בתשובה שלך, אל תזכיר את שם המודל.`;

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 20000) reject(new Error("too-large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method-not-allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return send(res, 503, { error: "not-configured" });

  const requiredToken = process.env.ASCEND_ACCESS_TOKEN;
  if (requiredToken && req.headers["x-ascend-token"] !== requiredToken) return send(res, 401, { error: "unauthorized" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: "bad-request" });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) return send(res, 400, { error: "empty-message" });

  const history = Array.isArray(body.history)
    ? body.history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    : [];
  const context = body.context && typeof body.context === "object" ? JSON.stringify(body.context).slice(0, 800) : "";

  const messages = [...history, { role: "user", content: context ? `הקשר מהפרופיל (JSON): ${context}\n\n${message}` : message }];

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ASCEND_COACH_MODEL || "claude-sonnet-5-5",
        max_tokens: 900,
        system: SYSTEM,
        messages,
      }),
    });
    if (!upstream.ok) return send(res, 502, { error: "upstream", status: upstream.status });
    const data = await upstream.json();
    const reply = Array.isArray(data.content) ? data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() : "";
    if (!reply) return send(res, 502, { error: "empty-reply" });
    return send(res, 200, { reply });
  } catch {
    return send(res, 502, { error: "network" });
  }
}
