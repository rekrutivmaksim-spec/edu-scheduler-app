import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';

interface Program {
  name: string;
  faculty: string;
  subjects: string[];
  passingScore: number;
  budgetPlaces: number;
  paidCostPerYear: number;
}

interface University {
  id: number;
  name: string;
  shortName: string;
  city: string;
  type: 'federal' | 'national_research' | 'state' | 'private';
  rating: number;
  logo: string;
  programs: Program[];
}

const SUBJECT_NAMES: Record<string, string> = {
  ru: 'Рус', math_prof: 'Мат', physics: 'Физ', chemistry: 'Хим', biology: 'Био',
  history: 'Ист', social: 'Общ', informatics: 'Инф', english: 'Англ', geography: 'Гео', literature: 'Лит',
};

const SUBJECT_OPTIONS = [
  {id:'ru',name:'Русский язык',icon:'📝'},
  {id:'math_prof',name:'Математика (профиль)',icon:'📐'},
  {id:'physics',name:'Физика',icon:'⚛️'},
  {id:'chemistry',name:'Химия',icon:'🧪'},
  {id:'biology',name:'Биология',icon:'🌿'},
  {id:'history',name:'История',icon:'🏛️'},
  {id:'social',name:'Обществознание',icon:'🌍'},
  {id:'informatics',name:'Информатика',icon:'💻'},
  {id:'english',name:'Английский язык',icon:'🇬🇧'},
  {id:'geography',name:'География',icon:'🗺️'},
  {id:'literature',name:'Литература',icon:'📖'},
];

