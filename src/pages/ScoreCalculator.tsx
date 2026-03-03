import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BottomNav from "@/components/BottomNav";

interface SubjectDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  maxPrimary: number;
  passSecondary: number;
  isMathBase?: boolean;
}

const SUBJECTS: SubjectDef[] = [
  { id: "ru", name: "Русский язык", icon: "\u{1F4DD}", color: "from-blue-500 to-indigo-600", maxPrimary: 50, passSecondary: 36 },
  { id: "math_base", name: "Математика (база)", icon: "\u{1F522}", color: "from-purple-500 to-violet-600", maxPrimary: 21, passSecondary: 3, isMathBase: true },
  { id: "math_prof", name: "Математика (профиль)", icon: "\u{1F4D0}", color: "from-purple-600 to-pink-500", maxPrimary: 32, passSecondary: 27 },
  { id: "physics", name: "Физика", icon: "\u269B\uFE0F", color: "from-sky-500 to-blue-600", maxPrimary: 54, passSecondary: 36 },
  { id: "chemistry", name: "Химия", icon: "\u{1F9EA}", color: "from-green-500 to-teal-500", maxPrimary: 56, passSecondary: 36 },
  { id: "biology", name: "Биология", icon: "\u{1F33F}", color: "from-emerald-500 to-green-600", maxPrimary: 59, passSecondary: 36 },
  { id: "history", name: "История", icon: "\u{1F3DB}\uFE0F", color: "from-amber-500 to-orange-500", maxPrimary: 42, passSecondary: 32 },
  { id: "social", name: "Обществознание", icon: "\u{1F30D}", color: "from-orange-500 to-red-500", maxPrimary: 58, passSecondary: 42 },
  { id: "informatics", name: "Информатика", icon: "\u{1F4BB}", color: "from-cyan-500 to-blue-500", maxPrimary: 29, passSecondary: 40 },
  { id: "english", name: "Английский язык", icon: "\u{1F1EC}\u{1F1E7}", color: "from-red-500 to-rose-500", maxPrimary: 86, passSecondary: 22 },
  { id: "geography", name: "География", icon: "\u{1F5FA}\uFE0F", color: "from-teal-500 to-cyan-500", maxPrimary: 43, passSecondary: 37 },
  { id: "literature", name: "Литература", icon: "\u{1F4D6}", color: "from-pink-500 to-rose-500", maxPrimary: 48, passSecondary: 32 },
];

const SCORE_TABLES: Record<string, number[]> = {
  ru: [0, 3, 5, 8, 10, 12, 15, 17, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 39, 40, 41, 43, 44, 45, 46, 48, 49, 50, 51, 53, 54, 55, 56, 57, 59, 60, 61, 62, 64, 65, 66, 67, 69, 70, 71, 72, 73, 76, 78, 81, 100],
  math_prof: [0, 6, 11, 17, 22, 27, 34, 40, 46, 52, 58, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 97, 98, 99, 100, 100],
  physics: [0, 2, 4, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 38, 39, 40, 41, 42, 44, 45, 46, 47, 48, 49, 50, 52, 53, 54, 55, 56, 57, 58, 60, 61, 62, 63, 64, 65, 66, 68, 70, 72, 74, 77, 80, 83, 87, 100],
  chemistry: [0, 2, 4, 5, 7, 9, 10, 12, 13, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 31, 32, 34, 35, 37, 38, 40, 41, 43, 44, 46, 47, 49, 50, 52, 53, 55, 56, 58, 60, 61, 63, 64, 66, 67, 69, 70, 72, 73, 75, 76, 78, 80, 83, 86, 89, 92, 100],
  biology: [0, 2, 4, 5, 7, 8, 10, 12, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 32, 33, 35, 36, 38, 39, 41, 42, 44, 45, 47, 48, 50, 51, 53, 54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 66, 67, 68, 69, 70, 72, 73, 74, 76, 78, 80, 82, 85, 88, 100],
  history: [0, 3, 5, 7, 9, 11, 13, 16, 18, 20, 22, 24, 26, 29, 31, 33, 35, 37, 39, 42, 44, 46, 48, 50, 52, 55, 57, 59, 61, 63, 65, 68, 70, 72, 74, 76, 78, 81, 83, 85, 87, 90, 100],
  social: [0, 2, 4, 5, 7, 8, 10, 12, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 29, 30, 32, 33, 35, 36, 38, 39, 41, 42, 44, 45, 46, 47, 48, 49, 51, 52, 53, 54, 55, 56, 57, 59, 60, 61, 62, 63, 64, 66, 67, 68, 69, 70, 72, 74, 76, 78, 80, 82, 100],
  informatics: [0, 7, 14, 20, 27, 34, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 73, 77, 81, 85, 90, 95, 98, 100],
  english: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 82, 84, 87, 93, 96, 100],
  geography: [0, 3, 5, 7, 10, 12, 14, 17, 19, 21, 24, 26, 28, 31, 33, 35, 38, 40, 42, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69, 71, 73, 75, 77, 79, 81, 83, 85, 87, 89, 93, 100],
  literature: [0, 3, 5, 7, 9, 11, 13, 15, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 100],
};

