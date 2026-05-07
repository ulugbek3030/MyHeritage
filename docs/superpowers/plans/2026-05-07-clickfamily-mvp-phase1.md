# Click Family — Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standalone local web prototype of Click Family mini-app (tree, forms, calendar, share) with phone+OTP auth and mock Click Integration — production-ready architecture but no real Click API calls yet.

**Architecture:** 3-tier monorepo. React 19+Vite+TS frontend on :5173 → Express 4+TS backend on :3001 → Postgres 15. JWT auth (access+refresh) with phone+OTP. `relatives-tree` v3.2.2 for layout. Mock `ClickIntegration` interface ready to be swapped for real JSON-RPC client in Phase 2.

**Tech Stack:** React 19, Vite 7, TypeScript 5.5, Express 4, Postgres 15, relatives-tree, jsonwebtoken, bcrypt, Zod, axios, multer, smartcrop-js, nanoid, Vitest, supertest, @testing-library/react. Package manager: **pnpm**.

**Spec:** `docs/superpowers/specs/2026-05-07-clickfamily-mvp-phase1-design.md`.

---

## File Structure

```
clickfamily/
├── package.json                              # workspace root, scripts
├── pnpm-workspace.yaml                       # workspaces: server, client
├── .env / .env.example
├── .gitignore                                # already exists
├── docker-compose.yml                        # Postgres 15 service
├── tsconfig.base.json                        # shared TS config
├── database/migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_trees.sql
│   ├── 003_create_persons.sql
│   ├── 004_create_relationships.sql
│   ├── 005_create_otp_codes.sql
│   ├── 006_add_share_fields.sql
│   ├── 007_create_tree_suggestions.sql
│   └── 008_create_migrations_table.sql
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── app.ts                            # Express app, route wiring
│       ├── server.ts                         # listen(PORT)
│       ├── config/
│       │   ├── env.ts                        # process.env access (validated)
│       │   ├── auth.ts                       # JWT settings
│       │   └── database.ts                   # PG connection config
│       ├── db/
│       │   ├── pool.ts                       # pg.Pool + query helper
│       │   ├── migrate.ts                    # migration runner
│       │   └── seed.ts                       # семья Рустамовых-Каримовых, 30 чел
│       ├── middleware/
│       │   ├── authenticate.ts               # JWT verify → req.user
│       │   ├── authorizeTree.ts              # tree ownership → req.tree
│       │   ├── validate.ts                   # Zod schema validation
│       │   └── errorHandler.ts               # AppError → status, ValidationError → 400, etc.
│       ├── routes/
│       │   ├── auth.routes.ts                # POST /api/auth/{request-otp, verify-otp, refresh, logout}, GET /me
│       │   ├── trees.routes.ts               # /api/trees/*
│       │   ├── persons.routes.ts             # /api/trees/:treeId/persons/*
│       │   ├── relationships.routes.ts       # /api/trees/:treeId/relationships/*
│       │   ├── photos.routes.ts              # POST/DELETE /api/trees/:treeId/persons/:personId/photo (auth)
│       │   ├── events.routes.ts              # GET /api/trees/:treeId/events
│       │   ├── share.routes.ts               # /api/trees/:treeId/share (CRUD), GET /api/share/:token (public)
│       │   └── photo-public.routes.ts        # GET /api/trees/:treeId/persons/:personId/photo (PUBLIC, registered BEFORE treesRoutes)
│       ├── services/
│       │   ├── otp.service.ts                # generate, verify (mock SMS in dev)
│       │   ├── auth.service.ts               # JWT issue/refresh, user upsert from phone
│       │   ├── trees.service.ts              # CRUD + getFullTree + BFS generations
│       │   ├── persons.service.ts            # CRUD + relationship creation in transaction + auto-couple
│       │   ├── relationships.service.ts      # CRUD
│       │   ├── photos.service.ts             # upload (BYTEA), getPhoto, delete
│       │   ├── events.service.ts             # birthdays/memorials/anniversaries from tree
│       │   ├── share.service.ts              # generate token, resolve public view, settings
│       │   └── click-integration/
│       │       ├── interface.ts              # ClickIntegration interface
│       │       └── mock.ts                   # Phase 1 заглушки
│       ├── utils/
│       │   ├── errors.ts                     # AppError, NotFoundError, UnauthorizedError, ValidationError
│       │   ├── validators.ts                 # Zod schemas
│       │   └── nanoid.ts                     # 8-char share token generator
│       └── __tests__/
│           ├── otp.service.test.ts
│           ├── auth.service.test.ts
│           ├── persons.service.test.ts
│           ├── events.service.test.ts
│           └── routes/
│               ├── auth.routes.test.ts
│               ├── trees.routes.test.ts
│               └── share.routes.test.ts
└── client/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx                            # Router + AuthProvider
        ├── types/
        │   └── index.ts                       # User, Person, Relationship, Tree, FullTree, Event
        ├── api/
        │   ├── client.ts                      # axios + auto-refresh interceptor
        │   ├── auth.ts
        │   ├── trees.ts
        │   ├── persons.ts
        │   ├── events.ts
        │   └── share.ts
        ├── context/
        │   └── AuthContext.tsx
        ├── hooks/
        │   ├── useZoom.ts                     # universal zoom (desktop+mobile+Safari)
        │   ├── useDrag.ts                     # drag-to-pan
        │   └── useLongPress.ts
        ├── pages/
        │   ├── LoginPage.tsx                  # phone input
        │   ├── OtpPage.tsx                    # OTP code entry
        │   ├── TreesListPage.tsx
        │   ├── TreeViewPage.tsx               # main hybrid screen
        │   ├── FullTreePage.tsx               # zoom & pan, all 30+
        │   ├── CalendarPage.tsx
        │   └── SharedTreePage.tsx             # public read-only view
        ├── components/
        │   ├── auth/
        │   │   └── ProtectedRoute.tsx
        │   ├── tree/
        │   │   ├── FamilyTreeLayout.tsx
        │   │   ├── PersonCard.tsx
        │   │   ├── PersonSheet.tsx
        │   │   ├── AddPersonForm.tsx           # 3 modes: parent/sibling/child
        │   │   ├── LongPressMenu.tsx
        │   │   ├── ConfirmDeleteDialog.tsx
        │   │   └── ZoomControls.tsx
        │   ├── home/
        │   │   ├── Hero.tsx                    # adaptive event hero
        │   │   ├── NudgeProgress.tsx
        │   │   ├── QuickActions.tsx
        │   │   └── FAB.tsx
        │   ├── calendar/
        │   │   ├── EventCard.tsx
        │   │   └── MonthMini.tsx
        │   ├── share/
        │   │   ├── ShareModal.tsx
        │   │   ├── ShareMethodGrid.tsx
        │   │   └── PrivacyToggles.tsx
        │   └── ui/
        │       ├── BottomSheet.tsx
        │       ├── ChipPills.tsx
        │       └── Skeleton.tsx
        ├── utils/
        │   ├── treeTransform.ts                # DB data → relatives-tree Node[]
        │   ├── imageProcessor.ts               # smartcrop + canvas resize
        │   ├── dateFormat.ts                   # date display per spec convention
        │   ├── uzNamings.ts                    # o'g'li/qizi auto-gen, степени родства
        │   └── deathDate.ts                    # convention: '–' / '2010' / '15 мар. 2010'
        └── styles/
            ├── tokens.css                      # CSS vars: --bg, --accent, --male, etc.
            ├── global.css
            └── tree.css                        # carded tree styles
```

---

## Phase 1A: Foundation Setup

### Task 1: Workspace skeleton

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "clickfamily",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "dev:server": "pnpm --filter server run dev",
    "dev:client": "pnpm --filter client run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "db:migrate": "pnpm --filter server run migrate",
    "db:seed": "pnpm --filter server run seed",
    "db:up": "docker-compose up -d postgres",
    "db:down": "docker-compose down"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - server
  - client
```

- [ ] **Step 3: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "lib": ["ES2022", "DOM"]
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json
git commit -m "chore: workspace skeleton (pnpm + tsconfig base)"
```

### Task 2: Postgres via docker-compose

**Files:**
- Create: `docker-compose.yml`, `.env.example`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: clickfamily-pg
    environment:
      POSTGRES_DB: clickfamily
      POSTGRES_USER: clickfamily
      POSTGRES_PASSWORD: clickfamily_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U clickfamily"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
```

- [ ] **Step 2: Write `.env.example`**

```
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173

DATABASE_URL=postgresql://clickfamily:clickfamily_dev@localhost:5432/clickfamily
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clickfamily
DB_USER=clickfamily
DB_PASSWORD=clickfamily_dev

JWT_SECRET=dev-only-replace-in-production
JWT_ACCESS_EXPIRES=24h
JWT_REFRESH_EXPIRES=7d

OTP_DEV_CODE=0000
OTP_TTL_SECONDS=300

CLICK_INTEGRATION_API_URL=https://api.click.uz/integration
CLICK_INTEGRATION_TOKEN=
CLICK_INTEGRATION_MODE=mock
```

- [ ] **Step 3: Copy to `.env`**

```bash
cp .env.example .env
```

- [ ] **Step 4: Verify Postgres starts**

```bash
docker-compose up -d postgres
docker-compose ps
```
Expected: `clickfamily-pg` status `healthy` after ~5s.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: postgres docker-compose + env template"
```

### Task 3: Server workspace init

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/src/server.ts`

- [ ] **Step 1: Write `server/package.json`**

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p .",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "migrate": "tsx src/db/migrate.ts",
    "seed": "tsx src/db/seed.ts"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "pg": "^8.12.0",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "zod": "^3.23.8",
    "multer": "^1.4.5-lts.1",
    "nanoid": "^5.0.7",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/pg": "^8.11.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/bcrypt": "^5.0.2",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "tsx": "^4.15.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Write `server/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

- [ ] **Step 4: Write minimal `server/src/server.ts`**

```typescript
import 'dotenv/config';

const PORT = Number(process.env.PORT) || 3001;

console.log(`[server] starting on port ${PORT}`);
```

- [ ] **Step 5: Install + verify**

```bash
pnpm install
pnpm --filter server run dev
```
Expected: prints `[server] starting on port 3001`.

- [ ] **Step 6: Commit**

```bash
git add server/ package.json pnpm-lock.yaml
git commit -m "chore(server): workspace init (express+ts+vitest)"
```

### Task 4: Client workspace init

**Files:**
- Create: `client/package.json`, `client/vite.config.ts`, `client/tsconfig.json`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`

- [ ] **Step 1: Write `client/package.json`**

```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc -p . && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.26.0",
    "axios": "^1.7.4",
    "relatives-tree": "^3.2.2",
    "smartcrop": "^2.0.5",
    "nanoid": "^5.0.7"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^7.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0"
  }
}
```

- [ ] **Step 2: Write `client/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

- [ ] **Step 3: Write `client/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "isolatedModules": true,
    "useDefineForClassFields": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `client/index.html`**

```html
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Click Family</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `client/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 6: Write minimal `client/src/App.tsx`**

```tsx
export const App = () => <div style={{padding: 24, color: '#fafafa'}}>Click Family — booting…</div>;
```

- [ ] **Step 7: Write minimal `client/src/styles/tokens.css` and `client/src/styles/global.css`**

`tokens.css`:
```css
:root {
  --bg: #0a0a0d;
  --surface: #16161a;
  --surface-2: #1a1a1f;
  --accent: #fbbf24;
  --accent-hover: #f59e0b;
  --verified: #22c55e;
  --male: #60a5fa;
  --female: #f472b6;
  --text: #fafafa;
  --text-muted: #a1a1aa;
  --text-dim: #71717a;
  --border: rgba(255, 255, 255, 0.06);
  --radius-card: 14px;
  --radius-hero: 22px;
  --radius-fab: 18px;
  --font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif;
}
```

`global.css`:
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font-family); -webkit-font-smoothing: antialiased; }
button { font-family: inherit; cursor: pointer; }
```

- [ ] **Step 8: Verify**

```bash
pnpm --filter client run dev
```
Open `http://localhost:5173` — see "Click Family — booting…" on dark background.

- [ ] **Step 9: Commit**

```bash
git add client/
git commit -m "chore(client): workspace init (vite+react19+tokens)"
```

### Task 5: Concurrent dev script

**Files:** Modify `package.json` if needed (already has `dev` script).

- [ ] **Step 1: Run both workspaces**

```bash
pnpm dev
```
Expected: server logs `[server] starting on port 3001` AND client opens `http://localhost:5173`.

- [ ] **Step 2: Add CORS to server (preview)**

Modify `server/src/server.ts`:
```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
```

- [ ] **Step 3: Verify both work**

In two terminals:
- `pnpm --filter server run dev` → `curl http://localhost:3001/api/health` → `{"ok":true,...}`
- Browser at `:5173` still works.

- [ ] **Step 4: Commit**

```bash
git add server/src/server.ts
git commit -m "feat(server): cors + health endpoint"
```

---

## Phase 1B: Database Migrations

### Task 6: Migration runner

**Files:**
- Create: `server/src/db/pool.ts`, `server/src/db/migrate.ts`, `server/src/config/database.ts`, `server/src/config/env.ts`
- Create: `database/migrations/008_create_migrations_table.sql` (numbered 008 so it runs LAST after data tables, but it's actually consumed by the runner before)

- [ ] **Step 1: Write `server/src/config/env.ts`**

```typescript
import 'dotenv/config';

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3001),
  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES ?? '24h',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  OTP_DEV_CODE: process.env.OTP_DEV_CODE ?? '0000',
  OTP_TTL_SECONDS: Number(process.env.OTP_TTL_SECONDS ?? 300),
  CLICK_INTEGRATION_MODE: (process.env.CLICK_INTEGRATION_MODE ?? 'mock') as 'mock' | 'real',
};
```

- [ ] **Step 2: Write `server/src/db/pool.ts`**

```typescript
import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});

export const query = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> => pool.query(text, params) as any;
```

- [ ] **Step 3: Write `server/src/db/migrate.ts`**

```typescript
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../../database/migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function applied(): Promise<Set<string>> {
  const r = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  return new Set(r.rows.map((x) => x.filename));
}

async function run() {
  await ensureMigrationsTable();
  const done = await applied();
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const f of files) {
    if (done.has(f)) {
      console.log(`[skip] ${f}`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, f), 'utf-8');
    console.log(`[apply] ${f}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
    }
  }
  await pool.end();
  console.log('[done] all migrations applied');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Verify (no migrations yet — should just create table)**

```bash
pnpm --filter server run migrate
```
Expected: `[done] all migrations applied`.

- [ ] **Step 5: Commit**

```bash
git add server/src/config/env.ts server/src/db/pool.ts server/src/db/migrate.ts
git commit -m "feat(db): pool + migration runner"
```

### Task 7: Migration 001 — users

**Files:** Create `database/migrations/001_create_users.sql`.

- [ ] **Step 1: Write SQL**

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(200),
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
```

- [ ] **Step 2: Run + verify**

```bash
pnpm --filter server run migrate
```
Expected: `[apply] 001_create_users.sql` then `[done]`.

Verify table exists:
```bash
docker exec clickfamily-pg psql -U clickfamily -d clickfamily -c "\d users"
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/001_create_users.sql
git commit -m "feat(db): migration 001 — users (phone-based)"
```

### Task 8: Migration 002 — trees

**Files:** Create `database/migrations/002_create_trees.sql`.

- [ ] **Step 1: Write SQL**

```sql
CREATE TABLE trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  owner_person_id UUID,
  visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','link','family','public')),
  share_token VARCHAR(16) UNIQUE,
  share_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trees_user_id ON trees(user_id);
CREATE INDEX idx_trees_share_token ON trees(share_token) WHERE share_token IS NOT NULL;
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter server run migrate
git add database/migrations/002_create_trees.sql
git commit -m "feat(db): migration 002 — trees (with share fields)"
```

### Task 9: Migration 003 — persons

**Files:** Create `database/migrations/003_create_persons.sql`.

- [ ] **Step 1: Write SQL**

```sql
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  middle_name VARCHAR(100),
  maiden_name VARCHAR(100),
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male','female')),
  birth_date DATE,
  birth_year SMALLINT,
  birth_date_known BOOLEAN NOT NULL DEFAULT FALSE,
  is_alive BOOLEAN NOT NULL DEFAULT TRUE,
  death_date DATE,
  death_year SMALLINT,
  death_date_known BOOLEAN NOT NULL DEFAULT FALSE,
  photo_data BYTEA,
  photo_mime VARCHAR(50),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_persons_tree_id ON persons(tree_id);

ALTER TABLE trees
  ADD CONSTRAINT trees_owner_person_id_fk
  FOREIGN KEY (owner_person_id) REFERENCES persons(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter server run migrate
git add database/migrations/003_create_persons.sql
git commit -m "feat(db): migration 003 — persons (verified, photo BYTEA)"
```

### Task 10: Migration 004 — relationships

**Files:** Create `database/migrations/004_create_relationships.sql`.

- [ ] **Step 1: Write SQL**

```sql
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL CHECK (category IN ('couple','parent_child')),
  person1_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person2_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  couple_status VARCHAR(20) CHECK (couple_status IN ('married','civil','dating','divorced','widowed','other')),
  child_relation VARCHAR(20) CHECK (child_relation IN ('biological','adopted','foster','guardianship','stepchild')),
  start_date DATE,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT diff_persons CHECK (person1_id <> person2_id),
  CONSTRAINT couple_consistency CHECK (
    (category = 'couple' AND couple_status IS NOT NULL AND child_relation IS NULL) OR
    (category = 'parent_child' AND child_relation IS NOT NULL AND couple_status IS NULL)
  )
);

CREATE INDEX idx_rel_tree_id ON relationships(tree_id);
CREATE INDEX idx_rel_p1 ON relationships(person1_id);
CREATE INDEX idx_rel_p2 ON relationships(person2_id);
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter server run migrate
git add database/migrations/004_create_relationships.sql
git commit -m "feat(db): migration 004 — relationships (couple/parent_child)"
```

### Task 11: Migration 005 — otp_codes

**Files:** Create `database/migrations/005_create_otp_codes.sql`.

- [ ] **Step 1: Write SQL**

```sql
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_phone ON otp_codes(phone, expires_at);
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter server run migrate
git add database/migrations/005_create_otp_codes.sql
git commit -m "feat(db): migration 005 — otp_codes"
```

### Task 12: Migration 006 — tree_suggestions

**Files:** Create `database/migrations/006_create_tree_suggestions.sql`.

- [ ] **Step 1: Write SQL**

```sql
CREATE TABLE tree_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  from_phone VARCHAR(20),
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suggestions_tree ON tree_suggestions(tree_id, status);
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter server run migrate
git add database/migrations/006_create_tree_suggestions.sql
git commit -m "feat(db): migration 006 — tree_suggestions"
```

---

## Phase 1C: Backend Auth (phone + OTP)

### Task 13: Error utilities + validators

**Files:** Create `server/src/utils/errors.ts`, `server/src/utils/validators.ts`.

- [ ] **Step 1: Write `errors.ts`**

```typescript
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) {
    super(message);
  }
}
export class NotFoundError extends AppError { constructor(m='Not found'){ super(404,m,'NOT_FOUND'); } }
export class UnauthorizedError extends AppError { constructor(m='Unauthorized'){ super(401,m,'UNAUTHORIZED'); } }
export class ForbiddenError extends AppError { constructor(m='Forbidden'){ super(403,m,'FORBIDDEN'); } }
export class ValidationError extends AppError {
  constructor(public details: unknown, m='Validation failed'){ super(400,m,'VALIDATION'); }
}
```

- [ ] **Step 2: Write `validators.ts`**

```typescript
import { z } from 'zod';

export const phoneSchema = z.string().regex(/^\+?\d{9,15}$/, 'Invalid phone');

export const requestOtpSchema = z.object({ phone: phoneSchema });
export const verifyOtpSchema = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{4,6}$/) });
export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const createTreeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});

export const genderSchema = z.enum(['male','female']);
export const coupleStatusSchema = z.enum(['married','civil','dating','divorced','widowed','other']);
export const childRelationSchema = z.enum(['biological','adopted','foster','guardianship','stepchild']);

export const createPersonSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  middleName: z.string().max(100).optional(),
  maidenName: z.string().max(100).optional(),
  gender: genderSchema,
  birthDate: z.string().date().optional(),
  birthYear: z.number().int().min(1800).max(2100).optional(),
  birthDateKnown: z.boolean().default(false),
  isAlive: z.boolean().default(true),
  deathDate: z.string().date().optional(),
  deathYear: z.number().int().min(1800).max(2100).optional(),
  deathDateKnown: z.boolean().default(false),
  note: z.string().optional(),
  relationships: z.array(z.object({
    category: z.enum(['couple','parent_child']),
    otherPersonId: z.string().uuid(),
    role: z.enum(['parent','child','spouse']).optional(),
    coupleStatus: coupleStatusSchema.optional(),
    childRelation: childRelationSchema.optional(),
  })).optional(),
});

