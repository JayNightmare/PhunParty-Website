import { useState, useCallback, useEffect, useRef } from "react";
import useWebSocket, {
  PhunPartyWebSocketMessage,
  UseWebSocketOptions,
} from "./useWebSocket";
import { getWebSocketUrl } from "@/lib/api";

export interface GameState {
  sessionCode: string;
  gameType: "trivia" | "buzzer";
  isActive: boolean;
  isStarted?: boolean; // Set to true when game_started message is received
  currentQuestion: any | null;
  connectedPlayers: Player[];
  game_state: any | null;
}

export interface Player {
  player_id: string;
  player_name: string;
  player_photo?: string;
  connected_at?: string;
  player_answered?: boolean;
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
  game_state: GameState | null;

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

  const [game_state, setGameState] = useState<GameState | null>(null);
  const sendMessageRef = useRef<
    ((message: PhunPartyWebSocketMessage) => void) | null
  >(null);

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
          (raw.current_question.question_id || raw.current_question.question)
        ) {
          return raw.current_question;
        }
        return null;
      };

      // Helper to safely merge question fields without losing display_options
      const mergeQuestion = (
        existing: any | null,
        incoming: any | null
      ): any | null => {
        if (!incoming) return existing;
        if (!existing) return incoming;

        // Field-wise merge: only overwrite fields that are explicitly present in incoming
        const merged = { ...existing };

        // Copy all fields from incoming, but preserve critical display fields if incoming lacks them
        Object.keys(incoming).forEach((key) => {
          if (incoming[key] !== undefined && incoming[key] !== null) {
            merged[key] = incoming[key];
          }
        });

        // Ensure display_options and correct_index are never lost
        if (
          existing.display_options &&
          !incoming.display_options &&
          !incoming.options
        ) {
          merged.display_options = existing.display_options;
        }
        if (
          existing.options &&
          !incoming.options &&
          !incoming.display_options
        ) {
          merged.options = existing.options;
        }
        if (
          typeof existing.correct_index === "number" &&
          typeof incoming.correct_index !== "number"
        ) {
          merged.correct_index = existing.correct_index;
        }
        if (existing.answer && !incoming.answer) {
          merged.answer = existing.answer;
        }

        return merged;
      };

      // Helper to merge player lists preserving known names
      const mergePlayers = (
        existing: Player[],
        incoming: Player[]
      ): Player[] => {
        if (!Array.isArray(incoming)) return existing;

        const existingMap = new Map<string, Player>();
        existing.forEach((p) => existingMap.set(p.player_id, p));

        return incoming.map((incomingPlayer) => {
          const existingPlayer = existingMap.get(incomingPlayer.player_id);
          if (!existingPlayer) return incomingPlayer;

          // Merge: prefer incoming data but keep existing name if incoming lacks it
          return {
            ...existingPlayer,
            ...incomingPlayer,
            player_name:
              incomingPlayer.player_name || existingPlayer.player_name,
          };
        });
      };

      switch (message.type) {
        case "new_question": {
          // New question broadcast with shape: { question_id, question, difficulty, display_options, correct_index, ... }
          const q = message.data || {};
          setGameState((prev) => {
            const base: GameState =
              prev ||
              ({
                sessionCode,
                gameType: "trivia",
                isActive: true,
                currentQuestion: null,
                connectedPlayers: [],
                game_state: null,
              } as GameState);
            const mergedQuestion = mergeQuestion(base.currentQuestion, q);
            return {
              ...base,
              isActive: true,
              currentQuestion: mergedQuestion,
              connectedPlayers: base.connectedPlayers.map((p) => ({
                ...p,
                answered_current: false,
              })),
            };
          });
          onQuestionStarted?.(message.data);
          break;
        }
        // New broadcast messages for questions/answers
        case "qa_question": {
          setGameState((prev) => {
            // Backend sends complete question object directly in message.data
            const normalized = message.data;
            if (!prev) {
              return {
                sessionCode,
                gameType: "trivia",
                isActive: true,
                currentQuestion: normalized,
                connectedPlayers: [],
                game_state: null,
              };
            }
            const mergedQuestion = mergeQuestion(
              prev.currentQuestion,
              normalized
            );
            return {
              ...prev,
              isActive: true,
              currentQuestion: mergedQuestion,
              connectedPlayers: prev.connectedPlayers.map((p) => ({
                ...p,
                answered_current: false,
              })),
            };
          });
          onQuestionStarted?.(message.data);
          break;
        }

        case "qa_answer_submitted": {
          // Normalize into player_answered semantics
          const playerId = message.data?.player_id;
          const playerName = message.data?.player_name;
          if (playerId) {
            setGameState((prev) =>
              prev
                ? {
                    ...prev,
                    connectedPlayers: prev.connectedPlayers.map((p) =>
                      p.player_id === playerId
                        ? {
                            ...p,
                            answered_current: true,
                          }
                        : p
                    ),
                  }
                : null
            );
            onPlayerAnswered?.(playerId, playerName);
          }
          break;
        }

        case "qa_update": {
          // Generic broadcast update: may include current_question, players, stats, etc.
          const data = message.data || {};
          const normalizedQuestion = extractQuestion(
            data.current_question || data.question || data
          );

          setGameState((prev) => {
            const base =
              prev ||
              ({
                sessionCode,
                gameType: "trivia",
                isActive: true,
                currentQuestion: null,
                connectedPlayers: [],
                game_state: null,
              } as GameState);

            // Merge player list preserving existing names
            let connectedPlayers = base.connectedPlayers;
            if (Array.isArray(data.players)) {
              const incomingPlayers = data.players.map((pl: any) => ({
                player_id: pl.player_id || pl.id,
                player_name: pl.player_name || pl.name,
                player_photo: pl.player_photo,
                answered_current: pl.answered_current ?? pl.answered ?? false,
                score: pl.score,
              })) as Player[];
              connectedPlayers = mergePlayers(
                base.connectedPlayers,
                incomingPlayers
              );
            }

            const mergedQuestion = mergeQuestion(
              base.currentQuestion,
              normalizedQuestion
            );

            return {
              ...base,
              isActive: data.is_active ?? base.isActive,
              currentQuestion: mergedQuestion,
              connectedPlayers,
              game_state: data.connection_stats ?? base.game_state,
            };
          });

          // Trigger question callback if there's a question in the update
          if (normalizedQuestion) {
            onQuestionStarted?.(normalizedQuestion);
          }
          break;
        }

        case "broadcast_state": {
          // Broad state update; treat similar to qa_update
          const data = message.data || {};
          const normalizedQuestion = extractQuestion(data.current_question);
          setGameState((prev) => {
            const base =
              prev ||
              ({
                sessionCode,
                gameType: "trivia",
                isActive: !!data.is_active,
                currentQuestion: null,
                connectedPlayers: [],
                game_state: null,
              } as GameState);

            // Merge players if provided
            let connectedPlayers = base.connectedPlayers;
            if (Array.isArray(data.players)) {
              const incomingPlayers = data.players.map((pl: any) => ({
                player_id: pl.player_id || pl.id,
                player_name: pl.player_name || pl.name,
                player_photo: pl.player_photo,
                answered_current: pl.answered_current ?? pl.answered ?? false,
                score: pl.score,
              })) as Player[];
              connectedPlayers = mergePlayers(
                base.connectedPlayers,
                incomingPlayers
              );
            }

            const mergedQuestion = mergeQuestion(
              base.currentQuestion,
              normalizedQuestion
            );

            return {
              ...base,
              isActive: data.is_active ?? base.isActive,
              currentQuestion: mergedQuestion,
              connectedPlayers,
              game_state: data.connection_stats ?? base.game_state,
            };
          });

          // Trigger question callback if there's a question in the broadcast
          if (normalizedQuestion) {
            onQuestionStarted?.(normalizedQuestion);
          }
          break;
        }
        case "initial_state":
          if (message.data) {
            const normalizedQuestion = extractQuestion(
              message.data.current_question
            );
            const incomingPlayers = Array.isArray(
              message.data.connected_players
            )
              ? message.data.connected_players
              : [];
            setGameState((prev) => {
              const mergedPlayers = prev
                ? mergePlayers(prev.connectedPlayers, incomingPlayers)
                : incomingPlayers;
              const mergedQuestion = prev
                ? mergeQuestion(prev.currentQuestion, normalizedQuestion)
                : normalizedQuestion;

              return {
                sessionCode: message.data.session_code || sessionCode,
                gameType: message.data.game_state?.game_type || "trivia",
                isActive: message.data.game_state?.is_active || false,
                currentQuestion: mergedQuestion,
                connectedPlayers: mergedPlayers,
                game_state: message.data.connection_stats || null,
              };
            });
          }
          break;

        case "player_joined":
          if (message.data) {
            const player: Player = {
              player_id: message.data.player_id || message.data.id,
              player_name: message.data.player_name,
              player_photo: message.data.player_photo,
              connected_at: message.data.timestamp,
            };

            setGameState((prev) => {
              const base: GameState =
                prev ||
                ({
                  sessionCode,
                  gameType: "trivia",
                  isActive: false,
                  currentQuestion: null,
                  connectedPlayers: [],
                  game_state: null,
                } as GameState);
              // Avoid duplicates by player_id
              const exists = base.connectedPlayers.some(
                (p) => p.player_id === player.player_id
              );
              if (import.meta.env.DEV) {
                console.debug(
                  `[player_joined] ${
                    player.player_name
                  } (exists=${exists}); total=${
                    base.connectedPlayers.length + (exists ? 0 : 1)
                  }`
                );
              }
              return {
                ...base,
                connectedPlayers: exists
                  ? base.connectedPlayers
                  : [...base.connectedPlayers, player],
              };
            });

            onPlayerJoined?.(player);
          }
          break;

        case "player_left":
          if (message.data) {
            setGameState((prev) => {
              const base: GameState =
                prev ||
                ({
                  sessionCode,
                  gameType: "trivia",
                  isActive: false,
                  currentQuestion: null,
                  connectedPlayers: [],
                  game_state: null,
                } as GameState);
              return {
                ...base,
                connectedPlayers: base.connectedPlayers.filter(
                  (p) => p.player_id !== message.data.player_id
                ),
              };
            });

            onPlayerLeft?.(message.data.player_id);
          }
          break;

        case "game_started":
          setGameState((prev) => {
            if (!prev) {
              return {
                sessionCode,
                gameType: "trivia",
                isActive: true,
                currentQuestion: null,
                connectedPlayers: [],
                game_state: null,
                isStarted: true,
              } as GameState;
            }

            // Handle players if provided
            let connectedPlayers = prev.connectedPlayers.map((p) => ({
              ...p,
              answered_current: false,
            }));
            if (message.data?.players && Array.isArray(message.data.players)) {
              const incomingPlayers = message.data.players.map((pl: any) => ({
                player_id: pl.player_id || pl.id,
                player_name: pl.player_name || pl.name,
                player_photo: pl.player_photo,
                answered_current: false,
                score: pl.score,
              })) as Player[];
              connectedPlayers = mergePlayers(
                prev.connectedPlayers,
                incomingPlayers
              ).map((p) => ({ ...p, answered_current: false }));
            }

            // Handle question if provided (backend now sends currentQuestion in game_started)
            let currentQuestion = prev.currentQuestion;
            const questionData =
              message.data?.currentQuestion || message.data?.current_question;

            if (questionData) {
              const normalizedQuestion = extractQuestion(questionData);
              currentQuestion = mergeQuestion(
                prev.currentQuestion,
                normalizedQuestion
              );
            }

            return {
              ...prev,
              isActive: true,
              currentQuestion,
              connectedPlayers,
              isStarted: true,
            } as any;
          });

          // Only call onGameStarted - do NOT call onQuestionStarted yet
          // The question will be shown when question_started arrives AFTER the intro
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
            // Backend sends complete question object directly in message.data
            // Don't extract nested fields - use it as-is
            const normalized = message.data;

            const mergedQuestion = mergeQuestion(
              prev.currentQuestion,
              normalized
            );

            return {
              ...prev,
              isActive: true,
              currentQuestion: mergedQuestion,
              connectedPlayers: prev.connectedPlayers.map((p) => ({
                ...p,
                answered_current: false,
              })),
            };
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
                    connectedPlayers: prev.connectedPlayers.map((p) =>
                      p.player_id === message.data.player_id
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
            onBuzzerWinner?.(message.data.player_id, message.data.player_name);
          }
          break;

        case "correct_answer":
          if (message.data) {
            onCorrectAnswer?.(message.data.player_id, message.data.answer);
          }
          break;

        case "incorrect_answer":
          if (message.data) {
            onIncorrectAnswer?.(message.data.player_id, message.data.answer);
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
                  game_state: message.data,
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

        case "connection_established":
          // Send acknowledgment back to server if required
          if (
            message.data?.requires_ack &&
            message.data?.ws_id &&
            sendMessageRef.current
          ) {
            sendMessageRef.current({
              type: "connection_ack",
              data: {
                ws_id: message.data.ws_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
          break;

        case "roster_update":
          if (message.data?.players && Array.isArray(message.data.players)) {
            const updatedPlayers = message.data.players.map((pl: any) => ({
              player_id: pl.player_id || pl.id,
              player_name: pl.player_name || pl.name,
              player_photo: pl.player_photo,
              connected_at: pl.connected_at,
              answered_current: pl.answered_current || false,
              score: pl.score,
            })) as Player[];

            setGameState((prev) =>
              prev
                ? {
                    ...prev,
                    connectedPlayers: updatedPlayers,
                  }
                : {
                    sessionCode,
                    gameType: "trivia",
                    isActive: false,
                    currentQuestion: null,
                    connectedPlayers: updatedPlayers,
                    game_state: null,
                  }
            );
          }
          break;

        case "game_status_update":
          // Handle game status updates (player counts, question progress, etc.)
          if (message.data) {
            setGameState((prev) => {
              if (!prev) return prev;

              return {
                ...prev,
                game_state: {
                  ...prev.game_state,
                  ...message.data,
                },
              };
            });
          }
          break;

        default:
          console.warn("Unhandled WebSocket message type:", message.type);
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

  // Store sendMessage in ref so handleMessage can use it
  sendMessageRef.current = sendMessage;

  // Request initial session stats when connected
  useEffect(() => {
    if (isConnected) {
      getSessionStats();
    }
  }, [isConnected, getSessionStats]);

  return {
    isConnected,
    isReconnecting,
    game_state,
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
