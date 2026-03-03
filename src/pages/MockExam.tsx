import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';

interface Question {
  id: number;
  subject: string;
  examType: 'ege' | 'oge';
  topic: string;
  text: string;
  type: 'single' | 'multiple' | 'input';
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  points: number;
}

const QUESTIONS: Question[] = [
  {id:1,subject:'ru',examType:'ege',topic:'Ударения',text:'В каком слове верно выделена буква, обозначающая ударный гласный?',type:'single',options:['звонИт','красИвее','дОговор','катАлог'],correctAnswer:'звонИт',explanation:'Правильно: звонИт (ударение на последний слог)',points:1},
  {id:2,subject:'ru',examType:'ege',topic:'Паронимы',text:'Выберите правильный пароним: «... мастер своего дела»',type:'single',options:['Искусный','Искусственный'],correctAnswer:'Искусный',explanation:'Искусный = умелый; искусственный = ненатуральный',points:1},
  {id:3,subject:'ru',examType:'ege',topic:'Грамматика',text:'Укажите пример с грамматической ошибкой',type:'single',options:['благодаря помощи','согласно приказа','вопреки ожиданиям','наперекор судьбе'],correctAnswer:'согласно приказа',explanation:'Правильно: согласно приказу (дательный падеж)',points:1},
  {id:4,subject:'ru',examType:'ege',topic:'Орфография',text:'В каком ряду во всех словах пропущена одна и та же буква?',type:'single',options:['пр..образовать, пр..неприятный, пр..следовать','бе..вкусный, и..бежать, ра..писание','п..дписать, пр..дедушка, не..бычный','пере..дать, по..стеречь, на..кусить'],correctAnswer:'бе..вкусный, и..бежать, ра..писание',explanation:'Приставки бес/из/рас перед глухими согласными',points:1},
  {id:5,subject:'ru',examType:'ege',topic:'Орфография',text:'В каком слове на месте пропуска пишется буква Е?',type:'single',options:['заноч..вать','опазд..вать','рассказ..вать','танц..вать'],correctAnswer:'заноч..вать',explanation:'Заночевать — суффикс -ева-, пишется Е',points:1},
  {id:6,subject:'ru',examType:'ege',topic:'Грамматика',text:'Отредактируйте: «Поднимаясь по лестнице, мне стало плохо»',type:'single',options:['Когда я поднимался по лестнице, мне стало плохо','Предложение написано верно','Поднимаясь по лестнице — мне стало плохо','Мне стало плохо, поднимаясь по лестнице'],correctAnswer:'Когда я поднимался по лестнице, мне стало плохо',explanation:'Деепричастный оборот должен относиться к подлежащему',points:1},
  {id:7,subject:'ru',examType:'ege',topic:'Орфография',text:'Укажите слово, которое пишется слитно',type:'single',options:['(в)следствие дождя','(в)течение часа','(в)продолжение дня','(в)заключение доклада'],correctAnswer:'(в)следствие дождя',explanation:'Вследствие (=из-за) пишется слитно',points:1},
  {id:8,subject:'ru',examType:'ege',topic:'Орфография',text:'В каком предложении НЕ пишется слитно?',type:'single',options:['Это был (не)лёгкий, а трудный путь','(Не)смотря на дождь, мы пошли гулять','Работа (не)закончена','(Не)зная правил, нельзя писать грамотно'],correctAnswer:'(Не)смотря на дождь, мы пошли гулять',explanation:'Несмотря на — предлог, пишется слитно',points:1},
  {id:9,subject:'ru',examType:'ege',topic:'Орфография',text:'Где пишется НН: Ю(1)ый биатлонист был удивлё(2) результатами соревнований, организова(3)ых впервые',type:'single',options:['1, 2','2, 3','3','1, 3'],correctAnswer:'3',explanation:'Организованных — причастие с приставкой, НН',points:1},
  {id:10,subject:'ru',examType:'ege',topic:'Пунктуация',text:'Запятые: «Солнце(1) уже довольно высоко стоявшее на небе(2) жгло(3) и палило немилосердно»',type:'single',options:['1, 2','1, 2, 3','2, 3','1, 3'],correctAnswer:'1, 2',explanation:'Причастный оборот после определяемого слова обособляется',points:1},
  {id:11,subject:'ru',examType:'ege',topic:'Синтаксис',text:'Тип связи в словосочетании «очень быстро»',type:'single',options:['согласование','управление','примыкание'],correctAnswer:'примыкание',explanation:'Наречие + наречие — примыкание',points:1},
  {id:12,subject:'ru',examType:'ege',topic:'Стилистика',text:'Стиль: «Гражданин Иванов И.И. обязуется выплатить...»',type:'single',options:['научный','публицистический','официально-деловой','разговорный'],correctAnswer:'официально-деловой',explanation:'Юридическая лексика — официально-деловой стиль',points:1},
  {id:13,subject:'ru',examType:'ege',topic:'Средства выразительности',text:'Средство выразительности: «Горит восток зарёю новой»',type:'single',options:['метафора','эпитет','олицетворение','сравнение'],correctAnswer:'метафора',explanation:'Горит восток — перенос значения, метафора',points:1},
  {id:14,subject:'ru',examType:'ege',topic:'Пунктуация',text:'Запятые: «К счастью(1) дождь прекратился(2) и(3) мы смогли продолжить путь»',type:'single',options:['1','1, 2','1, 2, 3','2, 3'],correctAnswer:'1',explanation:'К счастью — вводное слово, выделяется запятой',points:1},
  {id:15,subject:'ru',examType:'ege',topic:'Синтаксис',text:'Сложноподчинённое с придаточным причины?',type:'single',options:['Я не пошёл, но позвонил другу','Так как был болен, я остался дома','День был тёплый и солнечный','Мы гуляли, а потом вернулись'],correctAnswer:'Так как был болен, я остался дома',explanation:'«Так как» — союз причины',points:1},
  {id:16,subject:'math_prof',examType:'ege',topic:'Уравнения',text:'Найдите корень уравнения: 2x + 5 = 17',type:'input',correctAnswer:'6',explanation:'2x = 12, x = 6',points:1},
  {id:17,subject:'math_prof',examType:'ege',topic:'Вероятность',text:'Вероятность попадания 0.8. Вероятность промаха?',type:'input',correctAnswer:'0.2',explanation:'P = 1 - 0.8 = 0.2',points:1},
  {id:18,subject:'math_prof',examType:'ege',topic:'Геометрия',text:'Площадь прямоугольного треугольника с катетами 6 и 8',type:'input',correctAnswer:'24',explanation:'S = (6 × 8) / 2 = 24',points:1},
  {id:19,subject:'math_prof',examType:'ege',topic:'Неравенства',text:'Сколько целых решений у x² - 9 < 0?',type:'input',correctAnswer:'5',explanation:'-3 < x < 3, целые: -2,-1,0,1,2',points:1},
  {id:20,subject:'math_prof',examType:'ege',topic:'Логарифмы',text:'log₂ 32 = ?',type:'input',correctAnswer:'5',explanation:'2⁵ = 32',points:1},
  {id:21,subject:'math_prof',examType:'ege',topic:'Тригонометрия',text:'sin 30° = ? (десятичная дробь)',type:'input',correctAnswer:'0.5',explanation:'sin 30° = 0.5',points:1},
  {id:22,subject:'math_prof',examType:'ege',topic:'Производная',text:'f(x) = 3x² + 2x - 1. Найдите f\'(2)',type:'input',correctAnswer:'14',explanation:'f\'(x) = 6x + 2, f\'(2) = 14',points:1},
  {id:23,subject:'math_prof',examType:'ege',topic:'Вычисления',text:'√144 + √25 = ?',type:'input',correctAnswer:'17',explanation:'12 + 5 = 17',points:1},
  {id:24,subject:'math_prof',examType:'ege',topic:'Функции',text:'Через точку (0; 1) проходит',type:'single',options:['y = x²','y = x² + 1','y = x² - 1','y = 2x²'],correctAnswer:'y = x² + 1',explanation:'x=0: y = 0+1 = 1',points:1},
  {id:25,subject:'math_prof',examType:'ege',topic:'Прогрессии',text:'a₁ = 3, d = 4. Найдите a₅',type:'input',correctAnswer:'19',explanation:'a₅ = 3 + 4×4 = 19',points:1},
  {id:26,subject:'math_prof',examType:'ege',topic:'Уравнения',text:'|x - 3| = 5. Больший корень?',type:'input',correctAnswer:'8',explanation:'x = 8 или x = -2',points:1},
  {id:27,subject:'math_prof',examType:'ege',topic:'Геометрия',text:'Площадь круга r=3 равна Nπ. N = ?',type:'input',correctAnswer:'9',explanation:'S = πr² = 9π',points:1},
  {id:28,subject:'math_prof',examType:'ege',topic:'Неравенства',text:'Сколько целых решений у |x| ≤ 4?',type:'input',correctAnswer:'9',explanation:'-4..4, всего 9',points:1},
  {id:29,subject:'math_prof',examType:'ege',topic:'Функции',text:'Наибольшее значение y = -x² + 6x - 5',type:'input',correctAnswer:'4',explanation:'y = -(x-3)² + 4, max = 4',points:1},
  {id:30,subject:'math_prof',examType:'ege',topic:'Тригонометрия',text:'Период y = sin(2x) равен Nπ. N = ?',type:'input',correctAnswer:'1',explanation:'T = 2π/2 = π',points:1},
  {id:31,subject:'social',examType:'ege',topic:'Право',text:'Политическое право гражданина РФ?',type:'single',options:['право на труд','право на образование','право избирать и быть избранным','право на жилище'],correctAnswer:'право избирать и быть избранным',explanation:'Избирательное право — политическое',points:1},
  {id:32,subject:'social',examType:'ege',topic:'Экономика',text:'Признак рыночной экономики?',type:'single',options:['госпланирование','конкуренция производителей','фиксированные цены','отсутствие частной собственности'],correctAnswer:'конкуренция производителей',explanation:'Конкуренция — главный признак рынка',points:1},
  {id:33,subject:'social',examType:'ege',topic:'Политика',text:'Деятельность парламента — какая сфера?',type:'single',options:['экономическая','социальная','политическая','духовная'],correctAnswer:'политическая',explanation:'Парламент — политическая сфера',points:1},
  {id:34,subject:'social',examType:'ege',topic:'Социальная сфера',text:'Пример социальной мобильности?',type:'single',options:['покупка авто','получение высшего образования','поездка за границу','чтение книг'],correctAnswer:'получение высшего образования',explanation:'Образование — социальный лифт',points:1},
  {id:35,subject:'social',examType:'ege',topic:'Право',text:'Верховенство закона — признак',type:'single',options:['тоталитарного государства','авторитарного','правового государства','любого государства'],correctAnswer:'правового государства',explanation:'Признак правового государства',points:1},
  {id:36,subject:'social',examType:'ege',topic:'Экономика',text:'Инфляция — это',type:'single',options:['снижение цен','рост безработицы','устойчивое повышение общего уровня цен','рост курса валюты'],correctAnswer:'устойчивое повышение общего уровня цен',explanation:'Инфляция — обесценивание денег',points:1},
  {id:37,subject:'social',examType:'ege',topic:'Социальная сфера',text:'Малая социальная группа?',type:'single',options:['нация','класс','семья','народ'],correctAnswer:'семья',explanation:'Семья — малая группа',points:1},
  {id:38,subject:'social',examType:'ege',topic:'Политика',text:'Форма правления с выборным главой',type:'single',options:['монархия','республика','автократия','олигархия'],correctAnswer:'республика',explanation:'Республика — выборный глава',points:1},
  {id:39,subject:'social',examType:'ege',topic:'Экономика',text:'Верные суждения о налогах',type:'multiple',options:['НДС — прямой налог','Налог на прибыль — прямой','Акциз — косвенный','НДФЛ — косвенный'],correctAnswer:['Налог на прибыль — прямой','Акциз — косвенный'],explanation:'Прямые: на прибыль, НДФЛ. Косвенные: НДС, акцизы',points:2},
  {id:40,subject:'social',examType:'ege',topic:'Право',text:'Конституция РФ принята в',type:'single',options:['1991','1993','1995','2000'],correctAnswer:'1993',explanation:'12 декабря 1993',points:1},
  {id:41,subject:'social',examType:'ege',topic:'Политика',text:'Функция государства',type:'single',options:['получение прибыли','защита прав граждан','конкуренция с бизнесом','продажа товаров'],correctAnswer:'защита прав граждан',explanation:'Защита прав — основная функция',points:1},
  {id:42,subject:'social',examType:'ege',topic:'Политика',text:'Разделение властей — принцип',type:'single',options:['монархии','федерализма','демократического государства','унитарного государства'],correctAnswer:'демократического государства',explanation:'Принцип демократии',points:1},
  {id:43,subject:'history',examType:'ege',topic:'Древняя Русь',text:'Крещение Руси произошло в',type:'single',options:['882 году','988 году','1054 году','1147 году'],correctAnswer:'988 году',explanation:'988 год, князь Владимир',points:1},
  {id:44,subject:'history',examType:'ege',topic:'XIX век',text:'Бородинское сражение',type:'single',options:['1805','1812','1814','1825'],correctAnswer:'1812',explanation:'7 сентября 1812',points:1},
  {id:45,subject:'history',examType:'ege',topic:'XX век',text:'Первый президент России',type:'single',options:['Горбачёв','Ельцин','Путин','Медведев'],correctAnswer:'Ельцин',explanation:'Б.Н. Ельцин, 1991-1999',points:1},
  {id:46,subject:'history',examType:'ege',topic:'XIX век',text:'Отмена крепостного права',type:'single',options:['1825','1861','1905','1917'],correctAnswer:'1861',explanation:'Манифест 1861',points:1},
  {id:47,subject:'history',examType:'ege',topic:'Средневековье',text:'Куликовская битва',type:'single',options:['1240','1380','1480','1547'],correctAnswer:'1380',explanation:'1380, Дмитрий Донской',points:1},
  {id:48,subject:'history',examType:'ege',topic:'XVIII век',text:'Масштабные реформы начала XVIII века',type:'single',options:['Иван Грозный','Пётр I','Екатерина II','Александр I'],correctAnswer:'Пётр I',explanation:'Пётр I — реформатор',points:1},
  {id:49,subject:'history',examType:'ege',topic:'XX век',text:'Образование СССР',type:'single',options:['1917','1922','1924','1936'],correctAnswer:'1922',explanation:'30 декабря 1922',points:1},
  {id:50,subject:'history',examType:'ege',topic:'XX век',text:'Великая Отечественная война',type:'single',options:['1939–1945','1941–1945','1941–1944','1940–1945'],correctAnswer:'1941–1945',explanation:'22 июня 1941 — 9 мая 1945',points:1},
  {id:51,subject:'history',examType:'ege',topic:'Средневековье',text:'Стояние на Угре (конец ига)',type:'single',options:['1380','1480','1552','1613'],correctAnswer:'1480',explanation:'1480 — конец ордынского ига',points:1},
  {id:52,subject:'history',examType:'ege',topic:'XIX век',text:'Декабристское восстание',type:'single',options:['1812','1825','1861','1881'],correctAnswer:'1825',explanation:'14 декабря 1825',points:1},
  {id:53,subject:'physics',examType:'ege',topic:'Механика',text:'72 км/ч в м/с',type:'input',correctAnswer:'20',explanation:'72 / 3.6 = 20',points:1},
  {id:54,subject:'physics',examType:'ege',topic:'Механика',text:'Масса 5 кг, ускорение 2 м/с². Сила (Н)?',type:'input',correctAnswer:'10',explanation:'F = ma = 10',points:1},
  {id:55,subject:'physics',examType:'ege',topic:'Механика',text:'Кинетическая энергия тела 2 кг при 3 м/с (Дж)?',type:'input',correctAnswer:'9',explanation:'Ek = mv²/2 = 9',points:1},
  {id:56,subject:'physics',examType:'ege',topic:'Механика',text:'F = -kx — какой закон?',type:'single',options:['Закон Ньютона','Закон Гука','Закон Ома','Закон Кулона'],correctAnswer:'Закон Гука',explanation:'Закон Гука: сила упругости',points:1},
  {id:57,subject:'physics',examType:'ege',topic:'Электричество',text:'R=10 Ом, U=20 В. Ток (А)?',type:'input',correctAnswer:'2',explanation:'I = U/R = 2',points:1},
  {id:58,subject:'physics',examType:'ege',topic:'Механика',text:'Работа силы 10 Н на 5 м (Дж)?',type:'input',correctAnswer:'50',explanation:'A = Fs = 50',points:1},
  {id:59,subject:'physics',examType:'ege',topic:'Электричество',text:'Единица электрического заряда',type:'single',options:['Вольт','Ампер','Кулон','Ом'],correctAnswer:'Кулон',explanation:'Кулон — единица заряда',points:1},
  {id:60,subject:'physics',examType:'ege',topic:'Колебания',text:'Период 0.5 с. Частота (Гц)?',type:'input',correctAnswer:'2',explanation:'ν = 1/T = 2',points:1},
  {id:61,subject:'physics',examType:'ege',topic:'Оптика',text:'Какое явление объясняет радугу?',type:'single',options:['дифракция','интерференция','дисперсия','поляризация'],correctAnswer:'дисперсия',explanation:'Дисперсия — разложение света',points:1},
  {id:62,subject:'physics',examType:'ege',topic:'Механика',text:'Тело вверх 20 м/с. Через сколько остановится (g=10)?',type:'input',correctAnswer:'2',explanation:'t = v/g = 2',points:1},
  {id:63,subject:'informatics',examType:'ege',topic:'Системы счисления',text:'1011₂ в десятичной = ?',type:'input',correctAnswer:'11',explanation:'8+0+2+1 = 11',points:1},
  {id:64,subject:'informatics',examType:'ege',topic:'Системы счисления',text:'15₁₀ в двоичной = ?',type:'input',correctAnswer:'1111',explanation:'15 = 8+4+2+1',points:1},
  {id:65,subject:'informatics',examType:'ege',topic:'Логика',text:'1 AND 0 OR 1 = ?',type:'single',options:['0','1'],correctAnswer:'1',explanation:'(1 AND 0) OR 1 = 1',points:1},
  {id:66,subject:'informatics',examType:'ege',topic:'Информация',text:'Сколько бит в 3 байтах?',type:'input',correctAnswer:'24',explanation:'3 × 8 = 24',points:1},
  {id:67,subject:'informatics',examType:'ege',topic:'Программирование',text:'print(10 // 3) выведет?',type:'single',options:['3.33','3','3.0','4'],correctAnswer:'3',explanation:'// — целочисленное деление',points:1},
  {id:68,subject:'informatics',examType:'ege',topic:'Программирование',text:'print(2 ** 10) = ?',type:'input',correctAnswer:'1024',explanation:'2¹⁰ = 1024',points:1},
  {id:69,subject:'informatics',examType:'ege',topic:'Алгоритмы',text:'FIFO — принцип работы',type:'single',options:['стека','очереди','дерева','графа'],correctAnswer:'очереди',explanation:'FIFO — очередь',points:1},
  {id:70,subject:'informatics',examType:'ege',topic:'Информация',text:'4 стр × 30 строк × 60 символов (1 байт). Кбайт (округлить)?',type:'input',correctAnswer:'7',explanation:'7200 байт ≈ 7 Кбайт',points:1},
  {id:71,subject:'informatics',examType:'ege',topic:'Информация',text:'Формат web-страниц?',type:'single',options:['DOC','HTML','PDF','EXE'],correctAnswer:'HTML',explanation:'HTML — язык веб',points:1},
  {id:72,subject:'informatics',examType:'ege',topic:'Программирование',text:"len('Hello World') = ?",type:'input',correctAnswer:'11',explanation:'11 символов с пробелом',points:1},
  {id:73,subject:'ru',examType:'oge',topic:'Орфография',text:'Приставка перед глухой — С',type:'single',options:['разбить','рассказать','развести','разделить'],correctAnswer:'рассказать',explanation:'рас- перед глухой С',points:1},
  {id:74,subject:'ru',examType:'oge',topic:'Орфография',text:'Суффикс -ова-/-ева- в глаголах',type:'single',options:['танцевать','горевать','ночевать','воевать'],correctAnswer:'танцевать',explanation:'Танцую → танцевать',points:1},
  {id:75,subject:'ru',examType:'oge',topic:'Синтаксис',text:'Основа: «Осень — прекрасная пора»',type:'single',options:['осень прекрасная','осень пора','прекрасная пора','всё предложение'],correctAnswer:'осень пора',explanation:'Подлежащее «осень», сказуемое «пора»',points:1},
  {id:76,subject:'ru',examType:'oge',topic:'Пунктуация',text:'Где обращение?',type:'single',options:['Мама пришла с работы','Мама, приходи скорее','Маму ждали дети','О маме заботились'],correctAnswer:'Мама, приходи скорее',explanation:'Мама — обращение',points:1},
  {id:77,subject:'ru',examType:'oge',topic:'Синтаксис',text:'Простое предложение?',type:'single',options:['Солнце встало, и птицы запели','Когда пришла весна, снег растаял','Ветер усилился','Я знаю, что он придёт'],correctAnswer:'Ветер усилился',explanation:'Одна основа = простое',points:1},
  {id:78,subject:'ru',examType:'oge',topic:'Орфография',text:'Где пишется Ъ?',type:'single',options:['в..юга','об..ём','руж..ё','в..ётся'],correctAnswer:'об..ём',explanation:'Ъ после приставки перед Е: объём',points:1},
  {id:79,subject:'ru',examType:'oge',topic:'Орфография',text:'Чередующаяся гласная в корне',type:'single',options:['загорать','городской','горький','огородный'],correctAnswer:'загорать',explanation:'ГОР/ГАР — чередование',points:1},
  {id:80,subject:'ru',examType:'oge',topic:'Синтаксис',text:'Сложноподчинённое предложение?',type:'single',options:['Весна пришла, и снег растаял','Весна пришла, потому что наступил март','Весна пришла — снег растаял','Весна пришла, снег растаял'],correctAnswer:'Весна пришла, потому что наступил март',explanation:'«Потому что» — подчинительный союз',points:1},
  {id:81,subject:'ru',examType:'oge',topic:'Синтаксис',text:'Безличное предложение?',type:'single',options:['Вечереет','Студенты учатся','Мне нравится музыка','Тишина'],correctAnswer:'Вечереет',explanation:'Безличный глагол',points:1},
  {id:82,subject:'ru',examType:'oge',topic:'Орфография',text:'Где НН?',type:'single',options:['ветре..ый','серебря..ый','стекля..ый','кожа..ый'],correctAnswer:'стекля..ый',explanation:'Стеклянный — исключение',points:1},
  {id:83,subject:'math',examType:'oge',topic:'Вычисления',text:'(-3)² + 4 = ?',type:'input',correctAnswer:'13',explanation:'9 + 4 = 13',points:1},
  {id:84,subject:'math',examType:'oge',topic:'Уравнения',text:'3x - 7 = 8. x = ?',type:'input',correctAnswer:'5',explanation:'3x = 15, x = 5',points:1},
  {id:85,subject:'math',examType:'oge',topic:'Геометрия',text:'Площадь прямоугольника 5 × 12',type:'input',correctAnswer:'60',explanation:'5 × 12 = 60',points:1},
  {id:86,subject:'math',examType:'oge',topic:'Алгебра',text:'2(a+3) - 4a при a = 2',type:'input',correctAnswer:'2',explanation:'-2a + 6, при a=2: 2',points:1},
  {id:87,subject:'math',examType:'oge',topic:'Числа',text:'Рациональное число?',type:'single',options:['√2','π','1/3','√5'],correctAnswer:'1/3',explanation:'1/3 — рациональное',points:1},
  {id:88,subject:'math',examType:'oge',topic:'Геометрия',text:'Гипотенуза при катетах 3 и 4',type:'input',correctAnswer:'5',explanation:'√(9+16) = 5',points:1},
  {id:89,subject:'math',examType:'oge',topic:'Проценты',text:'30% от 200',type:'input',correctAnswer:'60',explanation:'200 × 0.3 = 60',points:1},
  {id:90,subject:'math',examType:'oge',topic:'Прогрессии',text:'2, 5, 8, 11, ... 10-й член?',type:'input',correctAnswer:'29',explanation:'a₁₀ = 2 + 9×3 = 29',points:1},
  {id:91,subject:'math',examType:'oge',topic:'Функции',text:'y = 2x + 1 проходит через',type:'single',options:['(0, 0)','(0, 1)','(1, 0)','(-1, 1)'],correctAnswer:'(0, 1)',explanation:'x=0: y=1',points:1},
  {id:92,subject:'math',examType:'oge',topic:'Уравнения',text:'x + y = 10, x - y = 4. x = ?',type:'input',correctAnswer:'7',explanation:'2x = 14, x = 7',points:1},
  {id:93,subject:'social',examType:'oge',topic:'Право',text:'Полная дееспособность с',type:'single',options:['14 лет','16 лет','18 лет','21 года'],correctAnswer:'18 лет',explanation:'С 18 лет',points:1},
  {id:94,subject:'social',examType:'oge',topic:'Экономика',text:'Пример предпринимательства',type:'single',options:['работа учителем','открытие кафе','получение пенсии','оплата налогов'],correctAnswer:'открытие кафе',explanation:'Самостоятельная деятельность для прибыли',points:1},
  {id:95,subject:'social',examType:'oge',topic:'Право',text:'Высшая юридическая сила в РФ',type:'single',options:['Федеральный закон','Указ Президента','Конституция РФ','Постановление'],correctAnswer:'Конституция РФ',explanation:'Конституция — высшая сила',points:1},
  {id:96,subject:'social',examType:'oge',topic:'Право',text:'Обязанность гражданина РФ',type:'single',options:['участие в выборах','получение образования','защита Отечества','членство в партии'],correctAnswer:'защита Отечества',explanation:'Ст. 59 Конституции',points:1},
  {id:97,subject:'social',examType:'oge',topic:'Экономика',text:'ВВП — это',type:'single',options:['валовый внутренний продукт','валовый внешний продукт','великий внутренний продукт','второстепенный показатель'],correctAnswer:'валовый внутренний продукт',explanation:'Стоимость всех товаров за год',points:1},
  {id:98,subject:'social',examType:'oge',topic:'Политика',text:'Президент РФ избирается на',type:'single',options:['4 года','5 лет','6 лет','7 лет'],correctAnswer:'6 лет',explanation:'На 6 лет',points:1},
  {id:99,subject:'social',examType:'oge',topic:'Социальная сфера',text:'Правила этикета — это',type:'single',options:['правовые нормы','моральные','обычаи','корпоративные'],correctAnswer:'обычаи',explanation:'Этикет — обычаи',points:1},
  {id:100,subject:'social',examType:'oge',topic:'Политика',text:'Признак государства',type:'single',options:['армия','территория','суверенитет','всё перечисленное'],correctAnswer:'всё перечисленное',explanation:'Все — признаки государства',points:1},
  {id:101,subject:'social',examType:'oge',topic:'Социальная сфера',text:'Семья — это',type:'single',options:['большая группа','малая группа','политическая организация','экономический институт'],correctAnswer:'малая группа',explanation:'Малая группа',points:1},
  {id:102,subject:'social',examType:'oge',topic:'Экономика',text:'Безработица при смене работы',type:'single',options:['структурная','циклическая','фрикционная','сезонная'],correctAnswer:'фрикционная',explanation:'Фрикционная — временная',points:1},
];