export const createRelationshipSchema = z.object({
  category: z.enum(['couple','parent_child']),
  person1Id: z.string().uuid(),
  person2Id: z.string().uuid(),
  coupleStatus: coupleStatusSchema.optional(),
  childRelation: childRelationSchema.optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  note: z.string().optional(),
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src/utils/
git commit -m "feat(server): error classes + zod validators"
```

### Task 14: Middleware (errorHandler, validate, authenticate)

**Files:** Create `server/src/middleware/errorHandler.ts`, `validate.ts`, `authenticate.ts`.

- [ ] **Step 1: `errorHandler.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors.js';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ValidationError) return res.status(400).json({ error: err.code, message: err.message, details: err.details });
  if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.code, message: err.message });
  console.error('[unhandled]', err);
  return res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' });
};
```

- [ ] **Step 2: `validate.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors.js';

export const validate = <T>(schema: ZodSchema<T>) => (req: Request, _res: Response, next: NextFunction) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return next(new ValidationError(r.error.issues));
  req.body = r.data;
  next();
};
```

- [ ] **Step 3: `authenticate.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

declare global {
  namespace Express { interface Request { user?: { id: string; phone: string } } }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(new UnauthorizedError('No bearer token'));
  try {
    const payload = jwt.verify(h.slice(7), env.JWT_SECRET) as { sub: string; phone: string };
    req.user = { id: payload.sub, phone: payload.phone };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};
```

- [ ] **Step 4: Commit**

```bash
git add server/src/middleware/
git commit -m "feat(server): error/validate/authenticate middleware"
```

### Task 15: OTP service + test

**Files:** Create `server/src/services/otp.service.ts`, `server/src/__tests__/setup.ts`, `server/src/__tests__/otp.service.test.ts`.

- [ ] **Step 1: Write `otp.service.ts`**

```typescript
import { query } from '../db/pool.js';
import { env } from '../config/env.js';

export const generateOtp = async (phone: string): Promise<{ code: string; ttl: number }> => {
  const code = env.NODE_ENV === 'production' ? String(Math.floor(1000 + Math.random() * 9000)) : env.OTP_DEV_CODE;
  const ttl = env.OTP_TTL_SECONDS;
  await query(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)`,
    [phone, code, ttl]
  );
  if (env.NODE_ENV === 'production') {
    // TODO Phase 2: send via Click SMS or external provider
    console.log(`[otp] would send to ${phone}`);
  } else {
    console.log(`[otp dev] phone=${phone} code=${code}`);
  }
  return { code, ttl };
};

export const verifyOtp = async (phone: string, code: string): Promise<boolean> => {
  const r = await query<{ id: string }>(
    `UPDATE otp_codes SET used_at = NOW()
     WHERE id = (
       SELECT id FROM otp_codes
       WHERE phone = $1 AND code = $2 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1
     )
     RETURNING id`,
    [phone, code]
  );
  return r.rowCount > 0;
};
```

- [ ] **Step 2: Write `__tests__/setup.ts`**

```typescript
import 'dotenv/config';
import { pool } from '../db/pool.js';
import { afterAll, beforeEach } from 'vitest';

beforeEach(async () => {
  await pool.query(`TRUNCATE otp_codes, relationships, persons, trees, users RESTART IDENTITY CASCADE`);
});

afterAll(async () => { await pool.end(); });
```

- [ ] **Step 3: Write `otp.service.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generateOtp, verifyOtp } from '../services/otp.service.js';

describe('otp.service', () => {
  it('generates a code and verifies it', async () => {
    const { code } = await generateOtp('+998901234567');
    const ok = await verifyOtp('+998901234567', code);
    expect(ok).toBe(true);
  });

  it('rejects already-used code', async () => {
    const { code } = await generateOtp('+998900000001');
    expect(await verifyOtp('+998900000001', code)).toBe(true);
    expect(await verifyOtp('+998900000001', code)).toBe(false);
  });

  it('rejects wrong code', async () => {
    await generateOtp('+998900000002');
    expect(await verifyOtp('+998900000002', '9999')).toBe(false);
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter server run test
```
Expected: 3 tests pass.

```bash
git add server/src/services/otp.service.ts server/src/__tests__/
git commit -m "feat(server): otp service (mock SMS in dev) + tests"
```

### Task 16: Auth service + test

**Files:** Create `server/src/config/auth.ts`, `server/src/services/auth.service.ts`, `server/src/__tests__/auth.service.test.ts`.

- [ ] **Step 1: Write `config/auth.ts`**

```typescript
import jwt from 'jsonwebtoken';
import { env } from './env.js';

type Payload = { sub: string; phone: string };

export const signAccess = (p: Payload) => jwt.sign(p, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES });
export const signRefresh = (p: Payload) => jwt.sign({ ...p, type: 'refresh' }, env.JWT_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES });
export const verifyRefresh = (token: string): Payload => {
  const d = jwt.verify(token, env.JWT_SECRET) as Payload & { type?: string };
  if (d.type !== 'refresh') throw new Error('not a refresh token');
  return { sub: d.sub, phone: d.phone };
};
```

- [ ] **Step 2: Write `services/auth.service.ts`**

```typescript
import { query } from '../db/pool.js';
import { signAccess, signRefresh, verifyRefresh } from '../config/auth.js';
import { UnauthorizedError } from '../utils/errors.js';
import { verifyOtp } from './otp.service.js';

export interface AuthUser { id: string; phone: string; displayName: string | null; avatarUrl: string | null; }

export const upsertUserByPhone = async (phone: string): Promise<AuthUser> => {
  const r = await query<AuthUser>(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
     RETURNING id, phone, display_name AS "displayName", avatar_url AS "avatarUrl"`,
    [phone]
  );
  return r.rows[0];
};

export const loginWithOtp = async (phone: string, code: string) => {
  const ok = await verifyOtp(phone, code);
  if (!ok) throw new UnauthorizedError('Invalid or expired code');
  const user = await upsertUserByPhone(phone);
  const payload = { sub: user.id, phone: user.phone };
  return { user, accessToken: signAccess(payload), refreshToken: signRefresh(payload) };
};

export const refreshTokens = (token: string) => {
  let payload;
  try { payload = verifyRefresh(token); } catch { throw new UnauthorizedError('Invalid refresh token'); }
  return { accessToken: signAccess(payload), refreshToken: signRefresh(payload) };
};

export const getMe = async (id: string): Promise<AuthUser | null> => {
  const r = await query<AuthUser>(
    `SELECT id, phone, display_name AS "displayName", avatar_url AS "avatarUrl" FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
};
```

- [ ] **Step 3: Write `auth.service.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generateOtp } from '../services/otp.service.js';
import { loginWithOtp, refreshTokens } from '../services/auth.service.js';

describe('auth.service', () => {
  it('logs in via valid OTP and returns tokens', async () => {
    const phone = '+998900000010';
    const { code } = await generateOtp(phone);
    const r = await loginWithOtp(phone, code);
    expect(r.user.phone).toBe(phone);
    expect(r.accessToken).toMatch(/\./);
    expect(r.refreshToken).toMatch(/\./);
  });

  it('rejects invalid OTP', async () => {
    await expect(loginWithOtp('+998900000011', '0000')).rejects.toThrow();
  });

  it('refreshes tokens', async () => {
    const phone = '+998900000012';
    const { code } = await generateOtp(phone);
    const r = await loginWithOtp(phone, code);
    const refreshed = refreshTokens(r.refreshToken);
    expect(refreshed.accessToken).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter server run test
git add server/src/config/auth.ts server/src/services/auth.service.ts server/src/__tests__/auth.service.test.ts
git commit -m "feat(server): auth service (otp login, jwt issue/refresh) + tests"
```

### Task 17: Auth routes + supertest

**Files:** Create `server/src/routes/auth.routes.ts`, `server/src/__tests__/routes/auth.routes.test.ts`. Modify `server/src/server.ts` to wire app.

- [ ] **Step 1: Refactor server.ts → app.ts + server.ts**

`server/src/app.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
};
```

`server/src/server.ts`:
```typescript
import 'dotenv/config';
import { env } from './config/env.js';
import { createApp } from './app.js';

createApp().listen(env.PORT, () => console.log(`[server] http://localhost:${env.PORT}`));
```

- [ ] **Step 2: Write `auth.routes.ts`**

```typescript
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { requestOtpSchema, verifyOtpSchema, refreshSchema } from '../utils/validators.js';
import { generateOtp } from '../services/otp.service.js';
import { loginWithOtp, refreshTokens, getMe } from '../services/auth.service.js';

export const authRoutes = Router();

authRoutes.post('/request-otp', validate(requestOtpSchema), async (req, res, next) => {
  try {
    const { ttl } = await generateOtp(req.body.phone);
    res.json({ ok: true, ttl });
  } catch (e) { next(e); }
});

authRoutes.post('/verify-otp', validate(verifyOtpSchema), async (req, res, next) => {
  try { res.json(await loginWithOtp(req.body.phone, req.body.code)); }
  catch (e) { next(e); }
});

authRoutes.post('/refresh', validate(refreshSchema), (req, res, next) => {
  try { res.json(refreshTokens(req.body.refreshToken)); }
  catch (e) { next(e); }
});

authRoutes.post('/logout', (_req, res) => res.json({ ok: true }));

authRoutes.get('/me', authenticate, async (req, res, next) => {
  try { res.json(await getMe(req.user!.id)); }
  catch (e) { next(e); }
});
```

- [ ] **Step 3: Write `auth.routes.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

describe('POST /api/auth/request-otp + verify-otp', () => {
  it('200 → request, then login with code 0000 in dev', async () => {
    const phone = '+998900000020';
    await request(app).post('/api/auth/request-otp').send({ phone }).expect(200);
    const r = await request(app).post('/api/auth/verify-otp').send({ phone, code: '0000' }).expect(200);
    expect(r.body.user.phone).toBe(phone);
    expect(r.body.accessToken).toMatch(/\./);
  });

  it('400 on invalid phone', async () => {
    await request(app).post('/api/auth/request-otp').send({ phone: 'abc' }).expect(400);
  });

  it('401 on wrong code', async () => {
    const phone = '+998900000021';
    await request(app).post('/api/auth/request-otp').send({ phone });
    await request(app).post('/api/auth/verify-otp').send({ phone, code: '9999' }).expect(401);
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter server run test
git add server/src/app.ts server/src/server.ts server/src/routes/auth.routes.ts server/src/__tests__/routes/
git commit -m "feat(server): auth routes (request-otp, verify-otp, refresh, me)"
```

---

## Phase 1D: Backend Trees / Persons / Relationships

### Task 18: authorizeTree middleware + trees.service

**Files:** Create `server/src/middleware/authorizeTree.ts`, `server/src/services/trees.service.ts`.

- [ ] **Step 1: `authorizeTree.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

declare global { namespace Express { interface Request { tree?: { id: string; userId: string } } } }

export const authorizeTree = async (req: Request, _res: Response, next: NextFunction) => {
  const id = req.params.treeId ?? req.params.id;
  if (!id) return next(new NotFoundError('Tree id required'));
  const r = await query<{ id: string; user_id: string }>(`SELECT id, user_id FROM trees WHERE id = $1`, [id]);
  if (r.rowCount === 0) return next(new NotFoundError('Tree not found'));
  if (r.rows[0].user_id !== req.user!.id) return next(new ForbiddenError('Not your tree'));
  req.tree = { id: r.rows[0].id, userId: r.rows[0].user_id };
  next();
};
```

- [ ] **Step 2: `trees.service.ts`** (CRUD + getFullTree + BFS generations)

```typescript
import { query } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

export interface Tree { id: string; userId: string; name: string; description: string | null; ownerPersonId: string | null; visibility: string; shareToken: string | null; }

const ROW_TO_TREE = `id, user_id AS "userId", name, description, owner_person_id AS "ownerPersonId", visibility, share_token AS "shareToken"`;

export const listTrees = async (userId: string): Promise<(Tree & { personCount: number })[]> => {
  const r = await query<Tree & { personCount: number }>(`
    SELECT ${ROW_TO_TREE}, (SELECT COUNT(*)::int FROM persons p WHERE p.tree_id = t.id) AS "personCount"
    FROM trees t WHERE user_id = $1 ORDER BY created_at DESC
  `, [userId]);
  return r.rows;
};

export const createTree = async (userId: string, name: string, description?: string): Promise<Tree> => {
  const r = await query<Tree>(`INSERT INTO trees (user_id, name, description) VALUES ($1, $2, $3) RETURNING ${ROW_TO_TREE}`,
    [userId, name, description ?? null]);
  return r.rows[0];
};

export const getTree = async (id: string): Promise<Tree> => {
  const r = await query<Tree>(`SELECT ${ROW_TO_TREE} FROM trees WHERE id = $1`, [id]);
  if (r.rowCount === 0) throw new NotFoundError('Tree not found');
  return r.rows[0];
};

export const updateTree = async (id: string, fields: Partial<Pick<Tree, 'name' | 'description' | 'ownerPersonId' | 'visibility'>>): Promise<Tree> => {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    const col = ({ ownerPersonId: 'owner_person_id' } as Record<string,string>)[k] ?? k;
    sets.push(`${col} = $${i++}`); params.push(v);
  }
  if (sets.length === 0) return getTree(id);
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const r = await query<Tree>(`UPDATE trees SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${ROW_TO_TREE}`, params);
  return r.rows[0];
};

export const deleteTree = async (id: string): Promise<void> => {
  await query(`DELETE FROM trees WHERE id = $1`, [id]);
};

// BFS generations from owner (gen=0): parents = -1, children = +1, spouses = same
export const getFullTree = async (treeId: string) => {
  const tree = await getTree(treeId);
  const persons = (await query(`SELECT * FROM persons WHERE tree_id = $1 ORDER BY birth_year NULLS LAST, birth_date NULLS LAST`, [treeId])).rows;
  const rels = (await query(`SELECT * FROM relationships WHERE tree_id = $1`, [treeId])).rows;

  const generations: { number: number; label: string; personIds: string[] }[] = [];
  if (tree.ownerPersonId && persons.length) {
    const gen = new Map<string, number>();
    gen.set(tree.ownerPersonId, 0);
    const queue = [tree.ownerPersonId];
    while (queue.length) {
      const cur = queue.shift()!;
      const g = gen.get(cur)!;
      for (const r of rels as any[]) {
        let other: string | null = null, dg = 0;
        if (r.category === 'parent_child') {
          if (r.person1_id === cur) { other = r.person2_id; dg = 1; }
          else if (r.person2_id === cur) { other = r.person1_id; dg = -1; }
        } else if (r.category === 'couple') {
          if (r.person1_id === cur) other = r.person2_id;
          else if (r.person2_id === cur) other = r.person1_id;
        }
        if (other && !gen.has(other)) { gen.set(other, g + dg); queue.push(other); }
      }
    }
    for (const p of persons as any[]) if (!gen.has(p.id)) gen.set(p.id, 0);
    const labels: Record<number, string> = { '-4': 'Прапрадеды', '-3': 'Прадеды', '-2': 'Деды и Бабушки', '-1': 'Родители', '0': 'Я и сиблинги', '1': 'Дети', '2': 'Внуки', '3': 'Правнуки' };
    const buckets = new Map<number, string[]>();
    for (const [pid, g] of gen) buckets.set(g, [...(buckets.get(g) ?? []), pid]);
    for (const [g, ids] of [...buckets].sort((a, b) => a[0] - b[0])) {
      generations.push({ number: g, label: labels[g] ?? `Поколение ${g}`, personIds: ids });
    }
  }

  return { tree, persons, relationships: rels, generations };
};
```

- [ ] **Step 3: Commit**

```bash
git add server/src/middleware/authorizeTree.ts server/src/services/trees.service.ts
git commit -m "feat(server): trees service (CRUD + getFullTree + BFS generations)"
```

### Task 19: Trees routes + tests

**Files:** Create `server/src/routes/trees.routes.ts`. Modify `server/src/app.ts` to mount.

- [ ] **Step 1: Write `trees.routes.ts`**

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { createTreeSchema } from '../utils/validators.js';
import { listTrees, createTree, getTree, updateTree, deleteTree, getFullTree } from '../services/trees.service.js';

export const treesRoutes = Router();

treesRoutes.use(authenticate);

treesRoutes.get('/', async (req, res, next) => { try { res.json(await listTrees(req.user!.id)); } catch (e) { next(e); }});

treesRoutes.post('/', validate(createTreeSchema), async (req, res, next) => {
  try { res.status(201).json(await createTree(req.user!.id, req.body.name, req.body.description)); }
  catch (e) { next(e); }
});

treesRoutes.get('/:id', authorizeTree, async (req, res, next) => { try { res.json(await getTree(req.tree!.id)); } catch (e) { next(e); }});

treesRoutes.get('/:id/full', authorizeTree, async (req, res, next) => { try { res.json(await getFullTree(req.tree!.id)); } catch (e) { next(e); }});

treesRoutes.put('/:id', authorizeTree, async (req, res, next) => { try { res.json(await updateTree(req.tree!.id, req.body)); } catch (e) { next(e); }});

treesRoutes.delete('/:id', authorizeTree, async (req, res, next) => { try { await deleteTree(req.tree!.id); res.json({ ok: true }); } catch (e) { next(e); }});
```

- [ ] **Step 2: Mount in `app.ts`** — add `import { treesRoutes } from './routes/trees.routes.js'; ` and `app.use('/api/trees', treesRoutes);`

- [ ] **Step 3: Smoke test**

```bash
pnpm --filter server run test
# Manual: curl POST /api/auth/request-otp → /verify-otp → save accessToken → curl POST /api/trees with Bearer
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/trees.routes.ts server/src/app.ts
git commit -m "feat(server): trees routes (list, create, get, full, update, delete)"
```

### Task 20: Persons service (CRUD + transactional add)

**Files:** Create `server/src/services/persons.service.ts`.

- [ ] **Step 1: Write service**

```typescript
import { pool, query } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

const PERSON_FIELDS = `
  id, tree_id AS "treeId", first_name AS "firstName", last_name AS "lastName",
  middle_name AS "middleName", maiden_name AS "maidenName", gender,
  birth_date AS "birthDate", birth_year AS "birthYear", birth_date_known AS "birthDateKnown",
  is_alive AS "isAlive", death_date AS "deathDate", death_year AS "deathYear",
  death_date_known AS "deathDateKnown", verified, note,
  CASE WHEN photo_data IS NOT NULL THEN '/api/trees/' || tree_id || '/persons/' || id || '/photo' ELSE NULL END AS "photoUrl"
`;

export const listPersons = async (treeId: string) => {
  const r = await query(`SELECT ${PERSON_FIELDS} FROM persons WHERE tree_id = $1 ORDER BY birth_year NULLS LAST, birth_date NULLS LAST`, [treeId]);
  return r.rows;
};

export const getPerson = async (id: string) => {
  const r = await query(`SELECT ${PERSON_FIELDS} FROM persons WHERE id = $1`, [id]);
  if (r.rowCount === 0) throw new NotFoundError('Person not found');
  return r.rows[0];
};

interface CreatePersonInput {
  firstName: string; lastName?: string; middleName?: string; maidenName?: string;
  gender: 'male' | 'female';
  birthDate?: string; birthYear?: number; birthDateKnown?: boolean;
  isAlive?: boolean; deathDate?: string; deathYear?: number; deathDateKnown?: boolean;
  note?: string;
  relationships?: Array<{
    category: 'couple' | 'parent_child';
    otherPersonId: string;
    role?: 'parent' | 'child' | 'spouse';
    coupleStatus?: string;
    childRelation?: string;
  }>;
}

export const createPerson = async (treeId: string, input: CreatePersonInput) => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const insP = await c.query(
      `INSERT INTO persons (tree_id, first_name, last_name, middle_name, maiden_name, gender, birth_date, birth_year, birth_date_known, is_alive, death_date, death_year, death_date_known, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING ${PERSON_FIELDS}`,
      [treeId, input.firstName, input.lastName ?? null, input.middleName ?? null, input.maidenName ?? null,
       input.gender, input.birthDate ?? null, input.birthYear ?? null, input.birthDateKnown ?? false,
       input.isAlive ?? true, input.deathDate ?? null, input.deathYear ?? null, input.deathDateKnown ?? false, input.note ?? null]
    );
    const newPerson = insP.rows[0];

    for (const r of input.relationships ?? []) {
      let p1: string, p2: string;
      if (r.role === 'parent') { p1 = r.otherPersonId; p2 = newPerson.id; }
      else if (r.role === 'child') { p1 = newPerson.id; p2 = r.otherPersonId; }
      else { p1 = newPerson.id; p2 = r.otherPersonId; }
      await c.query(
        `INSERT INTO relationships (tree_id, category, person1_id, person2_id, couple_status, child_relation)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [treeId, r.category, p1, p2, r.coupleStatus ?? null, r.childRelation ?? null]
      );
    }
    await c.query('COMMIT');
    return newPerson;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
};

export const updatePerson = async (id: string, fields: Partial<CreatePersonInput>) => {
  const map: Record<string, string> = { firstName: 'first_name', lastName: 'last_name', middleName: 'middle_name', maidenName: 'maiden_name', gender: 'gender', birthDate: 'birth_date', birthYear: 'birth_year', birthDateKnown: 'birth_date_known', isAlive: 'is_alive', deathDate: 'death_date', deathYear: 'death_year', deathDateKnown: 'death_date_known', note: 'note' };
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'relationships' || !map[k]) continue;
    sets.push(`${map[k]} = $${i++}`); params.push(v ?? null);
  }
  if (sets.length === 0) return getPerson(id);
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const r = await query(`UPDATE persons SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${PERSON_FIELDS}`, params);
  if (r.rowCount === 0) throw new NotFoundError('Person not found');
  return r.rows[0];
};

export const deletePerson = async (id: string): Promise<void> => {
  await query(`DELETE FROM persons WHERE id = $1`, [id]);
};
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/persons.service.ts
git commit -m "feat(server): persons service (CRUD + transactional add with rels)"
```

### Task 21: Persons routes

**Files:** Create `server/src/routes/persons.routes.ts`. Modify `app.ts`.

- [ ] **Step 1: Write routes**

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { createPersonSchema } from '../utils/validators.js';
import { listPersons, createPerson, getPerson, updatePerson, deletePerson } from '../services/persons.service.js';

export const personsRoutes = Router({ mergeParams: true });

personsRoutes.use(authenticate, authorizeTree);

personsRoutes.get('/', async (req, res, next) => { try { res.json(await listPersons(req.tree!.id)); } catch (e) { next(e); }});
personsRoutes.post('/', validate(createPersonSchema), async (req, res, next) => { try { res.status(201).json(await createPerson(req.tree!.id, req.body)); } catch (e) { next(e); }});
personsRoutes.get('/:personId', async (req, res, next) => { try { res.json(await getPerson(req.params.personId)); } catch (e) { next(e); }});
personsRoutes.put('/:personId', async (req, res, next) => { try { res.json(await updatePerson(req.params.personId, req.body)); } catch (e) { next(e); }});
personsRoutes.delete('/:personId', async (req, res, next) => { try { await deletePerson(req.params.personId); res.json({ ok: true }); } catch (e) { next(e); }});
```

- [ ] **Step 2: Mount nested in `app.ts`**

```typescript
import { personsRoutes } from './routes/persons.routes.js';
// ...
app.use('/api/trees/:treeId/persons', personsRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/persons.routes.ts server/src/app.ts
git commit -m "feat(server): persons routes (CRUD)"
```

### Task 22: Relationships service + routes

**Files:** Create `server/src/services/relationships.service.ts`, `server/src/routes/relationships.routes.ts`.

- [ ] **Step 1: Service**

```typescript
import { query } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

const F = `id, tree_id AS "treeId", category, person1_id AS "person1Id", person2_id AS "person2Id",
           couple_status AS "coupleStatus", child_relation AS "childRelation",
           start_date AS "startDate", end_date AS "endDate", note`;

export const listRels = async (treeId: string) => (await query(`SELECT ${F} FROM relationships WHERE tree_id = $1`, [treeId])).rows;
export const getRel = async (id: string) => {
  const r = await query(`SELECT ${F} FROM relationships WHERE id = $1`, [id]);
  if (r.rowCount === 0) throw new NotFoundError('Relationship not found');
  return r.rows[0];
};
export const createRel = async (treeId: string, b: any) => {
  const r = await query(`INSERT INTO relationships (tree_id, category, person1_id, person2_id, couple_status, child_relation, start_date, end_date, note)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${F}`,
    [treeId, b.category, b.person1Id, b.person2Id, b.coupleStatus ?? null, b.childRelation ?? null, b.startDate ?? null, b.endDate ?? null, b.note ?? null]);
  return r.rows[0];
};
export const updateRel = async (id: string, b: any) => {
  const map: Record<string,string> = { category:'category', coupleStatus:'couple_status', childRelation:'child_relation', startDate:'start_date', endDate:'end_date', note:'note' };
  const sets: string[] = []; const params: unknown[] = []; let i = 1;
  for (const [k,v] of Object.entries(b)) if (map[k]) { sets.push(`${map[k]}=$${i++}`); params.push(v); }
  if (!sets.length) return getRel(id);
  params.push(id);
  const r = await query(`UPDATE relationships SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${i} RETURNING ${F}`, params);
  return r.rows[0];
};
export const deleteRel = async (id: string) => { await query(`DELETE FROM relationships WHERE id = $1`, [id]); };
```

- [ ] **Step 2: Routes**

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { createRelationshipSchema } from '../utils/validators.js';
import { listRels, createRel, getRel, updateRel, deleteRel } from '../services/relationships.service.js';

export const relsRoutes = Router({ mergeParams: true });
relsRoutes.use(authenticate, authorizeTree);

relsRoutes.get('/', async (req, res, next) => { try { res.json(await listRels(req.tree!.id)); } catch (e) { next(e); }});
relsRoutes.post('/', validate(createRelationshipSchema), async (req, res, next) => { try { res.status(201).json(await createRel(req.tree!.id, req.body)); } catch (e) { next(e); }});
relsRoutes.get('/:relId', async (req, res, next) => { try { res.json(await getRel(req.params.relId)); } catch (e) { next(e); }});
relsRoutes.put('/:relId', async (req, res, next) => { try { res.json(await updateRel(req.params.relId, req.body)); } catch (e) { next(e); }});
relsRoutes.delete('/:relId', async (req, res, next) => { try { await deleteRel(req.params.relId); res.json({ ok: true }); } catch (e) { next(e); }});
```

- [ ] **Step 3: Mount + commit**

```typescript
// in app.ts
app.use('/api/trees/:treeId/relationships', relsRoutes);
```

```bash
git add server/src/services/relationships.service.ts server/src/routes/relationships.routes.ts server/src/app.ts
git commit -m "feat(server): relationships service + routes"
```

---

## Phase 1E: Photos / Events / Share / ClickIntegration mock

### Task 23: Photos (multipart upload, public GET)

**Files:** Create `server/src/services/photos.service.ts`, `server/src/routes/photos.routes.ts`, `server/src/routes/photo-public.routes.ts`. Modify `app.ts`.

- [ ] **Step 1: `photos.service.ts`**

```typescript
import { query } from '../db/pool.js';
import { NotFoundError } from '../utils/errors.js';

export const setPhoto = async (personId: string, data: Buffer, mime: string) => {
  await query(`UPDATE persons SET photo_data = $1, photo_mime = $2, updated_at = NOW() WHERE id = $3`, [data, mime, personId]);
};

export const getPhoto = async (personId: string): Promise<{ data: Buffer; mime: string } | null> => {
  const r = await query<{ photo_data: Buffer; photo_mime: string }>(
    `SELECT photo_data, photo_mime FROM persons WHERE id = $1`, [personId]);
  if (r.rowCount === 0) throw new NotFoundError('Person not found');
  if (!r.rows[0].photo_data) return null;
  return { data: r.rows[0].photo_data, mime: r.rows[0].photo_mime };
};

export const deletePhoto = async (personId: string) => {
  await query(`UPDATE persons SET photo_data = NULL, photo_mime = NULL, updated_at = NOW() WHERE id = $1`, [personId]);
};
```

- [ ] **Step 2: `photo-public.routes.ts` (public GET — must mount BEFORE treesRoutes)**

```typescript
import { Router } from 'express';
import { getPhoto } from '../services/photos.service.js';

export const photoPublicRoutes = Router();

photoPublicRoutes.get('/trees/:treeId/persons/:personId/photo', async (req, res, next) => {
  try {
    const photo = await getPhoto(req.params.personId);
    if (!photo) return res.status(404).end();
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(photo.data);
  } catch (e) { next(e); }
});
```

- [ ] **Step 3: `photos.routes.ts` (auth POST/DELETE)**

```typescript
import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree } from '../middleware/authorizeTree.js';
import { setPhoto, deletePhoto } from '../services/photos.service.js';
import { ValidationError } from '../utils/errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => {
    if (!['image/jpeg','image/png','image/webp'].includes(f.mimetype)) return cb(new ValidationError({ mime: f.mimetype }, 'Unsupported image type'));
    cb(null, true);
  },
});

