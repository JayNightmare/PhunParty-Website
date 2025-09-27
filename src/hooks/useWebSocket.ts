import { useEffect, useRef, useState, useCallback } from "react";
import {
    BackendWebSocketResponse,
    BackendWebSocketMessage,
    parseBackendMessage,
    formatMessageForBackend,
} from "@/lib/websocket";

export interface WebSocketMessage {
    type: string;
    payload: any;
    timestamp?: number;
}

export interface UseWebSocketOptions {
    reconnectAttempts?: number;
    reconnectInterval?: number;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    onMessage?: (message: WebSocketMessage) => void;
    enableHeartbeat?: boolean;
    heartbeatInterval?: number;
}

export interface UseWebSocketReturn {
    isConnected: boolean;
    isReconnecting: boolean;
    sendMessage: (message: WebSocketMessage) => void;
    disconnect: () => void;
    connect: () => void;
    lastMessage: WebSocketMessage | null;
}

const useWebSocket = (
    url: string | null,
    options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
    const {
        reconnectAttempts = 5,
        reconnectInterval = 3000,
        onConnect,
        onDisconnect,
        onError,
        onMessage,
        enableHeartbeat = true,
        heartbeatInterval = 30000,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(
        null
    );

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectCountRef = useRef(0);
    const shouldReconnectRef = useRef(true);

    const connect = useCallback(() => {
        if (!url || wsRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        try {
            setIsReconnecting(reconnectCountRef.current > 0);
            wsRef.current = new WebSocket(url);

            wsRef.current.onopen = () => {
                console.log("WebSocket connected to:", url);
                setIsConnected(true);
                setIsReconnecting(false);
                reconnectCountRef.current = 0;

                // Start heartbeat
                if (enableHeartbeat) {
                    startHeartbeat();
                }

                onConnect?.();
            };

            wsRef.current.onclose = (event) => {
                console.log("WebSocket closed:", event.code, event.reason);
                setIsConnected(false);
                setIsReconnecting(false);

                // Stop heartbeat
                stopHeartbeat();

                onDisconnect?.();

                // Auto-reconnect if enabled and within limits
                if (
                    shouldReconnectRef.current &&
                    reconnectCountRef.current < reconnectAttempts &&
                    event.code !== 4004 // Don't reconnect if session not found
                ) {
                    reconnectCountRef.current++;
                    console.log(
                        `Attempting to reconnect (${reconnectCountRef.current}/${reconnectAttempts})...`
                    );
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, reconnectInterval);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error("WebSocket error:", error);
                setIsConnected(false);
                onError?.(error);
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const backendMessage: BackendWebSocketResponse = JSON.parse(
                        event.data
                    );

                    // Handle pong responses for heartbeat
                    if (backendMessage.type === "pong") {
                        // Heartbeat response received
                        return;
                    }

                    // Convert backend message format to frontend format
                    const message = parseBackendMessage(backendMessage);
                    setLastMessage(message);
                    onMessage?.(message);
                } catch (error) {
                    console.error(
                        "Failed to parse WebSocket message:",
                        error,
                        event.data
                    );
                }
            };
        } catch (error) {
            console.error("Failed to create WebSocket connection:", error);
        }
    }, [
        url,
        reconnectAttempts,
        reconnectInterval,
        onConnect,
        onDisconnect,
        onError,
        onMessage,
    ]);

    const startHeartbeat = useCallback(() => {
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
        }

        heartbeatTimeoutRef.current = setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                // Send ping message
                const pingMessage = formatMessageForBackend("ping");
                wsRef.current.send(JSON.stringify(pingMessage));

                // Schedule next heartbeat
                startHeartbeat();
            }
        }, heartbeatInterval);
    }, [heartbeatInterval]);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = null;
        }
    }, []);

    const disconnect = useCallback(() => {
        shouldReconnectRef.current = false;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        stopHeartbeat();

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setIsConnected(false);
        setIsReconnecting(false);
        reconnectCountRef.current = 0;
    }, [stopHeartbeat]);

    const sendMessage = useCallback((message: WebSocketMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
                // Convert frontend message format to backend format
                const backendMessage = formatMessageForBackend(
                    message.type,
                    message.payload
                );
                wsRef.current.send(JSON.stringify(backendMessage));
            } catch (error) {
                console.error("Failed to send WebSocket message:", error);
            }
        } else {
            console.warn(
                "WebSocket not connected, cannot send message:",
                message
            );
        }
    }, []);

    useEffect(() => {
        if (url) {
            shouldReconnectRef.current = true;
            connect();
        }

        return () => {
            disconnect();
        };
    }, [url, connect, disconnect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopHeartbeat();
        };
    }, [stopHeartbeat]);

    return {
        isConnected,
        isReconnecting,
        sendMessage,
        disconnect,
        connect,
        lastMessage,
    };
};

export default useWebSocket;
