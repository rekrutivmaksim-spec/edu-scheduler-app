import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { trackActivity } from '@/lib/gamification';
import { API } from '@/lib/api-urls';
import { am } from '@/lib/appmetrica';
import Icon from '@/components/ui/icon';
import AIMessage from '@/components/AIMessage';
import BottomNav from '@/components/BottomNav';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: Date;
}

interface Session {
  id: number;
  title: string;
  updated_at: string;
  message_count: number;
}

/* ---- WAV conversion ---- */
const audioToWav = async (blob: Blob): Promise<string> => {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const numChannels = 1;
    const sampleRate = 16000;
    const bitsPerSample = 16;
    const length = audioBuffer.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    const channelData = audioBuffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    const wavBytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < wavBytes.length; i++) {
      binary += String.fromCharCode(wavBytes[i]);
    }

    return btoa(binary);
  } finally {
    await audioContext.close();
  }
};

/* ---- Small components ---- */

const ImagePreview = ({ src, onRemove }: { src: string; onRemove: () => void }) => (
  <div className="relative inline-block mr-2 mb-2">
    <img src={src} alt="preview" className="w-20 h-20 object-cover rounded-xl border border-gray-200" />
    <button
      onClick={onRemove}
      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md"
    >
      <Icon name="X" size={12} />
    </button>
  </div>
);

