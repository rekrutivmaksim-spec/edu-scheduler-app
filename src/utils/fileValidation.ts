/**
 * File validation utilities for secure file uploads
 */

// Максимальный размер файла: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Разрешённые MIME-типы для изображений
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
];

// Разрешённые расширения файлов
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate image file for security and size constraints
 */
export function validateImageFile(file: File): FileValidationResult {
  // Проверка существования файла
  if (!file) {
    return {
      isValid: false,
      error: 'Файл не выбран'
    };
  }

  // Проверка размера файла
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      error: `Файл слишком большой (${sizeMB}MB). Максимум 10MB`
    };
  }

  // Проверка MIME-типа
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: `Неподдерживаемый формат файла. Разрешены: JPG, PNG, WebP, GIF`
    };
  }

  // Проверка расширения файла
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(fileExtension)) {
    return {
      isValid: false,
      error: `Неподдерживаемое расширение файла: ${fileExtension}`
    };
  }

  return {
    isValid: true
  };
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
