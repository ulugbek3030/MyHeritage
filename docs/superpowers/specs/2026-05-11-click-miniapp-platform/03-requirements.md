# Click Mini-Apps Platform — Требования

**Дата**: 11 мая 2026
**Аудитория**: продакт-менеджеры, тех.лиды, security, compliance, юристы Click
**Документ**: функциональные, нефункциональные, security, compliance и операционные требования
**Связанные файлы**: `01-presentation.md` (резюме), `02-architecture.md` (полное описание)

---

## Условные обозначения

- **MUST** — критическое требование, без которого программу запускать нельзя
- **SHOULD** — настоятельно рекомендуется, отказ нужно отдельно обосновывать
- **MAY** — желательно, можно отложить на последующие итерации

ID-префиксы:
- **FR** — Functional Requirement
- **NFR** — Non-Functional Requirement
- **SR** — Security Requirement
- **CR** — Compliance Requirement
- **UR** — UI/UX Requirement
- **OR** — Operational Requirement
- **DR** — Developer Experience Requirement

---

## 1. Functional Requirements (FR)

### 1.1. Developer Cabinet (`miniapps.click.uz`)

| ID | Priority | Описание | Acceptance Criteria |
|---|---|---|---|
| FR-01 | MUST | Регистрация разработчика через Click SSO | Разработчик, имеющий Click-аккаунт, может зарегистрироваться в кабинете без повторной проверки телефона |
| FR-02 | MUST | Автоматическое создание учётки в GitLab CE при первой регистрации | Новый разработчик после первой регистрации имеет рабочий GitLab-аккаунт с SSO; способен залогиниться в `git.miniapps.click.uz` без отдельного пароля |
| FR-03 | MUST | Создание мини-аппа: имя, описание, целевой capability level (L1–L4), категория каталога | Разработчик в кабинете может создать новый мини-апп; после создания получает запись с уникальным `mini_app_id` |
| FR-04 | MUST | Автоматическое создание GitLab-репо из template'а под выбранный уровень при создании мини-аппа | После создания мини-аппа в GitLab появляется репо в namespace разработчика с template-кодом и README; разработчик имеет `maintainer` доступ |
| FR-05 | MUST | Выдача sandbox `client_id` + `client_secret` + `webhook_url` (заглушка) | Sandbox credentials генерируются автоматически; `client_secret` показывается один раз с предупреждением |
| FR-06 | MUST | Sandbox Launcher: выбор тестового пользователя из 10–20 предзаданных, открытие мини-аппа в iframe-эмуляторе Click WebView | Разработчик может выбрать тестового пользователя и увидеть свой мини-апп с подложенным `click_profile` и `window.Click` |
| FR-07 | MUST | Webhook Inspector: просмотр всех webhook'ов, направленных на `webhook_url` мини-аппа в sandbox | Разработчик видит payload, headers, статус ответа; может ретранслировать |
| FR-08 | MUST | Cabinet Security Scanner: ручной и cron-запуск, отчёт с приоритетами Critical/High/Medium/Low, история сканов, diff | Сканер запускается по кнопке; отчёт включает все checks (TLS, headers, Lighthouse, OWASP baseline); diff с предыдущим прогоном виден |
| FR-09 | MUST | Submission на production: создаёт запись в moderation queue Click | Разработчик нажимает «Подать на production»; статус мини-аппа меняется на `pending_review`; auto-checks стартуют в течение 30 минут |
| FR-10 | MUST | Просмотр статуса submission, замечаний ревьюера, истории submission'ов | Разработчик видит: какой этап (auto / manual / resubmission), список замечаний с категориями, дату ответа |
| FR-11 | MUST | Resubmission после устранения замечаний | Разработчик нажимает «Resubmit» после исправлений; delta-review запускается |
| FR-12 | MUST | Просмотр текущего KYC-тира и доступных capability levels | На главной кабинета — текущий тир (K0/K1/K2/K3), какие capability levels доступны, что нужно для следующего тира |
| FR-13 | MUST | Загрузка KYC-документов для K1, K2, K3 | Разработчик может прикрепить документы (реквизиты, банковские, pen-test отчёт, privacy policy) с описанием каждого |
| FR-14 | MUST | Подтверждение домена через DNS TXT-record | Click генерирует уникальное значение для `_click-verify.example.uz`; кабинет каждые 5 минут проверяет наличие; флажок подтверждения после успеха |
| FR-15 | MUST | Просмотр статуса договора оферты (`not_started → in_negotiation → signed_verified`) | Статус виден разработчику; до `signed_verified` production недоступен |
| FR-16 | MUST | Просмотр Production Compliance Requirements во вкладке кабинета | Полный список из раздела 6 архитектуры доступен в кабинете; разработчик подтверждает ознакомление перед submission |
| FR-17 | MUST | Получение уведомлений (email + push в Click + в кабинете) о fingerprint-алертах, kill-switch, изменении статуса submission | Все значимые события приходят разработчику; уведомления не теряются |
| FR-18 | MUST | Manifest Update / Change Request / Maintenance Window в кабинете | Разработчик может задекларировать изменения зависимостей, DNS, окно maintenance; запросы проходят delta-review |
| FR-19 | MUST | DLQ (dead-letter queue) для webhook'ов, не доставленных за 24 часа | Разработчик видит, какие события не доставлены; может ретранслировать вручную |
| FR-20 | MUST | Просмотр audit log своего мини-аппа за последние 30 дней | API-вызовы, webhook'и, изменения настроек; глубже 30 дней — по запросу через менеджера |
| FR-21 | MUST | Ротация `client_secret` с grace period 24 часа | Разработчик может сгенерировать новый секрет; старый продолжает работать 24 часа |
| FR-22 | SHOULD | Просмотр количества установок и базовой статистики мини-аппа в Click marketplace | После production — сколько раз открыли, средняя длительность сессии, retention; rough numbers, не детальная аналитика |

