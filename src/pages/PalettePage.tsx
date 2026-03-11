import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { seasonalPalettes, ColorPalette } from '@/data/seasonalPalettes';
import { colorTypeRules, ColorTypeName, getPalettesForColorType } from '@/data/colorTypeRules';

const colorTypeNamesMap: Record<string, ColorTypeName> = {
  'SOFT WINTER': 'SOFT_WINTER',
  'BRIGHT WINTER': 'BRIGHT_WINTER',
  'VIVID WINTER': 'VIVID_WINTER',
  'SOFT SUMMER': 'SOFT_SUMMER',
  'DUSTY SUMMER': 'DUSTY_SUMMER',
  'VIVID SUMMER': 'VIVID_SUMMER',
  'GENTLE AUTUMN': 'GENTLE_AUTUMN',
  'FIERY AUTUMN': 'FIERY_AUTUMN',
  'VIVID AUTUMN': 'VIVID_AUTUMN',
  'GENTLE SPRING': 'GENTLE_SPRING',
  'BRIGHT SPRING': 'BRIGHT_SPRING',
  'VIBRANT SPRING': 'VIBRANT_SPRING',
};

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

interface ColorTypeAnalysis {
  id: string;
  cdn_url?: string;
  color_type: string;
  color_type_ai?: string;
  result_text: string;
  created_at: string;
}

export default function PalettePage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [analysis, setAnalysis] = useState<ColorTypeAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string } | null>(null);
  const [allColors, setAllColors] = useState<Array<{ name: string; hex: string; paletteNum: number }>>([]);
  const [activeSource, setActiveSource] = useState<'formula' | 'ai'>('formula');
  const [overrideColorType, setOverrideColorType] = useState<ColorTypeName | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!analysisId || !user) return;

    const fetchAnalysis = async () => {
      try {
        const response = await fetch(DB_QUERY_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            table: 'color_type_history',
            action: 'select',
            where: { id: analysisId },
          }),
        });

        const result = await response.json();

        if (result.success && result.data.length > 0) {
          const analysisData = result.data[0];
          setAnalysis(analysisData);

          const currentColorType = activeSource === 'formula' ? analysisData.color_type : (analysisData.color_type_ai || analysisData.color_type);
          const colorTypeKey = overrideColorType || colorTypeNamesMap[currentColorType];
          if (colorTypeKey) {
            const paletteInfo = getPalettesForColorType(colorTypeKey);
            const seasonPalettes = seasonalPalettes[paletteInfo.season];
            
            const colors: Array<{ name: string; hex: string; paletteNum: number }> = [];
            Object.entries(seasonPalettes.palette1).forEach(([name, hex]) => {
              colors.push({ name, hex, paletteNum: 1 });
            });
            Object.entries(seasonPalettes.palette2).forEach(([name, hex]) => {
              colors.push({ name, hex, paletteNum: 2 });
            });
            Object.entries(seasonPalettes.palette3).forEach(([name, hex]) => {
              colors.push({ name, hex, paletteNum: 3 });
            });

            setAllColors(colors);
            if (colors.length > 0) {
              setSelectedColor({ name: colors[0].name, hex: colors[0].hex });
            }
          }
        } else {
          toast.error('Анализ не найден');
          navigate('/profile/history-colortypes');
        }
      } catch (error) {
        console.error('Error fetching analysis:', error);
        toast.error('Ошибка загрузки данных');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [analysisId, user, navigate, activeSource, overrideColorType]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Icon name="Loader2" className="animate-spin" size={48} />
      </div>
    );
  }

  if (!user || !analysis) {
    return null;
  }

  const currentColorType = activeSource === 'formula' ? analysis.color_type : (analysis.color_type_ai || analysis.color_type);
  const baseColorTypeKey = colorTypeNamesMap[currentColorType];
  const effectiveColorTypeKey = overrideColorType || baseColorTypeKey;
  const paletteInfo = effectiveColorTypeKey ? getPalettesForColorType(effectiveColorTypeKey) : null;
  
  
  const hasAiResult = !!(
    analysis.color_type_ai && 
    analysis.color_type_ai.trim() !== '' && 
    analysis.color_type_ai.trim().toUpperCase() !== analysis.color_type.trim().toUpperCase()
  );

  console.log('🎨 Palette Debug:', {
    formula: analysis.color_type,
    ai: analysis.color_type_ai,
    hasAiResult,
    activeSource
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/profile/history-colortypes')}
              className="flex items-center gap-2"
            >
              <Icon name="ArrowLeft" size={20} />
              Вернуться
            </Button>
            {paletteInfo && (
              <h1 className="text-xl font-semibold">{paletteInfo.displayName}</h1>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4">
        <div className="bg-card border rounded-lg p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={!overrideColorType && activeSource === 'formula' ? 'default' : 'outline'}
                onClick={() => { setOverrideColorType(null); setActiveSource('formula'); }}
              >
                Формула
              </Button>
              {hasAiResult && (
                <Button
                  size="sm"
                  variant={!overrideColorType && activeSource === 'ai' ? 'default' : 'outline'}
                  onClick={() => { setOverrideColorType(null); setActiveSource('ai'); }}
                >
                  ИИ
                </Button>
              )}
            </div>
            <Select
              value={overrideColorType || ''}
              onValueChange={(value) => setOverrideColorType(value as ColorTypeName)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Другой цветотип..." />
              </SelectTrigger>
              <SelectContent>
                {Object.values(colorTypeRules).map((rule) => (
                  <SelectItem key={rule.name} value={rule.name}>
                    {rule.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8">
        <div className="grid lg:grid-cols-[1fr,1.5fr] gap-6">
          <div className="space-y-6">
            <div className="bg-card rounded-lg border overflow-hidden">
              {analysis.cdn_url && (
                <div className="bg-muted">
                  <img
                    src={analysis.cdn_url}
                    alt="Portrait"
                    className="w-full max-h-[50vh] object-contain"
                  />
                </div>
              )}

              {selectedColor && (
                <div>
                  <div
                    className="w-full h-44"
                    style={{
                      backgroundColor: selectedColor.hex,
                    }}
                  />
                  <div className="p-4">
                    <h3 className="font-semibold text-lg capitalize">
                      {selectedColor.name.replace(/-/g, ' ')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedColor.hex}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {[1, 2, 3].map((paletteNum) => {
              const paletteColors = allColors.filter((c) => c.paletteNum === paletteNum);
              if (paletteColors.length === 0) return null;

              return (
                <div key={paletteNum} className="bg-card rounded-lg border p-4">
                  <h3 className="font-semibold mb-4">Палитра {paletteNum}</h3>
                  <div className="grid grid-cols-10 gap-2">
                    {paletteColors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setSelectedColor({ name: color.name, hex: color.hex })}
                        className="group relative aspect-square rounded overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-lg"
                        style={{
                          borderColor:
                            selectedColor?.name === color.name
                              ? 'hsl(var(--primary))'
                              : 'transparent',
                        }}
                        title={color.name.replace(/-/g, ' ')}
                      >
                        <div
                          className="w-full h-full"
                          style={{
                            backgroundColor: color.hex,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}