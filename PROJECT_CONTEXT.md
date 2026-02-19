# MyHeritage — Полная документация проекта

## Обзор

Интерактивное веб-приложение семейного дерева (вдохновлено MyHeritage). Монорепо с React фронтендом и Express бэкендом на PostgreSQL.

- **Язык интерфейса**: Русский (lang="ru")
- **Шрифт**: Nunito (Google Fonts)
- **Текущие тестовые данные**: семья Рустамовых-Усмановых, 13 человек, 4 поколения
- **Деплой**: https://myheritage.onrender.com (Render.com)
- **GitHub**: https://github.com/ulugbek3030/MyHeritage.git

---

## Стек технологий

| Слой | Технология |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite 7 |
| Backend | Express 4 + TypeScript |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens) + bcrypt |
| Layout Engine | `relatives-tree` v3.2.2 (MIT, 3KB) |
| HTTP Client | Axios (с auto-refresh interceptor) |
| Image Processing | smartcrop (client-side, browser Canvas API) |
| File Upload | Multer |
| Validation | Zod |
| CSS | Custom CSS Variables + BEM-like |

---

## Запуск проекта

```bash
# Оба сервера сразу (из корня)
npm run dev

# Или по отдельности
npm run dev:server   # Express на порту 3001
npm run dev:client   # Vite на порту 5176

# База данных
npm run db:migrate   # Миграции
npm run db:seed      # Тестовые данные
```

**Тестовый аккаунт**: `+9980000001` / `test123`

