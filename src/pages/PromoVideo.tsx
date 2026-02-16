import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const SCENE_DURATION = 3500;

interface Scene {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}

const SCENES: Scene[] = [
  {
    id: 0,
    title: "Studyfay",
    subtitle: "Учись умнее, а не больше",
    icon: "GraduationCap",
    color: "from-[hsl(262,90%,65%)] to-[hsl(280,100%,70%)]",
  },
  {
    id: 1,
    title: "ИИ-репетитор",
    subtitle: "Задавай вопросы по своим конспектам",
    icon: "Bot",
    color: "from-[hsl(262,90%,55%)] to-[hsl(240,80%,65%)]",
  },
  {
    id: 2,
    title: "Расписание",
    subtitle: "Лекции, семинары и практики",
    icon: "CalendarDays",
    color: "from-[hsl(262,90%,60%)] to-[hsl(300,80%,65%)]",
  },
  {
    id: 3,
    title: "Геймификация",
    subtitle: "XP, уровни, стрики и достижения",
    icon: "Trophy",
    color: "from-[hsl(45,100%,55%)] to-[hsl(30,100%,60%)]",
  },
  {
    id: 4,
    title: "Помодоро",
    subtitle: "Учись эффективно с таймером",
    icon: "Timer",
    color: "from-[hsl(150,80%,40%)] to-[hsl(170,80%,45%)]",
  },
  {
    id: 5,
    title: "Скачай в RuStore",
    subtitle: "Бесплатно. Первые 7 дней Premium в подарок",
    icon: "Download",
    color: "from-[hsl(262,90%,65%)] to-[hsl(280,100%,70%)]",
  },
];

function TypingText({ text, active }: { text: string; active: boolean }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      return;
    }
    setDisplayed("");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [active, text]);

  return (
    <span>
      {displayed}
      {active && displayed.length < text.length && (
        <span className="inline-block w-0.5 h-5 bg-white/80 ml-0.5 animate-pulse align-middle" />
      )}
    </span>
  );
}

