import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "studyfay-install-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

function isDismissed(): boolean {
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (!dismissed) return false;
  const timestamp = parseInt(dismissed, 10);
  if (Date.now() - timestamp > DISMISS_DURATION) {
    localStorage.removeItem(DISMISS_KEY);
    return false;
  }
  return true;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as Record<string, boolean>).standalone === true
  );
}

const InstallPWA = () => {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") {
      setVisible(false);
    }
    setPrompt(null);
  }, [prompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-3 mb-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20"
            onClick={handleInstall}
          >
            <Icon name="Download" className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0" onClick={handleInstall}>
            <p className="text-sm font-semibold text-white">
              Установить Studyfay
            </p>
            <p className="text-xs text-white/70 truncate">
              Быстрый доступ с домашнего экрана
            </p>
          </div>
          <button
            onClick={handleInstall}
            className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-purple-600 transition-transform active:scale-95"
          >
            Установить
          </button>
          <button
            onClick={handleDismiss}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Закрыть"
          >
            <Icon name="X" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPWA;