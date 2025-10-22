import { useEffect, useRef, useState, useCallback } from "react";

// Backend WebSocket message types based on your API
export interface WebSocketMessage {
    type: string;
    payload?: any;
    timestamp?: number;
}

// Specific message types from your backend
export type WebSocketMessageType =
    | "initial_state"
    | "ping"
    | "pong"
    | "player_joined"
    | "player_left"
    | "game_started"
    | "game_ended"
    | "question_started"
    | "question_ended"
    | "player_answered"
    | "submit_answer"
    | "buzzer_press"
    | "buzzer_winner"
    | "correct_answer"
    | "incorrect_answer"
    | "ui_update"
    | "session_stats"
    | "next_question"
    | "start_game"
    | "end_game"
    | "get_session_stats"
    | "error"
    // New broadcast channel message types for Q&A
    | "qa_update"
    | "qa_question"
    | "qa_answer_submitted"
    | "broadcast_state";

export interface PhunPartyWebSocketMessage {
    type: WebSocketMessageType;
    data?: any;
    timestamp?: number;
}

export interface UseWebSocketOptions {
    reconnectAttempts?: number;
    reconnectInterval?: number;
    clientType?: "web" | "mobile";
    playerId?: string;
    playerName?: string;
    playerPhoto?: string;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    onMessage?: (message: PhunPartyWebSocketMessage) => void;
}

export interface UseWebSocketReturn {
    isConnected: boolean;
    isReconnecting: boolean;
    sendMessage: (message: PhunPartyWebSocketMessage) => void;
    disconnect: () => void;
    connect: () => void;
    lastMessage: PhunPartyWebSocketMessage | null;
    sessionStats: any | null;
    // Helper functions for common game actions
    submitAnswer: (answer: string, questionId: string) => void;
    pressBuzzer: () => void;
    startGame: () => void;
    nextQuestion: () => void;
    endGame: () => void;
    getSessionStats: () => void;
    sendPing: () => void;
}

const useWebSocket = (
    url: string | null,
    options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
    const {
        reconnectAttempts = 5,
        reconnectInterval = 3000,
        clientType = "web",
        playerId,
        playerName,
        playerPhoto,
        onConnect,
        onDisconnect,
        onError,
        onMessage,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [lastMessage, setLastMessage] =
        useState<PhunPartyWebSocketMessage | null>(null);
    const [sessionStats, setSessionStats] = useState<any | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectCountRef = useRef(0);
    const shouldReconnectRef = useRef(true);

    const connect = useCallback(() => {
        if (!url || wsRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        try {
            setIsReconnecting(reconnectCountRef.current > 0);

            // Build WebSocket URL with query parameters for backend
            const wsUrl = new URL(url);
            wsUrl.searchParams.set("client_type", clientType);

            if (clientType === "mobile" && playerId) {
                wsUrl.searchParams.set("player_id", playerId);
                if (playerName)
                    wsUrl.searchParams.set("player_name", playerName);
                if (playerPhoto)
                    wsUrl.searchParams.set("player_photo", playerPhoto);
            }

            wsRef.current = new WebSocket(wsUrl.toString());

            wsRef.current.onopen = () => {
                setIsConnected(true);
                setIsReconnecting(false);
                reconnectCountRef.current = 0;
                onConnect?.();
            };

            wsRef.current.onclose = () => {
                setIsConnected(false);
                setIsReconnecting(false);
                onDisconnect?.();

                // Auto-reconnect if enabled and within limits
                if (
                    shouldReconnectRef.current &&
                    reconnectCountRef.current < reconnectAttempts
                ) {
                    reconnectCountRef.current++;
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, reconnectInterval);
                }
            };

            wsRef.current.onerror = (error) => {
                setIsConnected(false);
                onError?.(error);
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const message: PhunPartyWebSocketMessage = JSON.parse(
                        event.data
                    );
                    setLastMessage(message);

                    // Handle special message types
                    if (message.type === "session_stats") {
                        setSessionStats(message.data);
                    } else if (message.type === "pong") {
                        // Handle heartbeat response
                        console.debug("WebSocket heartbeat received");
                    }

                    onMessage?.(message);
                } catch (error) {
                    console.error("Failed to parse WebSocket message:", error);
                }
            };
        } catch (error) {
            console.error("Failed to create WebSocket connection:", error);
        }
    }, [
        url,
        clientType,
        playerId,
        playerName,
        playerPhoto,
        reconnectAttempts,
        reconnectInterval,
        onConnect,
        onDisconnect,
        onError,
        onMessage,
    ]);

    const disconnect = useCallback(() => {
        shouldReconnectRef.current = false;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setIsConnected(false);
        setIsReconnecting(false);
        reconnectCountRef.current = 0;
    }, []);

    const sendMessage = useCallback((message: PhunPartyWebSocketMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(
                    JSON.stringify({
                        ...message,
                        timestamp: message.timestamp || Date.now(),
                    })
                );
            } catch (error) {
                console.error("Failed to send WebSocket message:", error);
            }
        }
    }, []);

    // Heartbeat/ping functionality
    const sendPing = useCallback(() => {
        sendMessage({ type: "ping" });
    }, [sendMessage]);

    // Helper functions for common messages
    const submitAnswer = useCallback(
        (answer: string, questionId: string) => {
            sendMessage({
                type: "submit_answer",
                data: { answer, question_id: questionId },
            });
        },
        [sendMessage]
    );

    const pressBuzzer = useCallback(() => {
        sendMessage({ type: "buzzer_press" });
    }, [sendMessage]);

    const startGame = useCallback(() => {
        sendMessage({ type: "start_game" });
    }, [sendMessage]);

    const nextQuestion = useCallback(() => {
        sendMessage({ type: "next_question" });
    }, [sendMessage]);

    const endGame = useCallback(() => {
        sendMessage({ type: "end_game" });
    }, [sendMessage]);

    const getSessionStats = useCallback(() => {
        sendMessage({ type: "get_session_stats" });
    }, [sendMessage]);

    useEffect(() => {
        if (url) {
            shouldReconnectRef.current = true;
            connect();
        }

        return () => {
            disconnect();
        };
    }, [url, connect, disconnect]);

    // Set up heartbeat
    useEffect(() => {
        if (isConnected) {
            const heartbeat = setInterval(() => {
                sendPing();
            }, 30000); // Send ping every 30 seconds

            return () => clearInterval(heartbeat);
        }
    }, [isConnected, sendPing]);

    return {
        isConnected,
        isReconnecting,
        sendMessage,
        disconnect,
        connect,
        lastMessage,
        sessionStats,
        // Helper functions
        submitAnswer,
        pressBuzzer,
        startGame,
        nextQuestion,
        endGame,
        getSessionStats,
        sendPing,
    };
};

export default useWebSocket;
