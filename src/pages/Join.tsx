import { useMemo, useState } from "react";
import { Session, MCQOption, Player, Question } from "@/types";
import { useParams } from "react-router-dom";
import Card from "@/components/Card";
import { joinGameSession, submitAnswer, getSessionStatus, getCurrentQuestion } from "@/lib/api";

export default function Join() {
    const { sessionId } = useParams();
    const [name, setName] = useState("");
    const [myId, setMyId] = useState<string | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [question, setQuestion] = useState<Question | null>(null);
    const [val, setVal] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch session status and current question
    const fetchSession = async () => {
        if (!sessionId) return;
        try {
            const status = await getSessionStatus(sessionId);
            setSession(status as any); // TODO: type mapping
            setQuestion(status.current_question as any);
        } catch (err: any) {
            setError(err.message || "Failed to fetch session");
        }
    };

    // Join session
    const join = async () => {
        if (!sessionId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await joinGameSession({
                player_id: name.trim() || "Player",
                session_code: sessionId,
            });
            setMyId(res.player_id || res.id || null);
            await fetchSession();
        } catch (err: any) {
            setError(err.message || "Failed to join session");
        } finally {
            setLoading(false);
        }
    };

    // Submit answer
    const submit = async (v: string) => {
        if (!sessionId || !question || !myId) return;
        setLoading(true);
        setError(null);
        try {
            await submitAnswer({
                player_id: myId,
                session_code: sessionId,
                question_id: question.id,
                answer: v,
            });
            setVal("");
            await fetchSession();
        } catch (err: any) {
            setError(err.message || "Failed to submit answer");
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch
    useMemo(() => {
        fetchSession();
        // eslint-disable-next-line
    }, [sessionId]);

    if (!session)
        return <main className="p-8">Session not found or loading…</main>;

    return (
        <main className="max-w-md mx-auto px-4 py-8">
            <Card className="p-6">
                {!myId ? (
                    <div>
                        <div className="text-lg font-semibold">
                            Join {session.name}
                        </div>
                        <div className="text-sm text-stone-400">ID: {sessionId}</div>
                        <div className="mt-4">
                            <label className="block text-sm text-stone-300 mb-1">
                                Your name
                            </label>
                            <input
                                aria-label="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none"
                            />
                        </div>
                        <div className="mt-4">
                            <button
                                onClick={join}
                                className="px-5 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold w-full"
                                disabled={loading}
                            >
                                {loading ? "Joining…" : "Join Game"}
                            </button>
                        </div>
                        {error && (
                            <div className="mt-4 text-red-500 text-sm">{error}</div>
                        )}
                    </div>
                ) : (
                    <div>
                        <div className="text-lg font-semibold">
                            {question ? "Answer" : "Waiting for next question…"}
                        </div>
                        {question?.type === "mcq" && (
                            <div className="mt-4 grid grid-cols-1 gap-2">
                                {question.options?.map((o: MCQOption) => (
                                    <button
                                        key={o.id}
                                        onClick={() => submit(o.text)}
                                        disabled={loading}
                                        className="px-4 py-3 rounded-2xl bg-ink-700 disabled:opacity-50"
                                    >
                                        {o.text}
                                    </button>
                                ))}
                            </div>
                        )}
                        {question?.type === "free" && (
                            <div className="mt-4">
                                <input
                                    value={val}
                                    onChange={(e) => setVal(e.target.value)}
                                    placeholder="Type your answer"
                                    className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none"
                                />
                                <button
                                    onClick={() => submit(val)}
                                    disabled={!val.trim() || loading}
                                    className="mt-3 px-4 py-2 rounded-2xl bg-tea-500 text-ink-900 font-semibold w-full"
                                >
                                    {loading ? "Submitting…" : "Submit"}
                                </button>
                            </div>
                        )}
                        {error && (
                            <div className="mt-4 text-red-500 text-sm">{error}</div>
                        )}
                    </div>
                )}
            </Card>
        </main>
    );
}
