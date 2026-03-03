import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import BottomNav from '@/components/BottomNav';

interface SubjectInfo {
  id: string;
  name: string;
  icon: string;
  maxPrimary: number;
  passSecondary: number;
}

const SUBJECTS: SubjectInfo[] = [
  {id:'ru',name:'Русский язык',icon:'📝',maxPrimary:50,passSecondary:36},
  {id:'math_base',name:'Мат. (база)',icon:'🔢',maxPrimary:21,passSecondary:0},
  {id:'math_prof',name:'Мат. (профиль)',icon:'📐',maxPrimary:32,passSecondary:27},
  {id:'physics',name:'Физика',icon:'⚛️',maxPrimary:54,passSecondary:36},
  {id:'chemistry',name:'Химия',icon:'🧪',maxPrimary:56,passSecondary:36},
  {id:'biology',name:'Биология',icon:'🌿',maxPrimary:59,passSecondary:36},
  {id:'history',name:'История',icon:'🏛️',maxPrimary:42,passSecondary:32},
  {id:'social',name:'Общество',icon:'🌍',maxPrimary:58,passSecondary:42},
  {id:'informatics',name:'Информатика',icon:'💻',maxPrimary:29,passSecondary:40},
  {id:'english',name:'Английский',icon:'🇬🇧',maxPrimary:86,passSecondary:22},
  {id:'geography',name:'География',icon:'🗺️',maxPrimary:43,passSecondary:37},
  {id:'literature',name:'Литература',icon:'📖',maxPrimary:48,passSecondary:32},
];

const SCORE_TABLES: Record<string, number[]> = {
  ru: [0,3,5,8,10,12,15,17,20,22,24,26,28,30,32,34,36,38,39,40,41,43,44,45,46,48,49,50,51,53,54,55,56,57,59,60,61,62,64,65,66,67,69,70,71,72,73,76,78,81,84],
  math_prof: [0,6,11,17,22,27,34,40,46,52,58,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,97,98,99,100,100],
  physics: [0,2,4,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,38,39,40,41,42,44,45,46,47,48,49,50,52,53,54,55,56,57,58,60,61,62,63,64,65,66,68,70,72,74,77,80,83,87,100],
  chemistry: [0,2,4,5,7,9,10,12,13,15,17,18,20,21,23,24,26,27,29,31,32,34,35,37,38,40,41,43,44,46,47,49,50,52,53,55,56,58,60,61,63,64,66,67,69,70,72,73,75,76,78,80,83,86,89,92,100],
  biology: [0,2,4,5,7,8,10,12,13,15,16,18,19,21,22,24,25,27,28,30,32,33,35,36,38,39,41,42,44,45,47,48,50,51,53,54,55,56,57,59,60,61,62,63,64,66,67,68,69,70,72,73,74,76,78,80,82,85,88,100],
  history: [0,3,5,7,9,11,13,16,18,20,22,24,26,29,31,33,35,37,39,42,44,46,48,50,52,55,57,59,61,63,65,68,70,72,74,76,78,81,83,85,87,90,100],
  social: [0,2,4,5,7,8,10,12,13,15,16,18,19,21,22,24,25,27,29,30,32,33,35,36,38,39,41,42,44,45,46,47,48,49,51,52,53,54,55,56,57,59,60,61,62,63,64,66,67,68,69,70,72,74,76,78,80,82,100],
  informatics: [0,7,14,20,27,34,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,73,77,81,85,90,95,98,100],
  english: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,82,84,87,93,96,100],
  geography: [0,3,5,7,10,12,14,17,19,21,24,26,28,31,33,35,38,40,42,45,47,49,51,53,55,57,59,61,63,65,67,69,71,73,75,77,79,81,83,85,87,89,93,100],
  literature: [0,3,5,7,9,11,13,15,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,100],
};

const MATH_BASE_GRADES: Record<number, {grade: number; label: string; color: string}> = {};
for (let i = 0; i <= 6; i++) MATH_BASE_GRADES[i] = {grade:2,label:'Не сдано',color:'text-red-600'};
for (let i = 7; i <= 11; i++) MATH_BASE_GRADES[i] = {grade:3,label:'Удовлетворительно',color:'text-yellow-600'};
for (let i = 12; i <= 16; i++) MATH_BASE_GRADES[i] = {grade:4,label:'Хорошо',color:'text-blue-600'};
for (let i = 17; i <= 21; i++) MATH_BASE_GRADES[i] = {grade:5,label:'Отлично',color:'text-green-600'};

function getSecondary(subjectId: string, primary: number): number {
  const table = SCORE_TABLES[subjectId];
  if (!table) return 0;
  if (primary < 0) return 0;
  if (primary >= table.length) return table[table.length - 1];
  return table[primary];
}

function getPercentile(score: number): number {
  if (score >= 90) return 95;
  if (score >= 80) return 85;
  if (score >= 70) return 70;
  if (score >= 60) return 50;
  if (score >= 50) return 35;
  if (score >= 36) return 20;
  return 5;
}