const UNIVERSITIES: University[] = [
  {id:1,name:'Московский государственный университет им. М.В. Ломоносова',shortName:'МГУ',city:'Москва',type:'federal',rating:1,logo:'🏛️',programs:[
    {name:'Прикладная математика и информатика',faculty:'ВМК',subjects:['ru','math_prof','informatics'],passingScore:310,budgetPlaces:200,paidCostPerYear:450000},
    {name:'Экономика',faculty:'Экономический',subjects:['ru','math_prof','social'],passingScore:340,budgetPlaces:80,paidCostPerYear:530000},
    {name:'Юриспруденция',faculty:'Юридический',subjects:['ru','history','social'],passingScore:350,budgetPlaces:50,paidCostPerYear:500000},
    {name:'Журналистика',faculty:'Журналистики',subjects:['ru','literature','social'],passingScore:345,budgetPlaces:60,paidCostPerYear:480000},
    {name:'Физика',faculty:'Физический',subjects:['ru','math_prof','physics'],passingScore:290,budgetPlaces:300,paidCostPerYear:420000},
    {name:'Химия',faculty:'Химический',subjects:['ru','math_prof','chemistry'],passingScore:280,budgetPlaces:150,paidCostPerYear:400000},
    {name:'Биология',faculty:'Биологический',subjects:['ru','math_prof','biology'],passingScore:270,budgetPlaces:120,paidCostPerYear:400000},
    {name:'Филология',faculty:'Филологический',subjects:['ru','literature','english'],passingScore:330,budgetPlaces:100,paidCostPerYear:400000},
    {name:'Психология',faculty:'Психологии',subjects:['ru','math_prof','biology'],passingScore:310,budgetPlaces:60,paidCostPerYear:470000},
    {name:'Менеджмент',faculty:'Высшая школа бизнеса',subjects:['ru','math_prof','social'],passingScore:335,budgetPlaces:40,paidCostPerYear:550000},
  ]},
  {id:2,name:'МГТУ им. Н.Э. Баумана',shortName:'Бауманка',city:'Москва',type:'national_research',rating:4,logo:'⚙️',programs:[
    {name:'Информатика и ВТ',faculty:'ИУ',subjects:['ru','math_prof','physics'],passingScore:270,budgetPlaces:300,paidCostPerYear:350000},
    {name:'Программная инженерия',faculty:'ИУ',subjects:['ru','math_prof','informatics'],passingScore:280,budgetPlaces:150,paidCostPerYear:370000},
    {name:'Робототехника',faculty:'РК',subjects:['ru','math_prof','physics'],passingScore:260,budgetPlaces:80,paidCostPerYear:340000},
    {name:'Биомедицинская инженерия',faculty:'БМТ',subjects:['ru','math_prof','physics'],passingScore:250,budgetPlaces:60,paidCostPerYear:320000},
    {name:'Ракетные комплексы',faculty:'СМ',subjects:['ru','math_prof','physics'],passingScore:240,budgetPlaces:120,paidCostPerYear:300000},
    {name:'Машиностроение',faculty:'МТ',subjects:['ru','math_prof','physics'],passingScore:240,budgetPlaces:200,paidCostPerYear:300000},
  ]},
  {id:3,name:'НИУ Высшая школа экономики',shortName:'ВШЭ',city:'Москва',type:'national_research',rating:3,logo:'📊',programs:[
    {name:'Программная инженерия',faculty:'ФКН',subjects:['ru','math_prof','informatics'],passingScore:300,budgetPlaces:120,paidCostPerYear:590000},
    {name:'Экономика',faculty:'Экономики',subjects:['ru','math_prof','social'],passingScore:340,budgetPlaces:100,paidCostPerYear:560000},
    {name:'Юриспруденция',faculty:'Права',subjects:['ru','history','social'],passingScore:350,budgetPlaces:60,paidCostPerYear:530000},
    {name:'Менеджмент',faculty:'Бизнеса',subjects:['ru','math_prof','social'],passingScore:330,budgetPlaces:80,paidCostPerYear:550000},
    {name:'Дизайн',faculty:'Коммуникаций',subjects:['ru','literature','social'],passingScore:290,budgetPlaces:30,paidCostPerYear:500000},
    {name:'Международные отношения',faculty:'МО',subjects:['ru','history','english'],passingScore:355,budgetPlaces:40,paidCostPerYear:540000},
    {name:'Журналистика',faculty:'Коммуникаций',subjects:['ru','literature','social'],passingScore:325,budgetPlaces:50,paidCostPerYear:480000},
    {name:'Психология',faculty:'Социальных наук',subjects:['ru','math_prof','biology'],passingScore:300,budgetPlaces:50,paidCostPerYear:460000},
  ]},
  {id:4,name:'Московский физико-технический институт',shortName:'МФТИ',city:'Москва',type:'national_research',rating:2,logo:'🔬',programs:[
    {name:'Прикладная математика и физика',faculty:'ФПМИ',subjects:['ru','math_prof','physics'],passingScore:310,budgetPlaces:200,paidCostPerYear:400000},
    {name:'Компьютерные науки',faculty:'ФИВТ',subjects:['ru','math_prof','informatics'],passingScore:320,budgetPlaces:180,paidCostPerYear:420000},
    {name:'Биоинженерия',faculty:'ФБМФ',subjects:['ru','math_prof','biology'],passingScore:280,budgetPlaces:60,paidCostPerYear:380000},
    {name:'Аэрокосмические технологии',faculty:'ФАКИ',subjects:['ru','math_prof','physics'],passingScore:290,budgetPlaces:80,paidCostPerYear:380000},
  ]},
  {id:5,name:'МГИМО',shortName:'МГИМО',city:'Москва',type:'state',rating:5,logo:'🌐',programs:[
    {name:'Международные отношения',faculty:'МО',subjects:['ru','history','english'],passingScore:370,budgetPlaces:30,paidCostPerYear:650000},
    {name:'Юриспруденция',faculty:'МП',subjects:['ru','history','social'],passingScore:360,budgetPlaces:40,paidCostPerYear:600000},
    {name:'Экономика',faculty:'МЭО',subjects:['ru','math_prof','english'],passingScore:355,budgetPlaces:35,paidCostPerYear:620000},
    {name:'Журналистика',faculty:'МЖ',subjects:['ru','literature','english'],passingScore:345,budgetPlaces:25,paidCostPerYear:580000},
  ]},
  {id:6,name:'РЭУ им. Г.В. Плеханова',shortName:'Плехановка',city:'Москва',type:'state',rating:18,logo:'💼',programs:[
    {name:'Экономика',faculty:'Экономики',subjects:['ru','math_prof','social'],passingScore:260,budgetPlaces:100,paidCostPerYear:350000},
    {name:'Менеджмент',faculty:'Менеджмента',subjects:['ru','math_prof','social'],passingScore:250,budgetPlaces:80,paidCostPerYear:330000},
    {name:'Торговое дело',faculty:'Торговли',subjects:['ru','math_prof','social'],passingScore:230,budgetPlaces:60,paidCostPerYear:300000},
    {name:'IT и анализ данных',faculty:'ИТ',subjects:['ru','math_prof','informatics'],passingScore:260,budgetPlaces:70,paidCostPerYear:380000},
  ]},
  {id:7,name:'РУДН',shortName:'РУДН',city:'Москва',type:'state',rating:12,logo:'🌏',programs:[
    {name:'Лечебное дело',faculty:'Медицинский',subjects:['ru','biology','chemistry'],passingScore:265,budgetPlaces:80,paidCostPerYear:400000},
    {name:'Экономика',faculty:'Экономики',subjects:['ru','math_prof','social'],passingScore:240,budgetPlaces:60,paidCostPerYear:300000},
    {name:'Юриспруденция',faculty:'Права',subjects:['ru','history','social'],passingScore:250,budgetPlaces:50,paidCostPerYear:320000},
    {name:'Лингвистика',faculty:'Филологии',subjects:['ru','english','literature'],passingScore:260,budgetPlaces:40,paidCostPerYear:350000},
    {name:'IT',faculty:'ФНПМИ',subjects:['ru','math_prof','informatics'],passingScore:240,budgetPlaces:70,paidCostPerYear:330000},
  ]},
  {id:8,name:'НИТУ МИСиС',shortName:'МИСиС',city:'Москва',type:'national_research',rating:9,logo:'⚡',programs:[
    {name:'Информатика и ВТ',faculty:'ИТАСУ',subjects:['ru','math_prof','informatics'],passingScore:260,budgetPlaces:100,paidCostPerYear:350000},
    {name:'Материаловедение',faculty:'МНТ',subjects:['ru','math_prof','physics'],passingScore:240,budgetPlaces:80,paidCostPerYear:300000},
    {name:'Нанотехнологии',faculty:'ФНМ',subjects:['ru','math_prof','physics'],passingScore:250,budgetPlaces:50,paidCostPerYear:320000},
  ]},
  {id:9,name:'Финансовый университет при Правительстве РФ',shortName:'Финуниверситет',city:'Москва',type:'state',rating:10,logo:'💰',programs:[
    {name:'Экономика',faculty:'Экономики',subjects:['ru','math_prof','social'],passingScore:280,budgetPlaces:100,paidCostPerYear:400000},
    {name:'Финансы и кредит',faculty:'Финансов',subjects:['ru','math_prof','social'],passingScore:290,budgetPlaces:80,paidCostPerYear:420000},
    {name:'IT в финансах',faculty:'ИТ',subjects:['ru','math_prof','informatics'],passingScore:270,budgetPlaces:60,paidCostPerYear:400000},
    {name:'Юриспруденция',faculty:'Права',subjects:['ru','history','social'],passingScore:270,budgetPlaces:50,paidCostPerYear:380000},
  ]},
  {id:10,name:'МИРЭА — Российский технологический университет',shortName:'МИРЭА',city:'Москва',type:'state',rating:22,logo:'🖥️',programs:[
    {name:'Информатика и ВТ',faculty:'ИИТИАС',subjects:['ru','math_prof','informatics'],passingScore:240,budgetPlaces:250,paidCostPerYear:280000},
    {name:'Программная инженерия',faculty:'ИТ',subjects:['ru','math_prof','informatics'],passingScore:250,budgetPlaces:200,paidCostPerYear:300000},
    {name:'Кибербезопасность',faculty:'КБ',subjects:['ru','math_prof','informatics'],passingScore:255,budgetPlaces:100,paidCostPerYear:310000},
    {name:'Электроника',faculty:'ЭиН',subjects:['ru','math_prof','physics'],passingScore:220,budgetPlaces:150,paidCostPerYear:260000},
  ]},
  {id:11,name:'Санкт-Петербургский государственный университет',shortName:'СПбГУ',city:'Санкт-Петербург',type:'federal',rating:6,logo:'🏛️',programs:[
    {name:'Математика и компьютерные науки',faculty:'МатМех',subjects:['ru','math_prof','informatics'],passingScore:300,budgetPlaces:120,paidCostPerYear:400000},
    {name:'Юриспруденция',faculty:'Юридический',subjects:['ru','history','social'],passingScore:340,budgetPlaces:60,paidCostPerYear:480000},
    {name:'Экономика',faculty:'Экономический',subjects:['ru','math_prof','social'],passingScore:310,budgetPlaces:80,paidCostPerYear:420000},
    {name:'Медицина',faculty:'Медицинский',subjects:['ru','biology','chemistry'],passingScore:290,budgetPlaces:70,paidCostPerYear:450000},
    {name:'Филология',faculty:'Филологический',subjects:['ru','literature','english'],passingScore:300,budgetPlaces:60,paidCostPerYear:350000},
    {name:'Журналистика',faculty:'Журналистики',subjects:['ru','literature','social'],passingScore:310,budgetPlaces:40,paidCostPerYear:380000},
    {name:'Международные отношения',faculty:'МО',subjects:['ru','history','english'],passingScore:340,budgetPlaces:30,paidCostPerYear:460000},
  ]},
  {id:12,name:'Университет ИТМО',shortName:'ИТМО',city:'Санкт-Петербург',type:'national_research',rating:7,logo:'💡',programs:[
    {name:'Программная инженерия',faculty:'ИТ',subjects:['ru','math_prof','informatics'],passingScore:300,budgetPlaces:200,paidCostPerYear:380000},
    {name:'Информационная безопасность',faculty:'КТУ',subjects:['ru','math_prof','informatics'],passingScore:290,budgetPlaces:80,paidCostPerYear:360000},
    {name:'Фотоника',faculty:'ФТ',subjects:['ru','math_prof','physics'],passingScore:270,budgetPlaces:60,paidCostPerYear:320000},
    {name:'Биоинженерия',faculty:'БИО',subjects:['ru','math_prof','biology'],passingScore:265,budgetPlaces:40,paidCostPerYear:340000},
    {name:'Дизайн',faculty:'Дизайн',subjects:['ru','literature','social'],passingScore:275,budgetPlaces:30,paidCostPerYear:350000},
  ]},
  {id:13,name:'СПбПУ Петра Великого',shortName:'Политех СПб',city:'Санкт-Петербург',type:'national_research',rating:11,logo:'🔧',programs:[
    {name:'Информатика и ВТ',faculty:'ИКНТ',subjects:['ru','math_prof','informatics'],passingScore:260,budgetPlaces:200,paidCostPerYear:300000},
    {name:'Машиностроение',faculty:'ИММиТ',subjects:['ru','math_prof','physics'],passingScore:230,budgetPlaces:150,paidCostPerYear:260000},
    {name:'Энергетика',faculty:'ИЭ',subjects:['ru','math_prof','physics'],passingScore:225,budgetPlaces:120,paidCostPerYear:250000},
    {name:'Экономика',faculty:'ИПМЭиТ',subjects:['ru','math_prof','social'],passingScore:250,budgetPlaces:60,paidCostPerYear:300000},
  ]},
  {id:14,name:'Новосибирский государственный университет',shortName:'НГУ',city:'Новосибирск',type:'national_research',rating:8,logo:'🔭',programs:[
    {name:'Математика',faculty:'ММФ',subjects:['ru','math_prof','physics'],passingScore:280,budgetPlaces:100,paidCostPerYear:280000},
    {name:'Информатика',faculty:'ФИТ',subjects:['ru','math_prof','informatics'],passingScore:290,budgetPlaces:80,paidCostPerYear:300000},
    {name:'Физика',faculty:'ФФ',subjects:['ru','math_prof','physics'],passingScore:260,budgetPlaces:120,paidCostPerYear:250000},
    {name:'Экономика',faculty:'ЭФ',subjects:['ru','math_prof','social'],passingScore:270,budgetPlaces:50,paidCostPerYear:280000},
  ]},
  {id:15,name:'Уральский федеральный университет',shortName:'УрФУ',city:'Екатеринбург',type:'federal',rating:13,logo:'🏔️',programs:[
    {name:'Информатика и ВТ',faculty:'ИРИТ',subjects:['ru','math_prof','informatics'],passingScore:240,budgetPlaces:200,paidCostPerYear:240000},
    {name:'Экономика',faculty:'ИнЭУ',subjects:['ru','math_prof','social'],passingScore:230,budgetPlaces:80,paidCostPerYear:220000},
    {name:'Юриспруденция',faculty:'ЮрИн',subjects:['ru','history','social'],passingScore:240,budgetPlaces:60,paidCostPerYear:230000},
    {name:'Металлургия',faculty:'ИНМиТ',subjects:['ru','math_prof','physics'],passingScore:200,budgetPlaces:150,paidCostPerYear:200000},
    {name:'Химия',faculty:'ИЕНиМ',subjects:['ru','math_prof','chemistry'],passingScore:210,budgetPlaces:60,paidCostPerYear:200000},
  ]},
  {id:16,name:'Казанский федеральный университет',shortName:'КФУ',city:'Казань',type:'federal',rating:14,logo:'🕌',programs:[
    {name:'IT и анализ данных',faculty:'ИЦТЭ',subjects:['ru','math_prof','informatics'],passingScore:250,budgetPlaces:150,paidCostPerYear:230000},
    {name:'Экономика',faculty:'ИУЭиФ',subjects:['ru','math_prof','social'],passingScore:240,budgetPlaces:80,paidCostPerYear:210000},
    {name:'Медицина',faculty:'ИФМиБ',subjects:['ru','biology','chemistry'],passingScore:260,budgetPlaces:100,paidCostPerYear:280000},
    {name:'Юриспруденция',faculty:'ЮФ',subjects:['ru','history','social'],passingScore:250,budgetPlaces:60,paidCostPerYear:220000},
  ]},
  {id:17,name:'Томский государственный университет',shortName:'ТГУ',city:'Томск',type:'national_research',rating:15,logo:'📚',programs:[
    {name:'Информатика',faculty:'ФИТ',subjects:['ru','math_prof','informatics'],passingScore:250,budgetPlaces:120,paidCostPerYear:220000},
    {name:'Физика',faculty:'ФФ',subjects:['ru','math_prof','physics'],passingScore:230,budgetPlaces:100,paidCostPerYear:200000},
    {name:'Экономика',faculty:'ЭФ',subjects:['ru','math_prof','social'],passingScore:240,budgetPlaces:50,paidCostPerYear:210000},
    {name:'Юриспруденция',faculty:'ЮИ',subjects:['ru','history','social'],passingScore:240,budgetPlaces:40,paidCostPerYear:200000},
  ]},
  {id:18,name:'Томский политехнический университет',shortName:'ТПУ',city:'Томск',type:'national_research',rating:16,logo:'⚗️',programs:[
    {name:'Информатика и ВТ',faculty:'ИШИТР',subjects:['ru','math_prof','informatics'],passingScore:250,budgetPlaces:150,paidCostPerYear:230000},
    {name:'Нефтегазовое дело',faculty:'ИШПР',subjects:['ru','math_prof','physics'],passingScore:220,budgetPlaces:120,paidCostPerYear:210000},
    {name:'Ядерная физика',faculty:'ИЯФ',subjects:['ru','math_prof','physics'],passingScore:240,budgetPlaces:80,paidCostPerYear:220000},
  ]},
  {id:19,name:'Южный федеральный университет',shortName:'ЮФУ',city:'Ростов-на-Дону',type:'federal',rating:19,logo:'☀️',programs:[
    {name:'Информатика',faculty:'ИКТИБ',subjects:['ru','math_prof','informatics'],passingScore:230,budgetPlaces:120,paidCostPerYear:210000},
    {name:'Экономика',faculty:'ЭФ',subjects:['ru','math_prof','social'],passingScore:220,budgetPlaces:60,paidCostPerYear:200000},
    {name:'Педагогика',faculty:'Пед.',subjects:['ru','social','biology'],passingScore:200,budgetPlaces:80,paidCostPerYear:170000},
  ]},
  {id:20,name:'ДВФУ',shortName:'ДВФУ',city:'Владивосток',type:'federal',rating:20,logo:'🌊',programs:[
    {name:'IT',faculty:'ИМКТ',subjects:['ru','math_prof','informatics'],passingScore:220,budgetPlaces:150,paidCostPerYear:200000},
    {name:'Морские технологии',faculty:'ИМО',subjects:['ru','math_prof','physics'],passingScore:190,budgetPlaces:80,paidCostPerYear:180000},
    {name:'Экономика',faculty:'ШЭМ',subjects:['ru','math_prof','social'],passingScore:200,budgetPlaces:50,paidCostPerYear:190000},
  ]},
  {id:21,name:'Сибирский федеральный университет',shortName:'СФУ',city:'Красноярск',type:'federal',rating:17,logo:'🌲',programs:[
    {name:'IT',faculty:'ИКИТ',subjects:['ru','math_prof','informatics'],passingScore:230,budgetPlaces:150,paidCostPerYear:200000},
    {name:'Экономика',faculty:'ИЭУиП',subjects:['ru','math_prof','social'],passingScore:210,budgetPlaces:60,paidCostPerYear:190000},
    {name:'Металлургия',faculty:'ИЦМиМ',subjects:['ru','math_prof','physics'],passingScore:190,budgetPlaces:100,paidCostPerYear:180000},
  ]},
  {id:22,name:'Самарский университет',shortName:'Самарский',city:'Самара',type:'national_research',rating:21,logo:'🚀',programs:[
    {name:'Информатика',faculty:'ФИИТ',subjects:['ru','math_prof','informatics'],passingScore:230,budgetPlaces:100,paidCostPerYear:200000},
    {name:'Аэрокосмические технологии',faculty:'ИАиКТ',subjects:['ru','math_prof','physics'],passingScore:240,budgetPlaces:80,paidCostPerYear:210000},
    {name:'Экономика',faculty:'ИЭиУ',subjects:['ru','math_prof','social'],passingScore:210,budgetPlaces:50,paidCostPerYear:190000},
  ]},
  {id:23,name:'ННГУ им. Лобачевского',shortName:'ННГУ',city:'Нижний Новгород',type:'national_research',rating:23,logo:'🔗',programs:[
    {name:'Информатика',faculty:'ИТММ',subjects:['ru','math_prof','informatics'],passingScore:250,budgetPlaces:100,paidCostPerYear:210000},
    {name:'Физика',faculty:'ФФ',subjects:['ru','math_prof','physics'],passingScore:230,budgetPlaces:80,paidCostPerYear:190000},
    {name:'Экономика',faculty:'ИЭП',subjects:['ru','math_prof','social'],passingScore:240,budgetPlaces:50,paidCostPerYear:200000},
  ]},
  {id:24,name:'Воронежский государственный университет',shortName:'ВГУ',city:'Воронеж',type:'state',rating:28,logo:'🏢',programs:[
    {name:'Информатика',faculty:'ФКН',subjects:['ru','math_prof','informatics'],passingScore:220,budgetPlaces:80,paidCostPerYear:180000},
    {name:'Экономика',faculty:'ЭФ',subjects:['ru','math_prof','social'],passingScore:210,budgetPlaces:50,paidCostPerYear:170000},
    {name:'Юриспруденция',faculty:'ЮФ',subjects:['ru','history','social'],passingScore:220,budgetPlaces:40,paidCostPerYear:180000},
  ]},
];

