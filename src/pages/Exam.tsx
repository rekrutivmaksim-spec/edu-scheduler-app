import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import BottomNav from '@/components/BottomNav';
import { trackActivity } from '@/lib/gamification';

const AI_API_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

// Дата ЕГЭ 2026 — первый день основного периода
const EGE_DATE = new Date('2026-05-25');
const OGE_DATE = new Date('2026-05-19');

function daysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─── Предметы ────────────────────────────────────────────────────────────────

const EGE_SUBJECTS = [
  { id: 'ru', name: 'Русский язык', icon: '📝', required: true, color: 'from-blue-500 to-indigo-600', topics: 24, weakTopics: 3 },
  { id: 'math_base', name: 'Математика (база)', icon: '🔢', required: true, color: 'from-purple-500 to-violet-600', topics: 20, weakTopics: 2 },
  { id: 'math_prof', name: 'Математика (профиль)', icon: '📐', required: false, color: 'from-purple-600 to-pink-500', topics: 30, weakTopics: 5 },
  { id: 'physics', name: 'Физика', icon: '⚛️', required: false, color: 'from-sky-500 to-blue-600', topics: 28, weakTopics: 4 },
  { id: 'chemistry', name: 'Химия', icon: '🧪', required: false, color: 'from-green-500 to-teal-500', topics: 32, weakTopics: 6 },
  { id: 'biology', name: 'Биология', icon: '🌿', required: false, color: 'from-emerald-500 to-green-600', topics: 26, weakTopics: 3 },
  { id: 'history', name: 'История', icon: '🏛️', required: false, color: 'from-amber-500 to-orange-500', topics: 35, weakTopics: 7 },
  { id: 'social', name: 'Обществознание', icon: '🌍', required: false, color: 'from-orange-500 to-red-500', topics: 22, weakTopics: 4 },
  { id: 'informatics', name: 'Информатика', icon: '💻', required: false, color: 'from-cyan-500 to-blue-500', topics: 18, weakTopics: 2 },
  { id: 'english', name: 'Английский язык', icon: '🇬🇧', required: false, color: 'from-red-500 to-rose-500', topics: 16, weakTopics: 2 },
  { id: 'geography', name: 'География', icon: '🗺️', required: false, color: 'from-teal-500 to-cyan-500', topics: 20, weakTopics: 3 },
  { id: 'literature', name: 'Литература', icon: '📖', required: false, color: 'from-pink-500 to-rose-500', topics: 14, weakTopics: 1 },
];

const OGE_SUBJECTS = [
  { id: 'ru', name: 'Русский язык', icon: '📝', required: true, color: 'from-blue-500 to-indigo-600', topics: 18, weakTopics: 2 },
  { id: 'math', name: 'Математика', icon: '🔢', required: true, color: 'from-purple-500 to-violet-600', topics: 16, weakTopics: 3 },
  { id: 'physics', name: 'Физика', icon: '⚛️', required: false, color: 'from-sky-500 to-blue-600', topics: 20, weakTopics: 4 },
  { id: 'chemistry', name: 'Химия', icon: '🧪', required: false, color: 'from-green-500 to-teal-500', topics: 18, weakTopics: 3 },
  { id: 'biology', name: 'Биология', icon: '🌿', required: false, color: 'from-emerald-500 to-green-600', topics: 22, weakTopics: 2 },
  { id: 'history', name: 'История', icon: '🏛️', required: false, color: 'from-amber-500 to-orange-500', topics: 24, weakTopics: 5 },
  { id: 'social', name: 'Обществознание', icon: '🌍', required: false, color: 'from-orange-500 to-red-500', topics: 16, weakTopics: 2 },
  { id: 'informatics', name: 'Информатика', icon: '💻', required: false, color: 'from-cyan-500 to-blue-500', topics: 12, weakTopics: 1 },
  { id: 'english', name: 'Английский язык', icon: '🇬🇧', required: false, color: 'from-red-500 to-rose-500', topics: 14, weakTopics: 2 },
  { id: 'geography', name: 'География', icon: '🗺️', required: false, color: 'from-teal-500 to-cyan-500', topics: 16, weakTopics: 3 },
  { id: 'literature', name: 'Литература', icon: '📖', required: false, color: 'from-pink-500 to-rose-500', topics: 12, weakTopics: 1 },
];

const EXAM_INFO: Record<string, { ege: string; oge: string }> = {
  ru: { ege: '27 заданий: тест + сочинение. Грамотность, понимание текста, нормы языка.', oge: '9 заданий: изложение + тест + сочинение.' },
  math_base: { ege: '20 заданий без развёрнутого ответа. Практические задачи: финансы, геометрия, статистика.', oge: '' },
  math_prof: { ege: '19 заданий: 12 тестовых + 7 с развёрнутым ответом. Алгебра, геометрия, вероятности.', oge: '' },
  math: { ege: '', oge: '25 заданий: Алгебра + Геометрия + Реальная математика.' },
  physics: { ege: '30 заданий: механика, термодинамика, электричество, оптика, ядерная физика.', oge: '26 заданий: тест + лаб. работа + расчётные задачи.' },
  chemistry: { ege: '34 задания: строение атома, реакции, органическая химия, задачи.', oge: '22 задания: тест + практическая работа + задачи.' },
  biology: { ege: '29 заданий: клетка, организм, экосистемы, генетика, эволюция.', oge: '32 задания: тест + работа с текстом + практика.' },
  history: { ege: '21 задание: события от Руси до XXI века, карты, работа с источниками.', oge: '35 заданий: тест + документы + карта.' },
  social: { ege: '25 заданий: право, экономика, политика, социология, философия.', oge: '31 задание: тест + текст + эссе.' },
  informatics: { ege: '27 заданий: алгоритмы, программирование, логика, системы счисления.', oge: '15 заданий: тест + практика на компьютере.' },
  english: { ege: 'Аудирование, чтение, грамматика/лексика, письмо, говорение.', oge: 'Аудирование, чтение, грамматика, письмо, говорение.' },
  geography: { ege: '31 задание: карты, климат, население, экономика, экология.', oge: '30 заданий: тест + практика с картой.' },
  literature: { ege: '12 заданий: анализ лирики + анализ эпоса/драмы + сочинение.', oge: '8 заданий: работа с текстом + сочинение.' },
};

