import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

const AI_URL = 'https://functions.poehali.dev/8e8cbd4e-7731-4853-8e29-a84b3d178249';
const MATERIALS_URL = 'https://functions.poehali.dev/177e7001-b074-41cb-9553-e9c715d36f09';

interface Material {
  id: number;
  title: string;
  subject?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const Assistant = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Привет! 👋 Я твой ИИ-ассистент Studyfay. Могу ответить на вопросы по твоим материалам, объяснить сложные темы и помочь с учёбой. Задай мне вопрос!',
      timestamp: new Date()
    }
  ]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [wordsRemaining, setWordsRemaining] = useState<number | null>(null);
  const [questionsRemaining, setQuestionsRemaining] = useState<number | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }
      await loadMaterials();
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMaterials = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(MATERIALS_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.materials);
      }
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: question,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setQuestion('');
    setIsLoading(true);

    try {
      const token = authService.getToken();
      const response = await fetch(AI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: userMessage.content,
          material_ids: selectedMaterials.length > 0 ? selectedMaterials : []
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.error) {
          toast({
            title: 'Ошибка',
            description: data.error,
            variant: 'destructive'
          });
          return;
        }
        
        // Обновляем остаток вопросов В РЕАЛЬНОМ ВРЕМЕНИ
        if (data.questions_remaining !== undefined) {
          setQuestionsRemaining(data.questions_remaining);
        }
        
        // Показываем остаток вопросов после ответа
        const remainingText = data.questions_remaining !== undefined 
          ? ` (Осталось: ${data.questions_remaining})`
          : '';
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: `${data.answer}${remainingText}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else if (response.status === 403) {
        const data = await response.json();
        
        // Обновляем счётчик даже при ошибке (лимит исчерпан)
        if (data.questions_used !== undefined && data.questions_limit !== undefined) {
          setQuestionsRemaining(data.questions_limit - data.questions_used);
        }
        
        const errorMessage: Message = {
          role: 'assistant',
          content: data.message || 'Доступ к ИИ-ассистенту доступен только по подписке',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        
        toast({
          title: 'Требуется подписка',
          description: 'Оформите подписку для доступа к ИИ. Перейдите в раздел "Подписка".',
          variant: 'destructive'
        });
        
        // Перенаправляем на страницу подписки через 2 секунды
        setTimeout(() => {
          navigate('/subscription');
        }, 2000);
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось получить ответ от ИИ',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Проблема с подключением к ИИ',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMaterial = (id: number) => {
    setSelectedMaterials(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const quickQuestions = [
    'Объясни эту тему простыми словами',
    'Какие главные тезисы в материалах?',
    'Помоги подготовиться к экзамену',
    'Составь краткий конспект',
    'Какие формулы/определения важны?'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
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
                  ИИ-Ассистент
                </h1>
                {questionsRemaining !== null && (
                  <p className="text-xs text-purple-600/70 font-medium">
                    Осталось ~{questionsRemaining} {questionsRemaining === 1 ? 'вопрос' : questionsRemaining < 5 ? 'вопроса' : 'вопросов'} по подписке
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={() => setShowMaterials(!showMaterials)}
              variant="outline"
              className="rounded-xl border-2 border-purple-200"
            >
              <Icon name="BookOpen" size={20} className="mr-2" />
              Материалы ({selectedMaterials.length > 0 ? selectedMaterials.length : 'все'})
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {showMaterials && (
          <Card className="p-5 mb-6 bg-white border-2 border-purple-200">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Icon name="BookMarked" size={20} className="text-purple-600" />
              Выбери материалы для контекста
            </h3>
            {materials.length === 0 ? (
              <p className="text-sm text-gray-500">Сначала загрузите материалы в разделе &quot;Материалы&quot;</p>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={() => setSelectedMaterials([])}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  Использовать все материалы
                </Button>
                {materials.map(material => (
                  <div key={material.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-purple-50">
                    <Checkbox
                      checked={selectedMaterials.includes(material.id)}
                      onCheckedChange={() => toggleMaterial(material.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{material.title}</p>
                      {material.subject && (
                        <Badge variant="secondary" className="text-xs mt-1">{material.subject}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Icon name="Bot" size={20} className="text-white" />
                </div>
              )}
              <Card
                className={`max-w-[80%] p-4 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white border-0'
                    : 'bg-white border-2 border-purple-200'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                  {message.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </Card>
              {message.role === 'user' && (
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="User" size={20} className="text-purple-600" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Icon name="Bot" size={20} className="text-white" />
              </div>
              <Card className="p-4 bg-white border-2 border-purple-200">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length === 1 && (
          <Card className="mt-6 p-5 bg-white border-2 border-dashed border-purple-200">
            <h3 className="font-bold text-gray-800 mb-3">Примеры вопросов:</h3>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q, index) => (
                <Button
                  key={index}
                  onClick={() => setQuestion(q)}
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-full border-purple-200 hover:bg-purple-50"
                >
                  {q}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-purple-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex gap-3">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder="Задай вопрос по материалам..."
              className="resize-none rounded-xl border-2 border-purple-200 focus:border-purple-400"
              rows={2}
              disabled={isLoading}
            />
            <Button
              onClick={handleAsk}
              disabled={!question.trim() || isLoading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl px-6 self-end"
            >
              {isLoading ? (
                <Icon name="Loader2" size={20} className="animate-spin" />
              ) : (
                <Icon name="Send" size={20} />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Нажми Enter для отправки • Shift+Enter для новой строки
          </p>
        </div>
      </div>
    </div>
  );
};

export default Assistant;