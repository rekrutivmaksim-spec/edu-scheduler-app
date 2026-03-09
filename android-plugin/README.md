# RuStore Billing Plugin для Studyfay (Capacitor Android)

## Пошаговая инструкция сборки APK

### Шаг 1. Создай Android-проект (если ещё нет):
```bash
npm run build
npx cap add android
npx cap sync
```

### Шаг 2. Добавь RuStore SDK

Открой файл **android/build.gradle** (корневой, project-level).
Найди блок `allprojects { repositories { ... } }` и добавь строку:
```gradle
maven { url = uri("https://artifactory-external.vkpartner.ru/artifactory/maven") }
```

Открой файл **android/app/build.gradle**.
Найди блок `dependencies { ... }` и добавь:
```gradle
implementation "ru.rustore.sdk:billingclient:6.1.0"
```

### Шаг 3. Скопируй файлы плагина:
```bash
cp android-plugin/MainActivity.java android/app/src/main/java/ru/studyfay/app/MainActivity.java
cp android-plugin/RuStoreBillingPlugin.java android/app/src/main/java/ru/studyfay/app/RuStoreBillingPlugin.java
```

### Шаг 4. Добавь deeplink в AndroidManifest.xml

Открой файл:
```
android/app/src/main/AndroidManifest.xml
```

Найди тег `<activity` (это главная активность приложения). Внутри него уже будут какие-то `<intent-filter>`. Добавь **ещё один** блок `<intent-filter>` прямо перед закрывающим `</activity>`:

```xml
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="studyfay" />
            </intent-filter>
```

**Пример** — как это выглядит в контексте (добавленный блок отмечен стрелками):

```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTask"
    ...>

    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>

    <!-- ▼▼▼ ДОБАВЬ ЭТОТ БЛОК ▼▼▼ -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="studyfay" />
    </intent-filter>
    <!-- ▲▲▲ КОНЕЦ БЛОКА ▲▲▲ -->

</activity>
```

Этот блок нужен, чтобы после оплаты через СберПей/СБП/другие приложения пользователь возвращался обратно в Studyfay.

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
4. Если вместо окна оплаты открывается страница RuStore в браузере — значит SDK не инициализирован (проверь Console ID)

## Как это работает

1. При запуске `MainActivity` регистрирует JS-интерфейс `window.RuStoreBilling`
2. Фронтенд вызывает `window.RuStoreBilling.purchase(productId)`
3. Открывается окно оплаты RuStore
4. После успеха плагин вызывает `window.onRuStorePurchaseResult(json)`
5. Фронтенд отправляет purchaseToken на бэкенд для валидации

## Product IDs (настроить в RuStore Console → Монетизация):

| ID | Тип | Название | Цена |
|----|-----|----------|------|
| premium_1month | Подписка | 1 месяц | 499 ₽ |
| premium_6months | Подписка | 6 месяцев | 1 499 ₽ |
| premium_1year | Подписка | 1 год | 2 399 ₽ |
| questions_20 | Разовая покупка | +20 вопросов | 149 ₽ |
| questions_30 | Разовая покупка | +30 вопросов | 300 ₽ |
| questions_100 | Разовая покупка | +100 вопросов | 600 ₽ |