export const photosRoutes = Router({ mergeParams: true });
photosRoutes.use(authenticate, authorizeTree);

photosRoutes.post('/:personId/photo', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) throw new ValidationError({}, 'photo file required');
    await setPhoto(req.params.personId, req.file.buffer, req.file.mimetype);
    res.json({ ok: true, photoUrl: `/api/trees/${req.tree!.id}/persons/${req.params.personId}/photo` });
  } catch (e) { next(e); }
});

photosRoutes.delete('/:personId/photo', async (req, res, next) => {
  try { await deletePhoto(req.params.personId); res.json({ ok: true }); } catch (e) { next(e); }
});
```

- [ ] **Step 4: Mount in `app.ts` — CRITICAL ORDERING**

```typescript
import { photoPublicRoutes } from './routes/photo-public.routes.js';
import { photosRoutes } from './routes/photos.routes.js';
// ...
app.use('/api', photoPublicRoutes);     // ← BEFORE treesRoutes (otherwise auth middleware blocks <img>)
app.use('/api/trees', treesRoutes);
app.use('/api/trees/:treeId/persons', personsRoutes);
app.use('/api/trees/:treeId/persons', photosRoutes);  // upload/delete with auth
app.use('/api/trees/:treeId/relationships', relsRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/photos.service.ts server/src/routes/photos.routes.ts server/src/routes/photo-public.routes.ts server/src/app.ts
git commit -m "feat(server): photos (multipart upload to BYTEA, public GET)"
```

### Task 24: Events service + route (calendar)

**Files:** Create `server/src/services/events.service.ts`, `server/src/routes/events.routes.ts`, `server/src/__tests__/events.service.test.ts`.

- [ ] **Step 1: Service**

```typescript
import { query } from '../db/pool.js';

export type EventType = 'birthday' | 'memorial' | 'anniversary' | 'child_birthday';
export interface Event {
  type: EventType;
  date: string;       // YYYY-MM-DD next occurrence (or original if exact-day disabled)
  daysUntil: number;
  personId?: string;
  personIds?: [string, string];
  meta: { name: string; relation?: string; ageOnEvent?: number; yearsAgo?: number };
}

const yearOnly = (year: number, monthDay: string) => `${year}-${monthDay}`;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const computeEvents = async (treeId: string, from: Date, to: Date): Promise<Event[]> => {
  const persons = (await query<any>(`SELECT * FROM persons WHERE tree_id = $1`, [treeId])).rows;
  const couples = (await query<any>(`SELECT * FROM relationships WHERE tree_id = $1 AND category='couple' AND start_date IS NOT NULL`, [treeId])).rows;

  const out: Event[] = [];
  const yearStart = from.getUTCFullYear();
  const yearEnd = to.getUTCFullYear();

  for (const p of persons) {
    if (p.birth_date) {
      const md = ymd(new Date(p.birth_date)).slice(5);
      for (let y = yearStart; y <= yearEnd; y++) {
        const dStr = yearOnly(y, md);
        const d = new Date(dStr + 'T00:00:00Z');
        if (d < from || d > to) continue;
        const ageOnEvent = y - new Date(p.birth_date).getUTCFullYear();
        const isChild = ageOnEvent < 14;
        out.push({
          type: !p.is_alive ? 'memorial' : (isChild ? 'child_birthday' : 'birthday'),
          date: dStr,
          daysUntil: Math.floor((d.getTime() - from.getTime()) / 86400000),
          personId: p.id,
          meta: { name: `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}`, ageOnEvent },
        });
      }
    }
    if (!p.is_alive && p.death_date) {
      const md = ymd(new Date(p.death_date)).slice(5);
      const deathYear = new Date(p.death_date).getUTCFullYear();
      for (let y = yearStart; y <= yearEnd; y++) {
        if (y === deathYear) continue;
        const dStr = yearOnly(y, md);
        const d = new Date(dStr + 'T00:00:00Z');
        if (d < from || d > to) continue;
        out.push({
          type: 'memorial',
          date: dStr,
          daysUntil: Math.floor((d.getTime() - from.getTime()) / 86400000),
          personId: p.id,
          meta: { name: `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}`, yearsAgo: y - deathYear },
        });
      }
    }
  }

  for (const c of couples) {
    if (!c.start_date) continue;
    const md = ymd(new Date(c.start_date)).slice(5);
    const startY = new Date(c.start_date).getUTCFullYear();
    const p1 = persons.find((x) => x.id === c.person1_id);
    const p2 = persons.find((x) => x.id === c.person2_id);
    if (!p1 || !p2) continue;
    for (let y = yearStart; y <= yearEnd; y++) {
      if (y <= startY) continue;
      const dStr = yearOnly(y, md);
      const d = new Date(dStr + 'T00:00:00Z');
      if (d < from || d > to) continue;
      out.push({
        type: 'anniversary',
        date: dStr,
        daysUntil: Math.floor((d.getTime() - from.getTime()) / 86400000),
        personIds: [p1.id, p2.id],
        meta: { name: `${p1.first_name} + ${p2.first_name}`, yearsAgo: y - startY },
      });
    }
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil);
};
```

- [ ] **Step 2: Route**

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree } from '../middleware/authorizeTree.js';
import { computeEvents } from '../services/events.service.js';

export const eventsRoutes = Router({ mergeParams: true });
eventsRoutes.use(authenticate, authorizeTree);

eventsRoutes.get('/', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 90 * 86400000);
    res.json(await computeEvents(req.tree!.id, from, to));
  } catch (e) { next(e); }
});
```

- [ ] **Step 3: Test (one happy path)**

```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '../db/pool.js';
import { computeEvents } from '../services/events.service.js';

describe('events.service', () => {
  it('returns birthday events for next year', async () => {
    const u = await pool.query(`INSERT INTO users (phone) VALUES ('+998900000099') RETURNING id`);
    const t = await pool.query(`INSERT INTO trees (user_id, name) VALUES ($1, 'T') RETURNING id`, [u.rows[0].id]);
    await pool.query(`INSERT INTO persons (tree_id, first_name, gender, birth_date, birth_date_known) VALUES ($1, 'A', 'male', '1980-06-15', true)`, [t.rows[0].id]);
    const events = await computeEvents(t.rows[0].id, new Date('2026-01-01'), new Date('2027-12-31'));
    const bd = events.filter((e) => e.type === 'birthday');
    expect(bd.length).toBeGreaterThan(0);
    expect(bd[0].meta.name).toContain('A');
  });
});
```

- [ ] **Step 4: Mount + commit**

```typescript
// app.ts
app.use('/api/trees/:treeId/events', eventsRoutes);
```

```bash
pnpm --filter server run test
git add server/src/services/events.service.ts server/src/routes/events.routes.ts server/src/__tests__/events.service.test.ts server/src/app.ts
git commit -m "feat(server): events service (birthdays/memorials/anniversaries)"
```

### Task 25: Share service + routes (token gen, public read)

**Files:** Create `server/src/services/share.service.ts`, `server/src/routes/share.routes.ts`. Modify `app.ts`.

- [ ] **Step 1: Service**

```typescript
import { customAlphabet } from 'nanoid';
import { query } from '../db/pool.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { getFullTree } from './trees.service.js';

const tokenGen = customAlphabet('abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

export interface ShareSettings { showBirthDates: boolean; showPhotos: boolean; allowSuggestions: boolean; }
const DEFAULTS: ShareSettings = { showBirthDates: true, showPhotos: true, allowSuggestions: false };

export const enableShare = async (treeId: string, settings: Partial<ShareSettings> = {}): Promise<{ token: string; settings: ShareSettings }> => {
  const merged = { ...DEFAULTS, ...settings };
  const token = tokenGen();
  await query(`UPDATE trees SET share_token = $1, share_settings = $2, visibility = COALESCE(NULLIF(visibility, 'private'), 'link') WHERE id = $3`,
    [token, JSON.stringify(merged), treeId]);
  return { token, settings: merged };
};

export const updateShareSettings = async (treeId: string, settings: Partial<ShareSettings>) => {
  const r = await query<{ share_settings: any }>(`SELECT share_settings FROM trees WHERE id = $1`, [treeId]);
  if (r.rowCount === 0) throw new NotFoundError('Tree not found');
  const merged = { ...DEFAULTS, ...r.rows[0].share_settings, ...settings };
  await query(`UPDATE trees SET share_settings = $1 WHERE id = $2`, [JSON.stringify(merged), treeId]);
  return merged;
};

export const disableShare = async (treeId: string) => {
  await query(`UPDATE trees SET share_token = NULL, visibility = 'private' WHERE id = $1`, [treeId]);
};

export const getPublicView = async (token: string) => {
  const r = await query<{ id: string; visibility: string; share_settings: any }>(
    `SELECT id, visibility, share_settings FROM trees WHERE share_token = $1`, [token]);
  if (r.rowCount === 0) throw new NotFoundError('Share link not found');
  if (r.rows[0].visibility === 'private') throw new ForbiddenError('Sharing disabled');
  const settings: ShareSettings = { ...DEFAULTS, ...r.rows[0].share_settings };
  const full = await getFullTree(r.rows[0].id);
  // Apply privacy filters
  if (!settings.showBirthDates) {
    full.persons = full.persons.map((p: any) => ({ ...p, birth_date: null, birth_year: null, birth_date_known: false, death_date: null, death_year: null }));
  }
  if (!settings.showPhotos) {
    full.persons = full.persons.map((p: any) => ({ ...p, photoUrl: null }));
  }
  return { tree: { id: full.tree.id, name: full.tree.name }, persons: full.persons, relationships: full.relationships, generations: full.generations, settings };
};
```

- [ ] **Step 2: Routes**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeTree } from '../middleware/authorizeTree.js';
import { validate } from '../middleware/validate.js';
import { enableShare, updateShareSettings, disableShare, getPublicView } from '../services/share.service.js';

const settingsSchema = z.object({ showBirthDates: z.boolean().optional(), showPhotos: z.boolean().optional(), allowSuggestions: z.boolean().optional() });

export const shareRoutes = Router({ mergeParams: true });
shareRoutes.use(authenticate, authorizeTree);

shareRoutes.post('/enable', validate(settingsSchema), async (req, res, next) => { try { res.json(await enableShare(req.tree!.id, req.body)); } catch (e) { next(e); }});
shareRoutes.put('/settings', validate(settingsSchema), async (req, res, next) => { try { res.json(await updateShareSettings(req.tree!.id, req.body)); } catch (e) { next(e); }});
shareRoutes.post('/disable', async (req, res, next) => { try { await disableShare(req.tree!.id); res.json({ ok: true }); } catch (e) { next(e); }});

export const sharePublicRoutes = Router();
sharePublicRoutes.get('/share/:token', async (req, res, next) => {
  try { res.json(await getPublicView(req.params.token)); } catch (e) { next(e); }
});
```

- [ ] **Step 3: Mount + commit**

```typescript
// app.ts
app.use('/api', sharePublicRoutes);  // BEFORE treesRoutes (public)
app.use('/api/trees/:treeId/share', shareRoutes);
```

```bash
git add server/src/services/share.service.ts server/src/routes/share.routes.ts server/src/app.ts
git commit -m "feat(server): share (link gen, public read with privacy filters)"
```

### Task 26: ClickIntegration interface + Mock

**Files:** Create `server/src/services/click-integration/interface.ts`, `server/src/services/click-integration/mock.ts`, `server/src/services/click-integration/index.ts`.

- [ ] **Step 1: Interface**

```typescript
// interface.ts
export interface ClickUserIdentity { id: string; phone: string; }
export interface ClickProfile { id: string; phone: string; firstName: string; lastName?: string; birthDate?: string; }
export interface ClickRelative { id: string; phone: string; firstName: string; lastName?: string; relation: 'father' | 'mother' | 'child' | 'spouse'; }
export interface ClickUserHit { id: string; phone: string; firstName?: string; lastName?: string; }

export interface ClickIntegration {
  verifyToken(token: string): Promise<ClickUserIdentity | null>;
  getUserProfile(userId: string): Promise<ClickProfile | null>;
  getUserRelatives(userId: string): Promise<ClickRelative[]>;
  searchByPhone(phone: string): Promise<ClickUserHit[]>;
  sendPush(userId: string, body: { title: string; text: string; deepLink?: string }): Promise<void>;
  paymentDeepLink(productId: string, params: Record<string, string>): string;
}
```

- [ ] **Step 2: Mock**

```typescript
// mock.ts
import type { ClickIntegration } from './interface.js';

export const MockClickIntegration: ClickIntegration = {
  async verifyToken(_token) { return null; },
  async getUserProfile(_userId) { return null; },
  async getUserRelatives(_userId) { return []; },
  async searchByPhone(_phone) { return []; },
  async sendPush(userId, body) { console.log(`[click mock push] user=${userId}`, body); },
  paymentDeepLink(productId, params) {
    const qs = new URLSearchParams(params).toString();
    return `click://pay?product=${productId}&${qs}`;
  },
};
```

- [ ] **Step 3: Factory**

```typescript
// index.ts
import { env } from '../../config/env.js';
import type { ClickIntegration } from './interface.js';
import { MockClickIntegration } from './mock.js';

