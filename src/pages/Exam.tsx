import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { trackActivity } from '@/lib/gamification';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BottomNav from '@/components/BottomNav';

const AI_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

// ── Структура заданий ЕГЭ/ОГЭ ────────────────────────────────────────────────

type TaskItem = { num: number; topic: string };

const EXAM_TASKS: Record<string, TaskItem[]> = {
  ege_math_base: [
    { num: 1,  topic: 'Вычисления, степени, корни' },
    { num: 2,  topic: 'Округление, запись чисел' },
    { num: 3,  topic: 'Геометрия: площади и объёмы' },
    { num: 4,  topic: 'Статистика и теория вероятностей' },
    { num: 5,  topic: 'Уравнения и неравенства' },
    { num: 6,  topic: 'Задачи на проценты и смеси' },
    { num: 7,  topic: 'Функции и графики' },
    { num: 8,  topic: 'Стереометрия' },
    { num: 9,  topic: 'Планиметрия' },
    { num: 10, topic: 'Задача на реальный контекст' },
    { num: 11, topic: 'Финансовая математика' },
    { num: 12, topic: 'Текстовая задача' },
    { num: 13, topic: 'Практическая задача' },
    { num: 14, topic: 'Числа и их свойства' },
  ],
  ege_math_profile: [
    { num: 1,  topic: 'Вычисления и преобразования' },
    { num: 2,  topic: 'Геометрия: площади и объёмы' },
    { num: 3,  topic: 'Теория вероятностей' },
    { num: 4,  topic: 'Задачи на реальный контекст' },
    { num: 5,  topic: 'Тригонометрические уравнения' },
    { num: 6,  topic: 'Планиметрия' },
    { num: 7,  topic: 'Производная и интеграл' },
    { num: 8,  topic: 'Стереометрия' },
    { num: 9,  topic: 'Параметры в уравнениях' },
    { num: 10, topic: 'Текстовая задача' },
    { num: 11, topic: 'Неравенства' },
    { num: 12, topic: 'Логарифмы и показательные функции' },
    { num: 13, topic: 'Планиметрия (доказательство)' },
    { num: 14, topic: 'Стереометрия (доказательство)' },
    { num: 15, topic: 'Уравнения (сложные)' },
    { num: 16, topic: 'Неравенства (сложные)' },
    { num: 17, topic: 'Задача с параметром' },
    { num: 18, topic: 'Теория чисел' },
    { num: 19, topic: 'Финансовая математика' },
  ],
  ege_russian: [
    { num: 1,  topic: 'Главная информация текста' },
    { num: 2,  topic: 'Лексическое значение слова' },
    { num: 3,  topic: 'Средства связи предложений' },
    { num: 4,  topic: 'Орфоэпия (ударения)' },
    { num: 5,  topic: 'Паронимы' },
    { num: 6,  topic: 'Лексические нормы' },
    { num: 7,  topic: 'Грамматические нормы (морфология)' },
    { num: 8,  topic: 'Грамматические нормы (синтаксис)' },
    { num: 9,  topic: 'Правописание корней' },
    { num: 10, topic: 'Правописание приставок' },
    { num: 11, topic: 'Правописание суффиксов' },
    { num: 12, topic: 'Правописание Н и НН' },
    { num: 13, topic: 'Правописание НЕ и НИ' },
    { num: 14, topic: 'Слитное, раздельное, дефисное написание' },
    { num: 15, topic: 'Правописание -Н- и -НН- в причастиях' },
    { num: 16, topic: 'Знаки препинания при однородных членах' },
    { num: 17, topic: 'Знаки препинания при обособленных членах' },
    { num: 18, topic: 'Знаки препинания при вводных словах' },
    { num: 19, topic: 'Знаки препинания в сложном предложении' },
    { num: 20, topic: 'Знаки препинания (сложные случаи)' },
    { num: 21, topic: 'Функционально-смысловые типы речи' },
    { num: 22, topic: 'Высказывания по тексту' },
    { num: 23, topic: 'Типы речи и языковые средства' },
    { num: 24, topic: 'Лексические средства выразительности' },
    { num: 25, topic: 'Тропы и фигуры речи' },
    { num: 26, topic: 'Сочинение-рассуждение (эссе)' },
  ],
  ege_physics: [
    { num: 1,  topic: 'Механика: кинематика' },
    { num: 2,  topic: 'Механика: динамика' },
    { num: 3,  topic: 'Механика: законы сохранения' },
    { num: 4,  topic: 'Колебания и волны' },
    { num: 5,  topic: 'Молекулярная физика и термодинамика' },
    { num: 6,  topic: 'Электростатика' },
    { num: 7,  topic: 'Постоянный ток' },
    { num: 8,  topic: 'Магнитное поле' },
    { num: 9,  topic: 'Электромагнитная индукция' },
    { num: 10, topic: 'Оптика' },
    { num: 11, topic: 'Атомная физика' },
    { num: 12, topic: 'Ядерная физика' },
    { num: 13, topic: 'Установление соответствия (графики)' },
    { num: 14, topic: 'Задача с графиком' },
    { num: 15, topic: 'Экспериментальная задача' },
    { num: 16, topic: 'Задача на квантовую физику' },
    { num: 17, topic: 'Задача на электричество' },
    { num: 18, topic: 'Расчётная задача (механика)' },
    { num: 19, topic: 'Расчётная задача (термодинамика)' },
    { num: 20, topic: 'Сложная расчётная задача' },
  ],
  ege_chemistry: [
    { num: 1,  topic: 'Строение атома и периодичность' },
    { num: 2,  topic: 'Химическая связь и кристаллические решётки' },
    { num: 3,  topic: 'Степень окисления и валентность' },
    { num: 4,  topic: 'Классификация неорганических веществ' },
    { num: 5,  topic: 'Химические свойства неорганики' },
    { num: 6,  topic: 'Реакции неорганических веществ' },
    { num: 7,  topic: 'Классификация органических веществ' },
    { num: 8,  topic: 'Свойства углеводородов' },
    { num: 9,  topic: 'Кислородосодержащие органические вещества' },
    { num: 10, topic: 'Азотосодержащие органические вещества' },
    { num: 11, topic: 'Биополимеры (белки, нуклеиновые кислоты)' },
    { num: 12, topic: 'Реакции органических соединений' },
    { num: 13, topic: 'Скорость реакции и равновесие' },
    { num: 14, topic: 'Электролитическая диссоциация' },
    { num: 15, topic: 'Среда растворов (pH)' },
    { num: 16, topic: 'Ионные уравнения' },
    { num: 17, topic: 'Окислительно-восстановительные реакции' },
    { num: 18, topic: 'Электролиз' },
    { num: 19, topic: 'Цепочка превращений (неорганика)' },
    { num: 20, topic: 'Цепочка превращений (органика)' },
    { num: 21, topic: 'Нахождение формулы вещества' },
    { num: 22, topic: 'Задача на растворы' },
    { num: 23, topic: 'Задача на выход продукта' },
  ],
  ege_biology: [
    { num: 1,  topic: 'Биология как наука' },
    { num: 2,  topic: 'Клетка: химический состав' },
    { num: 3,  topic: 'Клетка: строение и функции' },
    { num: 4,  topic: 'Обмен веществ (метаболизм)' },
    { num: 5,  topic: 'Размножение клеток' },
    { num: 6,  topic: 'Генетика: законы Менделя' },
    { num: 7,  topic: 'Генетика: сцепленное наследование' },
    { num: 8,  topic: 'Биотехнологии и ГМО' },
    { num: 9,  topic: 'Организм: регуляция' },
    { num: 10, topic: 'Размножение организмов' },
    { num: 11, topic: 'Онтогенез' },
    { num: 12, topic: 'Эволюция: движущие силы' },
    { num: 13, topic: 'Эволюция: доказательства и итоги' },
    { num: 14, topic: 'Экосистемы' },
    { num: 15, topic: 'Биосфера' },
    { num: 16, topic: 'Задача по генетике' },
    { num: 17, topic: 'Задача на биологические процессы' },
    { num: 18, topic: 'Анализ текста по биологии' },
    { num: 19, topic: 'Работа с рисунком/схемой' },
    { num: 20, topic: 'Развёрнутый ответ' },
  ],
  ege_history: [
    { num: 1,  topic: 'Хронология событий' },
    { num: 2,  topic: 'Работа с источником' },
    { num: 3,  topic: 'Термины и понятия' },
    { num: 4,  topic: 'Причины и следствия' },
    { num: 5,  topic: 'Исторические деятели' },
    { num: 6,  topic: 'Карта и схема' },
    { num: 7,  topic: 'Иллюстрации и артефакты' },
    { num: 8,  topic: 'Работа с документом' },
    { num: 9,  topic: 'Задание на установление соответствия' },
    { num: 10, topic: 'СССР: внутренняя политика' },
    { num: 11, topic: 'СССР: внешняя политика' },
    { num: 12, topic: 'Россия в XX веке' },
    { num: 13, topic: 'Работа с историческим текстом' },
    { num: 14, topic: 'Аргументы и контраргументы' },
    { num: 15, topic: 'Историческое эссе' },
  ],
  ege_social: [
    { num: 1,  topic: 'Системный анализ общества' },
    { num: 2,  topic: 'Понятия и термины' },
    { num: 3,  topic: 'Соответствие: теория' },
    { num: 4,  topic: 'Выбор суждений' },
    { num: 5,  topic: 'Схема и таблица' },
    { num: 6,  topic: 'Экономика: понятия' },
    { num: 7,  topic: 'Экономика: задача' },
    { num: 8,  topic: 'Политика и власть' },
    { num: 9,  topic: 'Право: отрасли и нормы' },
    { num: 10, topic: 'Право: конкретная ситуация' },
    { num: 11, topic: 'Социальные отношения' },
    { num: 12, topic: 'Духовная жизнь общества' },
    { num: 13, topic: 'Работа с текстом' },
    { num: 14, topic: 'Конкретизация с примерами' },
    { num: 15, topic: 'Развёрнутый план' },
    { num: 16, topic: 'Эссе' },
  ],
  ege_english: [
    { num: 1,  topic: 'Аудирование: общее понимание' },
    { num: 2,  topic: 'Аудирование: детальное понимание' },
    { num: 3,  topic: 'Чтение: соответствие заголовков' },
    { num: 4,  topic: 'Чтение: детальное понимание' },
    { num: 5,  topic: 'Чтение: пропущенные фрагменты' },
    { num: 6,  topic: 'Словообразование' },
    { num: 7,  topic: 'Грамматика' },
    { num: 8,  topic: 'Лексика и грамматика' },
    { num: 9,  topic: 'Письмо: личное письмо' },
    { num: 10, topic: 'Письмо: развёрнутое высказывание (эссе)' },
    { num: 11, topic: 'Говорение: описание фото' },
    { num: 12, topic: 'Говорение: сравнение фотографий' },
  ],
  ege_informatics: [
    { num: 1,  topic: 'Системы счисления' },
    { num: 2,  topic: 'Кодирование информации' },
    { num: 3,  topic: 'Логика и логические выражения' },
    { num: 4,  topic: 'Выражения и таблицы истинности' },
    { num: 5,  topic: 'Работа с файловой системой' },
    { num: 6,  topic: 'Работа с электронными таблицами' },
    { num: 7,  topic: 'Диаграммы' },
    { num: 8,  topic: 'Алгоритмы и их анализ' },
    { num: 9,  topic: 'Трассировка алгоритма' },
    { num: 10, topic: 'Программирование: базовые задачи' },
    { num: 11, topic: 'Программирование: массивы' },
    { num: 12, topic: 'Комбинаторика и теория вероятностей' },
    { num: 13, topic: 'Числовые последовательности' },
    { num: 14, topic: 'Базы данных' },
    { num: 15, topic: 'Сети и протоколы' },
    { num: 16, topic: 'Сложная задача на программирование' },
    { num: 17, topic: 'Задача по оптимизации' },
  ],
  ege_geography: [
    { num: 1,  topic: 'Источники географической информации' },
    { num: 2,  topic: 'Природа Земли и человек' },
    { num: 3,  topic: 'Население мира' },
    { num: 4,  topic: 'Мировое хозяйство' },
    { num: 5,  topic: 'Регионы и страны мира' },
    { num: 6,  topic: 'Природа России' },
    { num: 7,  topic: 'Население России' },
    { num: 8,  topic: 'Хозяйство России' },
    { num: 9,  topic: 'Районы России' },
    { num: 10, topic: 'Работа с картой' },
    { num: 11, topic: 'Климатограммы и диаграммы' },
    { num: 12, topic: 'Задача на часовые пояса' },
    { num: 13, topic: 'Задача на масштаб и координаты' },
    { num: 14, topic: 'Развёрнутый ответ' },
  ],
  ege_literature: [
    { num: 1,  topic: 'Анализ лирического произведения' },
    { num: 2,  topic: 'Средства художественной выразительности' },
    { num: 3,  topic: 'Сопоставление лирических текстов' },
    { num: 4,  topic: 'Анализ эпического фрагмента' },
    { num: 5,  topic: 'Вопросы по фрагменту прозы' },
    { num: 6,  topic: 'Сравнение с другим произведением' },
    { num: 7,  topic: 'Сочинение по лирике' },
    { num: 8,  topic: 'Сочинение по эпосу/драме' },
    { num: 9,  topic: 'Литературный процесс' },
    { num: 10, topic: 'Теория литературы' },
    { num: 11, topic: 'Развёрнутое сочинение' },
    { num: 12, topic: 'Сочинение-рассуждение' },
  ],
  oge_math: [
    { num: 1,  topic: 'Арифметика и вычисления' },
    { num: 2,  topic: 'Десятичные дроби' },
    { num: 3,  topic: 'Проценты' },
    { num: 4,  topic: 'Степени и корни' },
    { num: 5,  topic: 'Уравнения' },
    { num: 6,  topic: 'Неравенства' },
    { num: 7,  topic: 'Текстовые задачи' },
    { num: 8,  topic: 'Геометрия: фигуры и их свойства' },
    { num: 9,  topic: 'Геометрия: площадь и периметр' },
    { num: 10, topic: 'Теория вероятностей' },
    { num: 11, topic: 'Статистика' },
    { num: 12, topic: 'Функции и графики' },
    { num: 13, topic: 'Алгебра: выражения' },
    { num: 14, topic: 'Геометрия: доказательство' },
    { num: 15, topic: 'Задача с развёрнутым решением' },
    { num: 16, topic: 'Задача повышенной сложности' },
  ],
  oge_russian: [
    { num: 1,  topic: 'Изложение (сжатое)' },
    { num: 2,  topic: 'Синтаксический анализ' },
    { num: 3,  topic: 'Пунктуационный анализ' },
    { num: 4,  topic: 'Синтаксический анализ (2)' },
    { num: 5,  topic: 'Орфографический анализ' },
    { num: 6,  topic: 'Анализ содержания текста' },
    { num: 7,  topic: 'Анализ средств выразительности' },
    { num: 8,  topic: 'Лексический анализ' },
    { num: 9,  topic: 'Сочинение-рассуждение' },
  ],
  oge_physics: [
    { num: 1,  topic: 'Механика' },
    { num: 2,  topic: 'Термодинамика и МКТ' },
    { num: 3,  topic: 'Электричество' },
    { num: 4,  topic: 'Оптика и атомная физика' },
    { num: 5,  topic: 'Работа с графиком' },
    { num: 6,  topic: 'Экспериментальная задача' },
    { num: 7,  topic: 'Расчётная задача (механика)' },
    { num: 8,  topic: 'Расчётная задача (электричество)' },
  ],
  oge_chemistry: [
    { num: 1,  topic: 'Строение атома и вещества' },
    { num: 2,  topic: 'Периодический закон' },
    { num: 3,  topic: 'Химическая связь' },
    { num: 4,  topic: 'Простые и сложные вещества' },
    { num: 5,  topic: 'Химические реакции' },
    { num: 6,  topic: 'Электролитическая диссоциация' },
    { num: 7,  topic: 'Неметаллы и их соединения' },
    { num: 8,  topic: 'Металлы и их соединения' },
    { num: 9,  topic: 'Органическая химия' },
    { num: 10, topic: 'Экспериментальная задача' },
    { num: 11, topic: 'Задача на расчёты' },
  ],
  oge_biology: [
    { num: 1,  topic: 'Биология как наука' },
    { num: 2,  topic: 'Клетка' },
    { num: 3,  topic: 'Организм' },
    { num: 4,  topic: 'Вид и экосистема' },
    { num: 5,  topic: 'Человек и его здоровье' },
    { num: 6,  topic: 'Работа с текстом' },
    { num: 7,  topic: 'Задание с рисунком' },
    { num: 8,  topic: 'Развёрнутый ответ' },
  ],
  oge_history: [
    { num: 1,  topic: 'Хронология' },
    { num: 2,  topic: 'Работа с источником' },
    { num: 3,  topic: 'Термины и понятия' },
    { num: 4,  topic: 'Установление соответствия' },
    { num: 5,  topic: 'Карта' },
    { num: 6,  topic: 'Иллюстрации' },
    { num: 7,  topic: 'Работа с документом' },
    { num: 8,  topic: 'Развёрнутый ответ' },
  ],
  oge_social: [
    { num: 1,  topic: 'Человек и общество' },
    { num: 2,  topic: 'Экономика' },
    { num: 3,  topic: 'Социальная сфера' },
    { num: 4,  topic: 'Политика' },
    { num: 5,  topic: 'Право' },
    { num: 6,  topic: 'Работа с текстом' },
    { num: 7,  topic: 'Эссе' },
  ],
  oge_english: [
    { num: 1,  topic: 'Аудирование' },
    { num: 2,  topic: 'Чтение' },
    { num: 3,  topic: 'Грамматика' },
    { num: 4,  topic: 'Лексика' },
    { num: 5,  topic: 'Письмо: личное письмо' },
    { num: 6,  topic: 'Говорение' },
  ],
  oge_informatics: [
    { num: 1,  topic: 'Кодирование и измерение информации' },
    { num: 2,  topic: 'Логика' },
    { num: 3,  topic: 'Алгоритмы' },
    { num: 4,  topic: 'Программирование' },
    { num: 5,  topic: 'Файловая система' },
    { num: 6,  topic: 'Электронные таблицы' },
    { num: 7,  topic: 'Базы данных' },
    { num: 8,  topic: 'Сети и Интернет' },
  ],
  oge_geography: [
    { num: 1,  topic: 'Карта и координаты' },
    { num: 2,  topic: 'Природа Земли' },
    { num: 3,  topic: 'Население и хозяйство' },
    { num: 4,  topic: 'Регионы России' },
    { num: 5,  topic: 'Климатограмма' },
    { num: 6,  topic: 'Работа с картой' },
    { num: 7,  topic: 'Развёрнутый ответ' },
  ],
};

