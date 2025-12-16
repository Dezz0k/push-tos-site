export async function onRequestPost({ request, env }: any) {
  const body = await request.json().catch(() => ({}));
  const userId = body.userId;
  if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });

  // KV put + expirationTtl (seconds)
  await env.PRESENCE.put(`presence:${userId}`, "1", { expirationTtl: 75 });

  return Response.json({ ok: true }, {
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
