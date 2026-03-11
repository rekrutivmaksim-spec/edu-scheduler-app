import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface EyeColorOption {
  label: string;
  value: string;
  gradient: [string, string]; // [outer, inner]
}

interface EyeColorSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Record<string, string>; // Russian → English mapping
}

// Color mapping for eye colors (English value → [outer, inner] gradient colors)
const eyeColorMap: Record<string, [string, string]> = {
  // Turquoise / Бирюзовые
  turquoise: ["#1b6165", "#51a99b"],
  "turquoise blue": ["#1c929f", "#6feae0"],

  // Azure / Лазурные
  azure: ["#1b3865", "#589cc9"],
  "light turquoise": ["#5072a6", "#6fb9ea"],

  // Blue / Голубые
  blue: ["#3e6791", "#74b6d5"],
  cyan: ["#2e99b3", "#74d2d5"],
  "soft blue": ["#7991a9", "#86b3d1"],
  "light blue": ["#7597b1", "#a7ccdd"],
  "warm blue": ["#5fa7b3", "#85b8bb"],
  "cool blue": ["#4d6a8c", "#9bdaf7"],
  "bright blue": ["#5aa9e9", "#5ccad9"],

  // Green / Зелёные
  green: ["#416267", "#79b96f"],
  "emerald green": ["#1e6851", "#3a9b7c"],
  "light green": ["#417562", "#c4dca0"],
  "dark green": ["#423b29", "#5b6d30"],
  "warm green": ["#506735", "#959e4f"],
  "bright green": ["#20755e", "#9fbb70"],

  // Golden / Золотистые
  golden: ["#855f38", "#d59e54"],
  "golden brown": ["#41200d", "#c39456"],

  // Brown / Карие
  brown: ["#4d341a", "#673c17"],
  "light brown": ["#6b4936", "#a57a54"],
  "dark brown": ["#2e1c18", "#3a2417"],
  "cool brown": ["#4a4436", "#756146"],
  "bright brown": ["#48280f", "#794914"],

  // Brown-Green / Коричнево-зелёные
  "brown-green": ["#48280f", "#6c6434"],
  "bright brown-green": ["#6d3204", "#88912b"],

  // Brown-Black / Коричнево-чёрные
  "brown-black": ["#3a2220", "#241a11"],

  // Jade / Нефритовые
  jade: ["#2f5851", "#5c9561"],

  // Hazel / Ореховые
  hazel: ["#7f6f4d", "#b98a28"],
  "icy hazel": ["#675b37", "#9f9676"],
  "light hazel": ["#5d5e36", "#cdb26d"],
  "dark hazel": ["#50341e", "#957c3d"],

  // Olive / Оливковые
  "olive green": ["#6e5d31", "#899135"],
  "dark olive": ["#434a3a", "#6b6b3a"],

  // Gray-Blue / Серо-голубые
  "gray-blue": ["#676f73", "#6a91b7"],
  "soft gray-blue": ["#7c94a0", "#8cabc3"],
  "bright gray-blue": ["#7b8285", "#54b3df"],

  // Gray-Green / Серо-зелёные
  "gray-green": ["#425363", "#7f9960"],
  "soft gray-green": ["#76838f", "#A2AC8A"],

  // Gray-Brown / Серо-карие
  "light grey brown": ["#3e4f56", "#9b856c"],

  // Gray / Серые
  gray: ["#425363", "#798593"],
  "soft gray": ["#576878", "#849ba8"],
  "light grey": ["#A9A9A9", "#a0b2c3"],
  "dark grey": ["#343d4c", "#506169"],

  // Blue-Green / Сине-зелёные
  "blue-green": ["#3a8ccd", "#6da781"],
  "light blue-green": ["#5d98c5", "#c4dca0"],
  "bright blue-green": ["#2b72ab", "#bad78a"],

  // Blue-Gray / Сине-серые
  "blue-gray": ["#596f79", "#74aad5"],

  // Cocoa / Цвета какао
  cocoa: ["#6F4E37", "#7d4444"],

  // Black-Brown / Чёрно-карие
  "black-brown": ["#3B2F2F", "#3B2F2F"],

  // Black / Чёрные
  black: ["#1e2629", "#2a2924"],

  // Chocolate / Шоколадные
  chocolate: ["#53290f", "#7B3F00"],

  // Topaz / Топазовые
  topaz: ["#723612", "#ae632d"],

  // Amber / Янтарные
  amber: ["#4f2203", "#b98030"],

  // Other / Другие
  muted: ["#B0B0B0", "#9bb6bd"],
  dark: ["#211003", "#2f1207"],
  cool: ["#708090", "#617b95"],
};

// Eye icon component with radial gradient
function EyeIcon({ gradient }: { gradient: [string, string] }) {
  const [outerColor, innerColor] = gradient;
  return (
    <div
      className="w-[30px] h-[30px] rounded-full flex items-center justify-center relative flex-shrink-0"
      style={{
        background: `radial-gradient(circle, ${innerColor} 0%, ${innerColor} 38%, ${outerColor} 95%)`,
      }}
    >
      {/* Pupil (black circle) */}
      <div className="w-[10px] h-[10px] rounded-full bg-black relative">
        {/* Highlight (white circle, offset from center) */}
        <div
          className="w-[4px] h-[4px] rounded-full bg-white absolute"
          style={{ top: "1px", left: "2px" }}
        />
      </div>
    </div>
  );
}

export default function EyeColorSelector({
  value,
  onChange,
  disabled = false,
  options,
}: EyeColorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert options to array with gradients
  const colorOptions: EyeColorOption[] = Object.entries(options).map(
    ([ru, en]) => ({
      label: ru,
      value: en,
      gradient: eyeColorMap[en] || ["#999999", "#999999"], // Default gray if color not found
    }),
  );

  // Filter options based on search
  const filteredOptions = colorOptions.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Get selected option
  const selectedOption = colorOptions.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected value display */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedOption ? (
            <>
              <EyeIcon gradient={selectedOption.gradient} />
              <span className="text-left truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Выберите цвет глаз</span>
          )}
        </div>
        <Icon
          name={isOpen ? "ChevronUp" : "ChevronDown"}
          size={20}
          className="flex-shrink-0 text-muted-foreground"
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border sticky top-0 bg-background">
            <div className="relative">
              <Icon
                name="Search"
                size={16}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-64">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors text-left ${
                    value === option.value ? "bg-muted" : ""
                  }`}
                >
                  <EyeIcon gradient={option.gradient} />
                  <span className="flex-1">{option.label}</span>
                  {value === option.value && (
                    <Icon name="Check" size={16} className="text-primary" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Ничего не найдено
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
