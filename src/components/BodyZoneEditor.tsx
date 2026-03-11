import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface BodyZone {
  type: 'head' | 'upper_body' | 'lower_body' | 'legs' | 'feet';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface BodyZoneEditorProps {
  image: string;
  onSave: (zones: BodyZone[]) => void;
  onClose: () => void;
  existingZones?: BodyZone[];
}

const DEFAULT_ZONES: Omit<BodyZone, 'x' | 'y' | 'width' | 'height'>[] = [
  { type: 'head', label: 'Голова (шляпы, аксессуары)', color: 'rgba(255, 107, 107, 0.3)' },
  { type: 'upper_body', label: 'Верх (топы, куртки)', color: 'rgba(78, 205, 196, 0.3)' },
  { type: 'lower_body', label: 'Низ (брюки, юбки)', color: 'rgba(69, 183, 209, 0.3)' },
  { type: 'legs', label: 'Ноги (колготки)', color: 'rgba(255, 195, 113, 0.3)' },
  { type: 'feet', label: 'Обувь', color: 'rgba(196, 113, 237, 0.3)' }
];

export default function BodyZoneEditor({ image, onSave, onClose, existingZones }: BodyZoneEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zones, setZones] = useState<BodyZone[]>(existingZones || []);
  const [selectedZoneType, setSelectedZoneType] = useState<BodyZone['type'] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxWidth = 800;
      const maxHeight = 600;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      setImgDimensions({ width, height });

      if (imgRef.current) {
        imgRef.current.width = width;
        imgRef.current.height = height;
      }

      drawCanvas();
    };
    img.src = image;
    imgRef.current = img;
  }, [image]);

  useEffect(() => {
    drawCanvas();
  }, [zones, startPoint, isDrawing, selectedZoneType]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    zones.forEach((zone) => {
      ctx.fillStyle = zone.color;
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      
      ctx.strokeStyle = zone.color.replace('0.3', '1');
      ctx.lineWidth = 2;
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.fillText(zone.label, zone.x + 5, zone.y + 15);
    });

    if (isDrawing && startPoint && selectedZoneType) {
      const currentZone = DEFAULT_ZONES.find(z => z.type === selectedZoneType);
      if (currentZone) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (startPoint.x - rect.left) * (canvas.width / rect.width);
        const mouseY = (startPoint.y - rect.top) * (canvas.height / rect.height);

        ctx.fillStyle = currentZone.color;
        ctx.fillRect(startPoint.x, startPoint.y, mouseX - startPoint.x, mouseY - startPoint.y);
        
        ctx.strokeStyle = currentZone.color.replace('0.3', '1');
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(startPoint.x, startPoint.y, mouseX - startPoint.x, mouseY - startPoint.y);
        ctx.setLineDash([]);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedZoneType) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = ((e.clientY - rect.top) * (canvas.height / rect.height));

    setIsDrawing(true);
    setStartPoint({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    drawCanvas();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !selectedZoneType) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const endX = ((e.clientX - rect.left) * (canvas.width / rect.width));
    const endY = ((e.clientY - rect.top) * (canvas.height / rect.height));

    const width = endX - startPoint.x;
    const height = endY - startPoint.y;

    if (Math.abs(width) > 10 && Math.abs(height) > 10) {
      const zoneTemplate = DEFAULT_ZONES.find(z => z.type === selectedZoneType);
      if (zoneTemplate) {
        const newZone: BodyZone = {
          ...zoneTemplate,
          x: Math.min(startPoint.x, endX),
          y: Math.min(startPoint.y, endY),
          width: Math.abs(width),
          height: Math.abs(height)
        };

        setZones(prev => {
          const filtered = prev.filter(z => z.type !== selectedZoneType);
          return [...filtered, newZone];
        });
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
  };

  const handleRemoveZone = (type: BodyZone['type']) => {
    setZones(zones.filter(z => z.type !== type));
  };

  const handleSave = () => {
    if (zones.length === 0) {
      return;
    }
    onSave(zones);
  };

  const hasZone = (type: BodyZone['type']) => zones.some(z => z.type === type);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-5xl p-6 my-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Разметка зон примерки</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Выберите тип зоны и нарисуйте прямоугольник на фото
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <Icon name="X" size={20} />
            </Button>
          </div>

          <div className="grid md:grid-cols-[1fr,300px] gap-4">
            <div className="border rounded-lg overflow-hidden bg-muted/30">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="cursor-crosshair w-full"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Выберите зону для разметки:</p>
                <div className="space-y-2">
                  {DEFAULT_ZONES.map((zone) => (
                    <div key={zone.type} className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={selectedZoneType === zone.type ? 'default' : 'outline'}
                        onClick={() => setSelectedZoneType(zone.type)}
                        className="flex-1 justify-start"
                      >
                        <div
                          className="w-4 h-4 rounded mr-2 border"
                          style={{ backgroundColor: zone.color, borderColor: zone.color.replace('0.3', '1') }}
                        />
                        {zone.label}
                      </Button>
                      {hasZone(zone.type) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveZone(zone.type)}
                        >
                          <Icon name="Trash2" size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex gap-2">
                  <Icon name="Info" className="text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" size={16} />
                  <div className="text-xs text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">Как размечать:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Выберите тип зоны (голова, верх, низ...)</li>
                      <li>Нажмите и потяните мышкой чтобы нарисовать область</li>
                      <li>Зоны можно перерисовывать</li>
                      <li>Разметка сохранится для всех примерок</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Размечено зон: {zones.length} из {DEFAULT_ZONES.length}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={zones.length === 0}>
              <Icon name="Save" className="mr-2" size={16} />
              Сохранить разметку
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