**Переменные окружения** (`.env` в корне):
```
DATABASE_URL=postgresql://localhost:5432/myheritage
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myheritage
DB_USER=ulugbek
DB_PASSWORD=
JWT_SECRET=your-super-secret-key
JWT_ACCESS_EXPIRES=24h
JWT_REFRESH_EXPIRES=7d
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

---

## Структура файлов

```
MyHeritage/
├── package.json              # Workspace root (server + client)
├── .env.example
├── .gitignore
├── prototype/
│   └── index.html            # Оригинальный HTML-прототип
│
├── database/migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_trees.sql
│   ├── 003_create_persons.sql
│   ├── 004_create_relationships.sql
│   ├── 005_add_tree_owner_fk.sql
│   └── 006_create_migrations_table.sql
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts                          # Express entry point, порт 3001 (ВАЖНО: public photo GET registered BEFORE treesRoutes!)
│       ├── config/
│       │   ├── auth.ts                     # JWT настройки
│       │   └── database.ts                 # PG connection config
│       ├── db/
│       │   ├── pool.ts                     # pg.Pool (max 20, query helper)
│       │   ├── migrate.ts                  # Migration runner
│       │   └── seed.ts                     # Тестовые данные (12 персон, 17 связей)
│       ├── middleware/
│       │   ├── authenticate.ts             # JWT verify → req.user
│       │   ├── authorize.ts                # Tree ownership → req.tree
│       │   ├── errorHandler.ts             # Global error handler
│       │   └── validate.ts                 # Zod schema validation
│       ├── routes/
│       │   ├── auth.routes.ts              # /api/auth/*
│       │   ├── trees.routes.ts             # /api/trees/*
│       │   ├── persons.routes.ts           # /api/trees/:treeId/persons/*
│       │   ├── relationships.routes.ts     # /api/trees/:treeId/relationships/*
│       │   └── photos.routes.ts            # Photo upload/delete
│       ├── services/
│       │   ├── auth.service.ts             # register, login, refresh, profile
│       │   ├── trees.service.ts            # CRUD + getFullTree + BFS generations
│       │   ├── persons.service.ts          # CRUD + relationship creation in transaction
│       │   ├── relationships.service.ts    # CRUD
│       │   └── photos.service.ts           # Upload (stores as-is, no processing) + getPhoto + delete
│       └── utils/
│           ├── errors.ts                   # AppError, NotFoundError, UnauthorizedError, etc.
│           └── validators.ts               # Zod schemas
│
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx                         # React entry point
        ├── App.tsx                          # Router + AuthProvider
        ├── types/
        │   └── index.ts                     # User, Person, Relationship, Tree, FullTree
        ├── api/
        │   ├── client.ts                    # Axios instance + token management
        │   ├── auth.ts                      # login, register, getMe, logout
        │   ├── trees.ts                     # listTrees, createTree, getFullTree, etc.
        │   └── persons.ts                   # createPerson, updatePerson, deletePerson, createRelationship
        ├── context/
        │   └── AuthContext.tsx               # AuthProvider + useAuth()
        ├── hooks/
        │   ├── useZoom.ts                   # Smooth zoom (lerp + rAF)
        │   ├── useDrag.ts                   # Drag-to-pan viewport
        │   └── useConnectors.ts             # SVG line drawing (legacy, не используется с relatives-tree)
        ├── pages/
        │   ├── LoginPage.tsx                # Телефон + пароль + "Запомнить меня"
        │   ├── RegisterPage.tsx             # Телефон + пароль
        │   ├── TreesListPage.tsx            # Главная: карточка дерева или кнопка создания
        │   └── TreeViewPage.tsx             # Основная страница дерева
        ├── components/
        │   ├── auth/
        │   │   └── ProtectedRoute.tsx       # Redirect to /login if !user
        │   └── tree/
        │       ├── TreeHeader.tsx            # Шапка: аватар, имя, статистика
        │       ├── FamilyTreeLayout.tsx      # relatives-tree layout + SVG lines
        │       ├── PersonCard.tsx            # Карточка персоны (174px)
        │       ├── PersonInfoPopup.tsx       # Popup с деталями персоны
        │       ├── AddPersonForm.tsx         # Форма добавления родственника (sibling hidden if no parents)
        │       ├── EditPersonForm.tsx        # Форма редактирования персоны
        │       ├── ConfirmDeleteDialog.tsx   # Диалог подтверждения удаления
        │       └── ZoomControls.tsx          # Кнопки +/−/↺
        ├── utils/
        │   ├── treeTransform.ts             # DB data → relatives-tree Node[] format
        │   └── imageProcessor.ts            # processAvatarClient() — smartcrop + canvas resize on client
        └── styles/
            ├── global.css                    # Reset, spinner, font import
            ├── variables.css                 # CSS custom properties
            ├── auth.css                      # Login/Register стили
            ├── trees-list.css                # Главная страница стили
            └── tree-view.css                 # Дерево: header, cards, popup, form, zoom (~970 строк)
```

---

## Схема базы данных

### users
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
phone           VARCHAR(20) UNIQUE NOT NULL    -- (migration 007: email → phone auth)
password_hash   VARCHAR(255) NOT NULL
avatar_url      VARCHAR(500)
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

### trees
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID NOT NULL → users.id CASCADE
name            VARCHAR(200) NOT NULL
description     TEXT
owner_person_id UUID → persons.id SET NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

### persons
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tree_id         UUID NOT NULL → trees.id CASCADE
first_name      VARCHAR(100)
last_name       VARCHAR(100)
middle_name     VARCHAR(100)
maiden_name     VARCHAR(100)
gender          VARCHAR(10) CHECK IN ('male', 'female')
birth_date      DATE
birth_year      SMALLINT
birth_date_known BOOLEAN DEFAULT false
is_alive        BOOLEAN DEFAULT true
death_date      DATE
death_year      SMALLINT
death_date_known BOOLEAN DEFAULT false
photo_url       VARCHAR(500)           -- URL path: /api/trees/:treeId/persons/:personId/photo
photo_data      BYTEA                  -- (migration 008: photos stored in DB as binary)
photo_mime      VARCHAR(50)            -- e.g. 'image/jpeg'
note            TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

### relationships
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
tree_id         UUID NOT NULL → trees.id CASCADE
category        ENUM ('couple', 'parent_child') NOT NULL
person1_id      UUID NOT NULL → persons.id CASCADE
person2_id      UUID NOT NULL → persons.id CASCADE
couple_status   ENUM ('married','civil','dating','divorced','widowed','other')
child_relation  ENUM ('biological','adopted','foster','guardianship','stepchild')
start_date      DATE
end_date        DATE
note            TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

-- Constraints:
-- person1_id != person2_id
-- (category='couple' → couple_status NOT NULL, child_relation IS NULL)
-- (category='parent_child' → child_relation NOT NULL, couple_status IS NULL)
```