const ImageViewer = ({ src, onClose }: { src: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
    <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white z-10">
      <Icon name="X" size={28} />
    </button>
    <img src={src} alt="full" className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
  </div>
);

const AudioRecorder = ({ onStop, onCancel }: { onStop: (blob: Blob) => void; onCancel: () => void }) => {
  const [duration, setDuration] = useState(0);
  const [levels, setLevels] = useState<number[]>(new Array(30).fill(8));
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const animFrame = useRef<number>(0);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let stream: MediaStream;
    const start = async () => {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 64;
      src.connect(an);
      analyser.current = an;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType });
      chunks.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: mimeType });
        onStop(blob);
      };
      rec.start(100);
      mediaRecorder.current = rec;

      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      const visualize = () => {
        if (!analyser.current) return;
        const data = new Uint8Array(analyser.current.frequencyBinCount);
        analyser.current.getByteFrequencyData(data);
        const bars = Array.from(data).slice(0, 30).map(v => Math.max(4, (v / 255) * 32));
        setLevels(bars);
        animFrame.current = requestAnimationFrame(visualize);
      };
      visualize();
    };
    start().catch((err) => {
      console.error('Mic access error:', err);
      alert('Не удалось получить доступ к микрофону. Разреши доступ в настройках браузера.');
      onCancel();
    });

    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrame.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleStop = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="absolute inset-0 flex items-center gap-3 bg-red-50 rounded-2xl px-4 py-3 border border-red-200 z-10">
      <button onClick={onCancel} className="text-red-400 hover:text-red-600 flex-shrink-0">
        <Icon name="X" size={20} />
      </button>
      <div className="flex items-end gap-[2px] h-8 flex-1 justify-center">
        {levels.map((h, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-red-400 transition-all duration-75"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <span className="text-sm font-mono text-red-600 w-10 text-right flex-shrink-0">{fmt(duration)}</span>
      <button
        onClick={handleStop}
        className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-lg active:scale-95 transition-transform"
      >
        <Icon name="Square" size={16} />
      </button>
    </div>
  );
};

const MascotAvatar = () => (
  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
    <Icon name="Sparkles" size={15} className="text-white" />
  </div>
);

const TypingDots = () => (
  <div className="flex items-center gap-1.5">
    {[0, 1, 2].map(i => (
      <div
        key={i}
        className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
        style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
      />
    ))}
  </div>
);

/* ---- Main Component ---- */

const Assistant = () => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showLimitScreen, setShowLimitScreen] = useState(false);
  const [loadingHint, setLoadingHint] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [audioUsed, setAudioUsed] = useState(0);
  const [audioLimit, setAudioLimit] = useState(1);
  const [photoUsed, setPhotoUsed] = useState(0);
  const [photoLimit, setPhotoLimit] = useState(1);
  const [showFeatureLimitScreen, setShowFeatureLimitScreen] = useState<'audio' | 'photo' | null>(null);

  const audioLocked = !isPremium && audioUsed >= audioLimit;
  const photoLocked = !isPremium && photoUsed >= photoLimit;

  const loadLimits = async () => {
    try {
      const resp = await fetch(`${API.AI_ASSISTANT}?action=limits`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (resp.ok) {
        const d = await resp.json();
        const premium = d.is_premium || d.is_trial || false;
        setIsPremium(premium);
        setAudioUsed(d.audio_used || 0);
        setAudioLimit(d.audio_limit || 1);
        setPhotoUsed(d.photo_used || 0);
        setPhotoLimit(d.photo_limit || 1);
        if (!premium && d.questions_remaining !== undefined && d.questions_remaining < 900) {
          setRemaining(d.questions_remaining);
        } else if (premium) {
          setRemaining(null);
        }
      }
    } catch (e) { console.error('loadLimits', e); }
  };

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
    loadSessions();
    loadLimits();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const getToken = () => authService.getToken() || '';

  const loadSessions = async () => {
    try {
      const resp = await fetch(`${API.AI_ASSISTANT}?action=sessions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setSessions(data.sessions || []);
      }
    } catch (e) { console.error('loadSessions', e); }
  };

  const loadSessionMessages = async (sessionId: number) => {
    try {
      const resp = await fetch(`${API.AI_ASSISTANT}?action=messages&session_id=${sessionId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setMessages(
          (data.messages || []).map((m: { role: 'user' | 'assistant'; content: string; timestamp: string }, i: number) => ({
            id: `loaded-${i}`,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
          }))
        );
        setCurrentSessionId(sessionId);
        setShowMenu(false);
      }
    } catch (e) { console.error('loadMessages', e); }
  };

  const deleteSession = async (sessionId: number) => {
    try {
      await fetch(`${API.AI_ASSISTANT}?action=delete_session&session_id=${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setSessions(s => s.filter(x => x.id !== sessionId));
      if (currentSessionId === sessionId) {
        setMessages([]);
        setCurrentSessionId(null);
      }
    } catch (e) { console.error('deleteSession', e); }
  };

  const newChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowMenu(false);
  };

  const compressImage = (file: File, maxSize = 1200): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.7;
        let result = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        if (result.length > 2_000_000) {
          quality = 0.4;
          result = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        }
        resolve(result);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoLocked) {
      e.target.value = '';
      setShowFeatureLimitScreen('photo');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert('Фото слишком большое. Максимум 15 МБ');
      return;
    }
    const b64 = await compressImage(file);
    setImageFile(b64);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleAudioStop = async (blob: Blob) => {
    setIsRecording(false);
    try {
      const wavB64 = await audioToWav(blob);
      await sendMessage('', null, wavB64, 'wav');
    } catch (e) {
      console.error('Audio WAV conversion failed, sending webm:', e);
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1];
        sendMessage('', null, b64, 'webm');
      };
      reader.readAsDataURL(blob);
    }
  };

  const cancelRequest = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const sendMessage = async (text?: string, imgB64?: string | null, audioB64?: string | null, audioFmt?: string) => {
    const messageText = text ?? input.trim();
    const img = imgB64 ?? imageFile;
    const audio = audioB64 ?? null;

    if (!messageText && !img && !audio) return;

    am.assistantMessage(audio ? 'voice' : img ? 'photo' : 'text');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: audio ? '🎤 Голосовое сообщение' : messageText,
      image: imagePreview || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setImagePreview(null);
    setImageFile(null);
    setIsLoading(true);
    setLoadingHint(audio ? 'Слушаю аудио...' : img ? 'Анализирую фото...' : 'Думаю...');

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const body: Record<string, unknown> = {
        action: 'gemini_chat',
        message: messageText || undefined,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      };
      if (img) body.image_base64 = img;
      if (audio) {
        body.audio_base64 = audio;
        body.audio_format = audioFmt || 'wav';
      }
      if (currentSessionId) body.session_id = currentSessionId;

      const resp = await fetch(API.AI_ASSISTANT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (resp.status === 413) {
        throw new Error('Файл слишком большой. Попробуй фото меньшего размера.');
      }

      const data = await resp.json();

      if (!resp.ok) {
        if (resp.status === 403 && data.feature === 'audio') {
          am.limitReached('audio');
          setShowFeatureLimitScreen('audio');
          setAudioUsed(data.used || audioLimit);
          setMessages(prev => prev.filter(m => m.id !== userMsg.id));
          return;
        }
        if (resp.status === 403 && data.feature === 'photo') {
          am.limitReached('photo');
          setShowFeatureLimitScreen('photo');
          setPhotoUsed(data.used || photoLimit);
          setMessages(prev => prev.filter(m => m.id !== userMsg.id));
          return;
        }
        if (resp.status === 403 && (data.error === 'limit' || data.error === 'premium_only')) {
          am.limitReached('daily');
          setShowLimitScreen(true);
          setMessages(prev => prev.filter(m => m.id !== userMsg.id));
          return;
        }
        throw new Error(data.message || data.error || 'Ошибка');
      }

      if (data.transcript && audio) {
        setMessages(prev =>
          prev.map(m => m.id === userMsg.id ? { ...m, content: data.transcript } : m)
        );
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      const prem = data.is_premium || false;
      if (prem) {
        setRemaining(null);
      } else if (data.remaining !== undefined && data.remaining !== null && data.remaining < 900) {
        setRemaining(data.remaining);
      }
      if (data.audio_used !== undefined) setAudioUsed(data.audio_used);
      if (data.audio_limit !== undefined) setAudioLimit(data.audio_limit);
      if (data.photo_used !== undefined) setPhotoUsed(data.photo_used);
      if (data.photo_limit !== undefined) setPhotoLimit(data.photo_limit);
      if (data.is_premium !== undefined) setIsPremium(data.is_premium);

      trackActivity('ai_questions_asked').catch(() => {});
      loadSessions();
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Не удалось получить ответ. Попробуй ещё раз.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setAbortController(null);
      setLoadingHint('');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const hasContent = input.trim().length > 0 || !!imageFile;

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50">
      {viewImage && <ImageViewer src={viewImage} onClose={() => setViewImage(null)} />}

      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 bg-white border-b border-gray-100 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors">
            <Icon name="Menu" size={22} className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-[17px] font-bold text-gray-900 leading-tight">Studyfay</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[11px] text-gray-500">онлайн</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoading ? (
            <button
              onClick={cancelRequest}
              className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-200 active:scale-95 transition-transform"
            >
              <Icon name="Square" size={12} />
              Стоп
            </button>
          ) : (
            <>
              {isPremium ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">📸 ∞</span>
                  <span className="text-[10px] text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">🎤 ∞</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5 ${photoUsed >= photoLimit ? 'text-red-500 bg-red-50' : 'text-gray-500 bg-gray-100'}`}>
                    📸 {Math.max(0, photoLimit - photoUsed)}/{photoLimit}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5 ${audioUsed >= audioLimit ? 'text-red-500 bg-red-50' : 'text-gray-500 bg-gray-100'}`}>
                    🎤 {Math.max(0, audioLimit - audioUsed)}/{audioLimit}
                  </span>
                  {remaining !== null && remaining !== undefined && remaining < 900 && (
                    <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      💬 {remaining}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          <button onClick={newChat} className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors">
            <Icon name="Plus" size={20} className="text-blue-600" />
          </button>
        </div>
      </header>

      {/* Sidebar overlay */}
      {showMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'slideInLeft 0.2s ease-out' }}
          >
            <div className="p-4 border-b border-gray-100">
              <button
                onClick={newChat}
                className="w-full flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                <Icon name="Plus" size={18} />
                Новый чат
              </button>
            </div>
            <div className="p-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 mb-2">История</p>
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-400 px-2 py-4 text-center">Пока пусто</p>
              ) : (
                sessions.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 mb-1 cursor-pointer transition-colors ${
                      currentSessionId === s.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0" onClick={() => loadSessionMessages(s.id)}>
                      <p className="text-sm font-medium truncate">{s.title || 'Без названия'}</p>
                      <p className="text-[11px] text-gray-400">{s.message_count} сообщ.</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"
                    >
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-100 space-y-1">
              <button onClick={() => { setShowMenu(false); navigate('/achievements'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-xl">
                <Icon name="Trophy" size={16} className="text-amber-500" /> Ачивки
              </button>
              <button onClick={() => { setShowMenu(false); navigate('/referral'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-xl">
                <Icon name="Gift" size={16} className="text-purple-500" /> Рефералки
              </button>
              <button onClick={() => { setShowMenu(false); navigate('/settings'); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-xl">
                <Icon name="Settings" size={16} className="text-gray-400" /> Настройки
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: '180px' }}>
        {/* Empty state with quick actions */}
        {messages.length === 0 && !isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 pt-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
              <Icon name="Sparkles" size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Привет! Я Studyfay</h2>
            <p className="text-sm text-gray-500 text-center mb-8 max-w-[280px]">
              Сфоткай задание, запиши голос или напиши -- помогу решить
            </p>
            <div className="w-full max-w-sm space-y-2">
              {([
                { icon: 'Camera', text: 'Сфоткать задание', action: () => { if (photoLocked) { setShowFeatureLimitScreen('photo'); return; } cameraInputRef.current?.click(); }, locked: photoLocked },
                { icon: 'Mic', text: 'Спросить голосом', action: () => { if (audioLocked) { setShowFeatureLimitScreen('audio'); return; } setIsRecording(true); }, locked: audioLocked },
                { icon: 'Calculator', text: 'Реши уравнение 2x\u00B2 - 5x + 3 = 0', action: () => { setInput('Реши уравнение 2x^2 - 5x + 3 = 0'); }, locked: false },
                { icon: 'BookOpen', text: 'Объясни теорему Пифагора', action: () => { setInput('Объясни теорему Пифагора простыми словами'); }, locked: false },
              ] as const).map((item, i) => (
                <button
                  key={i}
                  onClick={item.action}
                  className={`w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border transition-all text-left active:scale-[0.98] ${
                    item.locked ? 'border-gray-100 opacity-75' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 relative ${item.locked ? 'bg-gray-100' : 'bg-blue-100'}`}>
                    <Icon name={item.icon} size={18} className={item.locked ? 'text-gray-400' : 'text-blue-600'} />
                    {item.locked && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                        <Icon name="Lock" size={9} className="text-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${item.locked ? 'text-gray-400' : 'text-gray-700'}`}>{item.text}</span>
                    {item.locked && <p className="text-[11px] text-amber-600 mt-0.5">Лимит исчерпан</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <MascotAvatar />}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-100 rounded-bl-md'
              }`}
            >
              {msg.image && (
                <img
                  src={msg.image}
                  alt="attached"
                  className="max-w-[200px] max-h-[200px] w-auto h-auto rounded-xl mb-2 cursor-pointer object-cover"
                  onClick={() => setViewImage(msg.image!)}
                />
              )}
              {msg.role === 'assistant' ? (
                <AIMessage content={msg.content} />
              ) : msg.content === '🎤 Голосовое сообщение' ? (
                <div className="flex items-center gap-2 text-[15px]">
                  <Icon name="Mic" size={16} className="text-blue-200" />
                  <span className="text-blue-100 italic">Голосовое сообщение</span>
                </div>
              ) : (
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              )}
              <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-300'}`}>
                {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2.5 items-end">
            <MascotAvatar />
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2">
                <TypingDots />
                {loadingHint && (
                  <span className="text-xs text-gray-400 ml-1">{loadingHint}</span>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="fixed left-0 right-0 bg-white border-t border-gray-100 z-20" style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
        {imagePreview && (
          <div className="px-4 pt-3">
            <ImagePreview src={imagePreview} onRemove={() => { setImagePreview(null); setImageFile(null); }} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative px-3 py-2.5">
          {/* Audio recorder overlay */}
          {isRecording && (
            <AudioRecorder
              onStop={handleAudioStop}
              onCancel={() => setIsRecording(false)}
            />
          )}

          <div className={`flex items-end gap-1.5 ${isRecording ? 'invisible' : ''}`}>
            {/* Attach button */}
            <button
              type="button"
              onClick={() => {
                if (photoLocked) { setShowFeatureLimitScreen('photo'); return; }
                fileInputRef.current?.click();
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-colors flex-shrink-0 relative ${
                photoLocked
                  ? 'text-gray-300 bg-gray-50 cursor-pointer'
                  : 'text-gray-500 bg-gray-100 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100'
              }`}
              disabled={isLoading}
              title={photoLocked ? 'Лимит фото исчерпан' : 'Прикрепить фото'}
            >
              <Icon name="Camera" size={16} />
              <span className="text-[11px] font-medium">Фото</span>
              {photoLocked && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                  <Icon name="Lock" size={9} className="text-white" />
                </span>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Text input */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKeyDown}
              placeholder="Спроси что-нибудь..."
              rows={1}
              className="flex-1 resize-none bg-gray-100 rounded-2xl px-4 py-2.5 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition-all max-h-[120px] leading-relaxed"
              disabled={isLoading}
            />

            {/* Right button: mic (when empty) or send (when has content) or stop (when loading) */}
            {isLoading ? (
              <button
                type="button"
                onClick={cancelRequest}
                className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 active:bg-red-300 transition-colors flex-shrink-0 mb-0.5"
              >
                <Icon name="Square" size={20} />
              </button>
            ) : hasContent ? (
              <button
                type="submit"
                className="p-2 rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 active:scale-95 transition-all flex-shrink-0 mb-0.5"
              >
                <Icon name="ArrowUp" size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (audioLocked) { setShowFeatureLimitScreen('audio'); return; }
                  try { setIsRecording(true); } catch (e) { console.error(e); }
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-colors flex-shrink-0 relative ${
                  audioLocked
                    ? 'text-gray-300 bg-gray-50 cursor-pointer'
                    : 'text-gray-500 bg-gray-100 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100'
                }`}
                disabled={isLoading}
              >
                <Icon name="Mic" size={16} />
                <span className="text-[11px] font-medium">Голос</span>
                {audioLocked && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                    <Icon name="Lock" size={9} className="text-white" />
                  </span>
                )}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Feature limit screen (audio/photo) */}
      {showFeatureLimitScreen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowFeatureLimitScreen(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 mx-4 rounded-2xl p-5 mb-4 mt-2 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
              <button onClick={() => setShowFeatureLimitScreen(null)} className="absolute top-3 right-3 text-white/40 hover:text-white/70">
                <Icon name="X" size={18} />
              </button>
              <span className="text-4xl block mb-3">{showFeatureLimitScreen === 'audio' ? '🎤' : '📸'}</span>
              <h2 className="text-white font-extrabold text-xl mb-1">
                {showFeatureLimitScreen === 'audio' ? 'Голосовой лимит исчерпан' : 'Лимит фото исчерпан'}
              </h2>
              <p className="text-white/75 text-sm">
                {showFeatureLimitScreen === 'audio'
                  ? `Ты использовал ${audioUsed} из ${audioLimit} голосовых запросов на сегодня`
                  : `Ты использовал ${photoUsed} из ${photoLimit} фото-запросов на сегодня`
                }
              </p>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-white/85 text-sm">
                  <Icon name="Infinity" size={14} className="text-white/60" />Безлимитные голосовые запросы
                </div>
                <div className="flex items-center gap-2 text-white/85 text-sm">
                  <Icon name="Infinity" size={14} className="text-white/60" />Безлимитное решение по фото
                </div>
                <div className="flex items-center gap-2 text-white/85 text-sm">
                  <Icon name="Infinity" size={14} className="text-white/60" />Безлимитные вопросы к ИИ
                </div>
              </div>
              <div className="mt-3 bg-white/20 rounded-xl px-4 py-2 inline-block">
                <span className="text-white font-bold">Premium от 200 ₽/мес</span>
              </div>
            </div>
            <div className="px-5 pb-8 space-y-3">
              <button
                onClick={() => { am.premiumClick('assistant_feature_limit'); setShowFeatureLimitScreen(null); navigate('/pricing'); }}
                className="w-full h-14 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.98] transition-all"
              >
                Подключить Premium
              </button>
              <p className="text-center text-xs text-gray-400">Лимит обновится завтра</p>
            </div>
          </div>
        </div>
      )}

      {/* Limit screen */}
      {showLimitScreen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowLimitScreen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 mx-4 rounded-2xl p-5 mb-4 mt-2 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
              <button onClick={() => setShowLimitScreen(false)} className="absolute top-3 right-3 text-white/40 hover:text-white/70">
                <Icon name="X" size={18} />
              </button>
              <span className="text-4xl block mb-3">&#9199;</span>
              <h2 className="text-white font-extrabold text-xl mb-1">Вопросы на сегодня закончились</h2>
              <p className="text-white/75 text-sm">С Premium ты сможешь учиться без ограничений:</p>
              <div className="mt-3 space-y-1.5">
                {['Безлимитные вопросы к ИИ', 'Распознавание голоса', 'Решение задач по фото', 'Подготовка к ЕГЭ/ОГЭ по всем предметам', 'x2 XP за каждое действие'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-white/85 text-sm">
                    <Icon name="Check" size={14} className="text-white/60" />{f}
                  </div>
                ))}
              </div>
              <div className="mt-3 bg-white/20 rounded-xl px-4 py-2 inline-block">
                <span className="text-white font-bold">от 200 ₽/мес</span>
              </div>
            </div>
            <div className="px-5 pb-8 space-y-3">
              <button
                onClick={() => { am.premiumClick('assistant_daily_limit'); setShowLimitScreen(false); navigate('/pricing'); }}
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.98] transition-all"
              >
                Подключить Premium
              </button>
              <button onClick={() => { setShowLimitScreen(false); navigate('/achievements'); }} className="w-full py-2.5 text-sm text-blue-500 font-medium hover:text-blue-700 transition-colors">
                Заработать бонусные вопросы
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />

      <style>{`
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default Assistant;