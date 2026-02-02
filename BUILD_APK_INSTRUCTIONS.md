# 📦 Инструкция по сборке Android APK для RuStore

## Предварительные требования

### 1. Установка необходимых программ

#### Java Development Kit (JDK)
```bash
# Проверка установки
java -version

# Если не установлен, скачать JDK 17 или новее:
# https://www.oracle.com/java/technologies/downloads/
```

#### Android Studio
```bash
# Скачать и установить:
# https://developer.android.com/studio

# После установки открыть SDK Manager и установить:
# - Android SDK Platform 33 (минимум)
# - Android SDK Build-Tools
# - Android SDK Command-line Tools
```

#### Node.js и зависимости
```bash
# Убедитесь что у вас установлен Node.js 18+
node -v

# Установите зависимости проекта
npm install

# Установите Capacitor CLI глобально
npm install -g @capacitor/cli
```

---

## Шаг 1: Сборка веб-приложения

```bash
# Собрать production-версию React приложения
npm run build

# Результат появится в папке dist/
```

---

## Шаг 2: Синхронизация с Capacitor

```bash
# Синхронизировать веб-билд с Android проектом
npx cap sync android

# Эта команда:
# 1. Копирует dist/ в android/app/src/main/assets/public/
# 2. Обновляет нативные зависимости
# 3. Синхронизирует конфигурацию из capacitor.config.ts
```

---

## Шаг 3: Открытие проекта в Android Studio

```bash
# Открыть Android проект в Android Studio
npx cap open android
```

Android Studio должна открыться автоматически с проектом.

---

## Шаг 4: Создание keystore для подписи APK

### 4.1. Генерация keystore (первый раз)

```bash
# В терминале выполнить:
keytool -genkey -v -keystore studyfay-release.keystore \
  -alias studyfay -keyalg RSA -keysize 2048 -validity 10000

# Запомните пароли! Они понадобятся при каждой сборке.
```

**Что нужно ввести:**
- Пароль keystore (минимум 6 символов)
- Пароль ключа (можно такой же как у keystore)
- Ваше имя и фамилия
- Организацию (опционально, можно нажать Enter)
- Город, регион, страну

**⚠️ ВАЖНО**: Сохраните `studyfay-release.keystore` и пароли в безопасном месте!
Без них вы не сможете обновить приложение в RuStore.

### 4.2. Конфигурация Android Studio

1. В Android Studio откройте файл: `android/app/build.gradle`

2. Добавьте **над блоком `android {`**:

```gradle
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

3. В блок `android { ... }` добавьте **перед `buildTypes`**:

```gradle
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
```

4. В блок `buildTypes { release { ... } }` добавьте:

```gradle
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
```

5. Создайте файл `android/key.properties`:

```properties
storePassword=ВАШ_ПАРОЛЬ_KEYSTORE
keyPassword=ВАШ_ПАРОЛЬ_КЛЮЧА
keyAlias=studyfay
storeFile=../studyfay-release.keystore
```

6. Скопируйте `studyfay-release.keystore` в папку `android/`

---

## Шаг 5: Сборка Release APK

### В Android Studio:

1. **Build → Generate Signed Bundle / APK**
2. Выбрать **APK** (не Bundle)
3. Нажать **Next**
4. Указать путь к `studyfay-release.keystore`
5. Ввести пароли
6. Выбрать **release** build variant
7. Выбрать **V1 (Jar Signature)** и **V2 (Full APK Signature)**
8. Нажать **Finish**

### Или через командную строку:

```bash
cd android

# Для Windows:
gradlew.bat assembleRelease

# Для macOS/Linux:
./gradlew assembleRelease
```

---

## Шаг 6: Найти готовый APK

APK будет находиться в:

```
android/app/build/outputs/apk/release/app-release.apk
```

**Размер**: Около 15-25 МБ

---

## Шаг 7: Тестирование APK перед загрузкой

### Установка на реальное устройство:

1. Включить **Режим разработчика** на Android устройстве:
   - Настройки → О телефоне → 7 раз нажать на "Номер сборки"
   
2. Включить **Установку из неизвестных источников**

3. Установить через ADB:
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

Или скопировать APK на телефон и установить вручную.

### Что проверить:
- ✅ Приложение запускается
- ✅ Авторизация работает
- ✅ Все страницы открываются
- ✅ AI-функции работают (если есть интернет)
- ✅ Нет вылетов и ошибок

---

## Шаг 8: Подготовка к загрузке в RuStore

### Файлы для загрузки:

1. **APK файл**: `app-release.apk` (~20 MB)

2. **Иконка 512x512** (скачать и переименовать):
```
https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/97c50a55-899f-44f1-8010-a49be1fbacdc.jpg
→ Сохранить как: icon-512.jpg
```

3. **Иконка 1024x1024** (та же картинка, разные размеры нужны RuStore)
```
https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/97c50a55-899f-44f1-8010-a49be1fbacdc.jpg
→ Сохранить как: icon-1024.jpg
```

4. **Скриншоты** (5 штук, в порядке приоритета):

```
1. AI-ассистент:
https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/807e651a-b25b-40ba-adcc-36b91c621add.jpg

2. Расписание:
https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/f286f823-9d27-43b1-aabc-20483807f04b.jpg

3. Прогноз экзамена:
https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/25368833-26b7-4448-9208-dfd9c2838197.jpg

4. Библиотека материалов:
https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/c02002c4-7571-48ce-b293-1f6daa262972.jpg

5. Аналитика:
https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/331e765d-ca8b-474b-898e-559e2d3f6b7e.jpg
```

5. **Промо-баннер** (для обложки):
```
Широкий 16:9 (рекомендуется):
https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/f3265d11-57b7-4e00-9e33-f00024fb753b.jpg
```

---

## Частые проблемы и решения

### Ошибка: "SDK location not found"

**Решение**:
```bash
# Создать файл android/local.properties
echo "sdk.dir=/путь/к/Android/sdk" > android/local.properties

# Для macOS обычно:
echo "sdk.dir=/Users/ВАШ_ЮЗЕР/Library/Android/sdk" > android/local.properties

# Для Windows:
echo sdk.dir=C:\\Users\\ВАШ_ЮЗЕР\\AppData\\Local\\Android\\sdk > android/local.properties
```

### Ошибка: "Keystore was tampered with or password was incorrect"

**Решение**: Проверьте пароли в `android/key.properties`

### APK слишком большой (>100 MB)

**Решение**: Использовать Android App Bundle (AAB) вместо APK:
```bash
./gradlew bundleRelease
```

### Приложение не открывается после установки

**Решение**: Убедитесь что собрали **release**, а не debug версию

---

## Информация о приложении

**Пакет**: `dev.poehali.studyfay`  
**Название**: Studyfay  
**Версия**: 1.0.0  
**Минимальный Android**: 5.0 (API 21)  
**Целевой Android**: 13.0 (API 33)

---

## Следующие шаги

После успешной сборки APK:

1. ✅ Протестировать на реальном устройстве
2. ✅ Скачать все графические материалы
3. ✅ Зарегистрироваться на https://console.rustore.ru/
4. ✅ Создать карточку приложения
5. ✅ Загрузить APK и графику
6. ✅ Заполнить описания (см. RUSTORE_PROMO_ASSETS.md)
7. ✅ Отправить на модерацию

---

**Дата создания**: 2 февраля 2026  
**Статус**: Готова к использованию
