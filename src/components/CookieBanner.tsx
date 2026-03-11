import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const COOKIE_KEY = "cookie_consent_accepted";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Мы используем cookies для корректной работы сервиса.{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            Подробнее
          </Link>
        </p>
        <Button size="sm" onClick={handleAccept} className="self-end">
          Принять
        </Button>
      </div>
    </div>
  );
}
