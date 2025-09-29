import { useState, useCallback, useEffect } from "react";
import useWebSocket, {
    PhunPartyWebSocketMessage,
    UseWebSocketOptions,
} from "./useWebSocket";
import { getWebSocketUrl } from "@/lib/api";

export interface GameState {
    sessionCode: string;
    gameType: "trivia" | "buzzer";
    isActive: boolean;
    currentQuestion: any | null;
    connectedPlayers: Player[];
    gameStats: any | null;
}

export interface Player {
    player_id: string;
    player_name: string;
    player_photo?: string;
    connected_at?: string;
    answered_current?: boolean;
    score?: number;
}

export interface UseGameWebSocketOptions
    extends Omit<UseWebSocketOptions, "onMessage" | "onError"> {
    sessionCode: string;
    onPlayerJoined?: (player: Player) => void;
    onPlayerLeft?: (playerId: string) => void;
    onGameStarted?: () => void;
    onGameEnded?: () => void;
    onQuestionStarted?: (question: any) => void;
    onPlayerAnswered?: (playerId: string, playerName: string) => void;
    onBuzzerWinner?: (playerId: string, playerName: string) => void;
    onCorrectAnswer?: (playerId: string, answer: string) => void;
    onIncorrectAnswer?: (playerId: string, answer: string) => void;
    onUIUpdate?: (uiState: any) => void;
    onError?: (error: string) => void;
    onWebSocketError?: (error: Event) => void; // Separate handler for low-level WebSocket errors
}

export interface UseGameWebSocketReturn {
    // WebSocket connection state
    isConnected: boolean;
    isReconnecting: boolean;
    gameState: GameState | null;

    // Game actions for web clients
    startGame: () => void;
    nextQuestion: () => void;
    endGame: () => void;
    getSessionStats: () => void;

    // Player Joins/Leaves
    onPlayerJoined?: (player: Player) => void;
    onPlayerLeft?: (playerId: string) => void;

    // Game state updates
    onGameStarted?: () => void;
    onGameEnded?: () => void;
    onQuestionStarted?: (question: any) => void;
    onPlayerAnswered?: (playerId: string, playerName: string) => void;
    onBuzzerWinner?: (playerId: string, playerName: string) => void;
    onCorrectAnswer?: (playerId: string, answer: string) => void;
    onIncorrectAnswer?: (playerId: string, answer: string) => void;
    onUIUpdate?: (uiState: any) => void;
    onError?: (error: string) => void;

    // Player actions for mobile clients
    submitAnswer: (answer: string, questionId: string) => void;
    pressBuzzer: () => void;

    // Connection management
    connect: () => void;
    disconnect: () => void;

    // Raw message sending (for custom messages)
    sendMessage: (message: PhunPartyWebSocketMessage) => void;
}

