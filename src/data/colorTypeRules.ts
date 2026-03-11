/**
 * Правила для 12 цветотипов
 * Определяют какие палитры использовать и какие CSS фильтры применять
 */

export type ColorTypeName =
  | "DUSTY_SUMMER"
  | "VIVID_SUMMER"
  | "SOFT_SUMMER"
  | "FIERY_AUTUMN"
  | "GENTLE_AUTUMN"
  | "VIVID_AUTUMN"
  | "BRIGHT_WINTER"
  | "VIVID_WINTER"
  | "SOFT_WINTER"
  | "VIBRANT_SPRING"
  | "BRIGHT_SPRING"
  | "GENTLE_SPRING";

export type SeasonKey =
  | "summer"
  | "summerBright"
  | "summerSoft"
  | "autumn"
  | "autumnBright"
  | "autumnVivid"
  | "winter"
  | "winterBright"
  | "winterVivid"
  | "spring"
  | "springBright"
  | "springGentle";

export interface ColorTypeRule {
  name: ColorTypeName;
  displayName: string;
  season: SeasonKey;
}

export const colorTypeRules: Record<ColorTypeName, ColorTypeRule> = {
  // ========== ЛЕТО ==========
  DUSTY_SUMMER: {
    name: "DUSTY_SUMMER",
    displayName: "Пыльное Лето",
    season: "summer",
  },
  VIVID_SUMMER: {
    name: "VIVID_SUMMER",
    displayName: "Яркое Лето",
    season: "summerBright",
  },
  SOFT_SUMMER: {
    name: "SOFT_SUMMER",
    displayName: "Мягкое Лето",
    season: "summerSoft",
  },

  // ========== ОСЕНЬ ==========
  FIERY_AUTUMN: {
    name: "FIERY_AUTUMN",
    displayName: "Огненная Осень",
    season: "autumnBright",
  },
  GENTLE_AUTUMN: {
    name: "GENTLE_AUTUMN",
    displayName: "Нежная Осень",
    season: "autumn",
  },
  VIVID_AUTUMN: {
    name: "VIVID_AUTUMN",
    displayName: "Тёмная Осень",
    season: "autumnVivid",
  },

  // ========== ЗИМА ==========
  BRIGHT_WINTER: {
    name: "BRIGHT_WINTER",
    displayName: "Яркая Зима",
    season: "winterBright",
  },
  VIVID_WINTER: {
    name: "VIVID_WINTER",
    displayName: "Тёмная Зима",
    season: "winterVivid",
  },
  SOFT_WINTER: {
    name: "SOFT_WINTER",
    displayName: "Мягкая Зима",
    season: "winter",
  },

  // ========== ВЕСНА ==========
  VIBRANT_SPRING: {
    name: "VIBRANT_SPRING",
    displayName: "Яркая Весна",
    season: "springBright",
  },
  BRIGHT_SPRING: {
    name: "BRIGHT_SPRING",
    displayName: "Тёплая Весна",
    season: "spring",
  },
  GENTLE_SPRING: {
    name: "GENTLE_SPRING",
    displayName: "Нежная Весна",
    season: "springGentle",
  },
};

/**
 * Получить палитры для конкретного цветотипа с применением фильтров
 */
export function getPalettesForColorType(colorType: ColorTypeName) {
  const rule = colorTypeRules[colorType];
  return {
    season: rule.season,
    displayName: rule.displayName,
  };
}

/**
 * Получить список всех цветотипов
 */
export function getAllColorTypes(): ColorTypeRule[] {
  return Object.values(colorTypeRules);
}

/**
 * Получить цветотипы по сезону
 */
export function getColorTypesBySeason(
  season: "summer" | "autumn" | "winter" | "spring",
): ColorTypeRule[] {
  return Object.values(colorTypeRules).filter(
    (rule) => rule.season === season || rule.season === `${season}Bright`,
  );
}