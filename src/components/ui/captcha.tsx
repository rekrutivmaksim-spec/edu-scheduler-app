import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface CaptchaProps {
  onVerify: (isValid: boolean) => void;
  className?: string;
}

export default function Captcha({ onVerify, className = '' }: CaptchaProps) {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState(0);

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    setNum1(n1);
    setNum2(n2);
    setCorrectAnswer(n1 + n2);
    setUserAnswer('');
    onVerify(false);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  useEffect(() => {
    if (userAnswer) {
      const isCorrect = parseInt(userAnswer) === correctAnswer;
      onVerify(isCorrect);
    } else {
      onVerify(false);
    }
  }, [userAnswer, correctAnswer, onVerify]);

  return (
    <div className={className}>
      <Label htmlFor="captcha">
        Проверка: сколько будет {num1} + {num2}?
      </Label>
      <div className="flex gap-2">
        <Input
          id="captcha"
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Введите ответ"
          className="flex-1"
          required
        />
        <button
          type="button"
          onClick={generateCaptcha}
          className="px-3 text-sm text-muted-foreground hover:text-foreground"
          title="Обновить"
        >
          🔄
        </button>
      </div>
    </div>
  );
}
