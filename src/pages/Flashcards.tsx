import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import BottomNav from '@/components/BottomNav';

// TODO: set after deploy
const FLASHCARDS_URL = 'https://functions.poehali.dev/81b8e2fb-95cd-4dc8-97db-7e1c255471d0';
const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';

interface FlashcardSet {
  id: number;
  subject: string;
  material_ids: number[];
  total_cards: number;
  created_at: string;
  card_count: number;
  due_count: number;
}

interface Flashcard {
  id: number;
  question: string;
  answer: string;
  difficulty: string;
  topics: string[] | null;
  set_id?: number;
  subject?: string;
  progress?: {
    ease_factor: number;
    interval_days: number;
    repetitions: number;
    next_review_date: string | null;
    last_reviewed_at: string | null;
  };
}

interface Material {
  id: number;
  title: string;
  subject: string;
}

type View = 'sets' | 'study' | 'review' | 'select-materials' | 'summary';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

function getCardsWord(n: number): string {
  const abs = Math.abs(n) % 100;
  if (abs >= 11 && abs <= 19) return 'карточек';
  const last = abs % 10;
  if (last === 1) return 'карточка';
  if (last >= 2 && last <= 4) return 'карточки';
  return 'карточек';
}

const Flashcards = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [view, setView] = useState<View>('sets');
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [deletingSetId, setDeletingSetId] = useState<number | null>(null);

  // Study state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [studyResults, setStudyResults] = useState<{ easy: number; medium: number; hard: number }>({ easy: 0, medium: 0, hard: 0 });
  const [reviewDueCount, setReviewDueCount] = useState(0);
  const [activeSetId, setActiveSetId] = useState<number | null>(null);

  const authHeaders = useCallback(() => {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }, []);

  // --- Data loading ---

  const loadSets = useCallback(async () => {
    try {
      const res = await fetch(`${FLASHCARDS_URL}?action=sets`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSets(data.sets || []);
        const totalDue = (data.sets || []).reduce((sum: number, s: FlashcardSet) => sum + (s.due_count || 0), 0);
        setReviewDueCount(totalDue);
      }
    } catch (error) {
      console.error('Failed to load sets:', error);
    }
  }, [authHeaders]);

  const loadCards = useCallback(async (setId: number) => {
    setLoadingCards(true);
    try {
      const res = await fetch(`${FLASHCARDS_URL}?action=cards&set_id=${setId}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      } else {
        toast({ title: 'Ошибка', description: 'Не удалось загрузить карточки', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
      toast({ title: 'Ошибка сети', description: 'Проверьте подключение', variant: 'destructive' });
    } finally {
      setLoadingCards(false);
    }
  }, [authHeaders, toast]);

  const loadReviewCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      const res = await fetch(`${FLASHCARDS_URL}?action=review`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
        setReviewDueCount(data.total_due || 0);
      }
    } catch (error) {
      console.error('Failed to load review cards:', error);
    } finally {
      setLoadingCards(false);
    }
  }, [authHeaders]);

  const loadMaterials = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${MATERIALS_URL}?action=list`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setMaterials(data.materials || []);
      }
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/auth');
        return;
      }
      setLoading(true);
      await loadSets();
      setLoading(false);
    };
    init();
  }, [navigate, loadSets]);

  // --- Actions ---

  const handleOpenStudy = async (setId: number) => {
    setActiveSetId(setId);
    await loadCards(setId);
    setCurrentIndex(0);
    setFlipped(false);
    setStudyResults({ easy: 0, medium: 0, hard: 0 });
    setView('study');
  };

  const handleOpenReview = async () => {
    await loadReviewCards();
    setCurrentIndex(0);
    setFlipped(false);
    setStudyResults({ easy: 0, medium: 0, hard: 0 });
    setView('review');
  };

  const handleOpenMaterialSelector = async () => {
    await loadMaterials();
    setSelectedMaterials([]);
    setView('select-materials');
  };

  const toggleMaterial = (id: number) => {
    setSelectedMaterials(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedMaterials.length === 0) {
      toast({ title: 'Ошибка', description: 'Выберите хотя бы один материал', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(FLASHCARDS_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'generate', material_ids: selectedMaterials }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({ title: 'Готово', description: `Создано ${data.total} карточек по предмету "${data.subject}"` });
        await loadSets();
        setView('sets');
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: 'Ошибка', description: data.error || 'Не удалось создать карточки', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Generate error:', error);
      toast({ title: 'Ошибка сети', description: 'Проверьте подключение', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleAnswer = async (quality: number) => {
    const card = cards[currentIndex];
    if (!card || answering) return;

    setAnswering(true);

    // Track result locally
    if (quality <= 1) {
      setStudyResults(prev => ({ ...prev, hard: prev.hard + 1 }));
    } else if (quality <= 3) {
      setStudyResults(prev => ({ ...prev, medium: prev.medium + 1 }));
    } else {
      setStudyResults(prev => ({ ...prev, easy: prev.easy + 1 }));
    }

    try {
      await fetch(FLASHCARDS_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'answer', flashcard_id: card.id, quality }),
      });
    } catch (error) {
      console.error('Answer error:', error);
    }

    setAnswering(false);

    // Move to next card or show summary
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(prev => prev + 1);
      setFlipped(false);
    } else {
      setView('summary');
    }
  };

  const handleDeleteSet = async (setId: number) => {
    setDeletingSetId(setId);
    try {
      const res = await fetch(FLASHCARDS_URL, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'delete_set', set_id: setId }),
      });
      if (res.ok) {
        toast({ title: 'Удалено', description: 'Набор карточек удален' });
        await loadSets();
      } else {
        toast({ title: 'Ошибка', description: 'Не удалось удалить набор', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeletingSetId(null);
    }
  };

  const handleBackToSets = () => {
    setView('sets');
    setCards([]);
    setActiveSetId(null);
    loadSets();
  };

  // --- Render helpers ---

  const renderHeader = (title: string, showBack?: boolean) => (
    <div className="flex items-center gap-3 mb-6">
      {showBack && (
        <button
          onClick={handleBackToSets}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 border border-purple-200/50 shadow-sm"
        >
          <Icon name="ArrowLeft" size={20} className="text-purple-700" />
        </button>
      )}
      <div className="flex-1">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      </div>
    </div>
  );

  // --- SETS LIST ---

  const renderSetsView = () => (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-purple-50/30">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        {renderHeader('Флеш-карточки')}

        {/* Review banner */}
        {reviewDueCount > 0 && (
          <button
            onClick={handleOpenReview}
            className="w-full mb-5 p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon name="Clock" size={22} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-sm">Пора повторить</div>
              <div className="text-purple-200 text-xs mt-0.5">
                {reviewDueCount} {getCardsWord(reviewDueCount)} ждут повторения
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-none text-lg font-bold px-3">
              {reviewDueCount}
            </Badge>
          </button>
        )}

        {/* Create button */}
        <Button
          onClick={handleOpenMaterialSelector}
          className="w-full mb-5 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-purple-200 text-sm font-semibold"
        >
          <Icon name="Plus" size={18} className="mr-2" />
          Создать карточки
        </Button>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Icon name="Loader2" size={32} className="animate-spin text-purple-500 mb-3" />
            <p className="text-gray-500 text-sm">Загрузка...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && sets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
              <Icon name="Brain" size={36} className="text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Пока нет карточек</h3>
            <p className="text-gray-500 text-sm max-w-[260px] mb-6">
              Создайте первый набор флеш-карточек из ваших учебных материалов
            </p>
            <Button
              onClick={handleOpenMaterialSelector}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-11 px-6 text-sm font-semibold"
            >
              <Icon name="Sparkles" size={16} className="mr-2" />
              Создать первый набор
            </Button>
          </div>
        )}

        {/* Sets list */}
        {!loading && sets.length > 0 && (
          <div className="space-y-3">
            {sets.map(set => (
              <Card
                key={set.id}
                className="p-4 border border-purple-100/80 shadow-sm bg-white/90 backdrop-blur rounded-2xl"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="Brain" size={20} className="text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{set.subject}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {set.card_count} {getCardsWord(set.card_count)}
                      </span>
                      {set.due_count > 0 && (
                        <Badge className="bg-orange-100 text-orange-700 border-none text-[10px] px-1.5 py-0">
                          {set.due_count} к повторению
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        onClick={() => handleOpenStudy(set.id)}
                        size="sm"
                        className="flex-1 h-8 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium"
                      >
                        <Icon name="Play" size={14} className="mr-1" />
                        Учить
                      </Button>
                      {set.due_count > 0 && (
                        <Button
                          onClick={async () => {
                            await loadCards(set.id);
                            // Filter to only due cards
                            setCurrentIndex(0);
                            setFlipped(false);
                            setStudyResults({ easy: 0, medium: 0, hard: 0 });
                            setActiveSetId(set.id);
                            setView('study');
                          }}
                          size="sm"
                          variant="outline"
                          className="h-8 border-purple-200 text-purple-700 rounded-lg text-xs font-medium"
                        >
                          <Icon name="RefreshCw" size={14} className="mr-1" />
                          Повторить
                        </Button>
                      )}
                      <button
                        onClick={() => handleDeleteSet(set.id)}
                        disabled={deletingSetId === set.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
                      >
                        {deletingSetId === set.id ? (
                          <Icon name="Loader2" size={14} className="animate-spin" />
                        ) : (
                          <Icon name="Trash2" size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );

  // --- MATERIAL SELECTOR ---

  const renderMaterialSelector = () => (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-purple-50/30">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        {renderHeader('Выбор материалов', true)}

        {generating ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center mb-4 animate-pulse">
              <Icon name="Sparkles" size={36} className="text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">ИИ создает карточки...</h3>
            <p className="text-gray-500 text-sm text-center max-w-[260px]">
              Анализируем материалы и генерируем вопросы. Это займет несколько секунд.
            </p>
            <Icon name="Loader2" size={24} className="animate-spin text-purple-500 mt-6" />
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Выберите материалы, на основе которых ИИ создаст флеш-карточки для запоминания
            </p>

            {materials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <Icon name="FileText" size={28} className="text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-700 mb-1">Нет материалов</h3>
                <p className="text-gray-500 text-sm max-w-[240px] mb-4">
                  Сначала загрузите учебные материалы
                </p>
                <Button
                  onClick={() => navigate('/materials')}
                  variant="outline"
                  className="border-purple-200 text-purple-700 rounded-xl h-10 text-sm"
                >
                  <Icon name="Upload" size={16} className="mr-2" />
                  Загрузить материалы
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-5">
                  {materials.map(mat => {
                    const isSelected = selectedMaterials.includes(mat.id);
                    return (
                      <button
                        key={mat.id}
                        onClick={() => toggleMaterial(mat.id)}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-purple-400 bg-purple-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-purple-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-gray-300'
                            }`}
                          >
                            {isSelected && <Icon name="Check" size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">{mat.title}</div>
                            {mat.subject && (
                              <div className="text-xs text-gray-500 mt-0.5">{mat.subject}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={selectedMaterials.length === 0}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-purple-200 text-sm font-semibold disabled:opacity-50"
                >
                  <Icon name="Sparkles" size={16} className="mr-2" />
                  Создать карточки ({selectedMaterials.length} выбрано)
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  // --- STUDY / REVIEW MODE ---

  const renderStudyView = () => {
    if (loadingCards) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-purple-50/30 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <Icon name="Loader2" size={32} className="animate-spin text-purple-500 mb-3" />
            <p className="text-gray-500 text-sm">Загрузка карточек...</p>
          </div>
        </div>
      );
    }

    if (cards.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-purple-50/30">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
            {renderHeader(view === 'review' ? 'Повторение' : 'Изучение', true)}
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mb-4">
                <Icon name="CheckCircle" size={32} className="text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Все повторено!</h3>
              <p className="text-gray-500 text-sm">Нет карточек для повторения прямо сейчас</p>
            </div>
          </div>
        </div>
      );
    }

    const card = cards[currentIndex];
    if (!card) return null;

    const progress = ((currentIndex + 1) / cards.length) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-purple-50/30">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleBackToSets}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/80 border border-purple-200/50 shadow-sm"
            >
              <Icon name="X" size={20} className="text-gray-600" />
            </button>
            <div className="flex-1">
              <div className="text-xs text-gray-500 font-medium mb-1">
                {currentIndex + 1} / {cards.length}
              </div>
              <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            {card.subject && (
              <Badge className="bg-purple-100 text-purple-700 border-none text-[10px]">
                {card.subject}
              </Badge>
            )}
          </div>

          {/* Flip card */}
          <div
            className="relative w-full mt-6 mb-8"
            style={{ perspective: '1200px' }}
          >
            <div
              onClick={() => !flipped && setFlipped(true)}
              className="relative w-full cursor-pointer transition-transform duration-500"
              style={{
                transformStyle: 'preserve-3d',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                minHeight: '280px',
              }}
            >
              {/* Front - Question */}
              <div
                className="absolute inset-0 rounded-2xl shadow-lg border-2 border-purple-200/60 p-6 flex flex-col items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)',
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                  <Icon name="HelpCircle" size={20} className="text-purple-500" />
                </div>
                <p className="text-center text-gray-900 font-medium text-base leading-relaxed">
                  {card.question}
                </p>
                {card.difficulty && (
                  <Badge className={`mt-4 border-none text-[10px] ${DIFFICULTY_COLORS[card.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                    {card.difficulty === 'easy' ? 'Легко' : card.difficulty === 'hard' ? 'Сложно' : 'Средне'}
                  </Badge>
                )}
                <p className="text-xs text-gray-400 mt-4">Нажмите, чтобы перевернуть</p>
              </div>

              {/* Back - Answer */}
              <div
                className="absolute inset-0 rounded-2xl shadow-lg border-2 border-indigo-200/60 p-6 flex flex-col items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)',
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                  <Icon name="Lightbulb" size={20} className="text-indigo-500" />
                </div>
                <p className="text-center text-gray-900 font-medium text-base leading-relaxed">
                  {card.answer}
                </p>
              </div>
            </div>
          </div>

          {/* Answer buttons - show only when flipped */}
          {flipped && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <p className="text-center text-xs text-gray-500 mb-2">Как хорошо вы знали ответ?</p>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => handleAnswer(1)}
                  disabled={answering}
                  className="h-14 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 flex flex-col items-center gap-0.5 font-medium shadow-none"
                  variant="outline"
                >
                  {answering ? (
                    <Icon name="Loader2" size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Icon name="X" size={18} />
                      <span className="text-[11px]">Не помню</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleAnswer(3)}
                  disabled={answering}
                  className="h-14 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex flex-col items-center gap-0.5 font-medium shadow-none"
                  variant="outline"
                >
                  {answering ? (
                    <Icon name="Loader2" size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Icon name="Minus" size={18} />
                      <span className="text-[11px]">Сложно</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleAnswer(5)}
                  disabled={answering}
                  className="h-14 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 flex flex-col items-center gap-0.5 font-medium shadow-none"
                  variant="outline"
                >
                  {answering ? (
                    <Icon name="Loader2" size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Icon name="Check" size={18} />
                      <span className="text-[11px]">Легко</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- SUMMARY ---

  const renderSummary = () => {
    const total = studyResults.easy + studyResults.medium + studyResults.hard;
    const easyPercent = total > 0 ? Math.round((studyResults.easy / total) * 100) : 0;

    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-purple-50/30">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-5">
              <Icon name="Trophy" size={36} className="text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Отлично!</h2>
            <p className="text-gray-500 text-sm mb-8">
              Вы прошли {total} {getCardsWord(total)}
            </p>

            {/* Stats cards */}
            <div className="w-full grid grid-cols-3 gap-3 mb-8">
              <Card className="p-4 text-center border border-green-200/80 bg-green-50/50 rounded-2xl">
                <div className="text-2xl font-bold text-green-600">{studyResults.easy}</div>
                <div className="text-[11px] text-green-700 mt-1">Легко</div>
              </Card>
              <Card className="p-4 text-center border border-amber-200/80 bg-amber-50/50 rounded-2xl">
                <div className="text-2xl font-bold text-amber-600">{studyResults.medium}</div>
                <div className="text-[11px] text-amber-700 mt-1">Сложно</div>
              </Card>
              <Card className="p-4 text-center border border-red-200/80 bg-red-50/50 rounded-2xl">
                <div className="text-2xl font-bold text-red-600">{studyResults.hard}</div>
                <div className="text-[11px] text-red-700 mt-1">Не помню</div>
              </Card>
            </div>

            {/* Mastery indicator */}
            <div className="w-full mb-8">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-500">Уровень знания</span>
                <span className="font-semibold text-purple-700">{easyPercent}%</span>
              </div>
              <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${easyPercent}%` }}
                />
              </div>
            </div>

            <div className="w-full space-y-3">
              {activeSetId && (
                <Button
                  onClick={() => handleOpenStudy(activeSetId)}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold"
                >
                  <Icon name="RotateCcw" size={16} className="mr-2" />
                  Пройти ещё раз
                </Button>
              )}
              <Button
                onClick={handleBackToSets}
                variant="outline"
                className="w-full h-12 border-purple-200 text-purple-700 rounded-xl text-sm font-semibold"
              >
                <Icon name="ArrowLeft" size={16} className="mr-2" />
                К наборам
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- MAIN RENDER ---

  if (view === 'sets') return renderSetsView();
  if (view === 'select-materials') return renderMaterialSelector();
  if (view === 'study' || view === 'review') return renderStudyView();
  if (view === 'summary') return renderSummary();

  return renderSetsView();
};

export default Flashcards;