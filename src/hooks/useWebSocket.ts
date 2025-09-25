import { useEffect, useRef, useState, useCallback } from "react";

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
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(
        null
    );

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
            wsRef.current = new WebSocket(url);

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
                    const message: WebSocketMessage = JSON.parse(event.data);
                    setLastMessage(message);
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

    const sendMessage = useCallback((message: WebSocketMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(
                    JSON.stringify({
                        ...message,
                        timestamp: Date.now(),
                    })
                );
            } catch (error) {
                console.error("Failed to send WebSocket message:", error);
            }
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