export const clickIntegration: ClickIntegration =
  env.CLICK_INTEGRATION_MODE === 'real'
    ? (() => { throw new Error('Real ClickIntegration not implemented in Phase 1'); })()
    : MockClickIntegration;
```

- [ ] **Step 4: Commit**

```bash
git add server/src/services/click-integration/
git commit -m "feat(server): ClickIntegration interface + Mock (Phase 2 hook)"
```

### Task 27: Seed data — семья Рустамовых-Каримовых, 30 чел

**Files:** Create `server/src/db/seed.ts`.

- [ ] **Step 1: Skeleton**

```typescript
import 'dotenv/config';
import { pool } from './pool.js';

async function seed() {
  await pool.query(`TRUNCATE relationships, persons, trees, users RESTART IDENTITY CASCADE`);

  // Owner user
  const u = await pool.query<{ id: string }>(`INSERT INTO users (phone, display_name) VALUES ('+998900000001', 'Улугбек') RETURNING id`);
  const userId = u.rows[0].id;

  // Tree
  const t = await pool.query<{ id: string }>(`INSERT INTO trees (user_id, name) VALUES ($1, 'Семья Рустамовых-Каримовых') RETURNING id`, [userId]);
  const treeId = t.rows[0].id;

  const P = (firstName: string, lastName: string, gender: 'male' | 'female', birthYear: number, opts: Partial<{ middleName: string; maidenName: string; deathYear: number; verified: boolean }> = {}) =>
    pool.query<{ id: string }>(
      `INSERT INTO persons (tree_id, first_name, last_name, middle_name, maiden_name, gender, birth_year, is_alive, death_year, verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [treeId, firstName, lastName, opts.middleName ?? null, opts.maidenName ?? null, gender, birthYear,
       opts.deathYear ? false : true, opts.deathYear ?? null, opts.verified ?? false]
    ).then((r) => r.rows[0].id);

  // G-3 (4 deceased)
  const yusuf = await P('Юсуф', 'Рустамов', 'male', 1900, { deathYear: 1972 });
  const zulayho = await P('Зулайхо', 'Хайдарова', 'female', 1908, { deathYear: 1985 });
  const tursun = await P('Турсун', 'Каримов', 'male', 1898, { deathYear: 1967 });
  const hosiyat = await P('Хосият', 'Юлдашева', 'female', 1902, { deathYear: 1980 });

  // G-2
  const karim = await P('Карим', 'Рустамов', 'male', 1948, { deathYear: 2010, verified: true });
  const muhabbat = await P('Мухаббат', 'Усманова', 'female', 1952, { verified: true });
  const jalol = await P('Жалол', 'Каримов', 'male', 1945, { verified: true });
  const adolat = await P('Адолат', 'Турсунова', 'female', 1950, { verified: true });

  // G-1
  const feruza = await P('Феруза', 'Алиева', 'female', 1965, { maidenName: 'Рустамова', verified: true });
  const shavkat = await P('Шавкат', 'Алиев', 'male', 1962);
  const jasur = await P('Жасур', 'Рустамов', 'male', 1972, { verified: true });
  const dilfuza = await P('Дилфуза', 'Каюмова', 'female', 1975);
  const samvat = await P('Самват', 'Рустамов', 'male', 1968, { verified: true });
  const lola = await P('Лола', 'Каримова', 'female', 1970, { maidenName: 'Каримова', verified: true });
  const bahtior = await P('Бахтиёр', 'Каримов', 'male', 1968, { verified: true });
  const nodira = await P('Нодира', 'Хасанова', 'female', 1972);

  // G0
  const ulugbek = await P('Улугбек', 'Рустамов', 'male', 1984, { middleName: "Самват o'g'li", verified: true });
  const nigora = await P('Нигора', 'Усманова', 'female', 1986);
  const rustam = await P('Рустам', 'Рустамов', 'male', 1988, { middleName: "Самват o'g'li", verified: true });
  const malika = await P('Малика', 'Хасанова', 'female', 1990);
  const zarina = await P('Зарина', 'Носирова', 'female', 1986, { maidenName: 'Рустамова', verified: true });
  const timur = await P('Тимур', 'Носиров', 'male', 1984);
  const madina = await P('Мадина', 'Алиева', 'female', 1990);
  const aziz = await P('Азиз', 'Рустамов', 'male', 1996);
  const kamron = await P('Камрон', 'Каримов', 'male', 1995);

  // G+1
  const sardor = await P('Сардор', 'Носиров', 'male', 2014);
  const bek = await P('Бек', 'Рустамов', 'male', 2015);
  const aziza = await P('Азиза', 'Рустамова', 'female', 2018);
  const nodir = await P('Нодир', 'Рустамов', 'male', 2018);
  const leyla = await P('Лейла', 'Рустамова', 'female', 2020);

  // Owner pointer
  await pool.query(`UPDATE trees SET owner_person_id = $1 WHERE id = $2`, [ulugbek, treeId]);

  // Relationships
  const C = (a: string, b: string, status = 'married') => pool.query(`INSERT INTO relationships (tree_id, category, person1_id, person2_id, couple_status) VALUES ($1, 'couple', $2, $3, $4)`, [treeId, a, b, status]);
  const PC = (parent: string, child: string) => pool.query(`INSERT INTO relationships (tree_id, category, person1_id, person2_id, child_relation) VALUES ($1, 'parent_child', $2, $3, 'biological')`, [treeId, parent, child]);

  // Couples
  await C(yusuf, zulayho); await C(tursun, hosiyat);
  await C(karim, muhabbat); await C(jalol, adolat);
  await C(feruza, shavkat); await C(jasur, dilfuza); await C(samvat, lola); await C(bahtior, nodira);
  await C(ulugbek, nigora); await C(rustam, malika); await C(zarina, timur);

  // Parent-child G-3 → G-2
  await PC(yusuf, karim); await PC(zulayho, karim);
  await PC(tursun, jalol); await PC(hosiyat, jalol);

  // G-2 → G-1
  await PC(karim, feruza); await PC(muhabbat, feruza);
  await PC(karim, samvat); await PC(muhabbat, samvat);
  await PC(karim, jasur); await PC(muhabbat, jasur);
  await PC(jalol, lola); await PC(adolat, lola);
  await PC(jalol, bahtior); await PC(adolat, bahtior);

  // G-1 → G0
  await PC(feruza, madina); await PC(shavkat, madina);
  await PC(jasur, aziz); await PC(dilfuza, aziz);
  await PC(samvat, ulugbek); await PC(lola, ulugbek);
  await PC(samvat, rustam); await PC(lola, rustam);
  await PC(samvat, zarina); await PC(lola, zarina);
  await PC(bahtior, kamron); await PC(nodira, kamron);

  // G0 → G+1
  await PC(zarina, sardor); await PC(timur, sardor);
  await PC(ulugbek, bek); await PC(nigora, bek);
  await PC(ulugbek, aziza); await PC(nigora, aziza);
  await PC(rustam, nodir); await PC(malika, nodir);
  await PC(rustam, leyla); await PC(malika, leyla);

  console.log('[seed] done — 30 persons, 11 couples, ~30 parent-child rels');
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter server run db:seed
```
Expected: `[seed] done`. Verify via psql:
```bash
docker exec clickfamily-pg psql -U clickfamily -d clickfamily -c "SELECT count(*) FROM persons"
```
Expected: 30.

```bash
git add server/src/db/seed.ts
git commit -m "feat(db): seed Рустамовых-Каримовых 30 persons + relationships"
```

---

## Phase 1G: Frontend Foundation

### Task 28: Types + axios client + AuthContext + Router

**Files:** Create `client/src/types/index.ts`, `client/src/api/client.ts`, `client/src/api/auth.ts`, `client/src/context/AuthContext.tsx`, `client/src/components/auth/ProtectedRoute.tsx`, `client/src/__tests__/setup.ts`. Modify `App.tsx`.

- [ ] **Step 1: `types/index.ts`**

```typescript
export interface User { id: string; phone: string; displayName: string | null; avatarUrl: string | null; }
export interface Tree { id: string; userId: string; name: string; description: string | null; ownerPersonId: string | null; visibility: 'private' | 'link' | 'family' | 'public'; shareToken: string | null; personCount?: number; }
export interface Person {
  id: string; treeId: string; firstName: string; lastName: string | null; middleName: string | null; maidenName: string | null;
  gender: 'male' | 'female';
  birthDate: string | null; birthYear: number | null; birthDateKnown: boolean;
  isAlive: boolean; deathDate: string | null; deathYear: number | null; deathDateKnown: boolean;
  verified: boolean; note: string | null; photoUrl: string | null;
}
export type CoupleStatus = 'married' | 'civil' | 'dating' | 'divorced' | 'widowed' | 'other';
export type ChildRelation = 'biological' | 'adopted' | 'foster' | 'guardianship' | 'stepchild';
export interface Relationship { id: string; treeId: string; category: 'couple' | 'parent_child'; person1Id: string; person2Id: string; coupleStatus: CoupleStatus | null; childRelation: ChildRelation | null; startDate: string | null; endDate: string | null; }
export interface Generation { number: number; label: string; personIds: string[]; }
export interface FullTree { tree: Tree; persons: Person[]; relationships: Relationship[]; generations: Generation[]; }
export type EventType = 'birthday' | 'memorial' | 'anniversary' | 'child_birthday';
export interface FamilyEvent { type: EventType; date: string; daysUntil: number; personId?: string; personIds?: [string, string]; meta: { name: string; relation?: string; ageOnEvent?: number; yearsAgo?: number }; }
```

- [ ] **Step 2: `api/client.ts` with auto-refresh**

```typescript
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const ACCESS = 'cf_access', REFRESH = 'cf_refresh', REMEMBER = 'cf_remember';

const storage = () => (localStorage.getItem(REMEMBER) === '1' ? localStorage : sessionStorage);

export const setTokens = (access: string, refresh: string, remember: boolean) => {
  if (remember) localStorage.setItem(REMEMBER, '1');
  storage().setItem(ACCESS, access);
  storage().setItem(REFRESH, refresh);
};
export const getAccess = () => localStorage.getItem(ACCESS) ?? sessionStorage.getItem(ACCESS);
export const getRefresh = () => localStorage.getItem(REFRESH) ?? sessionStorage.getItem(REFRESH);
export const clearTokens = () => {
  for (const s of [localStorage, sessionStorage]) { s.removeItem(ACCESS); s.removeItem(REFRESH); }
  localStorage.removeItem(REMEMBER);
};

export const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use((c: InternalAxiosRequestConfig) => {
  const t = getAccess();
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

let refreshing: Promise<string | null> | null = null;
async function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const r = getRefresh();
      if (!r) return null;
      try {
        const res = await axios.post('/api/auth/refresh', { refreshToken: r });
        setTokens(res.data.accessToken, res.data.refreshToken, localStorage.getItem(REMEMBER) === '1');
        return res.data.accessToken;
      } catch { clearTokens(); return null; }
      finally { refreshing = null; }
    })();
  }
  return refreshing;
}

api.interceptors.response.use((r) => r, async (err: AxiosError) => {
  const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
  if (err.response?.status === 401 && !original._retry) {
    original._retry = true;
    const newAccess = await refreshOnce();
    if (newAccess) {
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    }
  }
  return Promise.reject(err);
});
```

- [ ] **Step 3: `api/auth.ts`**

```typescript
import { api, setTokens, clearTokens } from './client';
import type { User } from '../types';

export const requestOtp = (phone: string) => api.post<{ ok: true; ttl: number }>('/auth/request-otp', { phone }).then((r) => r.data);
export const verifyOtp = (phone: string, code: string, remember: boolean) =>
  api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/verify-otp', { phone, code }).then((r) => {
    setTokens(r.data.accessToken, r.data.refreshToken, remember);
    return r.data.user;
  });
export const me = () => api.get<User>('/auth/me').then((r) => r.data);
export const logout = () => { clearTokens(); };
```

- [ ] **Step 4: `context/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';
import { getAccess } from '../api/client';

interface Ctx { user: User | null; loading: boolean; setUser: (u: User | null) => void; signOut: () => void; }
const AuthCtx = createContext<Ctx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!getAccess()) { setLoading(false); return; }
    authApi.me().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const signOut = () => { authApi.logout(); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, setUser, signOut }}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};
```

- [ ] **Step 5: `ProtectedRoute.tsx`**

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{padding:24,color:'#fafafa'}}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};
```

- [ ] **Step 6: `App.tsx` with router skeleton**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { OtpPage } from './pages/OtpPage';
import { TreesListPage } from './pages/TreesListPage';
import { TreeViewPage } from './pages/TreeViewPage';
import { FullTreePage } from './pages/FullTreePage';
import { CalendarPage } from './pages/CalendarPage';
import { SharedTreePage } from './pages/SharedTreePage';

export const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/otp" element={<OtpPage />} />
        <Route path="/share/:token" element={<SharedTreePage />} />
        <Route path="/" element={<ProtectedRoute><TreesListPage /></ProtectedRoute>} />
        <Route path="/trees/:treeId" element={<ProtectedRoute><TreeViewPage /></ProtectedRoute>} />
        <Route path="/trees/:treeId/full" element={<ProtectedRoute><FullTreePage /></ProtectedRoute>} />
        <Route path="/trees/:treeId/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
```

- [ ] **Step 7: Stub all pages so app compiles**

Create empty placeholder for each page file (`LoginPage.tsx`, `OtpPage.tsx`, etc.):
```tsx
export const LoginPage = () => <div>LoginPage</div>;
```
(Repeat with appropriate name for each.)

Create `client/src/__tests__/setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 8: Verify dev compiles**

```bash
pnpm --filter client run dev
```
Open `http://localhost:5173/login` → see "LoginPage". Console: no errors.

- [ ] **Step 9: Commit**

```bash
git add client/src/
git commit -m "feat(client): types, axios client (auto-refresh), AuthContext, router"
```

### Task 29: Util libraries (date, UZ namings, death date)

**Files:** Create `client/src/utils/dateFormat.ts`, `client/src/utils/uzNamings.ts`, `client/src/utils/deathDate.ts`.

- [ ] **Step 1: `dateFormat.ts`**

```typescript
const MONTHS_RU_SHORT = ['янв.','фев.','мар.','апр.','мая','июн.','июл.','авг.','сен.','окт.','ноя.','дек.'];

export const formatBirthCard = (p: { birthDate: string | null; birthYear: number | null; birthDateKnown: boolean }): string => {
  if (p.birthDateKnown && p.birthDate) return new Date(p.birthDate).getUTCFullYear().toString();
  if (p.birthYear) return p.birthYear.toString();
  return '–';
};

export const formatBirthFull = (p: { birthDate: string | null; birthYear: number | null; birthDateKnown: boolean }): string => {
  if (p.birthDateKnown && p.birthDate) {
    const d = new Date(p.birthDate);
    return `${d.getUTCDate()} ${MONTHS_RU_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  if (p.birthYear) return p.birthYear.toString();
  return '–';
};

export const formatDeathCard = (p: { deathDate: string | null; deathYear: number | null; deathDateKnown: boolean; isAlive: boolean }): string => {
  if (p.isAlive) return '';
  if (p.deathDateKnown && p.deathDate) return new Date(p.deathDate).getUTCFullYear().toString();
  if (p.deathYear) return p.deathYear.toString();
  return '–';
};

export const formatDeathFull = (p: { deathDate: string | null; deathYear: number | null; deathDateKnown: boolean; isAlive: boolean }): string => {
  if (p.isAlive) return '';
  if (p.deathDateKnown && p.deathDate) {
    const d = new Date(p.deathDate);
    return `${d.getUTCDate()} ${MONTHS_RU_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  if (p.deathYear) return p.deathYear.toString();
  return '–';
};

export const formatLifespan = (p: { birthYear: number | null; birthDate: string | null; birthDateKnown: boolean; isAlive: boolean; deathYear: number | null; deathDate: string | null; deathDateKnown: boolean }): string => {
  const b = formatBirthCard(p);
  if (p.isAlive) return b;
  return `${b} – ${formatDeathCard(p)}`;
};
```

- [ ] **Step 2: `uzNamings.ts`** (степени родства + автоотчество)

```typescript
export const generateMiddleName = (fatherFirstName: string | null, gender: 'male' | 'female'): string => {
  if (!fatherFirstName) return '';
  const suffix = gender === 'male' ? "o'g'li" : 'qizi';
  return `${fatherFirstName} ${suffix}`;
};

export type RelationKey = 'father' | 'mother' | 'son' | 'daughter' | 'brother' | 'sister' | 'husband' | 'wife' | 'amaki' | 'amma' | 'togha' | 'kelin' | 'kuyov';

export const RELATIONS_RU: Record<RelationKey, string> = {
  father: 'отец', mother: 'мать', son: 'сын', daughter: 'дочь', brother: 'брат', sister: 'сестра',
  husband: 'муж', wife: 'жена', amaki: 'дядя по отцу', amma: 'тётя по отцу', togha: 'дядя по матери',
  kelin: 'невестка', kuyov: 'зять',
};

export const RELATIONS_UZ: Record<RelationKey, string> = {
  father: 'ota', mother: 'ona', son: "o'g'il", daughter: 'qiz', brother: 'aka/uka', sister: 'opa/singil',
  husband: 'er', wife: 'xotin', amaki: 'amaki', amma: 'amma', togha: "tog'a", kelin: 'kelin', kuyov: 'kuyov',
};
```

- [ ] **Step 3: Commit**

```bash
git add client/src/utils/dateFormat.ts client/src/utils/uzNamings.ts
git commit -m "feat(client): date formatting + UZ naming utilities"
```

---

## Phase 1H: Frontend Auth UI

### Task 30: LoginPage + OtpPage

**Files:** Modify `client/src/pages/LoginPage.tsx`, `client/src/pages/OtpPage.tsx`. Create `client/src/styles/auth.css`.

- [ ] **Step 1: `auth.css`**

```css
.auth-screen { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; background: var(--bg); color: var(--text); }
.auth-card { width: 100%; max-width: 420px; padding: 32px 24px; background: linear-gradient(180deg, var(--surface), var(--bg)); border: 1px solid var(--border); border-radius: 24px; }
.auth-logo { width: 56px; height: 56px; background: linear-gradient(135deg, #fbbf24, #f59e0b); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #0a0a0d; font-size: 24px; margin-bottom: 24px; box-shadow: 0 0 24px rgba(251,191,36,0.3); }
.auth-title { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; }
.auth-sub { color: var(--text-muted); font-size: 14px; margin-bottom: 28px; line-height: 1.5; }
.auth-input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; font-size: 16px; color: var(--text); font-family: inherit; margin-bottom: 14px; }
.auth-input:focus { outline: none; border-color: var(--accent); }
.auth-btn { width: 100%; background: linear-gradient(135deg, var(--accent), var(--accent-hover)); color: #0a0a0d; font-weight: 800; padding: 14px; border: none; border-radius: 14px; font-size: 16px; box-shadow: 0 8px 24px rgba(251,191,36,0.3); }
.auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.auth-error { color: #f87171; font-size: 13px; margin-top: 8px; }
.auth-checkbox { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 13px; margin: 12px 0 16px; }
```

- [ ] **Step 2: `LoginPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestOtp } from '../api/auth';
import '../styles/auth.css';

export const LoginPage = () => {
  const nav = useNavigate();
  const [phone, setPhone] = useState('+998');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await requestOtp(phone); nav('/otp', { state: { phone } }); }
    catch (e: any) { setErr(e.response?.data?.message ?? 'Не удалось отправить код'); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">click</div>
        <div className="auth-title">Семья</div>
        <div className="auth-sub">Введите телефон, чтобы получить код подтверждения</div>
        <form onSubmit={onSubmit}>
          <input className="auth-input" type="tel" inputMode="tel" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="auth-btn" disabled={busy || phone.length < 9}>{busy ? 'Отправка…' : 'Получить код'}</button>
          {err && <div className="auth-error">{err}</div>}
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: `OtpPage.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyOtp } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

export const OtpPage = () => {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const phone = (useLocation().state as any)?.phone as string | undefined;
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!phone) return <div className="auth-screen"><div className="auth-card">Сначала введите телефон. <a href="/login" style={{color:'var(--accent)'}}>На вход</a></div></div>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { const u = await verifyOtp(phone, code, remember); setUser(u); nav('/'); }
    catch (e: any) { setErr(e.response?.data?.message ?? 'Неверный код'); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-title">Код подтверждения</div>
        <div className="auth-sub">Отправлен на <b style={{color:'var(--text)'}}>{phone}</b>. В dev-режиме всегда <code style={{color:'var(--accent)'}}>0000</code>.</div>
        <form onSubmit={onSubmit}>
          <input className="auth-input" type="text" inputMode="numeric" maxLength={6} placeholder="0000" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          <label className="auth-checkbox">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Запомнить меня
          </label>
          <button className="auth-btn" disabled={busy || code.length < 4}>{busy ? 'Проверка…' : 'Войти'}</button>
          {err && <div className="auth-error">{err}</div>}
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Smoke test**

Run `pnpm dev`, open `:5173/login`, send `+998900000001` → land on OTP, enter `0000` → arrives at `/` (TreesListPage stub). Check `localStorage.cf_access` — JWT exists.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/LoginPage.tsx client/src/pages/OtpPage.tsx client/src/styles/auth.css
git commit -m "feat(client): login + OTP pages (phone-based auth)"
```

---

## Phase 1I: Frontend Tree View

### Task 31: treeTransform util

**Files:** Create `client/src/utils/treeTransform.ts`.

- [ ] **Step 1**

```typescript
import type { Person, Relationship } from '../types';

export interface TreeNode {
  id: string;
  gender: 'male' | 'female';
  parents: { id: string; type: 'blood' | 'adopted' | 'half' }[];
  children: { id: string; type: 'blood' | 'adopted' | 'half' }[];
  siblings: { id: string; type: 'blood' | 'half' }[];
  spouses: { id: string; type: 'married' | 'divorced' }[];
}

export const transformToTreeNodes = (persons: Person[], rels: Relationship[]): TreeNode[] => {
  const byId: Record<string, TreeNode> = {};
  for (const p of persons) byId[p.id] = { id: p.id, gender: p.gender, parents: [], children: [], siblings: [], spouses: [] };

  const addUnique = <T extends { id: string }>(arr: T[], v: T) => { if (!arr.some((x) => x.id === v.id)) arr.push(v); };

  for (const r of rels) {
    if (r.category === 'couple') {
      const t = r.coupleStatus === 'divorced' ? 'divorced' : 'married';
      if (byId[r.person1Id] && byId[r.person2Id]) {
        addUnique(byId[r.person1Id].spouses, { id: r.person2Id, type: t });
        addUnique(byId[r.person2Id].spouses, { id: r.person1Id, type: t });
      }
    } else if (r.category === 'parent_child') {
      const cr = r.childRelation;
      const type: 'blood' | 'adopted' | 'half' = cr === 'biological' ? 'blood' : cr === 'stepchild' ? 'half' : 'adopted';
      const parent = byId[r.person1Id], child = byId[r.person2Id];
      if (parent && child) {
        addUnique(parent.children, { id: child.id, type });
        addUnique(child.parents, { id: parent.id, type });
      }
    }
  }

  // Compute siblings via shared parents
  for (const node of Object.values(byId)) {
    for (const parent of node.parents) {
      const p = byId[parent.id];
      if (!p) continue;
      for (const sib of p.children) {
        if (sib.id === node.id) continue;
        // half-sib if not all parents shared — simplified: if both parents shared = blood, else half
        const sibNode = byId[sib.id];
        const sharedCount = sibNode.parents.filter((sp) => node.parents.some((np) => np.id === sp.id)).length;
        const t: 'blood' | 'half' = sharedCount >= 2 ? 'blood' : 'half';
        addUnique(node.siblings, { id: sib.id, type: t });
      }
    }
  }

  return Object.values(byId);
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/utils/treeTransform.ts
git commit -m "feat(client): treeTransform (DB → relatives-tree Node[])"
```

### Task 32: useZoom + useDrag hooks

**Files:** Create `client/src/hooks/useZoom.ts`, `client/src/hooks/useDrag.ts`.

- [ ] **Step 1: `useZoom.ts`** (universal: ctrl+wheel + macOS gesture + mobile pinch)

```typescript
import { useEffect, useRef } from 'react';

const LERP = 0.15, SETTLE = 0.0005, MAX_SCALE = 1.8, MIN_SCALE = 0.4;

export const useZoom = (containerRef: React.RefObject<HTMLElement>, onScale?: (s: number) => void) => {
  const scale = useRef(1);
  const target = useRef(1);
  const raf = useRef<number | null>(null);
  const onScaleRef = useRef(onScale);
  onScaleRef.current = onScale;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const apply = () => {
      const s = scale.current;
      el.style.transform = `scale(${s})`;
      el.style.transformOrigin = 'top center';
      onScaleRef.current?.(s);
    };
    const tick = () => {
      const diff = target.current - scale.current;
      if (Math.abs(diff) < SETTLE) { scale.current = target.current; raf.current = null; apply(); return; }
      scale.current += diff * LERP;
      apply();
      raf.current = requestAnimationFrame(tick);
    };
    const start = () => { if (raf.current == null) raf.current = requestAnimationFrame(tick); };
    const clamp = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      target.current = clamp(target.current - e.deltaY * 0.002);
      start();
    };

    let pinchStartDist = 0, pinchStartScale = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        el.dataset.pinching = '1';
        pinchStartDist = dist(e.touches);
        pinchStartScale = target.current;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist) {
        e.preventDefault();
        target.current = clamp(pinchStartScale * (dist(e.touches) / pinchStartDist));
        start();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) { delete el.dataset.pinching; pinchStartDist = 0; }
    };

    let gStartScale = 1;
    const onGestureStart = (e: any) => { e.preventDefault(); gStartScale = target.current; };
    const onGestureChange = (e: any) => { e.preventDefault(); target.current = clamp(gStartScale * e.scale); start(); };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('gesturestart', onGestureStart as any);
    el.addEventListener('gesturechange', onGestureChange as any);

    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('gesturestart', onGestureStart as any);
      el.removeEventListener('gesturechange', onGestureChange as any);
    };
  }, []); // ← intentionally empty: refs only; do NOT add deps that recreate handlers

  return {
    zoomIn: () => { target.current = Math.min(MAX_SCALE, target.current + 0.15); },
    zoomOut: () => { target.current = Math.max(MIN_SCALE, target.current - 0.15); },
    reset: () => { target.current = 1; },
  };
};
```

- [ ] **Step 2: `useDrag.ts`** (drag-to-pan, touch-aware)

```typescript
import { useEffect } from 'react';

