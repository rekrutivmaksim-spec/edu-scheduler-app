import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import UpgradeModal from '@/components/UpgradeModal';
import ReactMarkdown from 'react-markdown';

const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';
const EXAM_URL = 'https://functions.poehali.dev/fdcff74e-fb1a-49cc-bd7d-a462ade65859';
const SUBSCRIPTION_URL = 'https://functions.poehali.dev/7fe183c2-49af-4817-95f3-6ab4912778c4';

interface Material {
  id: number;
  title: string;
  subject?: string;
  recognized_text?: string;
  summary?: string;
}

interface Question {
  question: string;
  probability: number;
  answer: string;
  topics: string[];
  difficulty: string;
}

interface StudyPlan {
  day_1?: { focus: string; tasks: string[]; topics: string[] };
  day_2?: { focus: string; tasks: string[]; topics: string[] };
  day_3?: { focus: string; tasks: string[]; topics: string[] };
}

interface Prediction {
  subject: string;
  key_topics: string[];
  questions: Question[];
  study_plan: StudyPlan;
  exam_tips: string[];
}

const ExamPrep = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [subject, setSubject] = useState('');
  const [pastExams, setPastExams] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [activeTab, setActiveTab] = useState('setup');
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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

  const handleAnalyze = async () => {
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

    setIsAnalyzing(true);

    try {
      const token = authService.getToken();
      const response = await fetch(EXAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: subject.trim(),
          material_ids: selectedMaterials,
          past_exams: pastExams.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPrediction(data.prediction);
        setActiveTab('results');
        toast({
          title: "✅ Анализ готов!",
          description: `Найдено ${data.prediction.questions.length} вероятных вопросов`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Ошибка",
          description: errorData.error || "Не удалось проанализировать материалы",
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
      setIsAnalyzing(false);
    }
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 80) return 'bg-red-100 text-red-700';
    if (prob >= 60) return 'bg-orange-100 text-orange-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '🟢';
      case 'medium': return '🟡';
      case 'hard': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="AI-прогноз экзамена"
        description="Эта функция доступна только в Premium подписке. Получите доступ к AI-анализу материалов и прогнозу вопросов."
      />
      <header className="bg-white/70 backdrop-blur-xl border-b border-purple-200/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-xl hover:bg-purple-100/50"
              >
                <Icon name="ArrowLeft" size={24} className="text-purple-600" />
              </Button>
              <div>
                <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  🎯 Прогноз вопросов на экзамене
                </h1>
                <p className="text-xs text-purple-600/70 font-medium">AI анализирует материалы и предсказывает вопросы</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="setup">Настройка</TabsTrigger>
            <TabsTrigger value="results" disabled={!prediction}>Результаты</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-6">
            <Card className="p-6 bg-white">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Icon name="BookOpen" size={24} className="mr-2 text-purple-600" />
                Шаг 1: Выберите предмет и материалы
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
                    className="mt-2 rounded-xl border-2 border-purple-200/50 focus:border-purple-500"
                  />
                </div>

                <div>
                  <Label className="text-gray-700 font-semibold mb-3 block">
                    Материалы для анализа * (выберите один или несколько)
                  </Label>
                  {materials.length === 0 ? (
                    <Card className="p-6 text-center border-2 border-dashed border-purple-200">
                      <Icon name="FileQuestion" size={40} className="mx-auto mb-3 text-purple-400" />
                      <p className="text-gray-600 mb-3">Нет материалов для анализа</p>
                      <Button
                        onClick={() => navigate('/materials')}
                        variant="outline"
                        className="rounded-xl"
                      >
                        Загрузить материалы
                      </Button>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {materials.map((material) => (
                        <Card
                          key={material.id}
                          className={`p-4 cursor-pointer transition-all ${
                            selectedMaterials.includes(material.id)
                              ? 'border-2 border-purple-500 bg-purple-50'
                              : 'border-2 border-gray-200 hover:border-purple-300'
                          }`}
                          onClick={() => toggleMaterial(material.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {selectedMaterials.includes(material.id) ? (
                                <Icon name="CheckCircle2" size={24} className="text-purple-600" />
                              ) : (
                                <Icon name="Circle" size={24} className="text-gray-300" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-800 mb-1">{material.title}</h3>
                              {material.subject && (
                                <Badge variant="outline" className="text-xs">
                                  {material.subject}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <Icon name="FileText" size={24} className="mr-2 text-purple-600" />
                Шаг 2: Прошлогодние билеты (опционально)
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Если у вас есть прошлогодние экзаменационные билеты, вставьте их текст сюда. AI учтёт паттерны при прогнозе.
              </p>
              <Textarea
                value={pastExams}
                onChange={(e) => setPastExams(e.target.value)}
                placeholder="Вставьте текст прошлогодних билетов..."
                className="min-h-[150px] rounded-xl border-2 border-purple-200/50 focus:border-purple-500"
              />
            </Card>

            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || selectedMaterials.length === 0 || !subject.trim()}
              className="w-full py-6 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-purple-500/30"
            >
              {isAnalyzing ? (
                <>
                  <Icon name="Loader2" size={24} className="mr-2 animate-spin" />
                  Анализирую материалы...
                </>
              ) : (
                <>
                  <Icon name="Sparkles" size={24} className="mr-2" />
                  Создать прогноз вопросов
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {prediction && (
              <>
                <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    📊 {prediction.subject}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Всего вопросов</p>
                      <p className="text-3xl font-bold text-purple-600">{prediction.questions.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Ключевых тем</p>
                      <p className="text-3xl font-bold text-indigo-600">{prediction.key_topics.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Дней подготовки</p>
                      <p className="text-3xl font-bold text-pink-600">3</p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Ключевые темы:</p>
                    <div className="flex flex-wrap gap-2">
                      {prediction.key_topics.map((topic, idx) => (
                        <Badge key={idx} className="bg-purple-100 text-purple-700">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <Icon name="Target" size={24} className="mr-2 text-purple-600" />
                    Прогноз вопросов
                  </h2>
                  <div className="space-y-4">
                    {prediction.questions.map((q, idx) => (
                      <Card key={idx} className="p-5 border-2 border-gray-200 hover:border-purple-300 transition-all">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                            <span className="text-lg font-bold text-purple-600">#{idx + 1}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-bold text-gray-800 text-lg flex-1">{q.question}</h3>
                              <Badge className={`ml-3 ${getProbabilityColor(q.probability)}`}>
                                {q.probability}%
                              </Badge>
                            </div>
                            <div className="prose prose-sm max-w-none mb-3 bg-gray-50 p-3 rounded-lg">
                              <span className="font-semibold text-purple-600">Ответ:</span>
                              <ReactMarkdown>{q.answer}</ReactMarkdown>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-sm">{getDifficultyIcon(q.difficulty)} {q.difficulty}</span>
                              {q.topics.map((topic, tidx) => (
                                <Badge key={tidx} variant="outline" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>

                <Card className="p-6 bg-white">
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <Icon name="Calendar" size={24} className="mr-2 text-purple-600" />
                    План подготовки
                  </h2>
                  <div className="space-y-4">
                    {Object.entries(prediction.study_plan).map(([day, plan]: [string, any]) => (
                      <Card key={day} className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-purple-200">
                        <h3 className="font-bold text-lg text-gray-800 mb-2">
                          📅 {day.replace('_', ' ').toUpperCase()}
                        </h3>
                        <p className="text-purple-700 font-semibold mb-3">🎯 {plan.focus}</p>
                        <div className="space-y-2">
                          {plan.tasks.map((task: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2">
                              <Icon name="CheckCircle" size={18} className="text-purple-600 mt-0.5" />
                              <span className="text-gray-700">{task}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>

                {prediction.exam_tips && prediction.exam_tips.length > 0 && (
                  <Card className="p-6 bg-yellow-50 border-2 border-yellow-200">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                      <Icon name="Lightbulb" size={24} className="mr-2 text-yellow-600" />
                      Советы к экзамену
                    </h2>
                    <ul className="space-y-2">
                      {prediction.exam_tips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-yellow-600">💡</span>
                          <span className="text-gray-700">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ExamPrep;