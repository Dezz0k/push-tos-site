export async function onRequestGet({ request, env }: any) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").map(s => s.trim()).filter(Boolean);

  const online: Record<string, boolean> = {};
  await Promise.all(ids.map(async (id) => {
    online[id] = (await env.PRESENCE.get(`presence:${id}`)) === "1";
  }));

  return Response.json({ online }, {
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
