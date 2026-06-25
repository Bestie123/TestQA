---
title: Plan — Remaining Work
source: plan-remaining-work.md
---

# План завершения работ qtest-runner

> Doc-ID: PLAN-REMAINING-1 | Дата: 2026-06-02 | Связанные: [STATUS-1]

## Phase 0 — Исследование Jira и аутентификация

**Цель:** Выяснить доступные методы auth на jira.ifellow.ru / dev.jira.ifellow.ru

**Шаги:**
1. Открыть браузер через MCP → dev.jira.ifellow.ru
2. Пользователь вручную авторизуется (AI не видит credentials)
3. AI исследует Profile → Security → API Tokens / PAT
4. Определить: Jira Cloud или Server/Data Center
5. Если токен доступен → пользователь копирует, создаёт `~/.qtest/credentials.json`
6. Если нет → ищем альтернативы (Basic Auth, OAuth, cookie session)

**Критерий готовности:** Понятен механизм auth, создан credentials.json или решено использовать Basic Auth

---

## Phase 1 — Инфраструктура доступа + Config loader

**Цель:** AI умеет читать credentials из защищённого источника

**Подзадачи:**
- [ ] 1.1 Создать `packages/shared-types/src/credentials.ts` — интерфейс `CredentialsConfig`
- [ ] 1.2 Добавить `~/.qtest/credentials.json` в `.gitignore` (корень проекта)
- [ ] 1.3 Модифицировать `zephyr-client.ts`: читать config file как приоритетный источник
  - Приоритет: config file → env vars → defaults
  - `getZephyrConfig()` мерджит все три уровня
- [ ] 1.4 Проверить что без credentials.json (или с пустым) код не падает
- [ ] 1.5 (Безопасность) Залогировать что credentials загружены, НО не логировать сам токен

**Критерий готовности:** `syncFromZephyr()` получает config из credentials.json; в логи не попадает apiToken

---

## Phase 2 — Zephyr Sync API (реальный импорт)

**Цель:** `syncFromZephyr()` реально импортирует TC из Jira в локальную БД

**Текущая проблема:** `zephyr-client.ts:105-113` — возвращает `{ imported: 0 }` всегда

**Подзадачи:**
- [ ] 2.1 Изучить формат ответа Zephyr REST API (реальный запрос к Jira)
- [ ] 2.2 Написать адаптер `zephyrResponseToExcelFormat()` — трансформирует JSON Zephyr → формат Excel-строк
- [ ] 2.3 Исправить `syncFromZephyr()`: вызвать `importTestCases()` после `fetchTestCasesFromZephyr()`
- [ ] 2.4 Добавить unit-тесты для всей цепочки: fetch → transform → import
- [ ] 2.5 Проверить E2E: запустить `POST /api/zephyr/sync` после настройки credentials
- [ ] 2.6 Обработка ошибок: network error, invalid token, пустой ответ, дубликаты ключей

**Критерий готовности:** После `POST /api/zephyr/sync` в локальной БД появляются TC из Zephyr

---

## Phase 3 — API Gateway: пропущенные маршруты

**Цель:** Все endpoints доступны через единый gateway (порт 3000)

**Подзадачи:**
- [ ] 3.1 Добавить `/api/videos` → browser-agent:3005
- [ ] 3.2 Добавить `/api/video/*` → browser-agent:3005
- [ ] 3.3 Добавить `/api/debug/*` → browser-agent:3005
- [ ] 3.4 Добавить `/api/composite-categories` → step-library-service:3002
- [ ] 3.5 Проверить что нет конфликтов маршрутов (тест на дубликаты prefix)

**Критерий готовности:** Все endpoints из `api-reference.md` + `browser-agent` маршруты проксируются через 3000

---

## Phase 4 — Unit-тесты для сервисов

**Цель:** Повысить покрытие кода (сейчас 205 тестов только для 2 пакетов)

