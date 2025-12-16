const ALLOWED_ORIGINS = new Set([
  // Your Cloudflare Pages domain
  'https://push-tos-site.pages.dev',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://push-tos-site.pages.dev';

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
  if (!webhookUrl) {
    return json(500, { ok: false, error: 'DISCORD_WEBHOOK_URL is not set' }, headers);
  }

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
  const timestamp = isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();

  if (title.length < 3) return json(400, { ok: false, error: 'title too short' }, headers);
  if (body.length < 10) return json(400, { ok: false, error: 'body too short' }, headers);

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

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return json(502, { ok: false, status: res.status, body: text }, headers);
  }

  return json(200, { ok: true }, headers);
}
