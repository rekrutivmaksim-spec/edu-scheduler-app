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

interface Lookbook {
  id: string;
  user_id: string;
  name: string;
  person_name: string;
  photos: string[];
  created_at: string;
}

export default function AdminLookbooks() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [filteredLookbooks, setFilteredLookbooks] = useState<Lookbook[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLookbooks, setTotalLookbooks] = useState(0);
  const lookbooksPerPage = 50;

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  useEffect(() => {
    if (selectedUserId === 'all') {
      setFilteredLookbooks(lookbooks);
    } else {
      setFilteredLookbooks(lookbooks.filter(lb => lb.user_id === selectedUserId));
    }
  }, [selectedUserId, lookbooks]);

  const fetchData = async () => {
    setIsLoading(true);

    try {
      const offset = (currentPage - 1) * lookbooksPerPage;
      const [usersRes, lookbooksRes] = await Promise.all([
        fetch(`${ADMIN_API}?action=users&limit=1000&offset=0`, {
          credentials: 'include'
        }),
        fetch(`${ADMIN_API}?action=lookbooks&limit=${lookbooksPerPage}&offset=${offset}`, {
          credentials: 'include'
        })
      ]);

      if (usersRes.status === 401 || lookbooksRes.status === 401) {
        navigate('/vf-console');
        return;
      }

      if (!usersRes.ok || !lookbooksRes.ok) throw new Error('Failed to fetch data');

      const [usersData, lookbooksData] = await Promise.all([
        usersRes.json(),
        lookbooksRes.json()
      ]);

      setUsers(usersData.users || usersData);
      const lookbooksArray = lookbooksData.lookbooks || lookbooksData;
      setLookbooks(lookbooksArray);
      setFilteredLookbooks(lookbooksArray);
      setTotalLookbooks(lookbooksData.total || lookbooksArray.length);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  };

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
              <h1 className="text-3xl font-bold mb-2">Лукбуки</h1>
              <p className="text-muted-foreground">Всего лукбуков: {totalLookbooks}</p>
            </div>

            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">Фильтр по пользователю:</label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все пользователи</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email} ({user.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Название</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Для кого</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Фото</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Создатель</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Дата создания</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLookbooks.map((lookbook) => {
                        const user = users.find(u => u.id === lookbook.user_id);
                        return (
                          <tr key={lookbook.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium">{lookbook.name}</td>
                            <td className="px-4 py-3 text-sm">{lookbook.person_name}</td>
                            <td className="px-4 py-3 text-sm">{lookbook.photos.length}</td>
                            <td className="px-4 py-3 text-sm">{user?.email || 'Unknown'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(lookbook.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {totalLookbooks > lookbooksPerPage && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <Icon name="ChevronLeft" size={16} />
                  Назад
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Страница {currentPage} из {Math.ceil(totalLookbooks / lookbooksPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalLookbooks / lookbooksPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(totalLookbooks / lookbooksPerPage)}
                >
                  Вперёд
                  <Icon name="ChevronRight" size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}