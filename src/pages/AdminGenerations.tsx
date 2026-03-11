import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';

interface User {
  id: string;
  email: string;
  name: string;
}

interface GenerationHistory {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  model_used: string;
  cost: number;
  result_image: string;
  created_at: string;
}

export default function AdminGenerations() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [generationHistory, setGenerationHistory] = useState<GenerationHistory[]>([]);
  const [genUserFilter, setGenUserFilter] = useState<string>('all');
  const [genModelFilter, setGenModelFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      fetchGenerationHistory();
    }
  }, [genUserFilter, genModelFilter, users]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${ADMIN_API}?action=users`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || data);
    } catch (error) {
      toast.error('Ошибка загрузки пользователей');
    }
  };

  const fetchGenerationHistory = async () => {
    const params = new URLSearchParams({ action: 'generation_history' });
    
    if (genUserFilter && genUserFilter !== 'all') params.append('user_id', genUserFilter);
    if (genModelFilter && genModelFilter !== 'all') params.append('model', genModelFilter);

    setIsLoading(true);

    try {
      const response = await fetch(`${ADMIN_API}?${params.toString()}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setGenerationHistory(data);
        setCurrentPage(1);
      } else {
        toast.error('Ошибка загрузки истории генераций');
      }
    } catch (error) {
      toast.error('Ошибка загрузки истории генераций');
    } finally {
      setIsLoading(false);
    }
  };

  const totalCost = generationHistory.reduce((sum, gen) => sum + (gen.cost || 0), 0);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader2" className="animate-spin" size={48} />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />
          
          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Генерации</h1>
              <p className="text-muted-foreground">
                Всего генераций: {generationHistory.length} | Общая стоимость: {totalCost.toFixed(2)} ₽
              </p>
            </div>

            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Пользователь:</label>
                    <Select value={genUserFilter} onValueChange={setGenUserFilter}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все</SelectItem>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Модель:</label>
                    <Select value={genModelFilter} onValueChange={setGenModelFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все</SelectItem>
                        <SelectItem value="replicate">Replicate</SelectItem>
                        <SelectItem value="seedream">SeeDream</SelectItem>
                        <SelectItem value="nanobananapro">NanoBananaPro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Показано {Math.min((currentPage - 1) * itemsPerPage + 1, generationHistory.length)}-{Math.min(currentPage * itemsPerPage, generationHistory.length)} из {generationHistory.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
                >
                  <Icon name="ChevronLeft" size={16} className="inline" />
                  Назад
                </button>
                <span className="text-sm">
                  Страница {currentPage} из {Math.ceil(generationHistory.length / itemsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(generationHistory.length / itemsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(generationHistory.length / itemsPerPage)}
                  className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
                >
                  Вперёд
                  <Icon name="ChevronRight" size={16} className="inline" />
                </button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Превью</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Пользователь</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Модель</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Стоимость</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generationHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((gen) => (
                        <tr key={gen.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono">
                            {gen.id.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-3">
                            <img 
                              src={gen.result_image} 
                              alt="Result" 
                              className="w-16 h-16 object-cover rounded"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium">{gen.user_name}</div>
                            <div className="text-xs text-gray-500">{gen.user_email}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">{gen.model_used}</td>
                          <td className="px-4 py-3 text-sm">{gen.cost?.toFixed(2)} ₽</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(gen.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}