function getMotivation(score: number): string {
  if (score >= 90) return 'Великолепный результат! Топовые вузы ждут тебя';
  if (score >= 80) return 'Отличный уровень подготовки!';
  if (score >= 70) return 'Хороший результат, есть куда расти';
  if (score >= 60) return 'Средний уровень — продолжай готовиться';
  if (score >= 50) return 'Есть база, но нужно подтянуть слабые темы';
  if (score >= 36) return 'Порог пройден, но стоит усилить подготовку';
  return 'Нужно больше практики — ты справишься!';
}

function scoreColor(score: number): string {
  if (score >= 73) return 'text-green-600';
  if (score >= 56) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 73) return 'bg-green-50';
  if (score >= 56) return 'bg-yellow-50';
  if (score >= 40) return 'bg-orange-50';
  return 'bg-red-50';
}

export default function ScoreCalculator() {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [primaryScore, setPrimaryScore] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const [showMulti, setShowMulti] = useState(false);
  const [multiSubjects, setMultiSubjects] = useState<{subjectId: string; score: number}[]>([
    {subjectId: 'ru', score: 0},
    {subjectId: 'math_prof', score: 0},
  ]);
  const [animatedScore, setAnimatedScore] = useState(0);
  const animRef = useRef<number>();

  const isBase = selectedSubject.id === 'math_base';
  const secondary = isBase ? 0 : getSecondary(selectedSubject.id, primaryScore);
  const baseGrade = isBase ? MATH_BASE_GRADES[Math.min(primaryScore, 21)] : null;

  useEffect(() => {
    if (isBase) return;
    const target = secondary;
    const start = animatedScore;
    const duration = 300;
    const startTime = performance.now();
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(start + (target - start) * eased));
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [secondary, isBase]);

  const passed = isBase
    ? (baseGrade?.grade ?? 2) >= 3
    : secondary >= selectedSubject.passSecondary;

  const handlePrimaryChange = (val: number) => {
    setPrimaryScore(Math.max(0, Math.min(selectedSubject.maxPrimary, val)));
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  const multiTotal = multiSubjects.reduce((sum, ms) => {
    const sub = SUBJECTS.find(s => s.id === ms.subjectId);
    if (!sub || sub.id === 'math_base') return sum;
    return sum + getSecondary(ms.subjectId, ms.score);
  }, 0);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-nav">
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 px-5 pt-14 pb-8">
        <button onClick={() => navigate('/exam')} className="text-white/60 mb-4 flex items-center gap-1 text-sm">
          <Icon name="ArrowLeft" size={16} /> Подготовка к экзамену
        </button>
        <h1 className="text-white font-extrabold text-2xl mb-1">Калькулятор баллов ЕГЭ</h1>
        <p className="text-white/60 text-sm">Переведи первичные баллы во вторичные</p>
      </div>

      <div className="px-5 -mt-4 space-y-4">
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
          {SUBJECTS.map(sub => (
            <button
              key={sub.id}
              onClick={() => { setSelectedSubject(sub); setPrimaryScore(0); }}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${selectedSubject.id === sub.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-600 shadow-sm'}`}
            >
              <span>{sub.icon}</span>
              <span className="whitespace-nowrap">{sub.name}</span>
            </button>
          ))}
        </div>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-gray-500 text-sm mb-3">Первичный балл: <span className="font-bold text-gray-800">{primaryScore}</span> из {selectedSubject.maxPrimary}</p>
            <input
              type="range"
              min={0}
              max={selectedSubject.maxPrimary}
              value={primaryScore}
              onChange={e => handlePrimaryChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-gray-400">0</span>
              <Input
                type="number"
                value={primaryScore}
                onChange={e => handlePrimaryChange(Number(e.target.value))}
                min={0}
                max={selectedSubject.maxPrimary}
                className="w-20 text-center text-sm h-8 rounded-lg"
              />
              <span className="text-xs text-gray-400">{selectedSubject.maxPrimary}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={`rounded-2xl ${isBase ? (baseGrade && baseGrade.grade >= 3 ? 'bg-green-50' : 'bg-red-50') : scoreBg(secondary)}`}>
          <CardContent className="p-6 text-center">
            {isBase ? (
              <>
                <p className="text-gray-500 text-sm mb-1">Оценка</p>
                <p className={`text-6xl font-black ${baseGrade?.color ?? 'text-gray-800'}`}>{baseGrade?.grade ?? 2}</p>
                <p className={`text-lg font-bold mt-1 ${baseGrade?.color ?? 'text-gray-600'}`}>{baseGrade?.label ?? 'Не сдано'}</p>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-1">Тестовый балл</p>
                <p className={`text-6xl font-black ${scoreColor(secondary)}`}>{animatedScore}</p>
                <p className="text-gray-400 text-sm mt-1">из 100</p>
                <div className="mt-3">
                  {passed ? (
                    <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">Порог пройден ✅</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-sm px-3 py-1">Ниже порога ❌</Badge>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!isBase && (
          <>
            <Card className="rounded-2xl">
              <CardContent className="p-4">
                <div className="relative h-4 bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-full overflow-hidden">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-full shadow-lg transition-all duration-300"
                    style={{left: `calc(${Math.min(secondary, 100)}% - 8px)`}}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>0</span>
                  <span className="text-red-500 font-medium">Порог {selectedSubject.passSecondary}</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl bg-indigo-50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Icon name="TrendingUp" size={20} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-indigo-700 font-bold text-sm">Лучше, чем ~{getPercentile(secondary)}% выпускников</p>
                  <p className="text-indigo-500 text-xs">{getMotivation(secondary)}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
        >
          <span className="text-gray-700 font-medium text-sm">Полная таблица перевода</span>
          <Icon name={showTable ? 'ChevronUp' : 'ChevronDown'} size={18} className="text-gray-400" />
        </button>

        {showTable && (
          <Card className="rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-500 font-medium">Первичный</th>
                      <th className="px-4 py-2 text-left text-gray-500 font-medium">{isBase ? 'Оценка' : 'Тестовый'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isBase ? (
                      Object.entries(MATH_BASE_GRADES).map(([p, info]) => (
                        <tr key={p} className={Number(p) === primaryScore ? 'bg-indigo-50' : ''}>
                          <td className="px-4 py-1.5 text-gray-700">{p}</td>
                          <td className={`px-4 py-1.5 font-bold ${info.color}`}>{info.grade} — {info.label}</td>
                        </tr>
                      ))
                    ) : (
                      (SCORE_TABLES[selectedSubject.id] || []).map((sec, pri) => (
                        <tr key={pri} className={`${pri === primaryScore ? 'bg-indigo-50 font-bold' : ''} ${sec === selectedSubject.passSecondary ? 'bg-amber-50' : ''}`}>
                          <td className="px-4 py-1.5 text-gray-700">{pri}</td>
                          <td className="px-4 py-1.5 text-gray-700">
                            {sec}
                            {sec === selectedSubject.passSecondary && <Badge className="ml-2 text-[9px] bg-amber-100 text-amber-700">порог</Badge>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <button
          onClick={() => setShowMulti(!showMulti)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
        >
          <span className="text-gray-700 font-medium text-sm">Сумма по нескольким предметам</span>
          <Icon name={showMulti ? 'ChevronUp' : 'ChevronDown'} size={18} className="text-gray-400" />
        </button>

        {showMulti && (
          <Card className="rounded-2xl">
            <CardContent className="p-5 space-y-4">
              {multiSubjects.map((ms, idx) => {
                const sub = SUBJECTS.find(s => s.id === ms.subjectId)!;
                const sec = sub.id === 'math_base' ? 0 : getSecondary(ms.subjectId, ms.score);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={ms.subjectId}
                      onChange={e => {
                        const newSubs = [...multiSubjects];
                        newSubs[idx] = {subjectId: e.target.value, score: 0};
                        setMultiSubjects(newSubs);
                      }}
                      className="flex-1 text-sm border rounded-xl px-2 py-2 bg-white"
                    >
                      {SUBJECTS.filter(s => s.id !== 'math_base').map(s => (
                        <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      value={ms.score}
                      onChange={e => {
                        const newSubs = [...multiSubjects];
                        const maxP = SUBJECTS.find(s => s.id === ms.subjectId)?.maxPrimary ?? 100;
                        newSubs[idx] = {...ms, score: Math.max(0, Math.min(maxP, Number(e.target.value)))};
                        setMultiSubjects(newSubs);
                      }}
                      className="w-16 text-center text-sm h-9 rounded-xl"
                    />
                    <span className="text-indigo-600 font-bold text-sm w-8 text-right">{sec}</span>
                    {multiSubjects.length > 2 && (
                      <button onClick={() => setMultiSubjects(multiSubjects.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400">
                        <Icon name="X" size={16} />
                      </button>
                    )}
                  </div>
                );
              })}

              {multiSubjects.length < 4 && (
                <button
                  onClick={() => setMultiSubjects([...multiSubjects, {subjectId: 'social', score: 0}])}
                  className="text-indigo-600 text-sm font-medium flex items-center gap-1"
                >
                  <Icon name="Plus" size={14} /> Добавить предмет
                </button>
              )}

              <div className="bg-indigo-50 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-xs">Сумма тестовых баллов</p>
                <p className="text-indigo-700 font-black text-3xl">{multiTotal}</p>
              </div>

              <Button
                variant="outline"
                onClick={() => navigate('/universities')}
                className="w-full rounded-xl text-sm"
              >
                <Icon name="Building2" size={16} className="mr-2" /> Подобрать вузы с этими баллами
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2 pt-2 pb-4">
          <button
            onClick={() => navigate('/mock-exam')}
            className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Icon name="FileText" size={18} className="text-indigo-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-gray-800 font-medium text-sm">Пробный тест</p>
              <p className="text-gray-400 text-xs">Узнай свой реальный балл</p>
            </div>
            <Icon name="ChevronRight" size={16} className="text-gray-300" />
          </button>

          <button
            onClick={() => navigate('/universities')}
            className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Icon name="Building2" size={18} className="text-green-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-gray-800 font-medium text-sm">Подобрать вузы по баллам</p>
              <p className="text-gray-400 text-xs">Куда можно поступить</p>
            </div>
            <Icon name="ChevronRight" size={16} className="text-gray-300" />
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
