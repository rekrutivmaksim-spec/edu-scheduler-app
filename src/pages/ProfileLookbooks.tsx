import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import ProfileMenu from '@/components/ProfileMenu';
import LookbookCard from '@/components/lookbooks/LookbookCard';
import LookbookViewerDialog from '@/components/lookbooks/LookbookViewerDialog';
import LookbookFormDialog from '@/components/lookbooks/LookbookFormDialog';
import { validateImageFile } from '@/utils/fileValidation';

interface Lookbook {
  id: string;
  name: string;
  person_name: string;
  photos: string[];
  color_palette: string[];
  is_public?: boolean;
  share_token?: string;
  created_at: string;
  updated_at: string;
}

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';
const IMAGE_PROXY_API = 'https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90';

export default function ProfileLookbooks() {
  const { user, isLoading: authLoading } = useAuth();
  const { lookbooks, isLoading: dataLoading, hasMoreLookbooks, isLoadingMoreLookbooks, refetchLookbooks, loadMoreLookbooks } = useData();
  const navigate = useNavigate();
  const [isCreatingLookbook, setIsCreatingLookbook] = useState(false);
  const [isEditingLookbook, setIsEditingLookbook] = useState(false);
  const [editingLookbookId, setEditingLookbookId] = useState<string | null>(null);
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [colorPalette, setColorPalette] = useState<string[]>(['#FF6B6B', '#4ECDC4', '#45B7D1']);
  const [viewingLookbook, setViewingLookbook] = useState<Lookbook | null>(null);
  const [selectedPhotoIndexes, setSelectedPhotoIndexes] = useState<number[]>([]);
  const [targetLookbookId, setTargetLookbookId] = useState<string>('');


  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
  }, [user, authLoading, navigate]);

  if (authLoading || dataLoading) {
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



  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // Валидация файла
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        toast.error(`${file.name}: ${validation.error}`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleCreateLookbook = async () => {
    if (!newLookbookName || !newPersonName) {
      toast.error('Заполните название и имя');
      return;
    }

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'insert',
          data: {
            user_id: user.id,
            name: newLookbookName,
            person_name: newPersonName,
            photos: selectedPhotos,
            color_palette: colorPalette
          }
        })
      });

      if (!response.ok) throw new Error('Failed to create lookbook');
      
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to create lookbook');
      
      await refetchLookbooks();
      
      setNewLookbookName('');
      setNewPersonName('');
      setSelectedPhotos([]);
      setColorPalette(['#FF6B6B', '#4ECDC4', '#45B7D1']);
      setIsCreatingLookbook(false);
      toast.success('Лукбук создан!');
    } catch (error) {
      toast.error('Ошибка создания лукбука');
    }
  };

  const handleEditLookbook = (lookbook: Lookbook) => {
    setEditingLookbookId(lookbook.id);
    setNewLookbookName(lookbook.name);
    setNewPersonName(lookbook.person_name);
    setSelectedPhotos(lookbook.photos);
    setColorPalette(lookbook.color_palette);
    setIsEditingLookbook(true);
  };

  const handleUpdateLookbook = async () => {
    if (!editingLookbookId) return;

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'update',
          where: { id: editingLookbookId },
          data: {
            name: newLookbookName,
            person_name: newPersonName,
            photos: selectedPhotos,
            color_palette: colorPalette
          }
        })
      });

      if (!response.ok) throw new Error('Failed to update lookbook');
      
      await refetchLookbooks();
      
      setNewLookbookName('');
      setNewPersonName('');
      setSelectedPhotos([]);
      setColorPalette(['#FF6B6B', '#4ECDC4', '#45B7D1']);
      setSelectedPhotoIndexes([]);
      setTargetLookbookId('');
      setEditingLookbookId(null);
      setIsEditingLookbook(false);
      toast.success('Лукбук обновлён!');
    } catch (error) {
      toast.error('Ошибка обновления лукбука');
    }
  };

  const handleDeleteLookbook = async (id: string) => {
    if (!confirm('Удалить лукбук?\n\nВсе фото из лукбука также будут удалены из хранилища.')) return;

    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'delete',
          where: { id }
        })
      });

      if (!response.ok) throw new Error('Failed to delete lookbook');

      await refetchLookbooks();
      toast.success('Лукбук удалён');
    } catch (error) {
      toast.error('Ошибка удаления лукбука');
    }
  };

  const handleTransferPhotos = async () => {
    if (!targetLookbookId || selectedPhotoIndexes.length === 0) return;
    
    try {
      const targetLookbook = lookbooks.find(lb => lb.id === targetLookbookId);
      if (!targetLookbook) return;

      const photosToMove = selectedPhotoIndexes.map(idx => selectedPhotos[idx]);
      const updatedPhotos = [...targetLookbook.photos, ...photosToMove];

      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'update',
          where: { id: targetLookbookId },
          data: { photos: updatedPhotos }
        })
      });

      if (!response.ok) throw new Error('Failed to move photos');

      const remainingPhotos = selectedPhotos.filter((_, idx) => !selectedPhotoIndexes.includes(idx));
      setSelectedPhotos(remainingPhotos);
      setSelectedPhotoIndexes([]);
      setTargetLookbookId('');
      await refetchLookbooks();
      toast.success('Фото перенесены!');
    } catch (error) {
      toast.error('Ошибка переноса фото');
    }
  };

  const handleCloseEditDialog = () => {
    setIsEditingLookbook(false);
    setEditingLookbookId(null);
    setNewLookbookName('');
    setNewPersonName('');
    setSelectedPhotos([]);
    setColorPalette(['#FF6B6B', '#4ECDC4', '#45B7D1']);
    setSelectedPhotoIndexes([]);
    setTargetLookbookId('');
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />
          
          <div className="flex-1">
            <div className="flex justify-between items-center mb-8">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold">Лукбуки</h1>
                  {!dataLoading && lookbooks.length > 0 && (
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                      {lookbooks.length}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-2">Управляйте своими лукбуками</p>
              </div>
              <Dialog open={isCreatingLookbook} onOpenChange={setIsCreatingLookbook}>
                <DialogTrigger asChild>
                  <Button>
                    <Icon name="Plus" size={16} className="mr-2" />
                    Создать лукбук
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <LookbookFormDialog
                    mode="create"
                    open={isCreatingLookbook}
                    onClose={() => setIsCreatingLookbook(false)}
                    lookbookName={newLookbookName}
                    setLookbookName={setNewLookbookName}
                    personName={newPersonName}
                    setPersonName={setNewPersonName}
                    selectedPhotos={selectedPhotos}
                    setSelectedPhotos={setSelectedPhotos}
                    colorPalette={colorPalette}
                    setColorPalette={setColorPalette}
                    onSubmit={handleCreateLookbook}
                    onPhotoUpload={handlePhotoUpload}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {dataLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" className="animate-spin" size={48} />
              </div>
            ) : lookbooks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Icon name="Album" size={64} className="text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Нет лукбуков</h3>
                  <p className="text-muted-foreground mb-4">Создайте первый лукбук</p>
                  <Button onClick={() => setIsCreatingLookbook(true)}>
                    <Icon name="Plus" size={16} className="mr-2" />
                    Создать лукбук
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {lookbooks.map((lookbook) => (
                    <LookbookCard
                      key={lookbook.id}
                      lookbook={lookbook}
                      onView={setViewingLookbook}
                      onEdit={handleEditLookbook}
                      onDelete={handleDeleteLookbook}
                    />
                  ))}
                </div>
                
                {hasMoreLookbooks && (
                  <div className="flex justify-center mt-6">
                    <Button
                      variant="outline"
                      onClick={loadMoreLookbooks}
                      disabled={isLoadingMoreLookbooks}
                    >
                      {isLoadingMoreLookbooks ? (
                        <>
                          <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Icon name="ChevronDown" className="mr-2" size={16} />
                          Загрузить ещё
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <LookbookViewerDialog
        lookbook={viewingLookbook}
        onClose={() => setViewingLookbook(null)}
        imageProxyApi={IMAGE_PROXY_API}
      />

      <LookbookFormDialog
        mode="edit"
        open={isEditingLookbook}
        onClose={handleCloseEditDialog}
        lookbookName={newLookbookName}
        setLookbookName={setNewLookbookName}
        personName={newPersonName}
        setPersonName={setNewPersonName}
        selectedPhotos={selectedPhotos}
        setSelectedPhotos={setSelectedPhotos}
        colorPalette={colorPalette}
        setColorPalette={setColorPalette}
        onSubmit={handleUpdateLookbook}
        editingLookbookId={editingLookbookId}
        lookbooks={lookbooks}
        selectedPhotoIndexes={selectedPhotoIndexes}
        setSelectedPhotoIndexes={setSelectedPhotoIndexes}
        targetLookbookId={targetLookbookId}
        setTargetLookbookId={setTargetLookbookId}
        onTransferPhotos={handleTransferPhotos}
        userId={user.id}
      />
    </Layout>
  );
}