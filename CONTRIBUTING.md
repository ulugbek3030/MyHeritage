# Contributing to Click Family

## Quickstart

Setup is in [README.md](./README.md). Make sure `pnpm dev` runs cleanly before opening a PR.

## Branch naming

| Prefix | Use for |
|---|---|
| `feat/<topic>` | New features (UI / API / behavior) |
| `fix/<topic>` | Bug fixes |
| `chore/<topic>` | Tooling, deps, CI, configs |
| `docs/<topic>` | Documentation only |
| `refactor/<topic>` | Code restructure without behavior change |

Examples: `feat/share-qr-export`, `fix/tree-render-collision`, `chore/upgrade-vite-7`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short imperative summary>

<optional body — what changed and why, not how>
```

Scopes: `server`, `client`, `db`, `ci`, `docs`. Type matches the branch prefix when possible.

Examples:
```
feat(client): add LongPressMenu primary "Подарить торт" action
fix(server): getFullTree returns camelCase via listPersons/listRels
chore(ci): add Postgres service container for server tests
```

Sign-off / co-author lines are fine but not required.

## Pull Request workflow

1. **Sync main:**
   ```bash
   git checkout main && git pull
   ```
2. **Branch:** `git checkout -b feat/<topic>`
3. **Code, test locally:**
   ```bash
   pnpm --filter server run test    # 10 tests must pass
   pnpm --filter client exec tsc --noEmit
   pnpm dev                          # smoke check
   ```
4. **Commit early, commit often.** Separate commits for separate concerns.
5. **Push + PR:**
   ```bash
   git push -u origin feat/<topic>
   gh pr create --fill   # or open via github.com UI
   ```
6. **Wait for review** — at least 1 approval required (branch protection).
7. **Address review comments** in additional commits on the same branch (don't `--amend` and `--force-push` once a reviewer has started).
8. **Reviewer merges** via "Squash and merge" (keeps `main` linear).
9. **Cleanup:** `git checkout main && git pull && git branch -d feat/<topic>`.

## What CI runs (`.github/workflows/ci.yml`)

On every push to `main` and every PR:

- `pnpm install --frozen-lockfile`
- `pnpm db:migrate` against a fresh Postgres 15 service container
- `pnpm --filter server run test` — must be **10/10 passing**
- `pnpm --filter client exec tsc --noEmit` — must be **0 errors**
- `pnpm --filter client run build` — must succeed (catches Vite / build-time issues)

If any step fails, the PR cannot be merged.

## Database migrations

- Migrations live in `database/migrations/NNN_<name>.sql`. **Never edit a committed migration** — write a new one.
- Number conflicts: if two PRs both add `008_xxx.sql`, the second to merge **renames their file** to `009_xxx.sql` and updates the spec/plan if needed.
- After pulling main with new migrations: `pnpm db:migrate`.

## `.env` policy

- `.env` is **gitignored**. Never commit it.
- New env variables go into `.env.example` (with empty value or sensible dev default) and into `server/src/config/env.ts`.
- Production secrets (Click Integration token, JWT secret) are loaded from server-side env, not bundled.

## Code style

- TypeScript **strict** mode is on. No `any` unless interfacing with untyped libs (`relatives-tree` is one — cast at the boundary, narrow inside).
- All imports use `.js` extension on the server (ES modules).
- React components are functional, hooks-only. Inline styles are OK for one-off, but CSS variables (`var(--accent)` etc.) should be used for tokens.
- Russian text is the default UI language. UZ-Latin variants where applicable (e.g. `o'g'li` / `qizi` middle names).

## When something is unclear

- **Big architectural choice?** Open a draft PR with the question + `[RFC]` in the title.
- **Spec drift?** Update `docs/superpowers/specs/` in the same PR.
- **Discovered a Phase 2 task?** Note it in the PR description so it lands in `docs/superpowers/plans/` (Phase 1.5 or Phase 2 plan).
