import { cn } from "@/lib/utils";

export type TemplateMode = "standard" | "capsule" | "lookbook_grid";

interface TemplateModeTabsProps {
  activeMode: TemplateMode;
  onModeChange: (mode: TemplateMode) => void;
  disabled?: boolean;
}

function StandardIcon({ className }: { className?: string }) {
  return (
    <img
      src="https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/ebb5eb96-9ec1-4f29-83fe-b10d3bf233e9.svg"
      alt="Примерка"
      className={cn("w-20 h-20", className)}
    />
  );
}

function CapsuleIcon({ className }: { className?: string }) {
  return (
    <img
      src="https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/7cb0e0c3-d7c2-4d5e-828d-76618eb7d908.svg"
      alt="Капсула"
      className={cn("w-24 h-20", className)}
    />
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <img
      src="https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/c8a1fb69-d397-482f-bd61-1941de00a891.svg"
      alt="Лукбук-сетка"
      className={cn("w-[5.5rem] h-20", className)}
    />
  );
}

const modes = [
  {
    id: "standard" as TemplateMode,
    label: "Примерка",
    description: "1 образ",
    Icon: StandardIcon,
  },
  {
    id: "capsule" as TemplateMode,
    label: "Капсула",
    description: "Образ + гардероб",
    Icon: CapsuleIcon,
  },
  {
    id: "lookbook_grid" as TemplateMode,
    label: "Лукбук-сетка",
    description: "4 или 8 образов",
    Icon: GridIcon,
  },
];

export default function TemplateModeTabs({
  activeMode,
  onModeChange,
  disabled,
}: TemplateModeTabsProps) {
  return (
    <div className="flex justify-center gap-3 mb-8">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          disabled={disabled}
          className={cn(
            "flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl border-2 transition-all duration-200 min-w-[120px]",
            activeMode === mode.id
              ? "border-purple-500 bg-purple-50 text-purple-700 shadow-md"
              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <mode.Icon
            className={cn(
              activeMode === mode.id ? "text-purple-600" : "text-gray-400"
            )}
          />
          <span className="text-sm font-semibold">{mode.label}</span>
          <span className="text-[11px] opacity-70">{mode.description}</span>
        </button>
      ))}
    </div>
  );
}