### 1.2. Sandbox API (`sandbox.api.click.uz`)

| ID | Priority | Описание | Acceptance Criteria |
|---|---|---|---|
| FR-30 | MUST | 10–20 предзаданных тестовых пользователей с разными атрибутами | `kyc_full`, `kyc_simplified`, `kyc_none`, `no_phone`, разные регионы и языки имён; user_id фиксированы и публикуются в docs |
| FR-31 | MUST | `POST /sandbox/payments` — fake-платёж, по умолчанию success через 5 сек | Возвращает `payment_id`; через 5 сек шлёт webhook `payment.succeeded`; средства не списываются |
| FR-32 | MUST | Query-параметры для форсирования сценариев платежей: `force_decline=true`, `force_webhook_delay=Ns`, `force_webhook_fail=true` | Разработчик может протестировать happy path, отказы, таймауты, fail webhook'а |
| FR-33 | MUST | `POST /sandbox/push/send` — fake-push, попадает в Sandbox Inbox, не на реальные устройства | Разработчик видит push в кабинете; может вручную симулировать `delivered` / `opened` / `dismissed` |
| FR-34 | MUST | `POST /sandbox/push/templates` — регистрация push-шаблонов в sandbox со статусом `draft` | Разработчик может тестировать flow регистрации без реального ревью |
| FR-35 | MUST | Полная изоляция sandbox от production: отдельный домен, отдельные ключи, отдельная база | `production` `client_id` не работает в `sandbox` и наоборот |

### 1.3. Production API (`api.click.uz`)

| ID | Priority | Описание | Acceptance Criteria |
|---|---|---|---|
| FR-40 | MUST | `GET /me/profile` — получить профиль текущего пользователя (`L1` scope) | Возвращает `user_id`, `full_name`, `phone`, `avatar_url` (базовый SSO-набор); для L2+ scope — дополнительно `kyc_status`, `region`, `language` |
| FR-41 | MUST | `POST /payments` — инициация платежа (`L3` scope, step-up auth) | Создаёт `pending_payment_id`; Click показывает пользователю native confirmation UI; после подтверждения — webhook |
| FR-42 | MUST | `GET /payments/:id` — статус платежа (`L3` scope) | Возвращает текущий статус и метаданные |
| FR-43 | MUST | `POST /push/send` — отправка push по `template_id` (`L4` scope) | Click валидирует `template_id`, переменные, окно, rate-limit; на 429 — `Retry-After` |
| FR-44 | MUST | Все запросы подписываются HMAC-SHA256 + timestamp + nonce | Click отвергает: устаревший timestamp >5 мин, повторный nonce за 24 ч, неверная подпись, недостаточный scope |
| FR-45 | MUST | OpenAPI 3.1 spec публикуется на `docs.miniapps.click.uz` | Schema актуальна, версионирована, доступна для генерации клиентов |

