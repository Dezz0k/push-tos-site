function b64urlToB64(s) {
  return s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
}

function decodeB64urlJson(s) {
  const json = atob(b64urlToB64(s));
  return JSON.parse(json);
}

function getCookie(req, name) {
  const cookie = req.headers.get("Cookie") || "";
  const parts = cookie.split(/;\s*/);
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (k === name) return v;
  }
  return "";
}

function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifyJWT(jwt, secret) {
  const parts = String(jwt || "").split(".");
  if (parts.length !== 3) return null;

  const [h, p, sig] = parts;
  const data = `${h}.${p}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // Compute expected signature
  const sigBytes = Uint8Array.from(atob(b64urlToB64(sig)), c => c.charCodeAt(0));
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(data));
  if (!ok) return null;

  const payload = decodeB64urlJson(p);
  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && now > payload.exp) return null;

  return payload;
}

export async function onRequestGet(ctx) {
  const jwt = getCookie(ctx.request, "session");
  const secret = String(ctx.env.JWT_SECRET || "").trim();
  if (!secret) return Response.json({ ok: false, error: "Missing env JWT_SECRET" }, { status: 500 });

  if (!jwt) return Response.json({ ok: false, error: "No session" }, { status: 401 });

  const payload = await verifyJWT(jwt, secret);
  if (!payload) return Response.json({ ok: false, error: "Invalid session" }, { status: 401 });

  return Response.json({ ok: true, session: payload });
}
