import { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import Card from "@/components/Card";
import QR from "@/components/QR";
import LoadingButton from "@/components/LoadingButton";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import { ToastContainer } from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import useGameUpdates from "@/hooks/useGameUpdates";
import {
    getGames,
    getSessionStatus,
    startGame,
    GameStatusResponse,
    GameResponse,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function ActiveSessions() {
    const { user, isLoading: authLoading } = useAuth();
    const loc = useLocation();
    const nav = useNavigate();
    const params = new URLSearchParams(loc.search);
    const [games, setGames] = useState<GameResponse[]>([]);
    const [status, setStatus] = useState<GameStatusResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [startingGame, setStartingGame] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const focus = params.get("focus") || games[0]?.code;
    const { toasts, removeToast, success, error: toastError } = useToast();

    const loadGames = useCallback(async () => {
        try {
            setLoading(true);
            const list = await getGames();
            setGames(list);
            if (!params.get("focus") && list[0]) {
                nav(`/sessions?focus=${list[0].code}`, { replace: true });
            }
        } catch (err: any) {
            setError(err.message || "Failed to load sessions");
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

    // Use real-time updates for the focused session
    const {
        gameStatus: realTimeStatus,
        isConnected,
        isLoading: statusLoading,
    } = useGameUpdates({
        sessionCode: focus || "",
        pollInterval: 3000,
        enableWebSocket: true,
    });

    const handleStartGame = useCallback(async () => {
        if (!focus) return;

        try {
            setStartingGame(true);
            await startGame({ session_code: focus });
            success("Game started successfully!");

            // Real-time updates will automatically refresh the status            // Navigate to the active quiz page
            nav(`/play/${focus}`);
        } catch (err: any) {
            toastError(err.message || "Failed to start game");
        } finally {
            setStartingGame(false);
        }
    }, [focus, success, toastError, loadStatus, nav]);

    useEffect(() => {
        loadGames();
    }, [loadGames]);

    // Merge real-time status with local status if available
    const currentStatus = realTimeStatus || status;

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
        <>
            <ToastContainer toasts={toasts} onDismiss={removeToast} />
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
                                            {g.code}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {error && (
                                <div className="text-red-500 text-sm">
                                    {error}
                                </div>
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
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="text-sm text-stone-300">
                                            State:{" "}
                                            {currentStatus?.game_state ||
                                                "unknown"}
                                        </div>
                                        {!isConnected && (
                                            <ConnectionIndicator size="sm" />
                                        )}
                                    </div>
                                    <div className="text-sm font-medium mb-1">
                                        Players
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {currentStatus?.players?.map((p) => (
                                            <span
                                                key={p.id}
                                                className="px-3 py-1 rounded-xl bg-ink-700 text-sm"
                                            >
                                                {p.name}
                                                {p.answeredCurrent && (
                                                    <span className="ml-2 text-xs text-green-400">
                                                        ✓
                                                    </span>
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
                                            {
                                                currentStatus
                                                    .player_response_counts
                                                    .answered
                                            }{" "}
                                            of{" "}
                                            {
                                                currentStatus
                                                    .player_response_counts
                                                    .total
                                            }{" "}
                                            players answered
                                        </div>
                                    )}
                                    <div className="mt-5 flex gap-2">
                                        <LoadingButton
                                            onClick={handleStartGame}
                                            loading={startingGame}
                                            loadingText="Starting..."
                                            disabled={
                                                currentStatus?.game_state ===
                                                    "active" ||
                                                !currentStatus?.players?.length
                                            }
                                            variant="primary"
                                            title={
                                                currentStatus?.game_state ===
                                                "active"
                                                    ? "Game is already active"
                                                    : !currentStatus?.players
                                                          ?.length
                                                    ? "Need at least one player to start"
                                                    : "Start the game"
                                            }
                                        >
                                            {currentStatus?.game_state ===
                                            "active"
                                                ? "Game Active"
                                                : "Start Game"}
                                        </LoadingButton>
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
        </>
    );
}