### 1.4. WebView Bridge (`auth.click.uz`)

| ID | Priority | Описание | Acceptance Criteria |
|---|---|---|---|
| FR-50 | MUST | Click при открытии мини-аппа во WebView подкладывает cookie `click_profile` + `window.Click = { profile, sessionToken }` | Мини-апп при `document.cookie` видит `click_profile`; в global scope доступен `window.Click` |
| FR-51 | MUST | `sessionToken` — JWT RS256, TTL 15 мин, claims `sub`, `aud`, `iat`, `exp`, `scope` | Backend мини-аппа верифицирует подпись через JWKS `auth.click.uz/.well-known/jwks.json` |
| FR-52 | MUST | JWKS endpoint публикует открытые ключи Click для верификации JWT | Стандартный JWKS-формат; ключи ротируются по политике Click |
| FR-53 | MUST | Outside Click WebView (например, mini-app открыт в обычном Chrome) `window.Click` отсутствует, cookie не подложен | Мини-апп должен корректно обрабатывать отсутствие и показывать fallback UI |
| FR-54 | MUST | Renewal: каждое открытие мини-аппа из Click выдаёт свежий `sessionToken` | После 15 мин неактивности sessionToken инвалидируется; пользователь должен открыть из Click заново |

### 1.5. Webhooks

| ID | Priority | Описание | Acceptance Criteria |
|---|---|---|---|
| FR-60 | MUST | Доставка событий на `webhook_url` мини-аппа с retry policy (1m → 5m → 15m → 1h → 6h → 24h) | Каждое событие — POST с body + signature; retry на 5xx, timeout, 4xx (кроме 410) |
| FR-61 | MUST | Идемпотентность через `X-Click-Event-Id` (UUID) | Мини-апп использует `event_id` как дедуп-ключ; Click повторяет event_id при retry |
| FR-62 | MUST | `410 Gone` от мини-аппа = drop event, дальше не retry | Click помечает событие как `dropped`, в audit log |
| FR-63 | MUST | После 24 часов retry — событие в DLQ кабинета | Разработчик видит и может ретранслировать вручную |
| FR-64 | MUST | События: `payment.succeeded`, `payment.failed`, `payment.cancelled`, `push.delivered`, `push.opened`, `push.dismissed`, `user.consent_revoked`, `mini_app.kill_switched`, `mini_app.reactivated` | Все события документированы со схемами в OpenAPI |

### 1.6. Admin Console

| ID | Priority | Описание | Acceptance Criteria |
|---|---|---|---|
| FR-70 | MUST | Moderation Queue с фильтрами и приоритизацией (submissions, kill-switch triggers, complaints) | Сотрудник Click видит очередь, сортированную по приоритету и дате |
| FR-71 | MUST | Просмотр и approve/reject submission с записью замечаний | Каждое замечание — категория (security / content / UX / docs / push) + текст + (опционально) скриншот; разработчик видит точную копию замечаний |
| FR-72 | MUST | Управление статусом договора оферты (`not_started → in_negotiation → signed_verified`) | Только Compliance Manager может менять; прикладывается PDF документа |
| FR-73 | MUST | Управление KYC статусом разработчика и тиром (K0/K1/K2/K3) | Только Compliance Manager; апгрейд / понижение / приостановка |
| FR-74 | MUST | Kill-switch мини-аппа в один клик | Moderator может мгновенно отключить мини-апп; разработчик автоматически уведомляется |
| FR-75 | MUST | Featured-слоты в marketplace — выбор и rotation вручную | Moderator может назначить мини-апп в Featured на определённый период |
| FR-76 | MUST | Push Template Registry — approve/reject шаблонов | Reviewer видит payload шаблона, окно отправки, rate-limit; решение фиксируется в audit log |
| FR-77 | MUST | Просмотр Audit Log с фильтрами по типу события, по разработчику, по мини-аппу | Иммутабельный, search/filter/export |
| FR-78 | MUST | Управление списком утверждённых пен-тестерских компаний | Security Officer добавляет/удаляет; список синхронно отражается в `docs.miniapps.click.uz` |
| FR-79 | MUST | Алерты Daily Fingerprint Bot — отображение, разрешение/эскалация | Каждое flag отображается с фотографией fingerprint diff; разработчик видит свою копию |

### 1.7. Daily Fingerprint Bot