**Конвенция**: для `parent_child` — `person1_id` = родитель, `person2_id` = ребёнок.

---

## API эндпоинты

### Auth (`/api/auth`)
| Method | Endpoint | Описание |
|--------|----------|----------|
| POST | /auth/register | Регистрация (phone, password) |
| POST | /auth/login | Вход (phone, password) → {user, accessToken, refreshToken} |
| GET | /auth/me | Профиль текущего пользователя |
| POST | /auth/refresh | Обновление токенов {refreshToken} → {accessToken, refreshToken} |
| POST | /auth/logout | Выход |

### Trees (`/api/trees`) — все требуют auth
| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | /trees | Список деревьев пользователя (с person_count) |
| POST | /trees | Создать дерево (name, description?) |
| GET | /trees/:id | Получить дерево (requires ownership) |
| PUT | /trees/:id | Обновить (name?, description?, ownerPersonId?) |
| DELETE | /trees/:id | Удалить дерево (CASCADE) |
| GET | /trees/:id/full | **FullTree**: tree + persons[] + relationships[] + generations[] |

### Persons (`/api/trees/:treeId/persons`) — все требуют auth + ownership
| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | /persons | Список персон дерева |
| POST | /persons | Создать (с опциональными relationships в теле) |
| GET | /persons/:personId | Получить персону |
| PUT | /persons/:personId | Обновить (partial) |
| DELETE | /persons/:personId | Удалить (+ unset owner if needed) |

### Relationships (`/api/trees/:treeId/relationships`)
| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | /relationships | Список связей |
| POST | /relationships | Создать (category, person1Id, person2Id, coupleStatus/childRelation) |
| PUT | /relationships/:relId | Обновить |
| DELETE | /relationships/:relId | Удалить |

### Photos (`/api/trees/:treeId/persons/:personId`)
| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | /persons/:personId/photo | **PUBLIC** (no auth!) — serve photo from DB BYTEA. Registered in app.ts BEFORE treesRoutes |
| POST | /persons/:personId/photo | Upload (multipart, max 5MB, jpeg/png/webp). Auth required |
| DELETE | /persons/:personId/photo | Удалить фото. Auth required |

---

## TypeScript типы (client/src/types/index.ts)

```typescript
interface User {
  id: string;
  phone: string;
  avatarUrl: string | null;
}

interface LoginData {
  phone: string;
  password: string;
  rememberMe?: boolean;    // true → localStorage, false → sessionStorage
}

interface RegisterData {
  phone: string;
  password: string;
}

interface Tree {
  id: string;
  name: string;
  description: string | null;
  ownerPersonId: string | null;
  personCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface Person {
  id: string;
  firstName: string;
  lastName: string | null;
  middleName: string | null;
  maidenName: string | null;
  gender: 'male' | 'female';
  birthDate: string | null;
  birthYear: number | null;
  birthDateKnown: boolean;
  isAlive: boolean;
  deathDate: string | null;
  deathYear: number | null;
  deathDateKnown: boolean;
  photoUrl: string | null;
  note: string | null;
}

type CoupleStatus = 'married' | 'civil' | 'dating' | 'divorced' | 'widowed' | 'other';
type ChildRelation = 'biological' | 'adopted' | 'foster' | 'guardianship' | 'stepchild';

interface Relationship {
  id: string;
  category: 'couple' | 'parent_child';
  person1Id: string;        // для parent_child: person1 = родитель
  person2Id: string;        // для parent_child: person2 = ребёнок
  coupleStatus: CoupleStatus | null;
  childRelation: ChildRelation | null;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
}

interface Generation {
  number: number;
  label: string;            // "Родители", "Дети", "Внуки" и т.д.
  personIds: string[];
}

interface FullTree {
  tree: { id, name, description, ownerPersonId };
  persons: Person[];
  relationships: Relationship[];
  generations: Generation[];
}
```