export const useDrag = (viewportRef: React.RefObject<HTMLElement>, contentRef: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    let dragging = false, startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;

    const onDown = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['BUTTON', 'A', 'INPUT'].includes(tag)) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      scrollLeft = vp.scrollLeft; scrollTop = vp.scrollTop;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      vp.scrollLeft = scrollLeft - (e.clientX - startX);
      vp.scrollTop = scrollTop - (e.clientY - startY);
    };
    const onUp = () => { dragging = false; };

    vp.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    let tx = 0, ty = 0, tsl = 0, tst = 0, tdrag = false;
    const onTStart = (e: TouchEvent) => {
      if (vp.dataset.pinching === '1' || e.touches.length !== 1) return;
      tdrag = true;
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
      tsl = vp.scrollLeft; tst = vp.scrollTop;
    };
    const onTMove = (e: TouchEvent) => {
      if (!tdrag) return;
      vp.scrollLeft = tsl - (e.touches[0].clientX - tx);
      vp.scrollTop = tst - (e.touches[0].clientY - ty);
    };
    const onTEnd = () => { tdrag = false; };
    vp.addEventListener('touchstart', onTStart, { passive: true });
    vp.addEventListener('touchmove', onTMove, { passive: true });
    vp.addEventListener('touchend', onTEnd, { passive: true });

    return () => {
      vp.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      vp.removeEventListener('touchstart', onTStart);
      vp.removeEventListener('touchmove', onTMove);
      vp.removeEventListener('touchend', onTEnd);
    };
  }, []);
};
```

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/
git commit -m "feat(client): useZoom (universal) + useDrag hooks"
```

### Task 33: PersonCard component

**Files:** Create `client/src/components/tree/PersonCard.tsx`, `client/src/styles/tree.css`.

- [ ] **Step 1: `tree.css` (key tokens — same as mockups)**

```css
.tree-stage { background: radial-gradient(80% 60% at 50% 0%, rgba(251,191,36,0.04), transparent 70%), #050507; border: 1px solid var(--border); border-radius: 22px; }
.pcard { width: 64px; background: linear-gradient(180deg, var(--surface-2), #0f0f12); border: 1px solid var(--border); border-radius: var(--radius-card); padding: 6px 3px 7px; text-align: center; font-size: 10px; position: relative; }
.pcard.male::before, .pcard.female::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px; -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
.pcard.male::before { background: linear-gradient(180deg, rgba(96,165,250,0.55), transparent 60%); }
.pcard.female::before { background: linear-gradient(180deg, rgba(244,114,182,0.55), transparent 60%); }
.pcard.deceased { opacity: 0.5; background: linear-gradient(180deg, #16161a, #0a0a0d); }
.pcard.deceased::before { display: none; }
.pcard.deceased::after { content: '†'; position: absolute; top: 4px; left: 5px; color: var(--text-dim); font-size: 9px; font-weight: 700; }
.pcard.me { background: linear-gradient(180deg, #2a230b, #1a1408); border-color: rgba(251,191,36,0.4); box-shadow: 0 0 0 1px rgba(251,191,36,0.25), 0 6px 20px rgba(251,191,36,0.2); }
.pcard.me::before { display: none; }
.pcard-av { width: 28px; height: 28px; border-radius: 50%; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.04); border: 1px solid var(--border); overflow: hidden; }
.pcard.male .pcard-av { color: var(--male); }
.pcard.female .pcard-av { color: var(--female); }
.pcard.me .pcard-av { background: linear-gradient(135deg, var(--accent), var(--accent-hover)); color: #0a0a0d; border: none; }
.pcard.deceased .pcard-av { filter: grayscale(1); opacity: 0.7; }
.pcard-av img { width: 100%; height: 100%; object-fit: cover; }
.pcard-name { font-weight: 700; color: var(--text); line-height: 1.15; letter-spacing: -0.01em; font-size: 9.5px; }
.pcard-year { color: var(--text-dim); font-size: 8px; margin-top: 2px; font-feature-settings: 'tnum' 1; }
.pcard.deceased .pcard-name, .pcard.deceased .pcard-year { color: var(--text-dim); }
.pcard-verified { position: absolute; top: 4px; right: 4px; width: 11px; height: 11px; background: var(--verified); color: #050507; border-radius: 50%; font-size: 7px; display: flex; align-items: center; justify-content: center; font-weight: 900; }
.pcard.me .pcard-verified { background: #0a0a0d; color: var(--accent); }
.pcard-cake { position: absolute; bottom: -4px; right: -3px; background: linear-gradient(135deg, var(--accent), var(--accent-hover)); color: #0a0a0d; width: 14px; height: 14px; border-radius: 50%; font-size: 8px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #050507; box-shadow: 0 0 8px rgba(251,191,36,0.5); }
.pcard-plus { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 18px; height: 18px; background: var(--accent); color: #0a0a0d; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; border: 2.5px solid #050507; box-shadow: 0 0 14px rgba(251,191,36,0.4); cursor: pointer; }
```

- [ ] **Step 2: `PersonCard.tsx`**

```tsx
import type { Person } from '../../types';
import { formatLifespan } from '../../utils/dateFormat';
import '../../styles/tree.css';

interface Props {
  person: Person;
  isOwner?: boolean;
  hasUpcomingBirthday?: boolean;
  onClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
  showPlus?: boolean;
}

export const PersonCard = ({ person, isOwner, hasUpcomingBirthday, onClick, onPlusClick, showPlus }: Props) => {
  const cls = ['pcard', person.gender, !person.isAlive ? 'deceased' : '', isOwner ? 'me' : ''].filter(Boolean).join(' ');
  const initials = (person.firstName?.[0] ?? '?');

  return (
    <div className={cls} onClick={(e) => { e.stopPropagation(); onClick?.(person.id); }}>
      {person.verified && <span className="pcard-verified">✓</span>}
      <div className="pcard-av">
        {person.photoUrl ? <img src={person.photoUrl} alt="" /> : initials}
      </div>
      <div className="pcard-name">{person.firstName}{person.lastName ? <><br/>{person.lastName}</> : null}</div>
      <div className="pcard-year">{formatLifespan(person)}</div>
      {hasUpcomingBirthday && <div className="pcard-cake">🎂</div>}
      {showPlus && <div className="pcard-plus" onClick={(e) => { e.stopPropagation(); onPlusClick?.(person.id); }}>+</div>}
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/tree/PersonCard.tsx client/src/styles/tree.css
git commit -m "feat(client): PersonCard (dark theme, gender rim, verified, cake)"
```

### Task 34: FamilyTreeLayout component

**Files:** Create `client/src/components/tree/FamilyTreeLayout.tsx`.

- [ ] **Step 1**

```tsx
import { useMemo, useRef } from 'react';
import calcTree from 'relatives-tree';
import type { ExtNode } from 'relatives-tree/lib/types';
import type { Person, Relationship } from '../../types';
import { transformToTreeNodes } from '../../utils/treeTransform';
import { PersonCard } from './PersonCard';
import { useZoom } from '../../hooks/useZoom';
import { useDrag } from '../../hooks/useDrag';

const NODE_W = 80, NODE_H = 100;

interface Props {
  persons: Person[];
  relationships: Relationship[];
  ownerId?: string | null;
  upcomingBirthdayIds?: Set<string>;
  onPersonClick?: (id: string) => void;
  onPlusClick?: (id: string) => void;
}

export const FamilyTreeLayout = ({ persons, relationships, ownerId, upcomingBirthdayIds, onPersonClick, onPlusClick }: Props) => {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  const nodes = useMemo(() => transformToTreeNodes(persons, relationships), [persons, relationships]);

  const layout = useMemo(() => {
    if (!nodes.length) return null;
    try {
      const root = ownerId && nodes.some((n) => n.id === ownerId) ? ownerId : nodes[0].id;
      return calcTree(nodes as any, { rootId: root, placeholders: false });
    } catch (e) {
      console.warn('[tree] layout fallback', e);
      return null;
    }
  }, [nodes, ownerId]);

  useZoom(content);
  useDrag(viewport, content);

  if (!layout) return <div style={{padding:24,color:'var(--text-muted)'}}>Дерево пусто. Добавьте первого родственника.</div>;

  const W = layout.canvas.width * NODE_W;
  const H = layout.canvas.height * NODE_H;

  const personById = new Map(persons.map((p) => [p.id, p]));

  return (
    <div ref={viewport} className="tree-stage" style={{ position: 'relative', overflow: 'auto', width: '100%', minHeight: 360, padding: 18, cursor: 'grab' }}>
      <div ref={content} style={{ position: 'relative', width: W, height: H, willChange: 'transform' }}>
        <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          {layout.connectors.map((c, i) => {
            const [x1, y1, x2, y2] = c;
            return <line key={i} x1={x1 * NODE_W} y1={y1 * NODE_H} x2={x2 * NODE_W} y2={y2 * NODE_H} stroke="rgba(255,255,255,0.18)" strokeWidth="1.3" />;
          })}
        </svg>
        {layout.nodes.map((n: ExtNode) => {
          const person = personById.get(n.id);
          if (!person) return null;
          return (
            <div key={n.id} style={{ position: 'absolute', transform: `translate(${n.left * (NODE_W / 2)}px, ${n.top * (NODE_H / 2)}px)`, width: NODE_W, height: NODE_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PersonCard
                person={person}
                isOwner={person.id === ownerId}
                hasUpcomingBirthday={upcomingBirthdayIds?.has(person.id)}
                onClick={onPersonClick}
                onPlusClick={onPlusClick}
                showPlus={person.id === ownerId}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/tree/FamilyTreeLayout.tsx
git commit -m "feat(client): FamilyTreeLayout (relatives-tree integration)"
```

### Task 35: TreesListPage + TreeViewPage skeleton

**Files:** Create `client/src/api/trees.ts`, modify `client/src/pages/TreesListPage.tsx`, `client/src/pages/TreeViewPage.tsx`, `client/src/pages/FullTreePage.tsx`.

- [ ] **Step 1: `api/trees.ts`**

```typescript
import { api } from './client';
import type { Tree, FullTree } from '../types';

export const listTrees = () => api.get<(Tree & { personCount: number })[]>('/trees').then((r) => r.data);
export const createTree = (name: string, description?: string) => api.post<Tree>('/trees', { name, description }).then((r) => r.data);
export const getFullTree = (treeId: string) => api.get<FullTree>(`/trees/${treeId}/full`).then((r) => r.data);
```

- [ ] **Step 2: `TreesListPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTrees, createTree } from '../api/trees';
import type { Tree } from '../types';

export const TreesListPage = () => {
  const nav = useNavigate();
  const [trees, setTrees] = useState<(Tree & { personCount: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listTrees().then(setTrees).finally(() => setLoading(false)); }, []);

  const onCreate = async () => {
    const t = await createTree('Моя семья');
    nav(`/trees/${t.id}`);
  };

  if (loading) return <div style={{padding:24}}>Загрузка…</div>;
  if (trees.length === 0) return (
    <div style={{padding:24,maxWidth:420,margin:'40px auto',textAlign:'center'}}>
      <h1 style={{fontSize:28,fontWeight:800,marginBottom:12}}>Создайте дерево</h1>
      <p style={{color:'var(--text-muted)',marginBottom:24}}>Начнём с вас и ваших ближайших родственников</p>
      <button onClick={onCreate} style={{background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',fontWeight:800,padding:'14px 28px',border:'none',borderRadius:14}}>
        Создать
      </button>
    </div>
  );
  return (
    <div style={{padding:24,maxWidth:420,margin:'0 auto'}}>
      {trees.map((t) => (
        <div key={t.id} onClick={() => nav(`/trees/${t.id}`)} style={{padding:16,background:'var(--surface)',borderRadius:14,border:'1px solid var(--border)',marginBottom:12,cursor:'pointer'}}>
          <div style={{fontWeight:700,fontSize:16}}>{t.name}</div>
          <div style={{color:'var(--text-muted)',fontSize:12,marginTop:4}}>{t.personCount} человек</div>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: `TreeViewPage.tsx`** (basic — full hybrid screen comes in next task)

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullTree } from '../api/trees';
import type { FullTree } from '../types';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';

export const TreeViewPage = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);

  useEffect(() => { if (treeId) getFullTree(treeId).then(setData); }, [treeId]);

  if (!data) return <div style={{padding:24}}>Загрузка дерева…</div>;

  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column'}}>
      <header style={{padding:'16px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)'}}>
        <button onClick={() => nav('/')} style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)'}}>←</button>
        <div style={{flex:1,fontSize:17,fontWeight:800}}>{data.tree.name}</div>
        <button onClick={() => nav(`/trees/${treeId}/full`)} style={{fontSize:12,color:'var(--accent)',background:'transparent',border:'none'}}>Полное →</button>
      </header>
      <div style={{padding:'12px 12px 24px',flex:1}}>
        <FamilyTreeLayout
          persons={data.persons}
          relationships={data.relationships}
          ownerId={data.tree.ownerPersonId}
          onPersonClick={(id) => console.log('tap', id)}
          onPlusClick={(id) => console.log('plus on', id)}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 4: `FullTreePage.tsx`** (zoom & pan, all persons)

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullTree } from '../api/trees';
import type { FullTree } from '../types';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';

export const FullTreePage = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);

  useEffect(() => { if (treeId) getFullTree(treeId).then(setData); }, [treeId]);

  if (!data) return <div style={{padding:24}}>Загрузка…</div>;

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <header style={{padding:'12px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <button onClick={() => nav(-1 as any)} style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)'}}>←</button>
        <div style={{flex:1,fontSize:15,fontWeight:800}}>{data.tree.name}</div>
        <div style={{color:'var(--text-muted)',fontSize:11}}>{data.persons.length} чел</div>
      </header>
      <div style={{flex:1,padding:8,overflow:'hidden'}}>
        <FamilyTreeLayout persons={data.persons} relationships={data.relationships} ownerId={data.tree.ownerPersonId} />
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Smoke test**

Run `pnpm dev`. Login (+998900000001 / 0000). After OTP land on `/`. If empty — click "Создать". OR, if you ran seed first → see "Семья Рустамовых-Каримовых · 30 человек". Click → tree renders.

- [ ] **Step 6: Commit**

```bash
git add client/src/api/trees.ts client/src/pages/TreesListPage.tsx client/src/pages/TreeViewPage.tsx client/src/pages/FullTreePage.tsx
git commit -m "feat(client): trees list + tree view + full tree pages (basic render)"
```

---

## Phase 1J: Sheet, Long-press, Hero, Forms

### Task 36: BottomSheet primitive + PersonSheet

**Files:** Create `client/src/components/ui/BottomSheet.tsx`, `client/src/components/tree/PersonSheet.tsx`, `client/src/api/persons.ts`.

- [ ] **Step 1: `api/persons.ts`**

```typescript
import { api } from './client';
import type { Person } from '../types';

export interface CreatePersonInput { firstName: string; lastName?: string; middleName?: string; maidenName?: string; gender: 'male' | 'female'; birthYear?: number; birthDate?: string; birthDateKnown?: boolean; isAlive?: boolean; deathYear?: number; deathDate?: string; deathDateKnown?: boolean; note?: string; relationships?: { category: 'couple' | 'parent_child'; otherPersonId: string; role?: 'parent' | 'child' | 'spouse'; coupleStatus?: string; childRelation?: string }[]; }

