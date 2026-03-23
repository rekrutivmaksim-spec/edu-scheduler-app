interface Props {
  isWeekend: boolean;
}

export default function WeekendXpBanner({ isWeekend }: Props) {
  if (!isWeekend) return null;

  return (
    <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 rounded-3xl px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
          ⚡
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-white font-extrabold text-base">Двойной XP!</p>
            <div className="bg-white/25 rounded-lg px-2 py-0.5">
              <p className="text-white text-xs font-extrabold">×2</p>
            </div>
          </div>
          <p className="text-white/80 text-xs">Сегодня выходной — за каждое действие получаешь XP в 2 раза больше</p>
        </div>
      </div>
    </div>
  );
}