| ID | Priority | Описание | Acceptance Criteria |
|---|---|---|---|
| FR-80 | MUST | Cron-проход каждые 24 часа по всем live мини-аппам | Все production мини-аппы обходятся минимум раз в 24 часа |
| FR-81 | MUST | Снятие fingerprint: DOM hash, network log, CSP, HTTP headers, внешние домены, ключевые тексты | Fingerprint сохраняется с timestamp; сравнивается с эталоном на момент approve |
| FR-82 | MUST | Auto-disable триггеры по правилам раздела 6.1 архитектуры | Auto-disable срабатывает на TLS expired, новые внешние домены, ослабленный CSP, новые формы сбора данных и т.д. |
| FR-83 | MUST | Flag-триггеры в moderation queue | Расхождения по контенту >30%, мелкие DOM изменения, 1-4 жалобы |
| FR-84 | MUST | Логирование решений в audit log | Каждое решение бота с обоснованием и diff'ом |
| FR-85 | MUST | Уважение Maintenance Window'ов разработчика | В объявленном окне 5xx не флагается |

### 1.8. Push Template Registry

| ID | Priority | Описание | Acceptance Criteria |
|---|---|---|---|
| FR-90 | MUST | Хранение утверждённых шаблонов с метаданными | template_id, title/body templates, allowed variables, deep_link, delivery_window, rate-limits |
| FR-91 | MUST | Валидация на `POST /push/send` | Проверка `template_id` существует и approved, все обязательные переменные есть, окно отправки соблюдено, rate-limit не превышен |
| FR-92 | MUST | Cron-сервис сброса hour-quotas (каждый час) и daily-quotas (раз в сутки в полночь UTC+5) | Лимиты обнуляются ровно по расписанию; следующая отправка возможна сразу после сброса |
| FR-93 | MUST | Auto-deactivate шаблона при попытке выйти за rate-limit | Шаблон временно блокируется + flag в moderation queue для разбора |

### 1.9. Marketplace интеграция

| ID | Priority | Описание | Acceptance Criteria |
|---|---|---|---|
| FR-100 | MUST | Приватный endpoint `GET /marketplace/miniapps?category=<slug>&page=N` для Click App backend | Доступен только Click App backend (mTLS или whitelisted IP); возвращает paged список с метаданными карточек |
| FR-101 | MUST | После approve мини-апп **автоматически** появляется в каталоге выбранной категории | Без участия модератора (модератор может вручную скрыть Featured-слот, но базовая публикация автоматична) |
| FR-102 | MUST | Карточка содержит: иконка, название, краткое описание (≤120), юр.лицо, категория, количество установок | Все поля собираются из mini-app metadata + статистики Click |

---

## 2. Non-Functional Requirements (NFR)

| ID | Priority | Категория | Описание |
|---|---|---|---|
| NFR-01 | MUST | Performance | Cabinet Security Scanner полный прогон ≤ 5 минут |
| NFR-02 | MUST | Performance | Submission auto-checks ≤ 30 минут с момента подачи |
| NFR-03 | MUST | SLA | Manual review ≤ 7 рабочих дней |
| NFR-04 | MUST | SLA | Resubmission delta-review ≤ 3 рабочих дня |
| NFR-05 | MUST | SLA | Re-activation после auto-disable: разбор + manual ≤ 3 рабочих дня |
| NFR-06 | MUST | Availability | Production API uptime ≥ 99.9% (наследует от Click) |
| NFR-07 | MUST | Availability | Sandbox API uptime ≥ 99.0% (best effort) |
| NFR-08 | MUST | Scalability | Поддержка ≥ 100 одновременных активных разработчиков на старте; масштабируется горизонтально |
| NFR-09 | MUST | Latency | API p50 ≤ 200 мс, p95 ≤ 800 мс для обычных операций |
| NFR-10 | MUST | Throughput | Webhook delivery ≥ 1000 событий/сек на инстанс |
| NFR-11 | MUST | Reliability | Webhook retry 6 раз за 24 часа с exp backoff |
| NFR-12 | SHOULD | Observability | Все компоненты экспортируют метрики Prometheus + structured JSON логи |
| NFR-13 | SHOULD | Observability | Distributed tracing через OpenTelemetry для cross-service запросов |

---

## 3. Security Requirements (SR)

