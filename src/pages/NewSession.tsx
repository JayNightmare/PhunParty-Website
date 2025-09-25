import { useNavigate } from "react-router-dom";
import Card from "@/components/Card";
import { createSession, getGames } from "@/lib/api";
import { useState, useEffect } from "react";
import { Difficulty } from "@/types";

export default function NewSession() {
    const nav = useNavigate();
    const [hostName, setHostName] = useState("Game Host");
    const [num, setNum] = useState(5);
    const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
    const [availableGames, setAvailableGames] = useState<any[]>([]);
    const [selectedGameCode, setSelectedGameCode] = useState("");

    const [loading, setLoading] = useState(false);
    const [loadingGames, setLoadingGames] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load available games on component mount
    useEffect(() => {
        const loadGames = async () => {
            try {
                setLoadingGames(true);
                const games = await getGames();
                setAvailableGames(games);
                if (games.length > 0) {
                    setSelectedGameCode(games[0].code);
                }
            } catch (err) {
                console.error("Failed to load available games:", err);
                // Set default fallback
                setAvailableGames([
                    {
                        code: "trivia-general",
                        name: "General Trivia",
                        genre: "General",
                    },
                ]);
                setSelectedGameCode("trivia-general");
            } finally {
                setLoadingGames(false);
            }
        };
        loadGames();
    }, []);

    const create = async () => {
        setLoading(true);
        setError(null);

        if (!hostName.trim()) {
            setError("Host name is required");
            setLoading(false);
            return;
        }

        if (!selectedGameCode) {
            setError("Please select a game type");
            setLoading(false);
            return;
        }

        try {
            const session = await createSession({
                host_name: hostName.trim(),
                number_of_questions: num,
                game_code: selectedGameCode,
            });
            nav(`/sessions?focus=${session.code}`);
        } catch (err: any) {
            setError(err.message || "Failed to create session");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="max-w-3xl mx-auto px-4 py-8">
            <Card className="p-6">
                <h2 className="text-2xl font-semibold">New Game Session</h2>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-sm text-stone-300 mb-1">
                            Host Name
                        </label>
                        <input
                            aria-label="Host Name"
                            value={hostName}
                            onChange={(e) => setHostName(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none"
                            placeholder="Enter your name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-stone-300 mb-1">
                            Number of Questions
                        </label>
                        <input
                            title="Number of Questions"
                            type="number"
                            min={1}
                            max={20}
                            value={num}
                            onChange={(e) => {
                                const n = Number(e.target.value);
                                setNum(Number.isFinite(n) ? n : 1);
                            }}
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-stone-300 mb-1">
                            Game Type
                        </label>
                        {loadingGames ? (
                            <div className="px-4 py-3 rounded-2xl bg-ink-700 text-stone-400">
                                Loading games...
                            </div>
                        ) : (
                            <select
                                aria-label="Game Type"
                                value={selectedGameCode}
                                onChange={(e) =>
                                    setSelectedGameCode(e.target.value)
                                }
                                className="w-full px-4 py-3 rounded-2xl bg-ink-700"
                            >
                                {availableGames.map((game) => (
                                    <option key={game.code} value={game.code}>
                                        {game.name || game.genre || game.code}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm text-stone-300 mb-1">
                            Difficulty
                        </label>
                        <select
                            aria-label="Difficulty"
                            value={difficulty}
                            onChange={(e) =>
                                setDifficulty(e.target.value as Difficulty)
                            }
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700"
                        >
                            <option>Easy</option>
                            <option>Medium</option>
                            <option>Hard</option>
                        </select>
                        <p className="text-xs text-stone-400 mt-2">
                            Easy: no timer, MCQ • Medium: 30s timer, MCQ • Hard:
                            20s timer, free‑text
                        </p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={create}
                        className="px-6 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold"
                        disabled={loading}
                    >
                        {loading ? "Creating..." : "Create"}
                    </button>
                </div>
                {error && (
                    <div className="mt-4 text-red-500 text-sm">{error}</div>
                )}
            </Card>
        </main>
    );
}