---

## Ключевые компоненты

### FamilyTreeLayout.tsx — Движок отрисовки дерева
- Использует `relatives-tree` библиотеку для вычисления позиций узлов
- `transformToTreeNodes()` конвертирует данные из БД в формат библиотеки
- Все связи **БИДИРЕКЦИОНАЛЬНЫЕ** (A→B и B→A)
- Константы: `NODE_WIDTH=210`, `NODE_HEIGHT=270`, `HALF_W=105`, `HALF_H=135`
- SVG коннекторы рисуются из `treeData.connectors` (только горизонтальные и вертикальные линии)
- Карточки позиционируются абсолютно через `transform: translate()`
- Экспортирует: `NODE_WIDTH`, `NODE_HEIGHT`, `HALF_W`, `HALF_H`

### treeTransform.ts — Трансформация данных
```typescript
interface TreeNode {
  id: string;
  gender: 'male' | 'female';
  parents: Array<{ id: string; type: 'blood' | 'adopted' | 'half' }>;
  children: Array<{ id: string; type: 'blood' | 'adopted' | 'half' }>;
  siblings: Array<{ id: string; type: 'blood' | 'half' }>;
  spouses: Array<{ id: string; type: 'married' | 'divorced' }>;
}
```

Маппинг:
- `adopted/foster/guardianship` → `'adopted'`
- `stepchild` → `'half'`
- `biological` и остальные → `'blood'`
- `divorced` → `'divorced'`, все остальные coupleStatus → `'married'`
- Siblings вычисляются автоматически по общим родителям (BFS)

### PersonCard.tsx
- Ширина: 174px, min-height: 210px
- Gender border: `border-top: 5px solid var(--male/female)`
- Аватар: 60px circle, иконка или фото
- Deceased: grayscale photo + dashed border ring + muted opacity
- Owner: gradient background + blue border + badge "Это вы"
- Кнопки edit/delete появляются при hover
- Plus-tab внизу карточки для добавления родственника
- **Порядок имени**: firstName lastName middleName (maidenName) — НИКОГДА фамилия первой

### useZoom.ts — Плавный зум
- Lerp анимация: `LERP=0.15`, `SETTLE=0.0005`, `MAX_SCALE=1.8`
- Динамический MIN_SCALE — вмещает всё дерево в viewport
- Обработка: Ctrl+Wheel, Meta+Wheel, gesturestart/gesturechange (macOS trackpad)
- GPU-ускорение: `will-change: transform` на контейнере
- `transform-origin: top center` на `.tree-container`
- Кнопки: +0.15 / -0.15 за клик, reset → scale=1

### useDrag.ts — Drag-to-pan
- Левая кнопка мыши, не на button/a/.popup-overlay
- Порог 3px перед маркировкой как drag (чтобы клик не считался за drag)
- `wasDragged()` — используется в handleCardClick для предотвращения открытия popup после drag

### AddPersonForm.tsx
- **Типы связей (chips)**: Ребёнок, Пара, Брат/Сестра (только если есть родители!), Родитель
- **Пара**: выбор coupleStatus (Муж/Жена, Гражданский брак, Встречаются, Разведены, Смерть супруга, Другое)
- **Ребёнок**: выбор childRelation + dropdown второго родителя (существующий партнёр / новый / без второго)
- **Брат/Сестра**: `hasParents` проверка — скрыто если target person без родителей (предотвращает orphan)
- **Пол**: подписи меняются в зависимости от relType (Сын/Дочь vs Мужской/Женский)
- **Дата рождения**: 3 режима (Не знаю / Только год / Полная дата)
- **Статус**: Жив(а) / Умер(ла) + дата смерти
- **Фото**: processAvatarClient() — smartcrop + resize на клиенте при выборе файла