| ID | Priority | Описание |
|---|---|---|
| SR-01 | MUST | Mini-app домен фиксируется через DNS TXT-record при K1; повторная сверка на каждом submission и daily fingerprint |
| SR-02 | MUST | `sessionToken` подписан RS256, валиден 15 мин, верифицируется через JWKS; ротация ключей по политике Click |
| SR-03 | MUST | Backend API запросы подписаны HMAC-SHA256; replay protection через timestamp + nonce |
| SR-04 | MUST | Webhook payloads подписаны HMAC-SHA256; мини-апп обязан валидировать подпись |
| SR-05 | MUST | Scope enforcement: запросы вне capability level → `403 insufficient_scope` |
| SR-06 | MUST | Step-up auth для всех платежей: confirmation внутри Click native UI, не frontend мини-аппа |
| SR-07 | MUST | Cabinet Security Scanner полностью повторяет submission auto-checks |
| SR-08 | MUST | Pen-test отчёт от утверждённой Click-пентестерской компании для L3/L4 production; валиден 12 мес |
| SR-09 | MUST | За 7 дней до expiry pen-test — submission новых releases блокируется; в день expiry мини-апп → read-only mode (платежи и push блокируются) |
| SR-10 | MUST | Daily Fingerprint Bot обходит все live мини-аппы каждые 24 часа |
| SR-11 | MUST | Auto-disable триггеры (TLS expired, новые внешние JS-домены, ослабленный CSP, новые формы сбора PII и т.д.) — немедленный disable без участия модератора |
| SR-12 | MUST | Recovery после auto-disable — full auto-review + manual review (3 раб.дня) |
| SR-13 | MUST | Никаких **автоматических** расторжений договора или permanent removal; эскалация всегда через менеджера с 🔴 алертом |
| SR-14 | MUST | Audit log иммутабельный; sotrudники Click не могут изменять записи |
| SR-15 | MUST | Production credentials отдельные от sandbox; не работают крест-накрест |
| SR-16 | MUST | `client_secret` показывается один раз при генерации; нигде в кабинете не отображается повторно |
| SR-17 | MUST | Ротация `client_secret` — grace period 24 часа |
| SR-18 | MUST | Sandbox credentials имеют TTL 6 мес неактивности → архивирование |
| SR-19 | MUST | TLS-сертификат мини-аппа обязателен (минимум TLS 1.2); auto-renewal — ответственность разработчика |
| SR-20 | MUST | Security headers checklist (CSP, HSTS, X-Frame-Options и т.д.) проверяется на submission и daily |
| SR-21 | MUST | Threat intel feed для blacklisted доменов; запросы мини-аппа на blacklisted домены = auto-disable |
| SR-22 | MUST | Webhook handler время ответа <5 сек; падение 100% >1 ч → блокировка scope'ов L3/L4 (мини-апп остаётся live, scope'ы отключены) |
| SR-23 | SHOULD | mTLS между Click App backend и Marketplace integration endpoint |
| SR-24 | SHOULD | Rate-limit per-mini-app + per-user-per-mini-app для всех Production API endpoints |

---

## 4. Compliance Requirements (CR)

| ID | Priority | Описание |
|---|---|---|
| CR-01 | MUST | ПДн пользователей Click (phone, full_name, KYC documents) обрабатываются и хранятся на инфре в Узбекистане |
| CR-02 | MUST | При выдаче `click_profile` в WebView Click передаёт минимум необходимого для capability-уровня: L1 — `user_id`, `full_name`, `phone`, `avatar_url` (базовый SSO); L2+ — дополнительно `kyc_status`, `region`, `language` с явного consent пользователя при первом открытии |
| CR-03 | MUST | Consent flow на L2+ управляется Click (нативный UI при первом открытии мини-аппа); мини-апп может проверить через `kyc_status` claim в JWT |
| CR-04 | MUST | Webhook `user.consent_revoked` доставляется мини-аппу; мини-апп обязан удалить локальную копию данных пользователя в течение 30 дней (требование договора) |
| CR-05 | MUST | Privacy policy на сайте мини-аппа (K3): перечень собираемых данных, цели, retention, третьи лица, контакт DPO, процедура жалоб |
| CR-06 | MUST | Договор оферты подписывается между Click и юр.лицом / ИП / самозанятым разработчика; физлица без статуса в production НЕ допускаются |
| CR-07 | MUST | Для L3 (платежи) — договор включает финансовые условия (комиссии, выплаты, диспуты); расчётный счёт привязан к юр.лицу |
| CR-08 | MUST | Push на L4 — только по pre-approved templates; rate-limits и delivery windows обязательны |
| CR-09 | MUST | Push templates ревьюятся отдельно; изменение текста / переменных / окна / лимита → новый template_id + отдельный review |
| CR-10 | MUST | Документация в `docs.miniapps.click.uz` доступна на русском (primary) и узбекском (latin + cyrillic); английский опционально |
| CR-11 | MUST | Мини-апп в production обязан иметь интерфейс на русском И узбекском |
| CR-12 | MUST | Content Policy (запрещённые тематики) — версионируемый документ Click; публикуется в docs; обновляется без attendant архитектурных изменений |
| CR-13 | MUST | Fraud / phishing / data leak (первая инстанция) → 🔴 уведомление менеджеру + рекомендация немедленного расторжения + передача в фин.разведку UZ |
| CR-14 | MUST | Threat intel feed обновляется регулярно; Click Security Officer ответственный |
| CR-15 | SHOULD | Аналитика мини-аппа разрешена только из утверждённого списка (Yandex Metrika, Google Analytics, Plausible, Matomo) — официальные домены |
| CR-16 | MAY | Соответствие международным стандартам (PCI DSS, ISO 27001) для L3 разработчиков — по запросу клиента, не обязательное требование MVP |

