import { Link, useParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { Session, Question, MCQOption, Player } from "@/types";
import Card from "@/components/Card";
import { getSessionStatus, GameStatusResponse } from "@/lib/api";
import Timer from "@/components/Timer";

export default function ActiveQuiz() {
    const { sessionId } = useParams();
    const [gameStatus, setGameStatus] = useState<GameStatusResponse | null>(
        null
    );
    const [question, setQuestion] = useState<Question | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);

    // Fetch session status and current question
    const fetchSession = async () => {
        if (!sessionId) return;
        try {
            setLoading(true);
            const status = await getSessionStatus(sessionId);
            setGameStatus(status);

            // Extract current question from the status
            if (status.current_question) {
                const currentQ = status.current_question;
                setQuestion({
                    id: currentQ.id || `q_${status.current_question_index}`,
                    type: "mcq", // Default to MCQ for now
                    prompt: currentQ.prompt || "",
                    options: (currentQ.options || []).map((option, index) => ({
                        id: `option_${index}`,
                        text: String(option),
                    })),
                    answer: currentQ.answer || "",
                });
            } else {
                setQuestion(null);
            }

            // Extract players from the status
            if (status.players) {
                const playerList: Player[] = [];
                if (Array.isArray(status.players)) {
                    status.players.forEach((player: any) => {
                        playerList.push({
                            id: player.player_id || player.id,
                            name: player.player_name || player.name,
                            email: player.player_email || player.email,
                            answeredCurrent: player.answered_current || false,
                            score: player.score || 0,
                        });
                    });
                } else if (typeof status.players === "object") {
                    // Handle object format: {total: number, list: array}
                    const playersObj = status.players as any;
                    if (playersObj.list && Array.isArray(playersObj.list)) {
                        playersObj.list.forEach((player: any) => {
                            playerList.push({
                                id: player.player_id || player.id,
                                name: player.player_name || player.name,
                                email: player.player_email || player.email,
                                answeredCurrent:
                                    player.answered_current || false,
                                score: player.score || 0,
                            });
                        });
                    }
                }
                setPlayers(playerList);
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch session");
        } finally {
            setLoading(false);
        }
    };

    // Next question
    const next = async () => {
        await fetchSession();
    };

    // Auto-refresh session status
    useEffect(() => {
        fetchSession();
        const interval = setInterval(fetchSession, 3000); // Refresh every 3 seconds
        return () => clearInterval(interval);
    }, [sessionId]);

    if (!gameStatus)
        return <main className="p-8">Session not found or loading…</main>;

    const keyer = `${sessionId}-${question?.id}`;

    return (
        <main className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6 items-start">
            <section>
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">
                            Question {gameStatus.current_question_index + 1} /{" "}
                            {gameStatus.total_questions}
                        </h2>
                        <Timer
                            ms={30000} // Default 30 seconds, could be dynamic
                            keyer={keyer}
                            onEnd={next}
                        />
                    </div>
                    <div className="mt-4 text-lg">{question?.prompt}</div>
                    {question?.type === "mcq" && (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            {question.options?.map((o: MCQOption) => (
                                <div
                                    key={o.id}
                                    className="px-4 py-3 bg-ink-700 rounded-2xl"
                                >
                                    {o.text}
                                </div>
                            ))}
                        </div>
                    )}
                    {question?.type === "free" && (
                        <div className="mt-4 text-sm text-stone-300">
                            Players answer with free text on their phones.
                        </div>
                    )}
                    <div className="mt-6 flex gap-2">
                        <button
                            onClick={next}
                            className="px-5 py-2 rounded-2xl bg-peach-500 text-ink-900 font-semibold"
                            disabled={loading}
                        >
                            Next
                        </button>
                        <Link
                            to={`/stats/${sessionId}`}
                            className="px-5 py-2 rounded-2xl bg-ink-700"
                        >
                            End & Stats
                        </Link>
                    </div>
                    {error && (
                        <div className="mt-4 text-red-500 text-sm">{error}</div>
                    )}
                </Card>
            </section>
            <section>
                <Card className="p-6">
                    <div className="text-lg font-semibold mb-2">
                        Player Status
                    </div>
                    <div className="space-y-2">
                        {players.map((p: Player) => (
                            <div
                                key={p.id}
                                className="flex items-center justify-between px-3 py-2 bg-ink-700 rounded-xl"
                            >
                                <div className="font-medium">{p.name}</div>
                                <div className="text-sm text-stone-300">
                                    {p.answeredCurrent
                                        ? "Answered"
                                        : "Thinking…"}
                                </div>
                                <div className="text-sm font-semibold">
                                    {p.score || 0} pts
                                </div>
                            </div>
                        ))}
                        {players.length === 0 && (
                            <div className="text-stone-400 text-sm">
                                No players joined yet.
                            </div>
                        )}
                    </div>
                </Card>
            </section>
        </main>
    );
}
