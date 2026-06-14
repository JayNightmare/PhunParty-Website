import { useState, useCallback, useEffect, useRef } from "react";
import useWebSocket, {
  PhunPartyWebSocketMessage,
  UseWebSocketOptions,
} from "./useWebSocket";
import { getWebSocketUrl } from "@/lib/api";

export interface GameState {
  sessionCode: string;
  gameType: "trivia" | "buzzer" | "beat_the_clock" | string;
  isActive: boolean;
  isStarted?: boolean; // Set to true when game_started message is received
  phase?:
    | "lobby"
    | "intro_audio"
    | "countdown_pending"
    | "countdown"
    | "question"
    | "ended"
    | string;
  currentQuestion: any | null;
  preloadedQuestion?: any | null;
  introEventId?: string | null;
  countdown?: {
    startAt?: string;
    durationMs?: number;
    questionStartAt?: string;
  } | null;
  connectedPlayers: Player[];
  game_state: any | null;
  serverOffsetMs?: number;
  finalScores?: any;
  fairPlay?: FairPlaySettings;
  removedPlayers?: Player[];
  buzzerState?: BuzzerState | null;
  beatClock?: BeatClockState | null;
}

export interface Player {
  player_id: string;
  roster_player_id?: string;
  player_name: string;
  player_photo?: string;
  connected_at?: string;
  player_answered?: boolean;
  answered_current?: boolean;
  score?: number;
  strike_count?: number;
  max_strikes?: number;
  is_frozen?: boolean;
  frozen_question_id?: string;
  is_kicked?: boolean;
  is_disconnected?: boolean;
  fair_play_reason?: string;
}

export interface FairPlaySettings {
  cheat_detection_enabled: boolean;
  max_cheat_strikes: number;
}

export interface BuzzerState {
  question_id?: string;
  current_buzzer_winner?: string | null;
  current_buzzer_winner_roster_id?: string | null;
  frozen_players?: string[];
  frozen_roster_player_ids?: string[];
  question_active?: boolean;
  server_time_ms?: number;
}

export interface BeatClockState {
  active?: boolean;
  duration_seconds?: number;
  durationSeconds?: number;
  started_at?: string;
  startedAt?: string;
  ends_at?: string;
  endsAt?: string;
  leaderboard?: Array<{
    roster_player_id?: string;
    player_id?: string;
    display_name?: string;
    player_name?: string;
    player_photo_url?: string | null;
    score?: number;
    rank?: number;
  }>;
  server_time_ms?: number;
}

export const getPlayerKey = (
  player: Pick<Player, "player_id" | "roster_player_id"> | null | undefined,
): string => player?.roster_player_id || player?.player_id || "";

const getEventPlayerKey = (data: any): string =>
  data?.roster_player_id || data?.player_key || data?.player_id || data?.id || "";

const isBeatClockGameType = (value?: unknown) => {
  if (!value) return false;
  const compact = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  return compact.includes("beattheclock") || compact.includes("beatclock");
};

export interface UseGameWebSocketOptions extends Omit<
  UseWebSocketOptions,
  "onMessage" | "onError"
> {
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

  // Request current roster from server
  requestRoster: () => void;
}