### ConfirmDeleteDialog.tsx
- BFS поиск "сирот" — персон, которые станут недостижимы от owner
- Предупреждение если удаляется owner
- Список сирот, которые тоже будут удалены

---

## Токен-менеджмент (client/src/api/client.ts)

```
localStorage: REMEMBER_KEY='rememberMe' (флаг, '1' или отсутствует)

Если rememberMe='1': токены в localStorage (persistent)
Если rememberMe отсутствует: токены в sessionStorage (теряются при закрытии)

clearTokens() — чистит ОБА storage + удаляет флаг
```

**Auto-refresh**: Response interceptor ловит 401, вызывает `/auth/refresh`, ставит новые токены, повторяет запрос. Concurrent requests ставятся в очередь.

---

## Роутинг (App.tsx)

| Путь | Компонент | Защищён |
|------|-----------|---------|
| /login | LoginPage | Нет |
| /register | RegisterPage | Нет |
| / | TreesListPage | Да (ProtectedRoute) |
| /trees/:treeId | TreeViewPage | Да (ProtectedRoute) |
| * | → / | — |

---

## Вычисление поколений (trees.service.ts)

BFS от owner (`generation=0`):
- Родители → `generation - 1`
- Дети → `generation + 1`
- Партнёры → `same generation`
- Не связанные → `generation 0`

Метки:
| Offset | Label |
|--------|-------|
| -4 | Прапрадедушки и Прапрабабушки |
| -3 | Прадедушки и Прабабушки |
| -2 | Дедушки и Бабушки |
| -1 | Родители |
| 0 | Вы, Братья и Сёстры |
| +1 | Дети |
| +2 | Внуки |
| +3 | Правнуки |

---

## CSS Design System (variables.css)

```css
/* Gender */
--male: #4a90d9;   --male-light: #e8f1fb;   --male-bg: linear-gradient(135deg, #dbeafe, #c3d9f7);
--female: #e87ba8;  --female-light: #fdf0f5;  --female-bg: linear-gradient(135deg, #fce7f3, #f9c8dd);

/* Base */
--bg: #f0f2f6;  --card-bg: #ffffff;  --text: #1e293b;  --text-secondary: #64748b;  --text-muted: #94a3b8;

/* Shadows */
--shadow: 0 2px 8px rgba(0,0,0,0.06);
--shadow-hover: 0 12px 36px rgba(0,0,0,0.12);

/* Radius */
--radius: 16px;  --radius-sm: 8px;

/* Lines */
--line-color: #cbd5e1;

/* Typography */
--font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;

/* Functional */
--color-primary: #4a90d9;  --color-primary-hover: #3a7bc8;
--color-danger: #e74c3c;   --color-danger-hover: #c0392b;
```

**Header gradient**: `linear-gradient(135deg, #4a6cf7 0%, #7b68ee 50%, #a855f7 100%)`

---

## СТРОГИЕ правила отображения

1. **Порядок имени**: ВСЕГДА `firstName lastName middleName (maidenName)` — НИКОГДА фамилия первой
   - Пример: "Улугбек Рустамов" НЕ "Рустамов Улугбек"
   - Девичья фамилия в скобках после всего: "Нигора Исаева (Рустамова)"

2. **Дата на карточке**: если `birthDateKnown=true` → полная дата ("15 мар. 1984"); если только `birthYear` → год ("1984")

3. **Дата в popup**: полная локализованная дата (`toLocaleDateString('ru-RU', {day, month:'long', year})`) если known, иначе только год

4. **Deceased**: grayscale фото + dashed avatar border + muted opacity

5. **Линии**: все solid, кроме линии между разведёнными парами (dashed). Только горизонтальные и вертикальные — НИКАКИХ диагональных

6. **Gender coding**: blue border-top = male, pink border-top = female

---