interface SubjectInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const EGE_SUBJECTS: SubjectInfo[] = [
  {id:'ru',name:'Русский язык',icon:'📝',color:'from-blue-500 to-indigo-600'},
  {id:'math_base',name:'Математика (база)',icon:'🔢',color:'from-purple-500 to-violet-600'},
  {id:'math_prof',name:'Математика (профиль)',icon:'📐',color:'from-purple-600 to-pink-500'},
  {id:'physics',name:'Физика',icon:'⚛️',color:'from-sky-500 to-blue-600'},
  {id:'chemistry',name:'Химия',icon:'🧪',color:'from-green-500 to-teal-500'},
  {id:'biology',name:'Биология',icon:'🌿',color:'from-emerald-500 to-green-600'},
  {id:'history',name:'История',icon:'🏛️',color:'from-amber-500 to-orange-500'},
  {id:'social',name:'Обществознание',icon:'🌍',color:'from-orange-500 to-red-500'},
  {id:'informatics',name:'Информатика',icon:'💻',color:'from-cyan-500 to-blue-500'},
  {id:'english',name:'Английский язык',icon:'🇬🇧',color:'from-red-500 to-rose-500'},
  {id:'geography',name:'География',icon:'🗺️',color:'from-teal-500 to-cyan-500'},
  {id:'literature',name:'Литература',icon:'📖',color:'from-pink-500 to-rose-500'},
];

