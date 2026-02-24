export type CompanionId = 'cat' | 'dog' | 'owl' | 'panda' | 'fox';

export interface Companion {
  id: CompanionId;
  name: string;
  emoji: string;
  description: string;
  style: string;
  stages: CompanionStage[];
}

export interface CompanionStage {
  level: number;
  emoji: string;
  title: string;
  phrase: string;
}

export const COMPANIONS: Companion[] = [
  {
    id: 'cat',
    name: 'Кот',
    emoji: '🐱',
    description: 'Спокойное и методичное обучение',
    style: 'from-orange-400 to-amber-500',
    stages: [
      { level: 1,  emoji: '🐱',  title: 'Котёнок',    phrase: 'Мяу! Начинаем учиться?' },
      { level: 5,  emoji: '😸',  title: 'Кот с книгой', phrase: 'Почитаем что-нибудь умное!' },
      { level: 10, emoji: '🎓',  title: 'Учёный кот',  phrase: 'Я горжусь тобой, хозяин!' },
      { level: 20, emoji: '👨‍🏫', title: 'Кот-профессор', phrase: 'Ты уже лучше меня знаешь тему!' },
      { level: 30, emoji: '🏆',  title: 'Академик',    phrase: 'Вместе мы непобедимы!' },
    ],
  },
  {
    id: 'dog',
    name: 'Пёс',
    emoji: '🐶',
    description: 'Дисциплина и регулярные занятия',
    style: 'from-yellow-400 to-orange-400',
    stages: [
      { level: 1,  emoji: '🐶', title: 'Щенок',       phrase: 'Гав! Я готов учиться!' },
      { level: 5,  emoji: '🐕', title: 'Пёс-студент', phrase: 'Ни дня без занятия!' },
      { level: 10, emoji: '🦮', title: 'Верный пёс',  phrase: 'Ты занимаешься каждый день — это сила!' },
      { level: 20, emoji: '🎖️', title: 'Пёс-чемпион', phrase: 'Серию не сломить!' },
      { level: 30, emoji: '🏅', title: 'Легенда',     phrase: 'Вместе мы прошли путь!' },
    ],
  },
  {
    id: 'owl',
    name: 'Сова',
    emoji: '🦉',
    description: 'Глубокое понимание и аналитика',
    style: 'from-indigo-500 to-purple-600',
    stages: [
      { level: 1,  emoji: '🦉',  title: 'Совёнок',      phrase: 'Ухх! Знания — сила!' },
      { level: 5,  emoji: '🦉',  title: 'Мудрая сова',  phrase: 'Задавай вопросы — я отвечу!' },
      { level: 10, emoji: '📚',  title: 'Сова-библиотекарь', phrase: 'Мы уже изучили столько тем!' },
      { level: 20, emoji: '🔭',  title: 'Сова-учёный',  phrase: 'Ты мыслишь как настоящий учёный!' },
      { level: 30, emoji: '🌟',  title: 'Архимудрец',   phrase: 'Невероятно. Ты — настоящий гений.' },
    ],
  },
  {
    id: 'panda',
    name: 'Панда',
    emoji: '🐼',
    description: 'Мягкий темп без стресса',
    style: 'from-gray-400 to-gray-600',
    stages: [
      { level: 1,  emoji: '🐼', title: 'Панда-малыш',   phrase: 'Главное — не торопиться!' },
      { level: 5,  emoji: '🐼', title: 'Панда-ученик',  phrase: 'Шаг за шагом — ты молодец!' },
      { level: 10, emoji: '🎋', title: 'Панда-мудрец',  phrase: 'Постоянство важнее скорости.' },
      { level: 20, emoji: '☯️', title: 'Мастер покоя',  phrase: 'Твой прогресс — твоё зеркало.' },
      { level: 30, emoji: '🏯', title: 'Великий мастер', phrase: 'Ты достиг гармонии знания.' },
    ],
  },
  {
    id: 'fox',
    name: 'Лиса',
    emoji: '🦊',
    description: 'Быстрый прогресс и смекалка',
    style: 'from-orange-500 to-red-500',
    stages: [
      { level: 1,  emoji: '🦊', title: 'Лисёнок',      phrase: 'Я хитрее всех задач!' },
      { level: 5,  emoji: '🦊', title: 'Лиса-ученик',  phrase: 'Быстро схватываю — значит умный!' },
      { level: 10, emoji: '🎯', title: 'Лиса-охотник', phrase: 'Ни одна тема не убежит!' },
      { level: 20, emoji: '🚀', title: 'Лиса-ракета',  phrase: 'Скорость + знания = успех!' },
      { level: 30, emoji: '👑', title: 'Королева лис',  phrase: 'Ты — самый быстрый ученик!' },
    ],
  },
];

export function getCompanion(id?: CompanionId | string | null): Companion {
  return COMPANIONS.find(c => c.id === id) ?? COMPANIONS[2]; // сова по умолчанию
}

export function getCompanionStage(companion: Companion, level: number): CompanionStage {
  const reached = [...companion.stages].reverse().find(s => level >= s.level);
  return reached ?? companion.stages[0];
}

export function getCompanionFromStorage(): CompanionId | null {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.companion || null;
  } catch { return null; }
}
