import { useState } from 'react';

const PAGES = [
  { path: '/', label: 'Главная' },
  { path: '/dashboard', label: 'Дашборд' },
  { path: '/calendar', label: 'Календарь' },
  { path: '/gradebook', label: 'Зачётная книжка' },
  { path: '/analytics', label: 'Аналитика' },
  { path: '/assistant', label: 'ИИ-ассистент' },
  { path: '/materials', label: 'Материалы' },
  { path: '/pomodoro', label: 'Помодоро' },
  { path: '/achievements', label: 'Достижения' },
  { path: '/groups', label: 'Группы' },
  { path: '/referral', label: 'Реферальная' },
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
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
];

// Реальные размеры экранов популярных телефонов в России
const DEVICES = [
  { label: 'iPhone 14 Pro', w: 393, h: 852, scale: 0.73, frameW: 320, frameH: 693, radius: 48, hasDynamicIsland: true },
  { label: 'Samsung S24', w: 360, h: 780, scale: 0.76, frameW: 300, frameH: 650, radius: 40, hasDynamicIsland: false },
  { label: 'Xiaomi 13', w: 393, h: 851, scale: 0.72, frameW: 318, frameH: 690, radius: 44, hasDynamicIsland: false },
  { label: 'Realme / Poco', w: 360, h: 800, scale: 0.74, frameW: 300, frameH: 660, radius: 36, hasDynamicIsland: false },
];

