import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

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

interface AdminCatalogGridProps {
  items: ClothingItem[];
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onEdit: (item: ClothingItem) => void;
  onDelete: (id: string) => void;
}

export default function AdminCatalogGrid({
  items,
  currentPage,
  itemsPerPage,
  onPageChange,
  onEdit,
  onDelete
}: AdminCatalogGridProps) {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {paginatedItems.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 space-y-2">
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-48 object-cover rounded"
            />
            <h3 className="font-semibold">{item.name || 'Без названия'}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.description}
            </p>
            <div className="text-xs space-y-1">
              {item.categories.length > 0 && (
                <div>
                  <span className="font-medium">Категории:</span>{' '}
                  {item.categories.join(', ')}
                </div>
              )}
              {item.colors.length > 0 && (
                <div>
                  <span className="font-medium">Цвета:</span>{' '}
                  {item.colors.join(', ')}
                </div>
              )}
              {item.archetypes.length > 0 && (
                <div>
                  <span className="font-medium">Архетипы:</span>{' '}
                  {item.archetypes.join(', ')}
                </div>
              )}
              {item.replicate_category && (
                <div>
                  <span className="font-medium">Replicate:</span>{' '}
                  {item.replicate_category === 'upper_body' && 'Верх'}
                  {item.replicate_category === 'lower_body' && 'Низ'}
                  {item.replicate_category === 'dresses' && 'Полный образ'}
                </div>
              )}
              {item.gender && (
                <div>
                  <span className="font-medium">Пол:</span>{' '}
                  {item.gender === 'male' && 'Мужское'}
                  {item.gender === 'female' && 'Женское'}
                  {item.gender === 'unisex' && 'Унисекс'}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
                className="flex-1"
              >
                <Icon name="Edit" className="w-4 h-4 mr-1" />
                Изменить
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(item.id)}
              >
                <Icon name="Trash2" className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <Icon name="ChevronLeft" className="w-4 h-4" />
          </Button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ))}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <Icon name="ChevronRight" className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