function SceneLogo({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div
        className={`transition-all duration-700 ${
          active ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      >
        <div className="w-28 h-28 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 mx-auto border border-white/30 shadow-2xl">
          <Icon name="GraduationCap" size={56} className="text-white" />
        </div>
      </div>
      <h1
        className={`text-6xl md:text-8xl font-extrabold text-white font-[Montserrat] tracking-tight transition-all duration-700 delay-300 ${
          active ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        Studyfay
      </h1>
      <p
        className={`text-xl md:text-2xl text-white/80 transition-all duration-700 delay-500 ${
          active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        Учись умнее, а не больше
      </p>
    </div>
  );
}

function SceneAI({ active }: { active: boolean }) {
  const messages = [
    { role: "user" as const, text: "Объясни второй закон Ньютона" },
    { role: "ai" as const, text: "F = ma. Сила равна произведению массы тела на его ускорение. Чем больше масса, тем большая сила нужна для того же ускорения." },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <div
        className={`transition-all duration-500 ${
          active ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
          <Icon name="Bot" size={32} className="text-white" />
        </div>
      </div>
      <div className="w-full max-w-md space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`transition-all duration-500 ${
              active ? "translate-x-0 opacity-100" : msg.role === "user" ? "translate-x-8 opacity-0" : "-translate-x-8 opacity-0"
            }`}
            style={{ transitionDelay: active ? `${300 + i * 400}ms` : "0ms" }}
          >
            <div
              className={`rounded-2xl px-4 py-3 text-sm md:text-base ${
                msg.role === "user"
                  ? "bg-white/20 text-white ml-12 text-right"
                  : "bg-white/10 text-white/90 mr-8 border border-white/20"
              }`}
            >
              {msg.role === "ai" ? (
                <TypingText text={msg.text} active={active} />
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneSchedule({ active }: { active: boolean }) {
  const items = [
    { time: "08:30", name: "Математический анализ", type: "Лекция", room: "А-301" },
    { time: "10:15", name: "Физика", type: "Семинар", room: "Б-205" },
    { time: "12:00", name: "Программирование", type: "Практика", room: "В-412" },
    { time: "14:00", name: "Английский язык", type: "Семинар", room: "Г-108" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <div
        className={`transition-all duration-500 ${
          active ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-2">
          <Icon name="CalendarDays" size={32} className="text-white" />
        </div>
        <p className="text-white/70 text-sm text-center mb-4">Понедельник, 17 февраля</p>
      </div>
      <div className="w-full max-w-sm space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 transition-all duration-500 ${
              active ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
            }`}
            style={{ transitionDelay: active ? `${200 + i * 150}ms` : "0ms" }}
          >
            <span className="text-white/60 text-xs font-mono w-10 shrink-0">{item.time}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{item.name}</p>
              <p className="text-white/50 text-xs">{item.type} / {item.room}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneGamification({ active }: { active: boolean }) {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(5);
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    if (!active) {
      setXp(0);
      setLevel(5);
      setShowLevelUp(false);
      return;
    }
    const t1 = setTimeout(() => setXp(65), 400);
    const t2 = setTimeout(() => setXp(85), 800);
    const t3 = setTimeout(() => {
      setXp(100);
      setShowLevelUp(true);
      setLevel(6);
    }, 1400);
    const t4 = setTimeout(() => setXp(15), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [active]);

  const achievements = [
    { icon: "Flame", label: "7-дневный стрик" },
    { icon: "Star", label: "100 задач" },
    { icon: "Zap", label: "Скоростной" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-4">
      <div
        className={`transition-all duration-500 ${
          active ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-2">
          <Icon name="Trophy" size={32} className="text-white" />
        </div>
      </div>
      <div className="w-full max-w-xs">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white font-bold text-lg">Уровень {level}</span>
          <span className="text-white/60 text-sm">{xp}/100 XP</span>
        </div>
        <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden border border-white/20">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${xp}%` }}
          />
        </div>
      </div>
      {showLevelUp && (
        <div className="animate-bounce text-yellow-300 font-extrabold text-2xl flex items-center gap-2">
          <Icon name="ArrowUp" size={24} />
          LEVEL UP!
        </div>
      )}
      <div className="flex gap-3 mt-2">
        {achievements.map((a, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-1.5 bg-white/10 rounded-xl px-4 py-3 border border-white/10 transition-all duration-500 ${
              active ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
            style={{ transitionDelay: active ? `${600 + i * 200}ms` : "0ms" }}
          >
            <Icon name={a.icon} size={24} className="text-yellow-300" />
            <span className="text-white/80 text-[10px] text-center">{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenePomodoro({ active }: { active: boolean }) {
  const [seconds, setSeconds] = useState(1500);

  useEffect(() => {
    if (!active) {
      setSeconds(1500);
      return;
    }
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1440) return prev;
        return prev - 1;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [active]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = ((1500 - seconds) / 1500) * 100;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <div
        className={`transition-all duration-500 ${
          active ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
          <Icon name="Timer" size={32} className="text-white" />
        </div>
      </div>
      <div
        className={`relative w-52 h-52 transition-all duration-700 ${
          active ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      >
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 88}
            strokeDashoffset={2 * Math.PI * 88 * (1 - progress / 100)}
            className="transition-all duration-200"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white text-5xl font-mono font-bold">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <span className="text-white/50 text-sm mt-1">Фокус</span>
        </div>
      </div>
      <div
        className={`flex gap-6 text-center transition-all duration-500 delay-500 ${
          active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div>
          <p className="text-white font-bold text-xl">4</p>
          <p className="text-white/50 text-xs">Сессии</p>
        </div>
        <div>
          <p className="text-white font-bold text-xl">1ч 40м</p>
          <p className="text-white/50 text-xs">Время</p>
        </div>
        <div>
          <p className="text-white font-bold text-xl">+120</p>
          <p className="text-white/50 text-xs">XP</p>
        </div>
      </div>
    </div>
  );
}

function SceneCTA({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <div
        className={`transition-all duration-700 ${
          active ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      >
        <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto border border-white/30 shadow-2xl">
          <Icon name="GraduationCap" size={48} className="text-white" />
        </div>
      </div>
      <h2
        className={`text-4xl md:text-5xl font-extrabold text-white text-center font-[Montserrat] transition-all duration-700 delay-200 ${
          active ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        Studyfay
      </h2>
      <p
        className={`text-lg text-white/80 text-center max-w-sm transition-all duration-700 delay-400 ${
          active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        Бесплатно. Первые 7 дней Premium в подарок
      </p>
      <div
        className={`transition-all duration-700 delay-[600ms] ${
          active ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-90"
        }`}
      >
        <div className="bg-white text-[hsl(262,90%,55%)] font-bold text-lg px-8 py-4 rounded-2xl flex items-center gap-3 shadow-2xl">
          <Icon name="Download" size={24} />
          Скачай в RuStore
        </div>
      </div>
      <div
        className={`flex gap-4 mt-2 transition-all duration-700 delay-[800ms] ${
          active ? "opacity-100" : "opacity-0"
        }`}
      >
        {["Bot", "Trophy", "Timer", "CalendarDays", "BarChart3"].map((icon, i) => (
          <div
            key={icon}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <Icon name={icon} size={18} className="text-white/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

const SCENE_COMPONENTS = [SceneLogo, SceneAI, SceneSchedule, SceneGamification, ScenePomodoro, SceneCTA];

const PromoVideo = () => {
  const [currentScene, setCurrentScene] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentScene((prev) => (prev + 1) % SCENES.length);
    }, SCENE_DURATION);
    return () => clearInterval(timer);
  }, [isPaused]);

  const scene = SCENES[currentScene];
  const SceneComponent = SCENE_COMPONENTS[currentScene];

  return (
    <div
      className="relative w-full h-screen overflow-hidden cursor-pointer select-none"
      onClick={() => setIsPaused((p) => !p)}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${scene.color} transition-all duration-1000`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.1),transparent_60%)]" />

      <div className="relative z-10 h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg mx-auto">
            <SceneComponent active={true} />
          </div>
        </div>

        <div className="pb-8 px-4">
          <div className="flex justify-center gap-2 mb-4">
            {SCENES.map((s, i) => (
              <button
                key={s.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentScene(i);
                }}
                className="relative h-1.5 rounded-full overflow-hidden bg-white/20 transition-all duration-300"
                style={{ width: i === currentScene ? 48 : 24 }}
              >
                {i === currentScene && (
                  <div
                    className="absolute inset-0 bg-white rounded-full"
                    style={{
                      animation: isPaused ? "none" : `progress ${SCENE_DURATION}ms linear`,
                    }}
                  />
                )}
                {i < currentScene && <div className="absolute inset-0 bg-white/60 rounded-full" />}
              </button>
            ))}
          </div>
          <div className="text-center">
            <p className="text-white/40 text-xs">
              {isPaused ? "Нажмите для продолжения" : "Нажмите для паузы"} / {currentScene + 1} из {SCENES.length}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default PromoVideo;
