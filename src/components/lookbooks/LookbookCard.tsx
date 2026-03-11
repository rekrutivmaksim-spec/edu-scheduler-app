import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

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

interface LookbookCardProps {
  lookbook: Lookbook;
  onView: (lookbook: Lookbook) => void;
  onEdit: (lookbook: Lookbook) => void;
  onDelete: (id: string) => void;
}

export default function LookbookCard({ lookbook, onView, onEdit, onDelete }: LookbookCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div 
        className="relative h-48 bg-gray-100 cursor-pointer"
        onClick={() => onView(lookbook)}
      >
        {lookbook.photos.length > 0 ? (
          <img 
            src={lookbook.photos[0]} 
            alt={lookbook.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Icon name="Image" size={48} className="text-gray-300" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <h3 className="text-white font-semibold">{lookbook.name}</h3>
          <p className="text-white/80 text-sm">Для: {lookbook.person_name}</p>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span>{lookbook.photos.length} фото</span>
          <span>{new Date(lookbook.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1"
            onClick={() => onView(lookbook)}
          >
            <Icon name="Eye" size={16} className="mr-1" />
            Открыть
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onEdit(lookbook)}
          >
            <Icon name="Edit" size={16} />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onDelete(lookbook.id)}
          >
            <Icon name="Trash" size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
