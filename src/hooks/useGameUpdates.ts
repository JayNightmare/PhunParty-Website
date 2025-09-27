import { useState, useCallback, useRef, useEffect } from "react";
import useWebSocket, { WebSocketMessage } from "@/hooks/useWebSocket";
import { getSessionStatus, GameStatusResponse } from "@/lib/api";
import { buildWebSocketUrl } from "@/lib/websocket";

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
    sendMessage?: (message: WebSocketMessage) => void;
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

    // WebSocket URL using the utility function
    const wsUrl =
        enableWebSocket && sessionCode
            ? buildWebSocketUrl(sessionCode, "web")
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
            console.log("Received WebSocket message:", message);

            // Handle different message types from backend
            switch (message.type) {
                case "initial_state":
                    // Backend sends initial state when connecting
                    if (message.payload?.game_state) {
                        setGameStatus(message.payload.game_state);
                    }
                    break;

                case "player_joined":
                case "player_left":
                case "player_answered":
                    // Player-related updates - refresh status
                    const playerUpdate: GameUpdate = {
                        type: message.type as any,
                        sessionCode: sessionCode,
                        timestamp: message.timestamp || Date.now(),
                        data: message.payload,
                    };
                    setLastUpdate(playerUpdate);
                    fetchGameStatus();
                    break;

                case "question_started":
                    // New question started
                    const questionUpdate: GameUpdate = {
                        type: "question_started",
                        sessionCode: sessionCode,
                        timestamp: message.timestamp || Date.now(),
                        data: message.payload,
                    };
                    setLastUpdate(questionUpdate);

                    // Update game status if provided, otherwise fetch
                    if (message.payload?.game_state) {
                        setGameStatus(message.payload.game_state);
                    } else {
                        fetchGameStatus();
                    }
                    break;

                case "game_started":
                case "game_ended":
                    // Major game state changes
                    const gameUpdate: GameUpdate = {
                        type: message.type as any,
                        sessionCode: sessionCode,
                        timestamp: message.timestamp || Date.now(),
                        data: message.payload,
                    };
                    setLastUpdate(gameUpdate);
                    fetchGameStatus();
                    break;

                case "session_stats":
                    // Session statistics update - could be used for player counts
                    break;

                case "error":
                    // Handle WebSocket errors
                    console.error("WebSocket error message:", message.payload);
                    setError(message.payload?.message || "WebSocket error");
                    break;

                default:
                    console.log(
                        "Unknown WebSocket message type:",
                        message.type
                    );
                    break;
            }
        },
        [sessionCode, fetchGameStatus]
    );

    const { isConnected, isReconnecting, sendMessage } = useWebSocket(wsUrl, {
        onMessage: handleWebSocketMessage,
        onConnect: () => {
            console.log("WebSocket connected for session:", sessionCode);
            setError(null);
        },
        onDisconnect: () => {
            console.log("WebSocket disconnected for session:", sessionCode);
        },
        onError: (error) => {
            console.error(
                "WebSocket error for session",
                sessionCode,
                ":",
                error
            );
            setError("WebSocket connection error");
        },
        reconnectAttempts: 3,
        reconnectInterval: 5000,
        enableHeartbeat: true,
        heartbeatInterval: 30000,
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
        sendMessage: enableWebSocket ? sendMessage : undefined,
    };
};

export default useGameUpdates;
