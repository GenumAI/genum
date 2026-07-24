# API Key Activity в дешборде проекта

**Дата:** 2026-07-24

## Задача

Выяснить, логируем ли мы, какой именно API-ключ использовался, и показать это в дешборде.

## Что уже есть

Логируем. Колонка `api_key_id Nullable(UInt32)` объявлена в `apps/core/clickhouse/init.sql:17`,
`logUsage()` её пишет (`apps/core/src/services/logger/logger.ts:178`), `runPrompt()` прокидывает
и в success-, и в error-ветке (`apps/core/src/ai/runner/run.ts:206,236`).

Заполняет её ровно один вызов — `ApiV1Controller.runPrompt` передаёт `api_key_id: key.id`
(`apps/core/src/controllers/apiv1.controller.ts:156`). Это Genum-ключ проекта, модель
`ProjectApiKey` (поля `name`, `publicKey`, `authorId`, `lastUsed`). Запуски из UI и из
тесткейсов пишут `null`.

Чего нет:

- ни один аналитический запрос в `logger/queries.ts` не группирует по `api_key_id`;
- `api_key_id` возвращается из `transformRowToLogDocument`, но во фронтовом типе `Log` его нет,
  то есть до UI поле не доезжает;
- дешборд про ключи не показывает ничего.

Ключ AI-провайдера (OpenAI / Anthropic / Gemini) не логируется вообще — только `vendor` и
`model`. Это вне объёма данной работы.

## Решение

Новая карточка **API Key Activity** на странице дешборда — ещё один срез уже существующих
данных, по образцу карточки User Activity. Миграции ClickHouse не требуются.

### Бэкенд

1. `apps/core/src/services/logger/queries.ts` — запрос `API_KEY_STATS`:

   ```sql
   SELECT
       api_key_id,
       count() AS total_requests,
       sum(tokens_sum) AS total_tokens_sum,
       sum(cost) AS total_cost,
       max(timestamp) AS last_activity
   FROM ${table}
   WHERE ${where}
   GROUP BY api_key_id
   ORDER BY total_requests DESC
   LIMIT 100
   ```

2. `apps/core/src/services/logger/types.ts` — интерфейсы `ApiKeyUsageStats`
   (`api_key_id`, `api_key_name`, `total_requests`, `total_tokens_sum`, `total_cost`,
   `last_activity`) и `ClickHouseApiKeyStatsRow`; поле `api_keys: ApiKeyUsageStats[]`
   в `ProjectDetailedUsageStats`.

3. `apps/core/src/services/logger/logger.ts` — в `getProjectDetailedUsageStats` добавить
   запрос с `WHERE ... AND api_key_id IS NOT NULL`, как это уже сделано для `user_id`.
   Строки с `null` (UI и тесткейсы) отсекаются: карточка про ключи, а не про весь трафик.
   Маппинг строки ClickHouse в `ApiKeyUsageStats` выносится в экспортируемую чистую функцию
   `mapApiKeyStatsRow` — она и покрывается тестом.

4. `apps/core/src/controllers/project.controller.ts` — в `getProjectDetailedUsageStats`
   обогатить срез именами через существующий `db.project.getProjectApiKeys(projID)`
   (ключей на проект мало, отдельный репозиторный метод не нужен). Ключ, которого больше
   нет в Postgres, имени не получает: `api_key_name: null`.

### Фронтенд

5. `apps/web/src/api/project/project.api.ts` — интерфейс `UsageApiKeyStat` и поле
   `api_keys` в `UsageData`.

6. `apps/web/src/pages/dashboard/components/ApiKeyActivityTable.tsx` — новая карточка,
   структурно повторяющая `UserActivityTable`: TanStack Table, сортировка по колонкам,
   скелетон, `EmptyState` при отсутствии данных.

   Колонки: **API Key**, **Total Requests**, **Total Tokens**, **Total Cost**, **Last Used**.
   Колонки First Used нет.

   Ключ без имени отображается как `Key #<id> (deleted)` — по аналогии с тем, как
   `UserActivityTable` показывает `User ${row.user_id}`.

7. `apps/web/src/pages/dashboard/Dashboard.tsx` — карточка рендерится под
   `UserActivityTable`, в обеих ветках: скелетон и контент.

## Принятые решения

**Двойной учёт оставляем.** Для API-вызовов пишется `user_id: key.authorId`, поэтому один и
тот же запрос виден и в User Activity (на авторе ключа), и в новой таблице. Это такой же
независимый срез одних и тех же логов, как срезы по моделям и промптам. `USER_STATS` не
трогаем, чтобы не менять цифры, к которым люди привыкли.

**Строки без ключа скрываем.** `api_key_id IS NOT NULL` отсекает запуски из UI и тесткейсов.
Их объём виден в других карточках дешборда.

## Тестирование

В репозитории тесты юнитовые и колокейтед (`*.test.ts`), интеграционных тестов с ClickHouse
нет. Поэтому:

- `apps/core/src/services/logger/logger.test.ts` — тест на `mapApiKeyStatsRow`: числа
  приходят из ClickHouse строками и должны стать числами, `last_activity` может быть `null`,
  отсутствующие значения дают `0`.
- `pnpm --filter core type-check`
- `pnpm build`
