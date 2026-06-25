# Результат анализа

## Что сделано

1. **Загружена вся документация kiro.dev/docs**
   - 13+ страниц документации Kiro IDE
   - CLI documentation
   - Все подразделы (Specs, Hooks, Steering, MCP, Powers, Skills, Chat, Models, Privacy)

2. **Проанализирована архитектура opencode Desktop**
   - Electron 41.2.1 + SolidJS 1.9.10
   - Sidecar архитектура (UtilityProcess с HTTP-сервером)
   - Preload(contextBridge) → Renderer (изолировано)
   - Внешний пакет `@opencode-ai/app` — весь UI приложения
   - i18n на 16 языков, Sentry, electron-store

3. **Создан детальный промпт** (`PROMPT.md`)

## Файлы в папке `kiro-docs-analysis/`

```
kiro-docs-analysis/
├── README.md          # Общий анализ: структура Kiro, фичи, архитектура desktop, что нужно добавить
├── PROMPT.md          # Детальный промпт для реализации — можно скопировать и отправить мне
├── SUMMARY.md         # Этот файл
└── pages/             # (пусто, docs сохранены в этом README)
```

## Как использовать

1. Скопируй содержимое `PROMPT.md`
2. Отправь его мне как новый запрос
3. Я начну реализацию: сначала спроектирую архитектуру, затем буду добавлять функционал поэтапно

## Ключевые отличия Kiro vs opencode

| Аспект | Kiro | opencode |
|--------|------|----------|
| Платформа | AWS, проприетарный IDE | Open Source |
| UI фреймворк | VS Code-based | SolidJS + `@opencode-ai/ui` |
| MCP | Встроенная поддержка | Нужно добавить |
| Specs | Встроенные | Нужно добавить |
| Hooks | Встроенные | Нужно добавить |
| Steering | Встроенные (`.kiro/steering/`) | Есть AGENTS.md, но не полный |
| Models | Claude, DeepSeek, Qwen и др. | Свои модели |
| Skills | Agent Skills стандарт | Нужно добавить |
| Powers | MCP + knowledge бандлы | Нужно добавить |
