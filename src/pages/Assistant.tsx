import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { trackActivity } from '@/lib/gamification';
import Icon from '@/components/ui/icon';
import AIMessage from '@/components/AIMessage';
import BottomNav from '@/components/BottomNav';

const AI_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';

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

const TypingDots = () => (
  <div className="flex items-center gap-1.5 px-4 py-3">
    {[0, 1, 2].map(i => (
      <div
        key={i}
        className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
        style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
      />
    ))}
  </div>
);

const ImagePreview = ({ src, onRemove }: { src: string; onRemove: () => void }) => (
  <div className="relative inline-block mr-2 mb-2">
    <img src={src} alt="preview" className="w-20 h-20 object-cover rounded-xl border border-gray-200" />
    <button
      onClick={onRemove}
      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md"
    >
      ✕
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

      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunks.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
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
    start().catch(() => onCancel());

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
    <div className="flex items-center gap-3 w-full bg-red-50 rounded-2xl px-4 py-3 border border-red-200">
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

  useEffect(() => {
    if (!authService.isAuthenticated()) { navigate('/auth'); return; }
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const getToken = () => authService.getToken() || '';

  const loadSessions = async () => {
    try {
      const resp = await fetch(`${AI_URL}?action=sessions`, {
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
      const resp = await fetch(`${AI_URL}?action=messages&session_id=${sessionId}`, {
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
      await fetch(`${AI_URL}?action=delete_session&session_id=${sessionId}`, {
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

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Фото слишком большое. Максимум 10 МБ');
      return;
    }
    const b64 = await fileToBase64(file);
    setImageFile(b64);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleAudioStop = async (blob: Blob) => {
    setIsRecording(false);
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(blob);
    });
    await sendMessage('', null, b64);
  };

  const cancelRequest = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const sendMessage = async (text?: string, imgB64?: string | null, audioB64?: string | null) => {
    const messageText = text ?? input.trim();
    const img = imgB64 ?? imageFile;
    const audio = audioB64 ?? null;

    if (!messageText && !img && !audio) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: audio ? '🎤 Распознаю речь...' : messageText,
      image: imagePreview || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setImagePreview(null);
    setImageFile(null);
    setIsLoading(true);
    setLoadingHint(audio ? 'Распознаю речь...' : img ? 'Анализирую фото...' : 'Думаю...');

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
        body.audio_format = 'webm';
      }
      if (currentSessionId) body.session_id = currentSessionId;

      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (resp.status === 403 && data.error === 'limit') {
          setShowLimitScreen(true);
          setMessages(prev => prev.filter(m => m.id !== userMsg.id));
          return;
        }
        throw new Error(data.message || data.error || 'Ошибка');
      }

      if (data.transcript && audio) {
        setMessages(prev =>
          prev.map(m => m.id === userMsg.id ? { ...m, content: `🎤 ${data.transcript}` } : m)
        );
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (data.remaining !== undefined && data.remaining !== null) {
        setRemaining(data.remaining);
      }

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
        <div className="flex items-center gap-2">
          {remaining !== null && remaining !== undefined && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              {remaining} {remaining === 1 ? 'вопрос' : remaining < 5 ? 'вопроса' : 'вопросов'}
            </span>
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: '140px' }}>
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
              <Icon name="Sparkles" size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Привет! Я Studyfay</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">Задай вопрос, сфотографируй задачу или запиши голосовое</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {[
                { icon: '📸', text: 'Сфото задачу', action: 'camera' },
                { icon: '🎤', text: 'Спросить голосом', action: 'mic' },
                { icon: '📐', text: 'Реши уравнение', action: 'text' },
                { icon: '🎓', text: 'Подготовь к ЕГЭ', action: 'text' },
              ].map(q => (
                <button
                  key={q.text}
                  onClick={() => {
                    if (q.action === 'camera') cameraInputRef.current?.click();
                    else if (q.action === 'mic') { try { setIsRecording(true); } catch (e) { console.error(e); } }
                    else { setInput(q.text); inputRef.current?.focus(); }
                  }}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 active:scale-[0.97] transition-all shadow-sm"
                >
                  <span>{q.icon}</span>{q.text}
                </button>
              ))}
            </div>
          </div>
        )}

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
              ) : (
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              )}
              <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-300'}`}>
                {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <MascotAvatar />
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md shadow-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
                    />
                  ))}
                </div>
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}>
        {imagePreview && (
          <div className="px-4 pt-3">
            <ImagePreview src={imagePreview} onRemove={() => { setImagePreview(null); setImageFile(null); }} />
          </div>
        )}

        {isRecording ? (
          <div className="px-4 py-3">
            <AudioRecorder
              onStop={handleAudioStop}
              onCancel={() => setIsRecording(false)}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => {
                try { setIsRecording(true); } catch (e) { console.error(e); alert('Нет доступа к микрофону'); }
              }}
              className="p-2.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors flex-shrink-0"
              disabled={isLoading}
            >
              <Icon name="Mic" size={22} />
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-2.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors flex-shrink-0"
              disabled={isLoading}
              title="Сфотографировать задание"
            >
              <Icon name="Camera" size={22} />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors flex-shrink-0"
              disabled={isLoading}
              title="Прикрепить фото"
            >
              <Icon name="Paperclip" size={22} />
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

            {isLoading ? (
              <button
                type="button"
                onClick={cancelRequest}
                className="p-2.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 active:bg-red-300 transition-colors flex-shrink-0"
              >
                <Icon name="Square" size={20} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!hasContent}
                className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
                  hasContent
                    ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 active:scale-95'
                    : 'bg-gray-100 text-gray-300'
                }`}
              >
                <Icon name="ArrowUp" size={20} />
              </button>
            )}
          </form>
        )}
      </div>

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
              <button onClick={() => setShowLimitScreen(false)} className="absolute top-3 right-3 text-white/40 hover:text-white/70">✕</button>
              <span className="text-4xl block mb-3">⏸️</span>
              <h2 className="text-white font-extrabold text-xl mb-1">Вопросы на сегодня закончились</h2>
              <p className="text-white/75 text-sm">Продолжай обучение без ограничений:</p>
              <div className="mt-3 space-y-1.5">
                {['Безлимит вопросов к ИИ', 'Распознавание голоса', 'Решение по фото', 'Подготовка к ЕГЭ и ОГЭ', '×2 XP'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-white/85 text-sm">
                    <span className="text-white/60">✓</span>{f}
                  </div>
                ))}
              </div>
              <div className="mt-3 bg-white/20 rounded-xl px-4 py-2 inline-block">
                <span className="text-white font-bold">499 ₽/мес</span>
              </div>
            </div>
            <div className="px-5 pb-8 space-y-3">
              <button
                onClick={() => { setShowLimitScreen(false); navigate('/pricing'); }}
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-base rounded-2xl shadow-lg active:scale-[0.98] transition-all"
              >
                Подключить Premium
              </button>
              <button onClick={() => { setShowLimitScreen(false); navigate('/achievements'); }} className="w-full py-2.5 text-sm text-blue-500 font-medium hover:text-blue-700 transition-colors">
                Заработать бонусные вопросы 🎯
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