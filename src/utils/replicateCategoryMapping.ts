interface ClothingItem {
  categories: string[];
  replicate_category?: string;
}

interface SelectedClothing {
  category?: string;
}

export function mapCategoryFromCatalog(item: ClothingItem): string {
  if (item.replicate_category) {
    return item.replicate_category;
  }
  
  const categories = item.categories || [];
  
  if (categories.some(cat => ['Платья', 'Комбинезоны'].includes(cat))) {
    return 'dresses';
  }
  if (categories.some(cat => ['Верх', 'Пиджаки и костюмы', 'Верхняя одежда'].includes(cat))) {
    return 'upper_body';
  }
  if (categories.some(cat => ['Низ'].includes(cat))) {
    return 'lower_body';
  }
  
  return 'upper_body';
}

export function checkCategoryCompatibility(selectedClothingItems: SelectedClothing[]): boolean {
  const hasDresses = selectedClothingItems.some(item => item.category === 'dresses');
  const hasOtherCategories = selectedClothingItems.some(
    item => item.category === 'upper_body' || item.category === 'lower_body'
  );
  
  if (hasDresses && hasOtherCategories) {
    return false;
  }
  
  return true;
}
