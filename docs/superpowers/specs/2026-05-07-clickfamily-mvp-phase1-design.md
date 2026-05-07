# Click Family — MVP Phase 1 (Local-only, без Click Integration API)

**Дата:** 2026-05-07
**Статус:** черновик, ждёт ревью пользователя
**Контекст:** Брейн-сессия от 2026-05-07. Цель — мини-апп семейного дерева внутри Click SuperApp. Phase 1 — локальная разработка стенда без зависимости от Click Integration API; Phase 2 — подключение интеграции и деплой в продакшен.

---

## 1. Цель Phase 1

Сделать **полнофункциональный standalone веб-прототип** мини-аппа Click Family, который:
- Запускается локально на машине разработчика (`npm run dev`).
- Не зависит от `api.click.uz/integration` (вся интеграция замокана).
- Реализует всё UX-ядро из брейн-сессии: дерево, формы добавления, карточка с CTA, календарь, Share.
- Использует тёмную тему Click (жёлтый акцент `#fbbf24`, чёрный фон `#0a0a0d`).
- Готов к "обёртыванию" в Phase 2 — добавлению вызовов Click Integration API и деплою на сервер.

**Phase 2 вне scope этого спека.** Для неё будет отдельный спек после получения документации по `api.click.uz/integration`.

---

## 2. Что входит в Phase 1 (MVP)

### 2.1. Ядро (без него ничего не работает)
- Авторизация: phone + OTP (mock SMS — фиксированный код `0000` в dev).
- CRUD persons (карточки родственников).
- CRUD relationships (couple, parent_child).
- Layout-движок дерева: используем `relatives-tree` v3.2.2 (как в исходном прототипе).
- Drag-to-pan + pinch-zoom + Ctrl+wheel zoom.
- Локализация: ru / uz-латиница.

### 2.2. Топ-10 фичей из брейн-сессии (адаптированы под locale)

