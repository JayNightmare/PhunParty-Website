/**
 * WebSocket-based game controls
 * This module provides functions to control games via WebSocket connections
 */

import { WebSocketMessage } from "@/hooks/useWebSocket";

export interface GameControlWebSocket {
    sendMessage: (message: WebSocketMessage) => void;
    isConnected: boolean;
}

// Game control functions using WebSocket
export const createWebSocketGameControls = (ws: GameControlWebSocket) => {
    const startGame = () => {
        if (!ws.isConnected) {
            throw new Error("WebSocket not connected");
        }

        ws.sendMessage({
            type: "start_game",
            payload: {},
            timestamp: Date.now(),
        });
    };

    const nextQuestion = () => {
        if (!ws.isConnected) {
            throw new Error("WebSocket not connected");
        }

        ws.sendMessage({
            type: "next_question",
            payload: {},
            timestamp: Date.now(),
        });
    };

    const endGame = () => {
        if (!ws.isConnected) {
            throw new Error("WebSocket not connected");
        }

        ws.sendMessage({
            type: "end_game",
            payload: {},
            timestamp: Date.now(),
        });
    };

    const getSessionStats = () => {
        if (!ws.isConnected) {
            throw new Error("WebSocket not connected");
        }

        ws.sendMessage({
            type: "get_session_stats",
            payload: {},
            timestamp: Date.now(),
        });
    };

    const submitAnswer = (
        playerId: string,
        questionId: string,
        answer: string
    ) => {
        if (!ws.isConnected) {
            throw new Error("WebSocket not connected");
        }

        ws.sendMessage({
            type: "submit_answer",
            payload: {
                player_id: playerId,
                question_id: questionId,
                answer: answer,
            },
            timestamp: Date.now(),
        });
    };

    const pressBuzzer = (playerId: string) => {
        if (!ws.isConnected) {
            throw new Error("WebSocket not connected");
        }

        ws.sendMessage({
            type: "buzzer_press",
            payload: {
                player_id: playerId,
            },
            timestamp: Date.now(),
        });
    };

    return {
        startGame,
        nextQuestion,
        endGame,
        getSessionStats,
        submitAnswer,
        pressBuzzer,
    };
};

// Hook to use WebSocket game controls
export const useWebSocketGameControls = (ws: GameControlWebSocket) => {
    return createWebSocketGameControls(ws);
};
