# MyHeritage — Инструкции для Claude Code

## Полная документация
Файл `PROJECT_CONTEXT.md` в корне проекта содержит детальное описание всего проекта: структура, типы, API, компоненты, стили, БД. **Прочитай его в начале каждой сессии** командой `Read PROJECT_CONTEXT.md`.

## Запуск
```bash
npm run dev           # оба сервера
npm run dev:server    # Express :3001
npm run dev:client    # Vite :5176
npm run db:migrate    # миграции
npm run db:seed       # тестовые данные
```
Тестовый аккаунт: `+9980000001` / `test123`

## Стек
- Frontend: React 19 + TypeScript + Vite 7
- Backend: Express 4 + TypeScript + PostgreSQL
- Layout: `relatives-tree` v3.2.2 (вычисляет позиции узлов и коннекторы)
- Auth: JWT (access + refresh) + bcrypt
- CSS: Custom variables, Nunito font, русский язык

## Ключевые файлы
- `client/src/components/tree/FamilyTreeLayout.tsx` — движок отрисовки (relatives-tree)
- `client/src/utils/treeTransform.ts` — DB data → relatives-tree format (бидирекциональные связи)
- `client/src/hooks/useZoom.ts` — плавный зум (lerp + rAF)
- `client/src/hooks/useDrag.ts` — drag-to-pan
- `client/src/pages/TreeViewPage.tsx` — основная страница дерева
- `server/src/services/trees.service.ts` — getFullTree + BFS generations
- `server/src/services/persons.service.ts` — CRUD + транзакции

## СТРОГИЕ правила (ВСЕГДА соблюдать)

### Имена
- Порядок: `firstName lastName middleName (maidenName)` — НИКОГДА фамилия первой
- "Улугбек Рустамов" ✓ / "Рустамов Улугбек" ✗

### Даты
- Карточка: `birthDateKnown=true` → "15 мар. 1984"; только `birthYear` → "1984"
- Popup: `toLocaleDateString('ru-RU', {day, month:'long', year})` если known, иначе год

### Визуал
- Gender: blue (#4a90d9) border-top = male, pink (#e87ba8) = female
- Deceased: grayscale photo + dashed avatar border + muted opacity
- Линии: все solid, кроме divorced couple (dashed). Только H и V линии, NO диагональных
- Карточка: 174px width, min-height 210px, border-radius 16px

### Zoom Engine (useZoom.ts) — КРИТИЧЕСКИ ВАЖНО, НЕ ЛОМАТЬ!
- Lerp: LERP=0.15, SETTLE=0.0005, MAX_SCALE=1.8
- Dynamic MIN_SCALE = fitTree into viewport
- transform-origin: top center, will-change: transform
- **УНИВЕРСАЛЬНЫЙ ЗУМ** — работает на ВСЕХ устройствах:
  1. Desktop trackpad pinch: Ctrl+Wheel (Chrome/Firefox/Edge)
  2. macOS Safari trackpad: gesturestart/gesturechange
  3. Mobile iOS/Android: touchstart/touchmove/touchend (2 пальца, pinch-to-zoom)
- CSS `.tree-viewport` ДОЛЖЕН иметь `touch-action: none` — JS обрабатывает ВСЁ
- При pinch (2 пальца) на viewport ставится `dataset.pinching = '1'`, useDrag это проверяет и не тащит во время pinch
- **ОБЯЗАТЕЛЬНО**: useEffect для listeners ДОЛЖЕН иметь **пустой массив зависимостей `[]`**
- Внутри useEffect обработчики ДОЛЖНЫ использовать **только refs и DOM-элементы** (НЕ useCallback функции)
- Логика clamp/loop/startAnim определяется **inline внутри useEffect**, а НЕ через внешние useCallback
- onScaleChange хранится в `onScaleChangeRef` (ref) чтобы handler читал свежее значение
- **ПРИЧИНА**: если deps содержат [clampScale, startZoomAnim], React пересоздаёт listeners при каждом рендере → зум ломается
- **НИКОГДА не добавлять clampScale, startZoomAnim или другие useCallback в deps массив useEffect**

### Drag Engine (useDrag.ts)
- Mouse drag: mousedown/mousemove/mouseup (desktop)
- Touch drag: touchstart/touchmove/touchend (mobile, 1 палец)
- Проверяет `viewport.dataset.pinching` — если pinch идёт, touch-drag отключается
- Touch listeners ДОЛЖНЫ быть `{ passive: true }` — НЕ мешают useZoom touch handlers

### Relationships в БД
- parent_child: person1_id = РОДИТЕЛЬ, person2_id = РЕБЁНОК
- Все связи в relatives-tree БИДИРЕКЦИОНАЛЬНЫЕ
- Siblings вычисляются автоматически по общим родителям

## TODO (нереализованное)
- EditPersonForm (кнопка "Редактировать" → TODO stub)
- Фото-загрузка в UI (API готов, формы нет)
- Мобильная адаптация (базовый breakpoint 768px есть)
