import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';
import ImageCropper from '@/components/ImageCropper';
import { useCatalogFilters, useCatalog } from '@/hooks/useCatalog';
import AdminCatalogFilters from '@/components/admin/AdminCatalogFilters';
import AdminCatalogItemForm from '@/components/admin/AdminCatalogItemForm';
import AdminCatalogGrid from '@/components/admin/AdminCatalogGrid';

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
  replicate_category?: string;
  gender?: string;
  created_at: string;
}

interface FilterOption {
  id: number | string;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
  genders: FilterOption[];
}

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';
const IMAGE_PREPROCESSING_API = 'https://functions.poehali.dev/3fe8c892-ab5f-4d26-a2c5-ae4166276334';

export default function AdminCatalog() {
  const navigate = useNavigate();
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [showAddClothing, setShowAddClothing] = useState(false);
  const [selectedCatalogCategories, setSelectedCatalogCategories] = useState<number[]>([]);
  const [selectedCatalogColors, setSelectedCatalogColors] = useState<number[]>([]);
  const [selectedCatalogArchetypes, setSelectedCatalogArchetypes] = useState<number[]>([]);
  const [selectedCatalogGender, setSelectedCatalogGender] = useState<string>('');

  const { data: filters } = useCatalogFilters();
  const { data: clothingItems, refetchCatalog } = useCatalog({
    categoryIds: selectedCatalogCategories.length > 0 ? selectedCatalogCategories : undefined,
    colorIds: selectedCatalogColors.length > 0 ? selectedCatalogColors : undefined,
    archetypeIds: selectedCatalogArchetypes.length > 0 ? selectedCatalogArchetypes : undefined,
    gender: selectedCatalogGender || undefined,
  });
  const [editingClothing, setEditingClothing] = useState<ClothingItem | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [newClothing, setNewClothing] = useState({
    image_url: '',
    name: '',
    description: '',
    category_ids: [] as number[],
    color_ids: [] as number[],
    archetype_ids: [] as number[],
    replicate_category: '' as string,
    gender: 'unisex' as string
  });
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');
  const [uploadSource, setUploadSource] = useState<'url' | 'file'>('url');

  useEffect(() => {
    
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCatalogCategories, selectedCatalogColors, selectedCatalogArchetypes, selectedCatalogGender]);

  const handleRemoveBackground = async () => {
    if (!newClothing.image_url) {
      toast.error('Сначала загрузите изображение');
      return;
    }

    setIsProcessingImage(true);
    try {
      const response = await fetch(IMAGE_PREPROCESSING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: newClothing.image_url })
      });

      if (!response.ok) throw new Error('Failed to remove background');
      
      const data = await response.json();
      setNewClothing(prev => ({ ...prev, image_url: data.processed_image }));
      
      toast.success('Фон удалён');
    } catch (error) {
      toast.error('Ошибка удаления фона');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    setNewClothing(prev => ({ ...prev, image_url: croppedImage }));
    setShowCropper(false);
    setImageToCrop('');
    toast.success('Изображение обрезано');
  };

  const handleAddClothing = async () => {
    if (!newClothing.image_url) {
      toast.error('Добавьте ссылку на изображение');
      return;
    }

    try {
      const response = await fetch(CATALOG_API, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newClothing)
      });

      if (response.ok) {
        toast.success('Одежда добавлена в каталог');
        setShowAddClothing(false);
        setNewClothing({
          image_url: '',
          name: '',
          description: '',
          category_ids: [],
          color_ids: [],
          archetype_ids: [],
          replicate_category: '',
          gender: 'unisex'
        });
        setUploadSource('url');
        refetchCatalog();
      } else {
        toast.error('Ошибка добавления');
      }
    } catch (error) {
      toast.error('Ошибка добавления');
    }
  };

  const handleEditClothing = (item: ClothingItem) => {
    setEditingClothing(item);
  };

  const handleUpdateClothing = async () => {
    if (!editingClothing) return;

    try {
      const categoryIds = filters?.categories
        .filter(cat => editingClothing.categories.includes(cat.name))
        .map(cat => cat.id) || [];
      
      const colorIds = filters?.colors
        .filter(col => editingClothing.colors.includes(col.name))
        .map(col => col.id) || [];
      
      const archetypeIds = filters?.archetypes
        .filter(arch => editingClothing.archetypes.includes(arch.name))
        .map(arch => arch.id) || [];

      const response = await fetch(CATALOG_API, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: editingClothing.id,
          image_url: editingClothing.image_url,
          name: editingClothing.name,
          description: editingClothing.description,
          category_ids: categoryIds,
          color_ids: colorIds,
          archetype_ids: archetypeIds,
          replicate_category: editingClothing.replicate_category || 'upper_body',
          gender: editingClothing.gender || 'unisex'
        })
      });

      if (response.ok) {
        toast.success('Одежда обновлена');
        setEditingClothing(null);
        refetchCatalog();
      } else {
        toast.error('Ошибка обновления');
      }
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  };

  const handleDeleteClothing = async (id: string) => {
    if (!confirm('Удалить эту позицию из каталога?')) return;

    try {
      const response = await fetch(`${CATALOG_API}?action=delete&id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Позиция удалена');
        refetchCatalog();
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const handleResetFilters = () => {
    setSelectedCatalogCategories([]);
    setSelectedCatalogColors([]);
    setSelectedCatalogArchetypes([]);
    setSelectedCatalogGender('');
  };

  const handleFormSubmit = () => {
    if (editingClothing) {
      handleUpdateClothing();
    } else {
      handleAddClothing();
    }
  };

  const handleFormCancel = () => {
    setShowAddClothing(false);
    setEditingClothing(null);
    setNewClothing({
      image_url: '',
      name: '',
      description: '',
      category_ids: [],
      color_ids: [],
      archetype_ids: [],
      replicate_category: '',
      gender: 'unisex'
    });
    setUploadSource('url');
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />
          
          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Каталог</h1>
              <p className="text-muted-foreground">Управление каталогом одежды</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Каталог одежды ({clothingItems.length} позиций)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <AdminCatalogFilters
                    filters={filters}
                    selectedCategories={selectedCatalogCategories}
                    selectedColors={selectedCatalogColors}
                    selectedArchetypes={selectedCatalogArchetypes}
                    selectedGender={selectedCatalogGender}
                    onCategoriesChange={setSelectedCatalogCategories}
                    onColorsChange={setSelectedCatalogColors}
                    onArchetypesChange={setSelectedCatalogArchetypes}
                    onGenderChange={setSelectedCatalogGender}
                    onResetFilters={handleResetFilters}
                  />

                  <Button onClick={() => { setShowAddClothing(true); setEditingClothing(null); }}>
                    <Icon name="Plus" className="w-4 h-4 mr-2" />
                    Добавить одежду
                  </Button>

                  {(showAddClothing || editingClothing) && (
                    <AdminCatalogItemForm
                      filters={filters}
                      editingClothing={editingClothing}
                      newClothing={newClothing}
                      uploadSource={uploadSource}
                      isProcessingImage={isProcessingImage}
                      onNewClothingChange={setNewClothing}
                      onEditingClothingChange={setEditingClothing}
                      onUploadSourceChange={setUploadSource}
                      onImageCrop={(image) => {
                        setImageToCrop(image);
                        setShowCropper(true);
                      }}
                      onRemoveBackground={handleRemoveBackground}
                      onSubmit={handleFormSubmit}
                      onCancel={handleFormCancel}
                    />
                  )}

                  <AdminCatalogGrid
                    items={clothingItems}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onEdit={handleEditClothing}
                    onDelete={handleDeleteClothing}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showCropper && imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          open={showCropper}
          onClose={() => {
            setShowCropper(false);
            setImageToCrop('');
          }}
          onCropComplete={handleCropComplete}
          aspectRatio={3 / 4}
        />
      )}
    </Layout>
  );
}