const EXAM_EXAMPLES: Record<string, { ege: Array<{num: string; type: string; text: string}>; oge: Array<{num: string; type: string; text: string}> }> = {
  ru: {
    ege: [
      { num: 'Задание 1', type: 'Тест', text: 'Определите главную информацию, содержащуюся в тексте.' },
      { num: 'Задание 9', type: 'Тест', text: 'Укажите варианты ответов, в которых во всех словах одного ряда пропущена одна и та же буква.' },
      { num: 'Задание 27', type: 'Сочинение', text: 'Напишите сочинение по прочитанному тексту. Сформулируйте проблему и позицию автора.' },
    ],
    oge: [
      { num: 'Задание 1', type: 'Изложение', text: 'Прослушайте текст и напишите сжатое изложение (не менее 70 слов).' },
      { num: 'Задание 2', type: 'Тест', text: 'Выполните синтаксический анализ предложения. Укажите верные характеристики.' },
      { num: 'Задание 9', type: 'Сочинение', text: 'Напишите сочинение-рассуждение. Объясните значение слова или фразы из текста.' },
    ],
  },
  math_base: {
    ege: [
      { num: 'Задание 1', type: 'Расчёт', text: 'Найдите значение выражения 0,7 * (-50). Вычислите результат.' },
      { num: 'Задание 10', type: 'Расчёт', text: 'В магазине скидка 20%. Товар стоил 3500 рублей. Какова цена после скидки?' },
      { num: 'Задание 17', type: 'Расчёт', text: 'Решите неравенство x^2 - 5x + 6 < 0 и укажите множество решений.' },
    ],
    oge: [],
  },
  math_prof: {
    ege: [
      { num: 'Задание 1', type: 'Тест', text: 'Планка длиной 2 м прислонена к стене. Нижний конец отстоит от стены на 1,2 м. Найдите высоту.' },
      { num: 'Задание 7', type: 'Расчёт', text: 'Найдите производную функции f(x) = x^3 - 6x^2 + 9x + 1 в точке x = 2.' },
      { num: 'Задание 18', type: 'Развёрнутый ответ', text: 'Решите неравенство log по основанию 2 от (x - 1) + log по основанию 2 от (x + 3) <= 3.' },
    ],
    oge: [],
  },
  math: {
    ege: [],
    oge: [
      { num: 'Задание 1', type: 'Расчёт', text: 'Найдите значение выражения (5/6 - 1/3) * 12. Запишите ответ в виде числа.' },
      { num: 'Задание 6', type: 'Расчёт', text: 'Решите уравнение x^2 - 7x + 10 = 0. Если корней несколько, запишите больший.' },
      { num: 'Задание 22', type: 'Развёрнутый ответ', text: 'Первый рабочий делает деталь за 8 часов, второй за 12 часов. За сколько часов сделают вместе?' },
    ],
  },
  physics: {
    ege: [
      { num: 'Задание 1', type: 'Тест', text: 'Тело движется по окружности. Как изменится центростремительное ускорение при увеличении скорости вдвое?' },
      { num: 'Задание 8', type: 'Расчёт', text: 'Идеальному газу передано 300 Дж теплоты, газ совершил работу 100 Дж. Найдите изменение внутренней энергии.' },
      { num: 'Задание 27', type: 'Развёрнутый ответ', text: 'Конденсатор ёмкостью 2 мкФ заряжен до 100 В. Определите энергию, выделяемую при разряде.' },
    ],
    oge: [
      { num: 'Задание 2', type: 'Тест', text: 'Установите соответствие между физической величиной и единицей измерения в СИ.' },
      { num: 'Задание 10', type: 'Расчёт', text: 'Какое количество теплоты нужно для нагревания 2 кг воды от 20 до 70 градусов?' },
      { num: 'Задание 17', type: 'Развёрнутый ответ', text: 'Проведите лабораторную работу: измерьте сопротивление резистора с помощью амперметра и вольтметра.' },
    ],
  },
  chemistry: {
    ege: [
      { num: 'Задание 1', type: 'Тест', text: 'Определите, атомы каких из указанных элементов имеют одинаковую конфигурацию внешнего энергетического уровня.' },
      { num: 'Задание 17', type: 'Тест', text: 'Определите, к какому типу относится реакция: 2Na + Cl2 = 2NaCl.' },
      { num: 'Задание 34', type: 'Развёрнутый ответ', text: 'При сжигании 4,4 г органического вещества получено 8,8 г CO2 и 3,6 г H2O. Определите формулу.' },
    ],
    oge: [
      { num: 'Задание 1', type: 'Тест', text: 'Выберите два утверждения, которые верно характеризуют строение атома фосфора.' },
      { num: 'Задание 12', type: 'Тест', text: 'Какие из перечисленных веществ реагируют с раствором соляной кислоты?' },
      { num: 'Задание 21', type: 'Развёрнутый ответ', text: 'Проведите реакцию: определите вещество и запишите уравнение реакции с наблюдениями.' },
    ],
  },
  biology: {
    ege: [
      { num: 'Задание 2', type: 'Тест', text: 'Выберите три признака, характерных для митоза. Запишите цифры в порядке возрастания.' },
      { num: 'Задание 8', type: 'Тест', text: 'Установите соответствие между характеристикой и органоидом клетки.' },
      { num: 'Задание 27', type: 'Развёрнутый ответ', text: 'Фрагмент цепи ДНК: ТАЦ-ГГА-ЦАТ. Определите последовательность аминокислот в белке.' },
    ],
    oge: [
      { num: 'Задание 1', type: 'Тест', text: 'Какой из перечисленных признаков характерен для всех живых организмов?' },
      { num: 'Задание 13', type: 'Тест', text: 'Установите соответствие между функцией и отделом головного мозга человека.' },
      { num: 'Задание 29', type: 'Развёрнутый ответ', text: 'Используя таблицу калорийности, составьте рацион с учётом энергозатрат подростка.' },
    ],
  },
  history: {
    ege: [
      { num: 'Задание 3', type: 'Тест', text: 'Установите соответствие между событиями и годами: Крещение Руси, Куликовская битва, Полтавская битва.' },
      { num: 'Задание 13', type: 'Тест', text: 'Рассмотрите карту военных действий. Укажите название войны и год начала.' },
      { num: 'Задание 21', type: 'Развёрнутый ответ', text: 'Приведите три причины победы большевиков в Гражданской войне. Аргументируйте каждую.' },
    ],
    oge: [
      { num: 'Задание 2', type: 'Тест', text: 'Расположите в хронологической последовательности: Ледовое побоище, Невская битва, Стояние на Угре.' },
      { num: 'Задание 8', type: 'Тест', text: 'Рассмотрите карту. Какое событие обозначено на карте? В каком веке оно произошло?' },
      { num: 'Задание 24', type: 'Развёрнутый ответ', text: 'Сравните реформы Петра I и Александра II. Укажите общие черты и различия.' },
    ],
  },
  social: {
    ege: [
      { num: 'Задание 2', type: 'Тест', text: 'Выберите верные суждения о функциях государства и запишите цифры.' },
      { num: 'Задание 10', type: 'Тест', text: 'На графике показано изменение спроса на товар. Что из перечисленного могло вызвать этот сдвиг?' },
      { num: 'Задание 25', type: 'Развёрнутый ответ', text: 'Обоснуйте необходимость политического плюрализма в демократическом государстве.' },
    ],
    oge: [
      { num: 'Задание 2', type: 'Тест', text: 'Какие из перечисленных признаков характеризуют рыночную экономику? Выберите два.' },
      { num: 'Задание 9', type: 'Тест', text: 'Верны ли суждения о правах и обязанностях гражданина РФ?' },
      { num: 'Задание 12', type: 'Развёрнутый ответ', text: 'Прочитайте текст о социальных нормах. Назовите два вида норм и приведите примеры.' },
    ],
  },
  informatics: {
    ege: [
      { num: 'Задание 1', type: 'Тест', text: 'Определите количество натуральных чисел, удовлетворяющих неравенству: 110111 в двоичной < x < DC в шестнадцатеричной.' },
      { num: 'Задание 6', type: 'Расчёт', text: 'Определите, что будет выведено в результате работы программы (Python). Фрагмент: for i in range(1, 6): s = s + i*i.' },
      { num: 'Задание 27', type: 'Развёрнутый ответ', text: 'Напишите программу, которая находит среди чисел те, что делятся на 3 и не делятся на 7.' },
    ],
    oge: [
      { num: 'Задание 1', type: 'Тест', text: 'Статья содержит 30 страниц, 40 строк на странице, 60 символов в строке. Определите объём в КБ (1 символ = 8 бит).' },
      { num: 'Задание 5', type: 'Тест', text: 'У исполнителя Робот есть команды вверх, вниз, влево, вправо. Составьте алгоритм прохода лабиринта.' },
      { num: 'Задание 13', type: 'Развёрнутый ответ', text: 'Напишите программу, которая вводит число и определяет, является ли оно палиндромом.' },
    ],
  },
  english: {
    ege: [
      { num: 'Задание 3', type: 'Тест', text: 'Прослушайте высказывания. Установите соответствие между говорящими и утверждениями.' },
      { num: 'Задание 19', type: 'Тест', text: 'Прочитайте текст. Преобразуйте слово так, чтобы оно грамматически соответствовало содержанию.' },
      { num: 'Задание 40', type: 'Развёрнутый ответ', text: 'Напишите эссе на тему "Some people think online education is the future". Выразите своё мнение.' },
    ],
    oge: [
      { num: 'Задание 1', type: 'Тест', text: 'Прослушайте диалог. Выберите правильный ответ на каждый из вопросов.' },
      { num: 'Задание 6', type: 'Тест', text: 'Прочитайте текст. Определите, какие утверждения True, False или Not stated.' },
      { num: 'Задание 35', type: 'Развёрнутый ответ', text: 'Напишите письмо другу, который спрашивает о вашем любимом школьном предмете.' },
    ],
  },
  geography: {
    ege: [
      { num: 'Задание 3', type: 'Тест', text: 'Какие из перечисленных стран являются крупнейшими по площади территории? Выберите три.' },
      { num: 'Задание 13', type: 'Расчёт', text: 'Определите географические координаты точки, расположенной на пересечении 40 с.ш. и 30 в.д.' },
      { num: 'Задание 29', type: 'Развёрнутый ответ', text: 'Объясните, почему в городе Мурманске наблюдается полярная ночь, а в Москве нет.' },
    ],
    oge: [
      { num: 'Задание 1', type: 'Тест', text: 'Какой из перечисленных городов расположен в зоне тайги?' },
      { num: 'Задание 9', type: 'Расчёт', text: 'Определите по карте расстояние от точки А до точки Б. Масштаб карты 1:50000.' },
      { num: 'Задание 30', type: 'Развёрнутый ответ', text: 'Определите регион России по его краткому описанию: "Граничит с двумя зарубежными странами..."' },
    ],
  },
  literature: {
    ege: [
      { num: 'Задание 1', type: 'Тест', text: 'К какому литературному роду относится произведение? Укажите жанр.' },
      { num: 'Задание 5', type: 'Развёрнутый ответ', text: 'Как в стихотворении Пушкина раскрывается тема свободы? Приведите примеры из текста.' },
      { num: 'Задание 12', type: 'Сочинение', text: 'Напишите сочинение на одну из тем. Объём не менее 250 слов. Аргументируйте с опорой на произведения.' },
    ],
    oge: [
      { num: 'Задание 1', type: 'Тест', text: 'Укажите название художественного приёма: "Мёртвые души". Как называется такой приём?' },
      { num: 'Задание 3', type: 'Развёрнутый ответ', text: 'Как в данном фрагменте раскрывается характер главного героя? Приведите два примера.' },
      { num: 'Задание 5', type: 'Сочинение', text: 'Напишите сочинение на одну из предложенных тем. Объём не менее 200 слов.' },
    ],
  },
};

