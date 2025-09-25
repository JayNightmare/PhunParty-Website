import { useState, useCallback, useRef, useEffect } from "react";
import useWebSocket, { WebSocketMessage } from "@/hooks/useWebSocket";
import { getSessionStatus, GameStatusResponse } from "@/lib/api";

export interface GameUpdate {
    type:
        | "player_joined"
        | "player_left"
        | "question_started"
        | "question_ended"
        | "game_started"
        | "game_ended"
        | "answer_submitted";
    sessionCode: string;
    timestamp: number;
    data: any;
}

export interface UseGameUpdatesOptions {
    sessionCode: string;
    pollInterval?: number; // Fallback polling interval in ms
    enableWebSocket?: boolean;
}

export interface UseGameUpdatesReturn {
    gameStatus: GameStatusResponse | null;
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    lastUpdate: GameUpdate | null;
    refetch: () => Promise<void>;
}

const useGameUpdates = ({
    sessionCode,
    pollInterval = 3000,
    enableWebSocket = true,
}: UseGameUpdatesOptions): UseGameUpdatesReturn => {
    const [gameStatus, setGameStatus] = useState<GameStatusResponse | null>(
        null
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<GameUpdate | null>(null);

    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastFetchRef = useRef<number>(0);

    // WebSocket URL - in production this would come from environment
    const wsUrl =
        enableWebSocket && sessionCode
            ? `wss://api.phun.party/ws/session/${sessionCode}`
            : null;

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

    const handleWebSocketMessage = useCallback(
        (message: WebSocketMessage) => {
            if (message.type === "game_update" && message.payload) {
                const update: GameUpdate = {
                    type: message.payload.type,
                    sessionCode: message.payload.sessionCode || sessionCode,
                    timestamp: message.timestamp || Date.now(),
                    data: message.payload.data,
                };

                setLastUpdate(update);

                // Update game status based on the update type
                switch (update.type) {
                    case "player_joined":
                    case "player_left":
                    case "answer_submitted":
                        // Refresh game status for player-related updates
                        fetchGameStatus();
                        break;
                    case "question_started":
                    case "question_ended":
                        // Update current question info
                        if (update.data.gameStatus) {
                            setGameStatus(update.data.gameStatus);
                        } else {
                            fetchGameStatus();
                        }
                        break;
                    case "game_started":
                    case "game_ended":
                        // Full game status update
                        if (update.data.gameStatus) {
                            setGameStatus(update.data.gameStatus);
                        } else {
                            fetchGameStatus();
                        }
                        break;
                    default:
                        // Unknown update type, refetch to be safe
                        fetchGameStatus();
                }
            }
        },
        [sessionCode, fetchGameStatus]
    );

    const { isConnected, isReconnecting } = useWebSocket(wsUrl, {
        onMessage: handleWebSocketMessage,
        onError: (error) => {
            console.error("WebSocket error:", error);
            // Fall back to polling on WebSocket errors
        },
        reconnectAttempts: 3,
        reconnectInterval: 5000,
    });

    // Fallback polling when WebSocket is not available or connected
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
        isConnected: enableWebSocket ? isConnected : true, // Always "connected" when using polling
        isLoading,
        error,
        lastUpdate,
        refetch: fetchGameStatus,
    };
};

export default useGameUpdates;
