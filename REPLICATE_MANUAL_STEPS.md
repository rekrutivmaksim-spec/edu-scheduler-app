# Replicate Manual Step-by-Step Generation

## Новая Архитектура (Ручной Контроль)

Теперь пользователь **контролирует каждый шаг** генерации!

### Компоненты:

1. **replicate-async-start** - Создаёт задачу, триггерит worker
2. **replicate-async-worker** - Запускает первую prediction
3. **replicate-prediction-checker** - Проверяет prediction и ставит статус `waiting_continue`
4. **replicate-continue** - Запускает следующий шаг по команде пользователя
5. **replicate-async-status** - Возвращает статус + промежуточный результат

## Как это работает

**Пример: пользователь добавляет 3 вещи**

1. Пользователь нажимает "Создать образ"
2. Frontend → `start` → создаёт задачу (status: pending)
3. `worker` запускает prediction для вещи #1 (status: processing, step 1/3)
4. **Checker** (каждые 30-60 сек) проверяет prediction:
   - Готова? → status: `waiting_continue` + сохраняет intermediate_result
5. **Frontend показывает**:
   - ✅ "Шаг 1 из 3 готов!"
   - Изображение с вещью #1
   - 🔵 Кнопка "Продолжить (шаг 2/3)"
6. Пользователь смотрит результат и **нажимает "Продолжить"**
7. Frontend → `continue` → запускает prediction для вещи #2 (step 2/3)
8. Checker снова ждёт → `waiting_continue` → показывает вещь #2
9. Пользователь нажимает "Продолжить" ещё раз
10. Вещь #3 → `completed` → финальный результат!

## Преимущества

✅ **Контроль** - пользователь видит каждый шаг  
✅ **Остановка** - можно остановиться на любом этапе  
✅ **Скачивание** - можно скачать промежуточный результат  
✅ **Прозрачность** - понятно что происходит на каждом шаге  

## Настройка Checker (ОБЯЗАТЕЛЬНО!)

**Checker нужен чтобы predictions переходили из `processing` в `waiting_continue`**

### UptimeRobot (рекомендуется)

Создайте 2 монитора на https://uptimerobot.com:

**Монитор 1: Worker**
- URL: `https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e`
- Interval: 1 minute

**Монитор 2: Checker** ⚠️ ВАЖНО
- URL: `https://functions.poehali.dev/b4e78e2b-eef9-4061-8647-4ae4373a0c4d`
- Interval: 1 minute

### Cron-job.org

1. Worker → Every 1 minute
2. Checker → Every 30 seconds

### GitHub Actions

```yaml
name: Replicate Checker

on:
  schedule:
    - cron: '*/1 * * * *'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e
          sleep 10
          curl https://functions.poehali.dev/b4e78e2b-eef9-4061-8647-4ae4373a0c4d
```

## Тестирование

```bash
# 1. Создайте задачу через frontend (2-3 вещи)

# 2. Подождите 1 минуту (Replicate генерирует)

# 3. Вызовите checker
curl https://functions.poehali.dev/b4e78e2b-eef9-4061-8647-4ae4373a0c4d
# Должен вернуть: {"message": "Checked 1 predictions", "checked": 1}

# 4. Проверьте статус задачи
curl "https://functions.poehali.dev/cde034e8-99be-4910-9ea6-f06cc94a6377?task_id=YOUR_TASK_ID"
# Должен вернуть: status: "waiting_continue", intermediate_result: "https://..."

# 5. Нажмите "Продолжить" в UI или вручную:
curl -X POST https://functions.poehali.dev/fdb150a0-d5ba-47ec-9d9a-e13595cd92d1 \
  -H "Content-Type: application/json" \
  -d '{"task_id": "YOUR_TASK_ID"}'

# 6. Повторяйте шаги 2-5 для каждого шага
```

## Таблица БД

```sql
CREATE TABLE replicate_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'waiting_continue', 'completed', 'failed')),
    person_image TEXT NOT NULL,
    garments TEXT NOT NULL,
    prompt_hints TEXT,
    result_url TEXT,
    error_message TEXT,
    prediction_id TEXT,
    intermediate_result TEXT,
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

## Статусы

- `pending` - Задача создана, ждёт worker
- `processing` - Prediction запущена, идёт генерация
- **`waiting_continue`** - Шаг готов, ждёт команды пользователя ⚠️
- `completed` - Все шаги завершены
- `failed` - Ошибка

## URLs

- Start: https://functions.poehali.dev/c1cb3f04-f40a-4044-87fd-568d0271e1fe
- Worker: https://functions.poehali.dev/1fb0123a-5d1e-4bf3-8052-44ac16407a2e
- **Checker**: https://functions.poehali.dev/b4e78e2b-eef9-4061-8647-4ae4373a0c4d
- **Continue**: https://functions.poehali.dev/fdb150a0-d5ba-47ec-9d9a-e13595cd92d1
- Status: https://functions.poehali.dev/cde034e8-99be-4910-9ea6-f06cc94a6377

## SQL для мониторинга

```sql
-- Активные задачи
SELECT id, status, current_step, total_steps, 
       ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at))) as sec_ago
FROM replicate_tasks 
WHERE status IN ('pending', 'processing', 'waiting_continue')
ORDER BY created_at DESC;

-- Задачи ожидающие продолжения
SELECT id, user_id, current_step, total_steps
FROM replicate_tasks
WHERE status = 'waiting_continue';
```
