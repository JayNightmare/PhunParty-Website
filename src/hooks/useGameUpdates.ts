import { useState, useCallback, useRef, useEffect } from "react";
import useGameWebSocket, { GameState, Player } from "@/hooks/useGameWebSocket";
import { getSessionStatus, GameStatusResponse } from "@/lib/api";

export interface GameUpdate {
    type:
        | "player_joined"
        | "player_left"
        | "question_started"
        | "question_ended"
        | "game_started"
        | "game_ended"
        | "answer_submitted"
        | "buzzer_pressed";
    sessionCode: string;
    timestamp: number;
    data: any;
}

export interface UseGameUpdatesOptions {
    sessionCode: string;
    pollInterval?: number; // Fallback polling interval in ms
    enableWebSocket?: boolean;
    clientType?: "web" | "mobile";
    playerId?: string;
    playerName?: string;
    playerPhoto?: string;
}

export interface UseGameUpdatesReturn {
    gameStatus: GameStatusResponse | null;
    gameState: GameState | null;
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    lastUpdate: GameUpdate | null;
    refetch: () => Promise<void>;
    connectedPlayers: Player[];
    // Game control functions (for web clients)
    startGame: () => void;
    nextQuestion: () => void;
    endGame: () => void;
    // Player functions (for mobile clients)
    submitAnswer: (answer: string, questionId: string) => void;
    pressBuzzer: () => void;
    // Raw message sending (for WebSocket communication)
    sendMessage?: (message: any) => void;
}

const useGameUpdates = ({
    sessionCode,
    pollInterval = 3000,
    enableWebSocket = true,
    clientType = "web",
    playerId,
    playerName,
    playerPhoto,
}: UseGameUpdatesOptions): UseGameUpdatesReturn => {
    const [gameStatus, setGameStatus] = useState<GameStatusResponse | null>(
        null
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<GameUpdate | null>(null);
    const [connectedPlayers, setConnectedPlayers] = useState<Player[]>([]);

    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastFetchRef = useRef<number>(0);

    const fetchGameStatus = useCallback(async () => {
        if (!sessionCode) return;

        // Prevent excessive API calls
        const now = Date.now();
        if (now - lastFetchRef.current < 1000) return;
        lastFetchRef.current = now;

        try {
            setIsLoading(true);
            setError(null);
            const status = await getSessionStatus(sessionCode);
            setGameStatus(status);
        } catch (err: any) {
            setError(err.message || "Failed to fetch game status");
        } finally {
            setIsLoading(false);
        }
    }, [sessionCode]);

    // WebSocket event handlers
    const handlePlayerJoined = useCallback(
        (player: Player) => {
            setConnectedPlayers((prev) => {
                // Avoid duplicates
                if (prev.some((p) => p.player_id === player.player_id)) {
                    return prev;
                }
                return [...prev, player];
            });

            setLastUpdate({
                type: "player_joined",
                sessionCode,
                timestamp: Date.now(),
                data: player,
            });
        },
        [sessionCode]
    );

    const handlePlayerLeft = useCallback(
        (playerId: string) => {
            setConnectedPlayers((prev) =>
                prev.filter((p) => p.player_id !== playerId)
            );

            setLastUpdate({
                type: "player_left",
                sessionCode,
                timestamp: Date.now(),
                data: { playerId },
            });
        },
        [sessionCode]
    );

    const handleGameStarted = useCallback(() => {
        setLastUpdate({
            type: "game_started",
            sessionCode,
            timestamp: Date.now(),
            data: {},
        });

        // Refresh game status
        fetchGameStatus();
    }, [sessionCode, fetchGameStatus]);

    const handleGameEnded = useCallback(() => {
        setLastUpdate({
            type: "game_ended",
            sessionCode,
            timestamp: Date.now(),
            data: {},
        });

        // Refresh game status
        fetchGameStatus();
    }, [sessionCode, fetchGameStatus]);

    const handleQuestionStarted = useCallback(
        (question: any) => {
            setLastUpdate({
                type: "question_started",
                sessionCode,
                timestamp: Date.now(),
                data: { question },
            });

            // Reset answered status for all players
            setConnectedPlayers((prev) =>
                prev.map((p) => ({ ...p, answered_current: false }))
            );

            // Refresh game status
            fetchGameStatus();
        },
        [sessionCode, fetchGameStatus]
    );

    const handlePlayerAnswered = useCallback(
        (playerId: string, playerName: string) => {
            setConnectedPlayers((prev) =>
                prev.map((p) =>
                    p.player_id === playerId
                        ? { ...p, answered_current: true }
                        : p
                )
            );

            setLastUpdate({
                type: "answer_submitted",
                sessionCode,
                timestamp: Date.now(),
                data: { playerId, playerName },
            });
        },
        [sessionCode]
    );

    const handleBuzzerWinner = useCallback(
        (playerId: string, playerName: string) => {
            setLastUpdate({
                type: "buzzer_pressed",
                sessionCode,
                timestamp: Date.now(),
                data: { playerId, playerName },
            });
        },
        [sessionCode]
    );

    const handleError = useCallback((errorMessage: string) => {
        setError(errorMessage);
    }, []);

    // Use the game WebSocket hook
    const {
        isConnected,
        gameState,
        startGame,
        nextQuestion,
        endGame,
        submitAnswer,
        pressBuzzer,
        sendMessage,
    } = useGameWebSocket({
        sessionCode,
        clientType,
        playerId,
        playerName,
        playerPhoto,
        onPlayerJoined: handlePlayerJoined,
        onPlayerLeft: handlePlayerLeft,
        onGameStarted: handleGameStarted,
        onGameEnded: handleGameEnded,
        onQuestionStarted: handleQuestionStarted,
        onPlayerAnswered: handlePlayerAnswered,
        onBuzzerWinner: handleBuzzerWinner,
        onError: handleError,
        reconnectAttempts: 3,
        reconnectInterval: 5000,
    });

    // Update connected players from game state
    useEffect(() => {
        if (gameState?.connectedPlayers) {
            setConnectedPlayers(gameState.connectedPlayers);
        }
    }, [gameState?.connectedPlayers]);

    // Fallback polling when WebSocket is not available or not connected
    useEffect(() => {
        if (!enableWebSocket || !isConnected) {
            // Start polling
            const startPolling = () => {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                }

                pollIntervalRef.current = setInterval(
                    fetchGameStatus,
                    pollInterval
                );
                fetchGameStatus(); // Initial fetch
            };

            startPolling();

            return () => {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
            };
        } else {
            // WebSocket is connected, stop polling
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }

            // Initial fetch when WebSocket connects
            fetchGameStatus();
        }
    }, [enableWebSocket, isConnected, pollInterval, fetchGameStatus]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    return {
        gameStatus,
        gameState,
        isConnected: enableWebSocket ? isConnected : true, // Always "connected" when using polling
        isLoading,
        error,
        lastUpdate,
        refetch: fetchGameStatus,
        connectedPlayers,
        startGame,
        nextQuestion,
        endGame,
        submitAnswer,
        pressBuzzer,
        sendMessage: enableWebSocket ? sendMessage : undefined,
    };
};

export default useGameUpdates;