function getTaskList(examType: string, subjectId: string): TaskItem[] {
  const key = `${examType}_${subjectId}`;
  return EXAM_TASKS[key] || [];
}

function buildTaskContext(examType: string, subjectId: string, subjectLabel: string): string {
  const tasks = getTaskList(examType, subjectId);
  if (!tasks.length) return '';
  const examLabel = examType === 'ege' ? 'ЕГЭ' : 'ОГЭ';
  const lines = tasks.map(t => `  Задание ${t.num}: ${t.topic}`).join('\n');
  return `\nСТРУКТУРА ${examLabel} по предмету «${subjectLabel}»:\n${lines}\n`;
}

// ── Данные ───────────────────────────────────────────────────────────────────

const EXAM_TYPES = [
  { id: 'ege', label: 'ЕГЭ', description: '11 класс', gradient: 'from-violet-500 to-purple-600' },
  { id: 'oge', label: 'ОГЭ', description: '9 класс',  gradient: 'from-blue-500 to-indigo-600' },
];

const SUBJECTS: Record<string, { id: string; label: string; icon: string }[]> = {
  ege: [
    { id: 'math_base',    label: 'Математика (база)',    icon: '📐' },
    { id: 'math_profile', label: 'Математика (профиль)', icon: '📊' },
    { id: 'russian',      label: 'Русский язык',         icon: '📝' },
    { id: 'physics',      label: 'Физика',               icon: '⚡' },
    { id: 'chemistry',    label: 'Химия',                icon: '🧪' },
    { id: 'biology',      label: 'Биология',             icon: '🧬' },
    { id: 'history',      label: 'История',              icon: '🏛️' },
    { id: 'social',       label: 'Обществознание',       icon: '⚖️' },
    { id: 'english',      label: 'Английский язык',      icon: '🇬🇧' },
    { id: 'informatics',  label: 'Информатика',          icon: '💻' },
    { id: 'geography',    label: 'География',            icon: '🌍' },
    { id: 'literature',   label: 'Литература',           icon: '📚' },
  ],
  oge: [
    { id: 'math',        label: 'Математика',      icon: '📐' },
    { id: 'russian',     label: 'Русский язык',     icon: '📝' },
    { id: 'physics',     label: 'Физика',           icon: '⚡' },
    { id: 'chemistry',   label: 'Химия',            icon: '🧪' },
    { id: 'biology',     label: 'Биология',         icon: '🧬' },
    { id: 'history',     label: 'История',          icon: '🏛️' },
    { id: 'social',      label: 'Обществознание',   icon: '⚖️' },
    { id: 'english',     label: 'Английский язык',  icon: '🇬🇧' },
    { id: 'informatics', label: 'Информатика',      icon: '💻' },
    { id: 'geography',   label: 'География',        icon: '🌍' },
  ],
};