const TYPE_LABELS: Record<string, string> = {
  federal: 'Федеральный',
  national_research: 'Исследовательский',
  state: 'Государственный',
  private: 'Частный',
};

type ScreenType = 'input' | 'results';

export default function UniversityFinder() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<ScreenType>('input');
  const [scores, setScores] = useState<{subjectId: string; score: number}[]>([
    {subjectId: 'ru', score: 0},
    {subjectId: 'math_prof', score: 0},
    {subjectId: 'social', score: 0},
  ]);
  const [cityFilter, setCityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'score' | 'rating' | 'cost'>('score');
  const [budgetOnly, setBudgetOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedUnis, setExpandedUnis] = useState<Record<number, boolean>>({});

  const totalScore = scores.reduce((s, item) => s + item.score, 0);

  const scoreMap: Record<string, number> = {};
  scores.forEach(s => { scoreMap[s.subjectId] = s.score; });

  const matchResults = useMemo(() => {
    const results: {uni: University; programs: (Program & {userScore: number; chance: 'high' | 'medium' | 'low'})[]}[] = [];

    UNIVERSITIES.forEach(uni => {
      if (cityFilter === 'moscow' && uni.city !== 'Москва') return;
      if (cityFilter === 'spb' && uni.city !== 'Санкт-Петербург') return;
      if (cityFilter === 'other' && (uni.city === 'Москва' || uni.city === 'Санкт-Петербург')) return;
      if (search && !uni.name.toLowerCase().includes(search.toLowerCase()) && !uni.shortName.toLowerCase().includes(search.toLowerCase())) return;

      const matchingPrograms: (Program & {userScore: number; chance: 'high' | 'medium' | 'low'})[] = [];

      uni.programs.forEach(prog => {
        const hasAllSubjects = prog.subjects.every(s => scoreMap[s] !== undefined && scoreMap[s] > 0);
        if (!hasAllSubjects) return;

        const userScore = prog.subjects.reduce((sum, s) => sum + (scoreMap[s] || 0), 0);
        const diff = userScore - prog.passingScore;

        if (diff < -20) return;

        const chance: 'high' | 'medium' | 'low' = diff >= 20 ? 'high' : diff >= 0 ? 'medium' : 'low';
        matchingPrograms.push({...prog, userScore, chance});
      });

      if (matchingPrograms.length > 0) {
        results.push({uni, programs: matchingPrograms});
      }
    });

    results.sort((a, b) => {
      if (sortBy === 'rating') return a.uni.rating - b.uni.rating;
      if (sortBy === 'cost') return Math.min(...a.programs.map(p => p.paidCostPerYear)) - Math.min(...b.programs.map(p => p.paidCostPerYear));
      return Math.min(...a.programs.map(p => p.passingScore)) - Math.min(...b.programs.map(p => p.passingScore));
    });

    return results;
  }, [scores, cityFilter, sortBy, search, scoreMap]);

  const totalPrograms = matchResults.reduce((s, r) => s + r.programs.length, 0);
  const passingCount = matchResults.reduce((s, r) => s + r.programs.filter(p => p.chance === 'high' || p.chance === 'medium').length, 0);
  const chanceCount = matchResults.reduce((s, r) => s + r.programs.filter(p => p.chance === 'low').length, 0);

  if (screen === 'input') {
    return (
      <div className="min-h-[100dvh] bg-gray-50 pb-nav">
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 px-5 pt-14 pb-8 text-center">
          <button onClick={() => navigate('/exam')} className="text-white/60 mb-4 flex items-center gap-1 text-sm absolute left-5">
            <Icon name="ArrowLeft" size={16} /> Назад
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4">🎓</div>
          <h1 className="text-white font-extrabold text-2xl mb-1">Подбор вузов по баллам</h1>
          <p className="text-white/60 text-sm">Узнай, куда ты можешь поступить</p>
        </div>

        <div className="px-5 -mt-4 space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <p className="font-bold text-gray-800 text-sm">Твои баллы ЕГЭ (тестовые)</p>

              {scores.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={item.subjectId}
                    onChange={e => {
                      const newScores = [...scores];
                      newScores[idx] = {subjectId: e.target.value, score: item.score};
                      setScores(newScores);
                    }}
                    className="flex-1 text-sm border rounded-xl px-3 py-2.5 bg-white"
                  >
                    {SUBJECT_OPTIONS.map(s => (
                      <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    value={item.score || ''}
                    onChange={e => {
                      const newScores = [...scores];
                      newScores[idx] = {...item, score: Math.max(0, Math.min(100, Number(e.target.value)))};
                      setScores(newScores);
                    }}
                    placeholder="0-100"
                    className="w-20 text-center text-sm h-10 rounded-xl"
                  />
                  {scores.length > 2 && (
                    <button onClick={() => setScores(scores.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400">
                      <Icon name="X" size={16} />
                    </button>
                  )}
                </div>
              ))}

              {scores.length < 4 && (
                <button
                  onClick={() => setScores([...scores, {subjectId: 'history', score: 0}])}
                  className="text-indigo-600 text-sm font-medium flex items-center gap-1"
                >
                  <Icon name="Plus" size={14} /> Добавить предмет
                </button>
              )}

              <div className="bg-indigo-50 rounded-xl p-3 text-center">
                <p className="text-gray-500 text-xs">Сумма баллов</p>
                <p className="text-indigo-700 font-black text-2xl">{totalScore}</p>
              </div>
            </CardContent>
          </Card>

          <div>
            <p className="text-gray-500 text-sm mb-2 font-medium">Город</p>
            <div className="flex gap-2 flex-wrap">
              {[{id:'all',label:'Все'},{id:'moscow',label:'Москва'},{id:'spb',label:'СПб'},{id:'other',label:'Другие'}].map(c => (
                <button
                  key={c.id}
                  onClick={() => setCityFilter(c.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${cityFilter === c.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => setScreen('results')}
            disabled={totalScore === 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-2xl py-6 text-base font-bold"
          >
            <Icon name="Search" size={18} className="mr-2" /> Найти вузы
          </Button>

          <div className="space-y-2 pb-4">
            <button onClick={() => navigate('/calculator')} className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Icon name="Calculator" size={18} className="text-purple-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-gray-800 font-medium text-sm">Калькулятор баллов</p>
                <p className="text-gray-400 text-xs">Переведи первичные во вторичные</p>
              </div>
              <Icon name="ChevronRight" size={16} className="text-gray-300" />
            </button>
            <button onClick={() => navigate('/mock-exam')} className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Icon name="FileText" size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-gray-800 font-medium text-sm">Пробный тест</p>
                <p className="text-gray-400 text-xs">Узнай свой реальный балл</p>
              </div>
              <Icon name="ChevronRight" size={16} className="text-gray-300" />
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-nav">
      <div className="bg-white border-b px-5 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setScreen('input')} className="text-gray-400">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div className="flex-1 relative">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск вуза..."
              className="pl-9 rounded-xl h-9 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'score' | 'rating' | 'cost')}
            className="text-xs border rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="score">По баллам ↑</option>
            <option value="rating">По рейтингу</option>
            <option value="cost">По стоимости ↑</option>
          </select>
          <button
            onClick={() => setBudgetOnly(!budgetOnly)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${budgetOnly ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Только бюджет
          </button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Card className="rounded-xl bg-green-50">
            <CardContent className="p-3 text-center">
              <p className="text-green-600 font-black text-lg">{passingCount}</p>
              <p className="text-green-600 text-[10px]">Проходишь</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl bg-yellow-50">
            <CardContent className="p-3 text-center">
              <p className="text-yellow-600 font-black text-lg">{chanceCount}</p>
              <p className="text-yellow-600 text-[10px]">Шанс есть</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-3 text-center">
              <p className="text-gray-600 font-black text-lg">{matchResults.length}</p>
              <p className="text-gray-400 text-[10px]">Вузов</p>
            </CardContent>
          </Card>
        </div>

        {matchResults.length === 0 && (
          <Card className="rounded-2xl">
            <CardContent className="p-8 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-gray-700 font-bold mb-2">Ничего не найдено</p>
              <p className="text-gray-400 text-sm mb-4">Попробуй добавить другие предметы или изменить баллы</p>
              <Button variant="outline" onClick={() => setScreen('input')} className="rounded-xl">
                Изменить баллы
              </Button>
            </CardContent>
          </Card>
        )}

        {matchResults.map(({uni, programs}) => {
          const filtered = budgetOnly ? programs.filter(p => p.budgetPlaces > 0) : programs;
          if (filtered.length === 0) return null;
          const expanded = expandedUnis[uni.id];
          const shown = expanded ? filtered : filtered.slice(0, 2);

          return (
            <Card key={uni.id} className="rounded-2xl overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{uni.logo}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm">{uni.shortName}</p>
                    <p className="text-gray-400 text-xs truncate">{uni.name}</p>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{uni.city}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[uni.type]}</Badge>
                      <Badge variant="outline" className="text-[10px]">#{uni.rating}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {shown.map((prog, i) => {
                    const diff = prog.userScore - prog.passingScore;
                    return (
                      <div key={i} className={`rounded-xl p-3 ${prog.chance === 'high' ? 'bg-green-50' : prog.chance === 'medium' ? 'bg-green-50/50' : 'bg-yellow-50'}`}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-800 font-medium text-sm">{prog.name}</p>
                            <p className="text-gray-400 text-xs">{prog.faculty}</p>
                          </div>
                          <Badge className={`text-[10px] flex-shrink-0 ${prog.chance === 'high' ? 'bg-green-100 text-green-700' : prog.chance === 'medium' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-700'}`}>
                            {prog.chance === 'high' ? '✅ Высокий' : prog.chance === 'medium' ? '✅ Средний' : '⚠️ Шанс'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {prog.subjects.map(s => (
                            <span key={s} className="text-[10px] bg-white/80 text-gray-500 px-1.5 py-0.5 rounded">{SUBJECT_NAMES[s] || s}</span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs">
                          <span className="text-gray-500">Проходной: {prog.passingScore} · Твои: {prog.userScore} <span className={diff >= 0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>({diff >= 0 ? '+' : ''}{diff})</span></span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span>🎓 {prog.budgetPlaces} бюдж.</span>
                          <span>💳 {(prog.paidCostPerYear / 1000).toFixed(0)}к ₽/год</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filtered.length > 2 && (
                  <button
                    onClick={() => setExpandedUnis({...expandedUnis, [uni.id]: !expanded})}
                    className="text-indigo-600 text-xs font-medium mt-2 flex items-center gap-1"
                  >
                    {expanded ? 'Свернуть' : `Ещё ${filtered.length - 2} программ`}
                    <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={12} />
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}

        <p className="text-gray-300 text-xs text-center py-4">Данные приблизительные и могут отличаться от реальных проходных баллов</p>
      </div>
      <BottomNav />
    </div>
  );
}
