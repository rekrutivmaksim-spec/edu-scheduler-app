import { useState, useEffect } from 'react';
import { contacts } from './data';
import Icon from '@/components/ui/icon';

interface CallModalProps {
  type: 'audio' | 'video';
  contactId: string;
  onClose: () => void;
}

export default function CallModal({ type, contactId, onClose }: CallModalProps) {
  const contact = contacts.find(c => c.id === contactId);
  const [duration, setDuration] = useState(0);
  const [state, setState] = useState<'calling' | 'active'>('calling');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setState('active'), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (state !== 'active') return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [state]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (!contact) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />

      <div className="relative z-10 w-80 glass-strong rounded-3xl overflow-hidden animate-scale-in neon-glow">
        <div className="absolute inset-0 mesh-bg opacity-60" />

        {type === 'video' && state === 'active' && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-900">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-8xl opacity-20">{contact.avatar}</div>
            </div>
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center py-10 px-6">
          <div className="relative mb-5">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl glass neon-glow animate-pulse-neon">
              {contact.avatar}
            </div>
            {state === 'calling' && (
              <>
                <div className="absolute inset-0 rounded-3xl border-2 border-[var(--neon-purple)]/40 animate-ping" />
                <div className="absolute -inset-2 rounded-3xl border border-[var(--neon-purple)]/20 animate-ping" style={{ animationDelay: '0.5s' }} />
              </>
            )}
          </div>

          <h3 className="font-display text-xl font-bold text-white">{contact.name}</h3>

          {state === 'calling' ? (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex gap-1">
                {[1,2,3].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full gradient-bg animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {type === 'audio' ? 'Звоним...' : 'Видеозвонок...'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center mt-2">
              <span className="text-sm text-[var(--neon-green)] font-medium">{type === 'audio' ? '📞 Голосовой' : '📹 Видеозвонок'}</span>
              <span className="font-display text-2xl font-bold gradient-text mt-1">{formatTime(duration)}</span>
              {type === 'audio' && (
                <div className="flex items-center gap-1 mt-2">
                  {[1,2,3,4,5].map(i => (
                    <div
                      key={i}
                      className="wave-bar w-1 rounded-full gradient-bg"
                      style={{ height: `${8 + Math.random() * 12}px` }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setMuted(!muted)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110 ${
                muted ? 'bg-red-500/30 border border-red-500/50' : 'glass hover:bg-white/10'
              }`}
            >
              <Icon name={muted ? 'MicOff' : 'Mic'} size={18} className={muted ? 'text-red-400' : 'text-white'} />
            </button>

            {type === 'video' && (
              <button
                onClick={() => setCameraOff(!cameraOff)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110 ${
                  cameraOff ? 'bg-red-500/30 border border-red-500/50' : 'glass hover:bg-white/10'
                }`}
              >
                <Icon name={cameraOff ? 'VideoOff' : 'Video'} size={18} className={cameraOff ? 'text-red-400' : 'text-white'} />
              </button>
            )}

            <button
              onClick={() => setSpeakerOn(!speakerOn)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-110 ${
                speakerOn ? 'glass hover:bg-white/10' : 'bg-white/5'
              }`}
            >
              <Icon name={speakerOn ? 'Volume2' : 'VolumeX'} size={18} className="text-white" />
            </button>

            <button
              onClick={onClose}
              className="w-14 h-14 rounded-2xl bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all hover:scale-110 shadow-lg shadow-red-500/30"
            >
              <Icon name="PhoneOff" size={22} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
