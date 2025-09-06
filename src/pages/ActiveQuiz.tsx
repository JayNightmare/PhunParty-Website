import { Link, useParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { Session, Question, MCQOption, Player } from "@/types";
import Card from "@/components/Card";
import { getSessionStatus } from "@/lib/api";
import Timer from "@/components/Timer";

export default function ActiveQuiz() {
    const { sessionId } = useParams();
    const [session, setSession] = useState<Session | null>(null);
    const [question, setQuestion] = useState<Question | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch session status and current question
    const fetchSession = async () => {
        if (!sessionId) return;
        try {
            setLoading(true);
            const status = await getSessionStatus(sessionId);
            setSession(status as any); // TODO: type mapping
            setQuestion(status.current_question as any);
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

    // Initial fetch
    useMemo(() => {
        fetchSession();
        // eslint-disable-next-line
    }, [sessionId]);

    if (!session)
        return <main className="p-8">Session not found or loading…</main>;
    const keyer = `${sessionId}-${question?.id}`;

    return (
        <main className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6 items-start">
            <section>
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">
                            Question {/* TODO: add current index from backend */} / {/* TODO: add total from backend */}
                        </h2>
                        <Timer
                            ms={session.timerMs}
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
                        {session.players?.map((p: Player) => (
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
                                    {p.score} pts
                                </div>
                            </div>
                        ))}
                        {session.players?.length === 0 && (
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
