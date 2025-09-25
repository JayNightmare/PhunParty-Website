import React, { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallPromptProps {
    className?: string;
}

export default function PWAInstallPrompt({
    className = "",
}: PWAInstallPromptProps) {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Check if already installed
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone ||
            document.referrer.includes("android-app://");

        setIsInstalled(isStandalone);

        // Listen for the beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            console.log("[PWA] Install prompt available");
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsInstallable(true);

            // Show prompt after a delay if not installed and on mobile
            if (!isStandalone && window.innerWidth <= 768) {
                setTimeout(() => setShowPrompt(true), 3000);
            }
        };

        // Listen for app installed
        const handleAppInstalled = () => {
            console.log("[PWA] App installed");
            setIsInstalled(true);
            setIsInstallable(false);
            setShowPrompt(false);
            setDeferredPrompt(null);
        };

        window.addEventListener(
            "beforeinstallprompt",
            handleBeforeInstallPrompt
        );
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

        try {
            // Show the install prompt
            await deferredPrompt.prompt();

            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === "accepted") {
                console.log("[PWA] User accepted the install prompt");
            } else {
                console.log("[PWA] User dismissed the install prompt");
            }

            // Clear the deferredPrompt
            setDeferredPrompt(null);
            setIsInstallable(false);
            setShowPrompt(false);
        } catch (error) {
            console.error("[PWA] Install prompt error:", error);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        // Don't show again for this session
        sessionStorage.setItem("pwa-prompt-dismissed", "true");
    };

    // Don't show if already installed or not installable or user dismissed
    if (
        isInstalled ||
        !isInstallable ||
        sessionStorage.getItem("pwa-prompt-dismissed")
    ) {
        return null;
    }

    return (
        <>
            {/* Install Button for header/menu */}
            {isInstallable && !showPrompt && (
                <button
                    onClick={handleInstallClick}
                    className={`flex items-center gap-2 px-3 py-2 bg-tea-500 text-ink-900 rounded-lg font-medium text-sm hover:bg-tea-400 transition-colors ${className}`}
                >
                    <span>📱</span>
                    <span className="hidden sm:inline">Install App</span>
                    <span className="sm:hidden">Install</span>
                </button>
            )}

            {/* Full Prompt Modal */}
            {showPrompt && (
                <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4 md:items-center">
                    <div className="bg-ink-800 rounded-t-2xl md:rounded-2xl max-w-md w-full p-6 transform transition-transform duration-300 ease-out">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-tea-500 rounded-2xl flex items-center justify-center text-2xl">
                                🎉
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">
                                    Install PhunParty
                                </h3>
                                <p className="text-stone-400 text-sm">
                                    Get the full app experience
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-green-400">✓</span>
                                <span>Works offline</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-green-400">✓</span>
                                <span>Faster loading</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-green-400">✓</span>
                                <span>Full screen experience</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="text-green-400">✓</span>
                                <span>Home screen access</span>
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

                        {/* iOS Instructions */}
                        {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
                            <div className="mt-4 pt-4 border-t border-ink-600 text-xs text-stone-400">
                                <p className="mb-2">
                                    On iOS: Tap Share → Add to Home Screen
                                </p>
                                <div className="flex items-center gap-2">
                                    <span>📤</span>
                                    <span>→</span>
                                    <span>➕</span>
                                    <span>Add to Home Screen</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
