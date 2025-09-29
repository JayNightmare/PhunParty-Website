import { useMemo, useState, useRef, useEffect } from "react";
import { Session, MCQOption, Player, Question } from "@/types";
import { useParams } from "react-router-dom";
import Card from "@/components/Card";
import {
    joinGameSession,
    submitAnswer,
    getSessionStatus,
    getCurrentQuestion,
    createPlayer,
} from "@/lib/api";
import { LoadingButton, LoadingState } from "@/components/Loading";
import { useToast } from "@/contexts/ToastContext";
import useGameUpdates from "@/hooks/useGameUpdates";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import MobileAnswerSelector from "@/components/MobileAnswerSelector";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { useTouchGestures } from "@/hooks/useTouchGestures";
import { useWebSocketGameControls } from "@/hooks/useWebSocketGameControls";

export default function Join() {
    const { sessionId } = useParams();
    const { showSuccess, showError } = useToast();
    const nameInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [name, setName] = useState("");
    const [myId, setMyId] = useState<string | null>(null);
    const [question, setQuestion] = useState<Question | null>(null);
    const [val, setVal] = useState("");
    const [joinLoading, setJoinLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Use real-time game updates
    const {
        gameStatus,
        isConnected,
        isLoading: statusLoading,
        error: statusError,
        lastUpdate,
        sendMessage,
    } = useGameUpdates({
        sessionCode: sessionId || "",
        enableWebSocket: true,
    });

    // WebSocket game controls for real-time interactions
    const wsGameControls = useWebSocketGameControls({
        sendMessage: sendMessage || (() => {}),
        isConnected: isConnected,
    });

    // Enhanced touch gestures for mobile
    const {
        attachGestures,
        isRefreshing: gestureRefreshing,
        pullDistance,
    } = useTouchGestures({
        onPullToRefresh: async () => {
            setIsRefreshing(true);
            try {
                // Force refresh game status
                window.location.reload();
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

    // Auto-focus name input on mobile
    useEffect(() => {
        if (!myId && nameInputRef.current) {
            // Delay to ensure mobile keyboard opens properly
            const timer = setTimeout(() => {
                nameInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [myId]);

    // Only fetch question data AFTER the game has actually started
    // Game truly started only when backend sets isstarted flag
    const hasStarted = !!gameStatus?.isstarted;

    useEffect(() => {
        const fetchCurrentQuestion = async () => {
            if (!sessionId || !hasStarted) {
                // Clear any stale question if we reverted to waiting state
                if (!hasStarted) setQuestion(null);
                return;
            }
            try {
                const currentQuestion = await getCurrentQuestion(sessionId);
                if (currentQuestion) {
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
        // Trigger fetch when game starts or question index changes
        if (hasStarted) {
            fetchCurrentQuestion();
        } else {
            setQuestion(null);
        }
    }, [sessionId, hasStarted, gameStatus?.current_question_index]);

    // Check if player is already joined from localStorage
    useEffect(() => {
        if (sessionId) {
            const stored = localStorage.getItem(`auth_user`);
            if (stored) {
                try {
                    const playerData = JSON.parse(stored);
                    setMyId(playerData.id);
                    setName(playerData.name);
                } catch (error) {
                    // Clear invalid stored data
                    localStorage.removeItem(`player_${sessionId}`);
                }
            }
        }
    }, [sessionId]);

    // Join session - handles player creation and game joining
    const join = async () => {
        if (!sessionId || !name.trim()) {
            setJoinError("Please enter your name");
            return;
        }

        setJoinLoading(true);
        setJoinError(null);

        try {
            const p = localStorage.getItem(`auth_user`);

            if (!p) {
                throw new Error("Player information not found in localStorage");
            }

            const player = JSON.parse(p);
            console.log("Joining as player:", player);

            const playerData = {
                session_code: sessionId,
                player_id: player.id,
            };

            // Step 2: Join the game session with the created player ID
            await joinGameSession(playerData);

            showSuccess(`Welcome to the game, ${name.trim()}!`);
        } catch (err: any) {
            const errorMsg = err.message || "Failed to join session";
            setJoinError(errorMsg);
            showError(errorMsg);
        } finally {
            setJoinLoading(false);
        }
    };

    // Submit answer
    const submit = async (v: string) => {
        if (!sessionId || !question || !myId || !hasStarted) return;

        setSubmitLoading(true);

        try {
            // Try WebSocket first if connected, fallback to HTTP API
            if (isConnected && wsGameControls && sendMessage) {
                wsGameControls.submitAnswer(myId, question.id, v);
                showSuccess("Answer submitted via WebSocket!");
            } else {
                await submitAnswer({
                    player_id: myId,
                    session_code: sessionId,
                    question_id: question.id,
                    answer: v,
                });
                showSuccess("Answer submitted!");
            }
            setVal("");
        } catch (err: any) {
            const errorMsg = err.message || "Failed to submit answer";
            showError(errorMsg);
        } finally {
            setSubmitLoading(false);
        }
    };

    // Handle Enter key for joining
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !joinLoading && name.trim()) {
            join();
        }
    };

    // Loading state
    if (statusLoading && !gameStatus) {
        return (
            <main className="max-w-md mx-auto px-4 py-8">
                <Card className="p-6">
                    <LoadingState message="Loading game session..." />
                </Card>
            </main>
        );
    }

    // Error state
    if (statusError && !gameStatus) {
        return (
            <main className="max-w-md mx-auto px-4 py-8">
                <Card className="p-6">
                    <div className="text-center">
                        <div className="text-red-400 mb-4">❌</div>
                        <h2 className="text-lg font-semibold mb-2">
                            Session Not Found
                        </h2>
                        <p className="text-stone-400 mb-4">{statusError}</p>
                        <div className="text-sm text-stone-500">
                            Session ID: {sessionId}
                        </div>
                    </div>
                </Card>
            </main>
        );
    }

    if (!gameStatus) {
        return (
            <main className="max-w-md mx-auto px-4 py-8">
                <Card className="p-6">
                    <div className="text-center text-stone-400">
                        Session not found or loading...
                    </div>
                </Card>
            </main>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`min-h-screen transition-transform duration-300 ease-out ${
                isRefreshing || gestureRefreshing ? "transform" : ""
            }`}
        >
            {/* PWA Install Prompt */}
            <PWAInstallPrompt />

            {/* Pull to refresh indicator */}
            {(isRefreshing || gestureRefreshing) && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-ink-800 text-tea-400 px-4 py-2 rounded-full text-sm shadow-lg border border-ink-600">
                    {isRefreshing
                        ? "🔄 Refreshing..."
                        : "⬇️ Release to refresh"}
                </div>
            )}

            <main className="max-w-md mx-auto px-4 py-8">
                <Card className="p-6">
                    {/* Connection Status */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-xs text-stone-400">
                            Session: {sessionId}
                        </div>
                        <ConnectionIndicator size="sm" showText />
                    </div>

                    {!myId ? (
                        <div>
                            <div className="text-xl font-semibold mb-2">
                                Join Game
                            </div>
                            <div className="text-sm text-stone-400 mb-6">
                                State: {gameStatus.game_state} • Players:{" "}
                                {gameStatus.players?.length || 0}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-300 mb-2">
                                        Your Name
                                    </label>
                                    <input
                                        ref={nameInputRef}
                                        type="text"
                                        value={name}
                                        onChange={(e) =>
                                            setName(e.target.value)
                                        }
                                        onKeyPress={handleKeyPress}
                                        placeholder="Enter your name"
                                        className="w-full px-4 py-3 rounded-2xl bg-ink-700 border border-ink-600 text-stone-100 placeholder-stone-500 outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent text-lg"
                                        maxLength={30}
                                        autoComplete="name"
                                        autoFocus
                                    />
                                    <div className="text-xs text-stone-500 mt-1">
                                        {name.length}/30 characters
                                    </div>
                                </div>

                                <LoadingButton
                                    onClick={join}
                                    isLoading={joinLoading}
                                    loadingText="Joining game..."
                                    disabled={!name.trim()}
                                    className="w-full py-4 text-lg font-semibold"
                                >
                                    Join Game
                                </LoadingButton>

                                {joinError && (
                                    <div className="p-3 bg-red-900/20 border border-red-800 rounded-xl text-red-400 text-sm">
                                        {joinError}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="text-lg font-semibold mb-2">
                                Welcome, {name}!
                            </div>
                            <div className="text-sm text-stone-400 mb-4">
                                {!hasStarted &&
                                    "Waiting for host to start the game..."}
                                {hasStarted &&
                                    question &&
                                    `Question ${
                                        gameStatus.current_question_index + 1
                                    }/${gameStatus.total_questions}`}
                                {hasStarted &&
                                    !question &&
                                    "Waiting for next question..."}
                            </div>

                            {!hasStarted ? (
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-4">🕒</div>
                                    <div className="text-stone-300 font-medium">
                                        You're in! Waiting for the host to
                                        start.
                                    </div>
                                    <div className="text-xs text-stone-500 mt-2">
                                        {isConnected
                                            ? "Connected for real-time updates"
                                            : "Connecting..."}
                                    </div>
                                </div>
                            ) : question ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-ink-800 rounded-xl">
                                        <div className="text-lg font-medium mb-4">
                                            {question.prompt}
                                        </div>
                                    </div>

                                    {question.type === "mcq" && (
                                        <MobileAnswerSelector
                                            options={question.options || []}
                                            onSelect={(optionId) => {
                                                // Find the option text by ID
                                                const selectedOption =
                                                    question.options?.find(
                                                        (opt) =>
                                                            opt.id === optionId
                                                    );
                                                if (selectedOption) {
                                                    submit(selectedOption.text);
                                                }
                                            }}
                                            isSubmitting={submitLoading}
                                            selectedOption={
                                                val
                                                    ? question.options?.find(
                                                          (opt) =>
                                                              opt.text === val
                                                      )?.id
                                                    : undefined
                                            }
                                            timeRemaining={undefined} // Could add timer from game status
                                            disabled={submitLoading}
                                        />
                                    )}

                                    {question.type === "free" && (
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={val}
                                                onChange={(e) =>
                                                    setVal(e.target.value)
                                                }
                                                placeholder="Type your answer"
                                                className="w-full px-4 py-3 rounded-2xl bg-ink-700 border border-ink-600 text-stone-100 placeholder-stone-500 outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent text-lg"
                                                maxLength={100}
                                                autoFocus
                                            />
                                            <LoadingButton
                                                onClick={() => submit(val)}
                                                isLoading={submitLoading}
                                                loadingText="Submitting..."
                                                disabled={!val.trim()}
                                                className="w-full py-3 text-lg font-semibold"
                                            >
                                                Submit Answer
                                            </LoadingButton>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-4">⏳</div>
                                    <div className="text-stone-400">
                                        Waiting for the host to advance...
                                    </div>
                                    <div className="text-xs text-stone-500 mt-2">
                                        {isConnected
                                            ? "Connected for real-time updates"
                                            : "Checking for updates..."}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
}
