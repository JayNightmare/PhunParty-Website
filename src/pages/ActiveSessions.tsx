import { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Card from "@/components/Card";
import QR from "@/components/QR";
import {
    getGames,
    getSessionStatus,
    GameStatusResponse,
    GameResponse,
} from "@/lib/api";

export default function ActiveSessions() {
    const loc = useLocation();
    const nav = useNavigate();
    const params = new URLSearchParams(loc.search);
    const [games, setGames] = useState<GameResponse[]>([]);
    const [status, setStatus] = useState<GameStatusResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const focus = params.get("focus") || games[0]?.code;

    const loadGames = useCallback(async () => {
        try {
            setLoading(true);
            const list = await getGames();
            setGames(list);
            if (!params.get("focus") && list[0]) {
                nav(`/sessions?focus=${list[0].code}`, { replace: true });
            }
        } catch (err: any) {
            setError(err.message || "Failed to load games");
        } finally {
            setLoading(false);
        }
    }, [nav, loc.search]);

    const loadStatus = useCallback(async () => {
        if (!focus) return;
        try {
            const s = await getSessionStatus(focus);
            setStatus(s);
        } catch (err: any) {
            // Non-fatal; status maybe not yet available
        }
    }, [focus]);

    useEffect(() => {
        loadGames();
    }, [loadGames]);
    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    return (
        <main className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6">
            <section>
                <Card className="p-6 h-full">
                    <h2 className="text-xl font-semibold mb-4">
                        Active Game Sessions
                    </h2>
                    <div className="space-y-2 max-h-[70vh] overflow-auto pr-2">
                        {loading && (
                            <div className="text-stone-400">Loading…</div>
                        )}
                        {!loading && games.length === 0 && (
                            <div className="text-stone-400">
                                No sessions yet.{" "}
                                <Link className="underline" to="/new">
                                    Create one
                                </Link>
                                .
                            </div>
                        )}
                        {games.map((g) => (
                            <Link
                                key={g.code}
                                to={`/sessions?focus=${g.code}`}
                                className={`block px-3 py-2 rounded-xl ${
                                    g.code === focus
                                        ? "bg-ink-700"
                                        : "hover:bg-ink-700"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">
                                            {g.name}
                                        </div>
                                        <div className="text-xs text-stone-400">
                                            Status: {g.status}
                                        </div>
                                    </div>
                                    <div className="text-xs text-stone-400">
                                        Code: {g.code}
                                    </div>
                                </div>
                            </Link>
                        ))}
                        {error && (
                            <div className="text-red-500 text-sm">{error}</div>
                        )}
                    </div>
                </Card>
            </section>
            <section>
                {focus ? (
                    <Card className="p-6">
                        <div className="grid md:grid-cols-2 gap-4 items-start">
                            <div className="flex flex-col items-center gap-3">
                                <QR
                                    value={
                                        window.location.origin +
                                        window.location.pathname +
                                        `#/join/${focus}`
                                    }
                                />
                                <div className="text-xs text-stone-300">
                                    Scan or visit:{" "}
                                    <span className="underline">
                                        {window.location.origin +
                                            window.location.pathname +
                                            `#/join/${focus}`}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="font-semibold text-lg">
                                    {games.find((g) => g.code === focus)
                                        ?.name || focus}
                                </div>
                                <div className="text-sm text-stone-300 mb-3">
                                    State: {status?.game_state || "unknown"}
                                </div>
                                <div className="text-sm font-medium mb-1">
                                    Players
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {status?.players?.map((p) => (
                                        <span
                                            key={p.id}
                                            className="px-3 py-1 rounded-xl bg-ink-700 text-sm"
                                        >
                                            {p.name}
                                        </span>
                                    ))}
                                    {!status?.players?.length && (
                                        <div className="text-stone-400 text-sm">
                                            Waiting for players…
                                        </div>
                                    )}
                                </div>
                                <div className="mt-5 flex gap-2">
                                    {/* Start endpoint not defined in spec; leaving disabled */}
                                    <button
                                        disabled
                                        className="px-5 py-2 rounded-2xl bg-ink-800 text-stone-500 font-semibold"
                                        title="Start endpoint not implemented"
                                    >
                                        Start
                                    </button>
                                    <Link
                                        to={`/play/${focus}`}
                                        className="px-5 py-2 rounded-2xl bg-peach-500 text-ink-900 font-semibold"
                                    >
                                        Go to quiz
                                    </Link>
                                    <Link
                                        to={`/stats/${focus}`}
                                        className="px-5 py-2 rounded-2xl bg-ink-700"
                                    >
                                        View stats
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <Card className="p-6">No session focused.</Card>
                )}
            </section>
        </main>
    );
}
