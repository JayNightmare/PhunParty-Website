import { useNavigate } from "react-router-dom";
import Card from "@/components/Card";
import { createSession } from "@/lib/api";
import { useState } from "react";
import { Difficulty } from "@/types";

export default function NewSession() {
    const nav = useNavigate();
    const [name, setName] = useState("Saturday Hangout");
    const [num, setNum] = useState(5);
    const [difficulty, setDifficulty] = useState<Difficulty>("Easy");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const create = async () => {
        setLoading(true);
        setError(null);
        try {
            // Replace with actual game_code if needed
            const game_code = name.trim() || "PhunParty";
            const session = await createSession({ game_code });
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
                            Game Type
                        </label>
                        <div className="px-4 py-3 rounded-2xl bg-ink-700">
                            Trivia
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-stone-300 mb-1">
                            Number of Questions
                        </label>
                        <input
                            title="Number of Questions"
                            type="number"
                            min={1}
                            max={10}
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
                    <div>
                        <label className="block text-sm text-stone-300 mb-1">
                            Session Name
                        </label>
                        <input
                            aria-label="Session Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none"
                        />
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