const MATH_BASE_GRADES: Record<number, number> = {
  0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2,
  7: 3, 8: 3, 9: 3, 10: 3, 11: 3,
  12: 4, 13: 4, 14: 4, 15: 4, 16: 4,
  17: 5, 18: 5, 19: 5, 20: 5, 21: 5,
};

function getSecondaryScore(subjectId: string, primary: number): number {
  const table = SCORE_TABLES[subjectId];
  if (!table) return 0;
  const clamped = Math.min(Math.max(0, Math.round(primary)), table.length - 1);
  return table[clamped];
}

function getMathBaseGrade(primary: number): number {
  const clamped = Math.min(Math.max(0, Math.round(primary)), 21);
  return MATH_BASE_GRADES[clamped] ?? 2;
}

function getPercentile(secondary: number): number {
  if (secondary >= 90) return 95;
  if (secondary >= 80) return 85;
  if (secondary >= 70) return 70;
  if (secondary >= 60) return 50;
  if (secondary >= 50) return 35;
  if (secondary >= 36) return 20;
  return 5;
}

function getScoreColor(secondary: number): string {
  if (secondary >= 73) return "text-green-600";
  if (secondary >= 56) return "text-yellow-600";
  if (secondary >= 40) return "text-orange-500";
  return "text-red-500";
}

