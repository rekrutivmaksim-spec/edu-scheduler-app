# RuStore Billing Plugin для Studyfay (Capacitor Android)

## Установка

### 1. Создай Android-проект (если нет):
```bash
npm run build
npx cap add android
npx cap sync
```

### 2. Добавь RuStore SDK в зависимости:

**android/build.gradle** (project-level), в `allprojects.repositories`:
```gradle
maven { url = uri("https://artifactory-external.vkpartner.ru/artifactory/maven") }
```

**android/app/build.gradle**, в `dependencies`:
```gradle
implementation "ru.rustore.sdk:billingclient:6.1.0"
```

### 3. Скопируй файлы плагина:

```bash
cp android-plugin/MainActivity.java android/app/src/main/java/ru/studyfay/app/MainActivity.java
cp android-plugin/RuStoreBillingPlugin.java android/app/src/main/java/ru/studyfay/app/RuStoreBillingPlugin.java
```

### 4. Укажи CONSOLE_ID:

В `RuStoreBillingPlugin.java`, строка:
```java
private static final String CONSOLE_ID = "your_console_id";
```
Замени `your_console_id` на ID из RuStore Console → Настройки компании.

### 5. Собери APK:
```bash
cd android
./gradlew assembleRelease
```

## Как это работает

1. При запуске `MainActivity` регистрирует JS-интерфейс `window.RuStoreBilling`
2. Фронтенд (rustore-billing.ts) вызывает `window.RuStoreBilling.purchase(productId)`
3. Открывается окно оплаты RuStore
4. После успеха плагин вызывает `window.onRuStorePurchaseResult(json)`
5. Фронтенд отправляет purchaseToken на бэкенд для валидации

## Product IDs (настроить в RuStore Console → Подписки):

| ID | Название | Цена |
|----|----------|------|
| premium_1month | 1 месяц | 499 ₽ |
| premium_6months | 6 месяцев | 1 499 ₽ |
| premium_1year | 1 год | 2 399 ₽ |
| questions_20 | +20 вопросов | 149 ₽ |
| questions_30 | +30 вопросов | 300 ₽ |
| questions_100 | +100 вопросов | 600 ₽ |
