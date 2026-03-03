import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BottomNav from "@/components/BottomNav";

interface Program {
  id: number;
  name: string;
  faculty: string;
  subjects: string[];
  passingScore: number;
  budgetPlaces: number;
  paidPlaces: number;
  paidCostPerYear: number;
}

interface University {
  id: number;
  name: string;
  shortName: string;
  city: string;
  region: string;
  type: "federal" | "national_research" | "state" | "private";
  rating: number;
  logo: string;
  programs: Program[];
}

interface SubjectEntry {
  id: string;
  subjectId: string;
  score: number;
}

const SUBJECT_OPTIONS: { id: string; name: string; icon: string }[] = [
  { id: "ru", name: "Русский язык", icon: "\u{1F4DD}" },
  { id: "math_prof", name: "Математика (профиль)", icon: "\u{1F4D0}" },
  { id: "physics", name: "Физика", icon: "\u269B\uFE0F" },
  { id: "chemistry", name: "Химия", icon: "\u{1F9EA}" },
  { id: "biology", name: "Биология", icon: "\u{1F33F}" },
  { id: "history", name: "История", icon: "\u{1F3DB}\uFE0F" },
  { id: "social", name: "Обществознание", icon: "\u{1F30D}" },
  { id: "informatics", name: "Информатика", icon: "\u{1F4BB}" },
  { id: "english", name: "Английский язык", icon: "\u{1F1EC}\u{1F1E7}" },
  { id: "geography", name: "География", icon: "\u{1F5FA}\uFE0F" },
  { id: "literature", name: "Литература", icon: "\u{1F4D6}" },
];

const SUBJECT_MAP: Record<string, string> = {};
SUBJECT_OPTIONS.forEach((s) => {
  SUBJECT_MAP[s.id] = s.name;
});

