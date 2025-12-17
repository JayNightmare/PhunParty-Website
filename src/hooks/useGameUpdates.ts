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
    | "buzzer_pressed"
    | "next_question";
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
  game_status: GameStatusResponse | null;
  game_state: GameState | null;
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
  // Request current roster from server
  requestRoster?: () => void;
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
  const [game_status, setGameStatus] = useState<GameStatusResponse | null>(
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
      // Don't manually update connectedPlayers here - it will be updated
      // via the useEffect that watches game_state.connectedPlayers
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
          p.player_id === playerId ? { ...p, answered_current: true } : p
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
    game_state,
    startGame,
    nextQuestion,
    endGame,
    submitAnswer,
    pressBuzzer,
    sendMessage,
    requestRoster,
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
    if (game_state?.connectedPlayers) {
      // Only update if we have players, or if explicitly setting to empty (game ended)
      if (game_state.connectedPlayers.length > 0 || !game_state.isActive) {
        setConnectedPlayers(game_state.connectedPlayers);
      } else {
        console.warn(
          "[useGameUpdates] Skipping empty connectedPlayers update while game is active"
        );
      }
    }
  }, [game_state?.connectedPlayers, game_state?.isActive]);

  // Fallback polling when WebSocket is not available or not connected
  useEffect(() => {
    if (!enableWebSocket || !isConnected) {
      // Start polling
      const startPolling = () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }

        pollIntervalRef.current = setInterval(fetchGameStatus, pollInterval);
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
    game_status,
    game_state,
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
    requestRoster: enableWebSocket ? requestRoster : undefined,
  };
};

export default useGameUpdates;
