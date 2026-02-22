import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PAGES = [
  { path: '/', label: 'Главная — Расписание и задачи' },
  { path: '/dashboard', label: 'Дашборд' },
  { path: '/calendar', label: 'Календарь' },
  { path: '/gradebook', label: 'Зачётная книжка' },
  { path: '/analytics', label: 'Аналитика' },
  { path: '/assistant', label: 'ИИ-ассистент' },
  { path: '/materials', label: 'Материалы' },
  { path: '/pomodoro', label: 'Помодоро-таймер' },
  { path: '/achievements', label: 'Достижения' },
  { path: '/groups', label: 'Учебные группы' },
  { path: '/referral', label: 'Реферальная программа' },
  { path: '/pricing', label: 'Тарифы' },
  { path: '/subscription', label: 'Подписка' },
  { path: '/profile', label: 'Профиль' },
  { path: '/settings', label: 'Настройки' },
];

const BACKGROUNDS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)',
  'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
];

export default function Screenshots() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);
  const navigate = useNavigate();

  const current = PAGES[currentIndex];
  const bg = BACKGROUNDS[bgIndex];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: bg, transition: 'background 0.5s ease' }}
    >
      {/* Декоративные круги на фоне */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%',
        width: '50vw', height: '50vw', borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%',
        width: '60vw', height: '60vw', borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '30%', right: '-5%',
        width: '30vw', height: '30vw', borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)', pointerEvents: 'none'
      }} />

      {/* Название экрана сверху */}
      <div style={{ marginBottom: 24, textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(10px)',
          borderRadius: 20,
          padding: '8px 24px',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: 0.3,
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          {currentIndex + 1} / {PAGES.length} — {current.label}
        </div>
      </div>

      {/* Рамка телефона */}
      <div style={{
        position: 'relative',
        width: 320,
        height: 653,
        zIndex: 10,
        filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.4))',
      }}>
        {/* Корпус телефона */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: 48,
          background: 'linear-gradient(145deg, #2a2a2a, #111)',
          boxShadow: `
            inset 0 0 0 1.5px rgba(255,255,255,0.12),
            0 0 0 2px #000,
            0 40px 80px rgba(0,0,0,0.5)
          `,
        }} />

        {/* Боковые кнопки */}
        <div style={{
          position: 'absolute', right: -3, top: 100, width: 4, height: 32,
          background: '#333', borderRadius: '0 3px 3px 0',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
        }} />
        <div style={{
          position: 'absolute', left: -3, top: 90, width: 4, height: 24,
          background: '#333', borderRadius: '3px 0 0 3px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
        }} />
        <div style={{
          position: 'absolute', left: -3, top: 125, width: 4, height: 52,
          background: '#333', borderRadius: '3px 0 0 3px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
        }} />
        <div style={{
          position: 'absolute', left: -3, top: 190, width: 4, height: 52,
          background: '#333', borderRadius: '3px 0 0 3px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
        }} />

        {/* Экранная зона */}
        <div style={{
          position: 'absolute',
          top: 12, left: 12, right: 12, bottom: 12,
          borderRadius: 38,
          overflow: 'hidden',
          background: '#fff',
        }}>
          {/* Dynamic Island */}
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            width: 110, height: 30,
            background: '#000',
            borderRadius: 20,
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1a1a1a', border: '1px solid #333' }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a1a1a' }} />
          </div>

          {/* Status bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 50,
            zIndex: 99,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            padding: '0 20px 6px',
            background: 'transparent',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#000', fontFamily: 'system-ui' }}>9:41</span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {/* Signal */}
              <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                <rect x="0" y="5" width="3" height="6" rx="0.5" fill="#000" />
                <rect x="4.5" y="3" width="3" height="8" rx="0.5" fill="#000" />
                <rect x="9" y="1" width="3" height="10" rx="0.5" fill="#000" />
                <rect x="13.5" y="0" width="2.5" height="11" rx="0.5" fill="#000" opacity="0.3" />
              </svg>
              {/* WiFi */}
              <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
                <path d="M7.5 8.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" fill="#000"/>
                <path d="M4.2 6.3a4.7 4.7 0 0 1 6.6 0" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M1.5 3.5a8.5 8.5 0 0 1 12 0" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {/* Battery */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <div style={{
                  width: 22, height: 11, border: '1.5px solid #000', borderRadius: 3,
                  display: 'flex', alignItems: 'center', padding: '1.5px',
                }}>
                  <div style={{ width: '80%', height: '100%', background: '#000', borderRadius: 1.5 }} />
                </div>
                <div style={{ width: 2, height: 5, background: '#000', borderRadius: '0 1px 1px 0' }} />
              </div>
            </div>
          </div>

          {/* iframe с приложением */}
          <iframe
            key={current.path}
            src={current.path}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '390px',
              height: '844px',
              border: 'none',
              transformOrigin: 'top left',
              transform: 'scale(0.752)',
              pointerEvents: 'none',
            }}
            title={current.label}
          />

          {/* Home indicator */}
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            width: 100, height: 4, background: '#000', borderRadius: 4, opacity: 0.25,
            zIndex: 100,
          }} />
        </div>
      </div>

      {/* Управление */}
      <div style={{
        marginTop: 32, display: 'flex', gap: 12, alignItems: 'center',
        position: 'relative', zIndex: 10, flexWrap: 'wrap', justifyContent: 'center'
      }}>
        <button
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          style={{
            background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 14, padding: '10px 20px', color: '#fff', fontWeight: 700,
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === 0 ? 0.4 : 1,
            backdropFilter: 'blur(10px)', fontSize: 14,
            transition: 'all 0.2s',
          }}
        >
          ← Назад
        </button>

        <button
          onClick={() => setBgIndex(i => (i + 1) % BACKGROUNDS.length)}
          style={{
            background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 14, padding: '10px 20px', color: '#fff', fontWeight: 700,
            cursor: 'pointer', backdropFilter: 'blur(10px)', fontSize: 14,
            transition: 'all 0.2s',
          }}
        >
          🎨 Сменить фон
        </button>

        <button
          onClick={() => setCurrentIndex(i => Math.min(PAGES.length - 1, i + 1))}
          disabled={currentIndex === PAGES.length - 1}
          style={{
            background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 14, padding: '10px 20px', color: '#fff', fontWeight: 700,
            cursor: currentIndex === PAGES.length - 1 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === PAGES.length - 1 ? 0.4 : 1,
            backdropFilter: 'blur(10px)', fontSize: 14,
            transition: 'all 0.2s',
          }}
        >
          Вперёд →
        </button>
      </div>

      {/* Список страниц */}
      <div style={{
        marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: 700,
        position: 'relative', zIndex: 10,
      }}>
        {PAGES.map((p, i) => (
          <button
            key={p.path}
            onClick={() => setCurrentIndex(i)}
            style={{
              background: i === currentIndex ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 10, padding: '5px 12px',
              color: '#fff', fontWeight: i === currentIndex ? 700 : 400,
              cursor: 'pointer', fontSize: 12,
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s',
            }}
          >
            {i + 1}. {p.label.split('—')[0].trim()}
          </button>
        ))}
      </div>

      {/* Инструкция */}
      <div style={{
        position: 'fixed', bottom: 16, right: 16,
        background: 'rgba(0,0,0,0.5)', borderRadius: 14, padding: '10px 16px',
        color: '#fff', fontSize: 12, zIndex: 200, backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.15)', maxWidth: 220,
        lineHeight: 1.5,
      }}>
        💡 Для скриншота нажми<br />
        <strong>F11</strong> (полный экран)<br />
        затем <strong>Win+Shift+S</strong> / <strong>Cmd+Shift+4</strong>
      </div>
    </div>
  );
}
