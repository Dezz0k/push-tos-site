# push-tos-site

## Cloudflare Pages bindings
This project uses Cloudflare Pages Functions in `functions/`.

### Required bindings
- D1: `DB`
- KV: `PRESENCE`
- (Optional) Env var: `DISCORD_WEBHOOK_URL` (Discord webhook for announcements)

### D1 schema
Run `schema.sql` in your D1 database (example: `push_db`).

## Endpoints
- `GET /api/announcements` → list shared announcements (D1)
- `DELETE /api/announcements?id=123` → delete announcement (D1)
- `POST /api/announce` → insert announcement into D1 + (optional) post to Discord webhook
- `POST /api/presence-ping` → set online presence in KV (TTL)
- `GET /api/presence?ids=a,b,c` → fetch online status for users
