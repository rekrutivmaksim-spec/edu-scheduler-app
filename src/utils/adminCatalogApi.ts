import { toast } from 'sonner';

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

interface NewClothing {
  image_url: string;
  name: string;
  description: string;
  category_ids: number[];
  color_ids: number[];
  archetype_ids: number[];
  replicate_category: string;
  gender: string;
}

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';
const IMAGE_PREPROCESSING_API = 'https://functions.poehali.dev/3fe8c892-ab5f-4d26-a2c5-ae4166276334';

export async function fetchCatalogData(
  selectedCatalogCategories: number[],
  selectedCatalogColors: number[],
  selectedCatalogArchetypes: number[],
  selectedCatalogGender: string
): Promise<{ filters: Filters; catalog: ClothingItem[] } | null> {
  try {
    const params = new URLSearchParams({ action: 'list' });
    if (selectedCatalogCategories.length > 0) {
      params.append('categories', selectedCatalogCategories.join(','));
    }
    if (selectedCatalogColors.length > 0) {
      params.append('colors', selectedCatalogColors.join(','));
    }
    if (selectedCatalogArchetypes.length > 0) {
      params.append('archetypes', selectedCatalogArchetypes.join(','));
    }
    if (selectedCatalogGender) {
      params.append('gender', selectedCatalogGender);
    }

    const [filtersRes, catalogRes] = await Promise.all([
      fetch(`${CATALOG_API}?action=filters`),
      fetch(`${CATALOG_API}?${params.toString()}`)
    ]);

    if (!filtersRes.ok || !catalogRes.ok) {
      throw new Error('Ошибка загрузки каталога');
    }

    const [filtersData, catalogData] = await Promise.all([
      filtersRes.json(),
      catalogRes.json()
    ]);

    return { filters: filtersData, catalog: catalogData };
  } catch (error) {
    toast.error('Ошибка загрузки каталога');
    return null;
  }
}

export async function removeBackground(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(IMAGE_PREPROCESSING_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl })
    });

    if (!response.ok) throw new Error('Failed to remove background');
    
    const data = await response.json();
    toast.success('Фон удалён');
    return data.processed_image;
  } catch (error) {
    toast.error('Ошибка удаления фона');
    return null;
  }
}

export async function addClothing(newClothing: NewClothing): Promise<boolean> {
  if (!newClothing.image_url) {
    toast.error('Добавьте ссылку на изображение');
    return false;
  }

  const adminPassword = sessionStorage.getItem('admin_auth');

  try {
    const response = await fetch(CATALOG_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': adminPassword || ''
      },
      body: JSON.stringify(newClothing)
    });

    if (response.ok) {
      toast.success('Одежда добавлена в каталог');
      return true;
    } else {
      toast.error('Ошибка добавления');
      return false;
    }
  } catch (error) {
    toast.error('Ошибка добавления');
    return false;
  }
}

export async function updateClothing(
  editingClothing: ClothingItem,
  filters: Filters | null
): Promise<boolean> {
  const adminPassword = sessionStorage.getItem('admin_auth');

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
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': adminPassword || ''
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
      return true;
    } else {
      toast.error('Ошибка обновления');
      return false;
    }
  } catch (error) {
    toast.error('Ошибка обновления');
    return false;
  }
}

export async function deleteClothing(id: string): Promise<boolean> {
  if (!confirm('Удалить эту позицию из каталога?')) return false;

  const adminPassword = sessionStorage.getItem('admin_auth');

  try {
    const response = await fetch(`${CATALOG_API}?action=delete&id=${id}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Password': adminPassword || '' }
    });

    if (response.ok) {
      toast.success('Позиция удалена');
      return true;
    } else {
      toast.error('Ошибка удаления');
      return false;
    }
  } catch (error) {
    toast.error('Ошибка удаления');
    return false;
  }
}
