import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import Card from "@/components/Card";
import QR from "@/components/QR";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import useGameUpdates from "@/hooks/useGameUpdates";
import {
  getOwnedUserSessions,
  getSessionStatus,
  GameStatusResponse,
  GameResponse,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function ActiveSessions() {
  const { user, isLoading: authLoading } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const params = new URLSearchParams(loc.search);
  const focusedSessionCode = params.get("focus");
  const [sessions, setSessions] = useState<GameResponse[]>([]);
  const [status, setStatus] = useState<GameStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focus = focusedSessionCode || sessions[0]?.code;
  const focusedSession = focus
    ? sessions.find((session) => session.code === focus)
    : undefined;
  const canViewFocusedSession = Boolean(focusedSession);
  const focusedSessionCodeForDisplay = focusedSession?.code || "";

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;

    const loadSessions = async () => {
      setError(null);

      try {
        setLoading(true);
        setSessionsLoaded(false);
        const list = await getOwnedUserSessions();

        if (cancelled) return;

        setSessions(list);
        if (!focusedSessionCode && list[0]) {
          nav(`/sessions?focus=${list[0].code}`, { replace: true });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load sessions");
        }
      } finally {
        if (!cancelled) {
          setSessionsLoaded(true);
          setLoading(false);
        }
      }
    };

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, focusedSessionCode, nav]);

  useEffect(() => {
    if (!focus || !canViewFocusedSession) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    const loadFocusedStatus = async () => {
      try {
        const stat = await getSessionStatus(focus);
        if (!cancelled) {
          setStatus(stat);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load session status");
        }
      }
    };

    void loadFocusedStatus();

    return () => {
      cancelled = true;
    };
  }, [focus, canViewFocusedSession]);

  // Use real-time updates for the focused session
  const { game_status: realTimeStatus, isConnected } = useGameUpdates({
    sessionCode: canViewFocusedSession ? focusedSessionCodeForDisplay : "",
    pollInterval: 3000,
    enableWebSocket: Boolean(user && canViewFocusedSession),
  });

  // Merge real-time status with local status if available
  const currentStatus = realTimeStatus || status;
  const currentGameState = currentStatus?.game_state as string | undefined;
  const currentDisplayStatus =
    currentGameState === "ended" || currentGameState === "finished"
      ? "finished"
      : "in progress";

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-center text-stone-400">Loading...</div>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6">
      <section>
        <Card className="p-6 h-full">
          <h2 className="text-xl font-semibold mb-4">Active Game Sessions</h2>
          <div className="space-y-2 max-h-[70vh] overflow-auto pr-2">
            {loading && <div className="text-stone-400">Loading…</div>}
            {!loading && sessions.length === 0 && (
              <div className="text-stone-400">
                No sessions yet.{" "}
                <Link className="underline" to="/new">
                  Create one
                </Link>
                .
              </div>
            )}
            {sessions.map((session) => (
              <Link
                key={session.code}
                to={`/sessions?focus=${session.code}`}
                className={`block px-3 py-2 rounded-xl ${
                  session.code === focus ? "bg-ink-700" : "hover:bg-ink-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{session.name}</div>
                    <div className="text-xs text-stone-400">
                      Status: {session.status}
                    </div>
                  </div>
                  <div className="text-xs text-stone-400">{session.code}</div>
                </div>
              </Link>
            ))}
            {error && <div className="text-red-500 text-sm">{error}</div>}
          </div>
        </Card>
      </section>
      <section>
        {canViewFocusedSession ? (
          <Card className="p-6">
            <div className="grid md:grid-cols-2 gap-4 items-start">
              <div className="flex flex-col items-center gap-3">
                <QR
                  value={`https://phun.party/#/join/${focusedSessionCodeForDisplay}`}
                />
                <div className="text-xs text-stone-300">
                  Scan or visit:{" "}
                  <span className="underline">
                    https://phun.party/#/join/{focusedSessionCodeForDisplay}
                  </span>
                </div>
              </div>
              <div>
                <div className="font-semibold text-lg">
                  {focusedSession?.name || focusedSessionCodeForDisplay}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-sm text-stone-300">
                    Game status: {currentDisplayStatus}
                  </div>
                  {!isConnected && <ConnectionIndicator size="sm" />}
                </div>
                <div className="text-sm font-medium mb-1">Players</div>
                <div className="flex flex-wrap gap-2">
                  {currentStatus?.players?.map((p) => (
                    <span
                      key={p.id}
                      className="px-3 py-1 rounded-xl bg-ink-700 text-sm"
                    >
                      {p.name}
                      {p.answeredCurrent && (
                        <span className="ml-2 text-xs text-green-400">✓</span>
                      )}
                    </span>
                  ))}
                  {!currentStatus?.players?.length && (
                    <div className="text-stone-400 text-sm">
                      Waiting for players…
                    </div>
                  )}
                </div>
                {currentStatus?.player_response_counts && (
                  <div className="mt-2 text-xs text-stone-400">
                    {currentStatus.player_response_counts.answered} of{" "}
                    {currentStatus.player_response_counts.total} players
                    answered
                  </div>
                )}
                <div className="mt-5 flex gap-2">
                  <Link
                    to={
                      currentStatus?.game_state === "active"
                        ? `/play/${focusedSessionCodeForDisplay}`
                        : `/session/${focusedSessionCodeForDisplay}/waiting`
                    }
                    className="px-5 py-2 rounded-2xl bg-peach-500 text-ink-900 font-semibold"
                  >
                    Go to quiz
                  </Link>
                  <Link
                    to={`/stats/${focusedSessionCodeForDisplay}`}
                    className="px-5 py-2 rounded-2xl bg-ink-700"
                  >
                    View stats
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            {!sessionsLoaded
              ? "Loading..."
              : focus
                ? "You do not have access to this session."
                : "No session focused."}
          </Card>
        )}
      </section>
    </main>
  );
}