export const useGameWebSocket = (
    options: UseGameWebSocketOptions
): UseGameWebSocketReturn => {
    const {
        sessionCode,
        clientType = "web",
        playerId,
        playerName,
        playerPhoto,
        onPlayerJoined,
        onPlayerLeft,
        onGameStarted,
        onGameEnded,
        onQuestionStarted,
        onPlayerAnswered,
        onBuzzerWinner,
        onCorrectAnswer,
        onIncorrectAnswer,
        onUIUpdate,
        onError: onErrorCallback,
        onWebSocketError,
        ...websocketOptions
    } = options;

    const [gameState, setGameState] = useState<GameState | null>(null);

    // Build WebSocket URL based on environment
    const buildWebSocketUrl = useCallback(() => {
        if (!sessionCode) return null;

        const params: Record<string, string> = {
            client_type: clientType,
        };

        if (clientType === "mobile" && playerId) {
            params.player_id = playerId;
            if (playerName) params.player_name = playerName;
            if (playerPhoto) params.player_photo = playerPhoto;
        }

        return getWebSocketUrl(sessionCode, params);
    }, [sessionCode, clientType, playerId, playerName, playerPhoto]);

    const handleMessage = useCallback(
        (message: PhunPartyWebSocketMessage) => {
            console.log("Game WebSocket message:", message);

            // Helper to normalize various backend payload shapes into a plain question object
            const extractQuestion = (raw: any): any | null => {
                if (!raw) return null;
                // If already looks like a question (has question_id or prompt / question text), return as-is
                if (
                    typeof raw === "object" &&
                    (raw.question_id || raw.question || raw.prompt)
                ) {
                    return raw;
                }
                // If backend sent the full status wrapper under current_question, dig deeper
                if (
                    raw.current_question &&
                    (raw.current_question.question_id ||
                        raw.current_question.question)
                ) {
                    return raw.current_question;
                }
                return null;
            };

            switch (message.type) {
                case "initial_state":
                    if (message.data) {
                        const normalizedQuestion = extractQuestion(
                            message.data.current_question
                        );
                        setGameState({
                            sessionCode:
                                message.data.session_code || sessionCode,
                            gameType:
                                message.data.game_state?.game_type || "trivia",
                            isActive:
                                message.data.game_state?.is_active || false,
                            currentQuestion: normalizedQuestion,
                            connectedPlayers:
                                message.data.connected_players || [],
                            gameStats: message.data.connection_stats || null,
                        });
                    }
                    break;

                case "player_joined":
                    if (message.data) {
                        const player: Player = {
                            player_id: message.data.player_id,
                            player_name: message.data.player_name,
                            player_photo: message.data.player_photo,
                            connected_at: message.data.timestamp,
                        };

                        setGameState((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      connectedPlayers: [
                                          ...prev.connectedPlayers,
                                          player,
                                      ],
                                  }
                                : null
                        );

                        onPlayerJoined?.(player);
                    }
                    break;

                case "player_left":
                    if (message.data) {
                        setGameState((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      connectedPlayers:
                                          prev.connectedPlayers.filter(
                                              (p) =>
                                                  p.player_id !==
                                                  message.data.player_id
                                          ),
                                  }
                                : null
                        );

                        onPlayerLeft?.(message.data.player_id);
                    }
                    break;

                case "game_started":
                    setGameState((prev) => {
                        if (!prev) return null;
                        const normalizedQuestion =
                            extractQuestion(message.data?.current_question) ||
                            prev.currentQuestion;
                        return {
                            ...prev,
                            isActive: true,
                            currentQuestion: normalizedQuestion,
                            connectedPlayers: prev.connectedPlayers.map(
                                (p) => ({
                                    ...p,
                                    answered_current: false,
                                })
                            ),
                            isStarted: true,
                        } as any;
                    });
                    onGameStarted?.();
                    break;

                case "game_ended":
                    setGameState((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  isActive: false,
                                  currentQuestion: null,
                              }
                            : null
                    );
                    onGameEnded?.();
                    break;

                case "question_started":
                    setGameState((prev) => {
                        if (!prev) return null;
                        const normalized = extractQuestion(
                            message.data?.question || message.data
                        );
                        return { ...prev, currentQuestion: normalized };
                    });
                    onQuestionStarted?.(message.data);
                    break;

                case "player_answered":
                    if (message.data) {
                        // Update player as having answered current question
                        setGameState((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      connectedPlayers:
                                          prev.connectedPlayers.map((p) =>
                                              p.player_id ===
                                              message.data.player_id
                                                  ? {
                                                        ...p,
                                                        answered_current: true,
                                                    }
                                                  : p
                                          ),
                                  }
                                : null
                        );

                        onPlayerAnswered?.(
                            message.data.player_id,
                            message.data.player_name
                        );
                    }
                    break;

                case "buzzer_winner":
                    if (message.data) {
                        onBuzzerWinner?.(
                            message.data.player_id,
                            message.data.player_name
                        );
                    }
                    break;

                case "correct_answer":
                    if (message.data) {
                        onCorrectAnswer?.(
                            message.data.player_id,
                            message.data.answer
                        );
                    }
                    break;

                case "incorrect_answer":
                    if (message.data) {
                        onIncorrectAnswer?.(
                            message.data.player_id,
                            message.data.answer
                        );
                    }
                    break;

                case "ui_update":
                    onUIUpdate?.(message.data);
                    break;

                case "session_stats":
                    setGameState((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  gameStats: message.data,
                              }
                            : null
                    );
                    break;

                case "error":
                    onErrorCallback?.(message.data?.message || "Unknown error");
                    break;

                case "pong":
                    // Heartbeat response - no action needed
                    break;

                default:
                    console.warn(
                        "Unhandled WebSocket message type:",
                        message.type
                    );
            }
        },
        [
            sessionCode,
            onPlayerJoined,
            onPlayerLeft,
            onGameStarted,
            onGameEnded,
            onQuestionStarted,
            onPlayerAnswered,
            onBuzzerWinner,
            onCorrectAnswer,
            onIncorrectAnswer,
            onUIUpdate,
            onErrorCallback,
        ]
    );

    const {
        isConnected,
        isReconnecting,
        sendMessage,
        connect,
        disconnect,
        submitAnswer,
        pressBuzzer,
        startGame,
        nextQuestion,
        endGame,
        getSessionStats,
    } = useWebSocket(buildWebSocketUrl(), {
        ...websocketOptions,
        clientType,
        playerId,
        playerName,
        playerPhoto,
        onMessage: handleMessage,
        onError: onWebSocketError,
    });

    // Request initial session stats when connected
    useEffect(() => {
        if (isConnected) {
            getSessionStats();
        }
    }, [isConnected, getSessionStats]);

    return {
        isConnected,
        isReconnecting,
        gameState,
        startGame,
        nextQuestion,
        endGame,
        getSessionStats,
        submitAnswer,
        pressBuzzer,
        connect,
        disconnect,
        sendMessage,
    };
};

export default useGameWebSocket;
