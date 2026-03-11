import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface ColorTypeHistory {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  status: string;
  color_type: string;
  result_text: string;
  person_image: string;
  cdn_url: string;
  cost: number;
  refunded: boolean;
  created_at: string;
}

export default function AdminColorTypes() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [colorTypeHistory, setColorTypeHistory] = useState<ColorTypeHistory[]>([]);
  const [userFilter, setUserFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ColorTypeHistory | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ColorTypeHistory | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      fetchColorTypeHistory();
    }
  }, [userFilter, statusFilter, users]);

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

  const fetchColorTypeHistory = async () => {
    const adminToken = localStorage.getItem('admin_jwt');
    const params = new URLSearchParams({ action: 'colortype_history' });
    
    if (userFilter && userFilter !== 'all') params.append('user_id', userFilter);
    if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

    setIsLoading(true);

    try {
      const response = await fetch(`${ADMIN_API}?${params.toString()}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setColorTypeHistory(data);
        setCurrentPage(1);
      } else {
        toast.error('Ошибка загрузки истории цветотипов');
      }
    } catch (error) {
      toast.error('Ошибка загрузки истории цветотипов');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (item: ColorTypeHistory) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    const adminToken = localStorage.getItem('admin_jwt');
    
    try {
      const response = await fetch(`${ADMIN_API}?action=delete_colortype&analysis_id=${itemToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Запись удалена');
        setColorTypeHistory(prev => prev.filter(item => item.id !== itemToDelete.id));
        setDeleteDialogOpen(false);
        setItemToDelete(null);
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      completed: { label: 'Завершён', color: 'bg-green-100 text-green-800' },
      failed: { label: 'Ошибка', color: 'bg-red-100 text-red-800' },
      processing: { label: 'В процессе', color: 'bg-yellow-100 text-yellow-800' },
      pending: { label: 'Ожидает', color: 'bg-gray-100 text-gray-800' }
    };

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const paginatedHistory = colorTypeHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isLoading && colorTypeHistory.length === 0) {
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
              <h1 className="text-3xl font-bold mb-2">Цветотипы</h1>
              <p className="text-muted-foreground">История анализов цветотипов</p>
            </div>

            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Пользователь:</label>
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger className="w-[200px]">
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
                    <label className="text-sm font-medium">Статус:</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все</SelectItem>
                        <SelectItem value="completed">Завершён</SelectItem>
                        <SelectItem value="failed">Ошибка</SelectItem>
                        <SelectItem value="processing">В процессе</SelectItem>
                        <SelectItem value="pending">Ожидает</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Показано {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, colorTypeHistory.length)} из {colorTypeHistory.length}
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
                  Страница {currentPage} из {Math.ceil(colorTypeHistory.length / itemsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(colorTypeHistory.length / itemsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(colorTypeHistory.length / itemsPerPage)}
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
                        <th className="px-4 py-3 text-left text-sm font-medium">Пользователь</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Результат</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Статус</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Стоимость</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Дата</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Действия</th>
                        <th className="px-4 py-3 text-center text-sm font-medium">Удалить</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistory.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono">
                            {item.id.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div>
                              <div className="font-medium">{item.user_name || 'Без имени'}</div>
                              <div className="text-xs text-muted-foreground">{item.user_email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {item.color_type || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(item.status)}
                              {item.refunded && (
                                <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                                  Возврат
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {item.cost?.toFixed(2)} ₽
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(item.created_at).toLocaleString('ru-RU')}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Icon name="Eye" size={16} />
                              Детали
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.status === 'failed' && (
                              <button
                                onClick={() => handleDeleteClick(item)}
                                className="text-red-600 hover:text-red-800 transition-colors inline-flex items-center justify-center"
                                title="Удалить запись"
                              >
                                <Icon name="Trash2" size={18} />
                              </button>
                            )}
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

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали анализа цветотипа</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Пользователь</p>
                  <p className="text-sm">{selectedItem.user_name || 'Без имени'}</p>
                  <p className="text-xs text-muted-foreground">{selectedItem.user_email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Статус</p>
                  {getStatusBadge(selectedItem.status)}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Цветотип</p>
                  <p className="text-sm">{selectedItem.color_type || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Стоимость</p>
                  <p className="text-sm">{selectedItem.cost?.toFixed(2)} ₽</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Дата</p>
                  <p className="text-sm">{new Date(selectedItem.created_at).toLocaleString('ru-RU')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Возврат</p>
                  <p className="text-sm">{selectedItem.refunded ? 'Да' : 'Нет'}</p>
                </div>
              </div>

              {(selectedItem.person_image || selectedItem.cdn_url) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Фото пользователя</p>
                  <img 
                    src={selectedItem.cdn_url || selectedItem.person_image} 
                    alt="Фото пользователя"
                    className="w-full max-w-md rounded-lg border"
                  />
                </div>
              )}

              {selectedItem.result_text && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Полный результат</p>
                  <div className="text-sm bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                    {selectedItem.result_text}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground">ID анализа</p>
                <p className="text-xs font-mono text-muted-foreground">{selectedItem.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Вы уверены, что хотите удалить эту запись анализа цветотипа?
            </p>
            {itemToDelete && (
              <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                <p><strong>ID:</strong> {itemToDelete.id.substring(0, 8)}...</p>
                <p><strong>Пользователь:</strong> {itemToDelete.user_email}</p>
                <p><strong>Дата:</strong> {new Date(itemToDelete.created_at).toLocaleString('ru-RU')}</p>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDeleteDialogOpen(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              Отмена
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Удалить
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}