const GAMIFICATION_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';

function calcSubjectStats(examTasksDone: number, totalSessions: number): { progress: number; level: string; scoreForecast: number } {
  const tasks = examTasksDone || 0;
  const sessions = totalSessions || 0;
  const raw = Math.min(100, tasks * 3 + sessions * 2);
  const progress = Math.max(0, raw);
  const level = progress >= 60 ? 'Хороший' : progress >= 30 ? 'Средний' : 'Базовый';
  const scoreForecast = Math.min(100, 40 + Math.round(progress * 0.55));
  return { progress, level, scoreForecast };
}

function sanitize(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/[\u4e00-\u9fff]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type Screen = 'pick_exam' | 'pick_subject' | 'pick_mode' | 'session';
type ExamType = 'ege' | 'oge';
type Mode = 'explain' | 'practice' | 'weak' | 'mock';

interface Subject { id: string; name: string; icon: string; required: boolean; color: string; topics: number; weakTopics: number }
interface Message { role: 'user' | 'ai'; text: string; quickReplies?: string[] }

const STORAGE_KEY = 'exam_last_choice';

export default function Exam() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('pick_exam');
  const [examType, setExamType] = useState<ExamType>('ege');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [mode, setMode] = useState<Mode>('explain');

  // Данные пользователя
  const [userGoal, setUserGoal] = useState<string>('');
  const [userSubjectId, setUserSubjectId] = useState<string>('');
  const [userStats, setUserStats] = useState<{ examTasksDone: number; totalSessions: number }>({ examTasksDone: 0, totalSessions: 0 });

  // Лимит вопросов (только вопросы пользователя, не первый промпт системы)
  const [questionsLeft, setQuestionsLeft] = useState<number | null>(null);
  const [questionsLimit, setQuestionsLimit] = useState<number>(5);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [subLoading, setSubLoading] = useState(true);
  const [userMessageCount, setUserMessageCount] = useState(0); // только сообщения пользователя

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskNum, setTaskNum] = useState(1);
  const [userAnswer, setUserAnswer] = useState('');
  const [waitingAnswer, setWaitingAnswer] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Восстанавливаем последний выбор
  const lastChoice = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  })();

  const subjects = examType === 'ege' ? EGE_SUBJECTS : OGE_SUBJECTS;
  const subjectId = subject?.id ?? '';
  const examInfo = EXAM_INFO[subjectId]?.[examType === 'ege' ? 'ege' : 'oge'] ?? '';
  const stats = calcSubjectStats(userStats.examTasksDone, userStats.totalSessions);
  const daysLeft = daysUntil(examType === 'ege' ? EGE_DATE : OGE_DATE);

  // Загружаем данные пользователя + подписку
  const loadSubscription = async () => {
    const token = authService.getToken();
    if (!token) {
      setQuestionsLeft(5);
      setQuestionsLimit(5);
      setSubLoading(false);
      return;
    }

    // Читаем данные пользователя для авто-выбора экзамена и предмета
    try {
      const user = await authService.verifyToken();
      if (user) {
        const goal = user.goal || '';
        const subj = user.exam_subject || '';
        setUserGoal(goal);
        setUserSubjectId(subj);
        if (goal === 'oge') setExamType('oge');
        else if (goal === 'ege') setExamType('ege');
      }
    } catch { /* silent */ }

    // Загружаем реальную статистику из gamification
    try {
      const res = await fetch(GAMIFICATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_profile' }),
      });
      if (res.ok) {
        const d = await res.json();
        setUserStats({
          examTasksDone: d.stats?.total_exam_tasks ?? 0,
          totalSessions: d.streak?.total_days ?? 0,
        });
      }
    } catch { /* silent */ }

    try {
      const res = await fetch(`${SUBSCRIPTION_URL}?action=limits`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const d = await res.json();
      const premium = d.subscription_type === 'premium';
      const trial = !!d.is_trial;
      setIsPremium(premium || trial);

      const ai = d.limits?.ai_questions;
      if (premium || trial) {
        const max = 20;
        const used = ai?.used ?? 0;
        setQuestionsLimit(max);
        setQuestionsLeft(Math.max(0, max - used));
      } else {
        const max = ai?.max ?? 3;
        const used = ai?.used ?? 0;
        setQuestionsLimit(max);
        setQuestionsLeft(Math.max(0, max - used));
      }
    } catch {
      setQuestionsLeft(3);
      setQuestionsLimit(3);
    } finally {
      setSubLoading(false);
    }
  };

  useEffect(() => { loadSubscription(); }, []);

  const scrollBottom = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  const askAI = async (
    question: string,
    history: Message[] = [],
    currentSubject?: Subject | null,
    currentMode?: Mode,
    currentExamType?: ExamType,
    isSystemPrompt: boolean = false
  ): Promise<{ answer: string; remaining?: number }> => {
    const token = authService.getToken();
    const sub = currentSubject ?? subject;
    const mod = currentMode ?? mode;
    const et = currentExamType ?? examType;
    const examMeta = sub ? `${et}||${sub.name}|${mod}` : undefined;
    const hist = history.slice(-6).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

    const doFetch = async (): Promise<Response> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: Record<string, unknown>;

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        body = { question, exam_meta: examMeta, history: hist, system_only: isSystemPrompt };
      } else {
        body = { action: 'demo_ask', question, history: hist };
      }

      return fetch(AI_API_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    };

    // До 3 попыток — пока не получим читаемый ответ от ИИ
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await doFetch();
        const data = await res.json();

        // Лимит исчерпан — это не ошибка сети, показываем paywall
        if (res.status === 403 && data.error === 'limit') {
          setShowPaywall(true);
          setQuestionsLeft(0);
          throw new Error('limit');
        }
        if (res.status === 429) {
          setShowPaywall(true);
          throw new Error('limit');
        }

        const text = data.answer || data.response || '';
        if (!text && attempt < 2) continue; // пустой ответ — повторяем

        return { answer: sanitize(text || question), remaining: data.remaining };
      } catch (e: unknown) {
        if ((e as Error).message === 'limit') throw e;
        // Сетевая ошибка — пауза и повтор
        if (attempt < 2) await new Promise(r => setTimeout(r, 800));
      }
    }

    // Все попытки исчерпаны — не показываем техническое сообщение,
    // а задаём уточняющий вопрос чтобы продолжить диалог
    return { answer: 'Уточни вопрос немного по-другому — и я отвечу подробно! 🙂' };
  };

  const saveChoice = (et: ExamType, s: Subject, m: Mode) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ examType: et, subjectId: s.id, mode: m }));
  };

  const startSession = async (s: Subject, m: Mode, et?: ExamType) => {
    const eType = et ?? examType;
    setSubject(s);
    setMode(m);
    setMessages([]);
    setTaskNum(1);
    setWaitingAnswer(false);
    setInput('');
    setShowPaywall(false);
    setScreen('session');
    saveChoice(eType, s, m);

    setLoading(true);
    scrollBottom();

    let prompt = '';
    let quickReplies: string[] = [];

    if (m === 'explain') {
      prompt = `Ты репетитор Studyfay. Пользователь начинает подготовку к ${eType.toUpperCase()} по предмету "${s.name}". Поприветствуй, кратко (3-4 предложения) объясни что умеешь по этому предмету и предложи выбрать тему или задать вопрос. Используй 1-2 эмодзи. Не пиши длинно.`;
      quickReplies = ['Объясни главные темы', 'Дай типовое задание', 'Разбери сложные места', `Что точно будет на ${eType.toUpperCase()}?`];
    } else if (m === 'practice') {
      prompt = `Ты экзаменатор ${eType.toUpperCase()} по предмету "${s.name}". Дай задание №1 — реальное типовое задание точно как на экзамене. Только условие задачи, без ответа и подсказок. В конце напиши "Жду твой ответ."`;
    } else if (m === 'weak') {
      prompt = `Ты репетитор по предмету "${s.name}" для ${eType.toUpperCase()}. Скажи что разберём самые слабые темы, которые чаще всего вызывают ошибки. Начни с самой трудной: дай короткое объяснение ключевого правила и сразу задание. В конце напиши "Жду ответ."`;
    } else if (m === 'mock') {
      prompt = `Сегодня имитация реального экзамена ${eType.toUpperCase()} по предмету "${s.name}". Задания идут по порядку как в КИМ. Задание №1: дай первое типовое задание точно как на экзамене. Только условие, без ответа.`;
    }

    try {
      const { answer } = await askAI(prompt, [], s, m, eType, true);
      const msg: Message = { role: 'ai', text: answer };
      if (quickReplies.length) msg.quickReplies = quickReplies;
      setMessages([msg]);
      if (m === 'practice' || m === 'weak' || m === 'mock') setWaitingAnswer(true);
    } catch (e: unknown) {
      if ((e as Error).message !== 'limit') {
        setMessages([{ role: 'ai', text: `Привет! Готов помочь с подготовкой к ${eType.toUpperCase()} по "${s.name}" 📚\n\nЗадай любой вопрос по теме — объясню, разберу задание или проверю ответ.` }]);
      }
    } finally {
      setLoading(false);
      scrollBottom();
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    // Жёсткая блокировка при исчерпании лимита
    if (!isPremium && questionsLeft !== null && questionsLeft <= 0) {
      setShowPaywall(true);
      return;
    }

    setUserMessageCount(c => c + 1);

    const newMessages: Message[] = [...messages, { role: 'user', text: msg }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    scrollBottom();

    try {
      const { answer, remaining } = await askAI(msg, newMessages.slice(-6));
      // Списываем вопрос только после получения ответа ИИ
      if (!isPremium && questionsLeft !== null) {
        if (remaining !== undefined) {
          setQuestionsLeft(Math.max(0, remaining));
        } else {
          setQuestionsLeft(q => Math.max(0, (q ?? 1) - 1));
        }
      }
      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (e: unknown) {
      if ((e as Error).message !== 'limit') {
        setMessages(prev => [...prev, { role: 'ai', text: 'Хороший вопрос! Уточни его немного — и я разберу подробно 🙂' }]);
      }
    } finally {
      setLoading(false);
      scrollBottom();
    }
  };

  const checkAnswer = async () => {
    const text = userAnswer.trim();
    if (!text || checkLoading) return;

    // Жёсткая блокировка при исчерпании лимита
    if (!isPremium && questionsLeft !== null && questionsLeft <= 0) {
      setShowPaywall(true);
      return;
    }

    setUserMessageCount(c => c + 1);

    const lastTask = [...messages].reverse().find(m => m.role === 'ai')?.text ?? '';
    const newMessages: Message[] = [...messages, { role: 'user', text }];
    setMessages(newMessages);
    setUserAnswer('');
    setWaitingAnswer(false);
    setCheckLoading(true);
    scrollBottom();

    const nextNum = taskNum + 1;

    try {
      const prompt = `Задание: ${lastTask}\n\nОтвет ученика: ${text}\n\nПроверь ответ. Если правильно — начни "Правильно! ✅" и похвали одной фразой. Если неправильно — начни "Неверно ❌" и объясни правильное решение коротко. Потом дай задание №${nextNum} — новое типовое задание ${examType.toUpperCase()} по "${subject?.name}". Только условие, без ответа. В конце напиши "Жду ответ."`;
      const { answer, remaining } = await askAI(prompt, newMessages.slice(-4));
      // Списываем вопрос только после получения ответа ИИ
      if (!isPremium && questionsLeft !== null) {
        if (remaining !== undefined) {
          setQuestionsLeft(Math.max(0, remaining));
        } else {
          setQuestionsLeft(q => Math.max(0, (q ?? 1) - 1));
        }
      }
      // Трекинг: считаем задание выполненным при правильном ответе
      const answerLower = answer.toLowerCase();
      const wasCorrect = answerLower.startsWith('правильно') || answerLower.includes('правильно!');
      if (wasCorrect) {
        trackActivity('exam_tasks_done', 1).catch(() => {});
      }
      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
      setTaskNum(nextNum);
      setWaitingAnswer(true);
    } catch (e: unknown) {
      if ((e as Error).message !== 'limit') {
        setMessages(prev => [...prev, { role: 'ai', text: 'Принято! Попробуй написать ответ ещё раз — проверю внимательно 🎯' }]);
        setWaitingAnswer(true);
      }
    } finally {
      setCheckLoading(false);
      scrollBottom();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ЭКРАН 1: Выбор экзамена
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'pick_exam') {
    const egeLeft = daysUntil(EGE_DATE);
    const ogeLeft = daysUntil(OGE_DATE);

    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 flex flex-col px-5 pb-nav pt-14">
        {/* Шапка */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-3xl mb-4">🎓</div>
          <h1 className="text-white font-extrabold text-2xl mb-2">Подготовка к экзамену</h1>
          <p className="text-white/70 text-sm leading-relaxed max-w-xs">
            ИИ знает структуру экзамена и поможет пройти все задания шаг за шагом
          </p>
        </div>

        {/* Если уже выбирали — кнопка продолжить */}
        {lastChoice && (() => {
          const allSubs = [...EGE_SUBJECTS, ...OGE_SUBJECTS];
          const prevSub = allSubs.find(s => s.id === lastChoice.subjectId);
          if (!prevSub) return null;
          return (
            <button
              onClick={() => {
                setExamType(lastChoice.examType);
                startSession(prevSub, lastChoice.mode, lastChoice.examType);
              }}
              className="w-full bg-white rounded-2xl px-5 py-4 text-left shadow-xl mb-5 active:scale-[0.97] transition-all border-2 border-white"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{prevSub.icon}</span>
                <div className="flex-1">
                  <p className="text-indigo-600 font-bold text-sm">Продолжить подготовку</p>
                  <p className="text-gray-700 font-extrabold">{lastChoice.examType.toUpperCase()} · {prevSub.name}</p>
                </div>
                <Icon name="ChevronRight" size={18} className="text-indigo-400" />
              </div>
            </button>
          );
        })()}

        {/* Быстрый переход — если пользователь выбрал тип экзамена в профиле */}
        {(userGoal === 'ege' || userGoal === 'oge') && (
          <button
            onClick={() => setScreen('pick_subject')}
            className="w-full bg-white rounded-2xl px-5 py-4 text-left shadow-xl mb-3 active:scale-[0.97] transition-all border-2 border-yellow-300"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{userGoal === 'oge' ? '📋' : '🏆'}</span>
              <div className="flex-1">
                <p className="text-yellow-600 font-bold text-xs">Выбрано в профиле</p>
                <p className="text-gray-800 font-extrabold">{userGoal.toUpperCase()} — перейти к предметам</p>
              </div>
              <Icon name="ChevronRight" size={18} className="text-yellow-400" />
            </div>
          </button>
        )}

        {/* Кнопки выбора */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => { setExamType('ege'); setScreen('pick_subject'); }}
            className="bg-white rounded-2xl px-5 py-5 text-left shadow-xl active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🏆</span>
              <div className="flex-1">
                <p className="font-extrabold text-gray-800 text-lg">ЕГЭ</p>
                <p className="text-gray-400 text-xs">11 класс · Единый государственный</p>
              </div>
            </div>
            {/* Срочность */}
            <div className="bg-red-50 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-red-500 text-base">⏳</span>
              <div>
                <p className="text-red-600 font-bold text-sm">До ЕГЭ осталось: {egeLeft} дней</p>
                <p className="text-red-400 text-xs">Каждый день важен</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => { setExamType('oge'); setScreen('pick_subject'); }}
            className="bg-white/15 border border-white/30 rounded-2xl px-5 py-5 text-left active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📋</span>
              <div className="flex-1">
                <p className="font-extrabold text-white text-lg">ОГЭ</p>
                <p className="text-white/50 text-xs">9 класс · Основной государственный</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-yellow-300 text-base">⏳</span>
              <p className="text-white/80 font-semibold text-sm">До ОГЭ осталось: {ogeLeft} дней</p>
            </div>
          </button>
        </div>

        <button onClick={() => navigate('/')} className="text-white/40 text-sm mt-8 text-center">Вернуться</button>
        <BottomNav />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ЭКРАН 2: Выбор предмета
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'pick_subject') {
    const lastSubjectId = lastChoice?.examType === examType ? lastChoice?.subjectId : null;
    // Приоритет сортировки: предмет пользователя > последний выбранный
    const sortedSubjects = (list: Subject[]) => {
      return [...list].sort((a, b) => {
        const aUser = a.id === userSubjectId ? 2 : a.id === lastSubjectId ? 1 : 0;
        const bUser = b.id === userSubjectId ? 2 : b.id === lastSubjectId ? 1 : 0;
        return bUser - aUser;
      });
    };

    // Предмет пользователя — может быть в обязательных или по выбору
    const userSubject = userSubjectId ? subjects.find(s => s.id === userSubjectId) : null;

    return (
      <div className="min-h-[100dvh] bg-gray-50 pb-nav">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 pt-12 pb-5">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setScreen('pick_exam')} className="text-white/70 hover:text-white p-1">
              <Icon name="ArrowLeft" size={20} />
            </button>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">{examType.toUpperCase()} · {daysLeft} дней</p>
              <h1 className="text-white font-bold text-lg">Выбери предмет</h1>
            </div>
          </div>
        </div>

        <div className="px-4 py-4">
          {/* Блок «Твой основной предмет» — если задан в профиле */}
          {userSubject && (
            <div className="mb-5">
              <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide mb-2">Твой основной предмет</p>
              <button
                onClick={() => { setSubject(userSubject); setShowExamples(false); setScreen('pick_mode'); }}
                className={`w-full bg-gradient-to-r ${userSubject.color} rounded-2xl p-4 text-left shadow-lg active:scale-[0.97] transition-all relative overflow-hidden border-2 border-white`}
              >
                <div className="absolute top-0 right-0 bg-white/25 rounded-bl-2xl px-3 py-1">
                  <p className="text-white text-[10px] font-bold">⭐ Мой предмет</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{userSubject.icon}</span>
                  <div className="flex-1">
                    <p className="text-white font-extrabold text-base leading-tight">{userSubject.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-white/20 rounded-full h-1.5">
                        <div className="bg-white rounded-full h-1.5" style={{ width: `${stats.progress}%` }} />
                      </div>
                      <p className="text-white/80 text-[10px] flex-shrink-0">{stats.progress}%</p>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Обязательные</p>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {sortedSubjects(subjects.filter(s => s.required)).map(s => {
              const isLast = s.id === lastSubjectId && s.id !== userSubjectId;
              const isUser = s.id === userSubjectId;
              const subjectProgress = isUser ? stats.progress : 0;
              return (
                <button
                  key={s.id}
                  onClick={() => { setSubject(s); setShowExamples(false); setScreen('pick_mode'); }}
                  className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-left shadow-sm active:scale-[0.97] transition-all relative overflow-hidden ${isUser ? 'ring-2 ring-white ring-offset-1' : ''}`}
                >
                  {isUser && (
                    <div className="absolute top-2 right-2 bg-white/30 rounded-full px-2 py-0.5">
                      <p className="text-white text-[9px] font-bold">⭐ Мой</p>
                    </div>
                  )}
                  {isLast && !isUser && (
                    <div className="absolute top-2 right-2 bg-white/30 rounded-full px-2 py-0.5">
                      <p className="text-white text-[9px] font-bold">Недавно</p>
                    </div>
                  )}
                  <span className="text-2xl block mb-2">{s.icon}</span>
                  <p className="text-white font-bold text-sm leading-tight mb-2">{s.name}</p>
                  <div className="w-full bg-white/20 rounded-full h-1.5 mb-1">
                    <div className="bg-white rounded-full h-1.5 transition-all" style={{ width: `${subjectProgress}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-white/80 text-[10px]">{isUser ? `${subjectProgress}% готовности` : 'Начать'}</p>
                    {s.weakTopics > 0 && (
                      <p className="text-white/90 text-[10px] bg-white/20 rounded-full px-1.5">🔥 {s.weakTopics}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">По выбору</p>
          <div className="grid grid-cols-2 gap-2.5">
            {sortedSubjects(subjects.filter(s => !s.required)).map(s => {
              const isLast = s.id === lastSubjectId && s.id !== userSubjectId;
              const isUser = s.id === userSubjectId;
              const subjectProgress = isUser ? stats.progress : 0;
              const topicsLeft = Math.round(s.topics * (1 - subjectProgress / 100));
              return (
                <button
                  key={s.id}
                  onClick={() => { setSubject(s); setShowExamples(false); setScreen('pick_mode'); }}
                  className={`rounded-2xl p-4 text-left shadow-sm border active:scale-[0.97] transition-all relative ${isUser ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400' : 'bg-white border-gray-100'}`}
                >
                  {isUser && (
                    <div className="absolute top-2 right-2 bg-indigo-100 rounded-full px-2 py-0.5">
                      <p className="text-indigo-600 text-[9px] font-bold">⭐ Мой</p>
                    </div>
                  )}
                  {isLast && !isUser && (
                    <div className="absolute top-2 right-2 bg-indigo-100 rounded-full px-2 py-0.5">
                      <p className="text-indigo-600 text-[9px] font-bold">Недавно</p>
                    </div>
                  )}
                  <span className="text-2xl block mb-2">{s.icon}</span>
                  <p className="text-gray-800 font-bold text-sm leading-tight mb-2">{s.name}</p>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                    <div className="bg-indigo-500 rounded-full h-1.5 transition-all" style={{ width: `${subjectProgress}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-[10px]">{isUser ? `осталось ${topicsLeft} тем` : 'Начать'}</p>
                    {s.weakTopics > 0 && (
                      <p className="text-orange-500 text-[10px]">🔥 {s.weakTopics} слабых</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ЭКРАН 3: Выбор режима
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'pick_mode' && subject) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col pb-nav">
        <div className={`bg-gradient-to-r ${subject.color} px-4 pt-12 pb-6`}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setScreen('pick_subject')} className="text-white/70 hover:text-white p-1">
              <Icon name="ArrowLeft" size={20} />
            </button>
            <div className="flex-1">
              <p className="text-white/60 text-xs">{examType.toUpperCase()} · {daysLeft} дней</p>
              <h1 className="text-white font-bold text-lg">{subject.name}</h1>
            </div>
            <span className="text-3xl">{subject.icon}</span>
          </div>

          {/* Твой уровень */}
          <div className="bg-white/20 rounded-2xl px-4 py-3 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-white/70 text-xs mb-0.5">Текущий уровень</p>
              <p className="text-white font-bold text-sm">{stats.level}</p>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="flex-1">
              <p className="text-white/70 text-xs mb-0.5">Прогноз балла</p>
              <p className="text-white font-bold text-sm">{stats.scoreForecast} баллов</p>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="flex-1">
              <p className="text-white/70 text-xs mb-0.5">Готовность</p>
              <p className="text-white font-bold text-sm">{stats.progress}%</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 flex flex-col gap-3">
          {examInfo && (
            <div className="bg-indigo-50 rounded-2xl px-4 py-3 border border-indigo-100">
              <p className="text-indigo-700 text-xs leading-relaxed">{examInfo}</p>
            </div>
          )}

          {(() => {
            const examples = EXAM_EXAMPLES[subjectId]?.[examType] || [];
            if (examples.length === 0) return null;
            return (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowExamples(!showExamples)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left"
                >
                  <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">📋</div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-sm">Какие задания будут?</p>
                    <p className="text-gray-400 text-xs">Примеры реальных заданий {examType.toUpperCase()}</p>
                  </div>
                  <Icon name={showExamples ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-gray-300" />
                </button>
                {showExamples && (
                  <div className="px-4 pb-4 flex flex-col gap-2.5">
                    {examples.map((ex, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl px-3.5 py-3 border border-gray-100">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{ex.num}</span>
                          <span className="text-xs text-gray-400 font-medium">{ex.type}</span>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">{ex.text}</p>
                      </div>
                    ))}
                    <button
                      onClick={() => startSession(subject!, 'practice')}
                      className={`mt-1 w-full py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r ${subject!.color} active:scale-[0.97] transition-all`}
                    >
                      Попробовать решить →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Выбери режим</p>

          {/* Объяснение */}
          <button
            onClick={() => startSession(subject, 'explain')}
            className="bg-white rounded-2xl p-4 text-left shadow-sm border border-gray-100 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">💡</div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">Объяснение</p>
                <p className="text-gray-400 text-xs">Задавай любые вопросы — разберём теорию</p>
              </div>
              <Icon name="ChevronRight" size={16} className="text-gray-300" />
            </div>
          </button>

          {/* Практика */}
          <button
            onClick={() => startSession(subject, 'practice')}
            className="bg-white rounded-2xl p-4 text-left shadow-sm border border-gray-100 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🎯</div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">Практика</p>
                <p className="text-gray-400 text-xs">Реальные задания {examType.toUpperCase()} с проверкой</p>
              </div>
              <Icon name="ChevronRight" size={16} className="text-gray-300" />
            </div>
          </button>

          {/* Слабые темы */}
          <button
            onClick={() => startSession(subject, 'weak')}
            className="bg-white rounded-2xl p-4 text-left shadow-sm border border-orange-100 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-orange-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🔥</div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">Слабые темы</p>
                <p className="text-gray-400 text-xs">ИИ сам выбирает что нужно подтянуть</p>
              </div>
              {subject.weakTopics > 0 && (
                <span className="bg-orange-100 text-orange-600 font-bold text-xs rounded-full px-2 py-0.5">{subject.weakTopics}</span>
              )}
            </div>
          </button>

          {/* Экзамен сегодня */}
          <button
            onClick={() => startSession(subject, 'mock')}
            className="bg-white rounded-2xl p-4 text-left shadow-sm border border-red-100 active:scale-[0.97] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📝</div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">Экзамен сегодня</p>
                <p className="text-gray-400 text-xs">Имитация реального экзамена по билетам</p>
              </div>
              <Icon name="ChevronRight" size={16} className="text-gray-300" />
            </div>
          </button>

          {/* План на 7 дней — Premium */}
          <button
            onClick={() => isPremium ? navigate('/session') : setShowPaywall(true)}
            className={`rounded-2xl p-4 text-left shadow-sm border active:scale-[0.97] transition-all ${
              isPremium
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 border-orange-200'
                : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${isPremium ? 'bg-white/30' : 'bg-amber-100'}`}>
                📅
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`font-bold ${isPremium ? 'text-white' : 'text-amber-800'}`}>План на 7 дней</p>
                  {!isPremium && <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">Premium</span>}
                </div>
                <p className={`text-xs ${isPremium ? 'text-white/80' : 'text-amber-600'}`}>
                  ИИ составит персональный план подготовки
                </p>
              </div>
              <Icon name="ChevronRight" size={16} className={isPremium ? 'text-white/60' : 'text-amber-400'} />
            </div>
          </button>
        </div>
        <BottomNav />

        {/* Paywall */}
        {showPaywall && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-6 pb-10">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <p className="text-2xl text-center mb-2">✨</p>
              <h3 className="font-extrabold text-gray-800 text-xl text-center mb-2">Разблокируй Premium</h3>
              <p className="text-gray-500 text-sm text-center mb-6">Получи доступ к персональному плану, неограниченным вопросам и всем режимам</p>
              <button
                onClick={() => navigate('/pricing')}
                className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl text-base mb-3"
              >
                Подключить Premium
              </button>
              <button onClick={() => setShowPaywall(false)} className="w-full text-gray-400 text-sm py-2">Не сейчас</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ЭКРАН 4: Чат-сессия
  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'session' && subject) {
    const isExplain = mode === 'explain';
    const isMock = mode === 'mock';
    const modeLabel: Record<Mode, string> = {
      explain: '💡 Объяснение',
      practice: `🎯 Практика · задание ${taskNum}`,
      weak: '🔥 Слабые темы',
      mock: `📝 Экзамен · задание ${taskNum}`,
    };

    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
        {/* Шапка */}
        <div className={`bg-gradient-to-r ${subject.color} px-4 pt-12 pb-3`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('pick_mode')} className="text-white/70 hover:text-white p-1">
              <Icon name="ArrowLeft" size={20} />
            </button>
            <div className="flex-1">
              <p className="text-white/60 text-xs">{examType.toUpperCase()} · {subject.name}</p>
              <h1 className="text-white font-bold text-base">{modeLabel[mode]}</h1>
            </div>
            <span className="text-2xl">{subject.icon}</span>
          </div>
        </div>

        {/* Лимит вопросов */}
        {(() => {
          if (subLoading) return null;
          if (isPremium) return (
            <div className="px-4 py-2 bg-indigo-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-indigo-600">
                Premium: {questionsLeft !== null ? `осталось ${questionsLeft} из ${questionsLimit}` : '...'} сегодня
              </p>
            </div>
          );
          // Бесплатный
          const left = questionsLeft ?? 0;
          return (
            <div className={`px-4 py-2 flex items-center justify-between ${left <= 1 ? 'bg-red-50' : 'bg-amber-50'}`}>
              <p className={`text-xs font-semibold ${left <= 1 ? 'text-red-600' : 'text-amber-700'}`}>
                {left > 0
                  ? `Осталось ${left} ${left === 1 ? 'вопрос' : left < 5 ? 'вопроса' : 'вопросов'} сегодня`
                  : 'Бесплатные вопросы исчерпаны'}
              </p>
              {left === 0
                ? <button onClick={() => setShowPaywall(true)} className="text-xs font-bold text-white bg-indigo-600 px-3 py-1 rounded-full">Разблокировать</button>
                : <button onClick={() => setShowPaywall(true)} className="text-xs text-indigo-500 font-medium">Безлимит →</button>
              }
            </div>
          );
        })()}

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

          {loading && messages.length === 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-base flex-shrink-0">🤖</div>
              <div>
                <div className="flex gap-1 items-center mb-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                  ))}
                </div>
                <p className="text-gray-400 text-xs">Формирую объяснение... обычно до 30 сек</p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i}>
              <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'ai' && (
                  <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-0.5 text-sm">🤖</div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
              </div>

              {/* Быстрые кнопки под первым сообщением ИИ */}
              {m.role === 'ai' && m.quickReplies && i === messages.length - 1 && (
                <div className="flex flex-wrap gap-2 mt-2 ml-9">
                  {m.quickReplies.map((qr, qi) => (
                    <button
                      key={qi}
                      onClick={() => sendMessage(qr)}
                      disabled={loading}
                      className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {(loading || checkLoading) && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 text-sm">🤖</div>
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center mb-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                  ))}
                </div>
                <p className="text-gray-400 text-xs">обычно до 30 сек...</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Ввод */}
        <div className="px-4 pb-8 pt-2 bg-white border-t border-gray-100">
          {/* Лимит исчерпан — показываем заглушку вместо поля ввода */}
          {!isPremium && questionsLeft !== null && questionsLeft <= 0 ? (
            <div className="flex flex-col gap-2">
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-center">
                <p className="text-red-700 font-bold text-sm">Бесплатные вопросы закончились</p>
                <p className="text-red-500 text-xs mt-0.5">Приходи завтра или подключи Premium</p>
              </div>
              <button
                onClick={() => setShowPaywall(true)}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl active:scale-[0.97] transition-all"
              >
                Подключить Premium 🔓
              </button>
            </div>
          ) : !isExplain && waitingAnswer ? (
            /* Практика / Слабые / Экзамен — поле ответа */
            <div className="flex flex-col gap-2">
              <textarea
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                placeholder={isMock ? 'Введи ответ...' : 'Введи ответ на задание...'}
                rows={2}
                className="w-full rounded-2xl border-2 border-gray-200 focus:border-indigo-400 px-4 py-3 text-sm text-gray-800 resize-none outline-none transition-colors"
              />
              <button
                onClick={checkAnswer}
                disabled={!userAnswer.trim() || checkLoading}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl disabled:opacity-50 active:scale-[0.97] transition-all"
              >
                Проверить ответ
              </button>
            </div>
          ) : (
            /* Объяснение — свободный чат */
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Задай вопрос по теме..."
                rows={1}
                className="flex-1 rounded-2xl border-2 border-gray-200 focus:border-indigo-400 px-4 py-3 text-sm text-gray-800 resize-none outline-none transition-colors"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
              >
                <Icon name="Send" size={18} className="text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Paywall после исчерпания лимита */}
        {showPaywall && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-6 pb-10">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <p className="text-3xl text-center mb-3">🎓</p>
              <h3 className="font-extrabold text-gray-800 text-xl text-center mb-2">Бесплатные вопросы закончились</h3>
              <p className="text-gray-500 text-sm text-center mb-2">
                Ты использовал все бесплатные вопросы на сегодня.
              </p>
              <p className="text-indigo-600 font-semibold text-sm text-center mb-6">
                Продолжай без ограничений с Premium ↓
              </p>
              <div className="bg-indigo-50 rounded-2xl p-4 mb-5">
                <div className="flex flex-col gap-2">
                  {['Безлимитные вопросы каждый день', 'Персональный план на 7 дней', 'Прогноз реального балла', 'Режим "Экзамен сегодня"'].map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Icon name="CheckCircle" size={16} className="text-indigo-500 flex-shrink-0" />
                      <p className="text-indigo-800 text-sm">{f}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => navigate('/subscription')}
                className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl text-base mb-3"
              >
                Подключить Premium
              </button>
              <button onClick={() => setShowPaywall(false)} className="w-full text-gray-400 text-sm py-2">Закрыть</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}