function getScoreBg(secondary: number): string {
  if (secondary >= 73) return "bg-green-50 border-green-200";
  if (secondary >= 56) return "bg-yellow-50 border-yellow-200";
  if (secondary >= 40) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function getGradeColor(grade: number): string {
  if (grade === 5) return "text-green-600";
  if (grade === 4) return "text-yellow-600";
  if (grade === 3) return "text-orange-500";
  return "text-red-500";
}

function getGradeBg(grade: number): string {
  if (grade === 5) return "bg-green-50 border-green-200";
  if (grade === 4) return "bg-yellow-50 border-yellow-200";
  if (grade === 3) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function getMotivation(secondary: number, isMathBase: boolean, grade?: number): string {
  if (isMathBase) {
    if (grade === 5) return "Превосходно! Математика покорена!";
    if (grade === 4) return "Хороший результат! Ещё чуть-чуть до пятёрки.";
    if (grade === 3) return "Минимум пройден, но стоит подтянуть знания.";
    return "Не сдано. Нужна серьёзная подготовка.";
  }
  if (secondary >= 90) return "Невероятный результат! Топовые вузы ждут!";
  if (secondary >= 80) return "Отличный балл! Большинство вузов доступны.";
  if (secondary >= 70) return "Хороший результат! Есть куда поступить.";
  if (secondary >= 60) return "Неплохо! Ещё немного усилий для топа.";
  if (secondary >= 50) return "Средний результат. Усиленная подготовка поможет!";
  if (secondary >= 36) return "Порог пройден. Но нужно больше практики.";
  return "Ниже порога. Сосредоточься на слабых темах!";
}

interface MultiSubjectEntry {
  id: string;
  subjectId: string;
  primary: number;
}

const ScoreCalculator = () => {
  const navigate = useNavigate();
  const [selectedSubjectId, setSelectedSubjectId] = useState("ru");
  const [primaryScore, setPrimaryScore] = useState(0);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const [showMulti, setShowMulti] = useState(false);
  const [multiEntries, setMultiEntries] = useState<MultiSubjectEntry[]>([
    { id: "1", subjectId: "ru", primary: 0 },
    { id: "2", subjectId: "math_prof", primary: 0 },
  ]);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const subject = SUBJECTS.find((s) => s.id === selectedSubjectId) || SUBJECTS[0];
  const isMathBase = !!subject.isMathBase;
  const secondary = isMathBase ? 0 : getSecondaryScore(subject.id, primaryScore);
  const grade = isMathBase ? getMathBaseGrade(primaryScore) : 0;
  const passed = isMathBase ? grade >= 3 : secondary >= subject.passSecondary;
  const percentile = isMathBase ? (grade >= 4 ? 70 : grade >= 3 ? 35 : 5) : getPercentile(secondary);

  useEffect(() => {
    const target = isMathBase ? grade : secondary;
    const start = displayedScore;
    const diff = target - start;
    if (diff === 0) return;
    const duration = 300;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedScore(Math.round(start + diff * eased));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [secondary, grade, isMathBase]);

  const handleSubjectChange = useCallback((id: string) => {
    setSelectedSubjectId(id);
    setPrimaryScore(0);
    setDisplayedScore(0);
  }, []);

  const handlePrimaryInput = useCallback(
    (val: string) => {
      const num = parseInt(val, 10);
      if (isNaN(num)) {
        setPrimaryScore(0);
        return;
      }
      setPrimaryScore(Math.min(Math.max(0, num), subject.maxPrimary));
    },
    [subject.maxPrimary]
  );

  const handleMultiSubjectChange = (entryId: string, subjectId: string) => {
    setMultiEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, subjectId, primary: 0 } : e))
    );
  };

  const handleMultiPrimaryChange = (entryId: string, primary: number) => {
    setMultiEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, primary } : e))
    );
  };

  const addMultiEntry = () => {
    if (multiEntries.length >= 4) return;
    const used = new Set(multiEntries.map((e) => e.subjectId));
    const available = SUBJECTS.filter((s) => !s.isMathBase && !used.has(s.id));
    const next = available[0] || SUBJECTS.find((s) => !s.isMathBase) || SUBJECTS[0];
    setMultiEntries((prev) => [
      ...prev,
      { id: String(Date.now()), subjectId: next.id, primary: 0 },
    ]);
  };

  const removeMultiEntry = (entryId: string) => {
    if (multiEntries.length <= 2) return;
    setMultiEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const multiTotal = multiEntries.reduce((sum, e) => {
    const subj = SUBJECTS.find((s) => s.id === e.subjectId);
    if (!subj || subj.isMathBase) return sum;
    return sum + getSecondaryScore(e.subjectId, e.primary);
  }, 0);

  const table = SCORE_TABLES[subject.id];
  const passThresholdPrimary = isMathBase
    ? 7
    : table
    ? table.findIndex((v) => v >= subject.passSecondary)
    : -1;

  const renderScaleBar = () => {
    if (isMathBase) return null;
    const passPos = (subject.passSecondary / 100) * 100;
    const scorePos = (secondary / 100) * 100;

    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">
            Шкала баллов
          </p>
          <div className="relative">
            <div className="w-full h-3 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 overflow-hidden" />
            <div
              className="absolute top-0 w-1 h-3 bg-gray-800 rounded-full"
              style={{ left: `${Math.min(passPos, 100)}%`, transform: "translateX(-50%)" }}
            />
            <div
              className="absolute -top-1 w-5 h-5 bg-purple-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
              style={{ left: `${Math.min(scorePos, 100)}%`, transform: "translateX(-50%)" }}
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>0</span>
              <span
                className="absolute text-gray-600 font-medium"
                style={{ left: `${Math.min(passPos, 100)}%`, transform: "translateX(-50%)" }}
              >
                Порог
              </span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPercentileCard = () => (
    <Card className="border-0 shadow-sm bg-purple-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <Icon name="BarChart3" size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Лучше, чем ~{percentile}% выпускников
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {getMotivation(secondary, isMathBase, grade)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderConversionTable = () => {
    if (isMathBase) {
      return (
        <div className="space-y-2">
          <button
            onClick={() => setShowTable(!showTable)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700"
          >
            <span className="flex items-center gap-2">
              <Icon name="Table2" size={16} className="text-gray-400" />
              Шкала оценок
            </span>
            <Icon
              name={showTable ? "ChevronUp" : "ChevronDown"}
              size={16}
              className="text-gray-400"
            />
          </button>
          {showTable && (
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-2 text-xs font-semibold text-gray-500 bg-gray-50 px-4 py-2 border-b">
                  <span>Первичный балл</span>
                  <span className="text-right">Оценка</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {[
                    { range: "0 - 6", grade: 2 },
                    { range: "7 - 11", grade: 3 },
                    { range: "12 - 16", grade: 4 },
                    { range: "17 - 21", grade: 5 },
                  ].map((row) => {
                    const isActive =
                      (row.grade === 2 && primaryScore <= 6) ||
                      (row.grade === 3 && primaryScore >= 7 && primaryScore <= 11) ||
                      (row.grade === 4 && primaryScore >= 12 && primaryScore <= 16) ||
                      (row.grade === 5 && primaryScore >= 17);
                    return (
                      <div
                        key={row.grade}
                        className={`grid grid-cols-2 px-4 py-2.5 text-sm ${
                          isActive ? "bg-purple-50 font-semibold" : ""
                        }`}
                      >
                        <span className={isActive ? "text-purple-700" : "text-gray-700"}>
                          {row.range}
                        </span>
                        <span
                          className={`text-right font-bold ${
                            isActive ? "text-purple-700" : getGradeColor(row.grade)
                          }`}
                        >
                          {row.grade}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    if (!table) return null;

    return (
      <div className="space-y-2">
        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-2">
            <Icon name="Table2" size={16} className="text-gray-400" />
            Полная таблица перевода
          </span>
          <Icon
            name={showTable ? "ChevronUp" : "ChevronDown"}
            size={16}
            className="text-gray-400"
          />
        </button>
        {showTable && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-2 text-xs font-semibold text-gray-500 bg-gray-50 px-4 py-2 border-b sticky top-0">
                <span>Первичный</span>
                <span className="text-right">Тестовый</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {table.map((sec, pri) => {
                  const isActive = pri === primaryScore;
                  const isPass = pri === passThresholdPrimary;
                  return (
                    <div
                      key={pri}
                      className={`grid grid-cols-2 px-4 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-purple-50 font-semibold"
                          : isPass
                          ? "bg-green-50/50"
                          : ""
                      }`}
                    >
                      <span
                        className={`flex items-center gap-1 ${
                          isActive ? "text-purple-700" : "text-gray-700"
                        }`}
                      >
                        {pri}
                        {isPass && !isActive && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 border-green-300 text-green-600"
                          >
                            порог
                          </Badge>
                        )}
                      </span>
                      <span
                        className={`text-right ${
                          isActive ? "text-purple-700 font-bold" : "text-gray-600"
                        }`}
                      >
                        {sec}
                        {isActive && (
                          <span className="ml-1 text-purple-400">&larr;</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderMultiCalc = () => (
    <div className="space-y-2">
      <button
        onClick={() => setShowMulti(!showMulti)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-2">
          <Icon name="Calculator" size={16} className="text-gray-400" />
          Сумма по нескольким предметам
        </span>
        <Icon
          name={showMulti ? "ChevronUp" : "ChevronDown"}
          size={16}
          className="text-gray-400"
        />
      </button>
      {showMulti && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 space-y-4">
            {multiEntries.map((entry) => {
              const entrySubject = SUBJECTS.find((s) => s.id === entry.subjectId);
              if (!entrySubject) return null;
              const entrySec = entrySubject.isMathBase
                ? 0
                : getSecondaryScore(entry.subjectId, entry.primary);
              return (
                <div key={entry.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={entry.subjectId}
                      onValueChange={(val) =>
                        handleMultiSubjectChange(entry.id, val)
                      }
                    >
                      <SelectTrigger className="flex-1 h-9 text-sm rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.filter((s) => !s.isMathBase).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span>{s.icon}</span>
                              <span>{s.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {multiEntries.length > 2 && (
                      <button
                        onClick={() => removeMultiEntry(entry.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[entry.primary]}
                      onValueChange={([v]) =>
                        handleMultiPrimaryChange(entry.id, v)
                      }
                      max={entrySubject.maxPrimary}
                      step={1}
                      className="flex-1"
                    />
                    <div className="text-right shrink-0 w-20">
                      <span className="text-xs text-gray-500">
                        {entry.primary}/{entrySubject.maxPrimary}
                      </span>
                      <span className="block text-sm font-bold text-purple-700">
                        {entrySec}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {multiEntries.length < 4 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addMultiEntry}
                className="w-full rounded-lg text-xs"
              >
                <Icon name="Plus" size={14} />
                Добавить предмет
              </Button>
            )}

            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Сумма тестовых баллов:
                </span>
                <span className="text-xl font-bold text-purple-700">
                  {multiTotal}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Максимум: {multiEntries.length * 100}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/university")}
              className="w-full rounded-lg text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              <Icon name="GraduationCap" size={14} />
              Подобрать вузы с этими баллами
              <Icon name="ArrowRight" size={14} />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-24">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-purple-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/exam")}
            className="p-2 -ml-2 rounded-xl hover:bg-purple-50 transition-colors"
          >
            <Icon name="ArrowLeft" size={20} className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Калькулятор баллов ЕГЭ
            </h1>
            <p className="text-xs text-gray-500">
              Первичные &rarr; тестовые баллы 2025
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">
            Предмет
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSubjectChange(s.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-all ${
                  selectedSubjectId === s.id
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-purple-200"
                }`}
              >
                <span className="text-base">{s.icon}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                Первичный балл
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={subject.maxPrimary}
                  value={primaryScore}
                  onChange={(e) => handlePrimaryInput(e.target.value)}
                  className="w-16 h-8 text-center text-sm font-bold rounded-lg border-gray-200"
                />
                <span className="text-xs text-gray-400">
                  из {subject.maxPrimary}
                </span>
              </div>
            </div>
            <Slider
              value={[primaryScore]}
              onValueChange={([v]) => setPrimaryScore(v)}
              max={subject.maxPrimary}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
              <span>0</span>
              {!isMathBase && passThresholdPrimary > 0 && (
                <span
                  className="absolute text-green-600 font-medium"
                  style={{
                    left: `${(passThresholdPrimary / subject.maxPrimary) * 100}%`,
                  }}
                >
                </span>
              )}
              <span>{subject.maxPrimary}</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border shadow-lg transition-all duration-300 ${
            isMathBase ? getGradeBg(grade) : getScoreBg(secondary)
          }`}
        >
          <CardContent className="p-6 text-center">
            {isMathBase ? (
              <>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Оценка
                </p>
                <p className={`text-6xl font-black ${getGradeColor(grade)}`}>
                  {displayedScore}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {grade === 5
                    ? "Отлично"
                    : grade === 4
                    ? "Хорошо"
                    : grade === 3
                    ? "Удовлетворительно"
                    : "Не сдано"}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Тестовый балл
                </p>
                <p className={`text-6xl font-black ${getScoreColor(secondary)}`}>
                  {displayedScore}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  из 100
                </p>
              </>
            )}

            <div className="mt-4">
              {passed ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 px-4 py-1.5 text-sm">
                  <Icon name="CheckCircle" size={14} className="mr-1" />
                  Порог пройден
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 border-red-200 px-4 py-1.5 text-sm">
                  <Icon name="XCircle" size={14} className="mr-1" />
                  Ниже порога
                  {!isMathBase && (
                    <span className="ml-1 font-normal">
                      (нужно {subject.passSecondary})
                    </span>
                  )}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {renderScaleBar()}
        {renderPercentileCard()}
        {renderConversionTable()}
        {renderMultiCalc()}

        <div className="space-y-2 pt-2">
          <Button
            variant="outline"
            onClick={() => navigate("/mock-exam")}
            className="w-full h-11 rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            <Icon name="FileText" size={16} />
            Пройди пробный тест, чтобы узнать свой балл
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/university")}
            className="w-full h-11 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <Icon name="GraduationCap" size={16} />
            Подобрать вузы по баллам
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default ScoreCalculator;
