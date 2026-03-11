import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';

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

interface LookbookViewerDialogProps {
  lookbook: Lookbook | null;
  onClose: () => void;
  imageProxyApi: string;
}

export default function LookbookViewerDialog({ lookbook, onClose, imageProxyApi }: LookbookViewerDialogProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    if (!lookbook) return;
    
    setIsGeneratingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const usableWidth = pageWidth - 2 * margin;
      
      const encodeText = (text: string) => {
        const chars: { [key: string]: string } = {
          'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
          'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
          'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
          'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
          'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
          'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
          'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return text.split('').map(char => chars[char] || char).join('');
      };
      
      pdf.setFontSize(24);
      pdf.text(encodeText(lookbook.name), margin, margin + 10);
      
      pdf.setFontSize(14);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`For: ${encodeText(lookbook.person_name)}`, margin, margin + 20);
      
      let yPos = margin + 35;
      
      const colorSize = 8;
      lookbook.color_palette.forEach((color, i) => {
        pdf.setFillColor(parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
        pdf.rect(margin + i * (colorSize + 2), yPos, colorSize, colorSize, 'F');
      });
      
      yPos += 20;
      
      const loadImage = async (url: string): Promise<string> => {
        console.log('[PDF] Loading image:', url);
        try {
          if (url.startsWith('data:')) {
            console.log('[PDF] Image is already base64');
            return url;
          }

          console.log('[PDF] Using image proxy for:', url);
          const proxyUrl = `${imageProxyApi}?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          
          if (!response.ok) {
            throw new Error(`Proxy failed: HTTP ${response.status}`);
          }
          
          const data = await response.json();
          console.log('[PDF] Image loaded via proxy, size:', data.data_url.length);
          
          return data.data_url;
        } catch (error) {
          console.error('[PDF] Error loading image:', url, error);
          throw error;
        }
      };
      
      const photos = lookbook.photos;
      const cellWidth = usableWidth / 3;
      const gap = 3;
      const imageWidth = cellWidth - gap;
      const imageHeight = imageWidth * 1.4;
      
      let currentX = margin;
      let currentY = yPos;
      let photosInRow = 0;
      
      for (let i = 0; i < photos.length; i++) {
        if (currentY + imageHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
          currentX = margin;
          photosInRow = 0;
        }
        
        try {
          const imgData = await loadImage(photos[i]);
          pdf.addImage(imgData, 'JPEG', currentX, currentY, imageWidth, imageHeight, undefined, 'FAST');
        } catch (e) {
          console.error('Failed to load image:', e);
        }
        
        photosInRow++;
        
        if (photosInRow === 3) {
          currentX = margin;
          currentY += imageHeight + gap;
          photosInRow = 0;
        } else {
          currentX += cellWidth;
        }
      }
      
      pdf.save(`${encodeText(lookbook.name)}.pdf`);
      toast.success('PDF скачан!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Ошибка создания PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <Dialog open={!!lookbook} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-light">{lookbook?.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">Для: {lookbook?.person_name}</p>
            </div>
            <Button 
              onClick={handleDownloadPDF} 
              disabled={isGeneratingPDF}
              size="sm"
              className="mr-5"
            >
              {isGeneratingPDF ? (
                <>
                  <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                  Создание PDF...
                </>
              ) : (
                <>
                  <Icon name="Download" className="mr-2" size={16} />
                  Скачать PDF
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {lookbook && (
          <div className="space-y-6 py-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Цветовая палитра</h3>
              <div className="flex gap-3 flex-wrap">
                {lookbook.color_palette.map((color, index) => (
                  <div
                    key={index}
                    className="w-14 h-14 rounded-lg shadow-md"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {lookbook.photos.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Результаты примерок</h3>
                <div className="grid grid-cols-3 gap-3">
                  {lookbook.photos.map((photo, index) => (
                    <div key={index} className="relative rounded-lg overflow-hidden bg-muted aspect-[5/7]">
                      <ImageViewer 
                        src={photo} 
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
