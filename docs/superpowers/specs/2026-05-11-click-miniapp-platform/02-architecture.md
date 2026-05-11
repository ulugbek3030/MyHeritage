# Click Mini-Apps Platform — Архитектура

**Дата**: 11 мая 2026
**Аудитория**: техническая команда Click (архитектор, тех.лиды, security)
**Документ**: полное описание архитектуры
**Связанные файлы**: `01-presentation.md` (управленческое резюме), `03-requirements.md` (требования)

---

## 1. Высокоуровневая топология

Программа состоит из **трёх плоскостей**, каждая со своим контуром ответственности и собственными компонентами.

### 1.1. Developer Plane — что видит разработчик

| Компонент | Назначение |
|---|---|
| `miniapps.click.uz` | Личный кабинет разработчика: регистрация, KYC, создание мини-аппа, Security Scanner, submission, статусы ревью, kill-switch уведомления, Webhook Inspector, Sandbox Launcher |
| `git.miniapps.click.uz` | GitLab CE на инфраструктуре Click. Содержит template-репозитории и форки разработчиков |
| `docs.miniapps.click.uz` | Портал документации (статический сайт, версионируется по API) |

### 1.2. Runtime Plane — где живёт мини-апп и его взаимодействие с Click

| Компонент | Назначение |
|---|---|
| Мини-апп | Self-hosted на инфре разработчика. Click не имеет доступа к коду runtime (только к репо в sandbox-этапе) |
| `sandbox.api.click.uz` | Тестовый API с предзаданными пользователями, fake-платежами, fake-push |
| `api.click.uz` | Production API — профиль, платежи, push, webhooks |
| `auth.click.uz` | Identity provider Click. Выдаёт `click_session_token` (JWT, RS256) при открытии мини-аппа во WebView Click. Публикует JWKS на `/.well-known/jwks.json` |
| Click app marketplace | Существующий нативный каталог мини-аппов в Click |

### 1.3. Governance Plane — что видит и делает Click внутри

| Компонент | Назначение |
|---|---|
| Admin Console | Внутренний веб-кабинет для сотрудников: moderation queue, KYC, договоры, marketplace control, push template registry, audit viewer |
| Daily Fingerprint Bot | Cron-сервис, каждые 24 ч снимает fingerprint всех live мини-аппов и сравнивает с эталоном |
| Push Template Registry | Утверждённые push-шаблоны с метаданными (окна, лимиты, переменные) |
| Moderation Queue | Очередь submissions, kill-switch trigger'ов, user-жалоб с приоритизацией |
| Audit Log | Иммутабельная цепочка всех значимых действий — API-вызовов, webhook-доставок, change request'ов, kill-switch'ей |

### 1.4. Принципы взаимодействия плоскостей

- Три плоскости общаются строго через определённые API
- Мини-апп **никогда** не дёргает Governance Plane напрямую
- Менеджер **никогда** не правит данные Runtime Plane вручную в обход Admin Console
- Все cross-plane вызовы пишутся в audit log

---

## 2. Жизненный цикл разработчика — end-to-end

### Этап 1: Регистрация (тир K0)

1. Разработчик заходит на `miniapps.click.uz`, логинится через Click SSO (если нет аккаунта Click — сначала регистрация в Click стандартным флоу)
2. Заполняет минимальный профиль: email, телефон (если не пришёл из Click), отображаемое имя
3. Соглашается с условиями песочницы
4. Автоматически создаётся учётка в GitLab CE (`git.miniapps.click.uz`), привязывается к Click-учётке через SSO
5. Возвращается на `miniapps.click.uz`, тир K0 присвоен → доступна песочница

**Ограничения K0**: нет production возможностей. Sandbox-токены живут до 6 месяцев неактивности — после этого репо архивируется (восстановление по запросу менеджера).

### Этап 2: Создание мини-аппа

1. Кнопка «Создать мини-апп»: разработчик указывает название, описание, целевой capability-уровень (L1/L2/L3/L4), категорию каталога
2. Автоматически создаётся GitLab-репо из template'а соответствующего уровня
3. Разработчик добавлен в репо как `maintainer`
4. Генерируются sandbox credentials:
   - `client_id` (публичный)
   - `client_secret` (приватный, показывается один раз)
   - `webhook_url` (изначально заглушка, разработчик меняет на свой)
5. Карточка мини-аппа в кабинете со статусом «**В разработке**»

### Этап 3: Разработка в песочнице

