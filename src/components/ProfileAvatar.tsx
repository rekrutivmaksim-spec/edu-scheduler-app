import { useState, useEffect } from 'react';
import { authService } from '@/lib/auth';

const GAMIFICATION_URL = 'https://functions.poehali.dev/0559fb04-cd62-4e50-bb12-dfd6941a7080';

interface AvatarTier {
  minLevel: number;
  emoji: string;
  border: string;
  bg: string;
  glow: string;
  title: string;
}

const AVATAR_TIERS: AvatarTier[] = [
  { minLevel: 0, emoji: '🌱', border: 'border-gray-300', bg: 'from-gray-400 to-gray-500', glow: '', title: 'Новичок' },
  { minLevel: 5, emoji: '🌿', border: 'border-green-400', bg: 'from-green-500 to-emerald-600', glow: '', title: 'Ученик' },
  { minLevel: 10, emoji: '🌳', border: 'border-teal-400', bg: 'from-teal-500 to-cyan-600', glow: 'shadow-teal-500/30', title: 'Студент' },
  { minLevel: 20, emoji: '⭐', border: 'border-blue-400', bg: 'from-blue-500 to-indigo-600', glow: 'shadow-blue-500/30', title: 'Знаток' },
  { minLevel: 30, emoji: '🌟', border: 'border-indigo-400', bg: 'from-indigo-500 to-purple-600', glow: 'shadow-indigo-500/30', title: 'Эксперт' },
  { minLevel: 40, emoji: '💎', border: 'border-purple-400', bg: 'from-purple-500 to-pink-600', glow: 'shadow-purple-500/40', title: 'Мастер' },
  { minLevel: 50, emoji: '👑', border: 'border-amber-400', bg: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/40', title: 'Гуру' },
  { minLevel: 70, emoji: '🏆', border: 'border-yellow-400', bg: 'from-yellow-400 to-amber-500', glow: 'shadow-yellow-500/50', title: 'Чемпион' },
  { minLevel: 90, emoji: '🚀', border: 'border-rose-400', bg: 'from-rose-500 via-pink-500 to-purple-600', glow: 'shadow-rose-500/50', title: 'Легенда' },
];

function getTier(level: number): AvatarTier {
  let result = AVATAR_TIERS[0];
  for (const tier of AVATAR_TIERS) {
    if (level >= tier.minLevel) result = tier;
  }
  return result;
}

interface ProfileAvatarProps {
  userName?: string;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

const ProfileAvatar = ({ userName, size = 'md', showBadge = true }: ProfileAvatarProps) => {
  const [level, setLevel] = useState(0);
  const [xpTotal, setXpTotal] = useState(0);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16 sm:w-20 sm:h-20',
    lg: 'w-24 h-24 sm:w-28 sm:h-28'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-4xl sm:text-5xl'
  };

  const badgeSizes = {
    sm: 'text-xs px-1 py-0.5 -bottom-1 -right-1',
    md: 'text-[10px] sm:text-xs px-1.5 py-0.5 -bottom-1 -right-1',
    lg: 'text-xs sm:text-sm px-2 py-1 -bottom-2 -right-2'
  };

  useEffect(() => {
    const loadLevel = async () => {
      try {
        const token = authService.getToken();
        if (!token) return;
        const response = await fetch(`${GAMIFICATION_URL}?action=profile`, {
          headers: { 'X-Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setLevel(data.level || 0);
          setXpTotal(data.xp_total || 0);
        }
      } catch {
        // silent
      }
    };
    loadLevel();
  }, []);

  const tier = getTier(level);
  const initial = userName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="relative inline-flex">
      <div
        className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br ${tier.bg} flex items-center justify-center shadow-lg ${tier.glow} border-2 ${tier.border} flex-shrink-0 transition-all duration-500`}
      >
        {level >= 10 ? (
          <span className={textSizes[size]}>{tier.emoji}</span>
        ) : (
          <span className={`${textSizes[size]} font-bold text-white`}>
            {initial}
          </span>
        )}
      </div>
      {showBadge && level > 0 && (
        <div className={`absolute ${badgeSizes[size]} bg-white rounded-full shadow-md border border-gray-200 font-bold text-gray-700 whitespace-nowrap`}>
          Ур.{level}
        </div>
      )}
    </div>
  );
};

export { getTier, AVATAR_TIERS };
export default ProfileAvatar;