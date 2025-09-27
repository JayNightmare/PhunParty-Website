/**
 * WebSocket utilities and configuration
 */

// WebSocket URL configuration
export const getWebSocketUrl = (sessionCode: string): string => {
    const isDev = import.meta.env.DEV;

    if (isDev) {
        // In development, use the proxy
        const wsProtocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = window.location.host;
        return `${wsProtocol}//${wsHost}/ws/session/${sessionCode}`;
    } else {
        // In production, use the environment variable or default
        const wsUrl = import.meta.env.VITE_WS_URL || "wss://api.phun.party";
        return `${wsUrl}/ws/session/${sessionCode}`;
    }
};

// WebSocket query parameters builder
export const buildWebSocketQueryParams = (
    clientType: "web" | "mobile" = "web",
    playerId?: string,
    playerName?: string,
    playerPhoto?: string
): string => {
    const params = new URLSearchParams();
    params.set("client_type", clientType);

    if (playerId) params.set("player_id", playerId);
    if (playerName) params.set("player_name", playerName);
    if (playerPhoto) params.set("player_photo", playerPhoto);

    return params.toString();
};

// Build complete WebSocket URL with query parameters
export const buildWebSocketUrl = (
    sessionCode: string,
    clientType: "web" | "mobile" = "web",
    playerId?: string,
    playerName?: string,
    playerPhoto?: string
): string => {
    const baseUrl = getWebSocketUrl(sessionCode);
    const queryParams = buildWebSocketQueryParams(
        clientType,
        playerId,
        playerName,
        playerPhoto
    );

    return queryParams ? `${baseUrl}?${queryParams}` : baseUrl;
};

// WebSocket message types as expected by the backend
export interface BackendWebSocketMessage {
    type:
        | "ping"
        | "submit_answer"
        | "buzzer_press"
        | "start_game"
        | "next_question"
        | "end_game"
        | "get_session_stats";
    data?: any;
    timestamp?: number;
}

// WebSocket messages received from backend
export interface BackendWebSocketResponse {
    type:
        | "pong"
        | "initial_state"
        | "player_joined"
        | "player_left"
        | "game_started"
        | "game_ended"
        | "question_started"
        | "player_answered"
        | "answer_submitted"
        | "session_stats"
        | "ui_update"
        | "error";
    data?: any;
    timestamp?: number;
}

// Convert frontend message to backend format
export const formatMessageForBackend = (
    type: string,
    data?: any
): BackendWebSocketMessage => {
    return {
        type: type as any,
        data,
        timestamp: Date.now(),
    };
};

// Parse backend message to frontend format
export const parseBackendMessage = (
    message: BackendWebSocketResponse
): {
    type: string;
    payload: any;
    timestamp: number;
} => {
    return {
        type: message.type,
        payload: message.data,
        timestamp: message.timestamp || Date.now(),
    };
};
