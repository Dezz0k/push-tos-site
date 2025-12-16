function randomState(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet(ctx) {
  const origin = new URL(ctx.request.url).origin;

  const clientId = String(ctx.env.DISCORD_CLIENT_ID || "").trim();
  const redirectUri = String(ctx.env.DISCORD_REDIRECT_URI || "").trim();

  if (!clientId) return new Response("Missing env DISCORD_CLIENT_ID", { status: 500 });
  if (!redirectUri) return new Response("Missing env DISCORD_REDIRECT_URI", { status: 500 });

  const state = randomState();

  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);

  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 10}`
  );
  headers.set("Location", url.toString());

  // 302 to Discord OAuth2 authorize
  return new Response(null, { status: 302, headers });
}
