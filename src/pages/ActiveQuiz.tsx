import { Link, useParams, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import { Session, Question, MCQOption, Player } from "@/types";
import Card from "@/components/Card";
import {
    getSessionStatus,
    GameStatusResponse,
    getCurrentQuestion,
    pauseGame,
    resumeGame,
    nextQuestion,
    previousQuestion,
    endGame,
} from "@/lib/api";
import Timer from "@/components/Timer";
import useGameUpdates from "@/hooks/useGameUpdates";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import { LoadingState } from "@/components/Loading";
import GameControls from "@/components/GameControls";
import GameStateIndicator from "@/components/GameStateIndicator";
import { useToast } from "@/hooks/useToast";
import { useTouchGestures } from "@/hooks/useTouchGestures";
import { useWebSocketGameControls } from "@/hooks/useWebSocketGameControls";
import WebSocketStatus from "@/components/WebSocketStatus";
import WebSocketDiagnostics from "@/components/WebSocketDiagnostics";

export default function ActiveQuiz() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [question, setQuestion] = useState<Question | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [gameState, setGameState] = useState<
        "waiting" | "active" | "paused" | "ended"
    >("waiting");
    const { success, error: showError } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Use the new real-time game updates hook
    const {
        gameStatus,
        isConnected,
        isLoading: loading,
        error,
        lastUpdate,
        refetch,
        connectedPlayers,
        sendMessage,
        startGame,
        nextQuestion: wsNextQuestion,
        endGame: wsEndGame,
        submitAnswer,
        pressBuzzer,
    } = useGameUpdates({
        sessionCode: sessionId || "",
        enableWebSocket: true,
        pollInterval: 3000, // Fallback polling
    });

    // WebSocket game controls for real-time game management
    const wsGameControls = useWebSocketGameControls({
        sendMessage: sendMessage || (() => {}),
        isConnected: isConnected,
    });

    // Touch gestures for swipe navigation and pull-to-refresh
    const {
        attachGestures,
        isRefreshing: gestureRefreshing,
        pullDistance,
    } = useTouchGestures({
        onSwipeLeft: async () => {
            if (
                gameStatus &&
                sessionId &&
                typeof gameStatus.current_question_index === "number" &&
                gameStatus.current_question_index <
                    (gameStatus.total_questions || 1) - 1
            ) {
                try {
                    await nextQuestion({ session_code: sessionId });
                    success("Moved to next question");
                } catch (err) {
                    showError("Failed to move to next question");
                }
            }
        },
        onSwipeRight: async () => {
            if (
                gameStatus &&
                sessionId &&
                typeof gameStatus.current_question_index === "number" &&
                gameStatus.current_question_index > 0
            ) {
                try {
                    await previousQuestion({ session_code: sessionId });
                    success("Moved to previous question");
                } catch (err) {
                    showError("Failed to move to previous question");
                }
            }
        },
        onPullToRefresh: async () => {
            setIsRefreshing(true);
            try {
                await refetch();
                success("Game status refreshed");
            } finally {
                setIsRefreshing(false);
            }
        },
        threshold: 80,
    });

    // Attach gestures to container
    useEffect(() => {
        const cleanup = attachGestures(containerRef.current);
        return cleanup;
    }, [attachGestures]);

    // Process game status updates
    useEffect(() => {
        if (!gameStatus) return;

        // Determine game state
        if (gameStatus.game_state) {
            // Map API state to component state
            switch (gameStatus.game_state) {
                case "active":
                    setGameState("active");
                    break;
                case "waiting":
                    setGameState("waiting");
                    break;
                case "completed":
                    setGameState("ended");
                    break;
                default:
                    setGameState("waiting");
            }
        } else {
            // Default to active if no state provided but questions exist
            setGameState(gameStatus.current_question ? "active" : "waiting");
        }

        // Fetch current question for the session using getCurrentQuestion
        const fetchCurrentQuestion = async () => {
            if (!sessionId) {
                setQuestion(null);
                return;
            }

            try {
                // Get current question for the session directly
                const currentQuestion = await getCurrentQuestion(sessionId);

                if (currentQuestion) {
                    // Convert string options to MCQOption format
                    const mcqOptions =
                        currentQuestion.options?.map((option, index) => ({
                            id: `option_${index}`,
                            text: option,
                        })) || [];

                    setQuestion({
                        id: currentQuestion.id,
                        type: mcqOptions.length > 0 ? "mcq" : "free",
                        prompt: currentQuestion.prompt || "",
                        options: mcqOptions,
                        answer: currentQuestion.answer || "",
                        genre: currentQuestion.genre || undefined,
                        difficulty:
                            (currentQuestion.difficulty as Question["difficulty"]) ||
                            undefined,
                    });
                } else {
                    setQuestion(null);
                }
            } catch (error) {
                console.error("Failed to fetch current question:", error);
                setQuestion(null);
            }
        };

        fetchCurrentQuestion();

        // Extract players from the status
        if (gameStatus.players) {
            const playerList: Player[] = [];
            if (Array.isArray(gameStatus.players)) {
                gameStatus.players.forEach((player: any) => {
                    playerList.push({
                        id: player.player_id || player.id,
                        name: player.player_name || player.name,
                        email: player.player_email || player.email,
                        answeredCurrent: player.answered_current || false,
                        score: player.score || 0,
                    });
                });
            } else if (typeof gameStatus.players === "object") {
                // Handle object format: {total: number, list: array}
                const playersObj = gameStatus.players as any;
                if (playersObj.list && Array.isArray(playersObj.list)) {
                    playersObj.list.forEach((player: any) => {
                        playerList.push({
                            id: player.player_id || player.id,
                            name: player.player_name || player.name,
                            email: player.player_email || player.email,
                            answeredCurrent: player.answered_current || false,
                            score: player.score || 0,
                        });
                    });
                }
            }
            setPlayers(playerList);
        }
    }, [gameStatus]);

    // Game Control Handlers
    const handlePause = async () => {
        if (!sessionId) return;
        try {
            await pauseGame({ session_code: sessionId });
            success("Game paused successfully");
            await refetch();
        } catch (error) {
            showError("Failed to pause game");
        }
    };

    const handleResume = async () => {
        if (!sessionId) return;
        try {
            await resumeGame({ session_code: sessionId });
            success("Game resumed successfully");
            await refetch();
        } catch (error) {
            showError("Failed to resume game");
        }
    };

    const handleNextQuestion = async () => {
        if (!sessionId) return;
        try {
            // Try WebSocket first if connected, fallback to HTTP API
            if (isConnected && wsGameControls) {
                wsGameControls.nextQuestion();
                success("Moving to next question via WebSocket...");
            } else {
                const response = await nextQuestion({
                    session_code: sessionId,
                });
                if (response.success) {
                    success("Moved to next question");
                    await refetch();
                }
            }
        } catch (error) {
            showError("Failed to go to next question");
        }
    };

    const handlePreviousQuestion = async () => {
        if (!sessionId) return;
        try {
            const response = await previousQuestion({
                session_code: sessionId,
            });
            if (response.success) {
                success("Moved to previous question");
                await refetch();
            }
        } catch (error) {
            showError("Failed to go to previous question");
        }
    };

    const handleEndGame = async () => {
        if (!sessionId) return;
        try {
            // Try WebSocket first if connected, fallback to HTTP API
            if (isConnected && wsGameControls) {
                wsGameControls.endGame();
                success("Ending game via WebSocket...");
                // Navigate after a short delay to allow WebSocket message to process
                setTimeout(() => navigate(`/stats/${sessionId}`), 1000);
            } else {
                const response = await endGame({ session_code: sessionId });
                if (response.success) {
                    success("Game ended successfully");
                    navigate(`/stats/${sessionId}`);
                }
            }
        } catch (error) {
            showError("Failed to end game");
        }
    };

    // Legacy next question handler for timer
    const next = async () => {
        await handleNextQuestion();
    };

    if (!gameStatus && loading) {
        return (
            <main className="max-w-6xl mx-auto px-4 py-8">
                <Card className="p-6">
                    <LoadingState message="Loading quiz session..." />
                </Card>
            </main>
        );
    }

    if (!gameStatus)
        return (
            <main className="max-w-6xl mx-auto px-4 py-8">
                <Card className="p-6">
                    <div className="text-center text-stone-400">
                        Session not found or failed to load.
                        <div className="mt-4">
                            <button
                                onClick={refetch}
                                className="px-4 py-2 bg-tea-500 text-ink-900 rounded-xl font-medium"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </Card>
            </main>
        );

    const keyer = `${sessionId}-${question?.id}`;
    const playersAnswered = players.filter((p) => p.answeredCurrent).length;

    return (
        <div
            ref={containerRef}
            className={`min-h-screen transition-transform duration-300 ease-out ${
                isRefreshing || gestureRefreshing ? "transform" : ""
            }`}
        >
            {/* Pull to refresh indicator */}
            {(isRefreshing || gestureRefreshing) && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-ink-800 text-tea-400 px-4 py-2 rounded-full text-sm shadow-lg border border-ink-600">
                    {isRefreshing
                        ? "🔄 Refreshing..."
                        : "⬇️ Release to refresh"}
                </div>
            )}

            {/* Swipe hints */}
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-ink-800/80 text-stone-400 px-3 py-1 rounded-full text-xs backdrop-blur-sm border border-ink-600">
                ← Swipe to navigate →
            </div>

            <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
                {/* Game State and Controls */}
                <div className="grid md:grid-cols-2 gap-4">
                    <GameStateIndicator
                        gameState={gameState}
                        currentQuestion={
                            gameStatus?.current_question_index
                                ? gameStatus.current_question_index + 1
                                : undefined
                        }
                        totalQuestions={gameStatus?.total_questions}
                        playersCount={players.length}
                        playersAnswered={playersAnswered}
                    />

                    <div className="flex items-center justify-between p-4 bg-ink-800 rounded-xl">
                        <div className="flex items-center gap-2">
                            <ConnectionIndicator size="sm" />
                            <WebSocketStatus
                                isConnected={isConnected}
                                lastUpdate={lastUpdate?.type}
                                className="text-stone-400"
                            />
                        </div>

                        <Timer ms={30000} keyer={keyer} onEnd={next} />
                    </div>
                </div>

                {/* Game Controls */}
                <GameControls
                    isPaused={gameState === "paused"}
                    canGoNext={
                        gameState === "active" &&
                        (gameStatus?.current_question_index || 0) <
                            (gameStatus?.total_questions || 1) - 1
                    }
                    canGoPrevious={
                        gameState === "active" &&
                        (gameStatus?.current_question_index || 0) > 0
                    }
                    isLoading={loading}
                    onPause={handlePause}
                    onResume={handleResume}
                    onNextQuestion={handleNextQuestion}
                    onPreviousQuestion={handlePreviousQuestion}
                    onEndGame={handleEndGame}
                    totalQuestions={gameStatus?.total_questions}
                    currentQuestion={
                        gameStatus?.current_question_index
                            ? gameStatus.current_question_index + 1
                            : undefined
                    }
                />

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Question Display */}
                    <section>
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold">
                                    Question{" "}
                                    {(gameStatus?.current_question_index || 0) +
                                        1}{" "}
                                    of {gameStatus?.total_questions || 0}
                                </h2>
                            </div>

                            <div className="text-lg mb-6">
                                {question?.prompt || "Loading question..."}
                            </div>

                            {question?.type === "mcq" && question.options && (
                                <div className="grid grid-cols-2 gap-3">
                                    {question.options.map((o: MCQOption) => (
                                        <div
                                            key={o.id}
                                            className="px-4 py-3 bg-ink-700 rounded-2xl text-center"
                                        >
                                            {o.text}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {question?.type === "free" && (
                                <div className="p-4 bg-ink-700 rounded-xl text-sm text-stone-300 text-center">
                                    Players answer with free text on their
                                    phones.
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-200 text-sm">
                                    {error}
                                </div>
                            )}
                        </Card>
                    </section>

                    {/* Player Status */}
                    <section>
                        <Card className="p-6">
                            <div className="text-lg font-semibold mb-4 flex items-center justify-between">
                                <span>Player Status</span>
                                <span className="text-sm font-normal text-stone-400">
                                    {playersAnswered}/{players.length} answered
                                </span>
                            </div>

                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {players.map((p: Player) => (
                                    <div
                                        key={p.id}
                                        className={`flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                                            p.answeredCurrent
                                                ? "bg-green-900/30 border border-green-500/30"
                                                : "bg-ink-700"
                                        }`}
                                    >
                                        <div className="font-medium">
                                            {p.name}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`text-sm ${
                                                    p.answeredCurrent
                                                        ? "text-green-300"
                                                        : "text-stone-400"
                                                }`}
                                            >
                                                {p.answeredCurrent
                                                    ? "✓ Answered"
                                                    : "Thinking..."}
                                            </div>
                                            <div className="text-sm font-semibold">
                                                {p.score || 0} pts
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {players.length === 0 && (
                                    <div className="text-stone-400 text-sm text-center py-8">
                                        No players joined yet.
                                    </div>
                                )}
                            </div>
                        </Card>
                    </section>

                    {/* WebSocket Diagnostics - Development Only */}
                    {import.meta.env.DEV && sessionId && (
                        <section>
                            <WebSocketDiagnostics sessionCode={sessionId} />
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
}
