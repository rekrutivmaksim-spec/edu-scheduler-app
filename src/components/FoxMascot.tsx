interface FoxMascotProps {
  size?: number;
  jumping?: boolean;
  className?: string;
}

const FOX_3D_URL = 'https://cdn.poehali.dev/projects/3ff43efa-4f20-46c2-b4c7-d9b10642fd31/files/5e501242-4bc3-4fda-92fe-1d5f618b30a9.jpg';

export default function FoxMascot({ size = 120, jumping = false, className = '' }: FoxMascotProps) {
  return (
    <div
      className={`inline-block select-none ${jumping ? 'animate-bounce' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={FOX_3D_URL}
        alt="Studyfay"
        width={size}
        height={size}
        className="w-full h-full object-contain drop-shadow-xl"
        draggable={false}
      />
    </div>
  );
}