const OGE_SUBJECTS: SubjectInfo[] = [
  {id:'ru',name:'Русский язык',icon:'📝',color:'from-blue-500 to-indigo-600'},
  {id:'math',name:'Математика',icon:'🔢',color:'from-purple-500 to-violet-600'},
  {id:'physics',name:'Физика',icon:'⚛️',color:'from-sky-500 to-blue-600'},
  {id:'chemistry',name:'Химия',icon:'🧪',color:'from-green-500 to-teal-500'},
  {id:'biology',name:'Биология',icon:'🌿',color:'from-emerald-500 to-green-600'},
  {id:'history',name:'История',icon:'🏛️',color:'from-amber-500 to-orange-500'},
  {id:'social',name:'Обществознание',icon:'🌍',color:'from-orange-500 to-red-500'},
  {id:'informatics',name:'Информатика',icon:'💻',color:'from-cyan-500 to-blue-500'},
  {id:'english',name:'Английский язык',icon:'🇬🇧',color:'from-red-500 to-rose-500'},
  {id:'geography',name:'География',icon:'🗺️',color:'from-teal-500 to-cyan-500'},
  {id:'literature',name:'Литература',icon:'📖',color:'from-pink-500 to-rose-500'},
];

const EXAM_TIMES: Record<string, Record<string, number>> = {
  ege: {ru:210,math_base:180,math_prof:235,physics:235,chemistry:210,biology:210,history:210,social:210,informatics:235,english:190,geography:180,literature:235},
  oge: {ru:180,math:235,physics:180,chemistry:180,biology:180,history:180,social:180,informatics:180,english:180,geography:180,literature:180},
};