export default function Screenshots() {
  const [pageIndex, setPageIndex] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);
  const [deviceIndex, setDeviceIndex] = useState(0);

  const page = PAGES[pageIndex];
  const bg = BACKGROUNDS[bgIndex];
  const device = DEVICES[deviceIndex];

  const screenW = device.frameW - 24;
  const screenH = device.frameH - 24;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        transition: 'background 0.5s ease',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Фоновые круги */}
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '55vw', height: '55vw', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '65vw', height: '65vw', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '40%', right: '5%', width: '25vw', height: '25vw', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      {/* Шапка */}
      <div style={{ marginBottom: 20, textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px)',
          borderRadius: 20,
          padding: '8px 24px',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          display: 'inline-block',
        }}>
          {pageIndex + 1} / {PAGES.length} — {page.label}
        </div>
      </div>

      {/* Рамка телефона */}
      <div style={{
        position: 'relative',
        width: device.frameW,
        height: device.frameH,
        zIndex: 10,
        filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.45))',
        transition: 'all 0.3s ease',
      }}>
        {/* Корпус */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: device.radius,
          background: 'linear-gradient(145deg, #2d2d2d, #0e0e0e)',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.13), 0 0 0 2px #000',
        }} />

        {/* Кнопки справа (power) */}
        <div style={{ position: 'absolute', right: -3, top: 110, width: 4, height: 36, background: '#2a2a2a', borderRadius: '0 3px 3px 0' }} />

        {/* Кнопки слева (volume) */}
        <div style={{ position: 'absolute', left: -3, top: 85, width: 4, height: 22, background: '#2a2a2a', borderRadius: '3px 0 0 3px' }} />
        <div style={{ position: 'absolute', left: -3, top: 118, width: 4, height: 48, background: '#2a2a2a', borderRadius: '3px 0 0 3px' }} />
        <div style={{ position: 'absolute', left: -3, top: 178, width: 4, height: 48, background: '#2a2a2a', borderRadius: '3px 0 0 3px' }} />

        {/* Экран */}
        <div style={{
          position: 'absolute',
          top: 12, left: 12, right: 12, bottom: 12,
          borderRadius: device.radius - 8,
          overflow: 'hidden',
          background: '#fff',
        }}>
          {/* Dynamic Island (iPhone) или Notch (Android) */}
          {device.hasDynamicIsland ? (
            <div style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              width: 100, height: 28,
              background: '#000', borderRadius: 20, zIndex: 100,
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 14px',
            }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#111', border: '1px solid #2a2a2a' }} />
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#111' }} />
            </div>
          ) : (
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 80, height: 22,
              background: '#000', borderRadius: '0 0 14px 14px', zIndex: 100,
            }} />
          )}

          {/* Status bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 44,
            zIndex: 99, display: 'flex', alignItems: 'flex-end',
            justifyContent: 'space-between', padding: '0 18px 5px',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#000', fontFamily: 'system-ui' }}>9:41</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <svg width="15" height="10" viewBox="0 0 15 10" fill="none">
                <rect x="0" y="4" width="2.5" height="6" rx="0.5" fill="#000" />
                <rect x="4" y="2.5" width="2.5" height="7.5" rx="0.5" fill="#000" />
                <rect x="8" y="1" width="2.5" height="9" rx="0.5" fill="#000" />
                <rect x="12" y="0" width="2.5" height="10" rx="0.5" fill="#000" opacity="0.3" />
              </svg>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path d="M7 7.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" fill="#000"/>
                <path d="M3.9 5.6a4.4 4.4 0 0 1 6.2 0" stroke="#000" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M1.2 3a8 8 0 0 1 11.6 0" stroke="#000" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <div style={{ width: 20, height: 10, border: '1.5px solid #000', borderRadius: 3, padding: '1.5px', display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '80%', height: '100%', background: '#000', borderRadius: 1 }} />
                </div>
                <div style={{ width: 2, height: 5, background: '#000', borderRadius: '0 1px 1px 0' }} />
              </div>
            </div>
          </div>

          {/* iframe */}
          <iframe
            key={`${page.path}-${deviceIndex}`}
            src={page.path}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: `${device.w}px`,
              height: `${device.h}px`,
              border: 'none',
              transformOrigin: 'top left',
              transform: `scale(${screenW / device.w})`,
              pointerEvents: 'none',
            }}
            title={page.label}
          />

          {/* Home indicator */}
          <div style={{
            position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)',
            width: 90, height: 4, background: '#000', borderRadius: 4, opacity: 0.2, zIndex: 100,
          }} />
        </div>
      </div>

      {/* Выбор устройства */}
      <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        {DEVICES.map((d, i) => (
          <button key={d.label} onClick={() => setDeviceIndex(i)} style={{
            background: i === deviceIndex ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 12, padding: '6px 14px',
            color: '#fff', fontWeight: i === deviceIndex ? 700 : 500,
            cursor: 'pointer', fontSize: 12, backdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
          }}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Навигация по страницам */}
      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', position: 'relative', zIndex: 10 }}>
        <button
          onClick={() => setPageIndex(i => Math.max(0, i - 1))}
          disabled={pageIndex === 0}
          style={{
            background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 14, padding: '10px 22px', color: '#fff', fontWeight: 700,
            cursor: pageIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: pageIndex === 0 ? 0.35 : 1,
            backdropFilter: 'blur(10px)', fontSize: 14, transition: 'all 0.2s',
          }}
        >← Назад</button>

        <button
          onClick={() => setBgIndex(i => (i + 1) % BACKGROUNDS.length)}
          style={{
            background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 14, padding: '10px 18px', color: '#fff', fontWeight: 700,
            cursor: 'pointer', backdropFilter: 'blur(10px)', fontSize: 14, transition: 'all 0.2s',
          }}
        >🎨 Фон</button>

        <button
          onClick={() => setPageIndex(i => Math.min(PAGES.length - 1, i + 1))}
          disabled={pageIndex === PAGES.length - 1}
          style={{
            background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 14, padding: '10px 22px', color: '#fff', fontWeight: 700,
            cursor: pageIndex === PAGES.length - 1 ? 'not-allowed' : 'pointer',
            opacity: pageIndex === PAGES.length - 1 ? 0.35 : 1,
            backdropFilter: 'blur(10px)', fontSize: 14, transition: 'all 0.2s',
          }}
        >Вперёд →</button>
      </div>

      {/* Быстрый выбор страниц */}
      <div style={{
        marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: 680, position: 'relative', zIndex: 10,
      }}>
        {PAGES.map((p, i) => (
          <button key={p.path} onClick={() => setPageIndex(i)} style={{
            background: i === pageIndex ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 10, padding: '4px 11px',
            color: '#fff', fontWeight: i === pageIndex ? 700 : 400,
            cursor: 'pointer', fontSize: 11, backdropFilter: 'blur(8px)',
            transition: 'all 0.2s',
          }}>
            {i + 1}. {p.label}
          </button>
        ))}
      </div>

      {/* Подсказка */}
      <div style={{
        position: 'fixed', bottom: 14, right: 14,
        background: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: '8px 14px',
        color: '#fff', fontSize: 11, zIndex: 200, backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.12)', lineHeight: 1.6,
      }}>
        💡 <strong>F11</strong> полный экран<br />
        Win+Shift+S / Cmd+Shift+4
      </div>
    </div>
  );
}
