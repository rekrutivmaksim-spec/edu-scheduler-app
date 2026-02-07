import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import UpgradeModal from '@/components/UpgradeModal';

const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';
const FLASHCARDS_URL = 'https://functions.poehali.dev/3e5686d6-03f9-44e8-bdb5-9e212f84cfb2';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

interface Material {
  id: number;
  title: string;
  subject?: string;
  recognized_text?: string;
  summary?: string;
}

interface Flashcard {
  id: number;
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topics: string[];
}

interface FlashcardSet {
  set_id: number;
  subject: string;
  total_cards: number;
  cards: Flashcard[];
  study_tips: string[];
}

const Flashcards = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [subject, setSubject] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [flashcardSet, setFlashcardSet] = useState<FlashcardSet | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      await loadSubscriptionStatus();
      await loadMaterials();
    };
    checkAuth();
  }, [navigate]);

  const loadSubscriptionStatus = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${SUBSCRIPTION_URL}?action=status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setIsPremium(data.is_premium || false);
      }
    } catch (error) {
      console.error('Failed to check subscription:', error);
    }
  };

  const loadMaterials = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(MATERIALS_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMaterials(data.materials);
      }
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  };

  const toggleMaterial = (id: number) => {
    setSelectedMaterials(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    if (!subject.trim() || selectedMaterials.length === 0) {
      toast({
        title: "Ошибка",
        description: "Укажите предмет и выберите хотя бы один материал",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      const token = authService.getToken();
      const response = await fetch(FLASHCARDS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: subject.trim(),
          material_ids: selectedMaterials
        })
      });

      if (response.ok) {
        const data = await response.json();
        setFlashcardSet(data);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setCorrectCount(0);
        toast({
          title: "✅ Карточки готовы!",
          description: `Создано ${data.total_cards} карточек для изучения`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Ошибка",
          description: errorData.error || "Не удалось создать карточки",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Проблема с подключением к серверу",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleKnow = () => {
    setCorrectCount(correctCount + 1);
    goToNextCard();
  };

  const handleDontKnow = () => {
    goToNextCard();
  };

  const goToNextCard = () => {
    if (flashcardSet && currentCardIndex < flashcardSet.cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    } else {
      setShowResults(true);
    }
  };

  const resetStudy = () => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowResults(false);
    setCorrectCount(0);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-700 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'hard': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Легко';
      case 'medium': return 'Средне';
      case 'hard': return 'Сложно';
      default: return 'Неизвестно';
    }
  };

  const currentCard = flashcardSet?.cards[currentCardIndex];
  const progress = flashcardSet ? ((currentCardIndex + 1) / flashcardSet.total_cards) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="Умные Карточки"
        description="Эта функция доступна только в Premium подписке. Получите доступ к AI-генерации карточек для эффективного запоминания."
      />
      
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-purple-100/50 h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              >
                <Icon name="ArrowLeft" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
              </Button>
              <div className="overflow-hidden">
                <h1 className="text-base sm:text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent break-words">
                  🎴 Умные Карточки
                </h1>
                <p className="text-[10px] sm:text-xs text-purple-600/70 font-medium truncate">AI создает карточки для быстрого запоминания</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!flashcardSet ? (
          <Card className="p-6 bg-white">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <Icon name="BookOpen" size={24} className="mr-2 text-purple-600" />
              Создайте набор карточек
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <Label htmlFor="subject" className="text-gray-700 font-semibold">
                  Предмет *
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Например: Высшая математика"
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-gray-700 font-semibold">
                  Выберите материалы ({selectedMaterials.length} выбрано)
                </Label>
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                  {materials.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      Материалы не найдены. Добавьте материалы в разделе "Материалы"
                    </p>
                  ) : (
                    materials.map(material => (
                      <div
                        key={material.id}
                        onClick={() => toggleMaterial(material.id)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                          selectedMaterials.includes(material.id)
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-800">{material.title}</h3>
                            {material.subject && (
                              <p className="text-sm text-gray-500">{material.subject}</p>
                            )}
                          </div>
                          {selectedMaterials.includes(material.id) && (
                            <Icon name="CheckCircle2" size={24} className="text-purple-600" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || selectedMaterials.length === 0 || !subject.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isGenerating ? (
                <>
                  <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                  Создаю карточки...
                </>
              ) : (
                <>
                  <Icon name="Sparkles" size={20} className="mr-2" />
                  Создать карточки
                </>
              )}
            </Button>
          </Card>
        ) : showResults ? (
          <Card className="p-8 bg-white text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Отлично!</h2>
              <p className="text-gray-600">Вы прошли все {flashcardSet.total_cards} карточек</p>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 mb-6">
              <p className="text-4xl font-bold text-purple-600 mb-2">
                {correctCount} / {flashcardSet.total_cards}
              </p>
              <p className="text-gray-600">Карточек знаете</p>
              <div className="mt-4">
                <Progress 
                  value={(correctCount / flashcardSet.total_cards) * 100} 
                  className="h-3"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={resetStudy}
                variant="outline"
                className="flex-1"
              >
                <Icon name="RotateCcw" size={20} className="mr-2" />
                Повторить
              </Button>
              <Button
                onClick={() => {
                  setFlashcardSet(null);
                  setShowResults(false);
                }}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Icon name="Plus" size={20} className="mr-2" />
                Новый набор
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Карточка {currentCardIndex + 1} из {flashcardSet.total_cards}
                </p>
                <Badge className={getDifficultyColor(currentCard?.difficulty || '')}>
                  {getDifficultyLabel(currentCard?.difficulty || '')}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFlashcardSet(null);
                  setShowResults(false);
                }}
              >
                <Icon name="X" size={20} />
              </Button>
            </div>

            <Progress value={progress} className="h-2" />

            <div 
              className="relative h-96 cursor-pointer perspective-1000"
              onClick={handleFlip}
            >
              <div 
                className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* Front */}
                <Card className={`absolute w-full h-full backface-hidden ${!isFlipped ? 'block' : 'hidden'}`}>
                  <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-pink-50">
                    <Icon name="HelpCircle" size={48} className="text-purple-400 mb-6" />
                    <h3 className="text-2xl font-bold text-center text-gray-800">
                      {currentCard?.question}
                    </h3>
                    <p className="text-sm text-gray-500 mt-6">Нажмите для просмотра ответа</p>
                  </div>
                </Card>

                {/* Back */}
                <Card className={`absolute w-full h-full backface-hidden ${isFlipped ? 'block' : 'hidden'}`}>
                  <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <Icon name="CheckCircle2" size={48} className="text-purple-400 mb-6" />
                    <div className="text-lg text-center text-gray-800 space-y-2">
                      {currentCard?.answer}
                    </div>
                    {currentCard?.topics && currentCard.topics.length > 0 && (
                      <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        {currentCard.topics.map((topic, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            {isFlipped && (
              <div className="flex gap-3">
                <Button
                  onClick={handleDontKnow}
                  variant="outline"
                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                >
                  <Icon name="X" size={20} className="mr-2" />
                  Не знаю
                </Button>
                <Button
                  onClick={handleKnow}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Icon name="Check" size={20} className="mr-2" />
                  Знаю
                </Button>
              </div>
            )}
          </div>
        )}

        {flashcardSet && flashcardSet.study_tips && flashcardSet.study_tips.length > 0 && !showResults && (
          <Card className="mt-6 p-4 bg-purple-50 border-purple-200">
            <h3 className="font-semibold text-purple-800 mb-2 flex items-center">
              <Icon name="Lightbulb" size={18} className="mr-2" />
              Советы по изучению
            </h3>
            <ul className="text-sm text-purple-700 space-y-1">
              {flashcardSet.study_tips.map((tip, idx) => (
                <li key={idx}>• {tip}</li>
              ))}
            </ul>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Flashcards;
