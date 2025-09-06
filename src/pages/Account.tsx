import Card from "@/components/Card";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getGames, GameResponse } from "@/lib/api";

export default function Account() {
    const [games, setGames] = useState<GameResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true);
                const list = await getGames();
                setGames(list);
            } catch (err: any) {
                setError(err.message || "Failed to load games");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, []);
    return (
        <main className="max-w-4xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6">
            <Card className="p-6">
                <div className="text-lg font-semibold">Account</div>
                <div className="mt-2 text-stone-300">
                    Local profile only for now.
                </div>
                <div className="mt-4 text-sm text-stone-400">
                    Create and join games on this device. Multi‑host accounts
                    can be added later.
                </div>
            </Card>
            <Card className="p-6">
                <div className="text-lg font-semibold">Game History</div>
                <div className="mt-2 space-y-2 max-h-[60vh] overflow-auto pr-2">
                    {loading && (
                        <div className="text-stone-400 text-sm">Loading…</div>
                    )}
                    {error && (
                        <div className="text-red-500 text-sm">{error}</div>
                    )}
                    {!loading &&
                        games.map((g) => (
                            <Link
                                to={`/stats/${g.code}`}
                                key={g.code}
                                className="block px-3 py-2 bg-ink-700 rounded-xl"
                            >
                                <div className="font-medium">{g.name}</div>
                                <div className="text-xs text-stone-400">
                                    Status: {g.status}
                                </div>
                            </Link>
                        ))}
                    {!loading && games.length === 0 && !error && (
                        <div className="text-stone-400 text-sm">
                            No games yet.
                        </div>
                    )}
                </div>
            </Card>
        </main>
    );
}
