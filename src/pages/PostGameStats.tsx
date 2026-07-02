import { Link, Navigate, useParams } from "react-router-dom";
import Card from "@/components/Card";
import { useEffect, useState } from "react";
import {
  getSessionStatus,
  getScores,
  GameStatusResponse,
  ScoresResponseModel,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type ScoreWithPlayer = ScoresResponseModel & {
  name: string;
};

function extractApiMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "");

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === "string") return parsed.detail;
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    // Fall back to the raw message.
  }

  return raw || "Unable to load stats";
}

function isAccessError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not authenticated") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("permission") ||
    normalized.includes("401") ||
    normalized.includes("403")
  );
}

export default function PostGameStats() {
  const { sessionId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<GameStatusResponse | null>(null);
  const [scores, setScores] = useState<ScoreWithPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !sessionId) return;

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setAccessDenied(false);
        setStatus(null);
        setScores([]);

        const [statusResult, scoresResult] = await Promise.allSettled([
          getSessionStatus(sessionId),
          getScores(sessionId),
        ]);

        if (cancelled) return;

        if (statusResult.status === "fulfilled") {
          setStatus(statusResult.value);
        }

        if (scoresResult.status === "rejected") {
          const message = extractApiMessage(scoresResult.reason);
          if (isAccessError(message)) {
            setAccessDenied(true);
            setError(
              "You do not have access to this session's stats. Check you are logged into the account that hosted or played this session.",
            );
          } else {
            setError(message || "Failed to load stats");
          }
          return;
        }

        const scoresWithNames: ScoreWithPlayer[] = scoresResult.value.map(
          (score) => ({
            ...score,
            name: score.display_name || "Player",
          }),
        );
        setScores(scoresWithNames);

        if (scoresWithNames.length === 0) {
          setError("No scores are available for this session yet.");
        }

        if (statusResult.status === "rejected" && scoresWithNames.length === 0) {
          const message = extractApiMessage(statusResult.reason);
          setError(message || "Failed to load session status");
        }
      } catch (err: any) {
        if (!cancelled) {
          const message = extractApiMessage(err);
          setAccessDenied(isAccessError(message));
          setError(message || "Failed to load stats");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, sessionId]);

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const statusState = status?.game_state as string | undefined;
  const displayStatus =
    statusState === "ended" || statusState === "finished"
      ? "finished"
      : "in progress";

  if (!sessionId) return <main className="p-8">Session not specified.</main>;

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (authLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-stone-400">Loading...</div>
        </Card>
      </main>
    );
  }

  if (!loading && (accessDenied || (error && scores.length === 0))) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-lg font-semibold">Stats unavailable</div>
          <div className="mt-2 text-sm text-stone-300">
            {error || "You do not have access to this session's stats."}
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
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6">
      <section>
        <Card className="p-6">
          <div className="text-lg font-semibold">
            {winner?.result === "win"
              ? "Winner"
              : `Result - ${
                  winner?.result
                    ? winner.result.charAt(0).toUpperCase() +
                      winner.result.slice(1)
                    : "Unknown"
                }`}
          </div>
          {loading && <div className="text-stone-400 mt-2">Loading…</div>}
          {!loading && winner?.result === "win" ? (
            <div className="mt-2 text-stone-300">
              {winner.name} — {winner.score} pts
            </div>
          ) : null}
          {!loading && !winner && (
            <div className="text-stone-400">No players.</div>
          )}
          <div className="mt-6">
            <div className="text-lg font-semibold mb-2">Final Leaderboard</div>
            <ol className="space-y-2">
              {sorted.map((p, i) => (
                <li
                  key={p.score_id || `${p.session_code}-${i}`}
                  className="flex items-center justify-between px-3 py-2 bg-ink-700 rounded-xl"
                >
                  <div className="text-stone-300">
                    #{i + 1} {p.name}
                  </div>
                  <div className="font-semibold">{p.score} pts</div>
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
            Game status: {displayStatus}
          </div>
          {error && <div className="mt-2 text-red-500 text-sm">{error}</div>}
          <div className="mt-4 text-sm text-stone-400">
            Score comparison (simple):
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {sorted.map((p) => (
              <div
                key={p.score_id || `${p.session_code}-${p.display_name}`}
                className="bg-ink-700 rounded-xl p-3"
              >
                <div className="text-xs text-stone-400">{p.name}</div>
                <div className="text-2xl font-semibold">{p.score}</div>
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