| # | Фича | Поведение в Phase 1 |
|---|---|---|
| 1 | Бейдж "подтверждено гос-вом" | Поле `verified: bool` в БД, в Phase 1 ставится только админом или импортом seed-data |
| 2 | Календарь семейных событий | Считается на бэке по дереву (ДР, годовщины, годовщины смерти) |
| 3 | Многоуровневые ДР-пуши + CTA | Email/web-push в dev (без Click); CTA-кнопки ведут на placeholder "Coming in Phase 2" |
| 4 | "Этот в Click" + 1-tap инвайт | Отложено в Phase 2 (нужен `users.search` метод Click) |
| 5 | Прогресс-бар + квестовый онбординг | Считается клиентом; квесты — статичные подсказки |
| 6 | Поиск по дереву + breadcrumbs + мини-карта | Полностью локально |
| 7 | UZ-степени родства (tog'a/amaki/kelin/kuyov) | Полностью локально, в локалях |
| 8 | Privacy: видимость + подтверждение зачисления | Полностью локально (поле `tree.visibility: 'private'|'link'|'family'|'public'`) |
| 9 | Long-press quick actions | Полностью локально |
| 10 | Skeleton / offline / optimistic | Полностью локально |

### 2.3. Share-функция
- Read-only ссылка на дерево: `/family/u/<token>` (token = nanoid 8 chars, генерится в БД).
- 4 метода в модалке: Скопировать ссылку · QR-код · Картинка PNG · Click-чат (placeholder в Phase 1).
- Уровни приватности: По ссылке / Только семья / Публично.
- Тоглы: показывать ДР · показывать фото · разрешить правки.

### 2.4. Дата смерти — convention
| Состояние | На карточке (дерево) | В попапе/sheet |
|---|---|---|
| Неизвестно | `–` (прочерк) | `–` |
| Известен только год | `2010` | `2010` |
| Известна полная дата | `2010` (только год) | `15 мар. 2010` |

Аналогично для даты рождения (наследие из исходного прототипа).

---

## 3. Out of scope (Phase 2 и позже)

- **Click Integration API** (`api.click.uz/integration`, JSON-RPC 2.0) — методы для identity, профиля, госданных, push, поиска, каталога. Подключим в Phase 2.
- **Click SSO** — в Phase 1 пользователь логинится phone+OTP; в Phase 2 переключим на identity из URL/header от Click.
- **Семейные связи из госисточников** — в Phase 1 вводятся вручную; в Phase 2 импортируются через Click API.
- **Реальные платежи** (P2P, торты, цветы) — в Phase 1 placeholder buttons; в Phase 2 deep-link на Click Pay.
- **Реальный push** через Click — в Phase 1 web-push / email mock; в Phase 2 серверный API Click.
- **Слияние деревьев** — исключено из scope продукта (зафиксировано пользователем).

---

## 4. Стек

| Слой | Технология | Обоснование |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 7 | Совпадает с прототипом, отлажено |
| Backend | Express 4 + TypeScript | То же |
| DB | PostgreSQL 15+ | То же; locally через Postgres.app или Docker |
| Layout | `relatives-tree` v3.2.2 (MIT) | Уже выбрана и проверена в прототипе после миграции туда-обратно |
| Auth | JWT (access + refresh) + bcrypt | Тот же подход что в прототипе |
| Validation | Zod | То же |
| Image processing | smartcrop (client-side) + Canvas API | То же; сервер хранит BYTEA |
| OTP | Mock в dev (фиксированный код `0000`); в Phase 2 — Click SMS API или внешний провайдер | — |
| Stylling | Custom CSS variables (Click design tokens) | Без UI-фреймворка, для контроля над dark theme |
| State | React Context (auth) + локальные хуки | Без Redux/Zustand — пока избыточно |
| HTTP | Axios с auto-refresh interceptor | То же |
| Шрифт | Nunito (Google Fonts), как в прототипе | Узбекский язык поддерживается |

**Решение по новому репо vs форк прототипа:** **новый репо**. Причина — в прототипе много miграционного хаоса (76 коммитов на layout-движке: relatives-tree → family-chart → обратно). Чистый старт даст clean history. Часть кода (auth.service, persons.service, treeTransform.ts, useZoom.ts) — переносится из прототипа верифицированным куском.

---

## 5. Архитектура

```
┌─────────────────────────────────────────────────┐
│ CLIENT (Vite, React 19)                         │
│  pages/                                          │
│   ├ AuthPages (login, register, OTP)            │
│   ├ TreesListPage (список деревьев пользователя)│
│   ├ TreeViewPage (главный — hero + tree)        │
│   ├ FullTreePage (полное дерево, zoom & pan)    │
│   ├ CalendarPage (события)                      │
│   └ SharedTreePage (read-only вид по токену)    │
│  components/tree/                                │
│   ├ FamilyTreeLayout (relatives-tree)           │
│   ├ PersonCard (64px, dark theme)               │
│   ├ PersonSheet (bottom sheet с CTA)            │
│   ├ AddPersonForm (3 типа — parent/sibling/child)│
│   ├ LongPressMenu                                │
│   └ ShareModal                                   │
│  hooks/                                          │
│   ├ useZoom (universal — desktop+mobile+Safari) │
│   ├ useDrag                                      │
│   └ useEvents (cron-обновление календаря)       │
│  api/ (axios клиент)                             │
└─────────────────────────────────────────────────┘
                  ↕ JSON over HTTPS
┌─────────────────────────────────────────────────┐
│ SERVER (Express, port 3001)                     │
│  routes/                                         │
│   ├ /api/auth/*  (register, login, refresh, me) │
│   ├ /api/trees/* (CRUD + getFullTree)           │
│   ├ /api/persons/*                               │
│   ├ /api/relationships/*                         │
│   ├ /api/photos/* (public GET, auth POST/DELETE)│
│   ├ /api/events/* (computed by tree)            │
│   └ /api/share/* (link gen, public read)        │
│  services/ (business logic)                      │
│  middleware/ (auth, authorize, validate)         │
└─────────────────────────────────────────────────┘
                  ↕ pg
┌─────────────────────────────────────────────────┐
│ DB (PostgreSQL)                                 │
│  users, trees, persons, relationships,          │
│  share_links, otp_codes                         │
└─────────────────────────────────────────────────┘
```

### 5.1. Auth-flow (Phase 1)
1. Пользователь вводит телефон → `POST /api/auth/request-otp` → сервер пишет `otp_codes(phone, code='0000', expires_at)` в dev (или вызовет реальный SMS-провайдер позже).
2. Пользователь вводит код → `POST /api/auth/verify-otp { phone, code }` → если совпало, выдаётся access + refresh token (как в прототипе).
3. Дальше всё как в прототипе: ProtectedRoute, axios refresh-interceptor.

### 5.2. Расчёт календаря событий
- На сервере: `GET /api/events?from=&to=` обходит persons дерева, вычисляет ДР (если `birth_date_known` или `birth_year`), годовщины смерти (если `death_*`), годовщины свадеб (по `relationships.start_date` для category=couple).
- Возвращает массив с типом, датой, личностью, числом дней до события.

### 5.3. Phase 2 hook-points (заранее)
В коде server/services закладываются интерфейсы:
```typescript
interface ClickIntegration {
  verifyToken(token: string): Promise<UserIdentity>;       // Phase 2
  getUserProfile(userId: string): Promise<Profile>;        // Phase 2
  getUserRelatives(userId: string): Promise<Relative[]>;   // Phase 2
  searchByPhone(phone: string): Promise<UserHit[]>;        // Phase 2
  sendPush(userId, body): Promise<void>;                   // Phase 2
  paymentDeepLink(productId, params): string;              // Phase 2
}
```
В Phase 1 — `MockClickIntegration` возвращает заглушки. В Phase 2 заменяется на `RealClickIntegration` через JSON-RPC.

---

## 6. Модель данных

Наследуется из прототипа (`MyHeritage/PROJECT_CONTEXT.md`) с доп. полями:

```sql
-- ДОБАВЛЕНИЯ к схеме прототипа:

-- В таблицу persons:
verified           BOOLEAN DEFAULT false  -- "подтверждено гос-вом"; в Phase 1 ставится только seed/админом

-- В таблицу trees:
visibility         VARCHAR(20) DEFAULT 'private' -- 'private' | 'link' | 'family' | 'public'
share_token        VARCHAR(16) UNIQUE             -- nanoid для /family/u/:token
share_settings     JSONB DEFAULT '{}'             -- {showBirthDates, showPhotos, allowSuggestions}

-- Новая таблица:
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_otp_phone ON otp_codes(phone, expires_at);

-- Новая таблица для прав на чужие правки (опционально в Phase 1):
CREATE TABLE tree_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  from_phone VARCHAR(20),
  body TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'accepted' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Остальные поля (persons.first_name, last_name, gender, birth_date, death_date и т.д.) — без изменений из прототипа.

---

## 7. UX-источник

Все экраны и компоненты сделаны как HTML-мокапы в брейн-сессии:

| Экран | Файл (в `.superpowers/brainstorm/.../content/`) |
|---|---|
| Главный экран (финал, гибрид) | `home-final-share.html` |
| Полное дерево (30 чел) | `full-tree-30-v2.html` |
| Карточка крупно (tap + long-press) | `card-interactions.html` |
| Формы добавления (3 типа) | `add-flow-3-forms.html` |
| Календарь | `calendar-events.html` |
| Погружение в подсемью | `dive-into-subfamily.html` |
| Обзор всех экранов | `all-screens-overview.html` |

**Дизайн-токены:**
- `--bg: #0a0a0d` (основа)
- `--surface: #16161a` (карточки, sheet)
- `--accent: #fbbf24` (Click brand)
- `--verified: #22c55e` (бейдж гос-данных)
- `--male: #60a5fa`, `--female: #f472b6` (гендер)
- `--text: #fafafa`, `--text-muted: #71717a`
- Радиусы: card 14px, hero 22px, fab 18px
- Шрифт: SF Pro Text / Inter / Nunito; `font-feature-settings: 'tnum' 1` для tabular чисел.

---

## 8. Деплой

### Phase 1 (local)
- `npm run dev` запускает оба сервера: client на `http://localhost:5173`, server на `http://localhost:3001`.
- Postgres через Docker (`docker-compose.yml`) или локальный `postgres.app`.
- `npm run db:migrate` + `npm run db:seed` для тестовых данных (та же семья Рустамовых-Каримовых, расширим до 30 чел).

### Phase 2 (production)
- Hetzner (как `letscpo` / `letsdoit`), субдомен — например `family.letstrip.travel` (на старте) или `family.click.uz` (после партнёрских договорённостей).
- CI/CD через GitHub Actions: push в main → деплой на сервер (rsync с `--exclude '.env'`, по правилу `feedback_prod_env_safety.md`).

---

## 9. Структура репозитория (Phase 1)

```
clickfamily/
├── package.json (workspace root)
├── pnpm-workspace.yaml
├── .env.example
├── .gitignore
├── docker-compose.yml      (Postgres)
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-07-clickfamily-mvp-phase1-design.md (этот файл)
├── database/
│   └── migrations/
│       ├── 001_create_users.sql
│       ├── 002_create_trees.sql
│       ├── 003_create_persons.sql
│       ├── 004_create_relationships.sql
│       ├── 005_otp_codes.sql
│       ├── 006_share_link_fields.sql
│       └── 007_tree_suggestions.sql
├── server/
│   ├── package.json
│   └── src/
│       ├── app.ts
│       ├── config/ (auth, database)
│       ├── db/ (pool, migrate, seed)
│       ├── middleware/ (authenticate, authorize, validate, errorHandler)
│       ├── routes/ (auth, trees, persons, relationships, photos, events, share)
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── otp.service.ts
│       │   ├── trees.service.ts
│       │   ├── persons.service.ts
│       │   ├── relationships.service.ts
│       │   ├── photos.service.ts
│       │   ├── events.service.ts (расчёт календаря)
│       │   ├── share.service.ts
│       │   └── click-integration/
│       │       ├── interface.ts (ClickIntegration interface)
│       │       └── mock.ts (Phase 1 заглушки)
│       └── utils/ (errors, validators)
└── client/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types/
        ├── api/ (client, auth, trees, persons, events, share)
        ├── context/ (AuthContext)
        ├── hooks/ (useZoom, useDrag, useEvents, useShareSheet)
        ├── pages/ (Login, OTP, Register, TreesList, TreeView, FullTree, Calendar, SharedTree)
        ├── components/
        │   ├── tree/ (FamilyTreeLayout, PersonCard, PersonSheet, AddPersonForm, LongPressMenu, ShareModal)
        │   └── ui/ (Hero, NudgeProgress, QuickActions, FAB, BottomSheet)
        ├── utils/ (treeTransform, imageProcessor, dateFormat, uzNamings)
        └── styles/ (variables.css — Click dark tokens, global.css)
```

---

## 10. Риски и митигации

| Риск | Митигация |
|---|---|
| Layout-движок снова поломается на больших деревьях (>50 чел) | Использовать `relatives-tree` сразу с теми же fix'ами (FAMILY_GAP, birth-order siblings); не пытаться переписывать движок в Phase 1 |
| OTP mock в dev утечёт в prod | В коде явный `if (NODE_ENV === 'production') throw new Error('OTP mock disabled in production')` |
| Click Integration в Phase 2 окажется сильно отличающейся от моков | Интерфейс `ClickIntegration` должен быть минимальным и заменимым; не закладываемся на конкретные поля API |
| Узбекские имена с o'g'li / qizi сломают БД на спецсимволах | UTF-8 везде; PostgreSQL `text` колонки; тесты с реальными UZ-именами в seed |
| Dark theme плохо смотрится на части устройств | Прототип уже задеплоен на render.com и проверен на телефоне; те же токены в новом проекте |

---

## 11. Что после Phase 1

1. **Phase 1.5 — мок-апсейлы.** Кнопки "Подарить" в hero/sheet/calendar показывают placeholder-модалку "Скоро будет в Click". Это позволит снять обратную связь по UX без реальных платежей.
2. **Phase 2 — Click Integration.** Подключаем `api.click.uz/integration` (JSON-RPC 2.0), заменяем `MockClickIntegration` на `RealClickIntegration`. Получаем доку по реальным методам. Подключаем real auth, real push, real deep-links.
3. **Phase 3 — Виральность.** "Этот в Click" + 1-tap инвайт + sharing в Click-чат через native API.

---

## 12. Что нужно от пользователя для старта Phase 1

- ✅ Зафиксированный scope (этот спек) → ревью.
- ⏸ Postgres локально (Docker или Postgres.app) — будет в plan'е первым шагом.
- ⏸ Имя репо на GitHub (предложение: `clickfamily` или `click-family-tree`) — обсудим в plan'е.
- ❌ Click Integration детали (auth-схема, документация методов, env-переменные) — **не нужны** для Phase 1.

---

**Готов к ревью.** Если что-то не так — поправлю и перепишу. После approval — генерирую implementation plan через `superpowers:writing-plans` skill.
