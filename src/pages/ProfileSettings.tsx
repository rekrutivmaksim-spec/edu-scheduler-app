import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import ProfileMenu from '@/components/ProfileMenu';

const CHANGE_PASSWORD_API = 'https://functions.poehali.dev/98400760-4d03-4ca8-88ab-753fde19ef83';
const UPDATE_PROFILE_API = 'https://functions.poehali.dev/efb92b0f-c34a-4b12-ad41-744260d1173a';
const DELETE_ACCOUNT_API = 'https://functions.poehali.dev/d8626da4-6372-40c1-abba-d4ffdc89c7c4';

export default function ProfileSettings() {
  const { user, isLoading: authLoading, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    
    if (user) {
      setEditedName(user.name || '');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error('Заполните все поля');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('Новые пароли не совпадают');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Пароль должен быть минимум 6 символов');
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch(CHANGE_PASSWORD_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Пароль успешно изменён');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        toast.error(data.error || 'Ошибка при изменении пароля');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleUpdateName = async () => {
    if (!editedName.trim()) {
      toast.error('Введите имя');
      return;
    }

    try {
      const response = await fetch(UPDATE_PROFILE_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editedName
        })
      });

      const data = await response.json();

      if (response.ok) {
        updateUser(data);
        toast.success('Имя успешно изменено');
        setIsEditingName(false);
      } else {
        toast.error(data.error || 'Ошибка при изменении имени');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Вы уверены, что хотите удалить аккаунт?\n\nЭто действие нельзя отменить. Все ваши данные (лукбуки, история примерок) будут удалены безвозвратно.'
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      'Последнее предупреждение!\n\nВы действительно хотите удалить аккаунт навсегда?'
    );

    if (!doubleConfirm) return;

    try {
      const response = await fetch(DELETE_ACCOUNT_API, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Аккаунт успешно удалён');
        logout();
        navigate('/');
      } else {
        toast.error(data.error || 'Ошибка при удалении аккаунта');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />
          
          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Настройки</h1>
              <p className="text-muted-foreground">Управление профилем и безопасностью</p>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Профиль</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Email</label>
                    <Input value={user.email} disabled />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Имя</label>
                    {isEditingName ? (
                      <div className="flex gap-2">
                        <Input 
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          placeholder="Ваше имя"
                        />
                        <Button onClick={handleUpdateName}>
                          <Icon name="Check" size={16} />
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setIsEditingName(false);
                            setEditedName(user.name || '');
                          }}
                        >
                          <Icon name="X" size={16} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input value={user.name} disabled />
                        <Button onClick={() => setIsEditingName(true)}>
                          <Icon name="Edit" size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Изменить пароль</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Текущий пароль</label>
                    <div className="relative">
                      <Input 
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Введите текущий пароль"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        <Icon name={showCurrentPassword ? "EyeOff" : "Eye"} size={20} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Новый пароль</label>
                    <div className="relative">
                      <Input 
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Минимум 6 символов"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        <Icon name={showNewPassword ? "EyeOff" : "Eye"} size={20} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Подтвердите новый пароль</label>
                    <div className="relative">
                      <Input 
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmNewPassword}
                        onChange={(e) => {
                          setConfirmNewPassword(e.target.value);
                          setPasswordMismatch(false);
                        }}
                        onBlur={() => {
                          if (confirmNewPassword && newPassword !== confirmNewPassword) {
                            setPasswordMismatch(true);
                          }
                        }}
                        placeholder="Повторите новый пароль"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        <Icon name={showConfirmPassword ? "EyeOff" : "Eye"} size={20} />
                      </button>
                    </div>
                    {passwordMismatch && (
                      <p className="text-sm text-red-600 mt-1">Пароли не совпадают</p>
                    )}
                  </div>
                  <Button 
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <>
                        <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      'Изменить пароль'
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-700">Опасная зона</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    После удаления аккаунта все ваши данные будут безвозвратно удалены. Это действие нельзя отменить.
                  </p>
                  <Button 
                    variant="destructive"
                    onClick={handleDeleteAccount}
                  >
                    <Icon name="Trash" size={16} className="mr-2" />
                    Удалить аккаунт
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}