const PASS_THRESHOLDS: Record<string, Record<string, number>> = {
  ege: {ru:24,math_base:7,math_prof:27,physics:36,chemistry:36,biology:36,history:32,social:42,informatics:40,english:22,geography:37,literature:32},
  oge: {ru:15,math:8,physics:11,chemistry:10,biology:13,history:10,social:14,informatics:5,english:29,geography:12,literature:14},
};

type Screen = 'select' | 'mode' | 'test' | 'results';
type TestMode = 'full' | 'express' | 'topics';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

export default function MockExam() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('select');
  const [examType, setExamType] = useState<'ege' | 'oge'>('ege');
  const [selectedSubject, setSelectedSubject] = useState<SubjectInfo | null>(null);
  const [testMode, setTestMode] = useState<TestMode>('full');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [results, setResults] = useState<{score:number;max:number;correct:number;wrong:number;skipped:number;timeSpent:number} | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef<() => void>();

  const subjects = examType === 'ege' ? EGE_SUBJECTS : OGE_SUBJECTS;

  const getSubjectQuestions = useCallback((subId: string, et: 'ege' | 'oge') => {
    return QUESTIONS.filter(q => q.subject === subId && q.examType === et);
  }, []);

  const getTopics = useCallback((subId: string, et: 'ege' | 'oge') => {
    const qs = getSubjectQuestions(subId, et);
    return [...new Set(qs.map(q => q.topic))];
  }, [getSubjectQuestions]);

  const startTest = useCallback((mode: TestMode, topic?: string) => {
    if (!selectedSubject) return;
    let qs = getSubjectQuestions(selectedSubject.id, examType);
    if (mode === 'topics' && topic) {
      qs = qs.filter(q => q.topic === topic);
    }
    if (mode === 'express') {
      qs = shuffle(qs).slice(0, 10);
    } else {
      qs = shuffle(qs);
    }
    if (qs.length === 0) return;

    const minutes = mode === 'express' ? 20 : (EXAM_TIMES[examType]?.[selectedSubject.id] ?? 180);
    setQuestions(qs);
    setCurrentIdx(0);
    setAnswers({});
    setTimeLeft(minutes * 60);
    setStartTime(Date.now());
    setResults(null);
    setShowNav(false);
    setShowConfirm(false);
    setScreen('test');
  }, [selectedSubject, examType, getSubjectQuestions]);

  const calculateResults = useCallback(() => {
    let score = 0;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const max = questions.reduce((s, q) => s + q.points, 0);

    questions.forEach(q => {
      const ans = answers[q.id];
      if (!ans || (Array.isArray(ans) && ans.length === 0)) {
        skipped++;
        return;
      }
      let isCorrect = false;
      if (q.type === 'multiple') {
        const ca = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
        const ua = Array.isArray(ans) ? ans : [ans];
        isCorrect = ca.length === ua.length && ca.every(a => ua.includes(a));
      } else if (q.type === 'input') {
        const ca = (typeof q.correctAnswer === 'string' ? q.correctAnswer : q.correctAnswer[0]).trim().toLowerCase();
        const ua = (typeof ans === 'string' ? ans : ans[0]).trim().toLowerCase();
        isCorrect = ua === ca;
      } else {
        isCorrect = ans === q.correctAnswer;
      }
      if (isCorrect) { score += q.points; correct++; } else { wrong++; }
    });

    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    setResults({score, max, correct, wrong, skipped, timeSpent});
    setScreen('results');
    if (timerRef.current) clearInterval(timerRef.current);
  }, [questions, answers, startTime]);

  autoSubmitRef.current = calculateResults;

  useEffect(() => {
    if (screen !== 'test') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          autoSubmitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen]);

  const currentQ = questions[currentIdx];

  const setAnswer = (val: string | string[]) => {
    setAnswers(prev => ({...prev, [currentQ.id]: val}));
  };

  const toggleMultiple = (option: string) => {
    const current = (answers[currentQ.id] as string[]) || [];
    if (current.includes(option)) {
      setAnswer(current.filter(o => o !== option));
    } else {
      setAnswer([...current, option]);
    }
  };

  if (screen === 'select') {
    return (
      <div className="min-h-[100dvh] bg-gray-50 pb-nav">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 px-5 pt-14 pb-8">
          <button onClick={() => navigate('/exam')} className="text-white/60 mb-4 flex items-center gap-1 text-sm">
            <Icon name="ArrowLeft" size={16} /> Подготовка к экзамену
          </button>
          <h1 className="text-white font-extrabold text-2xl mb-1">Пробный тест</h1>
          <p className="text-white/60 text-sm">Реальные задания с таймером и подсчётом баллов</p>
        </div>

        <div className="px-5 -mt-4">
          <div className="bg-white rounded-2xl p-1 flex mb-5 shadow-sm">
            {(['ege','oge'] as const).map(et => (
              <button
                key={et}
                onClick={() => { setExamType(et); setSelectedSubject(null); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${examType === et ? 'bg-indigo-600 text-white shadow' : 'text-gray-500'}`}
              >
                {et.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {subjects.map(sub => {
              const count = getSubjectQuestions(sub.id, examType).length;
              const time = EXAM_TIMES[examType]?.[sub.id] ?? 180;
              const selected = selectedSubject?.id === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => count > 0 && setSelectedSubject(sub)}
                  disabled={count === 0}
                  className={`bg-white rounded-2xl p-4 text-left transition-all ${selected ? 'ring-2 ring-indigo-500 shadow-lg' : 'shadow-sm'} ${count === 0 ? 'opacity-50' : 'active:scale-[0.97]'}`}
                >
                  <span className="text-2xl">{sub.icon}</span>
                  <p className="font-bold text-gray-800 text-sm mt-2 leading-tight">{sub.name}</p>
                  {count > 0 ? (
                    <p className="text-gray-400 text-xs mt-1">{count} заданий · {Math.floor(time / 60)}ч {time % 60}м</p>
                  ) : (
                    <Badge variant="secondary" className="mt-1 text-[10px]">Скоро</Badge>
                  )}
                </button>
              );
            })}
          </div>

          {selectedSubject && getSubjectQuestions(selectedSubject.id, examType).length > 0 && (
            <Button
              onClick={() => { setTestMode('full'); setScreen('mode'); }}
              className="w-full mt-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-6 text-base font-bold"
            >
              Начать пробный тест
            </Button>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  if (screen === 'mode') {
    const topics = selectedSubject ? getTopics(selectedSubject.id, examType) : [];
    const qCount = selectedSubject ? getSubjectQuestions(selectedSubject.id, examType).length : 0;
    const time = selectedSubject ? (EXAM_TIMES[examType]?.[selectedSubject.id] ?? 180) : 180;

    return (
      <div className="min-h-[100dvh] bg-gray-50 px-5 pt-14 pb-nav">
        <button onClick={() => setScreen('select')} className="text-gray-400 mb-6 flex items-center gap-1 text-sm">
          <Icon name="ArrowLeft" size={16} /> Назад
        </button>
        <h2 className="font-extrabold text-xl text-gray-800 mb-1">{selectedSubject?.icon} {selectedSubject?.name}</h2>
        <p className="text-gray-400 text-sm mb-6">Выберите режим</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => startTest('full')}
            className="bg-white rounded-2xl p-5 text-left shadow-sm active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                <Icon name="FileText" size={22} className="text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">Полный вариант</p>
                <p className="text-gray-400 text-xs">{qCount} заданий · {Math.floor(time / 60)}ч {time % 60}м</p>
              </div>
              <Icon name="ChevronRight" size={18} className="text-gray-300" />
            </div>
          </button>

          <button
            onClick={() => startTest('express')}
            className="bg-white rounded-2xl p-5 text-left shadow-sm active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                <Icon name="Zap" size={22} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">Экспресс</p>
                <p className="text-gray-400 text-xs">10 случайных заданий · 20 мин</p>
              </div>
              <Icon name="ChevronRight" size={18} className="text-gray-300" />
            </div>
          </button>

          {topics.length > 1 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                  <Icon name="Tag" size={22} className="text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">По темам</p>
                  <p className="text-gray-400 text-xs">Выберите тему</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {topics.map(topic => {
                  const topicCount = getSubjectQuestions(selectedSubject!.id, examType).filter(q => q.topic === topic).length;
                  return (
                    <button
                      key={topic}
                      onClick={() => { setSelectedTopic(topic); startTest('topics', topic); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedTopic === topic ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {topic} ({topicCount})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  if (screen === 'test' && currentQ) {
    const answered = Object.keys(answers).filter(k => {
      const v = answers[Number(k)];
      return v && (!Array.isArray(v) || v.length > 0);
    }).length;
    const progress = ((currentIdx + 1) / questions.length) * 100;
    const isLowTime = timeLeft < 300;

    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button onClick={() => setShowConfirm(true)} className="text-gray-400">
            <Icon name="X" size={20} />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-medium">Вопрос {currentIdx + 1} из {questions.length}</p>
            <Progress value={progress} className="h-1.5 mt-1" />
          </div>
          <div className={`font-mono font-bold text-sm px-3 py-1 rounded-lg ${isLowTime ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="flex-1 px-5 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className="text-xs">{currentQ.topic}</Badge>
            <Badge variant="outline" className="text-xs">{currentQ.points} {currentQ.points > 1 ? 'балла' : 'балл'}</Badge>
          </div>

          <p className="text-gray-800 font-semibold text-base leading-relaxed mb-6">{currentQ.text}</p>

          {currentQ.type === 'single' && currentQ.options && (
            <div className="flex flex-col gap-2.5">
              {currentQ.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => setAnswer(opt)}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all text-sm ${answers[currentQ.id] === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === 'multiple' && currentQ.options && (
            <div className="flex flex-col gap-2.5">
              {currentQ.options.map(opt => {
                const checked = ((answers[currentQ.id] as string[]) || []).includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleMultiple(opt)}
                    className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all text-sm flex items-center gap-3 ${checked ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
                      {checked && <Icon name="Check" size={12} className="text-white" />}
                    </div>
                    {opt}
                  </button>
                );
              })}
              <p className="text-gray-400 text-xs">Выберите все правильные варианты</p>
            </div>
          )}

          {currentQ.type === 'input' && (
            <Input
              value={(answers[currentQ.id] as string) || ''}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Введите ответ"
              className="text-base py-6 rounded-2xl"
            />
          )}
        </div>

        <div className="px-5 pb-5 flex flex-col gap-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(i => i - 1)}
              className="flex-1 rounded-xl"
            >
              <Icon name="ChevronLeft" size={16} /> Назад
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowNav(!showNav)}
              className="rounded-xl px-3"
            >
              <Icon name="Grid3x3" size={16} />
            </Button>
            {currentIdx < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentIdx(i => i + 1)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-xl"
              >
                Далее <Icon name="ChevronRight" size={16} />
              </Button>
            ) : (
              <Button
                onClick={() => setShowConfirm(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl"
              >
                Завершить
              </Button>
            )}
          </div>

          {showNav && (
            <div className="bg-white rounded-2xl p-4 border shadow-sm">
              <p className="text-xs text-gray-400 mb-2 font-medium">Навигация ({answered}/{questions.length} отвечено)</p>
              <div className="grid grid-cols-10 gap-1.5">
                {questions.map((q, i) => {
                  const hasAnswer = answers[q.id] && (!Array.isArray(answers[q.id]) || (answers[q.id] as string[]).length > 0);
                  return (
                    <button
                      key={q.id}
                      onClick={() => { setCurrentIdx(i); setShowNav(false); }}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === currentIdx ? 'bg-indigo-600 text-white' : hasAnswer ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-5">
            <Card className="w-full max-w-sm rounded-3xl">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="AlertTriangle" size={24} className="text-amber-600" />
                </div>
                <h3 className="font-bold text-lg text-gray-800 mb-2">Завершить тест?</h3>
                <p className="text-gray-500 text-sm mb-1">Отвечено: {answered} из {questions.length}</p>
                {questions.length - answered > 0 && (
                  <p className="text-amber-600 text-sm font-medium mb-4">Без ответа: {questions.length - answered}</p>
                )}
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1 rounded-xl">Вернуться</Button>
                  <Button onClick={calculateResults} className="flex-1 bg-indigo-600 rounded-xl">Завершить</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'results' && results) {
    const pct = results.max > 0 ? Math.round((results.score / results.max) * 100) : 0;
    const threshold = selectedSubject ? (PASS_THRESHOLDS[examType]?.[selectedSubject.id] ?? 0) : 0;
    const passed = results.score >= threshold;
    const pctColor = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-600';
    const barColor = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';

    return (
      <div className="min-h-[100dvh] bg-gray-50 pb-nav">
        {passed && (
          <div className="fixed inset-0 pointer-events-none z-50 flex items-start justify-center">
            <div className="text-6xl animate-bounce mt-20">🎉</div>
          </div>
        )}

        <div className={`px-5 pt-14 pb-8 ${passed ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-gray-600 to-gray-700'}`}>
          <button onClick={() => setScreen('select')} className="text-white/60 mb-4 flex items-center gap-1 text-sm">
            <Icon name="ArrowLeft" size={16} /> К выбору предмета
          </button>
          <h1 className="text-white font-extrabold text-2xl mb-2">{passed ? 'Тест пройден!' : 'Результаты теста'}</h1>
          <div className="flex items-end gap-3">
            <span className={`text-5xl font-black text-white`}>{results.score}</span>
            <span className="text-white/60 text-lg mb-1">/ {results.max} баллов</span>
          </div>
        </div>

        <div className="px-5 -mt-4 space-y-4">
          <Card className="rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-3xl font-black ${pctColor}`}>{pct}%</span>
                {passed ? (
                  <Badge className="bg-green-100 text-green-700">Порог пройден ✅</Badge>
                ) : (
                  <Badge variant="destructive">Ниже порога ❌</Badge>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className={`h-3 rounded-full ${barColor} transition-all`} style={{width: `${pct}%`}} />
              </div>
              <p className="text-gray-400 text-xs mt-2">Порог: {threshold} баллов</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <Card className="rounded-2xl">
              <CardContent className="p-3 text-center">
                <p className="text-green-600 font-black text-xl">{results.correct}</p>
                <p className="text-gray-400 text-xs">Верно</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-3 text-center">
                <p className="text-red-500 font-black text-xl">{results.wrong}</p>
                <p className="text-gray-400 text-xs">Ошибки</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-3 text-center">
                <p className="text-gray-400 font-black text-xl">{results.skipped}</p>
                <p className="text-gray-400 text-xs">Пропущено</p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon name="Clock" size={18} className="text-gray-400" />
              <span className="text-gray-600 text-sm">Время: {formatTime(results.timeSpent)}</span>
            </CardContent>
          </Card>

          {results.wrong > 0 && (
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Разбор ошибок</h3>
              <div className="space-y-2">
                {questions.map((q, i) => {
                  const ans = answers[q.id];
                  const noAnswer = !ans || (Array.isArray(ans) && ans.length === 0);
                  let isCorrect = false;
                  if (!noAnswer) {
                    if (q.type === 'multiple') {
                      const ca = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
                      const ua = Array.isArray(ans) ? ans : [ans];
                      isCorrect = ca.length === ua.length && ca.every(a => ua.includes(a));
                    } else if (q.type === 'input') {
                      isCorrect = (typeof ans === 'string' ? ans : ans[0]).trim().toLowerCase() === (typeof q.correctAnswer === 'string' ? q.correctAnswer : q.correctAnswer[0]).trim().toLowerCase();
                    } else {
                      isCorrect = ans === q.correctAnswer;
                    }
                  }
                  if (isCorrect) return null;
                  return (
                    <Card key={q.id} className="rounded-2xl border-l-4 border-l-red-400">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{q.topic}</Badge>
                        </div>
                        <p className="text-gray-700 text-sm mb-2">{q.text}</p>
                        {!noAnswer && (
                          <p className="text-red-500 text-xs mb-1">Твой ответ: {Array.isArray(ans) ? ans.join(', ') : ans}</p>
                        )}
                        <p className="text-green-600 text-xs font-medium mb-1">Правильно: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}</p>
                        <p className="text-gray-400 text-xs">{q.explanation}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2 pb-4">
            <Button onClick={() => { setAnswers({}); setCurrentIdx(0); setScreen('mode'); }} className="w-full bg-indigo-600 rounded-2xl py-5">
              Пройти заново
            </Button>
            <Button variant="outline" onClick={() => { setSelectedSubject(null); setScreen('select'); }} className="w-full rounded-2xl py-5">
              Другой предмет
            </Button>
            <Button variant="ghost" onClick={() => navigate('/calculator')} className="w-full rounded-2xl">
              <Icon name="Calculator" size={16} className="mr-2" /> Калькулятор баллов
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return null;
}
