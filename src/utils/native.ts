import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/**
 * Проверка, запущено ли приложение как нативное (не в браузере)
 */
export const isNativeApp = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Получить платформу (ios, android, web)
 */
export const getPlatform = () => {
  return Capacitor.getPlatform();
};

/**
 * Открыть камеру и получить фото в base64
 */
export const takePicture = async (): Promise<string> => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera
  });

  return `data:image/jpeg;base64,${image.base64String}`;
};

/**
 * Выбрать фото из галереи
 */
export const pickPhoto = async (): Promise<string> => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: CameraSource.Photos
  });

  return `data:image/jpeg;base64,${image.base64String}`;
};

/**
 * Сохранить текст в файл
 */
export const saveTextFile = async (filename: string, content: string): Promise<string> => {
  const result = await Filesystem.writeFile({
    path: filename,
    data: content,
    directory: Directory.Documents,
    encoding: 'utf8'
  });

  return result.uri;
};

/**
 * Прочитать текстовый файл
 */
export const readTextFile = async (filename: string): Promise<string> => {
  const result = await Filesystem.readFile({
    path: filename,
    directory: Directory.Documents,
    encoding: 'utf8'
  });

  return result.data as string;
};

/**
 * Удалить файл
 */
export const deleteFile = async (filename: string): Promise<void> => {
  await Filesystem.deleteFile({
    path: filename,
    directory: Directory.Documents
  });
};

/**
 * Получить список файлов в директории
 */
export const listFiles = async (): Promise<string[]> => {
  const result = await Filesystem.readdir({
    path: '',
    directory: Directory.Documents
  });

  return result.files.map(file => file.name);
};

/**
 * Проверить доступность камеры
 */
export const checkCameraAvailable = async (): Promise<boolean> => {
  try {
    await Camera.checkPermissions();
    return true;
  } catch {
    return false;
  }
};

/**
 * Запросить разрешения для камеры
 */
export const requestCameraPermissions = async (): Promise<boolean> => {
  try {
    const result = await Camera.requestPermissions();
    return result.camera === 'granted' && result.photos === 'granted';
  } catch {
    return false;
  }
};