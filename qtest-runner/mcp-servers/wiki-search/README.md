# Wiki & Jira Search MCP Server

Быстрый поиск по wiki.ifellow.ru и jira.ifellow.ru (Zephyr Scale).

## Инструменты

| Инструмент | Описание |
|---|---|
| `wiki_search` | Поиск страниц wiki по ключевому слову |
| `wiki_get_page` | Получить содержимое страницы wiki по ID |
| `wiki_list_spaces` | Список пространств wiki |
| `zephyr_search` | Поиск тест-кейсов в Zephyr Scale |
| `zephyr_get_case` | Получить детали тест-кейса по ключу |
| `zephyr_list_folders` | Список папок тест-кейсов проекта |

## Примеры использования

```
# Найти wiki-страницу про "Прогнозы"
wiki_search(spaceKey: "RegDoc", query: "Прогнозы")

# Получить страницу wiki по ID
wiki_get_page(pageId: "32971587")

# Найти тест-кейсы про "Дополнительные доходы"
zephyr_search(projectKey: "IBPA", search: "Дополнительные доходы")

# Получить тест-кейс по ключу
zephyr_get_case(key: "IBPA-T3772")
```

## Конфигурация

Требуется файл `~/.qtest/credentials.json` с Jira-профилем:

```json
{
  "profiles": {
    "jira": {
      "host": "https://jira.ifellow.ru",
      "token": "YOUR_TOKEN"
    }
  },
  "jira": "jira"
}
```
