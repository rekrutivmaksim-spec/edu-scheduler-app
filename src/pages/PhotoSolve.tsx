import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';
import PaywallSheet from '@/components/PaywallSheet';
import { API } from '@/lib/api-urls';

const SUBJECT_COLORS: Record<string, string> = {
  'Математика': 'from-blue-500 to-indigo-600',
  'Физика': 'from-purple-500 to-indigo-600',
  'Химия': 'from-green-500 to-teal-600',
  'Биология': 'from-emerald-500 to-green-600',
  'История': 'from-amber-500 to-orange-600',
  'Обществознание': 'from-orange-500 to-red-500',
  'Русский язык': 'from-rose-500 to-pink-600',
  'Английский': 'from-sky-500 to-blue-600',
  'Общее': 'from-indigo-500 to-purple-600',
};

const SUBJECT_ICONS: Record<string, string> = {
  'Математика': 'Calculator',
  'Физика': 'Zap',
  'Химия': 'FlaskConical',
  'Биология': 'Leaf',
  'История': 'BookOpen',
  'Обществознание': 'Scale',
  'Русский язык': 'Type',
  'Английский': 'Globe',
  'Общее': 'Brain',
};

const STEP_ICONS: Record<string, string> = {
  arrow: '➡️',
  pin: '📌',
  check: '✅',
};

const GREETINGS = [
  'Отличный снимок! Сейчас разберём эту задачу',
  'Вижу задачу, давай разбираться!',
  'Принято! Уже анализирую задание',
  'Фото получено! Работаю над решением',
];

interface StructuredResponse {
  steps: Array<{ icon: string; title: string; text: string }>;
  answer: string;
  check: string;
  tip: string;
  practice: Array<{ text: string }>;
  motivation: string;
}

interface SolveResult {
  recognized_text: string;
  solution: string;
  subject: string;
  remaining: number;
  used: number;
  limit: number;
  bonus_remaining: number;
  structured?: StructuredResponse;
}

type ChatBlock =
  | { type: 'user-image'; src: string; hint?: string }
  | { type: 'greeting'; text: string }
  | { type: 'typing' }
  | { type: 'condition'; text: string; subject: string }
  | { type: 'steps'; steps: Array<{ icon: string; title: string; text: string }> }
  | { type: 'answer'; text: string }
  | { type: 'check'; text: string }
  | { type: 'tip'; text: string }
  | { type: 'practice'; items: Array<{ text: string }> }
  | { type: 'motivation'; text: string }
  | { type: 'fallback-solution'; text: string }
  | { type: 'limit-info'; used: number; limit: number; bonus: number };

