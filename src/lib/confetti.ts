import confetti from 'canvas-confetti';

export function fireConfetti() {
  const end = Date.now() + 1500;
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981'];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function fireBurst() {
  confetti({
    particleCount: 80,
    spread: 100,
    origin: { y: 0.6 },
    colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981'],
  });
}

export function fireStars() {
  const defaults = { spread: 360, ticks: 60, gravity: 0, decay: 0.96, startVelocity: 20, colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8'] };
  confetti({ ...defaults, particleCount: 30, scalar: 1.2, shapes: ['star'] });
  setTimeout(() => confetti({ ...defaults, particleCount: 20, scalar: 0.8, shapes: ['circle'] }), 200);
}

export default fireConfetti;
