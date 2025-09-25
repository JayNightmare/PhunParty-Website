import { Link } from "react-router-dom";
import Card from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";

export default function Landing() {
    const { user, isLoading } = useAuth();

    return (
        <main className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-6 items-center">
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
                <p className="mt-4 text-stone-300">
                    Host trivia on desktop. Friends join on mobile with a link
                    or QR. Cozy vibes, zero setup.
                </p>
                <div className="mt-6 flex gap-3">
                    {user ? (
                        <>
                            <Link
                                to="/new"
                                className="px-5 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold"
                            >
                                Start a game
                            </Link>
                            <Link
                                to="/sessions"
                                className="px-5 py-3 rounded-2xl bg-ink-700"
                            >
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
                            <Link
                                to="/login"
                                className="px-5 py-3 rounded-2xl bg-ink-700"
                            >
                                Sign In
                            </Link>
                        </>
                    )}
                </div>
                {!isLoading && !user && (
                    <p className="mt-3 text-sm text-stone-400">
                        Create an account to start hosting games and track your
                        history.
                    </p>
                )}
            </section>
            <Card className="p-6">
                <ul className="space-y-3 text-stone-300">
                    <li>• Trivia game type</li>
                    <li>• Easy / Medium / Hard modes</li>
                    <li>• QR join links</li>
                    <li>• Live player status and timers</li>
                    <li>• Post‑game leaderboard & stats</li>
                </ul>
            </Card>
        </main>
    );
}
