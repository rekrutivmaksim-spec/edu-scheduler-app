import { useState, useEffect } from 'react';
import { authService } from '@/lib/auth';
import { offlineCache } from '@/lib/offline-cache';
import Icon from '@/components/ui/icon';

const SCHEDULE_URL = 'https://functions.poehali.dev/7030dc26-77cd-4b59-91e6-1be52f31cf8d';

interface Lesson {
  id: number;
  subject: string;
  type: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  room?: string;
  teacher?: string;
  color?: string;
  week_type?: string;
}

interface Task {
  id: number;
  title: string;
  deadline?: string;
  priority: string;
  completed: boolean;
}

const getWeekParity = (): 'even' | 'odd' => {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNum % 2 === 0 ? 'even' : 'odd';
};

const Widget = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  const parity = getWeekParity();
  const dayNames = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const token = authService.getToken();
    if (!token) {
      const cachedS = offlineCache.load<Lesson[]>('schedule');
      const cachedT = offlineCache.load<Task[]>('tasks');
      if (cachedS) setLessons(cachedS);
      if (cachedT) setTasks(cachedT);
      setLoading(false);
      return;
    }

    try {
      const [sRes, tRes] = await Promise.all([
        fetch(`${SCHEDULE_URL}?path=schedule`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${SCHEDULE_URL}?path=tasks`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (sRes.ok) {
        const sData = await sRes.json();
        setLessons(sData.schedule || []);
        offlineCache.save('schedule', sData.schedule);
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        setTasks(tData.tasks || []);
        offlineCache.save('tasks', tData.tasks);
      }
    } catch {
      const cachedS = offlineCache.load<Lesson[]>('schedule');
      const cachedT = offlineCache.load<Task[]>('tasks');
      if (cachedS) setLessons(cachedS);
      if (cachedT) setTasks(cachedT);
    }
    setLoading(false);
  };

  const todayLessons = lessons
    .filter(l => {
      if (l.day_of_week !== dayOfWeek) return false;
      if (!l.week_type || l.week_type === 'every') return true;
      return l.week_type === parity;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const upcomingTasks = tasks
    .filter(t => !t.completed && t.deadline)
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
    .slice(0, 3);

  const formatTime = (t: string) => t?.substring(0, 5) || '';
  const typeLabel = (t: string) => ({ lecture: 'Лекция', practice: 'Практика', lab: 'Лаб.', seminar: 'Семинар' }[t] || t);

  const priorityDot = (p: string) => {
    const c = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-green-500' }[p] || 'bg-gray-400';
    return <span className={`inline-block w-2 h-2 rounded-full ${c}`} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">{dayNames[dayOfWeek]}</h2>
          <p className="text-[10px] text-gray-500">
            {today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {parity === 'even' ? 'чётная' : 'нечётная'} нед.
          </p>
        </div>
        <a href="/" className="text-purple-600 text-xs font-medium flex items-center gap-1">
          Открыть <Icon name="ExternalLink" size={12} />
        </a>
      </div>

      {todayLessons.length === 0 ? (
        <div className="bg-white/80 rounded-xl p-4 text-center border border-purple-100">
          <Icon name="PartyPopper" size={24} className="mx-auto text-purple-400 mb-1" />
          <p className="text-xs text-gray-500">Сегодня нет занятий!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {todayLessons.map(l => (
            <div key={l.id} className="bg-white/90 rounded-xl p-2.5 border border-purple-100 flex items-center gap-2.5">
              <div className={`w-1 h-10 rounded-full ${l.color || 'bg-purple-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{l.subject}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-500">{formatTime(l.start_time)}–{formatTime(l.end_time)}</span>
                  <span className="text-[10px] text-gray-400">{typeLabel(l.type)}</span>
                  {l.room && <span className="text-[10px] text-gray-400">{l.room}</span>}
                  {l.week_type && l.week_type !== 'every' && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-600">
                      {l.week_type === 'even' ? 'Чёт' : 'Нечёт'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {upcomingTasks.length > 0 && (
        <div className="mt-3">
          <h3 className="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
            <Icon name="CheckSquare" size={12} /> Ближайшие дедлайны
          </h3>
          <div className="space-y-1">
            {upcomingTasks.map(t => (
              <div key={t.id} className="bg-white/80 rounded-lg p-2 border border-purple-100 flex items-center gap-2">
                {priorityDot(t.priority)}
                <span className="text-xs text-gray-800 truncate flex-1">{t.title}</span>
                {t.deadline && (
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {new Date(t.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Widget;