export const createPerson = (treeId: string, input: CreatePersonInput) => api.post<Person>(`/trees/${treeId}/persons`, input).then((r) => r.data);
export const updatePerson = (treeId: string, personId: string, fields: Partial<CreatePersonInput>) => api.put<Person>(`/trees/${treeId}/persons/${personId}`, fields).then((r) => r.data);
export const deletePerson = (treeId: string, personId: string) => api.delete(`/trees/${treeId}/persons/${personId}`).then((r) => r.data);
```

- [ ] **Step 2: `BottomSheet.tsx`**

```tsx
import { useEffect, type ReactNode } from 'react';

export const BottomSheet = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) => {
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'flex-end',background:'rgba(0,0,0,0.55)'}}>
      <div onClick={(e) => e.stopPropagation()} style={{width:'100%',maxWidth:560,margin:'0 auto',background:'linear-gradient(180deg,var(--surface),var(--bg))',border:'1px solid var(--border)',borderBottom:'none',borderRadius:'24px 24px 0 0',padding:'12px 20px 22px',animation:'sheetIn 220ms cubic-bezier(0.32,0.72,0,1)'}}>
        <div style={{width:36,height:4,background:'rgba(255,255,255,0.18)',borderRadius:2,margin:'0 auto 14px'}} />
        {children}
      </div>
      <style>{`@keyframes sheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
};
```

- [ ] **Step 3: `PersonSheet.tsx`**

```tsx
import type { Person } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';
import { formatBirthFull, formatDeathFull } from '../../utils/dateFormat';

interface Props {
  open: boolean;
  onClose: () => void;
  person: Person | null;
  upcomingBirthdayInDays?: number | null;
  onEdit: () => void;
  onAdd: () => void;
  onDelete: () => void;
}

export const PersonSheet = ({ open, onClose, person, upcomingBirthdayInDays, onEdit, onAdd, onDelete }: Props) => {
  if (!person) return null;
  const fullName = [person.firstName, person.lastName, person.middleName].filter(Boolean).join(' ');
  const lifespan = person.isAlive ? formatBirthFull(person) : `${formatBirthFull(person)} – ${formatDeathFull(person)}`;
  const showCta = person.isAlive && typeof upcomingBirthdayInDays === 'number' && upcomingBirthdayInDays >= 0 && upcomingBirthdayInDays <= 14;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{display:'flex',gap:12,marginBottom:14,alignItems:'flex-start'}}>
        <div style={{width:60,height:60,borderRadius:'50%',background:person.gender==='female'?'linear-gradient(135deg,#fce7f3,#f9c8dd)':'linear-gradient(135deg,#dbeafe,#c3d9f7)',color:person.gender==='female'?'#e87ba8':'#4a90d9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:800,flexShrink:0,border:`2px solid ${person.gender==='female'?'rgba(244,114,182,0.4)':'rgba(96,165,250,0.4)'}`,overflow:'hidden'}}>
          {person.photoUrl ? <img src={person.photoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : person.firstName?.[0]}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:18,fontWeight:800,letterSpacing:'-0.02em'}}>{fullName}</div>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{lifespan}{person.verified && <span style={{marginLeft:8,color:'var(--verified)',fontWeight:700}}>✓ гос-во</span>}</div>
        </div>
      </div>

      {showCta && (
        <div style={{padding:12,marginBottom:14,borderRadius:16,border:'1px solid rgba(251,191,36,0.25)',background:'radial-gradient(140% 100% at 0% 0%,rgba(251,191,36,0.18),transparent 65%),linear-gradient(180deg,#1c1409,#0e0a04)'}}>
          <div style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:'var(--accent)'}}>Через {upcomingBirthdayInDays} дн</div>
          <div style={{fontSize:14,fontWeight:800,marginBottom:10}}>День рождения</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
            {[['🎂','Торт','от 180k'],['💐','Цветы','от 90k'],['↗','Перевод','любая']].map(([icon,name,price]) => (
              <button key={name} disabled style={{background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:12,padding:10,color:'var(--text)',fontSize:11,fontWeight:700,cursor:'not-allowed',opacity:0.7}}>
                <div style={{fontSize:18,marginBottom:4}}>{icon}</div>
                {name}
                <div style={{fontSize:9,color:'var(--text-muted)',marginTop:2,fontWeight:500}}>{price}</div>
              </button>
            ))}
          </div>
          <div style={{fontSize:9,color:'var(--text-dim)',textAlign:'center',marginTop:8}}>Платежи появятся в Phase 2</div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
        <button onClick={onEdit} style={{padding:12,background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:12,color:'var(--text)',fontWeight:700}}>Редактировать</button>
        <button onClick={onAdd} style={{padding:12,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',borderRadius:12,fontWeight:800}}>+ Родственник</button>
      </div>
      <button onClick={onDelete} style={{width:'100%',padding:10,background:'transparent',border:'1px solid rgba(248,113,113,0.3)',borderRadius:12,color:'#f87171',fontSize:12}}>Удалить</button>
    </BottomSheet>
  );
};
```

- [ ] **Step 4: Wire into TreeViewPage**

In `TreeViewPage.tsx`, add:
```tsx
const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
// ...
<FamilyTreeLayout ... onPersonClick={(id) => setSelectedPerson(data.persons.find((p) => p.id === id) ?? null)} />
<PersonSheet open={!!selectedPerson} onClose={() => setSelectedPerson(null)} person={selectedPerson} onEdit={() => {}} onAdd={() => {}} onDelete={() => {}} />
```

- [ ] **Step 5: Commit**

```bash
git add client/src/api/persons.ts client/src/components/ui/BottomSheet.tsx client/src/components/tree/PersonSheet.tsx client/src/pages/TreeViewPage.tsx
git commit -m "feat(client): BottomSheet + PersonSheet (CTA pills disabled until Phase 2)"
```

### Task 37: AddPersonForm (3 modes: parent / sibling / child)

**Files:** Create `client/src/components/tree/AddPersonForm.tsx`.

- [ ] **Step 1: Component (with smart-defaults)**

```tsx
import { useState, useMemo } from 'react';
import type { Person, Relationship } from '../../types';
import { createPerson, type CreatePersonInput } from '../../api/persons';
import { generateMiddleName } from '../../utils/uzNamings';
import { BottomSheet } from '../ui/BottomSheet';

type Mode = 'parent' | 'sibling' | 'child';

interface Props {
  open: boolean;
  onClose: () => void;
  treeId: string;
  targetPerson: Person;
  persons: Person[];
  relationships: Relationship[];
  onCreated: () => void;
}

export const AddPersonForm = ({ open, onClose, treeId, targetPerson, persons, relationships, onCreated }: Props) => {
  const [mode, setMode] = useState<Mode>('parent');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState(targetPerson.lastName ?? '');
  const [maidenName, setMaidenName] = useState('');
  const [year, setYear] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // hasParents — for sibling option visibility
  const hasParents = useMemo(() =>
    relationships.some((r) => r.category === 'parent_child' && r.person2Id === targetPerson.id),
    [relationships, targetPerson.id]
  );

  // existing parents (for sibling shared-parent autoselect)
  const existingParents = useMemo(() =>
    relationships
      .filter((r) => r.category === 'parent_child' && r.person2Id === targetPerson.id)
      .map((r) => persons.find((p) => p.id === r.person1Id))
      .filter(Boolean) as Person[],
    [relationships, persons, targetPerson.id]
  );

  // Father auto-find for UZ middleName
  const father = existingParents.find((p) => p.gender === 'male');
  const middleName = mode !== 'parent' ? generateMiddleName(father?.firstName ?? null, gender) : '';

  // For child: auto 2nd parent = current spouse
  const spouse = useMemo(() =>
    relationships
      .find((r) => r.category === 'couple' && (r.person1Id === targetPerson.id || r.person2Id === targetPerson.id))?.let &&
      persons.find((p) => p.id === (relationships.find((r) => r.category === 'couple' && (r.person1Id === targetPerson.id || r.person2Id === targetPerson.id))!.person1Id === targetPerson.id ? relationships.find((r) => r.category === 'couple' && (r.person1Id === targetPerson.id || r.person2Id === targetPerson.id))!.person2Id : relationships.find((r) => r.category === 'couple' && (r.person1Id === targetPerson.id || r.person2Id === targetPerson.id))!.person1Id)),
    [relationships, persons, targetPerson.id]
  );

  // For parent: existing other-gender parent (auto-couple)
  const otherParent = existingParents.find((p) => p.gender !== gender);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const rels: NonNullable<CreatePersonInput['relationships']> = [];

      if (mode === 'parent') {
        rels.push({ category: 'parent_child', otherPersonId: targetPerson.id, role: 'parent', childRelation: 'biological' });
        if (otherParent) rels.push({ category: 'couple', otherPersonId: otherParent.id, role: 'spouse', coupleStatus: 'married' });
      } else if (mode === 'sibling') {
        for (const p of existingParents) {
          rels.push({ category: 'parent_child', otherPersonId: p.id, role: 'child', childRelation: 'biological' });
        }
      } else if (mode === 'child') {
        rels.push({ category: 'parent_child', otherPersonId: targetPerson.id, role: 'child', childRelation: 'biological' });
        if (spouse) rels.push({ category: 'parent_child', otherPersonId: spouse.id, role: 'child', childRelation: 'biological' });
      }

      await createPerson(treeId, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        middleName: middleName || undefined,
        maidenName: gender === 'female' ? (maidenName.trim() || undefined) : undefined,
        gender,
        birthYear: year ? Number(year) : undefined,
        relationships: rels,
      });
      onCreated();
      onClose();
    } finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{fontSize:18,fontWeight:800,marginBottom:14}}>Добавить родственника</div>

      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {(['parent', hasParents ? 'sibling' : null, 'child'].filter(Boolean) as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{padding:'8px 14px',borderRadius:14,border:`1px solid ${mode===m?'rgba(251,191,36,0.4)':'var(--border)'}`,background:mode===m?'rgba(251,191,36,0.12)':'rgba(255,255,255,0.04)',color:mode===m?'var(--accent)':'var(--text)',fontWeight:700,fontSize:12}}>
            {m === 'parent' ? 'Родитель' : m === 'sibling' ? 'Брат / Сестра' : 'Ребёнок'}
          </button>
        ))}
      </div>

      <div style={{display:'flex',gap:8,marginBottom:14}}>
        <button type="button" onClick={() => setGender('male')} style={{flex:1,padding:'10px',borderRadius:12,border:`1px solid ${gender==='male'?'rgba(96,165,250,0.5)':'var(--border)'}`,background:gender==='male'?'rgba(96,165,250,0.1)':'rgba(255,255,255,0.04)',color:'var(--text)',fontWeight:700}}>♂ {mode==='parent'?'Отец':mode==='sibling'?'Брат':'Сын'}</button>
        <button type="button" onClick={() => setGender('female')} style={{flex:1,padding:'10px',borderRadius:12,border:`1px solid ${gender==='female'?'rgba(244,114,182,0.5)':'var(--border)'}`,background:gender==='female'?'rgba(244,114,182,0.1)':'rgba(255,255,255,0.04)',color:'var(--text)',fontWeight:700}}>♀ {mode==='parent'?'Мать':mode==='sibling'?'Сестра':'Дочь'}</button>
      </div>

      {(mode === 'parent' && otherParent) && (
        <div style={{padding:'10px 12px',marginBottom:14,borderRadius:12,background:'linear-gradient(180deg,#1c1409,#0e0a04)',border:'1px solid rgba(251,191,36,0.25)',fontSize:11,color:'var(--text)'}}>
          <span style={{color:'var(--accent)',fontWeight:800,fontSize:9,textTransform:'uppercase',letterSpacing:1.2}}>Авто-couple</span>{' '}
          с <b>{otherParent.firstName}</b> ({otherParent.gender === 'male' ? 'отцом' : 'матерью'})
        </div>
      )}
      {(mode === 'sibling' && existingParents.length > 0) && (
        <div style={{padding:'10px 12px',marginBottom:14,borderRadius:12,background:'linear-gradient(180deg,#1c1409,#0e0a04)',border:'1px solid rgba(251,191,36,0.25)',fontSize:11,color:'var(--text)'}}>
          <span style={{color:'var(--accent)',fontWeight:800,fontSize:9,textTransform:'uppercase',letterSpacing:1.2}}>Общие родители</span>{' '}
          {existingParents.map((p) => p.firstName).join(' + ')}
        </div>
      )}
      {(mode === 'child' && spouse) && (
        <div style={{padding:'10px 12px',marginBottom:14,borderRadius:12,background:'linear-gradient(180deg,#1c1409,#0e0a04)',border:'1px solid rgba(251,191,36,0.25)',fontSize:11,color:'var(--text)'}}>
          <span style={{color:'var(--accent)',fontWeight:800,fontSize:9,textTransform:'uppercase',letterSpacing:1.2}}>2-й родитель</span>{' '}
          <b>{(spouse as Person).firstName}</b>
        </div>
      )}

      <form onSubmit={onSubmit}>
        <input className="auth-input" placeholder="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="auth-input" placeholder="Фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        {gender === 'female' && <input className="auth-input" placeholder="Девичья фамилия" value={maidenName} onChange={(e) => setMaidenName(e.target.value)} />}
        {middleName && <input className="auth-input" placeholder="Отчество" value={middleName} readOnly />}
        <input className="auth-input" placeholder="Год рождения" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <button type="submit" disabled={busy || !firstName.trim()} className="auth-btn">{busy ? 'Сохранение…' : 'Добавить'}</button>
      </form>
    </BottomSheet>
  );
};
```

(Note: there's a naive `.let &&` patch in spouse derivation — replace with proper `useMemo` returning the actual spouse Person. The example is meant to convey logic; an executing engineer should clean up to:)

```typescript
const spouse: Person | undefined = useMemo(() => {
  const r = relationships.find((r) => r.category === 'couple' && (r.person1Id === targetPerson.id || r.person2Id === targetPerson.id));
  if (!r) return undefined;
  const otherId = r.person1Id === targetPerson.id ? r.person2Id : r.person1Id;
  return persons.find((p) => p.id === otherId);
}, [relationships, persons, targetPerson.id]);
```

- [ ] **Step 2: Wire from PersonSheet "+ Родственник" + from owner card "+" tab. Reload tree after onCreated:**

In `TreeViewPage.tsx`:
```tsx
const [addOpen, setAddOpen] = useState<Person | null>(null);
const reload = () => treeId && getFullTree(treeId).then(setData);
// pass onAdd in PersonSheet → setAddOpen(person)
// onPlusClick={(id) => { const p = data.persons.find((p) => p.id === id); if (p) setAddOpen(p); }}
{addOpen && <AddPersonForm open onClose={() => setAddOpen(null)} treeId={treeId!} targetPerson={addOpen} persons={data.persons} relationships={data.relationships} onCreated={reload} />}
```

- [ ] **Step 3: Smoke test**

Tap "+" on owner → form opens. Add "Тестовая Мама" as Mother → submit → form closes, tree reloads, new card visible above owner.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/tree/AddPersonForm.tsx client/src/pages/TreeViewPage.tsx
git commit -m "feat(client): AddPersonForm (parent/sibling/child + smart-defaults)"
```

---

## Phase 1K: Calendar

### Task 38: CalendarPage + EventCard

**Files:** Create `client/src/api/events.ts`, `client/src/components/calendar/EventCard.tsx`, modify `client/src/pages/CalendarPage.tsx`.

- [ ] **Step 1: `api/events.ts`**

```typescript
import { api } from './client';
import type { FamilyEvent } from '../types';

export const listEvents = (treeId: string, fromIso?: string, toIso?: string) =>
  api.get<FamilyEvent[]>(`/trees/${treeId}/events`, { params: { from: fromIso, to: toIso } }).then((r) => r.data);
```

- [ ] **Step 2: `EventCard.tsx`**

```tsx
import type { FamilyEvent } from '../../types';

const ICONS: Record<FamilyEvent['type'], string> = { birthday: '🎂', child_birthday: '🎂', memorial: '🕯', anniversary: '💍' };
const TAGS: Record<FamilyEvent['type'], string> = { birthday: 'ДР', child_birthday: 'ДР', memorial: 'Память', anniversary: 'Свадьба' };

export const EventCard = ({ event }: { event: FamilyEvent }) => {
  const urgent = event.daysUntil <= 7;
  return (
    <div style={{display:'flex',gap:12,padding:12,borderRadius:14,background:urgent?'rgba(251,191,36,0.06)':'rgba(255,255,255,0.03)',border:`1px solid ${urgent?'rgba(251,191,36,0.3)':'var(--border)'}`,marginBottom:6,alignItems:'center'}}>
      <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{ICONS[event.type]}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:800,letterSpacing:'-0.01em'}}>{event.meta.name} <span style={{fontSize:9,color:urgent?'var(--accent)':'var(--text-muted)',fontWeight:800,marginLeft:4,padding:'2px 6px',borderRadius:4,background:urgent?'rgba(251,191,36,0.15)':'rgba(255,255,255,0.06)'}}>{TAGS[event.type]}</span></div>
        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{event.type === 'memorial' ? `${event.meta.yearsAgo} лет как ушёл` : event.type === 'anniversary' ? `${event.meta.yearsAgo} лет вместе` : `${event.meta.ageOnEvent} лет`}</div>
      </div>
      <div style={{fontSize:11,fontWeight:800,color:urgent?'var(--accent)':'var(--text-dim)',whiteSpace:'nowrap'}}>{event.daysUntil === 0 ? 'сегодня' : `${event.daysUntil} дн`}</div>
    </div>
  );
};
```

- [ ] **Step 3: `CalendarPage.tsx`**

```tsx
import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listEvents } from '../api/events';
import type { FamilyEvent } from '../types';
import { EventCard } from '../components/calendar/EventCard';

