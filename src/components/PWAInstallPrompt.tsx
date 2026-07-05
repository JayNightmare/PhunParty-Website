import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://");

    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);

      if (
        !isStandalone &&
        window.innerWidth <= 768 &&
        !sessionStorage.getItem("pwa-prompt-dismissed")
      ) {
        window.setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (isInstalled || !deferredPrompt || !showPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4 md:items-center">
      <div className="bg-ink-800 rounded-t-2xl md:rounded-2xl max-w-md w-full p-6 transform transition-transform duration-300 ease-out">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-tea-500 rounded-2xl flex items-center justify-center text-ink-900 text-xl font-bold">
            PP
          </div>
          <div>
            <h3 className="font-semibold text-lg">Install PhunParty</h3>
            <p className="text-stone-400 text-sm">
              Add the game companion to this device.
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-400">✓</span>
            <span>Quick access from your home screen</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-400">✓</span>
            <span>Cleaner full-screen game view</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-400">✓</span>
            <span>Stay signed in between game nights</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-400">✓</span>
            <span>Built for joining and answering on mobile</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-3 bg-ink-700 rounded-xl font-medium hover:bg-ink-600 transition-colors"
          >
            Not Now
          </button>
          <button
            onClick={handleInstallClick}
            className="flex-1 px-4 py-3 bg-tea-500 text-ink-900 rounded-xl font-medium hover:bg-tea-400 transition-colors"
          >
            Install
          </button>
        </div>

        {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
          <div className="mt-4 pt-4 border-t border-ink-600 text-xs text-stone-400">
            On iOS: tap Share, then Add to Home Screen.
          </div>
        )}
      </div>
    </div>
  );
}