function AnimatedBlock({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      className={`transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {children}
    </div>
  );
}

function MascotAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
      <Icon name="Sparkles" size={15} className="text-white" />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <MascotAvatar />
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
                style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">ИИ думает...</span>
        </div>
      </div>
    </div>
  );
}

function AIBubble({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <MascotAvatar />
      <div className={`flex-1 min-w-0 ${className}`}>{children}</div>
    </div>
  );
}

function GreetingBlock({ text }: { text: string }) {
  return (
    <AIBubble>
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
        <p className="text-[15px] text-gray-800">{text}</p>
      </div>
    </AIBubble>
  );
}

function ConditionBlock({ text, subject }: { text: string; subject: string }) {
  const color = SUBJECT_COLORS[subject] || SUBJECT_COLORS['Общее'];
  const icon = SUBJECT_ICONS[subject] || 'Brain';
  return (
    <AIBubble>
      <div className="space-y-2">
        <div className={`bg-gradient-to-r ${color} rounded-2xl rounded-tl-sm px-4 py-3 text-white`}>
          <div className="flex items-center gap-2 mb-1.5">
            <Icon name={icon} size={16} className="text-white/80" />
            <span className="text-xs font-semibold text-white/80">{subject}</span>
          </div>
          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    </AIBubble>
  );
}

function StepsBlock({ steps }: { steps: Array<{ icon: string; title: string; text: string }> }) {
  return (
    <AIBubble>
      <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 bg-violet-50/50">
          <Icon name="ListOrdered" size={15} className="text-violet-600" />
          <span className="text-sm font-bold text-gray-800">Пошаговое решение</span>
        </div>
        <div className="p-4 space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-lg flex-shrink-0 mt-0.5">
                {STEP_ICONS[step.icon] || (i === steps.length - 1 ? '✅' : '➡️')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-[15px] mb-0.5">{step.title}</p>
                <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-wrap">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AIBubble>
  );
}

function AnswerBlock({ text }: { text: string }) {
  return (
    <AIBubble>
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl rounded-tl-sm px-4 py-4 shadow-md">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🎉</span>
          <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Ответ</span>
        </div>
        <p className="text-white font-bold text-xl leading-snug">{text}</p>
      </div>
    </AIBubble>
  );
}

function CheckBlock({ text }: { text: string }) {
  return (
    <AIBubble>
      <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="text-base mt-0.5">🔍</span>
          <div>
            <p className="text-xs font-semibold text-blue-600 mb-0.5">Проверка</p>
            <p className="text-[14px] text-gray-700 leading-relaxed">{text}</p>
          </div>
        </div>
      </div>
    </AIBubble>
  );
}

function TipBlock({ text }: { text: string }) {
  return (
    <AIBubble>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="text-base mt-0.5">💡</span>
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-0.5">Совет эксперта</p>
            <p className="text-[14px] text-gray-700 leading-relaxed">{text}</p>
          </div>
        </div>
      </div>
    </AIBubble>
  );
}

function PracticeBlock({ items, onSolve }: { items: Array<{ text: string }>; onSolve?: (text: string) => void }) {
  return (
    <AIBubble>
      <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 bg-indigo-50/50">
          <span className="text-base">🚀</span>
          <span className="text-sm font-bold text-gray-800">Потренируйся ещё</span>
        </div>
        <div className="p-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="text-violet-600 font-bold text-sm mt-0.5">{i + 1}.</span>
              <p className="text-[14px] text-gray-700 flex-1 leading-relaxed">{item.text}</p>
              {onSolve && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg border-violet-200 text-violet-600 text-xs px-3 flex-shrink-0"
                  onClick={() => onSolve(item.text)}
                >
                  Решить
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </AIBubble>
  );
}

function MotivationBlock({ text }: { text: string }) {
  return (
    <AIBubble>
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦉</span>
          <p className="text-[15px] text-gray-700 font-medium">{text}</p>
        </div>
      </div>
    </AIBubble>
  );
}

function FallbackSolutionBlock({ text }: { text: string }) {
  return (
    <AIBubble>
      <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 p-4">
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap text-[15px]">
          {text}
        </div>
      </div>
    </AIBubble>
  );
}

function LimitInfoBlock({ used, limit, bonus }: { used: number; limit: number; bonus: number }) {
  return (
    <div className="flex justify-center">
      <div className="bg-gray-50 rounded-full px-4 py-2 flex items-center gap-2 text-xs text-gray-500">
        <div className="flex gap-1">
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i < used ? 'bg-violet-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <span>Фото: {used}/{limit}</span>
        {bonus > 0 && <span className="text-amber-600">+{bonus} бонус</span>}
      </div>
    </div>
  );
}

export default function PhotoSolve() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatBlocks, setChatBlocks] = useState<ChatBlock[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showUpload, setShowUpload] = useState(true);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatBlocks]);

  const compressImage = useCallback((file: File, maxSize = 1200): Promise<string> =>
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
    }), []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Нужно фото', description: 'Загрузи изображение (jpg, png, heic)', variant: 'destructive' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: 'Файл слишком большой', description: 'Максимум 15 МБ', variant: 'destructive' });
      return;
    }
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    compressImage(file).then(b64 => {
      setImageBase64(b64);
    });
  }, [toast, compressImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSolve = async () => {
    if (!imageBase64 || !imagePreview) return;

    if (!authService.isAuthenticated()) {
      navigate('/auth');
      return;
    }

    setShowUpload(false);
    setIsLoading(true);

    const blocks: ChatBlock[] = [
      { type: 'user-image', src: imagePreview, hint: hint.trim() || undefined },
    ];
    setChatBlocks([...blocks]);

    await new Promise(r => setTimeout(r, 400));
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    blocks.push({ type: 'greeting', text: greeting });
    setChatBlocks([...blocks]);

    await new Promise(r => setTimeout(r, 600));
    blocks.push({ type: 'typing' });
    setChatBlocks([...blocks]);

    try {
      const token = authService.getToken();
      const resp = await fetch(API.AI_ASSISTANT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'photo_solve',
          image_base64: imageBase64,
          hint: hint.trim(),
        }),
      });

      const data = await resp.json();

      blocks.pop();

      if (resp.status === 403) {
        if (data.error === 'limit') {
          setShowPaywall(true);
        } else {
          toast({ title: 'Доступ ограничен', description: data.message || 'Требуется подписка', variant: 'destructive' });
        }
        setChatBlocks([...blocks]);
        setIsLoading(false);
        return;
      }

      if (!resp.ok) {
        throw new Error(data.error || 'Ошибка при решении задачи');
      }

      const result = data as SolveResult;

      if (result.recognized_text) {
        blocks.push({ type: 'condition', text: result.recognized_text, subject: result.subject });
      }

      if (result.structured) {
        const s = result.structured;
        if (s.steps?.length) {
          blocks.push({ type: 'steps', steps: s.steps });
        }
        if (s.answer) {
          blocks.push({ type: 'answer', text: s.answer });
        }
        if (s.check) {
          blocks.push({ type: 'check', text: s.check });
        }
        if (s.tip) {
          blocks.push({ type: 'tip', text: s.tip });
        }
        if (s.practice?.length) {
          blocks.push({ type: 'practice', items: s.practice });
        }
        if (s.motivation) {
          blocks.push({ type: 'motivation', text: s.motivation });
        }
      } else if (result.solution) {
        blocks.push({ type: 'fallback-solution', text: result.solution });
      }

      blocks.push({
        type: 'limit-info',
        used: result.used,
        limit: result.limit,
        bonus: result.bonus_remaining,
      });

      setChatBlocks([...blocks]);
    } catch (e) {
      blocks.pop();
      setChatBlocks([...blocks]);
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Попробуй ещё раз',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setImagePreview(null);
    setImageBase64(null);
    setHint('');
    setChatBlocks([]);
    setShowUpload(true);
  };

  const renderBlock = (block: ChatBlock, index: number) => {
    const delay = index * 300;

    switch (block.type) {
      case 'user-image':
        return (
          <AnimatedBlock key={index} delay={0}>
            <div className="flex justify-end">
              <div className="max-w-[75%]">
                <img
                  src={block.src}
                  alt="Фото задачи"
                  className="rounded-2xl rounded-tr-sm max-h-52 object-cover shadow-sm border border-gray-100"
                />
                {block.hint && (
                  <p className="text-xs text-gray-500 mt-1 text-right px-1">{block.hint}</p>
                )}
              </div>
            </div>
          </AnimatedBlock>
        );

      case 'greeting':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <GreetingBlock text={block.text} />
          </AnimatedBlock>
        );

      case 'typing':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <TypingIndicator />
          </AnimatedBlock>
        );

      case 'condition':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <ConditionBlock text={block.text} subject={block.subject} />
          </AnimatedBlock>
        );

      case 'steps':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <StepsBlock steps={block.steps} />
          </AnimatedBlock>
        );

      case 'answer':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <AnswerBlock text={block.text} />
          </AnimatedBlock>
        );

      case 'check':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <CheckBlock text={block.text} />
          </AnimatedBlock>
        );

      case 'tip':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <TipBlock text={block.text} />
          </AnimatedBlock>
        );

      case 'practice':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <PracticeBlock items={block.items} />
          </AnimatedBlock>
        );

      case 'motivation':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <MotivationBlock text={block.text} />
          </AnimatedBlock>
        );

      case 'fallback-solution':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <FallbackSolutionBlock text={block.text} />
          </AnimatedBlock>
        );

      case 'limit-info':
        return (
          <AnimatedBlock key={index} delay={delay}>
            <LimitInfoBlock used={block.used} limit={block.limit} bonus={block.bonus} />
          </AnimatedBlock>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-violet-50 via-white to-blue-50 pb-nav flex flex-col">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-violet-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-violet-50 transition-colors">
          <Icon name="ArrowLeft" size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-lg leading-tight">Решить по фото</h1>
          <p className="text-xs text-violet-500">ИИ-репетитор Studyfay</p>
        </div>
        {chatBlocks.length > 0 && (
          <button
            onClick={reset}
            className="p-2 rounded-xl hover:bg-violet-50 transition-colors"
          >
            <Icon name="Plus" size={20} className="text-violet-600" />
          </button>
        )}
        <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
          <Icon name="Camera" size={18} className="text-white" />
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pt-4">
        {showUpload && chatBlocks.length === 0 && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-4 text-white flex items-center gap-3 animate-fade-in">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📸</span>
              </div>
              <div>
                <p className="font-bold text-sm">Сфотографируй задачу</p>
                <p className="text-white/75 text-xs leading-tight mt-0.5">ЕГЭ, ОГЭ, вузовские — ИИ решит и объяснит каждый шаг</p>
              </div>
            </div>

            {!imagePreview ? (
              <div
                className="border-2 border-dashed border-violet-200 bg-white rounded-2xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <Icon name="Camera" size={36} className="text-violet-500" />
                </div>
                <p className="font-bold text-gray-800 text-base mb-1">Загрузи фото задачи</p>
                <p className="text-sm text-gray-400 mb-5">Перетащи файл или нажми кнопку</p>
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    className="rounded-xl border-violet-200 text-violet-600 hover:bg-violet-50"
                    onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                  >
                    <Icon name="Camera" size={16} className="mr-2" />
                    Камера
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:opacity-90"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    <Icon name="Image" size={16} className="mr-2" />
                    Галерея
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-violet-100">
                  <div className="relative">
                    <img src={imagePreview} alt="Фото задачи" className="w-full max-h-72 object-contain bg-gray-50" />
                    <button
                      onClick={() => { setImagePreview(null); setImageBase64(null); }}
                      className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
                    >
                      <Icon name="X" size={14} />
                    </button>
                    <div className="absolute bottom-3 left-3 bg-green-500/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      <Icon name="Check" size={11} />
                      Фото загружено
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-violet-100">
                  <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Icon name="MessageSquare" size={15} className="text-violet-500" />
                    Уточнение (необязательно)
                  </label>
                  <textarea
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="Например: «задание по химии, часть C» или «найди X»"
                    className="w-full text-sm text-gray-700 placeholder-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 resize-none border border-gray-200 focus:outline-none focus:border-violet-400 transition-colors"
                    rows={2}
                    maxLength={300}
                  />
                </div>

                <Button
                  onClick={handleSolve}
                  disabled={isLoading}
                  className="w-full h-14 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-violet-200 hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Icon name="Sparkles" size={20} />
                    Решить задачу
                  </span>
                </Button>
              </>
            )}

            {!imagePreview && (
              <>
                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Icon name="Info" size={15} className="text-violet-500" />
                    Советы
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { icon: '💡', text: 'Хорошее освещение — без теней и бликов' },
                      { icon: '📐', text: 'Держи телефон прямо над листом' },
                      { icon: '🔍', text: 'Текст задания должен быть полностью виден' },
                    ].map((tip) => (
                      <div key={tip.icon} className="flex items-start gap-2.5">
                        <span className="text-base flex-shrink-0">{tip.icon}</span>
                        <p className="text-sm text-gray-500 leading-tight">{tip.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-sm font-bold text-gray-700 mb-3">Поддерживаемые предметы</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(SUBJECT_COLORS).filter(s => s !== 'Общее').map(subject => (
                      <div key={subject} className={`bg-gradient-to-r ${SUBJECT_COLORS[subject]} text-white text-xs font-semibold px-3 py-1.5 rounded-full`}>
                        {subject}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {chatBlocks.length > 0 && (
          <div className="space-y-4 pb-6">
            {chatBlocks.map((block, i) => renderBlock(block, i))}

            {!isLoading && chatBlocks.length > 2 && (
              <AnimatedBlock delay={chatBlocks.length * 300}>
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={reset}
                    variant="outline"
                    className="flex-1 rounded-xl border-violet-200 text-violet-600 hover:bg-violet-50"
                  >
                    <Icon name="Camera" size={15} className="mr-2" />
                    Новое фото
                  </Button>
                  <Button
                    onClick={() => navigate('/assistant')}
                    className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90"
                  >
                    <Icon name="MessageSquare" size={15} className="mr-2" />
                    Спросить ИИ
                  </Button>
                </div>
              </AnimatedBlock>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {showPaywall && (
        <PaywallSheet trigger="ai_limit" onClose={() => setShowPaywall(false)} />
      )}

      <BottomNav />
    </div>
  );
}