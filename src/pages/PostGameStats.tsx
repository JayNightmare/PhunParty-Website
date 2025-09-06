import { Link, useParams } from "react-router-dom";
import Card from "@/components/Card";
import { useEffect, useState } from "react";
import {
    getSessionStatus,
    getScores,
    GameStatusResponse,
    ScoresResponseModel,
} from "@/lib/api";

export default function PostGameStats() {
    const { sessionId } = useParams();
    const [status, setStatus] = useState<GameStatusResponse | null>(null);
    const [scores, setScores] = useState<ScoresResponseModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const run = async () => {
            if (!sessionId) return;
            try {
                setLoading(true);
                const [st, sc] = await Promise.all([
                    getSessionStatus(sessionId).catch(() => null),
                    getScores(sessionId).catch(() => []),
                ]);
                if (st) setStatus(st);
                if (sc) setScores(sc);
            } catch (err: any) {
                setError(err.message || "Failed to load stats");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [sessionId]);

    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    if (!sessionId) return <main className="p-8">Session not specified.</main>;

    return (
        <main className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6">
            <section>
                <Card className="p-6">
                    <div className="text-lg font-semibold">Winner</div>
                    {loading && (
                        <div className="text-stone-400 mt-2">Loading…</div>
                    )}
                    {!loading && winner ? (
                        <div className="mt-2 text-stone-300">
                            {winner.name} — {winner.score} pts
                        </div>
                    ) : null}
                    {!loading && !winner && (
                        <div className="text-stone-400">No players.</div>
                    )}
                    <div className="mt-6">
                        <div className="text-lg font-semibold mb-2">
                            Final Leaderboard
                        </div>
                        <ol className="space-y-2">
                            {sorted.map((p, i) => (
                                <li
                                    key={p.player_id}
                                    className="flex items-center justify-between px-3 py-2 bg-ink-700 rounded-xl"
                                >
                                    <div className="text-stone-300">
                                        #{i + 1} {p.name}
                                    </div>
                                    <div className="font-semibold">
                                        {p.score} pts
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </Card>
            </section>
            <section>
                <Card className="p-6">
                    <div className="text-lg font-semibold">Game Summary</div>
                    <div className="mt-2 text-sm text-stone-300">
                        State: {status?.game_state || "unknown"}
                    </div>
                    {error && (
                        <div className="mt-2 text-red-500 text-sm">{error}</div>
                    )}
                    <div className="mt-4 text-sm text-stone-400">
                        Score comparison (simple):
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {sorted.map((p) => (
                            <div
                                key={p.player_id}
                                className="bg-ink-700 rounded-xl p-3"
                            >
                                <div className="text-xs text-stone-400">
                                    {p.name}
                                </div>
                                <div className="text-2xl font-semibold">
                                    {p.score}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6">
                        <Link
                            to="/sessions"
                            className="px-5 py-2 rounded-2xl bg-tea-500 text-ink-900 font-semibold"
                        >
                            Back to sessions
                        </Link>
                    </div>
                </Card>
            </section>
        </main>
    );
}
