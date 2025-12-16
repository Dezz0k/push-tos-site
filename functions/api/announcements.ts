function withCors(obj: any) {
  return {
    ...obj,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...(obj?.headers || {}),
    },
  };
}

export async function onRequestOptions() {
  return new Response(null, withCors({ status: 204 }));
}

export async function onRequestGet({ env }: any) {
  const { results } = await env.DB
    .prepare("SELECT id, title, body, author, created_at FROM announcements ORDER BY id DESC LIMIT 50")
    .all();

  return Response.json({ announcements: results }, withCors({}));
}

export async function onRequestDelete({ request, env }: any) {
  const url = new URL(request.url);
  const idRaw = String(url.searchParams.get("id") || "").trim();
  if (!idRaw) return Response.json({ ok: false, error: "Missing id" }, withCors({ status: 400 }));

  const id = Number(idRaw);
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: "Invalid id" }, withCors({ status: 400 }));

  const res = await env.DB
    .prepare("DELETE FROM announcements WHERE id = ?")
    .bind(id)
    .run();

  return Response.json({ ok: true, deleted: id, meta: res?.meta || null }, withCors({}));
}