const MODES = [
  {
    id: 'explain',
    icon: 'BookOpen' as const,
    label: 'Объяснение темы',
    description: 'Введи тему или номер задания — объясню теорию и покажу примеры из реального экзамена',
  },
  {
    id: 'practice',
    icon: 'Target' as const,
    label: 'Тренировка заданий',
    description: 'ИИ даёт задание в стиле экзамена, ты отвечаешь — он проверяет и разбирает ошибки',
  },
];

const THINKING_STAGES = [
  { text: 'Анализирую вопрос...', duration: 2000 },
  { text: 'Подбираю задание...',  duration: 3000 },
  { text: 'Формулирую ответ...',  duration: 4000 },
  { text: 'Проверяю точность...', duration: 6000 },
  { text: 'Финальная проверка...', duration: 8000 },
];

// ── ThinkingIndicator ────────────────────────────────────────────────────────

const ThinkingIndicator = ({ elapsed }: { elapsed: number }) => {
  let cumulative = 0;
  let currentStage = THINKING_STAGES[0];
  for (const stage of THINKING_STAGES) {
    cumulative += stage.duration;
    if (elapsed < cumulative) { currentStage = stage; break; }
    currentStage = stage;
  }
  const dot = 'w-2 h-2 rounded-full bg-violet-400';
  return (
    <div className="flex gap-2.5 justify-start">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon name="GraduationCap" size={15} className="text-white" />
      </div>
      <div className="bg-white border border-violet-100 shadow-sm rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex gap-1 items-end">
            <div className={`${dot} animate-bounce`} style={{ animationDelay: '0ms' }} />
            <div className={`${dot} animate-bounce`} style={{ animationDelay: '150ms' }} />
            <div className={`${dot} animate-bounce`} style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-violet-700 font-medium">{currentStage.text}</span>
        </div>
        <div className="h-1.5 w-36 bg-violet-50 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 via-purple-400 to-violet-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(90, (elapsed / 30000) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};



// ── Панель заданий ────────────────────────────────────────────────────────────

const TaskPanel = ({
  examType,
  subjectId,
  mode,
  onSelect,
  completedTasks,
}: {
  examType: string;
  subjectId: string;
  mode: string;
  onSelect: (text: string, taskNum: number) => void;
  completedTasks: Set<number>;
}) => {
  const [open, setOpen] = useState(false);
  const tasks = getTaskList(examType, subjectId);
  const examLabel = examType === 'ege' ? 'ЕГЭ' : 'ОГЭ';

  if (!tasks.length) return null;

  const verb = mode === 'practice' ? 'Тренировать' : 'Объяснить';
  const doneCount = tasks.filter(t => completedTasks.has(t.num)).length;

  return (
    <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Icon name="ListOrdered" size={16} className="text-purple-500" />
          <span>Задания {examLabel}</span>
          {doneCount > 0 && (
            <span className="text-[11px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
              ✓ {doneCount}/{tasks.length}
            </span>
          )}
        </span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-gray-400" />
      </button>

      {open && (
        <div className="max-h-64 overflow-y-auto px-3 pb-3">
          {doneCount > 0 && (
            <p className="text-[11px] text-green-600 px-1 pb-2">
              🎉 Выполнено {doneCount} из {tasks.length} — отличный прогресс!
            </p>
          )}
          <div className="grid grid-cols-1 gap-1">
            {tasks.map(t => {
              const done = completedTasks.has(t.num);
              return (
                <button
                  key={t.num}
                  onClick={() => {
                    onSelect(`Задание ${t.num} — ${t.topic}`, t.num);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left ${
                    done
                      ? 'bg-green-50 border border-green-100 opacity-75 hover:opacity-100 hover:bg-green-100'
                      : 'hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center ${
                    done ? 'bg-green-500 text-white' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {done ? '✓' : t.num}
                  </span>
                  <span className={`text-sm flex-1 ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {t.topic}
                  </span>
                  {!done && (
                    <span className="flex-shrink-0 text-[11px] text-purple-500 font-medium">{verb} →</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Типы ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type Step = 'type' | 'subject' | 'mode' | 'chat';

// ── Основной компонент ────────────────────────────────────────────────────────

const Exam = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step, setStep] = useState<Step>('type');
  const [examType, setExamType] = useState('');
  const [subject, setSubject] = useState<{ id: string; label: string } | null>(null);
  const [mode, setMode] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [aiUsed, setAiUsed] = useState<number | null>(null);
  const [aiMax, setAiMax] = useState<number | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [isSoftLanding, setIsSoftLanding] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const [sessions, setSessions] = useState<{ id: number; title: string; updated_at: string; message_count: number }[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  const pendingTaskNumRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authService.isAuthenticated()) navigate('/login');
    else { loadAiLimits(); loadSessions(); }
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadAiLimits = async () => {
    try {
      const token = authService.getToken();
      const resp = await fetch(`${SUBSCRIPTION_URL}?action=limits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        const ai = data.limits?.ai_questions;
        const sub = data.subscription_type;
        const trial = data.is_trial;
        const softLanding = data.is_soft_landing;
        setIsPremium(sub === 'premium');
        setIsTrial(!!trial);
        setIsSoftLanding(!!softLanding);
        if (ai) {
          if (ai.max && ai.max < 999) {
            setAiUsed(ai.used ?? 0);
            setAiMax(ai.max);
          } else if (trial || sub === 'premium') {
            setAiUsed(ai.used ?? 0);
            setAiMax(ai.max ?? null);
          }
        }
      }
    } catch (e) {
      console.warn('AI limits load:', e);
    }
  };

  const loadSessions = async () => {
    try {
      const token = authService.getToken();
      const resp = await fetch(`${AI_URL}?action=sessions`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.ok) { const data = await resp.json(); setSessions(data.sessions || []); }
    } catch (e) { console.warn('Sessions load:', e); }
  };

  const loadSessionMessages = async (sessionId: number) => {
    setLoadingSession(true);
    try {
      const token = authService.getToken();
      const resp = await fetch(`${AI_URL}?action=messages&session_id=${sessionId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.ok) {
        const data = await resp.json();
        const msgs: Message[] = (data.messages || []).map((m: { role: 'user' | 'assistant'; content: string; timestamp: string }) => ({
          role: m.role, content: m.content, timestamp: new Date(m.timestamp)
        }));
        setMessages(msgs);
        setCurrentSessionId(sessionId);
        setShowSidebar(false);
        setStep('chat');
      }
    } catch (e) { console.warn('Session messages load:', e); }
    finally { setLoadingSession(false); }
  };

  const formatSessionDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString('ru-RU', { weekday: 'short' });
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const startThinking = () => {
    setThinkingElapsed(0);
    if (thinkingTimerRef.current) clearInterval(thinkingTimerRef.current);
    const start = Date.now();
    thinkingTimerRef.current = setInterval(() => setThinkingElapsed(Date.now() - start), 200);
  };

  const stopThinking = () => {
    if (thinkingTimerRef.current) { clearInterval(thinkingTimerRef.current); thinkingTimerRef.current = null; }
    setThinkingElapsed(0);
  };

  const handleOk = useCallback(async (resp: Response) => {
    const data = await resp.json();
    if (data.remaining !== undefined) {
      setRemaining(data.remaining);
      setAiUsed(prev => (prev !== null && aiMax !== null) ? aiMax - data.remaining : prev);
    }
    setMessages(prev => [...prev, { role: 'assistant', content: data.answer, timestamp: new Date() }]);
    const wasNewTask = pendingTaskNumRef.current !== null;
    if (wasNewTask) {
      setCompletedTasks(prev => new Set(prev).add(pendingTaskNumRef.current!));
      pendingTaskNumRef.current = null;
    }
    try {
      const gam = await trackActivity('ai_questions_asked', 1);
      if (wasNewTask) {
        await trackActivity('exam_tasks_done', 1);
      }
      if (gam?.new_achievements?.length) {
        gam.new_achievements.forEach((a: { title: string; xp_reward: number }) => {
          toast({ title: `🏆 ${a.title}`, description: `+${a.xp_reward} XP` });
        });
      }
    } catch (e) {
      console.warn('Gamification:', e);
    }
  }, [toast, aiMax]);

  const makeFetchBody = useCallback((q: string, hist: Message[], selectedMode: string) => ({
    question: q,
    material_ids: [],
    exam_meta: `${examType}|${subject?.id || ''}|${subject?.label || ''}|${selectedMode}`,
    history: hist.slice(-6).map(m => ({ role: m.role, content: m.content })),
  }), [examType, subject]);

  const startChat = useCallback(async (selectedMode: string) => {
    setMode(selectedMode);
    setStep('chat');
    setMessages([]);
    setIsLoading(true);
    startThinking();

    const examLbl = examType === 'ege' ? 'ЕГЭ' : 'ОГЭ';
    const initQ = selectedMode === 'practice'
      ? `Начинаем тренировку по ${examLbl} — ${subject?.label}. Я выберу тему из списка заданий ниже. Напиши короткое приветствие и скажи, что жду выбора задания.`
      : `Привет! Я готовлюсь к ${examLbl} по ${subject?.label}. Кратко расскажи из каких заданий состоит экзамен и с чего лучше начать подготовку.`;

    try {
      const token = authService.getToken();
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 110000);
      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(makeFetchBody(initQ, [], selectedMode)),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (resp.ok) {
        await handleOk(resp);
      } else if (resp.status === 504) {
        const token2 = authService.getToken();
        const resp2 = await fetch(AI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token2}` },
          body: JSON.stringify(makeFetchBody(initQ, [], selectedMode)),
        });
        if (resp2.ok) await handleOk(resp2);
      }
    } catch (_) {
      setMessages([{ role: 'assistant', content: 'Не удалось подключиться. Попробуй ещё раз.', timestamp: new Date() }]);
    } finally {
      stopThinking();
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [examType, subject, handleOk, makeFetchBody]);

  const sendMessage = useCallback(async (text?: string) => {
    const q = (text || question).trim();
    if (!q || isLoading) return;

    const userMsg: Message = { role: 'user', content: q, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setIsLoading(true);
    startThinking();

    const doFetch = async (): Promise<Response> => {
      const token = authService.getToken();
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 110000);
      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(makeFetchBody(q, messages, mode)),
        signal: controller.signal,
      });
      clearTimeout(tid);
      return resp;
    };

    const tryFetch = async (attempt: number): Promise<void> => {
      try {
        const resp = await doFetch();
        if (resp.ok) {
          await handleOk(resp);
        } else if (resp.status === 403) {
          const data = await resp.json();
          const isSL = data.is_soft_landing;
          const limitMsg = isSL
            ? `⏳ Лимит ${data.limit || 10} вопросов на сегодня исчерпан. Переходный период закончится через ${data.soft_landing_days_left || 1} дн. — потом 3 вопроса/день.\n\n💎 **Premium** — 20 вопросов/день для полноценной подготовки к ЕГЭ/ОГЭ → [Подписка](/subscription)`
            : data.is_premium
            ? `⚡ Дневной лимит 20 вопросов исчерпан. Купи пакет вопросов чтобы продолжить прямо сейчас.\n\n[Купить вопросы →](/subscription)`
            : `🎯 Бесплатных вопросов на сегодня больше нет.\n\nЧтобы подготовиться к экзамену по-настоящему — нужен **Premium**: 20 вопросов в день без ограничений.\n\n[Оформить подписку →](/subscription) · [Купить 15 вопросов за 150₽ →](/subscription)`;
          setMessages(prev => [...prev, { role: 'assistant', content: limitMsg, timestamp: new Date() }]);
          setRemaining(0);
        } else if ((resp.status === 504 || resp.status >= 500) && attempt < 2) {
          await tryFetch(attempt + 1);
        } else {
          throw new Error('server_error');
        }
      } catch (e: unknown) {
        const name = (e instanceof Error) ? e.name : '';
        if ((name === 'AbortError' || name === 'TypeError') && attempt < 2) {
          await tryFetch(attempt + 1);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Произошла временная ошибка сети. Попробуй задать вопрос ещё раз.', timestamp: new Date() }]);
        }
      }
    };

    try {
      await tryFetch(0);
    } finally {
      stopThinking();
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [question, isLoading, messages, mode, handleOk, makeFetchBody]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const reset = () => { setStep('type'); setExamType(''); setSubject(null); setMode(''); setMessages([]); };

  const examLabel = examType === 'ege' ? 'ЕГЭ' : 'ОГЭ';
  const modeLabel = MODES.find(m => m.id === mode)?.label || '';

  // ── САЙДБАР ────────────────────────────────────────────────────────────────

  const Sidebar = () => (
    <div className="fixed inset-0 z-50 flex">
      <div className="w-72 bg-white h-full flex flex-col shadow-2xl border-r border-gray-100">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">История чатов</h2>
          <button onClick={() => setShowSidebar(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <Icon name="X" size={18} className="text-gray-600" />
          </button>
        </div>
        <button
          onClick={() => { setStep('type'); setMessages([]); setCurrentSessionId(null); setShowSidebar(false); }}
          className="mx-3 mt-3 mb-2 flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Icon name="Plus" size={16} />
          Новый чат
        </button>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">Чатов пока нет</p>
          ) : (
            <div className="space-y-1">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => loadSessionMessages(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${currentSessionId === s.id ? 'bg-purple-50 border border-purple-200' : 'hover:bg-gray-50'}`}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">{s.title || 'Новый чат'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-400">{formatSessionDate(s.updated_at)}</span>
                    <span className="text-[11px] text-gray-300">·</span>
                    <span className="text-[11px] text-gray-400">{s.message_count} сообщ.</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 bg-black/40" onClick={() => setShowSidebar(false)} />
    </div>
  );

  // ── ШАГ 1: Выбор типа ────────────────────────────────────────────────────

  if (step === 'type') return (
    <div className="flex flex-col h-[100dvh] bg-white relative">
      {showSidebar && <Sidebar />}
      <header className="flex-shrink-0 px-4 py-4 safe-top border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Подготовка к экзамену</h1>
              <p className="text-xs text-gray-500">ИИ-репетитор · ЕГЭ и ОГЭ</p>
            </div>
          </div>
          <button onClick={() => { setShowSidebar(true); loadSessions(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <Icon name="Clock" size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
              <Icon name="GraduationCap" size={30} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Какой экзамен сдаёшь?</h2>
            <p className="text-sm text-gray-500">Выбери тип — настроим репетитора под твой формат</p>
          </div>

          <div className="space-y-3">
            {EXAM_TYPES.map(et => (
              <button
                key={et.id}
                onClick={() => { setExamType(et.id); setStep('subject'); }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-left active:scale-[0.98]"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${et.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <span className="text-white font-bold text-lg">{et.label}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base">{et.label}</p>
                  <p className="text-sm text-gray-500">{et.description}</p>
                </div>
                <Icon name="ChevronRight" size={20} className="text-gray-400" />
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">
            Используй тот же лимит вопросов, что и в ИИ-ассистенте
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  // ── ШАГ 2: Выбор предмета ────────────────────────────────────────────────


  if (step === 'subject') {
    const subjects = SUBJECTS[examType] || [];
    return (
      <div className="flex flex-col h-[100dvh] bg-white">
        <header className="flex-shrink-0 px-4 py-4 safe-top border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('type')} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{examLabel} — предмет</h1>
              <p className="text-xs text-gray-500">Шаг 2 из 3</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">
          <div className="max-w-sm mx-auto">
            <p className="text-sm text-gray-500 mb-4 text-center">По какому предмету готовишься?</p>
            <div className="grid grid-cols-2 gap-2.5">
              {subjects.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSubject({ id: s.id, label: s.label }); setStep('mode'); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-center active:scale-[0.97]"
                >
                  <span className="text-2xl">{s.icon}</span>
                  <span className="text-xs font-medium text-gray-700 leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── ШАГ 3: Выбор режима ──────────────────────────────────────────────────

  if (step === 'mode') return (
    <div className="flex flex-col h-[100dvh] bg-white">
      <header className="flex-shrink-0 px-4 py-4 safe-top border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('subject')} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors">
            <Icon name="ArrowLeft" size={22} className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{subject?.label}</h1>
            <p className="text-xs text-gray-500">{examLabel} · Шаг 3 из 3</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Что будем делать?</h2>
            <p className="text-sm text-gray-500">Выбери формат занятия</p>
          </div>
          <div className="space-y-3">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => startChat(m.id)}
                className="w-full flex items-start gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all text-left active:scale-[0.98]"
              >
                <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name={m.icon} size={22} className="text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-0.5">{m.label}</p>
                  <p className="text-sm text-gray-500 leading-snug">{m.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  // ── ШАГ 4: Чат ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[100dvh] bg-white relative">
      {showSidebar && <Sidebar />}
      <header className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 safe-top">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={reset} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Icon name="ArrowLeft" size={22} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900">{examLabel}{subject ? ` · ${subject.label}` : ' · Экзамен'}</h1>
              <p className="text-xs text-gray-500">
                {isLoading ? (
                  <span className="text-purple-600 font-medium flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                    Думаю...
                  </span>
                ) : modeLabel || 'ИИ-репетитор'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setShowSidebar(true); loadSessions(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              <Icon name="Clock" size={18} />
            </button>
            <button
              onClick={() => { setStep('mode'); setMessages([]); }}
              className="text-xs text-purple-600 hover:text-purple-800 font-medium px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
            >
              Сменить
            </button>
          </div>
        </div>
      </header>

      <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {isTrial ? (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <Icon name="Zap" size={12} className="text-emerald-500" />
              Пробный период — безлимит
            </span>
          ) : isPremium ? (
            <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
              <Icon name="Crown" size={12} className="text-purple-500" />
              Premium
            </span>
          ) : isSoftLanding ? (
            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
              <Icon name="Clock" size={12} className="text-amber-500" />
              Расширенный доступ
            </span>
          ) : (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Icon name="Bot" size={12} className="text-gray-400" />
              Бесплатный план
            </span>
          )}
          {aiMax !== null && aiUsed !== null && !isTrial && (
            <div className="flex items-center gap-2 flex-1 max-w-[180px]">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${aiUsed / aiMax >= 0.9 ? 'bg-red-500' : aiUsed / aiMax >= 0.7 ? 'bg-orange-400' : isSoftLanding ? 'bg-amber-500' : isPremium ? 'bg-purple-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min((aiUsed / aiMax) * 100, 100)}%` }}
                />
              </div>
              <span className={`text-xs flex-shrink-0 font-medium ${aiUsed / aiMax >= 0.9 ? 'text-red-500' : 'text-gray-500'}`}>
                {aiMax - aiUsed} / {aiMax}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex justify-center">
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              {mode === 'practice' ? '🎯 Режим тренировки' : '📖 Режим объяснения'} · {examLabel} · {subject?.label}
            </span>
          </div>

          {messages.map((msg, i) => {
            const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1 && !isLoading;
            const assistantCount = messages.filter((m, idx) => m.role === 'assistant' && idx <= i).length;
            return (
              <div key={i}>
                <div className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon name="GraduationCap" size={15} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                    <div className={`px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-code:text-purple-700 prose-code:bg-purple-50 prose-code:px-1 prose-code:rounded text-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    <p className={`text-[11px] mt-1 px-1 text-gray-400 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                {isLastAssistant && assistantCount > 0 && assistantCount % 5 === 0 && (
                  <div className="flex gap-2 mt-3 ml-10">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                      <span>🔥</span>
                      <span className="font-medium">Уже {assistantCount} разборов — ты молодец!</span>
                    </div>
                  </div>
                )}
                {isLastAssistant && !isPremium && remaining !== null && remaining <= 1 && (
                  <div className="flex gap-2 mt-3 ml-10">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl px-3 py-2 text-xs">
                      <span>💎</span>
                      <span className="text-gray-700">Заканчиваются вопросы — </span>
                      <button onClick={() => window.location.href = '/subscription'} className="text-purple-600 font-semibold hover:text-purple-800 whitespace-nowrap">оформи Premium →</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && <ThinkingIndicator elapsed={thinkingElapsed} />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {messages.length >= 1 && (
        <TaskPanel
          examType={examType}
          subjectId={subject?.id || ''}
          mode={mode}
          onSelect={(text, taskNum) => {
            pendingTaskNumRef.current = taskNum;
            sendMessage(text);
          }}
          completedTasks={completedTasks}
        />
      )}

      <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3 pb-[calc(0.75rem+4rem+env(safe-area-inset-bottom,0px))] md:pb-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'practice' ? 'Напиши свой ответ...' : 'Спроси или введи номер задания...'}
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-sm focus:outline-none focus:border-purple-400 focus:bg-white transition-colors disabled:opacity-50 max-h-32"
              style={{ minHeight: '44px' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!question.trim() || isLoading}
            className="w-11 h-11 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            {isLoading
              ? <Icon name="Loader2" size={20} className="text-white animate-spin" />
              : <Icon name="ArrowUp" size={20} className={question.trim() ? 'text-white' : 'text-gray-400'} />
            }
          </button>
        </div>
        {mode === 'practice' && messages.length >= 1 && (
          <div className="max-w-2xl mx-auto mt-2 flex justify-center">
            <button
              onClick={() => {
                if (question.trim()) {
                  sendMessage();
                } else {
                  sendMessage('Проверь мой ответ');
                }
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-40"
            >
              <Icon name="CheckCircle" size={14} />
              Проверь мой ответ
            </button>
          </div>
        )}
        <p className="max-w-2xl mx-auto mt-2 text-center text-[11px] text-gray-400 leading-tight">
          ИИ готовит качественный ответ — иногда до&nbsp;2&nbsp;минут. Не закрывай страницу
        </p>
      </div>
      <BottomNav />
    </div>
  );
};

export default Exam;