---

## 5. UI/UX Requirements (UR)

### 5.1. Cabinet (`miniapps.click.uz`)

| ID | Priority | Описание |
|---|---|---|
| UR-01 | MUST | Cabinet на русском + узбекском (latin/cyrillic); английский опционально |
| UR-02 | MUST | Адаптивный дизайн (desktop primary, tablet поддерживается, mobile — read-only) |
| UR-03 | MUST | Визуально различимые этапы flow на главной: K0 → K1 → K2 → K3 (с подсветкой текущего) |
| UR-04 | MUST | На каждом этапе — clear next step: «Подтвердить домен», «Загрузить документы», «Дождаться менеджера» |
| UR-05 | MUST | Security Scanner отчёт — color-coded (Critical красный, High оранжевый, Medium жёлтый, Low серый) |
| UR-06 | MUST | Webhook Inspector — payload viewer с JSON syntax highlighting; кнопка «Retransmit» |
| UR-07 | MUST | Sandbox Launcher — список тестовых пользователей с аватарами и атрибутами; кнопка «Open in WebView Emulator» |
| UR-08 | MUST | Notifications panel — все события (fingerprint alerts, kill-switch, review status, user reports); read/unread |

### 5.2. Mini-app внутри Click

| ID | Priority | Описание |
|---|---|---|
| UR-10 | MUST | Click Design Guidelines (отдельный документ, публикуется в docs): палитра, типографика, размеры тач-таргетов, тёмная/светлая тема |
| UR-11 | MUST | Mini-app обязан корректно обрабатывать кнопку «назад» в Click WebView (deep history vs. close WebView) |
| UR-12 | MUST | Mini-app обязан рендериться корректно в обоих режимах WebView (iOS Safari quirks, Android Chrome) |
| UR-13 | MUST | Mini-app обязан корректно обрабатывать safe area (notch, home indicator) |
| UR-14 | SHOULD | Mini-app использует Click Design System components где возможно |
| UR-15 | MUST | На карточке мини-аппа в Click marketplace — юр.лицо разработчика отображается явно (антифрод) |

### 5.3. Admin Console

| ID | Priority | Описание |
|---|---|---|
| UR-20 | MUST | На русском (узбекский опционально) |
| UR-21 | MUST | Moderation queue с приоритизацией: 🔴 critical alerts вверху, 🟡 medium, серое — informational |
| UR-22 | MUST | Каждое замечание ревьюера — структурированная форма: категория (dropdown) + текст + опциональный скриншот |
| UR-23 | MUST | Push Template viewer — preview шаблона с примером подставленных переменных |
| UR-24 | MUST | Audit log viewer — search/filter по типу события, разработчику, мини-аппу, времени; export в CSV |

---

## 6. Operational Requirements (OR)

