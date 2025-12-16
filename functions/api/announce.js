const ALLOWED_ORIGINS = new Set([
  // Your Cloudflare Pages domain
  'https://push-tos-site.pages.dev',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';

  let reqOrigin = '';
  try {
    reqOrigin = new URL(request.url).origin;
  } catch {
    reqOrigin = '';
  }

  // Allow same-origin (including custom domains) and allowlisted origins.
  const allowOrigin = (origin && (origin === reqOrigin || ALLOWED_ORIGINS.has(origin)))
    ? origin
    : (reqOrigin || 'https://push-tos-site.pages.dev');

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(status, obj, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const headers = corsHeaders(request);

  const webhookUrl = String(env.DISCORD_WEBHOOK_URL || '').trim();

  let input;
  try {
    input = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' }, headers);
  }

  const title = String(input?.title || '').trim().slice(0, 256);
  const body = String(input?.body || '').trim().slice(0, 3900);
  const author = String(input?.author || '').trim().slice(0, 64);

  const ts = input?.ts ? new Date(input.ts) : new Date();
  const createdAtMs = isNaN(ts.getTime()) ? Date.now() : ts.getTime();
  const timestamp = new Date(createdAtMs).toISOString();

  if (title.length < 3) return json(400, { ok: false, error: 'title too short' }, headers);
  if (body.length < 10) return json(400, { ok: false, error: 'body too short' }, headers);

  // Save to D1 (shared announcements)
  if (!env.DB) {
    return json(500, { ok: false, error: 'DB binding is not set (env.DB)' }, headers);
  }

  let insertedId = null;
  try {
    const ins = await env.DB
      .prepare("INSERT INTO announcements (title, body, author, created_at) VALUES (?, ?, ?, ?)")
      .bind(title, body, author, createdAtMs)
      .run();
    insertedId = ins?.meta?.last_row_id ?? null;
  } catch (e) {
    return json(500, { ok: false, error: 'DB insert failed', details: String(e) }, headers);
  }

  // Discord embed (purple)
  const payload = {
    username: 'P.U.S.H',
    embeds: [
      {
        title,
        description: body,
        color: 0xA878FF,
        footer: { text: `P.U.S.H • ${author || 'Announcement'}` },
        timestamp,
      },
    ],
  };

  const discord = { ok: false, skipped: false, status: null, body: '' };
  if (!webhookUrl) {
    discord.skipped = true;
    discord.body = 'DISCORD_WEBHOOK_URL is not set';
  } else {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      discord.status = res.status;
      discord.body = await res.text().catch(() => '');
    } else {
      discord.ok = true;
    }
  }

  return json(200, { ok: true, id: insertedId, created_at: createdAtMs, discord }, headers);
}
