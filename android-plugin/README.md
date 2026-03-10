# RuStore Pay Plugin для Studyfay (Capacitor Android)

## Новый SDK (BOM 2025.11.01)

Плагин переписан на **Kotlin** и использует новый **RuStore Pay SDK** вместо старого `billingclient`.

Ключевые отличия:
- Инициализация через `<meta-data>` в манифесте (не в коде)
- `RuStorePayClient.instance` вместо `RuStoreBillingClientFactory`
- Обязательный `proceedIntent()` для deep link возврата после оплаты
- BOM для управления версиями: `ru.rustore.sdk:bom:2025.11.01`

---

## Пошаговая инструкция сборки APK

### Шаг 1. Создай Android-проект (если ещё нет):
```bash
npm run build
npx cap add android
npx cap sync
```

### Шаг 2. Добавь Kotlin и RuStore SDK

**android/build.gradle** (корневой, project-level) — добавь Kotlin плагин:
```gradle
plugins {
    id 'com.android.application' version '8.2.0' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.22' apply false
}
```

**android/settings.gradle** — добавь репозиторий RuStore:
```gradle
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://artifactory-external.vkpartner.ru/artifactory/maven") }
    }
}
```

**android/app/build.gradle** — подключи Kotlin и зависимости:
```gradle
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    // ...
    kotlinOptions {
        jvmTarget = '1.8'
    }
}

dependencies {
    // RuStore Pay SDK (через BOM)
    implementation(platform("ru.rustore.sdk:bom:2025.11.01"))
    implementation("ru.rustore.sdk:pay")

    // Kotlin coroutines
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // ... остальные зависимости
}
```

### Шаг 3. Удали старые Java-файлы и скопируй новые Kotlin:
```bash
# Удалить старые Java
rm -f android/app/src/main/java/ru/studyfay/app/MainActivity.java
rm -f android/app/src/main/java/ru/studyfay/app/RuStoreBillingPlugin.java

# Скопировать новые Kotlin
cp android-plugin/MainActivity.kt android/app/src/main/java/ru/studyfay/app/
cp android-plugin/RuStoreBillingPlugin.kt android/app/src/main/java/ru/studyfay/app/
```

### Шаг 4. Замени AndroidManifest.xml
```bash
cp android-plugin/AndroidManifest.xml android/app/src/main/AndroidManifest.xml
```

В манифесте уже добавлены:
- `console_app_id_value` = `2063697825` (ID приложения в RuStore Console)
- `sdk_pay_scheme_value` = `studyfay` (схема deep link для возврата после оплаты)
- Intent-filter для deep link `studyfay://`

### Шаг 5. Собери APK:
```bash
cd android
./gradlew assembleRelease
```

---

## Как проверить что всё работает

1. Установи APK на телефон
2. Открой страницу тарифов
3. Нажми "Купить" — должно появиться окно оплаты RuStore
4. После оплаты через СберПей/СБП приложение вернётся через deep link `studyfay://`

### Диагностика (если не работает)

На странице тарифов внизу есть кнопка «Диагностика». Она покажет:
- `isAndroid` — обнаружен ли Android WebView
- `hasBridgeObject` — есть ли `window.RuStoreBilling`
- `isAvailable` — прошла ли проверка доступности платежей
- `initError` — ошибка инициализации (если есть)

---

## Как это работает

1. `MainActivity.onCreate()` → `proceedIntent(intent)` передаёт deep link в SDK
2. `MainActivity` регистрирует JS-интерфейс `window.RuStoreBilling`
3. При инициализации `RuStoreBillingPlugin` проверяет `getPurchaseAvailability()`
4. Фронтенд вызывает `window.RuStoreBilling.purchase(productId)`
5. Плагин создаёт `ProductPurchaseParams` и вызывает `getPurchaseInteractor().purchase()`
6. SDK открывает шторку оплаты RuStore
7. После завершения плагин вызывает `window.onRuStorePurchaseResult(json)`
8. Фронтенд отправляет `purchaseToken` на бэкенд для валидации

---

## Product IDs (настроить в RuStore Console → Монетизация):

| ID | Тип | Название | Цена |
|----|-----|----------|------|
| premium_1month | Подписка | 1 месяц | 499 ₽ |
| premium_6months | Подписка | 6 месяцев | 1 499 ₽ |
| premium_1year | Подписка | 1 год | 2 399 ₽ |
| questions_20 | Разовая покупка | +20 вопросов | 149 ₽ |
| questions_30 | Разовая покупка | +30 вопросов | 300 ₽ |
| questions_100 | Разовая покупка | +100 вопросов | 600 ₽ |