function b64urlEncodeAscii(str) {
  // Safe for ASCII JSON payloads (Discord IDs, numbers, etc.)
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlEncodeBytes(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return b64urlEncodeAscii(bin);
}

async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const header = b64urlEncodeAscii(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlEncodeAscii(JSON.stringify(payload));
  const data = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sig = b64urlEncodeBytes(new Uint8Array(sigBuf));
  return `${data}.${sig}`;
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

export async function onRequestGet(ctx) {
  const reqUrl = new URL(ctx.request.url);
  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state") || "";

  // Simple route test (matches your setup steps)
  if (!code) return new Response("callback route working");

  const stateCookie = getCookie(ctx.request, "oauth_state");
  if (!stateCookie || !state || stateCookie !== state) {
    return new Response("Invalid state", { status: 400 });
  }

  const clientId = String(ctx.env.DISCORD_CLIENT_ID || "").trim();
  const clientSecret = String(ctx.env.DISCORD_CLIENT_SECRET || "").trim();
  const redirectUri = String(ctx.env.DISCORD_REDIRECT_URI || "").trim();
  const jwtSecret = String(ctx.env.JWT_SECRET || "").trim();

  if (!clientId) return new Response("Missing env DISCORD_CLIENT_ID", { status: 500 });
  if (!clientSecret) return new Response("Missing env DISCORD_CLIENT_SECRET", { status: 500 });
  if (!redirectUri) return new Response("Missing env DISCORD_REDIRECT_URI", { status: 500 });
  if (!jwtSecret) return new Response("Missing env JWT_SECRET", { status: 500 });

  // Exchange code for access token
  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("redirect_uri", redirectUri);

  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text().catch(() => "");
    return new Response(`Token exchange failed\n${txt}`, { status: 401 });
  }

  const token = await tokenRes.json();

  // Fetch user identity
  const meRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (!meRes.ok) {
    const txt = await meRes.text().catch(() => "");
    return new Response(`Failed to fetch user\n${txt}`, { status: 401 });
  }

  const me = await meRes.json();

  // Create session JWT cookie (7 days)
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const jwt = await signJWT({ sub: String(me.id), exp }, jwtSecret);

  const headers = new Headers();

  // Clear state cookie
  headers.append(
    "Set-Cookie",
    `oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );

  headers.append(
    "Set-Cookie",
    `session=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
  );

  headers.append("Location", "/admin.html");

  return new Response(null, { status: 302, headers });
}
