import { useEffect } from "react";
import Card from "@/components/Card";

const APP_SCHEME_URL =
  import.meta.env.VITE_APP_SCHEME_URL || "phunpartymobileapp://";
const IOS_STORE_URL = import.meta.env.VITE_IOS_APP_STORE_URL || "";
const ANDROID_STORE_URL = import.meta.env.VITE_ANDROID_APP_STORE_URL || "";

function platformStoreUrl() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return IOS_STORE_URL;
  if (/android/.test(userAgent)) return ANDROID_STORE_URL;
  return "";
}

export default function AppDownload() {
  useEffect(() => {
    const targetStoreUrl = platformStoreUrl();

    window.location.href = APP_SCHEME_URL;

    if (targetStoreUrl) {
      const timer = window.setTimeout(() => {
        window.location.href = targetStoreUrl;
      }, 1400);

      return () => window.clearTimeout(timer);
    }
  }, []);

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <Card className="p-6 text-center">
        <h1 className="text-2xl font-semibold">Open PhunParty</h1>
        <p className="text-stone-300 mt-3">
          If the app is installed, it should open automatically. If not, use the
          store buttons below.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href={IOS_STORE_URL || "#"}
            aria-disabled={!IOS_STORE_URL}
            className={`rounded-2xl border border-ink-600 bg-ink-800 px-4 py-3 text-left transition ${
              IOS_STORE_URL
                ? "hover:bg-ink-700"
                : "cursor-not-allowed opacity-60"
            }`}
          >
            <span className="block text-xs text-stone-400">
              Download on the
            </span>
            <span className="block text-lg font-semibold">App Store</span>
          </a>

          <a
            href={ANDROID_STORE_URL || "#"}
            aria-disabled={!ANDROID_STORE_URL}
            className={`rounded-2xl border border-ink-600 bg-ink-800 px-4 py-3 text-left transition ${
              ANDROID_STORE_URL
                ? "hover:bg-ink-700"
                : "cursor-not-allowed opacity-60"
            }`}
          >
            <span className="block text-xs text-stone-400">Get it on</span>
            <span className="block text-lg font-semibold">Google Play</span>
          </a>
        </div>

        {(!IOS_STORE_URL || !ANDROID_STORE_URL) && (
          <p className="mt-4 text-xs text-stone-500">
            Store links can be configured with VITE_IOS_APP_STORE_URL and
            VITE_ANDROID_APP_STORE_URL.
          </p>
        )}
      </Card>
    </main>
  );
}