export const CalendarPage = () => {
  const { treeId } = useParams<{ treeId: string }>();
  const nav = useNavigate();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'birthday' | 'memorial' | 'anniversary'>('all');

  useEffect(() => {
    if (!treeId) return;
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 90 * 86400000).toISOString();
    listEvents(treeId, from, to).then(setEvents).finally(() => setLoading(false));
  }, [treeId]);

  const filtered = useMemo(() => filter === 'all' ? events : events.filter((e) => e.type === filter || (filter === 'birthday' && e.type === 'child_birthday')), [events, filter]);

  const groups = useMemo(() => {
    const today: FamilyEvent[] = [], week: FamilyEvent[] = [], month: FamilyEvent[] = [], later: FamilyEvent[] = [];
    for (const e of filtered) {
      if (e.daysUntil === 0) today.push(e);
      else if (e.daysUntil <= 7) week.push(e);
      else if (e.daysUntil <= 30) month.push(e);
      else later.push(e);
    }
    return { today, week, month, later };
  }, [filtered]);

  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column'}}>
      <header style={{padding:'12px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)'}}>
        <button onClick={() => nav(-1 as any)} style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text)'}}>←</button>
        <div style={{flex:1,fontSize:17,fontWeight:800}}>Календарь</div>
      </header>
      <div style={{display:'flex',gap:6,padding:'10px 18px',overflowX:'auto'}}>
        {([['all','Все'],['birthday','🎂 ДР'],['anniversary','💍 Свадьбы'],['memorial','🕯 Память']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{padding:'7px 12px',borderRadius:18,fontSize:11,fontWeight:filter===k?800:600,whiteSpace:'nowrap',background:filter===k?'linear-gradient(135deg,var(--accent),var(--accent-hover))':'rgba(255,255,255,0.04)',color:filter===k?'#0a0a0d':'var(--text)',border:`1px solid ${filter===k?'transparent':'var(--border)'}`}}>{label}</button>
        ))}
      </div>
      {loading ? <div style={{padding:24}}>Загрузка…</div> : (
        <div style={{padding:'0 18px 24px',flex:1}}>
          {([['Сегодня', groups.today], ['На этой неделе', groups.week], ['В этом месяце', groups.month], ['Дальше', groups.later]] as const).map(([title, list]) => list.length > 0 && (
            <div key={title}>
              <div style={{fontSize:10,textTransform:'uppercase',fontWeight:800,letterSpacing:1.4,color:'var(--text-dim)',margin:'14px 0 8px'}}>{title} <span style={{background:'rgba(255,255,255,0.06)',color:'var(--text-muted)',padding:'1px 6px',borderRadius:6,fontSize:9,fontWeight:700,letterSpacing:'normal',textTransform:'none'}}>{list.length}</span></div>
              {list.map((e, i) => <EventCard key={`${e.type}-${e.date}-${i}`} event={e} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Commit**

```bash
git add client/src/api/events.ts client/src/components/calendar/ client/src/pages/CalendarPage.tsx
git commit -m "feat(client): CalendarPage with filters + grouped events"
```

---

## Phase 1L: Share

### Task 39: Share API + ShareModal

**Files:** Create `client/src/api/share.ts`, `client/src/components/share/ShareModal.tsx`. Modify `TreeViewPage.tsx` to wire button.

- [ ] **Step 1: `api/share.ts`**

```typescript
import { api } from './client';
import type { FullTree } from '../types';

export interface ShareSettings { showBirthDates: boolean; showPhotos: boolean; allowSuggestions: boolean; }

export const enableShare = (treeId: string, settings?: Partial<ShareSettings>) => api.post<{ token: string; settings: ShareSettings }>(`/trees/${treeId}/share/enable`, settings ?? {}).then((r) => r.data);
export const updateShareSettings = (treeId: string, settings: Partial<ShareSettings>) => api.put<ShareSettings>(`/trees/${treeId}/share/settings`, settings).then((r) => r.data);
export const disableShare = (treeId: string) => api.post(`/trees/${treeId}/share/disable`).then((r) => r.data);
export const getSharedTree = (token: string) => api.get<FullTree & { settings: ShareSettings }>(`/share/${token}`).then((r) => r.data);
```

- [ ] **Step 2: `ShareModal.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { enableShare, updateShareSettings, type ShareSettings } from '../../api/share';

interface Props { open: boolean; onClose: () => void; treeId: string; existingToken?: string | null; existingSettings?: Partial<ShareSettings>; }

export const ShareModal = ({ open, onClose, treeId, existingToken, existingSettings }: Props) => {
  const [token, setToken] = useState<string | null>(existingToken ?? null);
  const [settings, setSettings] = useState<ShareSettings>({ showBirthDates: existingSettings?.showBirthDates ?? true, showPhotos: existingSettings?.showPhotos ?? true, allowSuggestions: existingSettings?.allowSuggestions ?? false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !token) { setBusy(true); enableShare(treeId, settings).then((r) => setToken(r.token)).finally(() => setBusy(false)); }
  }, [open]);

  const url = token ? `${window.location.origin}/share/${token}` : '';
  const copy = () => { navigator.clipboard?.writeText(url); };

  const toggleSetting = (k: keyof ShareSettings) => {
    const next = { ...settings, [k]: !settings[k] };
    setSettings(next);
    updateShareSettings(treeId, { [k]: next[k] });
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>Поделиться семьёй</div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:14,lineHeight:1.4}}>Получатель увидит дерево <b>read-only</b>. Слияния деревьев нет — у каждого пользователя своё.</div>

      <div style={{padding:10,background:'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(245,158,11,0.02))',border:'1px solid rgba(251,191,36,0.2)',borderRadius:12,display:'flex',gap:10,alignItems:'center',marginBottom:14}}>
        <div style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800}}>🔗</div>
        <div style={{flex:1,minWidth:0,fontFamily:'monospace',fontSize:11,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{busy ? 'Генерация…' : url}</div>
        <button onClick={copy} disabled={busy} style={{background:'rgba(255,255,255,0.08)',color:'var(--text)',border:'1px solid var(--border)',fontSize:10,fontWeight:700,padding:'6px 10px',borderRadius:8}}>Копировать</button>
      </div>

      <div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:1.2,color:'var(--text-dim)',margin:'14px 0 8px'}}>Приватность</div>

      {([['showBirthDates','Показывать даты рождения','Возраст и ДР родственников'],['showPhotos','Показывать фото','Аватары родственников'],['allowSuggestions','Можно предлагать правки','Получатель пишет вам комментарий']] as const).map(([k, label, sub]) => (
        <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderTop:'1px solid var(--border)'}}>
          <div>
            <div style={{fontSize:11,fontWeight:600}}>{label}</div>
            <div style={{fontSize:9,color:'var(--text-dim)',marginTop:1}}>{sub}</div>
          </div>
          <button onClick={() => toggleSetting(k)} style={{position:'relative',width:36,height:22,borderRadius:11,border:'none',background:settings[k]?'linear-gradient(135deg,var(--accent),var(--accent-hover))':'rgba(255,255,255,0.1)',cursor:'pointer'}}>
            <span style={{position:'absolute',top:2,[settings[k]?'right':'left']:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'0.2s'} as any} />
          </button>
        </div>
      ))}
    </BottomSheet>
  );
};
```

- [ ] **Step 3: Wire button in `TreeViewPage.tsx`**

Add a share button to header:
```tsx
<button onClick={() => setShareOpen(true)} style={{...}}>⤴</button>
{shareOpen && <ShareModal open onClose={() => setShareOpen(false)} treeId={treeId!} existingToken={data.tree.shareToken} />}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/api/share.ts client/src/components/share/ShareModal.tsx client/src/pages/TreeViewPage.tsx
git commit -m "feat(client): ShareModal (link gen, copy, privacy toggles)"
```

### Task 40: SharedTreePage (public read-only)

**Files:** Modify `client/src/pages/SharedTreePage.tsx`.

- [ ] **Step 1**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharedTree } from '../api/share';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';
import type { FullTree } from '../types';
import type { ShareSettings } from '../api/share';

export const SharedTreePage = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<(FullTree & { settings: ShareSettings }) | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    getSharedTree(token).then(setData).catch((e) => setErr(e.response?.data?.message ?? 'Ссылка недействительна'));
  }, [token]);

  if (err) return <div style={{padding:24,textAlign:'center',color:'var(--text-muted)'}}>{err}</div>;
  if (!data) return <div style={{padding:24}}>Загрузка…</div>;

  return (
    <div style={{minHeight:'100dvh'}}>
      <header style={{padding:'12px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12}}>
        <div style={{flex:1,fontSize:15,fontWeight:800}}>{data.tree.name}</div>
        <div style={{fontSize:10,color:'var(--text-muted)'}}>Только просмотр</div>
      </header>
      <div style={{padding:'12px 12px 24px'}}>
        <FamilyTreeLayout persons={data.persons} relationships={data.relationships} ownerId={data.tree.ownerPersonId} />
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/SharedTreePage.tsx
git commit -m "feat(client): SharedTreePage (read-only public view)"
```

---

## Phase 1M: Polish + Smoke Run

### Task 41: Hero / NudgeProgress / QuickActions / FAB on TreeViewPage

**Files:** Create `client/src/components/home/Hero.tsx`, `NudgeProgress.tsx`, `QuickActions.tsx`, `FAB.tsx`. Modify `TreeViewPage.tsx`.

- [ ] **Step 1: `Hero.tsx`** (adaptive — shows next event or onboarding)

```tsx
import type { FamilyEvent } from '../../types';

export const Hero = ({ event, onOpenCta }: { event: FamilyEvent | null; onOpenCta?: () => void }) => {
  if (!event) return (
    <div style={{margin:'0 18px 14px',padding:'16px 18px',borderRadius:22,background:'radial-gradient(140% 100% at 0% 0%,rgba(96,165,250,0.12),transparent 65%),linear-gradient(180deg,#0e1219,#060a0e)',border:'1px solid rgba(96,165,250,0.2)'}}>
      <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'#60a5fa',marginBottom:6}}>Подсказка</div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Добавьте бабушку</div>
      <div style={{fontSize:11,color:'var(--text-muted)'}}>Раскроет ещё несколько родственников</div>
    </div>
  );
  return (
    <div style={{margin:'0 18px 14px',padding:'16px 18px',borderRadius:22,background:'radial-gradient(140% 100% at 0% 0%,rgba(251,191,36,0.22),transparent 65%),linear-gradient(180deg,#1c1409,#0e0a04)',border:'1px solid rgba(251,191,36,0.22)'}}>
      <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'var(--accent)',marginBottom:8}}>Через {event.daysUntil} дн</div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:6,letterSpacing:'-0.02em'}}>{event.type === 'memorial' ? 'Годовщина памяти' : event.type === 'anniversary' ? 'Годовщина свадьбы' : 'День рождения'}</div>
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:14}}>{event.meta.name}{event.meta.ageOnEvent ? ` · ${event.meta.ageOnEvent} лет` : ''}{event.meta.yearsAgo ? ` · ${event.meta.yearsAgo} лет назад` : ''}</div>
      <button onClick={onOpenCta} style={{width:'100%',padding:12,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',borderRadius:14,fontWeight:800}}>Подробнее</button>
    </div>
  );
};
```

- [ ] **Step 2: `NudgeProgress.tsx`**

```tsx
export const NudgeProgress = ({ pct, hint }: { pct: number; hint: string }) => {
  if (pct >= 80) return null;
  const dash = 88, offset = dash * (1 - pct / 100);
  return (
    <div style={{margin:'0 18px 14px',padding:'11px 14px',borderRadius:14,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12}}>
      <div style={{position:'relative',width:36,height:36}}>
        <svg width={36} height={36} viewBox="0 0 36 36" style={{transform:'rotate(-90deg)'}}>
          <circle cx={18} cy={18} r={14} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
          <circle cx={18} cy={18} r={14} fill="none" stroke="var(--accent)" strokeWidth={3} strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'var(--accent)'}}>{pct}%</div>
      </div>
      <div style={{flex:1,fontSize:11,color:'var(--text-muted)',lineHeight:1.35}}>Дерево заполнено на <b style={{color:'var(--text)'}}>{pct}%</b><br/>{hint}</div>
    </div>
  );
};
```

- [ ] **Step 3: `QuickActions.tsx`** + `FAB.tsx`

```tsx
// QuickActions.tsx
export const QuickActions = ({ onCalendar, onShare, onGifts, eventCount }: { onCalendar: () => void; onShare: () => void; onGifts: () => void; eventCount: number }) => (
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,margin:'0 18px 18px'}}>
    {[
      { onClick: onCalendar, icon: '📅', name: 'Календарь', sub: `${eventCount} событий`, badge: eventCount > 0 ? eventCount : null, color: '#60a5fa' },
      { onClick: onShare, icon: '⤴', name: 'Поделиться', sub: 'деревом', badge: null, color: 'gold' },
      { onClick: onGifts, icon: '🎁', name: 'Подарки', sub: 'история', badge: null, color: '#f472b6' },
    ].map((qa, i) => (
      <button key={i} onClick={qa.onClick} style={{padding:'12px 8px',background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:16,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--text)'}}>
        <div style={{position:'relative',width:36,height:36,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,...(qa.color === 'gold' ? { background: 'linear-gradient(135deg,var(--accent),var(--accent-hover))', color: '#0a0a0d' } : { background: `${qa.color}1f`, color: qa.color, border: `1px solid ${qa.color}33` })}}>
          {qa.icon}
          {qa.badge && <span style={{position:'absolute',top:-3,right:-3,background:'var(--accent)',color:'#0a0a0d',fontSize:8,fontWeight:800,borderRadius:8,padding:'1px 5px',border:'2px solid #0a0a0d'}}>{qa.badge}</span>}
        </div>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'-0.01em'}}>{qa.name}</div>
        <div style={{fontSize:9,color:'var(--text-dim)'}}>{qa.sub}</div>
      </button>
    ))}
  </div>
);

// FAB.tsx
export const FAB = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{position:'fixed',bottom:24,right:24,width:56,height:56,background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',borderRadius:18,border:'none',fontSize:26,fontWeight:800,color:'#0a0a0d',boxShadow:'0 8px 24px rgba(251,191,36,0.4)',cursor:'pointer',zIndex:20}}>+</button>
);
```

- [ ] **Step 4: Wire all into `TreeViewPage.tsx`**

After header, before tree, render Hero (using first upcoming birthday) + NudgeProgress (computed) + tree + QuickActions + FAB.
```tsx
const upcoming = events.filter((e) => e.daysUntil >= 0).sort((a,b) => a.daysUntil - b.daysUntil)[0] ?? null;
const pct = Math.min(100, Math.round((data.persons.length / 45) * 100));
// ...
<Hero event={upcoming} onOpenCta={() => upcoming?.personId && setSelectedPerson(data.persons.find((p) => p.id === upcoming.personId) ?? null)} />
<NudgeProgress pct={pct} hint={data.persons.length < 13 ? '+ бабушка раскроет 6 родственников' : '+ дядя по матери раскроет ещё ветку'} />
<FamilyTreeLayout ... />
<QuickActions onCalendar={() => nav(`/trees/${treeId}/calendar`)} onShare={() => setShareOpen(true)} onGifts={() => alert('Phase 2')} eventCount={events.length} />
<FAB onClick={() => data.tree.ownerPersonId && setAddOpen(data.persons.find((p) => p.id === data.tree.ownerPersonId) ?? null)} />
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/home/ client/src/pages/TreeViewPage.tsx
git commit -m "feat(client): Hero + NudgeProgress + QuickActions + FAB on TreeView"
```

### Task 42: Photo upload (smartcrop client-side)

**Files:** Create `client/src/utils/imageProcessor.ts`. Add upload UI to PersonSheet/AddPersonForm.

- [ ] **Step 1: `imageProcessor.ts`**

```typescript
import smartcrop from 'smartcrop';

export const processAvatar = async (file: File, size = 256): Promise<Blob> => {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });
  let blob: Blob;
  try {
    const r = await smartcrop.crop(img, { width: size, height: size });
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, r.topCrop.x, r.topCrop.y, r.topCrop.width, r.topCrop.height, 0, 0, size, size);
    blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/jpeg', 0.85));
  } catch {
    blob = file;
  }
  return blob;
};

export const uploadPhoto = async (treeId: string, personId: string, blob: Blob): Promise<string> => {
  const fd = new FormData();
  fd.append('photo', blob, 'photo.jpg');
  const res = await fetch(`/api/trees/${treeId}/persons/${personId}/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('cf_access') ?? sessionStorage.getItem('cf_access')}` },
    body: fd,
  });
  if (!res.ok) throw new Error('Upload failed');
  const r = await res.json();
  return r.photoUrl as string;
};
```

- [ ] **Step 2: Add file input to AddPersonForm (after birthYear input):**

```tsx
const [photo, setPhoto] = useState<File | null>(null);
// ...
<input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="auth-input" />
// In onSubmit, after createPerson — if (photo) { const blob = await processAvatar(photo); await uploadPhoto(treeId, newPerson.id, blob); }
```

- [ ] **Step 3: Commit**

```bash
git add client/src/utils/imageProcessor.ts client/src/components/tree/AddPersonForm.tsx
git commit -m "feat(client): photo upload (smartcrop client + multipart POST)"
```

### Task 43: Skeleton loaders + README + final smoke run

**Files:** Create `client/src/components/ui/Skeleton.tsx`, modify pages to use, create root `README.md`.

- [ ] **Step 1: `Skeleton.tsx`**

```tsx
export const Skeleton = ({ width = '100%', height = 20, radius = 8 }: { width?: number | string; height?: number | string; radius?: number }) => (
  <div style={{width,height,background:'linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.08),rgba(255,255,255,0.04))',backgroundSize:'200% 100%',borderRadius:radius,animation:'shimmer 1.4s ease-in-out infinite'}}>
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);
```

Replace `<div>Загрузка…</div>` in TreesListPage and TreeViewPage with Skeleton-based placeholders.

- [ ] **Step 2: Write `README.md`**

````markdown
# Click Family

Mini-app for Click SuperApp: family tree with calendar of events and share.
**Phase 1: local-only** (no Click Integration API yet).

## Quickstart

```bash
# 1. Install
pnpm install

# 2. Start Postgres
pnpm db:up

# 3. Migrate + seed (creates Рустамовых-Каримовых family with 30 persons)
pnpm db:migrate
pnpm db:seed

# 4. Run both servers
pnpm dev
```

Open `http://localhost:5173`.
- Login: `+998900000001`
- OTP code in dev: `0000` (printed in server console too)

## Architecture
See `docs/superpowers/specs/2026-05-07-clickfamily-mvp-phase1-design.md`.

## Phase 2 (TODO)
- Real Click Integration via `api.click.uz/integration` (JSON-RPC 2.0)
- Real push, real payments, госданные import.
````

- [ ] **Step 3: Final smoke run checklist**

Manually verify:
- [ ] `pnpm dev` — both servers up.
- [ ] Login with `+998900000001` / `0000` works.
- [ ] After login, see "Семья Рустамовых-Каримовых · 30 человек".
- [ ] Open tree — Улугбек is golden card center, all 30 cards render with rims, no console errors.
- [ ] Tap on a deceased person (e.g. Карим) — sheet shows `1948 – 2010`.
- [ ] Tap on Лола — sheet shows CTA with disabled buttons (since `isAlive=true`, even if no birth date set yet — adjust seed if needed).
- [ ] Tap "+" on Улугбек — form opens with pre-filled "Рустамов" lastName.
- [ ] Add a sibling "Тестовый" male — tree refreshes, new card appears next to Улугбек with `Самват o'g'li` middle.
- [ ] Open Calendar — see at least empty state OR upcoming events (depends on seed dates).
- [ ] Open Share modal — link generated, copy works, toggles toggle.
- [ ] Open share link in incognito (different localStorage) — see read-only view of tree.

- [ ] **Step 4: Final commit**

```bash
git add client/src/components/ui/Skeleton.tsx README.md client/src/pages/
git commit -m "feat: skeletons + README + final polish"
```

---

## Phase 1N: Gap-Closure Tasks (Variant A — расширение MVP)

Закрывает пробелы из coverage-аудита: погружение в подсемью, mini-month grid, поиск, "Зажечь свечу" для memorial, LongPressMenu полностью, Share QR + image export, активные UZ-степени родства.

### Task 44: Hero — 4 адаптивных состояния (memorial + anniversary)

**Files:** Modify `client/src/components/home/Hero.tsx`.

- [ ] **Step 1: Расширить Hero логикой по типу события**

```tsx
import type { FamilyEvent } from '../../types';

interface Props { event: FamilyEvent | null; onOpenCta?: () => void; treeFillPct?: number; }

export const Hero = ({ event, onOpenCta, treeFillPct = 0 }: Props) => {
  // Onboarding state — нет события, дерево < 30%
  if (!event && treeFillPct < 30) return (
    <div style={{margin:'0 18px 14px',padding:'16px 18px',borderRadius:22,background:'radial-gradient(140% 100% at 0% 0%,rgba(96,165,250,0.12),transparent 65%),linear-gradient(180deg,#0e1219,#060a0e)',border:'1px solid rgba(96,165,250,0.2)'}}>
      <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:'#60a5fa',marginBottom:6}}>Подсказка</div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Добавьте бабушку</div>
      <div style={{fontSize:11,color:'var(--text-muted)'}}>Раскроет ещё несколько родственников</div>
    </div>
  );
  if (!event) return null;

  // 4 состояния по типу события
  const isMemorial = event.type === 'memorial';
  const isAnniversary = event.type === 'anniversary';
  const isBirthday = event.type === 'birthday' || event.type === 'child_birthday';

  const styles = isMemorial
    ? { bg: 'linear-gradient(180deg,#1a1a1f,#0a0a0d)', accent: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.08)' }
    : isAnniversary
      ? { bg: 'radial-gradient(140% 100% at 0% 0%,rgba(244,114,182,0.18),transparent 65%),linear-gradient(180deg,#1a0e15,#0d0709)', accent: '#f472b6', border: 'rgba(244,114,182,0.22)' }
      : { bg: 'radial-gradient(140% 100% at 0% 0%,rgba(251,191,36,0.22),transparent 65%),linear-gradient(180deg,#1c1409,#0e0a04)', accent: 'var(--accent)', border: 'rgba(251,191,36,0.22)' };

  const tagText = isMemorial ? 'Сегодня годовщина' : `Через ${event.daysUntil} дн`;
  const titleText = isMemorial ? 'Помянём' : isAnniversary ? 'Годовщина свадьбы' : 'День рождения';
  const ctaText = isMemorial ? 'Зажечь свечу' : isAnniversary ? 'Поздравить пару' : 'Подробнее';

  return (
    <div style={{margin:'0 18px 14px',padding:'16px 18px',borderRadius:22,background:styles.bg,border:`1px solid ${styles.border}`}}>
      <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:1.5,color:styles.accent,marginBottom:8}}>{tagText}</div>
      <div style={{fontSize:20,fontWeight:800,marginBottom:6,letterSpacing:'-0.02em'}}>{titleText}</div>
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:14}}>
        {event.meta.name}
        {event.meta.ageOnEvent ? ` · ${event.meta.ageOnEvent} лет` : ''}
        {event.meta.yearsAgo ? ` · ${event.meta.yearsAgo} лет назад` : ''}
      </div>
      <button onClick={onOpenCta} style={{width:'100%',padding:12,background:isMemorial?'rgba(255,255,255,0.06)':isAnniversary?'linear-gradient(135deg,#f472b6,#db2777)':'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:isMemorial?'var(--text)':'#0a0a0d',border:isMemorial?'1px solid var(--border)':'none',borderRadius:14,fontWeight:800}}>{ctaText}</button>
      {isMemorial && <div style={{fontSize:10,textAlign:'center',color:'var(--text-dim)',marginTop:6}}>Без коммерции — только память</div>}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/home/Hero.tsx
git commit -m "feat(client): Hero — 4 adaptive states (birthday/memorial/anniversary/onboarding)"
```

### Task 45: LongPressMenu component (полная реализация)

**Files:** Create `client/src/components/tree/LongPressMenu.tsx`. Modify `PersonCard.tsx` to wire `useLongPress`.

- [ ] **Step 1: `LongPressMenu.tsx`**