**Подзадачи:**
- [ ] 4.1 **testcase-service** (Vitest + better-sqlite3 :memory:)
  - [ ] CRUD: create, read, update, delete test case
  - [ ] get folders
  - [ ] Excel import (parseExcelRows + importTestCases)
  - [ ] Diff engine (diffWithLocal + diffExcelWithLocal)
  - [ ] Coverage API
  - [ ] Zephyr sync (stub для HTTP)
- [ ] 4.2 **step-library-service** (Vitest + :memory:)
  - [ ] CRUD library steps
  - [ ] CRUD composite steps
  - [ ] Expand с подстановкой параметров
  - [ ] Seed данные создаются при старте
- [ ] 4.3 **execution-service** (Vitest + :memory:)
  - [ ] Создание выполнения (fetch testcase из TC service)
  - [ ] State machine: not_started → running → passed/failed
  - [ ] Composite step expansion (pre-fetch)
  - [ ] auto-next с browser-agent вызовом
  - [ ] Reports: summary, history, test-case
- [ ] 4.4 **recorder-service server** (Vitest)
  - [ ] HTTP health endpoint
  - [ ] Session CRUD (create, stop, get, list)
  - [ ] Actions bulk add
  - [ ] Convert endpoint
  - [ ] Settings CRUD

**Критерий готовности:** Все 4 сервиса имеют базовое тестовое покрытие (минимум 10-20 тестов на сервис)

---

## Phase 5 — Документация VitePress

**Цель:** Завершить документацию (2 недостающие страницы)

**Подзадачи:**
- [ ] 5.1 **Chrome Extension страница**
  - [ ] Проверить что `docs/chrome-extension.md` имеет Frontmatter + Source
  - [ ] Добавить в навигацию `.vitepress/config.ts`
  - [ ] Проверить что собирается в `npm run docs:build`
- [ ] 5.2 **API Reference — полная спецификация**
  - [ ] Добавить все endpoints из всех 7 сервисов
  - [ ] Добавить форматы request/response body
  - [ ] Добавить HTTP status codes
  - [ ] Разделить по сервисам с таблицами
  - [ ] Добавить примеры curl

**Критерий готовности:** `npm run docs:build` — 0 ошибок, 20+ страниц

---

## Phase 6 — Minor fixes

**Цель:** Исправить известные мелкие баги

**Подзадачи:**
- [ ] 6.1 Дубликаты dragstart/dragend/drop в `convertToSteps()` (`db.ts`)
  - Проблема: два switch-case блока для одних и тех же action types
  - Решение: удалить второй блок (оставить первый, который правильно группирует drag+drop)
- [ ] 6.2 Проверить `selection_length` vs `length` — консистентность имени колонки в БД
- [ ] 6.3 Проверить что все action types из `settings.tsx` (69 шт.) соответствуют `convertToSteps()`
- [ ] 6.4 Прогнать `npm run lint` и `npm test` — убедиться что 0 errors

**Критерий готовности:** `npm test` — 205+ тестов, `npm run lint` — 0 errors, `npm run build` — 0 errors

---

## Сводная таблица

| Phase | Описание | Приоритет | Зависимости |
|-------|----------|-----------|-------------|
| 0 | Исследование Jira auth | 🔴 P0 | — |
| 1 | Config loader (credentials) | 🔴 P0 | Phase 0 |
| 2 | Zephyr Sync API | 🔴 P0 | Phase 1 |
| 3 | API Gateway routes | 🟡 P1 | — |
| 4 | Unit tests | 🟡 P1 | Phase 1-2 |
| 5 | Документация | 🟢 P2 | — |
| 6 | Minor fixes | 🟢 P2 | Phase 1-2 |

---

## Security policy

1. **AI НИКОГДА не видит token/пароль** в момент создания — пользователь копирует сам
2. AI читает только готовый config-файл с диска
3. `apiToken` НЕ логируется — все логи чистые
4. Файл `credentials.json` — в `.gitignore` и никогда не попадёт в репозиторий
5. Service account (рекомендуется): только read-only права на конкретный проект