export const useGameWebSocket = (
  options: UseGameWebSocketOptions,
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
  const serverOffsetMsRef = useRef(0);
  const scheduledQuestionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const updateServerOffset = useCallback((serverTimeMs?: number) => {
    if (typeof serverTimeMs !== "number" || Number.isNaN(serverTimeMs)) return;
    serverOffsetMsRef.current = serverTimeMs - Date.now();
  }, []);

  const estimatedServerNowMs = useCallback(
    () => Date.now() + serverOffsetMsRef.current,
    [],
  );

  const scheduleAtServerTime = useCallback(
    (startAtIso: string | undefined, callback: () => void) => {
      const startAtMs = startAtIso ? Date.parse(startAtIso) : NaN;
      const delayMs = Number.isNaN(startAtMs)
        ? 0
        : Math.max(0, startAtMs - estimatedServerNowMs());

      return setTimeout(callback, delayMs);
    },
    [estimatedServerNowMs],
  );

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
        incoming: any | null,
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

      const getQuestionIdentity = (question: any | null | undefined): string =>
        String(
          question?.question_id ??
            question?.id ??
            question?.prompt ??
            question?.question ??
            "",
        );

      // Helper to merge player lists preserving known names
      const mergePlayers = (
        existing: Player[],
        incoming: Player[],
      ): Player[] => {
        if (!Array.isArray(incoming)) return existing;

        const existingMap = new Map<string, Player>();
        existing.forEach((p) => existingMap.set(getPlayerKey(p), p));

        return incoming.map((incomingPlayer) => {
          const existingPlayer = existingMap.get(getPlayerKey(incomingPlayer));
          if (!existingPlayer) return incomingPlayer;

          // Merge: prefer incoming data but keep existing name if incoming lacks it
          return {
            ...existingPlayer,
            ...incomingPlayer,
            player_name:
              incomingPlayer.player_name || existingPlayer.player_name,
            answered_current: Boolean(
              incomingPlayer.answered_current ||
                existingPlayer.answered_current ||
                incomingPlayer.player_answered ||
                existingPlayer.player_answered,
            ),
            player_answered: Boolean(
              incomingPlayer.player_answered ||
                existingPlayer.player_answered ||
                incomingPlayer.answered_current ||
                existingPlayer.answered_current,
            ),
            is_disconnected: incomingPlayer.is_disconnected ?? false,
            strike_count:
              incomingPlayer.strike_count ?? existingPlayer.strike_count,
            max_strikes: incomingPlayer.max_strikes ?? existingPlayer.max_strikes,
            is_frozen: incomingPlayer.is_frozen ?? existingPlayer.is_frozen,
            frozen_question_id:
              incomingPlayer.frozen_question_id ??
              existingPlayer.frozen_question_id,
            is_kicked: incomingPlayer.is_kicked ?? existingPlayer.is_kicked,
            fair_play_reason:
              incomingPlayer.fair_play_reason ??
              existingPlayer.fair_play_reason,
          };
        });
      };

      const resetPlayersForNewQuestion = (players: Player[]): Player[] =>
        players
          .filter((player) => !player.is_kicked)
          .map((player) => ({
            ...player,
            answered_current: false,
            player_answered: false,
            is_frozen: false,
            frozen_question_id: undefined,
          }));

      const playersFromBeatClockLeaderboard = (
        leaderboard: BeatClockState["leaderboard"],
      ): Player[] =>
        Array.isArray(leaderboard)
          ? leaderboard.map((entry) => ({
              player_id:
                entry.player_id ||
                entry.roster_player_id ||
                entry.display_name ||
                "player",
              roster_player_id: entry.roster_player_id,
              player_name:
                entry.display_name || entry.player_name || "Player",
              player_photo: entry.player_photo_url ?? undefined,
              score: Number(entry.score ?? 0),
            }))
          : [];

      const mergeRemovedPlayers = (
        existing: Player[] | undefined,
        incoming: Player[],
      ): Player[] => {
        const byId = new Map<string, Player>();
        (existing || []).forEach((player) =>
          byId.set(getPlayerKey(player), player),
        );
        incoming.forEach((player) => {
          const playerKey = getPlayerKey(player);
          const old = byId.get(playerKey);
          byId.set(playerKey, {
            ...old,
            ...player,
            is_kicked: true,
            player_name: player.player_name || old?.player_name || player.player_id,
          });
        });
        return Array.from(byId.values());
      };

      const normalizePlayers = (rawPlayers: any[] | undefined): Player[] => {
        if (!Array.isArray(rawPlayers)) return [];

        return rawPlayers.map((pl: any) => ({
          player_id: pl.player_id || pl.id || pl.roster_player_id || pl.player_key,
          roster_player_id:
            pl.roster_player_id || pl.public_player_id || pl.player_key,
          player_name: pl.player_name || pl.name,
          player_photo: pl.player_photo,
          connected_at: pl.connected_at || pl.timestamp,
          answered_current: pl.answered_current ?? pl.answered ?? false,
          score: pl.score,
          strike_count: pl.strike_count ?? pl.fair_play_strikes ?? pl.strikes,
          max_strikes: pl.max_strikes ?? pl.max_cheat_strikes,
          is_frozen: pl.is_frozen ?? pl.frozen_for_question,
          frozen_question_id: pl.frozen_question_id,
          is_kicked: pl.is_kicked ?? pl.kicked ?? pl.removed,
          is_disconnected: pl.is_disconnected ?? pl.disconnected ?? false,
          fair_play_reason: pl.fair_play_reason ?? pl.reason,
        })) as Player[];
      };

      const normalizeFairPlaySettings = (raw: any): FairPlaySettings => ({
        cheat_detection_enabled: Boolean(
          raw?.cheat_detection_enabled ?? raw?.fair_play_enabled ?? false,
        ),
        max_cheat_strikes: Number(
          raw?.max_cheat_strikes ?? raw?.max_strikes ?? 3,
        ),
      });

      const hasFairPlaySettings = (raw: any): boolean =>
        Boolean(
          raw &&
            ("cheat_detection_enabled" in raw ||
              "fair_play_enabled" in raw ||
              "max_cheat_strikes" in raw ||
              "max_strikes" in raw),
        );

      const getStrikeCount = (raw: any): number | undefined =>
        raw?.strike_count ?? raw?.fair_play_strikes ?? raw?.strikes;

      const getMaxStrikes = (raw: any): number | undefined =>
        raw?.max_strikes ?? raw?.max_cheat_strikes ?? raw?.strike_limit;

      const findKnownPlayer = (
        state: GameState,
        playerIdToFind: string,
      ): Player | undefined =>
        state.connectedPlayers.find(
          (player) =>
            getPlayerKey(player) === playerIdToFind ||
            player.player_id === playerIdToFind,
        ) ||
        state.removedPlayers?.find(
          (player) =>
            getPlayerKey(player) === playerIdToFind ||
            player.player_id === playerIdToFind,
        ) ||
        ((getEventPlayerKey(state.game_state?.last_fair_play_event) ===
        playerIdToFind
          ? {
              player_id: playerIdToFind,
              roster_player_id:
                state.game_state.last_fair_play_event.roster_player_id,
              player_name:
                state.game_state.last_fair_play_event.player_name ||
                playerIdToFind,
              strike_count: getStrikeCount(
                state.game_state.last_fair_play_event,
              ),
              max_strikes: getMaxStrikes(state.game_state.last_fair_play_event),
              fair_play_reason:
                state.game_state.last_fair_play_event.reason ||
                state.game_state.last_fair_play_event.fair_play_reason,
            }
          : undefined) as Player | undefined);

      const shouldPreserveRosterDuringFairPlay = (
        state: GameState,
      ): boolean =>
        Boolean(
          state.fairPlay?.cheat_detection_enabled &&
            (state.phase === "question" ||
              state.game_state?.phase === "question" ||
              state.game_state?.game_state === "active" ||
              state.currentQuestion) &&
            state.isActive,
        );

      const preserveMissingFairPlayPlayers = (
        existing: Player[],
        incoming: Player[],
        state: GameState,
      ): Player[] => {
        if (!shouldPreserveRosterDuringFairPlay(state)) return incoming;

        const incomingIds = new Set(incoming.map((player) => getPlayerKey(player)));
        const preserved = existing
          .filter(
            (player) => !player.is_kicked && !incomingIds.has(getPlayerKey(player)),
          )
          .map((player) => ({
            ...player,
            is_disconnected: true,
          }));

        return [...incoming, ...preserved];
      };

      const applyAuthoritativeState = (raw: any) => {
        if (!raw) return;

        const state = raw.authoritative_state ?? raw;
        updateServerOffset(state.server_time_ms ?? raw.server_time_ms);

        const phase =
          state.phase ??
          (state.game_state === "ended"
            ? "ended"
            : state.game_state === "active"
              ? "question"
              : "lobby");
        const rawPlayers =
          raw.connected_players ?? state.connected_players ?? state.players;
        const hasAuthoritativePlayers = Array.isArray(rawPlayers);
        const incomingPlayers = normalizePlayers(rawPlayers);
        const incomingActivePlayers = incomingPlayers.filter(
          (player) => !player.is_kicked,
        );
        const incomingKickedPlayers = incomingPlayers.filter(
          (player) => player.is_kicked,
        );
        const incomingGameType = state.game_type || raw.game_type || "trivia";
        const isBeatClockState =
          isBeatClockGameType(incomingGameType) ||
          isBeatClockGameType(state.game_state?.game_type) ||
          isBeatClockGameType(state.current_question?.game_type);
        const normalizedQuestion =
          phase === "question" && !isBeatClockState
            ? extractQuestion(state.current_question ?? state.question)
            : null;
        const questionStartAt =
          normalizedQuestion?.start_at ??
          state.start_at ??
          state.question_start_at;
        const questionStartAtMs = questionStartAt
          ? Date.parse(questionStartAt)
          : NaN;
        const shouldDelayQuestion =
          phase === "question" &&
          normalizedQuestion &&
          !Number.isNaN(questionStartAtMs) &&
          questionStartAtMs > estimatedServerNowMs();

        if (scheduledQuestionTimeoutRef.current) {
          clearTimeout(scheduledQuestionTimeoutRef.current);
          scheduledQuestionTimeoutRef.current = null;
        }

        setGameState((prev) => {
          const base: GameState =
            prev ||
            ({
              sessionCode: state.session_code || sessionCode,
              gameType: incomingGameType,
              isActive: phase !== "lobby" && phase !== "ended",
              currentQuestion: null,
              connectedPlayers: [],
              game_state: null,
            } as GameState);
          const questionChanged =
            phase === "question" &&
            normalizedQuestion &&
            getQuestionIdentity(base.currentQuestion) !==
              getQuestionIdentity(normalizedQuestion);
          const basePlayers = questionChanged
            ? resetPlayersForNewQuestion(base.connectedPlayers)
            : base.connectedPlayers;

          return {
            ...base,
            sessionCode: state.session_code || raw.session_code || sessionCode,
            gameType: incomingGameType || base.gameType || "trivia",
            phase: shouldDelayQuestion ? "countdown" : phase,
            isActive: phase !== "lobby" && phase !== "ended",
            isStarted: phase === "question" && !shouldDelayQuestion,
            currentQuestion:
              phase === "question" && !shouldDelayQuestion
                ? mergeQuestion(base.currentQuestion, normalizedQuestion)
                : null,
            countdown:
              phase === "countdown" || shouldDelayQuestion
                ? {
                    startAt: state.start_at,
                    durationMs: state.duration_ms,
                    questionStartAt: state.question_start_at ?? questionStartAt,
                  }
                : null,
            connectedPlayers: hasAuthoritativePlayers
              ? preserveMissingFairPlayPlayers(
                  basePlayers,
                  mergePlayers(
                    basePlayers,
                    incomingActivePlayers,
                  ).filter((player) => !player.is_kicked),
                  base,
                )
              : basePlayers,
            removedPlayers: hasAuthoritativePlayers
              ? mergeRemovedPlayers(base.removedPlayers, incomingKickedPlayers)
              : base.removedPlayers,
            game_state: {
              ...(base.game_state || {}),
              ...state,
            },
            beatClock: state.beat_clock ?? (isBeatClockState ? state : base.beatClock) ?? null,
            serverOffsetMs: serverOffsetMsRef.current,
            finalScores:
              state.final_scores ??
              state.finalScores ??
              state.scores ??
              base.finalScores ??
              [],
            fairPlay: hasFairPlaySettings(state)
              ? {
                  ...(base.fairPlay || {
                    cheat_detection_enabled: false,
                    max_cheat_strikes: 3,
                  }),
                  ...normalizeFairPlaySettings(state),
                }
              : base.fairPlay,
          };
        });

        if (phase === "question" && normalizedQuestion) {
          if (shouldDelayQuestion) {
            scheduledQuestionTimeoutRef.current = scheduleAtServerTime(
              questionStartAt,
              () => {
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

                  return {
                    ...base,
                    phase: "question",
                    isActive: true,
                    isStarted: true,
                    currentQuestion: mergeQuestion(
                      base.currentQuestion,
                      normalizedQuestion,
                    ),
                    buzzerState: null,
                    connectedPlayers: resetPlayersForNewQuestion(
                      base.connectedPlayers,
                    ),
                    game_state: {
                      ...(base.game_state || {}),
                      ...state,
                    },
                    serverOffsetMs: serverOffsetMsRef.current,
                  };
                });
                onQuestionStarted?.(normalizedQuestion);
              },
            );
          } else {
            onQuestionStarted?.(normalizedQuestion);
          }
        }
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
              buzzerState: null,
              connectedPlayers: resetPlayersForNewQuestion(
                base.connectedPlayers,
              ),
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
              normalized,
            );
            return {
              ...prev,
              isActive: true,
              currentQuestion: mergedQuestion,
              buzzerState: null,
              connectedPlayers: resetPlayersForNewQuestion(
                prev.connectedPlayers,
              ),
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
                            is_frozen:
                              message.data.answer_status === "frozen"
                                ? true
                                : p.is_frozen,
                            frozen_question_id:
                              message.data.answer_status === "frozen"
                                ? (message.data.question_id ??
                                  p.frozen_question_id)
                                : p.frozen_question_id,
                          }
                        : p,
                    ),
                  }
                : null,
            );
            onPlayerAnswered?.(playerId, playerName);
          }
          break;
        }

        case "qa_update": {
          // Generic broadcast update: may include current_question, players, stats, etc.
          const data = message.data || {};
          const normalizedQuestion = extractQuestion(
            data.current_question || data.question || data,
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
            let removedPlayers = base.removedPlayers;
            if (Array.isArray(data.players)) {
              const incomingPlayers = normalizePlayers(data.players);
              const kickedPlayers = incomingPlayers.filter(
                (player) => player.is_kicked,
              );
              connectedPlayers = mergePlayers(
                base.connectedPlayers,
                incomingPlayers.filter((player) => !player.is_kicked),
              ).filter((player) => !player.is_kicked);
              connectedPlayers = preserveMissingFairPlayPlayers(
                base.connectedPlayers,
                connectedPlayers,
                base,
              );
              removedPlayers = mergeRemovedPlayers(
                base.removedPlayers,
                kickedPlayers,
              );
            }

            const mergedQuestion = mergeQuestion(
              base.currentQuestion,
              normalizedQuestion,
            );

            return {
              ...base,
              isActive: data.is_active ?? base.isActive,
              currentQuestion: mergedQuestion,
              connectedPlayers,
              removedPlayers,
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
            let removedPlayers = base.removedPlayers;
            if (Array.isArray(data.players)) {
              const incomingPlayers = normalizePlayers(data.players);
              const kickedPlayers = incomingPlayers.filter(
                (player) => player.is_kicked,
              );
              connectedPlayers = mergePlayers(
                base.connectedPlayers,
                incomingPlayers.filter((player) => !player.is_kicked),
              ).filter((player) => !player.is_kicked);
              connectedPlayers = preserveMissingFairPlayPlayers(
                base.connectedPlayers,
                connectedPlayers,
                base,
              );
              removedPlayers = mergeRemovedPlayers(
                base.removedPlayers,
                kickedPlayers,
              );
            }

            const mergedQuestion = mergeQuestion(
              base.currentQuestion,
              normalizedQuestion,
            );

            return {
              ...base,
              isActive: data.is_active ?? base.isActive,
              currentQuestion: mergedQuestion,
              connectedPlayers,
              removedPlayers,
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
          applyAuthoritativeState(message.data);
          break;

        case "sync_state":
          applyAuthoritativeState(message.data);
          break;

        case "player_joined":
          if (message.data) {
            const player: Player = {
              player_id:
                message.data.player_id ||
                message.data.id ||
                message.data.roster_player_id,
              roster_player_id: message.data.roster_player_id,
              player_name: message.data.player_name,
              player_photo: message.data.player_photo,
              connected_at: message.data.timestamp,
            };

            if (import.meta.env.DEV) {
              console.debug(
                `[WS] Player joined: ${player.player_name} (${player.player_id})`,
              );
            }

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
                (p) => getPlayerKey(p) === getPlayerKey(player),
              );
              if (import.meta.env.DEV) {
                console.debug(
                  `[player_joined] ${
                    player.player_name
                  } (exists=${exists}); total=${
                    base.connectedPlayers.length + (exists ? 0 : 1)
                  }`,
                );
              }
              return {
                ...base,
                connectedPlayers: exists
                  ? base.connectedPlayers.map((existingPlayer) =>
                      getPlayerKey(existingPlayer) === getPlayerKey(player)
                        ? {
                            ...existingPlayer,
                            ...player,
                            is_disconnected: false,
                          }
                        : existingPlayer,
                    )
                  : [...base.connectedPlayers, player],
              };
            });

            onPlayerJoined?.(player);
          }
          break;

        case "player_left":
          if (message.data) {
            let shouldNotifyPlayerLeft = true;
            const departingPlayerKey = getEventPlayerKey(message.data);
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

              if (shouldPreserveRosterDuringFairPlay(base)) {
                shouldNotifyPlayerLeft = false;
                return {
                  ...base,
                  connectedPlayers: base.connectedPlayers.map((player) =>
                    getPlayerKey(player) === departingPlayerKey
                      ? {
                          ...player,
                          is_disconnected: true,
                        }
                      : player,
                  ),
                  game_state: {
                    ...(base.game_state || {}),
                    last_player_left_suppressed_for_fair_play: message.data,
                  },
                };
              }

              return {
                ...base,
                connectedPlayers: base.connectedPlayers.filter(
                  (p) => getPlayerKey(p) !== departingPlayerKey,
                ),
              };
            });

            if (shouldNotifyPlayerLeft) {
              onPlayerLeft?.(departingPlayerKey);
            }
          }
          break;

        case "game_started":
          setGameState((prev) => {
            const incomingGameType = message.data?.game_type || "trivia";
            const isBeatClock = isBeatClockGameType(incomingGameType);
            const incomingPhase =
              message.data?.phase ?? (isBeatClock ? "question" : "intro_audio");

            if (!prev) {
              return {
                sessionCode,
                gameType: incomingGameType,
                isActive: true,
                currentQuestion: null,
                connectedPlayers: [],
                game_state: message.data?.game_state ?? null,
                phase: incomingPhase,
                introEventId:
                  message.event_id ||
                  message.message_id ||
                  message.data?.event_id ||
                  message.data?.message_id ||
                  message.data?.phase_started_at_ms ||
                  null,
                isStarted: isBeatClock,
                serverOffsetMs: serverOffsetMsRef.current,
                beatClock: isBeatClock ? message.data : null,
              } as GameState;
            }

            // Handle players if provided
            let connectedPlayers = resetPlayersForNewQuestion(
              prev.connectedPlayers,
            );
            if (message.data?.players && Array.isArray(message.data.players)) {
              const incomingPlayers = message.data.players.map((pl: any) => ({
                player_id: pl.player_id || pl.id || pl.roster_player_id,
                roster_player_id: pl.roster_player_id,
                player_name: pl.player_name || pl.name,
                player_photo: pl.player_photo,
                answered_current: false,
                score: pl.score,
              })) as Player[];
              connectedPlayers = resetPlayersForNewQuestion(
                mergePlayers(prev.connectedPlayers, incomingPlayers),
              );
            }

            return {
              ...prev,
              gameType: incomingGameType || prev.gameType,
              phase: incomingPhase,
              introEventId:
                message.event_id ||
                message.message_id ||
                message.data?.event_id ||
                message.data?.message_id ||
                message.data?.phase_started_at_ms ||
                prev.introEventId ||
                null,
              isActive: true,
              currentQuestion: null,
              connectedPlayers,
              isStarted: isBeatClock,
              game_state: message.data?.game_state ?? prev.game_state,
              serverOffsetMs: serverOffsetMsRef.current,
              beatClock: isBeatClock ? message.data : prev.beatClock,
            } as any;
          });

          onGameStarted?.();
          break;

        case "intro_started":
          updateServerOffset(message.data?.server_time_ms);
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

            return {
              ...base,
              gameType: message.data?.game_type || base.gameType,
              phase: "intro_audio",
              introEventId:
                message.event_id ||
                message.message_id ||
                message.data?.event_id ||
                message.data?.message_id ||
                message.data?.phase_started_at_ms ||
                base.introEventId ||
                null,
              isActive: true,
              isStarted: false,
              currentQuestion: null,
              game_state: {
                ...(base.game_state || {}),
                ...message.data,
              },
              serverOffsetMs: serverOffsetMsRef.current,
            };
          });
          break;

        case "intro_skipped":
          updateServerOffset(message.data?.server_time_ms);
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

            return {
              ...base,
              gameType: message.data?.game_type || base.gameType,
              phase: "countdown_pending",
              isActive: true,
              isStarted: false,
              currentQuestion: null,
              game_state: {
                ...(base.game_state || {}),
                ...message.data,
              },
              serverOffsetMs: serverOffsetMsRef.current,
            };
          });
          break;

        case "countdown_started":
          updateServerOffset(message.data?.server_time_ms);
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

            return {
              ...base,
              gameType: message.data?.game_type || base.gameType,
              phase: "countdown",
              isActive: true,
              isStarted: false,
              currentQuestion: null,
              countdown: {
                startAt: message.data?.start_at,
                durationMs: message.data?.duration_ms,
                questionStartAt: message.data?.question_start_at,
              },
              game_state: {
                ...(base.game_state || {}),
                ...message.data,
              },
              serverOffsetMs: serverOffsetMsRef.current,
            };
          });
          onUIUpdate?.({ phase: "countdown", countdown: message.data });
          break;

        case "preload_question":
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

            return {
              ...base,
              preloadedQuestion: message.data,
            };
          });
          break;

        case "game_ended":
          setGameState((prev) =>
            prev
              ? {
                  ...prev,
                  phase: "ended",
                  isActive: false,
                  currentQuestion: null,
                  finalScores:
                    message.data?.final_scores ??
                    message.data?.finalScores ??
                    message.data?.scores ??
                    [],
                }
              : null,
          );
          onGameEnded?.();
          break;

        case "beat_clock_started":
        case "beat_clock_state": {
          updateServerOffset(message.data?.server_time_ms);
          const leaderboardPlayers = playersFromBeatClockLeaderboard(
            message.data?.leaderboard,
          );

          setGameState((prev) => {
            const base: GameState =
              prev ||
              ({
                sessionCode,
                gameType: "beat_the_clock",
                isActive: true,
                currentQuestion: null,
                connectedPlayers: [],
                game_state: null,
              } as GameState);

            return {
              ...base,
              gameType: "beat_the_clock",
              phase: "question",
              isActive: true,
              isStarted: true,
              currentQuestion: null,
              connectedPlayers:
                leaderboardPlayers.length > 0
                  ? mergePlayers(base.connectedPlayers, leaderboardPlayers)
                  : base.connectedPlayers,
              beatClock: {
                ...(base.beatClock || {}),
                ...(message.data || {}),
                active:
                  message.type === "beat_clock_started"
                    ? true
                    : (message.data?.active ?? base.beatClock?.active),
              },
              game_state: {
                ...(base.game_state || {}),
                beat_clock: message.data,
              },
              serverOffsetMs: serverOffsetMsRef.current,
            };
          });
          onUIUpdate?.({ type: message.type, ...message.data });
          break;
        }

        case "beat_clock_question":
          updateServerOffset(message.data?.server_time_ms);
          setGameState((prev) => {
            const base: GameState =
              prev ||
              ({
                sessionCode,
                gameType: "beat_the_clock",
                isActive: true,
                currentQuestion: null,
                connectedPlayers: [],
                game_state: null,
              } as GameState);

            return {
              ...base,
              gameType: "beat_the_clock",
              phase: "question",
              isActive: true,
              isStarted: true,
              currentQuestion: mergeQuestion(base.currentQuestion, message.data),
              game_state: {
                ...(base.game_state || {}),
                ...message.data,
              },
              beatClock: {
                ...(base.beatClock || {}),
                duration_seconds: message.data?.duration_seconds,
                ends_at: message.data?.ends_at,
                started_at: message.data?.started_at,
              },
              serverOffsetMs: serverOffsetMsRef.current,
            };
          });
          onQuestionStarted?.(message.data);
          break;

        case "question_started":
          updateServerOffset(message.data?.server_time_ms);
          if (scheduledQuestionTimeoutRef.current) {
            clearTimeout(scheduledQuestionTimeoutRef.current);
          }
          scheduledQuestionTimeoutRef.current = scheduleAtServerTime(
            message.data?.start_at,
            () => {
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
                const normalized = message.data;
                const mergedQuestion = mergeQuestion(
                  base.currentQuestion,
                  normalized,
                );

                return {
                  ...base,
                  phase: "question",
                  isActive: true,
                  isStarted: true,
                  currentQuestion: mergedQuestion,
                  buzzerState: null,
                  connectedPlayers: resetPlayersForNewQuestion(
                    base.connectedPlayers,
                  ),
                  game_state: {
                    ...(base.game_state || {}),
                    ...message.data,
                  },
                  serverOffsetMs: serverOffsetMsRef.current,
                };
              });
              onQuestionStarted?.(message.data);
            },
          );
          break;

        case "player_answered":
          if (message.data) {
            const answeredPlayerKey = getEventPlayerKey(message.data);
            // Update player as having answered current question
            setGameState((prev) =>
              prev
                ? {
                    ...prev,
                    connectedPlayers: prev.connectedPlayers.map((p) =>
                      getPlayerKey(p) === answeredPlayerKey
                        ? {
                            ...p,
                            answered_current: true,
                            is_frozen:
                              message.data.answer_status === "frozen"
                                ? true
                                : p.is_frozen,
                            frozen_question_id:
                              message.data.answer_status === "frozen"
                                ? (message.data.question_id ??
                                  p.frozen_question_id)
                                : p.frozen_question_id,
                          }
                        : p,
                    ),
                  }
                : null,
            );

            onPlayerAnswered?.(
              answeredPlayerKey,
              message.data.player_name,
            );
          }
          break;

        case "buzzer_winner":
          if (message.data) {
            onBuzzerWinner?.(
              getEventPlayerKey(message.data),
              message.data.player_name,
            );
          }
          break;

        case "buzzer_state_update":
          updateServerOffset(message.data?.server_time_ms);
          setGameState((prev) => {
            const base: GameState =
              prev ||
              ({
                sessionCode,
                gameType: "buzzer",
                isActive: true,
                currentQuestion: null,
                connectedPlayers: [],
                game_state: null,
              } as GameState);

            const buzzerState: BuzzerState = {
              question_id: message.data?.question_id,
              current_buzzer_winner:
                message.data?.current_buzzer_winner ?? null,
              current_buzzer_winner_roster_id:
                message.data?.current_buzzer_winner_roster_id ?? null,
              frozen_players: Array.isArray(message.data?.frozen_players)
                ? message.data.frozen_players
                : [],
              frozen_roster_player_ids: Array.isArray(
                message.data?.frozen_roster_player_ids,
              )
                ? message.data.frozen_roster_player_ids
                : [],
              question_active: Boolean(message.data?.question_active),
              server_time_ms: message.data?.server_time_ms,
            };

            return {
              ...base,
              gameType: "buzzer",
              buzzerState,
              game_state: {
                ...(base.game_state || {}),
                buzzer_state: buzzerState,
              },
              serverOffsetMs: serverOffsetMsRef.current,
            };
          });
          onUIUpdate?.({ type: "buzzer_state_update", ...message.data });
          break;

        case "correct_answer":
          if (message.data) {
            onCorrectAnswer?.(getEventPlayerKey(message.data), message.data.answer);
          }
          break;

        case "incorrect_answer":
          if (message.data) {
            onIncorrectAnswer?.(
              getEventPlayerKey(message.data),
              message.data.answer,
            );
          }
          break;

        case "ui_update":
          onUIUpdate?.(message.data);
          break;

        case "fair_play_settings_updated":
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
              fairPlay: normalizeFairPlaySettings(message.data),
              game_state: {
                ...(base.game_state || {}),
                ...message.data,
              },
            };
          });
          break;

        case "fair_play_status_update":
        case "player_flagged":
          if (getEventPlayerKey(message.data)) {
            const flaggedPlayerKey = getEventPlayerKey(message.data);
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
              const strikeCount = getStrikeCount(message.data);
              const maxStrikes =
                getMaxStrikes(message.data) ??
                base.fairPlay?.max_cheat_strikes;
              const isKicked = Boolean(message.data.is_kicked);
              const knownPlayer: Player = findKnownPlayer(
                base,
                flaggedPlayerKey,
              ) || {
                player_id: message.data.player_id || flaggedPlayerKey,
                roster_player_id: message.data.roster_player_id,
                player_name:
                  message.data.player_name || flaggedPlayerKey,
              };
              const updatedPlayer: Player = {
                ...knownPlayer,
                player_id: message.data.player_id || flaggedPlayerKey,
                roster_player_id:
                  message.data.roster_player_id || knownPlayer.roster_player_id,
                player_name:
                  message.data.player_name ||
                  knownPlayer.player_name ||
                  flaggedPlayerKey,
                strike_count: strikeCount ?? knownPlayer.strike_count,
                max_strikes: maxStrikes ?? knownPlayer.max_strikes,
                is_frozen:
                  message.type === "player_flagged"
                    ? true
                    : (message.data.is_frozen ??
                      message.data.frozen_for_question ??
                      knownPlayer.is_frozen),
                frozen_question_id:
                  message.data.frozen_question_id ??
                  message.data.question_id ??
                  knownPlayer.frozen_question_id,
                is_kicked: isKicked || knownPlayer.is_kicked,
                fair_play_reason:
                  message.data.reason ??
                  message.data.fair_play_reason ??
                  knownPlayer.fair_play_reason,
              };
              const playerAlreadyVisible = base.connectedPlayers.some(
                (player) => getPlayerKey(player) === flaggedPlayerKey,
              );

              return {
                ...base,
                connectedPlayers: isKicked
                  ? base.connectedPlayers.filter(
                      (player) => getPlayerKey(player) !== flaggedPlayerKey,
                    )
                  : playerAlreadyVisible
                    ? base.connectedPlayers.map((player) =>
                        getPlayerKey(player) === flaggedPlayerKey
                          ? updatedPlayer
                          : player,
                      )
                    : [...base.connectedPlayers, updatedPlayer],
                removedPlayers: isKicked
                  ? mergeRemovedPlayers(base.removedPlayers, [updatedPlayer])
                  : base.removedPlayers,
                game_state: {
                  ...(base.game_state || {}),
                  last_fair_play_event: message.data,
                },
              };
            });
          }
          break;

        case "player_kicked":
          if (getEventPlayerKey(message.data)) {
            const kickedPlayerKey = getEventPlayerKey(message.data);
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

              const kickedSelf = message.data.player_id === playerId;
              const kickedPlayer =
                findKnownPlayer(base, kickedPlayerKey) ||
                ({
                  player_id: message.data.player_id || kickedPlayerKey,
                  roster_player_id: message.data.roster_player_id,
                  player_name:
                    message.data.player_name || kickedPlayerKey,
                } as Player);

              return {
                ...base,
                connectedPlayers: base.connectedPlayers.filter(
                  (player) => getPlayerKey(player) !== kickedPlayerKey,
                ),
                removedPlayers: mergeRemovedPlayers(base.removedPlayers, [
                  {
                    ...kickedPlayer,
                    strike_count:
                      getStrikeCount(message.data) ??
                      kickedPlayer.strike_count,
                    max_strikes:
                      getMaxStrikes(message.data) ?? kickedPlayer.max_strikes,
                    is_kicked: true,
                    fair_play_reason:
                      message.data.reason ?? kickedPlayer.fair_play_reason,
                  },
                ]),
                game_state: {
                  ...(base.game_state || {}),
                  last_fair_play_event: message.data,
                  ...(kickedSelf
                    ? {
                        kicked_from_session: {
                          reason:
                            message.data.reason ?? "fair_play_strikes",
                          message:
                            message.data.message ??
                            "You were removed after reaching the Fair Play strike limit.",
                        },
                      }
                    : {}),
                },
              };
            });
          }
          break;

        case "kicked_from_session":
          setGameState((prev) =>
            prev
              ? {
                  ...prev,
                  game_state: {
                    ...(prev.game_state || {}),
                    kicked_from_session: message.data,
                  },
                }
              : prev,
          );
          break;

        case "answer_rejected":
          setGameState((prev) => {
            if (!prev) return prev;

            const isFairPlayRestriction =
              message.data?.reason === "fair_play_restriction";

            return {
              ...prev,
              connectedPlayers:
                isFairPlayRestriction && playerId
                  ? prev.connectedPlayers.map((player) =>
                      player.player_id === playerId
                        ? {
                            ...player,
                            is_frozen: true,
                            answered_current: true,
                            frozen_question_id:
                              message.data?.question_id ??
                              player.frozen_question_id,
                            fair_play_reason:
                              message.data?.reason ??
                              player.fair_play_reason,
                          }
                        : player,
                    )
                  : prev.connectedPlayers,
              game_state: {
                ...(prev.game_state || {}),
                answer_rejected: message.data,
                ...(isFairPlayRestriction
                  ? { last_fair_play_event: message.data }
                  : {}),
              },
            };
          });
          break;

        case "session_stats":
          setGameState((prev) =>
            prev
              ? {
                  ...prev,
                  game_state: message.data,
                }
              : null,
          );
          break;

        case "error":
          onErrorCallback?.(message.data?.message || "Unknown error");
          break;

        case "pong":
          updateServerOffset(message.serverTime ?? message.data?.serverTime);
          break;

        case "connection_established":
          updateServerOffset(message.data?.server_time_ms);
          break;

        case "roster_update":
          {
            const rosterPayload =
              message.data?.players ??
              message.data?.connected_players ??
              message.data?.mobile_players ??
              message.data?.roster;
            const rawPlayers = Array.isArray(rosterPayload)
              ? rosterPayload
              : (rosterPayload?.connected_players ??
                rosterPayload?.mobile_players ??
                rosterPayload?.players ??
                rosterPayload?.list);

            if (!Array.isArray(rawPlayers)) {
              break;
            }

            const updatedPlayers = normalizePlayers(rawPlayers);
            const activePlayers = updatedPlayers.filter(
              (player) => !player.is_kicked,
            );
            const kickedPlayers = updatedPlayers.filter(
              (player) => player.is_kicked,
            );

            if (import.meta.env.DEV) {
              console.debug(
                `[roster_update] Received ${updatedPlayers.length} players:`,
                updatedPlayers.map((p) => p.player_name).join(", "),
              );
            }

            setGameState((prev) =>
              prev
                ? {
                    ...prev,
                    connectedPlayers: preserveMissingFairPlayPlayers(
                      prev.connectedPlayers,
                      mergePlayers(
                        prev.connectedPlayers,
                        activePlayers,
                      ).filter((player) => !player.is_kicked),
                      prev,
                    ),
                    removedPlayers: mergeRemovedPlayers(
                      prev.removedPlayers,
                      kickedPlayers,
                    ),
                    game_state: {
                      ...(prev.game_state || {}),
                      ...message.data,
                    },
                  }
                : {
                    sessionCode,
                    gameType: "trivia",
                    isActive: false,
                    currentQuestion: null,
                    connectedPlayers: activePlayers,
                    removedPlayers: mergeRemovedPlayers([], kickedPlayers),
                    game_state: message.data ?? null,
                  },
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
      playerId,
      updateServerOffset,
      scheduleAtServerTime,
      estimatedServerNowMs,
    ],
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

  useEffect(() => {
    return () => {
      if (scheduledQuestionTimeoutRef.current) {
        clearTimeout(scheduledQuestionTimeoutRef.current);
      }
    };
  }, []);

  // Request initial session stats when connected
  useEffect(() => {
    if (isConnected) {
      getSessionStats();
    }
  }, [isConnected, getSessionStats]);

  // Request current roster function
  const requestRoster = useCallback(() => {
    if (isConnected) {
      sendMessage({ type: "request_roster", data: {} });
    }
  }, [isConnected, sendMessage]);

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
    requestRoster,
  };
};

export default useGameWebSocket;