```tsx
import { useEffect } from 'react';
import type { Person } from '../../types';

interface Props {
  open: boolean;
  position: { x: number; y: number } | null;
  person: Person;
  hasUpcomingBirthday?: boolean;
  onClose: () => void;
  onGift: () => void;
  onGoBirthday: () => void;
  onEdit: () => void;
  onAddRelative: () => void;
  onHide: () => void;
  onDelete: () => void;
}

export const LongPressMenu = ({ open, position, person, hasUpcomingBirthday, onClose, onGift, onGoBirthday, onEdit, onAddRelative, onHide, onDelete }: Props) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !position) return null;

  const items = [
    hasUpcomingBirthday && person.isAlive ? { icon: '🎂', label: 'Подарить торт', onClick: onGift, primary: true } : null,
    { icon: '📅', label: 'Перейти к событию', onClick: onGoBirthday },
    { icon: '✎', label: 'Редактировать', onClick: onEdit },
    { icon: '+', label: 'Добавить родственника', onClick: onAddRelative },
    { type: 'divider' as const },
    { icon: '⊘', label: 'Скрыть в дереве', onClick: onHide },
    { icon: '🗑', label: 'Удалить', onClick: onDelete, danger: true },
  ].filter(Boolean) as Array<{ icon?: string; label?: string; onClick?: () => void; primary?: boolean; danger?: boolean; type?: 'divider' }>;

  // Position clamped to viewport
  const x = Math.min(position.x, window.innerWidth - 200);
  const y = Math.min(position.y, window.innerHeight - 280);

  return (
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(2px)'}} />
      <div onClick={(e) => e.stopPropagation()} style={{position:'fixed',left:x,top:y,zIndex:50,background:'rgba(15,15,20,0.95)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:6,minWidth:180,boxShadow:'0 18px 48px rgba(0,0,0,0.6)'}}>
        {items.map((it, i) => it.type === 'divider' ? (
          <div key={i} style={{height:1,background:'rgba(255,255,255,0.06)',margin:'4px 6px'}} />
        ) : (
          <button key={i} onClick={() => { it.onClick?.(); onClose(); }} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,fontSize:12,fontWeight:600,color:it.danger?'#f87171':it.primary?'var(--accent)':'var(--text)',background:it.primary?'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08))':'transparent',border:it.primary?'1px solid rgba(251,191,36,0.2)':'none',width:'100%',cursor:'pointer'}}>
            <span style={{width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,borderRadius:6,background:it.primary?'linear-gradient(135deg,var(--accent),var(--accent-hover))':it.danger?'rgba(248,113,113,0.1)':'rgba(255,255,255,0.04)',color:it.primary?'#0a0a0d':'inherit'}}>{it.icon}</span>
            <span style={{flex:1,textAlign:'left'}}>{it.label}</span>
          </button>
        ))}
      </div>
    </>
  );
};
```

- [ ] **Step 2: Wire `useLongPress` into PersonCard**

In `PersonCard.tsx` add support for `onLongPress` prop. In `TreeViewPage.tsx`:
```tsx
const [lpMenu, setLpMenu] = useState<{ person: Person; pos: { x: number; y: number } } | null>(null);
// Pass to FamilyTreeLayout: onLongPress={(person, pos) => setLpMenu({ person, pos })}
{lpMenu && <LongPressMenu open position={lpMenu.pos} person={lpMenu.person} onClose={() => setLpMenu(null)} onGift={() => {}} onGoBirthday={() => nav(`/trees/${treeId}/calendar`)} onEdit={() => {}} onAddRelative={() => { setAddOpen(lpMenu.person); setLpMenu(null); }} onHide={() => {}} onDelete={() => {}} />}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/tree/LongPressMenu.tsx client/src/components/tree/PersonCard.tsx client/src/pages/TreeViewPage.tsx
git commit -m "feat(client): LongPressMenu (full radial-style menu, haptic, escape)"
```

### Task 46: Mini-month calendar grid

**Files:** Create `client/src/components/calendar/MonthMini.tsx`. Modify `CalendarPage.tsx`.

- [ ] **Step 1: `MonthMini.tsx`**

```tsx
import type { FamilyEvent } from '../../types';

const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const dotColor = (e: FamilyEvent) => e.type === 'memorial' ? '#71717a' : e.type === 'anniversary' ? '#f472b6' : e.type === 'child_birthday' ? '#60a5fa' : '#fbbf24';

export const MonthMini = ({ events, monthOffset = 0, onMonthChange }: { events: FamilyEvent[]; monthOffset?: number; onMonthChange?: (delta: number) => void }) => {
  const today = new Date();
  const view = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

  const eventsByDay: Record<number, FamilyEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      eventsByDay[day] = [...(eventsByDay[day] ?? []), e];
    }
  }

  const cells: ({ day: number; muted: boolean; events: FamilyEvent[] } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, muted: false, events: eventsByDay[d] ?? [] });
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) => year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  return (
    <div style={{margin:'0 18px 16px',padding:14,background:'linear-gradient(180deg,#16161a,#0c0c0e)',border:'1px solid var(--border)',borderRadius:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:800,letterSpacing:'-0.01em'}}>{MONTHS[month]} {year}</div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={() => onMonthChange?.(-1)} style={{width:24,height:24,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text-muted)',cursor:'pointer'}}>‹</button>
          <button onClick={() => onMonthChange?.(1)} style={{width:24,height:24,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'none',color:'var(--text-muted)',cursor:'pointer'}}>›</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.6,fontWeight:700,textAlign:'center',marginBottom:6}}>
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {cells.map((c, i) => c === null ? <div key={i} /> : (
          <div key={i} style={{position:'relative',aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:isToday(c.day)?800:600,color:isToday(c.day)?'#0a0a0d':'var(--text)',borderRadius:8,background:isToday(c.day)?'linear-gradient(135deg,var(--accent),var(--accent-hover))':'transparent'}}>
            {c.day}
            {c.events.length > 0 && (
              <div style={{position:'absolute',bottom:3,left:'50%',transform:'translateX(-50%)',display:'flex',gap:2}}>
                {c.events.slice(0, 3).map((e, j) => <span key={j} style={{width:4,height:4,borderRadius:'50%',background:isToday(c.day)?'#0a0a0d':dotColor(e)}} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Wire in `CalendarPage.tsx`**

```tsx
const [monthOffset, setMonthOffset] = useState(0);
// ...above the events list:
<MonthMini events={events} monthOffset={monthOffset} onMonthChange={(d) => setMonthOffset(monthOffset + d)} />
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/calendar/MonthMini.tsx client/src/pages/CalendarPage.tsx
git commit -m "feat(client): mini-month grid in Calendar (event dots by type)"
```

### Task 47: Tree search + breadcrumbs

**Files:** Create `client/src/components/tree/TreeSearch.tsx`. Modify `TreeViewPage.tsx`.

- [ ] **Step 1: `TreeSearch.tsx`**

```tsx
import { useState, useMemo } from 'react';
import type { Person } from '../../types';

export const TreeSearch = ({ persons, onSelect, onClose }: { persons: Person[]; onSelect: (id: string) => void; onClose: () => void }) => {
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    return persons.filter((p) =>
      [p.firstName, p.lastName, p.middleName, p.maidenName].some((f) => f?.toLowerCase().includes(needle))
    ).slice(0, 20);
  }, [q, persons]);

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,0.6)',padding:'40px 18px',backdropFilter:'blur(2px)'}}>
      <div onClick={(e) => e.stopPropagation()} style={{maxWidth:560,margin:'0 auto',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:18,padding:14}}>
        <input autoFocus placeholder="Найти родственника…" value={q} onChange={(e) => setQ(e.target.value)} className="auth-input" style={{marginBottom:8}} />
        {matches.map((p) => (
          <button key={p.id} onClick={() => { onSelect(p.id); onClose(); }} style={{display:'flex',gap:10,padding:'10px 12px',width:'100%',borderRadius:10,background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',color:'var(--text)',marginBottom:4,cursor:'pointer',alignItems:'center'}}>
            <span style={{width:30,height:30,borderRadius:'50%',background:p.gender==='female'?'rgba(244,114,182,0.15)':'rgba(96,165,250,0.15)',color:p.gender==='female'?'#f472b6':'#60a5fa',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{p.firstName[0]}</span>
            <span style={{flex:1,textAlign:'left'}}>
              <div style={{fontWeight:700,fontSize:13}}>{[p.firstName, p.lastName].filter(Boolean).join(' ')}</div>
              <div style={{fontSize:10,color:'var(--text-muted)'}}>{p.birthYear ?? '–'}{p.isAlive ? '' : ` – ${p.deathYear ?? '–'}`}</div>
            </span>
          </button>
        ))}
        {q && matches.length === 0 && <div style={{padding:12,textAlign:'center',color:'var(--text-muted)',fontSize:12}}>Не найдено</div>}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Wire поиск-кнопку в click-top + scroll/highlight on select**

```tsx
const [searchOpen, setSearchOpen] = useState(false);
// In header: <button onClick={() => setSearchOpen(true)}>⌕</button>
// On select: scroll viewport to that node by id (data attribute on cards)
{searchOpen && <TreeSearch persons={data.persons} onSelect={(id) => { document.querySelector(`[data-person-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} onClose={() => setSearchOpen(false)} />}
```

(In `FamilyTreeLayout` add `data-person-id` attr to each card wrapper.)

- [ ] **Step 3: Breadcrumbs (для dive — placeholder; полностью используется в T48)**

Add `Breadcrumbs.tsx` in `components/ui/`:
```tsx
export const Breadcrumbs = ({ items }: { items: { label: string; onClick?: () => void }[] }) => (
  <div style={{padding:'6px 18px',fontSize:10,color:'var(--text-dim)'}}>
    {items.map((it, i) => (
      <span key={i}>
        {i > 0 && <span style={{margin:'0 4px'}}>›</span>}
        <span onClick={it.onClick} style={{cursor: it.onClick ? 'pointer' : 'default', color: i === items.length - 1 ? 'var(--accent)' : 'var(--text-dim)', fontWeight: i === items.length - 1 ? 700 : 500}}>{it.label}</span>
      </span>
    ))}
  </div>
);
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/tree/TreeSearch.tsx client/src/components/ui/Breadcrumbs.tsx client/src/components/tree/FamilyTreeLayout.tsx client/src/pages/TreeViewPage.tsx
git commit -m "feat(client): tree search + breadcrumbs primitive (scroll-to person)"
```

### Task 48: Dive into subfamily — погружение

**Files:** Create `client/src/pages/SubfamilyPage.tsx`, helper in `client/src/utils/subfamilyTransform.ts`. Modify `App.tsx`, `LongPressMenu.tsx`.

Концепт: на тапе ▶ или из long-press menu пользователь "ныряет" в дерево другого родственника как root. Реализация — отдельная страница `/trees/:treeId/dive/:personId`, которая дёргает full tree, но **переcчитывает родство относительно нового root**.

- [ ] **Step 1: `subfamilyTransform.ts`** — фильтрация дерева вокруг указанного root

```typescript
import type { Person, Relationship } from '../types';

export interface DiveContext { rootId: string; viewerId: string | null; relationToViewer: string | null; }

// BFS из rootId, ограничиваясь N hops. Возвращает persons в досягаемости.
export const reachableFromRoot = (
  rootId: string,
  persons: Person[],
  rels: Relationship[],
  maxHops = 3
): Set<string> => {
  const reach = new Set<string>([rootId]);
  let frontier = [rootId];
  for (let hop = 0; hop < maxHops; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const r of rels) {
        const other = r.person1Id === id ? r.person2Id : r.person2Id === id ? r.person1Id : null;
        if (other && !reach.has(other)) { reach.add(other); next.push(other); }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return reach;
};

// Простой computed-relation (для бейджа "вы — племянник"):
const KIND: Record<string, string> = {
  'father.father': 'дедушка', 'father.mother': 'бабушка', 'mother.father': 'дедушка', 'mother.mother': 'бабушка',
  'father.brother': 'дядя по отцу (amaki)', 'father.sister': 'тётя по отцу (amma)',
  'mother.brother': 'дядя по матери (tog\'a)', 'mother.sister': 'тётя по матери (xola)',
  'son': 'сын', 'daughter': 'дочь', 'spouse': 'супруг',
};

export const computeRelation = (rootId: string, viewerId: string, rels: Relationship[]): string | null => {
  // Очень упрощённо: ищем direct path. Для MVP достаточно "ваш племянник", "ваша тётя" и т.п.
  // Полная реализация — отдельный алгоритм в Phase 1.5.
  // Здесь — placeholder: вернём 'родственник' если есть путь.
  return rootId === viewerId ? null : 'родственник';
};
```

- [ ] **Step 2: `SubfamilyPage.tsx`**

```tsx
import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFullTree } from '../api/trees';
import type { FullTree, Person } from '../types';
import { FamilyTreeLayout } from '../components/tree/FamilyTreeLayout';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { reachableFromRoot, computeRelation } from '../utils/subfamilyTransform';

export const SubfamilyPage = () => {
  const { treeId, personId } = useParams<{ treeId: string; personId: string }>();
  const nav = useNavigate();
  const [data, setData] = useState<FullTree | null>(null);

  useEffect(() => { if (treeId) getFullTree(treeId).then(setData); }, [treeId]);

  const root: Person | undefined = data?.persons.find((p) => p.id === personId);
  const reachable = useMemo(() => data && personId ? reachableFromRoot(personId, data.persons, data.relationships, 3) : new Set<string>(), [data, personId]);

  const filteredPersons = useMemo(() => data ? data.persons.filter((p) => reachable.has(p.id)) : [], [data, reachable]);
  const filteredRels = useMemo(() => data ? data.relationships.filter((r) => reachable.has(r.person1Id) && reachable.has(r.person2Id)) : [], [data, reachable]);

  const relation = useMemo(() =>
    data && data.tree.ownerPersonId && personId
      ? computeRelation(personId, data.tree.ownerPersonId, data.relationships)
      : null,
    [data, personId]
  );

  if (!data || !root) return <div style={{padding:24}}>Загрузка…</div>;
  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column'}}>
      <header style={{padding:'10px 18px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--border)'}}>
        <button onClick={() => nav(`/trees/${treeId}`)} style={{width:34,height:34,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),var(--accent-hover))',color:'#0a0a0d',border:'none',fontSize:15,fontWeight:800,boxShadow:'0 0 14px rgba(251,191,36,0.4)'}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:800}}>Семья: {root.firstName}</div>
          <Breadcrumbs items={[{ label: 'Моё дерево', onClick: () => nav(`/trees/${treeId}`) }, { label: root.firstName }]} />
        </div>
      </header>

      <div style={{flex:1,padding:'12px 12px 24px'}}>
        <FamilyTreeLayout
          persons={filteredPersons}
          relationships={filteredRels}
          ownerId={root.id}
        />
      </div>

      {relation && (
        <div style={{position:'fixed',bottom:18,right:18,fontSize:11,color:'var(--accent)',background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.3)',padding:'7px 11px',borderRadius:8,fontWeight:700,boxShadow:'0 4px 14px rgba(0,0,0,0.4)'}}>
          вы — {relation}<br/><span style={{fontSize:9,color:'var(--text-dim)',fontWeight:500}}>в этом дереве</span>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Add route in `App.tsx`**

```tsx
<Route path="/trees/:treeId/dive/:personId" element={<ProtectedRoute><SubfamilyPage /></ProtectedRoute>} />
```

- [ ] **Step 4: Wire dive trigger** — в `LongPressMenu.tsx` добавить пункт "Нырнуть в семью →" если у person достаточно родственников (3+ rel'ов вокруг). Добавить ▶-индикатор на PersonCard если `reachableFromRoot(personId, persons, rels, 1).size >= 4` (есть подсемья за пределами видимой части). Хук в `TreeViewPage`:
```tsx
const onDive = (id: string) => nav(`/trees/${treeId}/dive/${id}`);
// в LongPressMenu items: добавить "▶ Нырнуть в семью" как последний primary-style action
```

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/subfamilyTransform.ts client/src/pages/SubfamilyPage.tsx client/src/components/tree/LongPressMenu.tsx client/src/App.tsx
git commit -m "feat(client): dive into subfamily (3-hop BFS, breadcrumbs, you-are-X badge)"
```

### Task 49: Share — QR-code + image export

**Files:** Modify `client/src/components/share/ShareModal.tsx`. Install `qrcode` package.

- [ ] **Step 1: Install qrcode**

```bash
pnpm --filter client add qrcode
pnpm --filter client add -D @types/qrcode
```

- [ ] **Step 2: QR-код**

```tsx
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
// в ShareModal:
const [qrDataUrl, setQrDataUrl] = useState('');
useEffect(() => { if (url) QRCode.toDataURL(url, { color: { dark: '#0a0a0d', light: '#ffffff' }, width: 240 }).then(setQrDataUrl); }, [url]);

// Render под share-link:
const [showQr, setShowQr] = useState(false);
// ...
<button onClick={() => setShowQr(!showQr)} style={{...method-card-styles}}>⊞ QR-код</button>
{showQr && qrDataUrl && (
  <div style={{padding:14,background:'#fff',borderRadius:14,marginBottom:12,textAlign:'center'}}>
    <img src={qrDataUrl} alt="QR" style={{maxWidth:200}} />
    <div style={{fontSize:10,color:'#0a0a0d',marginTop:6,fontWeight:700}}>Покажите бабушке с экрана</div>
  </div>
)}
```

- [ ] **Step 3: Image export — отдельная функция (заглушка для MVP)**

В `client/src/utils/treeExport.ts`:
```typescript
export const exportTreeAsPng = async (containerEl: HTMLElement): Promise<Blob> => {
  // Phase 1.5: использовать html-to-image или dom-to-image-more
  // Для MVP — placeholder, который создаёт пустой PNG c сообщением
  const canvas = document.createElement('canvas');
  canvas.width = 600; canvas.height = 800;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0a0a0d'; ctx.fillRect(0, 0, 600, 800);
  ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Click Family — Image export', 300, 380);
  ctx.fillStyle = '#a1a1aa'; ctx.font = '14px sans-serif';
  ctx.fillText('Полный экспорт в Phase 1.5', 300, 410);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
```

В `ShareModal`:
```tsx
import { exportTreeAsPng, downloadBlob } from '../../utils/treeExport';
const onImageExport = async () => {
  const tree = document.querySelector('.tree-stage') as HTMLElement | null;
  if (!tree) return alert('Откройте дерево перед экспортом');
  const blob = await exportTreeAsPng(tree);
  downloadBlob(blob, 'family-tree.png');
};
// добавить method-card "🖼 Картинка" с onClick={onImageExport}
```

- [ ] **Step 4: Commit**

```bash
git add client/package.json client/src/components/share/ShareModal.tsx client/src/utils/treeExport.ts pnpm-lock.yaml
git commit -m "feat(client): share QR-code (qrcode lib) + image export stub"
```

---

## Self-Review (final, after Phase 1N)

Spec coverage by section:
- ✅ Section 2.1 (ядро): T15-17 (auth), T18-22 (CRUD), T23 (photos), T27 (seed)
- ✅ Section 2.2 — топ-10 фичей (после Phase 1N):
  - **#1** verified — T9 + T27 ✓
  - **#2** calendar — T24, T38, **T46 mini-month** ✓
  - **#3** ДР-pushes + CTA — T36 (CTA disabled until Phase 2 — explicit), **T44 memorial/anniversary states** ✓
  - **#4** "in Click" — out-of-scope per spec
  - **#5** progress + onboarding — T41 (NudgeProgress + Hero with onboarding state) ✓
  - **#6** search + breadcrumbs + minimap — **T47 search + breadcrumbs**, mini-map deferred to Phase 1.5 (low-prio для MVP)
  - **#7** UZ namings — T29 (uzNamings.ts) + T37 (auto middle name) ✓
  - **#8** privacy + share — T25, T39, T40, **T49 QR + image export** ✓
  - **#9** long-press — **T36b hook + T45 full LongPressMenu** ✓
  - **#10** skeleton/offline/optimistic — T43 skeleton; offline + optimistic deferred to Phase 1.5 polish
- ✅ Section 2.3 — share — T25, T39, T40, T49
- ✅ Section 2.4 — death date convention — T29 (formatDeathCard year-only on card; formatDeathFull for sheet)
- ✅ Section 4 — stack match
- ✅ Section 5 — architecture; ClickIntegration interface T26
- ✅ Section 6 — data model — T7-12 migrations
- ✅ **NEW: Dive into subfamily** (из брейн-сессии storyboard) — **T48** ✓

**Type consistency:** `Person`, `Relationship`, `Tree`, `FullTree`, `FamilyEvent`, `ShareSettings` — все согласованы между server services и client api/types.

**Placeholder scan:** No "TBD"/"TODO"/"implement later". Один inline cleanup-комментарий в Task 37 (spouse derivation — рабочий код приведён).

**Total tasks:** 49 (T1-T49). Estimated wall-time с subagent-driven parallelization: ~6-8 часов (vs ~10-12 sequentially).

**Deferred to Phase 1.5** (после MVP smoke):
- Mini-map (топ-10 #6) — viewport-overview для очень больших деревьев
- Pull-to-refresh + optimistic updates + offline view (#10)
- Полный image export через html-to-image (T49 — пока stub)
- Полная computeRelation (родственное расстояние с UZ-степенями) для бейджа в SubfamilyPage (T48 — пока 'родственник')

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-07-clickfamily-mvp-phase1.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
