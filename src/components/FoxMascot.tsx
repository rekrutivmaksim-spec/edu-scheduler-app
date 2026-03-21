interface FoxMascotProps {
  size?: number;
  jumping?: boolean;
  className?: string;
}

export default function FoxMascot({ size = 120, jumping = false, className = '' }: FoxMascotProps) {
  return (
    <div
      className={`inline-block select-none ${jumping ? 'animate-bounce' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <defs>
          <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FFA94D" />
            <stop offset="100%" stopColor="#E8650A" />
          </radialGradient>
          <radialGradient id="bellyGrad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#FFE8D0" />
            <stop offset="100%" stopColor="#FFD0A8" />
          </radialGradient>
          <radialGradient id="bookGrad" cx="30%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#4F46E5" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Тень */}
        <ellipse cx="60" cy="113" rx="28" ry="5" fill="rgba(0,0,0,0.12)" />

        {/* Тело */}
        <ellipse cx="60" cy="80" rx="28" ry="30" fill="url(#bodyGrad)" />

        {/* Живот */}
        <ellipse cx="60" cy="85" rx="16" ry="18" fill="url(#bellyGrad)" />

        {/* Левое ухо */}
        <polygon points="32,38 22,8 46,28" fill="url(#bodyGrad)" />
        <polygon points="34,36 26,14 44,28" fill="#FF6B1A" />

        {/* Правое ухо */}
        <polygon points="88,38 98,8 74,28" fill="url(#bodyGrad)" />
        <polygon points="86,36 94,14 76,28" fill="#FF6B1A" />

        {/* Голова */}
        <circle cx="60" cy="46" r="28" fill="url(#bodyGrad)" />

        {/* Белые щёки */}
        <ellipse cx="44" cy="52" rx="8" ry="6" fill="#FFE8D0" opacity="0.7" />
        <ellipse cx="76" cy="52" rx="8" ry="6" fill="#FFE8D0" opacity="0.7" />

        {/* Мордочка — белый нос */}
        <ellipse cx="60" cy="54" rx="11" ry="8" fill="#FFE8D0" />

        {/* Нос */}
        <ellipse cx="60" cy="50" rx="4" ry="3" fill="#1E1B4B" />
        <circle cx="61" cy="49" r="1.2" fill="white" opacity="0.6" />

        {/* Улыбка */}
        <path d="M52 57 Q60 64 68 57" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Левый глаз */}
        <ellipse cx="47" cy="41" rx="6" ry="6.5" fill="white" />
        <circle cx="48" cy="41" r="4" fill="#1E1B4B" />
        <circle cx="49.5" cy="39.5" r="1.5" fill="white" />
        {/* Бровь левая — приподнятая, весёлая */}
        <path d="M42 34 Q47 31 52 33" stroke="#1E1B4B" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        {/* Правый глаз */}
        <ellipse cx="73" cy="41" rx="6" ry="6.5" fill="white" />
        <circle cx="72" cy="41" r="4" fill="#1E1B4B" />
        <circle cx="73.5" cy="39.5" r="1.5" fill="white" />
        {/* Бровь правая */}
        <path d="M68 33 Q73 31 78 34" stroke="#1E1B4B" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        {/* Хвост */}
        <path d="M88 95 Q110 85 105 108 Q90 115 82 100 Z" fill="url(#bodyGrad)" />
        <path d="M98 105 Q108 100 104 110 Q95 114 90 106 Z" fill="#FFE8D0" />

        {/* Книга в лапе */}
        <g transform="rotate(-15, 38, 88)">
          <rect x="18" y="78" width="32" height="22" rx="3" fill="url(#bookGrad)" />
          <rect x="20" y="78" width="2" height="22" fill="#3730A3" />
          {/* Строчки в книге */}
          <line x1="24" y1="84" x2="46" y2="84" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="24" y1="89" x2="46" y2="89" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="24" y1="94" x2="38" y2="94" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          {/* Звёздочка на обложке */}
          <text x="38" y="88" fontSize="9" fill="white" opacity="0.9" textAnchor="middle">★</text>
        </g>

        {/* Мантия/диплом — маленький свиток справа */}
        <g transform="rotate(10, 85, 88)">
          <rect x="74" y="80" width="20" height="14" rx="2" fill="#C7D2FE" />
          <rect x="74" y="80" width="20" height="4" rx="2" fill="#818CF8" />
          <line x1="77" y1="88" x2="91" y2="88" stroke="#6366F1" strokeWidth="1" opacity="0.7" />
          <line x1="77" y1="91" x2="88" y2="91" stroke="#6366F1" strokeWidth="1" opacity="0.7" />
        </g>

        {/* Искорки вокруг (статичные звёздочки) */}
        <circle cx="20" cy="30" r="2" fill="#FCD34D" opacity="0.8" filter="url(#glow)" />
        <circle cx="100" cy="25" r="1.5" fill="#FCD34D" opacity="0.7" />
        <circle cx="15" cy="70" r="1.5" fill="#A78BFA" opacity="0.7" />
        <circle cx="108" cy="65" r="2" fill="#FCD34D" opacity="0.8" filter="url(#glow)" />
        <text x="14" y="22" fontSize="8" fill="#FCD34D" opacity="0.9">✦</text>
        <text x="100" y="45" fontSize="6" fill="#C4B5FD" opacity="0.9">✦</text>
      </svg>
    </div>
  );
}