const UNIVERSITIES: University[] = [
  {
    id: 1, name: "Московский государственный университет им. М.В. Ломоносова", shortName: "МГУ", city: "Москва", region: "Москва", type: "federal", rating: 1, logo: "\u{1F3DB}\uFE0F",
    programs: [
      { id: 101, name: "Прикладная математика и информатика", faculty: "Факультет ВМК", subjects: ["ru", "math_prof", "informatics"], passingScore: 310, budgetPlaces: 290, paidPlaces: 60, paidCostPerYear: 430000 },
      { id: 102, name: "Фундаментальная и прикладная физика", faculty: "Физический факультет", subjects: ["ru", "math_prof", "physics"], passingScore: 290, budgetPlaces: 340, paidPlaces: 40, paidCostPerYear: 400000 },
      { id: 103, name: "Экономика", faculty: "Экономический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 350, budgetPlaces: 60, paidPlaces: 200, paidCostPerYear: 490000 },
      { id: 104, name: "Юриспруденция", faculty: "Юридический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 355, budgetPlaces: 50, paidPlaces: 250, paidCostPerYear: 480000 },
      { id: 105, name: "Филология", faculty: "Филологический факультет", subjects: ["ru", "math_prof", "literature"], passingScore: 340, budgetPlaces: 180, paidPlaces: 70, paidCostPerYear: 400000 },
      { id: 106, name: "Журналистика", faculty: "Факультет журналистики", subjects: ["ru", "literature", "english"], passingScore: 345, budgetPlaces: 80, paidPlaces: 200, paidCostPerYear: 430000 },
      { id: 107, name: "Биология", faculty: "Биологический факультет", subjects: ["ru", "math_prof", "biology"], passingScore: 280, budgetPlaces: 220, paidPlaces: 30, paidCostPerYear: 400000 },
      { id: 108, name: "Химия", faculty: "Химический факультет", subjects: ["ru", "math_prof", "chemistry"], passingScore: 275, budgetPlaces: 200, paidPlaces: 25, paidCostPerYear: 400000 },
      { id: 109, name: "История", faculty: "Исторический факультет", subjects: ["ru", "history", "social"], passingScore: 335, budgetPlaces: 100, paidPlaces: 80, paidCostPerYear: 410000 },
      { id: 110, name: "Психология", faculty: "Факультет психологии", subjects: ["ru", "math_prof", "biology"], passingScore: 320, budgetPlaces: 60, paidPlaces: 120, paidCostPerYear: 450000 },
      { id: 111, name: "Международные отношения", faculty: "Факультет МО", subjects: ["ru", "history", "english"], passingScore: 360, budgetPlaces: 30, paidPlaces: 100, paidCostPerYear: 510000 },
      { id: 112, name: "Менеджмент", faculty: "Факультет ГУ", subjects: ["ru", "math_prof", "social"], passingScore: 340, budgetPlaces: 40, paidPlaces: 150, paidCostPerYear: 470000 },
      { id: 113, name: "Геология", faculty: "Геологический факультет", subjects: ["ru", "math_prof", "physics"], passingScore: 270, budgetPlaces: 150, paidPlaces: 20, paidCostPerYear: 390000 },
      { id: 114, name: "География", faculty: "Географический факультет", subjects: ["ru", "math_prof", "geography"], passingScore: 285, budgetPlaces: 120, paidPlaces: 40, paidCostPerYear: 390000 },
      { id: 115, name: "Лечебное дело", faculty: "Факультет фундаментальной медицины", subjects: ["ru", "chemistry", "biology"], passingScore: 345, budgetPlaces: 30, paidPlaces: 80, paidCostPerYear: 550000 },
    ],
  },
  {
    id: 2, name: "МГТУ им. Н.Э. Баумана", shortName: "Бауманка", city: "Москва", region: "Москва", type: "national_research", rating: 4, logo: "\u2699\uFE0F",
    programs: [
      { id: 201, name: "Информатика и вычислительная техника", faculty: "Факультет ИУ", subjects: ["ru", "math_prof", "informatics"], passingScore: 280, budgetPlaces: 350, paidPlaces: 100, paidCostPerYear: 320000 },
      { id: 202, name: "Прикладная математика", faculty: "Факультет ФН", subjects: ["ru", "math_prof", "physics"], passingScore: 275, budgetPlaces: 180, paidPlaces: 50, paidCostPerYear: 310000 },
      { id: 203, name: "Робототехника и мехатроника", faculty: "Факультет СМ", subjects: ["ru", "math_prof", "physics"], passingScore: 270, budgetPlaces: 120, paidPlaces: 40, paidCostPerYear: 310000 },
      { id: 204, name: "Ракетостроение", faculty: "Факультет СМ", subjects: ["ru", "math_prof", "physics"], passingScore: 260, budgetPlaces: 100, paidPlaces: 30, paidCostPerYear: 290000 },
      { id: 205, name: "Биомедицинская техника", faculty: "Факультет БМТ", subjects: ["ru", "math_prof", "physics"], passingScore: 255, budgetPlaces: 90, paidPlaces: 30, paidCostPerYear: 310000 },
      { id: 206, name: "Материаловедение", faculty: "Факультет МТ", subjects: ["ru", "math_prof", "physics"], passingScore: 245, budgetPlaces: 110, paidPlaces: 25, paidCostPerYear: 290000 },
      { id: 207, name: "Энергомашиностроение", faculty: "Факультет Э", subjects: ["ru", "math_prof", "physics"], passingScore: 250, budgetPlaces: 130, paidPlaces: 20, paidCostPerYear: 290000 },
      { id: 208, name: "Программная инженерия", faculty: "Факультет ИУ", subjects: ["ru", "math_prof", "informatics"], passingScore: 290, budgetPlaces: 100, paidPlaces: 80, paidCostPerYear: 330000 },
      { id: 209, name: "Кибербезопасность", faculty: "Факультет ИУ", subjects: ["ru", "math_prof", "informatics"], passingScore: 285, budgetPlaces: 80, paidPlaces: 60, paidCostPerYear: 330000 },
      { id: 210, name: "Оптотехника", faculty: "Факультет РЛ", subjects: ["ru", "math_prof", "physics"], passingScore: 240, budgetPlaces: 70, paidPlaces: 15, paidCostPerYear: 290000 },
    ],
  },
  {
    id: 3, name: "Национальный исследовательский университет \"Высшая школа экономики\"", shortName: "ВШЭ", city: "Москва", region: "Москва", type: "national_research", rating: 3, logo: "\u{1F4C8}",
    programs: [
      { id: 301, name: "Программная инженерия", faculty: "Факультет компьютерных наук", subjects: ["ru", "math_prof", "informatics"], passingScore: 300, budgetPlaces: 200, paidPlaces: 150, paidCostPerYear: 580000 },
      { id: 302, name: "Прикладная математика и информатика", faculty: "Факультет компьютерных наук", subjects: ["ru", "math_prof", "informatics"], passingScore: 310, budgetPlaces: 180, paidPlaces: 100, paidCostPerYear: 580000 },
      { id: 303, name: "Экономика", faculty: "Факультет экономических наук", subjects: ["ru", "math_prof", "social"], passingScore: 340, budgetPlaces: 100, paidPlaces: 300, paidCostPerYear: 590000 },
      { id: 304, name: "Юриспруденция", faculty: "Факультет права", subjects: ["ru", "math_prof", "social"], passingScore: 345, budgetPlaces: 80, paidPlaces: 250, paidCostPerYear: 560000 },
      { id: 305, name: "Менеджмент", faculty: "Факультет бизнеса и менеджмента", subjects: ["ru", "math_prof", "social"], passingScore: 330, budgetPlaces: 60, paidPlaces: 200, paidCostPerYear: 560000 },
      { id: 306, name: "Международные отношения", faculty: "Факультет МЭиМП", subjects: ["ru", "history", "english"], passingScore: 355, budgetPlaces: 40, paidPlaces: 120, paidCostPerYear: 570000 },
      { id: 307, name: "Дизайн", faculty: "Школа дизайна", subjects: ["ru", "math_prof", "literature"], passingScore: 290, budgetPlaces: 50, paidPlaces: 200, paidCostPerYear: 540000 },
      { id: 308, name: "Журналистика", faculty: "Факультет коммуникаций", subjects: ["ru", "literature", "english"], passingScore: 325, budgetPlaces: 40, paidPlaces: 150, paidCostPerYear: 530000 },
      { id: 309, name: "Социология", faculty: "Факультет социальных наук", subjects: ["ru", "math_prof", "social"], passingScore: 310, budgetPlaces: 60, paidPlaces: 100, paidCostPerYear: 520000 },
      { id: 310, name: "Политология", faculty: "Факультет социальных наук", subjects: ["ru", "math_prof", "social"], passingScore: 320, budgetPlaces: 40, paidPlaces: 80, paidCostPerYear: 530000 },
      { id: 311, name: "Филология", faculty: "Факультет гуманитарных наук", subjects: ["ru", "english", "literature"], passingScore: 315, budgetPlaces: 50, paidPlaces: 60, paidCostPerYear: 490000 },
      { id: 312, name: "Бизнес-информатика", faculty: "Факультет бизнеса и менеджмента", subjects: ["ru", "math_prof", "social"], passingScore: 295, budgetPlaces: 80, paidPlaces: 180, paidCostPerYear: 560000 },
    ],
  },
  {
    id: 4, name: "Московский физико-технический институт", shortName: "МФТИ", city: "Москва", region: "Москва", type: "national_research", rating: 2, logo: "\u{1F680}",
    programs: [
      { id: 401, name: "Прикладная математика и физика", faculty: "ФПМИ", subjects: ["ru", "math_prof", "physics"], passingScore: 310, budgetPlaces: 250, paidPlaces: 40, paidCostPerYear: 380000 },
      { id: 402, name: "Компьютерные науки", faculty: "ФПМИ", subjects: ["ru", "math_prof", "informatics"], passingScore: 330, budgetPlaces: 200, paidPlaces: 60, paidCostPerYear: 380000 },
      { id: 403, name: "Прикладная математика и информатика", faculty: "ФИВТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 340, budgetPlaces: 180, paidPlaces: 50, paidCostPerYear: 380000 },
      { id: 404, name: "Биотехнологии", faculty: "ФБМФ", subjects: ["ru", "math_prof", "biology"], passingScore: 280, budgetPlaces: 60, paidPlaces: 20, paidCostPerYear: 360000 },
      { id: 405, name: "Аэрокосмические технологии", faculty: "ФАКТ", subjects: ["ru", "math_prof", "physics"], passingScore: 295, budgetPlaces: 80, paidPlaces: 15, paidCostPerYear: 370000 },
      { id: 406, name: "Радиотехника и кибернетика", faculty: "ФРКТ", subjects: ["ru", "math_prof", "physics"], passingScore: 300, budgetPlaces: 120, paidPlaces: 25, paidCostPerYear: 370000 },
      { id: 407, name: "Молекулярная и биологическая физика", faculty: "ФМБФ", subjects: ["ru", "math_prof", "physics"], passingScore: 285, budgetPlaces: 90, paidPlaces: 15, paidCostPerYear: 360000 },
      { id: 408, name: "Нанотехнологии", faculty: "ФНБИК", subjects: ["ru", "math_prof", "physics"], passingScore: 290, budgetPlaces: 70, paidPlaces: 10, paidCostPerYear: 370000 },
    ],
  },
  {
    id: 5, name: "Московский государственный институт международных отношений", shortName: "МГИМО", city: "Москва", region: "Москва", type: "state", rating: 5, logo: "\u{1F30D}",
    programs: [
      { id: 501, name: "Международные отношения", faculty: "Факультет МО", subjects: ["ru", "history", "english"], passingScore: 370, budgetPlaces: 40, paidPlaces: 200, paidCostPerYear: 620000 },
      { id: 502, name: "Международное право", faculty: "Международно-правовой факультет", subjects: ["ru", "history", "english"], passingScore: 365, budgetPlaces: 30, paidPlaces: 180, paidCostPerYear: 610000 },
      { id: 503, name: "Мировая экономика", faculty: "Факультет МЭО", subjects: ["ru", "math_prof", "english"], passingScore: 360, budgetPlaces: 30, paidPlaces: 200, paidCostPerYear: 600000 },
      { id: 504, name: "Журналистика", faculty: "Факультет МЖ", subjects: ["ru", "literature", "english"], passingScore: 350, budgetPlaces: 20, paidPlaces: 100, paidCostPerYear: 580000 },
      { id: 505, name: "Политология", faculty: "Факультет управления", subjects: ["ru", "history", "social"], passingScore: 345, budgetPlaces: 25, paidPlaces: 120, paidCostPerYear: 570000 },
      { id: 506, name: "Реклама и связи с общественностью", faculty: "Факультет МЖ", subjects: ["ru", "social", "english"], passingScore: 340, budgetPlaces: 15, paidPlaces: 100, paidCostPerYear: 560000 },
    ],
  },
  {
    id: 6, name: "Российский экономический университет им. Г.В. Плеханова", shortName: "РЭУ Плеханова", city: "Москва", region: "Москва", type: "state", rating: 18, logo: "\u{1F4B0}",
    programs: [
      { id: 601, name: "Экономика", faculty: "Факультет экономики и права", subjects: ["ru", "math_prof", "social"], passingScore: 260, budgetPlaces: 120, paidPlaces: 400, paidCostPerYear: 340000 },
      { id: 602, name: "Менеджмент", faculty: "Факультет менеджмента", subjects: ["ru", "math_prof", "social"], passingScore: 250, budgetPlaces: 80, paidPlaces: 350, paidCostPerYear: 330000 },
      { id: 603, name: "Торговое дело", faculty: "Факультет бизнеса", subjects: ["ru", "math_prof", "social"], passingScore: 235, budgetPlaces: 100, paidPlaces: 250, paidCostPerYear: 310000 },
      { id: 604, name: "Бизнес-информатика", faculty: "Факультет информационных технологий", subjects: ["ru", "math_prof", "informatics"], passingScore: 245, budgetPlaces: 80, paidPlaces: 150, paidCostPerYear: 340000 },
      { id: 605, name: "Юриспруденция", faculty: "Факультет экономики и права", subjects: ["ru", "math_prof", "social"], passingScore: 265, budgetPlaces: 40, paidPlaces: 200, paidCostPerYear: 350000 },
      { id: 606, name: "Финансы и кредит", faculty: "Финансовый факультет", subjects: ["ru", "math_prof", "social"], passingScore: 270, budgetPlaces: 60, paidPlaces: 300, paidCostPerYear: 350000 },
      { id: 607, name: "Реклама и связи с общественностью", faculty: "Факультет маркетинга", subjects: ["ru", "social", "english"], passingScore: 240, budgetPlaces: 30, paidPlaces: 120, paidCostPerYear: 320000 },
      { id: 608, name: "Гостиничное дело", faculty: "Факультет гостеприимства", subjects: ["ru", "math_prof", "social"], passingScore: 220, budgetPlaces: 40, paidPlaces: 100, paidCostPerYear: 300000 },
    ],
  },
  {
    id: 7, name: "Российский университет дружбы народов", shortName: "РУДН", city: "Москва", region: "Москва", type: "state", rating: 12, logo: "\u{1F91D}",
    programs: [
      { id: 701, name: "Лечебное дело", faculty: "Медицинский институт", subjects: ["ru", "chemistry", "biology"], passingScore: 260, budgetPlaces: 80, paidPlaces: 400, paidCostPerYear: 360000 },
      { id: 702, name: "Юриспруденция", faculty: "Юридический институт", subjects: ["ru", "math_prof", "social"], passingScore: 250, budgetPlaces: 60, paidPlaces: 300, paidCostPerYear: 320000 },
      { id: 703, name: "Экономика", faculty: "Экономический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 245, budgetPlaces: 70, paidPlaces: 250, paidCostPerYear: 310000 },
      { id: 704, name: "Лингвистика", faculty: "Филологический факультет", subjects: ["ru", "english", "literature"], passingScore: 255, budgetPlaces: 50, paidPlaces: 150, paidCostPerYear: 310000 },
      { id: 705, name: "Международные отношения", faculty: "Факультет гуманитарных наук", subjects: ["ru", "history", "english"], passingScore: 265, budgetPlaces: 30, paidPlaces: 120, paidCostPerYear: 340000 },
      { id: 706, name: "Строительство", faculty: "Инженерная академия", subjects: ["ru", "math_prof", "physics"], passingScore: 210, budgetPlaces: 100, paidPlaces: 80, paidCostPerYear: 270000 },
      { id: 707, name: "Информатика и ВТ", faculty: "Факультет ФМиЕН", subjects: ["ru", "math_prof", "informatics"], passingScore: 230, budgetPlaces: 80, paidPlaces: 100, paidCostPerYear: 310000 },
      { id: 708, name: "Экология и природопользование", faculty: "Аграрно-технологический институт", subjects: ["ru", "math_prof", "biology"], passingScore: 200, budgetPlaces: 60, paidPlaces: 40, paidCostPerYear: 260000 },
    ],
  },
  {
    id: 8, name: "НИТУ \"МИСиС\"", shortName: "МИСиС", city: "Москва", region: "Москва", type: "national_research", rating: 9, logo: "\u{1F52C}",
    programs: [
      { id: 801, name: "Информационные технологии", faculty: "ИТАСУ", subjects: ["ru", "math_prof", "informatics"], passingScore: 270, budgetPlaces: 150, paidPlaces: 100, paidCostPerYear: 340000 },
      { id: 802, name: "Нанотехнологии", faculty: "Институт новых материалов", subjects: ["ru", "math_prof", "physics"], passingScore: 240, budgetPlaces: 80, paidPlaces: 20, paidCostPerYear: 310000 },
      { id: 803, name: "Материаловедение", faculty: "Институт новых материалов", subjects: ["ru", "math_prof", "physics"], passingScore: 235, budgetPlaces: 100, paidPlaces: 30, paidCostPerYear: 300000 },
      { id: 804, name: "Горное дело", faculty: "Горный институт", subjects: ["ru", "math_prof", "physics"], passingScore: 230, budgetPlaces: 120, paidPlaces: 25, paidCostPerYear: 290000 },
      { id: 805, name: "Экономика", faculty: "Институт экономики и УП", subjects: ["ru", "math_prof", "social"], passingScore: 255, budgetPlaces: 40, paidPlaces: 120, paidCostPerYear: 340000 },
      { id: 806, name: "Лингвистика", faculty: "Институт ЛМКиТ", subjects: ["ru", "english", "literature"], passingScore: 260, budgetPlaces: 30, paidPlaces: 60, paidCostPerYear: 330000 },
    ],
  },
  {
    id: 9, name: "Финансовый университет при Правительстве РФ", shortName: "Финуниверситет", city: "Москва", region: "Москва", type: "state", rating: 10, logo: "\u{1F3E6}",
    programs: [
      { id: 901, name: "Финансы и кредит", faculty: "Финансовый факультет", subjects: ["ru", "math_prof", "social"], passingScore: 290, budgetPlaces: 100, paidPlaces: 300, paidCostPerYear: 380000 },
      { id: 902, name: "Экономика", faculty: "Факультет экономики", subjects: ["ru", "math_prof", "social"], passingScore: 280, budgetPlaces: 80, paidPlaces: 250, paidCostPerYear: 370000 },
      { id: 903, name: "Менеджмент", faculty: "Факультет менеджмента", subjects: ["ru", "math_prof", "social"], passingScore: 270, budgetPlaces: 60, paidPlaces: 200, paidCostPerYear: 360000 },
      { id: 904, name: "Бизнес-информатика", faculty: "Факультет ИТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 265, budgetPlaces: 70, paidPlaces: 100, paidCostPerYear: 360000 },
      { id: 905, name: "Юриспруденция", faculty: "Юридический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 285, budgetPlaces: 50, paidPlaces: 180, paidCostPerYear: 380000 },
      { id: 906, name: "Налоги и налогообложение", faculty: "Факультет налогов", subjects: ["ru", "math_prof", "social"], passingScore: 260, budgetPlaces: 40, paidPlaces: 120, paidCostPerYear: 350000 },
    ],
  },
  {
    id: 10, name: "МИРЭА - Российский технологический университет", shortName: "МИРЭА", city: "Москва", region: "Москва", type: "state", rating: 22, logo: "\u{1F4F1}",
    programs: [
      { id: 1001, name: "Информатика и ВТ", faculty: "Институт ИТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 250, budgetPlaces: 300, paidPlaces: 200, paidCostPerYear: 280000 },
      { id: 1002, name: "Программная инженерия", faculty: "Институт ИТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 255, budgetPlaces: 200, paidPlaces: 150, paidCostPerYear: 290000 },
      { id: 1003, name: "Кибербезопасность", faculty: "Институт кибербезопасности", subjects: ["ru", "math_prof", "informatics"], passingScore: 245, budgetPlaces: 150, paidPlaces: 100, paidCostPerYear: 290000 },
      { id: 1004, name: "Электроника", faculty: "Институт радиоэлектроники", subjects: ["ru", "math_prof", "physics"], passingScore: 220, budgetPlaces: 180, paidPlaces: 60, paidCostPerYear: 260000 },
      { id: 1005, name: "Химическая технология", faculty: "Институт тонких химических технологий", subjects: ["ru", "math_prof", "chemistry"], passingScore: 210, budgetPlaces: 120, paidPlaces: 40, paidCostPerYear: 260000 },
      { id: 1006, name: "Дизайн", faculty: "Институт ИТ", subjects: ["ru", "math_prof", "literature"], passingScore: 230, budgetPlaces: 40, paidPlaces: 120, paidCostPerYear: 310000 },
    ],
  },
  {
    id: 11, name: "Санкт-Петербургский государственный университет", shortName: "СПбГУ", city: "Санкт-Петербург", region: "Санкт-Петербург", type: "federal", rating: 6, logo: "\u{1F3F0}",
    programs: [
      { id: 1101, name: "Прикладная математика", faculty: "Матмех", subjects: ["ru", "math_prof", "informatics"], passingScore: 290, budgetPlaces: 200, paidPlaces: 50, paidCostPerYear: 350000 },
      { id: 1102, name: "Программная инженерия", faculty: "Матмех", subjects: ["ru", "math_prof", "informatics"], passingScore: 300, budgetPlaces: 150, paidPlaces: 60, paidCostPerYear: 360000 },
      { id: 1103, name: "Экономика", faculty: "Экономический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 320, budgetPlaces: 70, paidPlaces: 200, paidCostPerYear: 380000 },
      { id: 1104, name: "Юриспруденция", faculty: "Юридический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 330, budgetPlaces: 60, paidPlaces: 250, paidCostPerYear: 390000 },
      { id: 1105, name: "Международные отношения", faculty: "Факультет МО", subjects: ["ru", "history", "english"], passingScore: 340, budgetPlaces: 30, paidPlaces: 100, paidCostPerYear: 400000 },
      { id: 1106, name: "Филология", faculty: "Филологический факультет", subjects: ["ru", "english", "literature"], passingScore: 310, budgetPlaces: 80, paidPlaces: 40, paidCostPerYear: 330000 },
      { id: 1107, name: "Физика", faculty: "Физический факультет", subjects: ["ru", "math_prof", "physics"], passingScore: 275, budgetPlaces: 180, paidPlaces: 30, paidCostPerYear: 320000 },
      { id: 1108, name: "Химия", faculty: "Институт химии", subjects: ["ru", "math_prof", "chemistry"], passingScore: 265, budgetPlaces: 120, paidPlaces: 25, paidCostPerYear: 310000 },
      { id: 1109, name: "Биология", faculty: "Биологический факультет", subjects: ["ru", "math_prof", "biology"], passingScore: 270, budgetPlaces: 100, paidPlaces: 30, paidCostPerYear: 310000 },
      { id: 1110, name: "Журналистика", faculty: "Институт ВШЖМК", subjects: ["ru", "literature", "english"], passingScore: 315, budgetPlaces: 40, paidPlaces: 120, paidCostPerYear: 350000 },
      { id: 1111, name: "Лечебное дело", faculty: "Медицинский факультет", subjects: ["ru", "chemistry", "biology"], passingScore: 330, budgetPlaces: 50, paidPlaces: 100, paidCostPerYear: 420000 },
      { id: 1112, name: "Менеджмент", faculty: "ВШМБ", subjects: ["ru", "math_prof", "social"], passingScore: 305, budgetPlaces: 50, paidPlaces: 150, paidCostPerYear: 370000 },
    ],
  },
  {
    id: 12, name: "Университет ИТМО", shortName: "ИТМО", city: "Санкт-Петербург", region: "Санкт-Петербург", type: "national_research", rating: 7, logo: "\u{1F4A1}",
    programs: [
      { id: 1201, name: "Прикладная информатика", faculty: "Факультет ИТиП", subjects: ["ru", "math_prof", "informatics"], passingScore: 300, budgetPlaces: 250, paidPlaces: 100, paidCostPerYear: 340000 },
      { id: 1202, name: "Программная инженерия", faculty: "Факультет ИТиП", subjects: ["ru", "math_prof", "informatics"], passingScore: 310, budgetPlaces: 200, paidPlaces: 80, paidCostPerYear: 350000 },
      { id: 1203, name: "Информационная безопасность", faculty: "Факультет безопасности ИТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 285, budgetPlaces: 100, paidPlaces: 50, paidCostPerYear: 340000 },
      { id: 1204, name: "Фотоника", faculty: "Факультет фотоники", subjects: ["ru", "math_prof", "physics"], passingScore: 270, budgetPlaces: 80, paidPlaces: 20, paidCostPerYear: 320000 },
      { id: 1205, name: "Робототехника", faculty: "Мегафакультет КТУ", subjects: ["ru", "math_prof", "physics"], passingScore: 280, budgetPlaces: 70, paidPlaces: 30, paidCostPerYear: 330000 },
      { id: 1206, name: "Биотехнологии", faculty: "Мегафакультет ТиБС", subjects: ["ru", "math_prof", "chemistry"], passingScore: 275, budgetPlaces: 60, paidPlaces: 25, paidCostPerYear: 320000 },
      { id: 1207, name: "Дизайн", faculty: "Факультет ТМиД", subjects: ["ru", "math_prof", "literature"], passingScore: 280, budgetPlaces: 40, paidPlaces: 100, paidCostPerYear: 350000 },
      { id: 1208, name: "Управление в технических системах", faculty: "Мегафакультет КТУ", subjects: ["ru", "math_prof", "physics"], passingScore: 265, budgetPlaces: 90, paidPlaces: 20, paidCostPerYear: 310000 },
    ],
  },
  {
    id: 13, name: "Санкт-Петербургский политехнический университет Петра Великого", shortName: "СПбПолитех", city: "Санкт-Петербург", region: "Санкт-Петербург", type: "national_research", rating: 11, logo: "\u{1F3ED}",
    programs: [
      { id: 1301, name: "Информатика и ВТ", faculty: "ИКНиТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 265, budgetPlaces: 200, paidPlaces: 100, paidCostPerYear: 280000 },
      { id: 1302, name: "Прикладная математика", faculty: "ИПМиМ", subjects: ["ru", "math_prof", "physics"], passingScore: 255, budgetPlaces: 150, paidPlaces: 50, paidCostPerYear: 270000 },
      { id: 1303, name: "Машиностроение", faculty: "ИММиТ", subjects: ["ru", "math_prof", "physics"], passingScore: 230, budgetPlaces: 180, paidPlaces: 40, paidCostPerYear: 250000 },
      { id: 1304, name: "Энергетика", faculty: "ИЭиТ", subjects: ["ru", "math_prof", "physics"], passingScore: 225, budgetPlaces: 160, paidPlaces: 30, paidCostPerYear: 250000 },
      { id: 1305, name: "Экономика", faculty: "ИПМЭиТ", subjects: ["ru", "math_prof", "social"], passingScore: 260, budgetPlaces: 60, paidPlaces: 200, paidCostPerYear: 300000 },
      { id: 1306, name: "Менеджмент", faculty: "ИПМЭиТ", subjects: ["ru", "math_prof", "social"], passingScore: 250, budgetPlaces: 40, paidPlaces: 150, paidCostPerYear: 290000 },
      { id: 1307, name: "Биотехнологии", faculty: "ИБСиБ", subjects: ["ru", "math_prof", "biology"], passingScore: 240, budgetPlaces: 50, paidPlaces: 30, paidCostPerYear: 260000 },
      { id: 1308, name: "Строительство", faculty: "ИСИ", subjects: ["ru", "math_prof", "physics"], passingScore: 220, budgetPlaces: 120, paidPlaces: 50, paidCostPerYear: 250000 },
    ],
  },
  {
    id: 14, name: "Санкт-Петербургский государственный экономический университет", shortName: "СПбГЭУ", city: "Санкт-Петербург", region: "Санкт-Петербург", type: "state", rating: 25, logo: "\u{1F4CA}",
    programs: [
      { id: 1401, name: "Экономика", faculty: "Факультет экономики", subjects: ["ru", "math_prof", "social"], passingScore: 250, budgetPlaces: 80, paidPlaces: 300, paidCostPerYear: 260000 },
      { id: 1402, name: "Менеджмент", faculty: "Факультет менеджмента", subjects: ["ru", "math_prof", "social"], passingScore: 240, budgetPlaces: 60, paidPlaces: 250, paidCostPerYear: 250000 },
      { id: 1403, name: "Торговое дело", faculty: "Факультет торговли", subjects: ["ru", "math_prof", "social"], passingScore: 225, budgetPlaces: 70, paidPlaces: 200, paidCostPerYear: 240000 },
      { id: 1404, name: "Юриспруденция", faculty: "Юридический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 255, budgetPlaces: 30, paidPlaces: 150, paidCostPerYear: 270000 },
      { id: 1405, name: "Туризм", faculty: "Факультет сервиса и туризма", subjects: ["ru", "math_prof", "social"], passingScore: 215, budgetPlaces: 40, paidPlaces: 100, paidCostPerYear: 230000 },
    ],
  },
  {
    id: 15, name: "Новосибирский государственный университет", shortName: "НГУ", city: "Новосибирск", region: "Новосибирская обл.", type: "national_research", rating: 8, logo: "\u{1F52D}",
    programs: [
      { id: 1501, name: "Математика и компьютерные науки", faculty: "ММФ", subjects: ["ru", "math_prof", "informatics"], passingScore: 280, budgetPlaces: 200, paidPlaces: 40, paidCostPerYear: 250000 },
      { id: 1502, name: "Физика", faculty: "Физический факультет", subjects: ["ru", "math_prof", "physics"], passingScore: 265, budgetPlaces: 250, paidPlaces: 30, paidCostPerYear: 240000 },
      { id: 1503, name: "Информатика и ВТ", faculty: "ФИТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 290, budgetPlaces: 150, paidPlaces: 50, paidCostPerYear: 260000 },
      { id: 1504, name: "Экономика", faculty: "Экономический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 275, budgetPlaces: 50, paidPlaces: 100, paidCostPerYear: 260000 },
      { id: 1505, name: "Юриспруденция", faculty: "Юридический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 270, budgetPlaces: 40, paidPlaces: 80, paidCostPerYear: 250000 },
      { id: 1506, name: "Биология", faculty: "Факультет естественных наук", subjects: ["ru", "math_prof", "biology"], passingScore: 255, budgetPlaces: 80, paidPlaces: 20, paidCostPerYear: 240000 },
      { id: 1507, name: "Химия", faculty: "Факультет естественных наук", subjects: ["ru", "math_prof", "chemistry"], passingScore: 250, budgetPlaces: 70, paidPlaces: 15, paidCostPerYear: 240000 },
      { id: 1508, name: "Геология", faculty: "ГГФ", subjects: ["ru", "math_prof", "physics"], passingScore: 240, budgetPlaces: 60, paidPlaces: 10, paidCostPerYear: 230000 },
    ],
  },
  {
    id: 16, name: "Уральский федеральный университет", shortName: "УрФУ", city: "Екатеринбург", region: "Свердловская обл.", type: "federal", rating: 13, logo: "\u26CF\uFE0F",
    programs: [
      { id: 1601, name: "Информатика и ВТ", faculty: "ИРИТ-РтФ", subjects: ["ru", "math_prof", "informatics"], passingScore: 240, budgetPlaces: 250, paidPlaces: 100, paidCostPerYear: 220000 },
      { id: 1602, name: "Прикладная математика", faculty: "Институт естественных наук и математики", subjects: ["ru", "math_prof", "physics"], passingScore: 225, budgetPlaces: 120, paidPlaces: 40, paidCostPerYear: 210000 },
      { id: 1603, name: "Экономика", faculty: "Институт экономики и управления", subjects: ["ru", "math_prof", "social"], passingScore: 245, budgetPlaces: 80, paidPlaces: 250, paidCostPerYear: 230000 },
      { id: 1604, name: "Юриспруденция", faculty: "Юридический институт", subjects: ["ru", "math_prof", "social"], passingScore: 255, budgetPlaces: 50, paidPlaces: 200, paidCostPerYear: 240000 },
      { id: 1605, name: "Строительство", faculty: "Институт строительства", subjects: ["ru", "math_prof", "physics"], passingScore: 205, budgetPlaces: 150, paidPlaces: 60, paidCostPerYear: 200000 },
      { id: 1606, name: "Металлургия", faculty: "Институт новых материалов", subjects: ["ru", "math_prof", "physics"], passingScore: 200, budgetPlaces: 130, paidPlaces: 20, paidCostPerYear: 200000 },
      { id: 1607, name: "Журналистика", faculty: "Департамент журналистики", subjects: ["ru", "literature", "english"], passingScore: 250, budgetPlaces: 30, paidPlaces: 80, paidCostPerYear: 230000 },
      { id: 1608, name: "Международные отношения", faculty: "Институт экономики и управления", subjects: ["ru", "history", "english"], passingScore: 260, budgetPlaces: 20, paidPlaces: 60, paidCostPerYear: 240000 },
      { id: 1609, name: "Химия", faculty: "Институт естественных наук", subjects: ["ru", "math_prof", "chemistry"], passingScore: 210, budgetPlaces: 80, paidPlaces: 15, paidCostPerYear: 200000 },
      { id: 1610, name: "Филология", faculty: "Институт филологии", subjects: ["ru", "english", "literature"], passingScore: 235, budgetPlaces: 40, paidPlaces: 30, paidCostPerYear: 210000 },
    ],
  },
  {
    id: 17, name: "Казанский (Приволжский) федеральный университет", shortName: "КФУ", city: "Казань", region: "Татарстан", type: "federal", rating: 14, logo: "\u{1F3AF}",
    programs: [
      { id: 1701, name: "Информатика и ВТ", faculty: "ИВМИТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 245, budgetPlaces: 180, paidPlaces: 80, paidCostPerYear: 200000 },
      { id: 1702, name: "Экономика", faculty: "Институт управления", subjects: ["ru", "math_prof", "social"], passingScore: 255, budgetPlaces: 70, paidPlaces: 200, paidCostPerYear: 220000 },
      { id: 1703, name: "Юриспруденция", faculty: "Юридический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 265, budgetPlaces: 60, paidPlaces: 250, paidCostPerYear: 230000 },
      { id: 1704, name: "Лечебное дело", faculty: "Институт фундаментальной медицины", subjects: ["ru", "chemistry", "biology"], passingScore: 260, budgetPlaces: 100, paidPlaces: 200, paidCostPerYear: 250000 },
      { id: 1705, name: "Филология", faculty: "Институт филологии и МК", subjects: ["ru", "english", "literature"], passingScore: 240, budgetPlaces: 60, paidPlaces: 40, paidCostPerYear: 190000 },
      { id: 1706, name: "Физика", faculty: "Институт физики", subjects: ["ru", "math_prof", "physics"], passingScore: 230, budgetPlaces: 150, paidPlaces: 20, paidCostPerYear: 190000 },
      { id: 1707, name: "Нефтегазовое дело", faculty: "Институт геологии и нефтегазовых технологий", subjects: ["ru", "math_prof", "physics"], passingScore: 220, budgetPlaces: 100, paidPlaces: 50, paidCostPerYear: 210000 },
      { id: 1708, name: "Психология", faculty: "Институт психологии и образования", subjects: ["ru", "math_prof", "biology"], passingScore: 250, budgetPlaces: 40, paidPlaces: 100, paidCostPerYear: 210000 },
    ],
  },
  {
    id: 18, name: "Национальный исследовательский Томский государственный университет", shortName: "ТГУ", city: "Томск", region: "Томская обл.", type: "national_research", rating: 15, logo: "\u{1F4DA}",
    programs: [
      { id: 1801, name: "Прикладная информатика", faculty: "ФИТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 245, budgetPlaces: 120, paidPlaces: 50, paidCostPerYear: 200000 },
      { id: 1802, name: "Экономика", faculty: "Экономический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 240, budgetPlaces: 60, paidPlaces: 150, paidCostPerYear: 200000 },
      { id: 1803, name: "Юриспруденция", faculty: "Юридический институт", subjects: ["ru", "math_prof", "social"], passingScore: 250, budgetPlaces: 50, paidPlaces: 150, paidCostPerYear: 210000 },
      { id: 1804, name: "Физика", faculty: "Физический факультет", subjects: ["ru", "math_prof", "physics"], passingScore: 230, budgetPlaces: 180, paidPlaces: 20, paidCostPerYear: 190000 },
      { id: 1805, name: "Биология", faculty: "Биологический институт", subjects: ["ru", "math_prof", "biology"], passingScore: 225, budgetPlaces: 80, paidPlaces: 20, paidCostPerYear: 190000 },
      { id: 1806, name: "Филология", faculty: "Филологический факультет", subjects: ["ru", "english", "literature"], passingScore: 235, budgetPlaces: 50, paidPlaces: 30, paidCostPerYear: 190000 },
      { id: 1807, name: "Журналистика", faculty: "Факультет журналистики", subjects: ["ru", "literature", "english"], passingScore: 240, budgetPlaces: 25, paidPlaces: 60, paidCostPerYear: 200000 },
      { id: 1808, name: "Химия", faculty: "Химический факультет", subjects: ["ru", "math_prof", "chemistry"], passingScore: 220, budgetPlaces: 70, paidPlaces: 10, paidCostPerYear: 190000 },
    ],
  },
  {
    id: 19, name: "Национальный исследовательский Томский политехнический университет", shortName: "ТПУ", city: "Томск", region: "Томская обл.", type: "national_research", rating: 16, logo: "\u2697\uFE0F",
    programs: [
      { id: 1901, name: "Информатика и ВТ", faculty: "Инженерная школа ИТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 255, budgetPlaces: 150, paidPlaces: 60, paidCostPerYear: 210000 },
      { id: 1902, name: "Электроэнергетика", faculty: "ИШЭ", subjects: ["ru", "math_prof", "physics"], passingScore: 230, budgetPlaces: 180, paidPlaces: 40, paidCostPerYear: 200000 },
      { id: 1903, name: "Нефтегазовое дело", faculty: "ИШПиР", subjects: ["ru", "math_prof", "physics"], passingScore: 235, budgetPlaces: 120, paidPlaces: 60, paidCostPerYear: 210000 },
      { id: 1904, name: "Химическая технология", faculty: "ИШХБМТ", subjects: ["ru", "math_prof", "chemistry"], passingScore: 225, budgetPlaces: 100, paidPlaces: 30, paidCostPerYear: 200000 },
      { id: 1905, name: "Ядерная физика", faculty: "ИШЯТиФ", subjects: ["ru", "math_prof", "physics"], passingScore: 240, budgetPlaces: 80, paidPlaces: 15, paidCostPerYear: 210000 },
      { id: 1906, name: "Машиностроение", faculty: "ИШНПТ", subjects: ["ru", "math_prof", "physics"], passingScore: 220, budgetPlaces: 100, paidPlaces: 25, paidCostPerYear: 190000 },
    ],
  },
  {
    id: 20, name: "Южный федеральный университет", shortName: "ЮФУ", city: "Ростов-на-Дону", region: "Ростовская обл.", type: "federal", rating: 19, logo: "\u2600\uFE0F",
    programs: [
      { id: 2001, name: "Информатика и ВТ", faculty: "ИКТИБ", subjects: ["ru", "math_prof", "informatics"], passingScore: 230, budgetPlaces: 150, paidPlaces: 80, paidCostPerYear: 190000 },
      { id: 2002, name: "Экономика", faculty: "Экономический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 240, budgetPlaces: 60, paidPlaces: 200, paidCostPerYear: 200000 },
      { id: 2003, name: "Юриспруденция", faculty: "Юридический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 250, budgetPlaces: 50, paidPlaces: 150, paidCostPerYear: 210000 },
      { id: 2004, name: "Физика", faculty: "Физический факультет", subjects: ["ru", "math_prof", "physics"], passingScore: 215, budgetPlaces: 100, paidPlaces: 20, paidCostPerYear: 180000 },
      { id: 2005, name: "Журналистика", faculty: "Факультет филологии и журналистики", subjects: ["ru", "literature", "english"], passingScore: 235, budgetPlaces: 30, paidPlaces: 80, paidCostPerYear: 190000 },
      { id: 2006, name: "Психология", faculty: "Академия психологии и педагогики", subjects: ["ru", "math_prof", "biology"], passingScore: 225, budgetPlaces: 40, paidPlaces: 100, paidCostPerYear: 190000 },
    ],
  },
  {
    id: 21, name: "Дальневосточный федеральный университет", shortName: "ДВФУ", city: "Владивосток", region: "Приморский край", type: "federal", rating: 20, logo: "\u{1F30A}",
    programs: [
      { id: 2101, name: "Информатика и ВТ", faculty: "Политехнический институт", subjects: ["ru", "math_prof", "informatics"], passingScore: 210, budgetPlaces: 120, paidPlaces: 60, paidCostPerYear: 180000 },
      { id: 2102, name: "Экономика", faculty: "Школа экономики и менеджмента", subjects: ["ru", "math_prof", "social"], passingScore: 220, budgetPlaces: 60, paidPlaces: 150, paidCostPerYear: 190000 },
      { id: 2103, name: "Юриспруденция", faculty: "Юридическая школа", subjects: ["ru", "math_prof", "social"], passingScore: 230, budgetPlaces: 40, paidPlaces: 120, paidCostPerYear: 200000 },
      { id: 2104, name: "Востоковедение", faculty: "Восточный институт", subjects: ["ru", "history", "english"], passingScore: 240, budgetPlaces: 30, paidPlaces: 60, paidCostPerYear: 210000 },
      { id: 2105, name: "Биология", faculty: "Институт наук о жизни", subjects: ["ru", "math_prof", "biology"], passingScore: 195, budgetPlaces: 60, paidPlaces: 20, paidCostPerYear: 170000 },
    ],
  },
  {
    id: 22, name: "Сибирский федеральный университет", shortName: "СФУ", city: "Красноярск", region: "Красноярский край", type: "federal", rating: 17, logo: "\u{1F332}",
    programs: [
      { id: 2201, name: "Информатика и ВТ", faculty: "ИКИТ", subjects: ["ru", "math_prof", "informatics"], passingScore: 220, budgetPlaces: 150, paidPlaces: 60, paidCostPerYear: 180000 },
      { id: 2202, name: "Экономика", faculty: "Институт экономики", subjects: ["ru", "math_prof", "social"], passingScore: 230, budgetPlaces: 60, paidPlaces: 180, paidCostPerYear: 190000 },
      { id: 2203, name: "Юриспруденция", faculty: "Юридический институт", subjects: ["ru", "math_prof", "social"], passingScore: 240, budgetPlaces: 50, paidPlaces: 150, paidCostPerYear: 200000 },
      { id: 2204, name: "Нефтегазовое дело", faculty: "Институт нефти и газа", subjects: ["ru", "math_prof", "physics"], passingScore: 210, budgetPlaces: 100, paidPlaces: 50, paidCostPerYear: 190000 },
      { id: 2205, name: "Металлургия", faculty: "Институт цветных металлов", subjects: ["ru", "math_prof", "physics"], passingScore: 195, budgetPlaces: 120, paidPlaces: 20, paidCostPerYear: 180000 },
      { id: 2206, name: "Строительство", faculty: "Инженерно-строительный институт", subjects: ["ru", "math_prof", "physics"], passingScore: 200, budgetPlaces: 130, paidPlaces: 40, paidCostPerYear: 180000 },
    ],
  },
  {
    id: 23, name: "Самарский национальный исследовательский университет", shortName: "Самарский университет", city: "Самара", region: "Самарская обл.", type: "national_research", rating: 21, logo: "\u{1F6EB}",
    programs: [
      { id: 2301, name: "Информатика и ВТ", faculty: "Факультет информатики", subjects: ["ru", "math_prof", "informatics"], passingScore: 225, budgetPlaces: 120, paidPlaces: 60, paidCostPerYear: 180000 },
      { id: 2302, name: "Авиастроение", faculty: "Институт авиационной техники", subjects: ["ru", "math_prof", "physics"], passingScore: 215, budgetPlaces: 100, paidPlaces: 30, paidCostPerYear: 180000 },
      { id: 2303, name: "Ракетные комплексы", faculty: "Институт двигателей и энергетики", subjects: ["ru", "math_prof", "physics"], passingScore: 210, budgetPlaces: 80, paidPlaces: 20, paidCostPerYear: 180000 },
      { id: 2304, name: "Экономика", faculty: "Институт экономики и управления", subjects: ["ru", "math_prof", "social"], passingScore: 230, budgetPlaces: 50, paidPlaces: 150, paidCostPerYear: 190000 },
      { id: 2305, name: "Юриспруденция", faculty: "Юридический институт", subjects: ["ru", "math_prof", "social"], passingScore: 240, budgetPlaces: 40, paidPlaces: 100, paidCostPerYear: 200000 },
    ],
  },
  {
    id: 24, name: "Нижегородский государственный университет им. Н.И. Лобачевского", shortName: "ННГУ", city: "Нижний Новгород", region: "Нижегородская обл.", type: "national_research", rating: 23, logo: "\u{1F3D7}\uFE0F",
    programs: [
      { id: 2401, name: "Информатика и ВТ", faculty: "ИИТММ", subjects: ["ru", "math_prof", "informatics"], passingScore: 240, budgetPlaces: 130, paidPlaces: 60, paidCostPerYear: 190000 },
      { id: 2402, name: "Экономика", faculty: "Институт экономики и предпринимательства", subjects: ["ru", "math_prof", "social"], passingScore: 245, budgetPlaces: 60, paidPlaces: 180, paidCostPerYear: 200000 },
      { id: 2403, name: "Юриспруденция", faculty: "Юридический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 255, budgetPlaces: 40, paidPlaces: 150, paidCostPerYear: 210000 },
      { id: 2404, name: "Физика", faculty: "Физический факультет", subjects: ["ru", "math_prof", "physics"], passingScore: 220, budgetPlaces: 100, paidPlaces: 20, paidCostPerYear: 180000 },
      { id: 2405, name: "Биология", faculty: "Институт биологии и биомедицины", subjects: ["ru", "math_prof", "biology"], passingScore: 215, budgetPlaces: 60, paidPlaces: 20, paidCostPerYear: 180000 },
      { id: 2406, name: "Химия", faculty: "Химический факультет", subjects: ["ru", "math_prof", "chemistry"], passingScore: 210, budgetPlaces: 60, paidPlaces: 15, paidCostPerYear: 180000 },
    ],
  },
  {
    id: 25, name: "Воронежский государственный университет", shortName: "ВГУ", city: "Воронеж", region: "Воронежская обл.", type: "state", rating: 28, logo: "\u{1F33B}",
    programs: [
      { id: 2501, name: "Прикладная информатика", faculty: "Факультет компьютерных наук", subjects: ["ru", "math_prof", "informatics"], passingScore: 220, budgetPlaces: 100, paidPlaces: 50, paidCostPerYear: 160000 },
      { id: 2502, name: "Экономика", faculty: "Экономический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 225, budgetPlaces: 50, paidPlaces: 150, paidCostPerYear: 170000 },
      { id: 2503, name: "Юриспруденция", faculty: "Юридический факультет", subjects: ["ru", "math_prof", "social"], passingScore: 240, budgetPlaces: 40, paidPlaces: 200, paidCostPerYear: 180000 },
      { id: 2504, name: "Журналистика", faculty: "Факультет журналистики", subjects: ["ru", "literature", "english"], passingScore: 230, budgetPlaces: 25, paidPlaces: 60, paidCostPerYear: 160000 },
      { id: 2505, name: "Физика", faculty: "Физический факультет", subjects: ["ru", "math_prof", "physics"], passingScore: 195, budgetPlaces: 80, paidPlaces: 15, paidCostPerYear: 150000 },
    ],
  },
];

const TYPE_LABELS: Record<string, string> = {
  federal: "Федеральный",
  national_research: "Исследовательский",
  state: "Государственный",
  private: "Частный",
};

const TYPE_COLORS: Record<string, string> = {
  federal: "bg-blue-100 text-blue-700",
  national_research: "bg-purple-100 text-purple-700",
  state: "bg-gray-100 text-gray-700",
  private: "bg-orange-100 text-orange-700",
};

type Screen = "input" | "results";
type SortOption = "score_asc" | "rating" | "cost";
type CityFilter = "all" | "Москва" | "Санкт-Петербург" | "other";
type BudgetFilter = "all" | "budget";

function formatCost(cost: number): string {
  if (cost >= 1000000) return `${(cost / 1000000).toFixed(1)} млн`;
  return `${Math.round(cost / 1000)} тыс`;
}

const UniversityFinder = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("input");
  const [subjectEntries, setSubjectEntries] = useState<SubjectEntry[]>([
    { id: "1", subjectId: "ru", score: 0 },
    { id: "2", subjectId: "math_prof", score: 0 },
    { id: "3", subjectId: "social", score: 0 },
  ]);
  const [cityFilter, setCityFilter] = useState<CityFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("score_asc");
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("all");
  const [expandedUni, setExpandedUni] = useState<Set<number>>(new Set());
  const [searchText, setSearchText] = useState("");

  const userSubjects = useMemo(() => {
    const map: Record<string, number> = {};
    subjectEntries.forEach((e) => {
      if (e.score > 0) map[e.subjectId] = e.score;
    });
    return map;
  }, [subjectEntries]);

  const totalScore = useMemo(
    () => Object.values(userSubjects).reduce((s, v) => s + v, 0),
    [userSubjects]
  );

  const userSubjectIds = useMemo(
    () => new Set(Object.keys(userSubjects)),
    [userSubjects]
  );

  const matchResults = useMemo(() => {
    type ProgramMatch = {
      program: Program;
      university: University;
      userTotal: number;
      diff: number;
      chance: "high" | "medium" | "low";
    };

    const matches: ProgramMatch[] = [];

    UNIVERSITIES.forEach((uni) => {
      if (cityFilter === "Москва" && uni.city !== "Москва") return;
      if (cityFilter === "Санкт-Петербург" && uni.city !== "Санкт-Петербург") return;
      if (cityFilter === "other" && (uni.city === "Москва" || uni.city === "Санкт-Петербург")) return;

      if (searchText) {
        const q = searchText.toLowerCase();
        const haystack = `${uni.name} ${uni.shortName} ${uni.city}`.toLowerCase();
        if (!haystack.includes(q)) return;
      }

      uni.programs.forEach((prog) => {
        const hasAllSubjects = prog.subjects.every((s) => userSubjectIds.has(s));
        if (!hasAllSubjects) return;

        if (budgetFilter === "budget" && prog.budgetPlaces === 0) return;

        const userTotal = prog.subjects.reduce((sum, s) => sum + (userSubjects[s] || 0), 0);
        const diff = userTotal - prog.passingScore;

        if (diff < -20) return;

        const chance: "high" | "medium" | "low" =
          diff >= 20 ? "high" : diff >= 0 ? "medium" : "low";

        matches.push({ program: prog, university: uni, userTotal, diff, chance });
      });
    });

    if (sortBy === "score_asc") {
      matches.sort((a, b) => a.program.passingScore - b.program.passingScore);
    } else if (sortBy === "rating") {
      matches.sort((a, b) => a.university.rating - b.university.rating);
    } else if (sortBy === "cost") {
      matches.sort((a, b) => a.program.paidCostPerYear - b.program.paidCostPerYear);
    }

    return matches;
  }, [userSubjects, userSubjectIds, cityFilter, budgetFilter, sortBy, searchText]);

  const groupedByUni = useMemo(() => {
    const map = new Map<
      number,
      { university: University; programs: typeof matchResults }
    >();
    matchResults.forEach((m) => {
      if (!map.has(m.university.id)) {
        map.set(m.university.id, { university: m.university, programs: [] });
      }
      map.get(m.university.id)!.programs.push(m);
    });
    return Array.from(map.values());
  }, [matchResults]);

  const passCount = matchResults.filter((m) => m.chance === "high" || m.chance === "medium").length;
  const chanceCount = matchResults.filter((m) => m.chance === "low").length;
  const uniCount = groupedByUni.length;

  const handleSubjectChange = (entryId: string, subjectId: string) => {
    setSubjectEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, subjectId, score: e.score } : e))
    );
  };

  const handleScoreChange = (entryId: string, score: number) => {
    setSubjectEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, score: Math.min(100, Math.max(0, score)) } : e))
    );
  };

  const addSubject = () => {
    if (subjectEntries.length >= 4) return;
    const used = new Set(subjectEntries.map((e) => e.subjectId));
    const available = SUBJECT_OPTIONS.find((s) => !used.has(s.id));
    setSubjectEntries((prev) => [
      ...prev,
      { id: String(Date.now()), subjectId: available?.id || "history", score: 0 },
    ]);
  };

  const removeSubject = (entryId: string) => {
    if (subjectEntries.length <= 1) return;
    setSubjectEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const toggleUni = (id: number) => {
    setExpandedUni((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderInputScreen = () => (
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
            <h1 className="text-lg font-bold text-gray-900">Подбор вузов</h1>
            <p className="text-xs text-gray-500">по баллам ЕГЭ</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto bg-purple-100 rounded-2xl flex items-center justify-center mb-3">
            <Icon name="GraduationCap" size={32} className="text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Узнай, куда ты можешь поступить
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Введи свои тестовые баллы ЕГЭ
          </p>
        </div>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4 space-y-3">
            {subjectEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <Select
                  value={entry.subjectId}
                  onValueChange={(val) => handleSubjectChange(entry.id, val)}
                >
                  <SelectTrigger className="flex-1 h-10 text-sm rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_OPTIONS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span>{s.icon}</span>
                          <span>{s.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={entry.score || ""}
                  onChange={(e) =>
                    handleScoreChange(entry.id, parseInt(e.target.value, 10) || 0)
                  }
                  placeholder="0"
                  className="w-20 h-10 text-center text-sm font-bold rounded-xl"
                />
                {subjectEntries.length > 1 && (
                  <button
                    onClick={() => removeSubject(entry.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Icon name="X" size={16} />
                  </button>
                )}
              </div>
            ))}

            {subjectEntries.length < 4 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addSubject}
                className="w-full rounded-xl text-sm border-dashed"
              >
                <Icon name="Plus" size={14} />
                Добавить предмет
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-purple-50/70">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Сумма баллов:</span>
            <span className="text-2xl font-black text-purple-700">{totalScore}</span>
          </CardContent>
        </Card>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Город</label>
          <div className="flex gap-2">
            {(
              [
                { val: "all", label: "Все" },
                { val: "Москва", label: "Москва" },
                { val: "Санкт-Петербург", label: "СПб" },
                { val: "other", label: "Другие" },
              ] as const
            ).map((c) => (
              <button
                key={c.val}
                onClick={() => setCityFilter(c.val)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  cityFilter === c.val
                    ? "bg-purple-600 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => {
            setExpandedUni(new Set());
            setScreen("results");
          }}
          disabled={totalScore === 0}
          className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-lg shadow-purple-200"
        >
          <Icon name="Search" size={18} />
          Найти вузы
        </Button>

        <div className="space-y-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/calculator")}
            className="w-full rounded-xl text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
          >
            <Icon name="Calculator" size={14} />
            Рассчитай свои баллы в калькуляторе
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/mock-exam")}
            className="w-full rounded-xl text-xs text-gray-600 border-gray-200 hover:bg-gray-50"
          >
            <Icon name="FileText" size={14} />
            Пройди пробный тест, чтобы узнать свой балл
          </Button>
        </div>
      </div>
    </div>
  );

  const renderResultsScreen = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setScreen("input")}
              className="p-2 -ml-2 rounded-xl hover:bg-purple-50 transition-colors"
            >
              <Icon name="ArrowLeft" size={20} className="text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-gray-900">Результаты подбора</h1>
              <p className="text-xs text-gray-500">
                Сумма: {totalScore} | {passCount + chanceCount} программ в {uniCount} вузах
              </p>
            </div>
          </div>

          <div className="mt-3">
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Поиск по названию вуза..."
              className="h-9 text-sm rounded-xl bg-gray-50"
            />
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[140px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score_asc">По проходному баллу</SelectItem>
                <SelectItem value="rating">По рейтингу</SelectItem>
                <SelectItem value="cost">По стоимости</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => setBudgetFilter(budgetFilter === "all" ? "budget" : "all")}
              className={`px-3 h-8 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                budgetFilter === "budget"
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              <span className="flex items-center gap-1">
                <Icon name="Wallet" size={12} />
                Только бюджет
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {passCount > 0 && (
          <div className="flex gap-3">
            <Card className="flex-1 border-0 shadow-sm bg-green-50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-green-700">{passCount}</p>
                <p className="text-[10px] text-green-600">Проходишь</p>
              </CardContent>
            </Card>
            <Card className="flex-1 border-0 shadow-sm bg-yellow-50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-yellow-700">{chanceCount}</p>
                <p className="text-[10px] text-yellow-600">Шанс есть</p>
              </CardContent>
            </Card>
            <Card className="flex-1 border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-gray-700">{uniCount}</p>
                <p className="text-[10px] text-gray-500">Вузов</p>
              </CardContent>
            </Card>
          </div>
        )}

        {groupedByUni.length === 0 && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Icon name="SearchX" size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Ничего не найдено</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                Попробуй добавить другие предметы, изменить город или увеличить баллы
              </p>
              <div className="space-y-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScreen("input")}
                  className="rounded-xl text-sm"
                >
                  <Icon name="ArrowLeft" size={14} />
                  Изменить параметры
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/calculator")}
                  className="rounded-xl text-sm text-purple-600 border-purple-200"
                >
                  <Icon name="Calculator" size={14} />
                  Рассчитай баллы точнее
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {groupedByUni.map(({ university: uni, programs: progs }) => {
          const isExpanded = expandedUni.has(uni.id);
          const visibleProgs = isExpanded ? progs : progs.slice(0, 2);
          return (
            <Card key={uni.id} className="border-0 shadow-sm overflow-hidden transition-all">
              <CardContent className="p-0">
                <div className="p-4 pb-2">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{uni.logo}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 leading-tight">
                        {uni.shortName}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {uni.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {uni.city}
                        </Badge>
                        <Badge
                          className={`text-[10px] px-1.5 py-0 border-0 ${TYPE_COLORS[uni.type]}`}
                        >
                          {TYPE_LABELS[uni.type]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-purple-200 text-purple-600"
                        >
                          #{uni.rating} в рейтинге
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-3 space-y-2">
                  {visibleProgs.map((match) => {
                    const chanceColor =
                      match.chance === "high"
                        ? "bg-green-50 border-green-200"
                        : match.chance === "medium"
                        ? "bg-green-50/50 border-green-100"
                        : "bg-yellow-50 border-yellow-200";
                    const chanceText =
                      match.chance === "high"
                        ? "Высокий шанс"
                        : match.chance === "medium"
                        ? "Средний шанс"
                        : "Низкий шанс";
                    const chanceTextColor =
                      match.chance === "high"
                        ? "text-green-700"
                        : match.chance === "medium"
                        ? "text-green-600"
                        : "text-yellow-700";

                    return (
                      <div
                        key={match.program.id}
                        className={`p-3 rounded-xl border ${chanceColor} transition-all`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 leading-tight">
                              {match.program.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {match.program.faculty}
                            </p>
                          </div>
                          <Badge
                            className={`text-[10px] px-1.5 py-0.5 border-0 shrink-0 ${
                              match.chance === "high"
                                ? "bg-green-100 text-green-700"
                                : match.chance === "medium"
                                ? "bg-green-100/80 text-green-600"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {chanceText}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {match.program.subjects.map((s) => {
                            const subj = SUBJECT_OPTIONS.find((so) => so.id === s);
                            return (
                              <Badge
                                key={s}
                                variant="outline"
                                className="text-[9px] px-1 py-0 border-gray-200 text-gray-500"
                              >
                                {subj?.icon} {subj?.name || s}
                              </Badge>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between mt-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Проходной:</span>
                            <span className="font-bold text-gray-800">
                              {match.program.passingScore}
                            </span>
                            <span className="text-gray-400">|</span>
                            <span className="text-gray-500">Ваш:</span>
                            <span className={`font-bold ${chanceTextColor}`}>
                              {match.userTotal}
                            </span>
                            <span className={`font-medium ${chanceTextColor}`}>
                              ({match.diff >= 0 ? "+" : ""}
                              {match.diff})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                          <span className="flex items-center gap-0.5">
                            <Icon name="Users" size={10} />
                            {match.program.budgetPlaces} бюджет
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Icon name="Banknote" size={10} />
                            {formatCost(match.program.paidCostPerYear)}/год
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Icon name="UserPlus" size={10} />
                            {match.program.paidPlaces} платно
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {progs.length > 2 && (
                    <button
                      onClick={() => toggleUni(uni.id)}
                      className="w-full py-2 text-xs text-purple-600 font-medium flex items-center justify-center gap-1 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          Свернуть <Icon name="ChevronUp" size={14} />
                        </>
                      ) : (
                        <>
                          Ещё {progs.length - 2} программ{" "}
                          <Icon name="ChevronDown" size={14} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {groupedByUni.length > 0 && (
          <div className="text-center pt-4 space-y-2">
            <p className="text-xs text-gray-400">
              Данные приблизительные и основаны на результатах прошлых лет
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScreen("input")}
              className="rounded-xl text-sm"
            >
              <Icon name="SlidersHorizontal" size={14} />
              Изменить параметры
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {screen === "input" && renderInputScreen()}
      {screen === "results" && renderResultsScreen()}
      <BottomNav />
    </>
  );
};

export default UniversityFinder;