1. Разработчик клонит репо, поднимает локально, поднимает свой webhook-handler (или использует Cabinet Webhook Inspector для отладки)
2. Открывает Sandbox Launcher на `miniapps.click.uz`:
   - Выбирает тестового пользователя из 10–20 предзаданных
   - Мини-апп грузится в iframe-эмуляторе с подложенным `click_profile` cookie
3. Тестирует все user-flows
4. Запускает Cabinet Security Scanner → исправляет critical/high issues
5. Запускает Sandbox Test Suite (idempotency webhook'ов, подписи, обработка ошибок)
6. Читает документы на `docs.miniapps.click.uz`

### Этап 4: Подготовка к production submission

1. В кабинете «Подать на production»
2. Запрашивается апгрейд KYC до K1 — разработчик прикладывает:
   - Документы юр.лица / ИП / самозанятого
   - Подтверждение собственности на домен через DNS TXT-record
   - Контакты support'а
3. Менеджер проверяет → переводит в K1, статус договора — `not_started`
4. Менеджер инициирует подписание договора оферты **вне платформы** (E-IMZO / бумага / DocuSign — на усмотрение менеджера) → по факту подписания выставляет в Admin Console `signed_verified`
5. Для L3 — апгрейд до K2: реквизиты расчётного счёта + расширенный договор для платежей
6. Для L4 — апгрейд до K3: privacy policy на сайте мини-аппа + ФИО ответственного за обработку ПДн + push-шаблоны для регистрации
7. Для L3/L4 — обязательный отчёт от утверждённого Click-пентестера

### Этап 5: Submission + Review

**Auto-checks (30 минут SLA)**:
- TLS / certificate chain (минимум TLS 1.2)
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Lighthouse audit: performance ≥ 70, accessibility ≥ 90, best practices ≥ 90
- Sandbox Test Suite (idempotency, подписи, error handling)
- Broken links / 5xx pages
- Обязательные страницы: privacy, terms, support contact, refund policy (для L3+)
- DNS TXT-record повторно сверяется
- Bundle size, time-to-interactive, отсутствие запрещённых tracker'ов
- **Те же чеки, что в Cabinet Security Scanner** — никаких сюрпризов на финальной проверке

Зелёный → попадает к менеджеру. Красный → возврат разработчику со списком issues.

**Manual review (7 раб.дней SLA)**:
- Контент-ревью (запрещённые тематики из политики)
- UX-ревью (Click Design Guidelines)
- Локализация (русский + узбекский обязательны)
- Документы (договор `signed_verified`, privacy policy осмыслена, support работает)
- Для L3 — финансовый чек (pricing, refund, disputes)
- Для L4 — каждый push-шаблон отдельно (текст, переменные, CTA, окно, лимиты)

**Результат**: Approve / Reject со списком замечаний.

**Resubmission (3 раб.дня SLA)**:
- Delta-review: full auto-checks + менеджер смотрит только изменённые разделы
- Без штрафа на количество resubmission'ов

### Этап 6: Production & Lifecycle

После Approve:
1. Мини-апп переключается в `production`, выдаются новые production credentials (отдельные от sandbox)
2. Попадает в Click marketplace под выбранную категорию
3. Daily Fingerprint Bot начинает мониторить
4. Пользователи Click видят мини-апп в нативном каталоге

См. подробно раздел 6 (Production Compliance Requirements).

---

## 3. Three-channel API + модель безопасности

Технический контракт строится на **трёх раздельных каналах** с разными моделями безопасности.

### 3.1. Канал 1 — WebView Bridge (Click → frontend мини-аппа)

**Назначение**: мгновенный SSO + контекст пользователя при открытии мини-аппа во WebView Click.

**Механика**:
- Click при открытии мини-аппа во WebView подкладывает:
  - Cookie `click_profile` (URL-encoded JSON): `user_id`, `phone`, `full_name`, `avatar_url`, `kyc_status`, `region`, `language`
  - JS-объект `window.Click = { profile, sessionToken }`
- `sessionToken` — JWT, подписанный Click через RS256
  - TTL: 15 минут
  - Открытый ключ публикуется на `auth.click.uz/.well-known/jwks.json`
  - Claims: `sub` (user_id), `aud` (client_id мини-аппа), `iat`, `exp`, `scope`
- Frontend мини-аппа отдаёт `sessionToken` своему backend → backend верифицирует подпись + срок + `aud` → доверяет identity
- Renewal: каждое открытие мини-аппа из Click выдаёт свежий токен. **Long-lived refresh не предусмотрен** — если пользователь закрыл и долго не возвращался, нужно открыть из Click заново
- Outside Click WebView (разработчик открыл свой мини-апп в обычном Chrome для теста): `window.Click` отсутствует, мини-апп показывает «Откройте через Click» или fallback UI

**Что недопустимо**: НИКАКОЙ доступ к платежам/push из этого канала. Frontend не может инициировать списание. Frontend может только узнать identity и отрисовать UI.

### 3.2. Канал 2 — Backend API (мини-апп backend → Click)

**Назначение**: серверные операции — инициация платежа, отправка push по утверждённому шаблону, запрос баланса/статуса.

**Механика**:
- Каждой среде мини-аппа (sandbox / production) — отдельная пара `client_id` + `client_secret`. Никогда не используются крест-накрест
- Подпись запроса:
  ```
  signature = HMAC-SHA256(
    client_secret,
    METHOD + "\n" + PATH + "\n" + body + "\n" + X-Click-Timestamp + "\n" + X-Click-Nonce
  )
  ```
  Передаётся в заголовке `X-Click-Signature`
- Click отвергает запрос если:
  - Timestamp устарел >5 мин
  - Nonce уже использован за последние 24 часа (replay protection)
  - Подпись не сходится
  - Scope недостаточен (`403 insufficient_scope`)
- Scopes:
  - L1: `profile:read`
  - L2: `+ profile:extended`
  - L3: `+ payments:create + payments:read`
  - L4: `+ push:send`
- Step-up auth для платежей: `POST /payments` создаёт `pending_payment_id`; Click показывает пользователю confirmation-экран внутри Click (нативный UI, не frontend мини-аппа); после подтверждения — webhook `payment.succeeded`
- Rate-limit: общий для мини-аппа + persona per-user. При превышении — `429 Too Many Requests` с `Retry-After`

**Ротация `client_secret`**: разработчик может сгенерировать новый в любой момент. Старый работает 24 часа после ротации (grace period).

### 3.3. Канал 3 — Webhooks (Click → мини-апп backend)

**Назначение**: асинхронные события.

**События**:
- `payment.succeeded`, `payment.failed`, `payment.cancelled`
- `push.delivered`, `push.opened`, `push.dismissed`
- `user.consent_revoked` (пользователь отозвал право мини-аппа доступа)
- `mini_app.kill_switched`, `mini_app.reactivated`

**Механика**:
- HTTP POST на `webhook_url` мини-аппа
- Headers:
  - `X-Click-Event-Id` (UUID, уникальный per event)
  - `X-Click-Event-Type` (например `payment.succeeded`)
  - `X-Click-Timestamp`
  - `X-Click-Signature` (HMAC-SHA256 от тела + timestamp на `client_secret`)
- Мини-апп обязан вернуть **2xx за <5 сек**
- Retry policy: exponential backoff (1m, 5m, 15m, 1h, 6h, 24h)
  - Triggers: 5xx, timeout, 4xx (кроме 410)
  - После 24 часов — событие в DLQ кабинета, разработчик может ретранслировать вручную
- `410 Gone` от мини-аппа = «не обрабатываю» → событие `dropped`, дальше не пытаемся
- Идемпотентность через `event_id` — Click не гарантирует ровно одну доставку, мини-апп хранит processed events и пропускает дубликаты

**Webhook URL change**: через Manifest Update (delta-review, 3 раб.дня).

### 3.4. Общая security модель

**Domain pinning**:
- При K1 разработчик подтверждает домен через DNS TXT-record (`_click-verify.example.uz` со значением, сгенерированным Click)
- Домен фиксируется в Admin Console и проверяется Fingerprint Bot'ом каждые 24 часа
- Поддомены допустимы только из явно объявленного pattern (например, `*.shop.example.uz`)

**Scope enforcement**: мини-апп физически не может вызвать endpoint вне своего capability-уровня. Попытка вызова `POST /payments` с L1-токеном → `403 insufficient_scope`.

**Audit log**: каждый API-вызов, каждый webhook, каждый WebView session token пишется в Audit log Click. Retention определяется внутренней политикой Click и применимым законодательством. Разработчик в кабинете видит свою часть log'а — последние 30 дней онлайн, более глубокая выгрузка — по запросу через менеджера.

**Compliance с UZ Data Law**: ПДн пользователей (phone, full_name, KYC документы) обрабатываются и хранятся на инфре в Узбекистане. Click при выдаче `click_profile` в WebView передаёт минимум необходимого для функционирования мини-аппа на его capability-уровне:
- L1: `user_id`, `full_name`, `phone`, `avatar_url` (базовый SSO-набор — пользователь видит, что открыл мини-апп через Click, и предполагает доступ к минимальному профилю)
- L2+: то же + `kyc_status`, `region`, `language` — с явного consent пользователя при первом открытии мини-аппа этого уровня (Click показывает нативный consent screen)

---

## 4. Governance — KYC, ревью, lifecycle

### 4.1. KYC Tiers

| Тир | Кто допустим | Что собирается | Что разрешено |
|---|---|---|---|
| **K0 — Sandbox** | любой человек с Click-аккаунтом | email, телефон, согласие | играть в sandbox, GitLab-репо, sandbox API |
| **K1 — Prod L1/L2** | юр.лицо / ИП / самозанятый | реквизиты, ИНН/СТИР, DNS-подтверждение домена, контакты support'а, договор оферты | публикация информационных мини-аппов, scope'ы `profile:read` + `profile:extended` |
| **K2 — Prod L3** | K1 + расчётный счёт | банковские реквизиты, расширенный договор оферты, pen-test отчёт от утверждённой компании | + `payments:create + payments:read` |
| **K3 — Prod L4** | K2 + DPO + privacy policy | privacy policy на сайте мини-аппа, ФИО ответственного за обработку ПДн, утверждённые push-шаблоны | + `push:send` |

**Лестница, не параллельные треки**: K1 → K2 → K3 апгрейдится инкрементально. K3 наследует требования K2, K2 — K1.

**Понижение**: возможно по запросу разработчика (например, закрыл ИП, переходит на самозанятого → K2 ↘ K1 после переоформления).

**Один разработчик — несколько мини-аппов**: возможно. Каждый подаётся на свой целевой тир независимо.

**Подписание договоров — вне платформы**: менеджер вручную выставляет статус в Admin Console (`not_started → in_negotiation → signed_verified`). До `signed_verified` доступ к production заблокирован. Инструмент подписания выбирает менеджер.

### 4.2. Submission Review (детально см. этап 5)

**SLA**:
- Auto-checks: 30 минут
- Manual review: 7 раб.дней
- Resubmission delta: 3 раб.дня

**Pen-test для L3/L4**:
- Обязателен отчёт от утверждённой Click-пентестерской компании (список публикуется на `docs.miniapps.click.uz`)
- Валидность отчёта — 12 месяцев с даты выпуска
- За 30 дней до expiry — алерт в кабинете
- За 7 дней до expiry — submission на новые releases блокируется
- В день expiry — мини-апп переводится в read-only mode: платежи и push блокируются, profile-read остаётся
- Cabinet Security Scanner НЕ заменяет pen-test (shift-left для базовых OWASP, pen-test — для IDOR, broken auth, бизнес-логики, race conditions)

### 4.3. Production Compliance Requirements

См. подробно раздел 6.

### 4.4. Roles в Click Admin Console

| Роль | Ответственность |
|---|---|
| **Reviewer** | Manual review submissions, approve/reject решения |
| **Moderator** | User-жалобы, kill-switch |
| **Compliance Manager** | Договоры, KYC, апгрейд тиров |
| **Security Officer** | Красные уведомления (фрод, утечки, fingerprint critical), эскалация в фин.разведку |
| **Admin** | Суперюзер (для расследований), все действия логируются отдельно |

Один сотрудник может иметь несколько ролей; action'ы каждой роли логируются в audit log отдельно.

---

## 5. Песочница (sandbox) — что внутри

Базовый набор тестовой инфраструктуры:

### 5.1. Предзаданные тестовые пользователи (10–20 штук)

Зафиксированные user_id с разными атрибутами:
- `kyc_full`, `kyc_simplified`, `kyc_none`
- `no_phone` (для проверки fallback'а)
- Разные регионы (Ташкент, Самарканд, Бухара)
- Имена на узбекском (латиница), узбекском (кириллица), русском, английском

### 5.2. Sandbox Launcher

Кнопка «Открыть в WebView-эмуляторе» в кабинете. iframe с URL мини-аппа + `click_profile` cookie + `window.Click`. Имитирует Click WebView. Разработчик тестирует без установки реального Click.

### 5.3. Fake-платежи

`POST /payments` всегда возвращает `payment_id`. По умолчанию через 5 сек → webhook `payment.succeeded`. Query-параметры:
- `?force_decline=true` → `payment.failed`
- `?force_webhook_delay=30s` → проверка таймаутов
- `?force_webhook_fail=true` → проверка retry-логики

### 5.4. Fake-push

`POST /push/send` НЕ шлёт на реальные устройства. Уходит в Sandbox Inbox в кабинете — разработчик видит контент и вручную симулирует `delivered` / `opened` / `dismissed`.

### 5.5. Webhook Inspector

Если у разработчика нет публичного URL (типичный локальный dev), все события сохраняются в кабинете с возможностью replay. Альтернатива — указать ngrok-URL для прямой доставки.

### 5.6. Изоляция от production

Sandbox API полностью отделён: другой домен (`sandbox.api.click.uz`), другие ключи, другие пользователи. Никакого риска «тестовая транзакция случайно списала деньги».

---

## 6. Production Compliance Requirements

Контрактные требования, отображаемые в кабинете во вкладке «Что нужно поддерживать в проде» **до первого submission**.

### 6.1. Что отслеживает Daily Fingerprint Bot

**🔴 Auto-disable (немедленно, без участия модератора)**:
- TLS-сертификат экспайрился / chain broken
- Главная страница возвращает 5xx >3 раз подряд за час
- Mini-app домен переехал на IP/CNAME вне approved (domain pinning broken)
- Появились новые внешние JS/CSS/iframe-домены, не объявленные на ревью (особенно: tracking pixels, ads networks, crypto miners, неизвестные CDN)
- CSP ослаблен: добавлен `unsafe-eval`, `unsafe-inline` для script-src, открыты `*` без декларации
- Появились формы для сбора паролей/карт/ПДн, не объявленные на ревью
- Запросы на blacklisted домены (известные malware/phishing из threat-intel feed)
- 5+ user-жалоб за 24 ч в категории fraud / phishing / data leak
- Cabinet Security Scanner находит Critical-уязвимость, не исправленную в течение 24 часов
- Webhook handler возвращает 5xx на 100% событий >1 часа (отключаются только scope'ы L3/L4, не весь мини-апп)

**🟡 Flag в moderation queue (ручной разбор, мини-апп остаётся live)**:
- Текст основных страниц изменился >30% от эталона
- Структурные DOM-изменения
- 1–4 user-жалобы за 24 ч в категориях UX/контент
- Medium/Low security findings
- Изменения privacy/terms/support страниц

### 6.2. Превентивные требования к разработчику

1. **TLS** — auto-renewal (Let's Encrypt или эквивалент) + алерт за 30 дней до expiry на email; никогда self-signed, никаких wildcard вне approved scope
2. **Стабильность домена** — DNS изменения через **Change Request** в кабинете за 7 дней; внутри Click — mini-review 1 раб.день; после approve fingerprint bot принимает новый IP без алерта
3. **Внешние зависимости** — любая новая внешняя зависимость → **Manifest Update** → delta-review (3 раб.дня) → деплой; аналитика только из утверждённого списка (Yandex Metrika, Google Analytics, Plausible, Matomo)
4. **Security headers / CSP** — не ослаблять. Усиление без review. Ослабление — через Manifest Update
5. **Сбор данных пользователя** — любая новая форма (особенно password / payment / PII) → Manifest Update с указанием цели, retention, политики хранения; существующие формы можно дорабатывать без декларации (UX, валидация), но не менять список полей
6. **Uptime / availability** — разработчик сам мониторит uptime; запланированное обслуживание → **Maintenance Window** в кабинете (например, «02:00–03:00 30 декабря»); в окне Maintenance fingerprint bot не флагает 5xx; внеплановый downtime — нужно быстро восстановить, повторные длительные падения (>2 ч несколько раз в месяц) → предупреждение менеджера
7. **Push-шаблоны (L4)** — утверждённые шаблоны нельзя править; нужно изменение → новый шаблон → отдельный review; превышение rate-limit → auto-deactivate шаблона + flag
8. **Webhook reliability** — 2xx за <5 сек; идемпотентность через `event_id`; падение 100% >1 ч → scope'ы L3/L4 временно блокируются (пользователь видит «временно недоступно»)
9. **Security Scanner hygiene** — запускать минимум раз в неделю; Critical — 24 ч, High — 7 дней, Medium/Low — рекомендация
10. **User reports** — смотреть жалобы в кабинете, отвечать в течение 48 часов через cabinet messaging; игнорирование → эскалация модератору

### 6.3. Что происходит при auto-disable

1. Мини-апп мгновенно исчезает из Click marketplace (deep-link → 404)
2. Production credentials отзываются — API-вызовы возвращают 403
3. WebView session-токены инвалидируются — открытые экземпляры мини-аппа перестают работать
4. Pending платежи → `cancelled`, средства возвращаются
5. Pending push-уведомления → отменяются
6. Разработчик получает email + push в Click + уведомление в кабинете:
   - Точная причина (какой fingerprint diff / security violation / категории и количество жалоб)
   - Полный отчёт сканера
   - Срок на устранение: 5 раб.дней (для critical fraud — 24 ч)
   - Инструкция по re-activation

### 6.4. Re-activation

1. Разработчик исправляет проблему по списку
2. В кабинете «Запросить re-activation», прилагает описание исправления
3. Запускается **полный** auto-review (не delta) + менеджер смотрит вручную (3 раб.дня)
4. Approve → мини-апп возвращается live с теми же production credentials
5. Reject → возврат с уточнениями, новый attempt

### 6.5. Эскалация повторных нарушений — через менеджера, не автоматически

- **3 kill-switch за 12 мес** → 🔴 высокоприоритетное уведомление менеджеру с полным досье; менеджер решает (warning / штраф / дополнительный audit / расторжение договора)
- **2 auto-disable за 6 мес** → 🟡 уведомление менеджеру + рекомендация запросить новый pen-test
- **3 auto-disable за 6 мес** → 🔴 уведомление менеджеру для решения о permanent removal / расторжении
- **Fraud / phishing / data leak (первая инстанция)** → 🔴 уведомление + рекомендация немедленного расторжения + передача в фин.разведку UZ

**Никаких автоматических расторжений / permanent removal.** Система только эскалирует с подсветкой; финальное решение всегда у менеджера.

---

## 7. Developer Experience — что реально получает разработчик

### 7.1. Documentation Portal (`docs.miniapps.click.uz`)

Статический сайт (Docusaurus или MkDocs Material), версионирован по API (`v1`, `v2`, …). Языки: русский primary, узбекский (latin + cyrillic), английский опционально.

Разделы:
- **Getting Started** — 15 минут от регистрации до работающего sandbox
- **Architecture** — три плоскости, три канала (концептуально)
- **API Reference** — OpenAPI 3.1 spec, все endpoints, scopes, error codes
- **WebView Bridge Reference** — JS API, формат `click_profile` cookie, JWT structure
- **SDK Reference** — JS/Node SDK + типы
- **Capability Tiers** — что доступно/обязательно на L1/L2/L3/L4
- **Security** — что обязан реализовать разработчик (CSP, HSTS, signature validation), security checklist
- **Design Guidelines** — палитра Click, типографика, размеры тач-таргетов, тёмная/светлая тема, поведение в WebView, deep-link
- **Content Policy** — что запрещено в Click marketplace
- **Push Templates** — как составлять, переменные, окна, rate-limit
- **Lifecycle & Compliance** — Production Compliance Requirements целиком
- **Cabinet Guide** — Security Scanner, Webhook Inspector, Sandbox Launcher
- **FAQ + Support contacts**

### 7.2. SDK

**`@click/miniapp-sdk` (JavaScript, frontend)**
- Тонкая обёртка над WebView Bridge
- Чтение `click_profile`, проверка `sessionToken`
- Типизированные модели, TypeScript types
- Helpers для deep-link и navigation внутри Click
- ESM + CommonJS, ~10kb gzipped

**`@click/miniapp-backend-sdk` (Node.js)**
- Обёртка над Backend API + Webhooks
- HMAC-подписание исходящих запросов
- Валидация подписей входящих webhook'ов
- Типизированные модели платежей/push
- Exponential backoff retry
- Helpers для идемпотентности (Redis / Postgres adapter)

На MVP — только JS/Node. PHP / Python / Go SDK — позже, когда программа взлетит. Разработчики на других стеках используют raw HTTP + OpenAPI spec.

### 7.3. GitLab Repo Templates

Под каждый capability-уровень — отдельный template в `git.miniapps.click.uz/templates/`:

| Template | Содержимое |
|---|---|
| **L1-template** | React + Vite SPA, пример чтения `click_profile`, deep-link, GitLab CI с linting, README |
| **L2-template** | L1 + примеры extended profile |
| **L3-template** | L2 + Node.js backend с инициацией платежа, webhook handler + подпись + идемпотентность, integration tests, Docker для локального запуска |
| **L4-template** | L3 + регистрация push-шаблонов, отправка push, отображение в Sandbox Inbox |

При создании мини-аппа разработчик выбирает целевой уровень → template форкается в его namespace.

### 7.4. Cabinet Security Scanner (shift-left)

Встроенный в `miniapps.click.uz` инструмент. Запускается вручную или по cron (раз в сутки).

Проверки:
- Security headers (Mozilla Observatory эквивалент)
- TLS / certificate chain
- OWASP ZAP baseline scan (passive — без активной атаки)
- Lighthouse audit
- CSP анализ + список внешних доменов с JS
- Broken links / 5xx
- Mixed content / insecure cookies
- DNS / domain hijacking flags

Отчёт с приоритетами (Critical / High / Medium / Low), история сканов, diff по сравнению с прошлым прогоном. **Security Score** (0–100) виден как индикатор готовности к submission.

**Единый источник истины**: ровно те же чеки автоматически прогоняются на production submission. То, что зелёное в кабинете, будет зелёным на ревью.

**Граница со внешним pen-test**: cabinet scanner — только black-box automatic. Глубокая ручная часть (IDOR, broken auth, бизнес-логика, race conditions) — за утверждённым внешним пентестером.

---

## 8. Click-side operational components — детально

### 8.1. Admin Console

Внутренний веб-кабинет для сотрудников Click.

Модули:
- **Moderation Queue** — submissions, kill-switch triggers, complaints с приоритизацией
- **Developer Profiles** — KYC статус, договоры, история мини-аппов
- **Mini-app Catalog Control** — featured-слоты, hidden, kill-switched, fingerprint alerts
- **Push Template Registry** — одобрение/отклонение, метаданные шаблонов
- **Audit Log Viewer** — все действия системы и сотрудников
- **Pen-test approved vendors** — список утверждённых пентестерских компаний (управляется Security Officer)
- **Content Policy** — версионируемый документ запрещённых категорий (отображается также в docs.miniapps.click.uz)

### 8.2. Daily Fingerprint Bot

Cron-сервис на Node.js + headless Chromium.

Поток:
1. Каждые 24 часа обходит все live мини-аппы
2. Для каждого:
   - Открывает под двумя предзаданными тестовыми пользователями (один `kyc_full`, один `kyc_none`)
   - Через headless Chromium снимает fingerprint:
     - DOM hash основных страниц (главная + перечень из manifest'а)
     - Список загруженных JS-доменов (network log)
     - CSP headers
     - HTTP security headers
     - Список внешних запросов (домены)
     - Ключевые тексты (для diff'а контента)
   - Сравнивает с эталоном (снят на момент approve)
3. Auto-disable / Flag / OK решение по правилам раздела 6.1
4. Логирует всё в audit log
5. Шлёт уведомления соответствующего цвета в Admin Console

### 8.3. Push Template Registry

Хранилище утверждённых шаблонов с метаданными.

Структура одного шаблона:
```
{
  "template_id": "order_ready_v1",
  "mini_app_id": "...",
  "title_template": "Заказ №{{order_id}} готов",
  "body_template": "Можете забрать в {{pickup_location}}",
  "allowed_variables": ["order_id", "pickup_location"],
  "click_action_deep_link": "click://miniapp/{{mini_app_id}}/order/{{order_id}}",
  "delivery_window_local": {"start": "09:00", "end": "21:00", "timezone": "user_local"},
  "rate_limit_per_user_per_day": 1,
  "rate_limit_per_mini_app_per_day": 10000,
  "review_status": "approved",
  "approved_by": "reviewer_user_id",
  "approved_at": "..."
}
```

API:
- `POST /sandbox/push/templates` — регистрация в песочнице, статус `draft`
- В кабинете — submission шаблона на ревью
- `POST /push/send` — обращается к Registry: проверка `template_id`, переменных, окна, rate-limit; если всё ОК — отправка через Click push-инфру

Cron-сервис каждый час сбрасывает hour-quotas, раз в сутки — daily-quotas.

### 8.4. Sandbox API

Отдельный namespace `sandbox.api.click.uz`.

Контейнеры:
- Изолированная база
- Отдельные `client_id` / `client_secret` для каждого мини-аппа (сandbox-only)
- 10–20 фиксированных тестовых пользователей с разными атрибутами
- Fake-payment engine (5 сек до webhook по умолчанию, query-params для форсирования сценариев)
- Fake-push routing (в Sandbox Inbox)
- Webhook Inspector — всё, что не дошло до `webhook_url`

---

## 9. Маркетплейс интеграция (Click App)

Click app уже имеет marketplace раздел с категориями. Интеграция:

- **Приватный API endpoint** `GET /marketplace/miniapps?category=<slug>&page=N` — доступен только Click App backend (mTLS или whitelisted internal IP)
- Approved мини-апп **автоматически** добавляется в каталог под выбранную категорию
- Карточка мини-аппа в каталоге показывает:
  - Иконка (требуется при K1, размеры по design guidelines)
  - Название
  - Краткое описание (≤120 символов)
  - Юр.лицо разработчика
  - Категория
  - Количество установок (опционально, рассчитывается Click)
- Tap на карточку → открытие WebView с URL мини-аппа + `click_profile` cookie + `window.Click` injection
- **Featured slots** — выбираются модератором Click вручную (rotation manual в Admin Console)

Деталей по UI самого marketplace в Click app документ не покрывает — используется существующая инфраструктура.

---

## 10. Compliance и Data Protection

### 10.1. UZ Data Law

- ПДн пользователей Click (phone, full_name, паспортные данные KYC) обрабатываются и хранятся на инфре в Узбекистане
- При выдаче `click_profile` в WebView Click передаёт минимум необходимого для функционирования мини-аппа на его capability-уровне:
  - L1: `user_id`, `full_name`, `phone`, `avatar_url` (базовый SSO-набор)
  - L2+: то же + `kyc_status`, `region`, `language` — с явного consent пользователя при первом открытии мини-аппа этого уровня (consent flow управляет Click)
- Пользователь может отозвать consent — webhook `user.consent_revoked` приходит мини-аппу, мини-апп обязан удалить локальную копию данных пользователя в течение 30 дней (требование договора)

### 10.2. Privacy Policy мини-аппа (для K3)

Требования к privacy policy на сайте мини-аппа:
- Перечисление собираемых данных
- Цели обработки
- Срок хранения (retention)
- Третьи лица, которым передаются данные (если есть)
- Контакт DPO
- Процедура жалоб и запросов на удаление данных

### 10.3. Логирование и audit

Все события компонентов Click записываются в иммутабельный audit log:
- API-вызовы мини-апп ↔ Click (метаданные, не тела)
- Webhook доставки (event_id, status, retry count)
- Действия сотрудников Click в Admin Console (approve / kill-switch / KYC change / contract change)
- Fingerprint Bot решения
- User-жалобы и их обработка

Retention определяется внутренней политикой Click; не часть архитектурной спецификации.

---

## 11. Ключевые архитектурные принципы

1. **Self-hosted runtime** — Click не несёт операционной нагрузки от выполнения чужого кода
2. **Three-channel API** — frontend (identity), backend (operations), webhooks (events) — раздельные модели безопасности
3. **Shift-left security** — Cabinet Security Scanner даёт разработчику те же чеки, что и финальный submission
4. **Domain pinning + daily fingerprint** — защита от silent content swap после approve
5. **Manual escalation gate** — система эскалирует, человек принимает финальное решение
6. **Sandbox parity** — sandbox API структурно идентичен production, только с изолированной базой и fake-payments/push
7. **Single source of truth для KYC и договоров** — Admin Console
8. **Audit everything** — каждое значимое действие логируется
9. **No automatic terminations** — recovery возможен из любого состояния (auto-disable / kill-switch / суспензия) через манагера
10. **Compliance с UZ Data Law** — ПДн на инфре в Узбекистане, минимум необходимого в WebView, consent flows на L2+

---

## 12. Открытые вопросы для Click team

Технические и продуктовые решения, которые **не** входят в эту архитектурную спецификацию и должны быть приняты Click отдельно:

1. **Фазирование запуска программы** — какие capability levels запускать первыми (L1+L2 → L3 → L4, или сразу всё?)
2. **Команда** — кто из существующих команд Click отвечает за каждую плоскость (Developer Plane / Runtime Plane / Governance Plane)
3. **Список утверждённых пентестерских компаний** — кого включаем в первую версию
4. **Content Policy конкретика** — что именно запрещено (на уровне категорий + примеров)
5. **Click Design Guidelines** — палитра, типографика, паттерны UX внутри WebView (нужен консолидированный документ)
6. **Договорные шаблоны** — оферты для K1, K2, K3
7. **Монетизация** — когда переходить с бесплатного пилота на платную модель, какая ставка
8. **Retention policy** — конкретные сроки хранения для audit log, sandbox данных, fingerprint snapshots
9. **Расширения** — нативные мобильные SDK (для будущих native мини-аппов), P2P-переводы внутри мини-аппов (уровень L5), биометрия — что-то из этого нужно прорабатывать с первых версий

См. также `03-requirements.md` для детальных функциональных и нефункциональных требований.
