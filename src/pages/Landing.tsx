import QRCode from "react-qr-code";
import { Link } from "react-router-dom";
import Card from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";

const APP_INSTALL_URL =
  import.meta.env.VITE_APP_INSTALL_URL || "https://phun.party/#/app";
const IOS_STORE_URL = import.meta.env.VITE_IOS_APP_STORE_URL || "";
const ANDROID_STORE_URL = import.meta.env.VITE_ANDROID_APP_STORE_URL || "";

export default function Landing() {
  const { user, isLoading } = useAuth();

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
      <section>
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
          Kahoot meets Jackbox.
          <br />
          Welcome to <span className="text-peach-400">PhunParty</span>
          {user && (
            <span className="text-tea-400">
              , {user.name.split(" ")[0]}!
            </span>
          )}
        </h1>
        <p className="mt-4 max-w-xl text-stone-300">
          Host party games on the big screen while everyone joins from their
          phone. Create a room, share the QR code, and play together in seconds.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {user ? (
            <>
              <Link
                to="/new"
                className="px-5 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold"
              >
                Start a game
              </Link>
              <Link to="/sessions" className="px-5 py-3 rounded-2xl bg-ink-700">
                Active sessions
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/register"
                className="px-5 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold"
              >
                Get Started
              </Link>
              <Link to="/login" className="px-5 py-3 rounded-2xl bg-ink-700">
                Sign In
              </Link>
            </>
          )}
        </div>

        {!isLoading && !user && (
          <p className="mt-3 text-sm text-stone-400">
            Create an account to host games, save history, and track stats.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-[auto_1fr] lg:grid-cols-1">
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row lg:flex-col gap-5">
            <div className="rounded-2xl bg-white p-3 w-fit mx-auto sm:mx-0">
              <QRCode value={APP_INSTALL_URL} size={156} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Get the mobile app</h2>
              <p className="mt-2 text-sm text-stone-300">
                Scan to open PhunParty if it is installed, or continue to the
                app store options for this device.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <a
                  href={IOS_STORE_URL || APP_INSTALL_URL}
                  className="rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 hover:bg-ink-700 transition"
                >
                  <span className="block text-xs text-stone-400">
                    Download on the
                  </span>
                  <span className="block font-semibold">App Store</span>
                </a>
                <a
                  href={ANDROID_STORE_URL || APP_INSTALL_URL}
                  className="rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 hover:bg-ink-700 transition"
                >
                  <span className="block text-xs text-stone-400">Get it on</span>
                  <span className="block font-semibold">Google Play</span>
                </a>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <ul className="space-y-3 text-stone-300">
            <li>Trivia, Beat the Clock, and buzzer-style games</li>
            <li>QR join links for fast room entry</li>
            <li>Live player status and host timers</li>
            <li>Post-game leaderboard and stats</li>
          </ul>
        </Card>
      </section>
    </main>
  );
}
