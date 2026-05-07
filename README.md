# Click Family

Mini-app for Click SuperApp: family tree with calendar of events and share.
**Phase 1: local-only** (no Click Integration API yet, no login UI yet — auto-login as seed user in dev).

## Quickstart

```bash
# 1. Install
pnpm install

# 2. Start Postgres (host port 15433)
pnpm db:up

# 3. Migrate + seed (creates Рустамовых-Каримовых family with 30 persons)
pnpm db:migrate
pnpm db:seed

# 4. Run both servers
pnpm dev
```

Open `http://localhost:5173` (or 5174 if 5173 is busy).

The frontend auto-logs in as seed user `+998900000001` (Улугбек) via `POST /api/auth/dev-login`.
This endpoint is disabled in production.

## Architecture
See `docs/superpowers/specs/2026-05-07-clickfamily-mvp-phase1-design.md`.

## Phase 2 (TODO)
- Real Click Integration via `api.click.uz/integration` (JSON-RPC 2.0)
- Real push, real payments, госданные import
- Replace dev-bypass with Click SSO (token via WebView).