| ID | Priority | Описание |
|---|---|---|
| OR-01 | MUST | Команда Reviewer'ов: минимум 2 человека на старте программы (для отпусков и пиковых нагрузок) |
| OR-02 | MUST | Команда Moderator'ов: минимум 2 человека (kill-switch + complaints) |
| OR-03 | MUST | Compliance Manager: минимум 1 человек на старте; рост по нагрузке KYC заявок |
| OR-04 | MUST | Security Officer: минимум 1 человек, дежурство по фрод-алертам |
| OR-05 | MUST | Runbook'и для типичных операций: approve / reject / kill-switch / re-activation / contract status change |
| OR-06 | MUST | Регулярный (ежемесячный) review статистики программы: количество разработчиков, мини-аппов, submission'ов, kill-switch'ей, жалоб |
| OR-07 | MUST | Threat intel feed обновляется регулярно (минимум раз в неделю), Security Officer мониторит |
| OR-08 | MUST | Список утверждённых пен-тестеров публикуется в docs и поддерживается актуальным |
| OR-09 | MUST | Backup / DR для всех stateful компонентов (GitLab, sandbox DB, audit log, push template registry) |
| OR-10 | MUST | Monitoring + alerting для всех production компонентов с on-call rotation |
| OR-11 | MUST | Maintenance Window для сервисов Click (sandbox, production API) — объявляется в кабинете заранее (минимум 7 дней) |
| OR-12 | SHOULD | Bi-weekly newsletter для разработчиков: новые фичи API, упоминания об апдейтах документации, security advisories |
| OR-13 | MAY | Annual security audit Click-инфры независимым аудитом |

---

## 7. Developer Experience Requirements (DR)

| ID | Priority | Описание |
|---|---|---|
| DR-01 | MUST | Documentation Portal (`docs.miniapps.click.uz`) — статический сайт, версионированный по API |
| DR-02 | MUST | Раздел Getting Started — 15 минут от регистрации до работающего sandbox |
| DR-03 | MUST | OpenAPI 3.1 spec публикуется и поддерживается актуальным |
| DR-04 | MUST | JS frontend SDK `@click/miniapp-sdk` — типизированный, ESM + CommonJS, ~10kb gzipped |
| DR-05 | MUST | Node.js backend SDK `@click/miniapp-backend-sdk` — HMAC подписи, webhook валидация, exp backoff retry, idempotency helpers |
| DR-06 | MUST | GitLab repo templates для L1/L2/L3/L4 — каждый запускается локально из коробки (docker-compose / vite dev) |
| DR-07 | MUST | Каждый template содержит README с инструкцией: что внутри, как запустить, как протестировать в Sandbox Launcher |
| DR-08 | MUST | Sandbox Test Suite публикуется как npm пакет — разработчик может прогонять локально на своём backend |
| DR-09 | SHOULD | Examples репозиторий с реальными working мини-аппами (e-commerce, доставка, простой game) |
| DR-10 | SHOULD | Discord / Telegram канал для разработчиков (community support) |
| DR-11 | MAY | Видео-туториалы по типичным флоу |
| DR-12 | MAY | Hackathon / developer days от Click для популяризации программы |

---

## 8. Открытые вопросы — требуют решения Click

Эти требования намеренно не закрыты и должны быть приняты Click team:

| ID | Описание |
|---|---|
| OQ-01 | Фазирование запуска: какие capability levels (L1/L2/L3/L4) запускать первыми, какие позже |
| OQ-02 | Точная команда исполнителей: кто из существующих команд Click отвечает за каждую плоскость и каждый компонент |
| OQ-03 | Конкретный список утверждённых пентестерских компаний на старте |
| OQ-04 | Content Policy — конкретные категории запрещённого контента с примерами |
| OQ-05 | Click Design Guidelines — консолидированный документ (палитра, типографика, паттерны UX в WebView) |
| OQ-06 | Шаблоны договоров оферты для K1, K2, K3 (юридический текст) |
| OQ-07 | Монетизация — когда переходить на платную модель и какая ставка/тариф |
| OQ-08 | Retention policy для audit log, sandbox данных, fingerprint snapshots |
| OQ-09 | Нужны ли нативные SDK (iOS / Android) для будущих native мини-аппов |
| OQ-10 | L5 capability (P2P, контакты, биометрия) — какие use-cases это покрывает и нужны ли в первый год |
| OQ-11 | Bug bounty программа — параметры, scope, payouts |
| OQ-12 | Sandbox closed beta — кого приглашаем первыми (внутренние команды Click? стратегические партнёры?) |

---

См. `01-presentation.md` для краткого резюме и `02-architecture.md` для полного описания архитектуры.
