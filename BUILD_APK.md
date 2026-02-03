# 📱 Инструкция по сборке Android APK для Studyfay

## ✅ Что уже готово:
- Capacitor настроен (capacitor.config.ts)
- Плагины установлены (Camera, Filesystem, SplashScreen)
- Конфигурация для нативного приложения готова

## 🚀 Шаги для создания APK:

### 1. Соберите проект
```bash
npm run build
```

### 2. Добавьте Android платформу (только первый раз)
```bash
npx cap add android
```

### 3. Синхронизируйте код с Android проектом
```bash
npx cap sync
```

### 4. Откройте Android Studio
```bash
npx cap open android
```

### 5. В Android Studio соберите APK:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- Готовый APK будет в: `android/app/build/outputs/apk/debug/app-debug.apk`

### 6. Для релизной версии (с подписью):
```bash
cd android
./gradlew assembleRelease
```

---

## 🔧 Альтернативный способ (без Android Studio):

### Через командную строку:
```bash
# 1. Соберите проект
npm run build

# 2. Синхронизируйте с Android
npx cap sync

# 3. Соберите APK
cd android
./gradlew assembleDebug

# Готовый APK: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📋 Требования:
- **Android Studio** (последняя версия) — https://developer.android.com/studio
- **Java JDK 17+** (устанавливается с Android Studio)
- **Android SDK** (устанавливается с Android Studio)

---

## 🎯 Нативные возможности приложения:

После сборки APK у приложения будет доступ к:
- ✅ **Камера** — для сканирования конспектов
- ✅ **Файловая система** — для сохранения материалов
- ✅ **Splash Screen** — фиолетовый экран загрузки с логотипом
- ✅ **Status Bar** — управление статус-баром Android
- ✅ **Оффлайн-режим** — кеширование данных локально

---

## 🔐 Подпись APK для релиза:

Создайте keystore (один раз):
```bash
keytool -genkey -v -keystore studyfay-release.keystore -alias studyfay -keyalg RSA -keysize 2048 -validity 10000
```

Настройте в `android/app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            storeFile file("../../studyfay-release.keystore")
            storePassword "ваш_пароль"
            keyAlias "studyfay"
            keyPassword "ваш_пароль"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

Затем:
```bash
cd android
./gradlew assembleRelease
# Подписанный APK: android/app/build/outputs/apk/release/app-release.apk
```

---

## 🐛 Решение проблем:

### Ошибка: "Android SDK not found"
```bash
# В Android Studio: Tools → SDK Manager → установите SDK
# Добавьте в ~/.bashrc или ~/.zshrc:
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Ошибка: "Java not found"
```bash
# Проверьте версию Java:
java -version

# Должна быть 17+. Если нет — установите через Android Studio:
# File → Settings → Build → Build Tools → Gradle → Gradle JDK
```

### Ошибка при сборке
```bash
# Очистите кеш и пересоберите:
cd android
./gradlew clean
./gradlew assembleDebug
```

---

## 📤 Публикация в Google Play:

1. Соберите подписанный релиз APK (см. выше)
2. Зарегистрируйтесь в Google Play Console ($25 один раз)
3. Создайте приложение и загрузите APK
4. Заполните описание, скриншоты, иконку
5. Отправьте на модерацию (1-3 дня)

---

## 🎉 Готово!

После сборки APK можно:
- Установить на Android-устройство напрямую
- Отправить пользователям для тестирования
- Опубликовать в Google Play Store