## Middleware стек (бэкенд)

```
Request → CORS → JSON parser → [authenticate] → [authorize (tree ownership)] → Route Handler → Error Handler
```

- `authenticate`: JWT verify из `Authorization: Bearer <token>` → `req.user = {id, phone}`
- `authorizeTree`: Проверяет что tree.user_id === req.user.id → `req.tree`
- `validate(zodSchema)`: Парсит body через Zod, 400 с деталями ошибок при невалидности
- `errorHandler`: AppError → statusCode, ValidationError → 400 + errors[], unknown → 500

---

## Zod-схемы валидации (validators.ts)

```typescript
registerSchema:  phone (required), password (min 6)
loginSchema:     phone, password (required)
createTreeSchema: name (1-200), description (optional)
createPersonSchema: firstName (required), gender (male|female), birth/death fields, relationships[]
createRelationshipSchema: category, person1Id (UUID), person2Id (UUID), coupleStatus/childRelation
```

---

## Фото-загрузка (полный pipeline)

### Client-side (imageProcessor.ts)
- `processAvatarClient(file)` → smartcrop + canvas resize (256x256) + JPEG 85% quality
- Используется в AddPersonForm, EditPersonForm, OnboardingForm
- Fallback: если smartcrop fails, отправляет оригинал

### Server-side (photos.service.ts)
- Multer: temp file, max 5MB, jpeg/png/webp
- Хранение: PostgreSQL BYTEA column (`photo_data` + `photo_mime` в таблице persons)
- **НЕТ** обработки на сервере — файл сохраняется as-is (обработка на клиенте)
- URL в БД: `/api/trees/:treeId/persons/:personId/photo`

### КРИТИЧНО: Route ordering в app.ts
- Photo GET — **PUBLIC** (без auth), зарегистрирован как `app.get()` ПЕРЕД `treesRoutes`
- `treesRoutes` применяет `router.use(authenticate)` ко всем `/api/trees/*`
- Если photo GET будет ПОСЛЕ treesRoutes → 401 для `<img src="...">` (браузер не шлёт JWT)
- Photo POST/DELETE — через `photosRoutes` (с auth)

---

## Что НЕ реализовано (TODO)

1. **Удаление дерева** — API есть, кнопки в UI нет
2. **Drag-and-drop** для реорганизации
3. **Экспорт** (PDF/изображение)
4. **Мобильная адаптация** — есть базовый responsive breakpoints (768px, 480px)

## Решённые проблемы (НЕ ВОЗВРАЩАТЬСЯ к ним)

### Photo 401 — РЕШЕНО (commit c61fba6)
- **Проблема**: `<img src="/api/trees/.../photo">` получал 401 потому что `treesRoutes` с `router.use(authenticate)` перехватывал ВСЕ `/api/trees/*` запросы
- **Решение**: Photo GET зарегистрирован как `app.get()` прямо в app.ts ПЕРЕД treesRoutes
- **НЕ ЛОМАТЬ**: порядок регистрации роутов в app.ts критичен

### Image processing — на клиенте, НЕ на сервере (commit 2ee4097)
- smartcrop + canvas resize выполняются в браузере (`client/src/utils/imageProcessor.ts`)
- Сервер хранит файл as-is в PostgreSQL BYTEA
- `server/src/utils/imageProcessor.ts` — УДАЛЁН

### Sibling creation — hidden for persons without parents (commit e43a5dd)
- Опция "Брат/Сестра" в AddPersonForm скрыта если у target person нет родителей в дереве
- Причина: sibling-логика копирует parent_child связи; если родителей нет → orphan
- `hasParents` useMemo check в AddPersonForm.tsx

### Header pinned — flex-shrink: 0, NOT sticky (commit 4d91c7d)
- `.tree-header` использует `position: relative; flex-shrink: 0;` — НЕ sticky
- sticky не работает в `overflow: hidden` контейнерах
- `.tree-page` = `height: 100dvh; display: flex; flex-direction: column; overflow: hidden;`
