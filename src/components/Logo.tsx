export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      
      {/* Вешалка */}
      <path 
        d="M 30 35 L 30 30 Q 30 25 35 25 L 50 25 Q 55 25 55 30 L 55 35" 
        stroke="url(#logoGradient)" 
        strokeWidth="4" 
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Крючок вешалки */}
      <circle 
        cx="50" 
        cy="20" 
        r="5" 
        stroke="url(#logoGradient)" 
        strokeWidth="3" 
        fill="none"
      />
      
      {/* Планка вешалки */}
      <line 
        x1="20" 
        y1="35" 
        x2="80" 
        y2="35" 
        stroke="url(#logoGradient)" 
        strokeWidth="5" 
        strokeLinecap="round"
      />
      
      {/* Рубашка */}
      <path 
        d="M 35 40 L 30 50 L 30 75 Q 30 78 33 78 L 67 78 Q 70 78 70 75 L 70 50 L 65 40" 
        fill="url(#logoGradient)" 
        opacity="0.2"
      />
      
      {/* Воротник */}
      <path 
        d="M 45 40 L 40 45 L 45 50 L 50 48 L 55 50 L 60 45 L 55 40 Z" 
        fill="url(#logoGradient)"
      />
      
      {/* AI искорка */}
      <circle cx="75" cy="25" r="3" fill="#ec4899">
        <animate 
          attributeName="opacity" 
          values="1;0.3;1" 
          dur="2s" 
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="82" cy="30" r="2" fill="#9333ea">
        <animate 
          attributeName="opacity" 
          values="0.3;1;0.3" 
          dur="2s" 
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="78" cy="33" r="2.5" fill="#ec4899">
        <animate 
          attributeName="opacity" 
          values="1;0.5;1" 
          dur="2s" 
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
