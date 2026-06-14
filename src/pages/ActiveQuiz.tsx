import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useCallback, useState, useEffect, useRef } from "react";
import { Question, MCQOption } from "@/types";
import { Player, getPlayerKey } from "@/hooks/useGameWebSocket";

import Card from "@/components/Card";
import {
  GameStatusResponse,
  getCurrentQuestion,
  pauseGame,
  resumeGame,
  previousQuestion,
  endGame,
} from "@/lib/api";
import Timer from "@/components/Timer";
import useGameUpdates from "@/hooks/useGameUpdates";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import { LoadingState } from "@/components/Loading";
import GameControls from "@/components/GameControls";
import GameStateIndicator from "@/components/GameStateIndicator";
import { useToast } from "@/contexts/ToastContext";
import { useTouchGestures } from "@/hooks/useTouchGestures";
import { useWebSocketGameControls } from "@/hooks/useWebSocketGameControls";
import WebSocketStatus from "@/components/WebSocketStatus";
import WebSocketDiagnostics from "@/components/WebSocketDiagnostics";

const COUNTDOWN_DURATION_MS = 3000;
const MAX_COUNTDOWN_SECONDS = COUNTDOWN_DURATION_MS / 1000;
const QUESTION_TIMER_MS = 30000;

export default function ActiveQuiz() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<Question | null>(null);
  // Local fallback for players; primary source should be WS `connectedPlayers`
  const [players, setPlayers] = useState<Player[]>([]);
  const [game_state, setGameState] = useState<
    "waiting" | "active" | "paused" | "ended"
  >("waiting");
  const { showSuccess, showError } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [introMode, setIntroMode] = useState(false); // whether we're in tutorial phase
  const [countdown, setCountdown] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRecoveryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownCompleteSentRef = useRef(false);
  const sendMessageRef = useRef<((message: any) => void) | undefined>(undefined);
  const introCompleteSentRef = useRef(false);
  const playedIntroRef = useRef<string | null>(null);
  const hasNavigatedToStats = useRef(false);
  const [skipIntroSent, setSkipIntroSent] = useState(false);
  // Timer duration based on difficulty – must be declared before any conditional returns
  const [timerMs, setTimerMs] = useState<number | undefined>(undefined);

  // Use the new real-time game updates hook
  const {
    game_status: game_status,
    game_state: wsGameState,
    isConnected,
    isLoading: loading,
    error,
    lastUpdate,
    refetch,
    connectedPlayers,
    sendMessage,
  } = useGameUpdates({
    sessionCode: sessionId || "",
    enableWebSocket: true,
    pollInterval: 3000, // Fallback polling
  });

  // WebSocket game controls for real-time game management
  const wsGameControls = useWebSocketGameControls({
    sendMessage: sendMessage || (() => {}),
    isConnected: isConnected,
  });

  const serverPhase = (wsGameState as any)?.phase as string | undefined;
  const serverCountdown = (wsGameState as any)?.countdown;
  const serverOffsetMs = (wsGameState as any)?.serverOffsetMs || 0;
  const wsQuestion = (wsGameState as any)?.currentQuestion;
  const wsGameMetadata = (wsGameState as any)?.game_state;
  const wsGameType = String((wsGameState as any)?.gameType || "").toLowerCase();
  const isBeatClock = wsGameType === "beat_the_clock";
  const beatClockState =
    (wsGameState as any)?.beatClock || wsGameMetadata?.beat_clock || null;
  const beatClockEndsAt =
    beatClockState?.ends_at ?? beatClockState?.endsAt ?? null;
  const questionEndsAt =
    wsQuestion?.question_ends_at ??
    wsQuestion?.question_end_at ??
    wsQuestion?.ends_at ??
    wsQuestion?.end_at ??
    wsQuestion?.expires_at ??
    wsGameMetadata?.question_ends_at ??
    wsGameMetadata?.question_end_at ??
    wsGameMetadata?.ends_at ??
    wsGameMetadata?.end_at ??
    wsGameMetadata?.expires_at ??
    null;
  const introEventId = (wsGameState as any)?.introEventId as
    | string
    | null
    | undefined;

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);
  const hasProtocolState = Boolean(serverPhase);
  const questionIsVisible = hasProtocolState
    ? serverPhase === "question" && !isBeatClock
    : !!game_status?.isstarted;

  // Touch gestures for swipe navigation and pull-to-refresh
  const { attachGestures, isRefreshing: gestureRefreshing } = useTouchGestures({
    onSwipeLeft: async () => {
      if (
        game_status &&
        sessionId &&
        typeof game_status.current_question_index === "number" &&
        game_status.current_question_index <
          (game_status.total_questions || 1) - 1
      ) {
        try {
          wsGameControls.nextQuestion();
          showSuccess("Moving to next question...");
        } catch (err) {
          showError("Failed to move to next question");
        }
      }
    },
    onSwipeRight: async () => {
      if (
        game_status &&
        sessionId &&
        typeof game_status.current_question_index === "number" &&
        game_status.current_question_index > 0
      ) {
        try {
          await previousQuestion({ session_code: sessionId });
          showSuccess("Moved to previous question");
        } catch (err) {
          showError("Failed to move to previous question");
        }
      }
    },
    onPullToRefresh: async () => {
      setIsRefreshing(true);
      try {
        await refetch();
        showSuccess("Game status refreshed");
      } finally {
        setIsRefreshing(false);
      }
    },
    threshold: 80,
  });

  // Attach gestures to container
  useEffect(() => {
    const cleanup = attachGestures(containerRef.current);
    return cleanup;
  }, [attachGestures]);

  // Keep timer in sync with question difficulty. Easy has no timer; timed
  // modes show the full question window while the backend owns progression.
  useEffect(() => {
    const diff = (question?.difficulty || "Easy") as any;
    const norm = typeof diff === "string" ? diff.toLowerCase() : "easy";
    if (norm === "medium" || norm === "hard") setTimerMs(QUESTION_TIMER_MS);
    else setTimerMs(undefined);
  }, [question?.difficulty]);

  // Determine if intro should run (query param intro=1 on first load)
  useEffect(() => {
    if (location.search.includes("intro=1")) {
      setIntroMode(true);
    }
  }, [location.search]);

  useEffect(() => {
    setSkipIntroSent(false);
  }, [introEventId]);

  useEffect(() => {
    if (!serverPhase) return;

    if (isBeatClock) {
      setIntroMode(false);
      return;
    }

    if (
      serverPhase === "intro_audio" ||
      serverPhase === "countdown_pending" ||
      serverPhase === "countdown"
    ) {
      setIntroMode(true);
      return;
    }

    setIntroMode(false);
  }, [isBeatClock, serverPhase]);

  const sendIntroComplete = useCallback(() => {
    if (introCompleteSentRef.current || !sendMessage || !isConnected) return;

    introCompleteSentRef.current = true;

    sendMessage({
      type: "intro_complete",
      data: {
        duration_ms: COUNTDOWN_DURATION_MS,
      },
    });
  }, [isConnected, sendMessage]);

  // Handle intro audio playback only when the backend starts the intro phase.
  useEffect(() => {
    if (serverPhase !== "intro_audio") return;

    const introKey = introEventId || `${sessionId}:intro_audio`;
    if (playedIntroRef.current === introKey) return;
    playedIntroRef.current = introKey;
    introCompleteSentRef.current = false;

    let audio = audioRef.current;

    if (!audio) {
      audio = new Audio("/audio/tutorial_voiceline1.mp3");
      audioRef.current = audio;
    }

    audio.currentTime = 0;

    audio.onended = () => {
      sendIntroComplete();
    };

    audio.play().catch((err) => {
      console.warn(
        "Intro audio failed to autoplay, waiting for user interaction.",
        err,
      );
    });

    return () => {
      audio.onended = null;
    };
  }, [serverPhase, introEventId, sessionId, sendIntroComplete]);

  // Countdown display follows the backend's question_start_at timestamp.
  useEffect(() => {
    if (serverPhase !== "countdown" || !serverCountdown?.questionStartAt) {
      setCountdown(null);
      countdownCompleteSentRef.current = false;
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (countdownRecoveryRef.current) {
        clearTimeout(countdownRecoveryRef.current);
        countdownRecoveryRef.current = null;
      }
      return;
    }

    countdownCompleteSentRef.current = false;

    const sendCountdownComplete = () => {
      if (countdownCompleteSentRef.current) return;
      countdownCompleteSentRef.current = true;
      sendMessageRef.current?.({
        type: "countdown_complete",
        data: {
          question_start_at: serverCountdown.questionStartAt,
        },
      });
    };

    const updateCountdown = () => {
      const questionStartAtMs = Date.parse(serverCountdown.questionStartAt);
      const remainingMs = Math.max(
        0,
        Number.isNaN(questionStartAtMs)
          ? serverCountdown.durationMs ?? COUNTDOWN_DURATION_MS
          : questionStartAtMs - (Date.now() + serverOffsetMs),
      );
      const displayNumber =
        remainingMs > 0
          ? Math.max(
              1,
              Math.min(MAX_COUNTDOWN_SECONDS, Math.ceil(remainingMs / 1000)),
            )
          : 0;
      setCountdown(displayNumber);

      if (remainingMs <= 0) {
        sendCountdownComplete();
      }
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 200);
    countdownRecoveryRef.current = setTimeout(
      sendCountdownComplete,
      (serverCountdown.durationMs ?? COUNTDOWN_DURATION_MS) + 2000,
    );

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (countdownRecoveryRef.current) {
        clearTimeout(countdownRecoveryRef.current);
        countdownRecoveryRef.current = null;
      }
    };
  }, [
    serverPhase,
    serverCountdown?.durationMs,
    serverCountdown?.questionStartAt,
    serverOffsetMs,
  ]);

  // Process game status updates
  useEffect(() => {
    if (!game_status) return;

    // Determine game state
    if (serverPhase) {
      switch (serverPhase) {
        case "ended":
          setGameState("ended");
          break;
        case "question":
        case "countdown":
        case "countdown_pending":
          setGameState("active");
          break;
        case "intro_audio":
        case "lobby":
        default:
          setGameState("waiting");
          break;
      }
    } else if (introMode) {
      setGameState(countdown !== null ? "active" : "waiting");
    } else if (game_status.game_state) {
      // Map API state to component state
      switch (game_status.game_state) {
        case "active":
          setGameState("active");
          break;
        case "waiting":
          setGameState("waiting");
          break;
        case "ended":
          setGameState("ended");
          break;
        default:
          setGameState("ended");
      }
    } else {
      // Default to active if no explicit state but a current question exists
      setGameState(game_status.current_question ? "active" : "waiting");
    }

    if (isBeatClock) {
      setQuestion(null);
      if (connectedPlayers && connectedPlayers.length > 0) {
        setPlayers(connectedPlayers);
      }
      return;
    }

    // Prefer WebSocket currentQuestion when available
    const wsQ = wsQuestion;

    const shouldProcessWSQuestion = wsQ && questionIsVisible;

    if (shouldProcessWSQuestion) {
      const prompt = wsQ.question || wsQ.prompt || "";
      const id = wsQ.question_id || wsQ.id || prompt;
      const rawOptions = wsQ.display_options ?? wsQ.options ?? null;
      const uiMode = wsQ.ui_mode; // Get ui_mode from backend

      const mcqOptions: MCQOption[] = (() => {
        if (!rawOptions) return [];

        if (Array.isArray(rawOptions)) {
          return rawOptions
            .map((opt: any, index: number) => {
              if (typeof opt === "string") {
                return { id: `option_${index}`, text: opt };
              }
              if (opt && typeof opt === "object") {
                return {
                  id: (
                    opt.id ??
                    opt.option_id ??
                    opt.key ??
                    `option_${index}`
                  ).toString(),
                  text:
                    opt.text ?? opt.label ?? opt.option_text ?? opt.value ?? "",
                };
              }
              return null;
            })
            .filter((opt): opt is MCQOption => Boolean(opt?.text));
        }

        if (typeof rawOptions === "object") {
          return Object.entries(rawOptions as Record<string, any>).map(
            ([key, value], index) => ({
              id: (key || `option_${index}`).toString(),
              text:
                typeof value === "string"
                  ? value
                  : value && typeof value === "object"
                    ? (value.text ??
                      value.label ??
                      value.option_text ??
                      value.value ??
                      "")
                    : String(value ?? ""),
            }),
          );
        }

        return [];
      })();

      const rawDiff: string = wsQ.difficulty || "Easy";
      const difficulty = (
        rawDiff
          ? rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase()
          : "Easy"
      ) as Question["difficulty"];
      const correctIndex: number | undefined = wsQ.correct_index;

      // Build a simple displayOptions array from mcqOptions (texts only) so we can safely index into it.
      const displayOptions: string[] = mcqOptions.map((opt) => opt.text);

      const answerText =
        typeof correctIndex === "number" && Array.isArray(displayOptions)
          ? (displayOptions[correctIndex] ?? "")
          : wsQ.answer || "";

      // Determine type based on ui_mode if available, otherwise check if options exist
      let questionType: "mcq" | "free";
      if (uiMode === "multiple_choice") {
        questionType = "mcq";
      } else if (uiMode === "text_input" || uiMode === "free_text") {
        questionType = "free";
      } else {
        // Fallback: determine by options existence
        questionType = mcqOptions.length > 0 ? "mcq" : "free";
      }

      const finalQuestion = {
        id,
        type: questionType,
        prompt,
        options: questionType === "mcq" ? mcqOptions : undefined,
        answer: answerText,
        genre: wsQ.genre || undefined,
        difficulty,
        uiMode,
        acceptedAnswers: Array.isArray(wsQ.accepted_answers)
          ? wsQ.accepted_answers
          : [],
      };

      setQuestion(finalQuestion);
    } else {
      // Fallback to fetching current question via REST
      const fetchCurrentQuestion = async () => {
        if (!sessionId || !questionIsVisible) {
          setQuestion(null);
          return;
        }
        try {
          const currentQuestion = await getCurrentQuestion(sessionId);
          if (currentQuestion) {
            const mcqOptions =
              currentQuestion.options?.map((option, index) => ({
                id: `option_${index}`,
                text: option,
              })) || [];
            setQuestion({
              id: currentQuestion.id,
              type:
                currentQuestion.ui_mode === "text_input" ||
                currentQuestion.ui_mode === "free_text"
                  ? "free"
                  : mcqOptions.length > 0
                    ? "mcq"
                    : "free",
              prompt: currentQuestion.prompt || "",
              options: mcqOptions,
              answer: currentQuestion.answer || "",
              genre: currentQuestion.genre || undefined,
              difficulty:
                (currentQuestion.difficulty as Question["difficulty"]) ||
                undefined,
              uiMode: currentQuestion.ui_mode,
              acceptedAnswers: currentQuestion.accepted_answers,
            });
          } else {
            setQuestion(null);
          }
        } catch (error) {
          console.error("Failed to fetch current question:", error);
          setQuestion(null);
          setGameState("ended");
          navigate(`/stats/${sessionId}/`);
        }
      };
      fetchCurrentQuestion();
    }

    // Prefer WebSocket-connected players; fallback to any list the API provides
    if (connectedPlayers && connectedPlayers.length > 0) {
      setPlayers(connectedPlayers);
    } else if (game_status.players) {
      const playerList: Player[] = [];
      if (Array.isArray(game_status.players)) {
        game_status.players.forEach((player: any) => {
          playerList.push({
            player_id: player.player_id || player.id || player.roster_player_id,
            roster_player_id: player.roster_player_id,
            player_name: player.player_name || player.name,
            player_photo: player.player_photo || player.photo,
            connected_at: player.connected_at || null,
          });
        });
      } else if (typeof game_status.players === "object") {
        // Handle object format: {total: number, list: array}
        const playersObj = game_status.players as any;
        if (playersObj.list && Array.isArray(playersObj.list)) {
          playersObj.list.forEach((player: any) => {
            playerList.push({
              player_id: player.player_id || player.id || player.roster_player_id,
              roster_player_id: player.roster_player_id,
              player_name: player.player_name || player.name,
              player_photo: player.player_photo || player.photo,
              connected_at: player.connected_at || null,
            });
          });
        }
      }
      setPlayers(playerList);
    }
  }, [
    game_status,
    wsGameState,
    wsQuestion,
    connectedPlayers,
    serverPhase,
    introMode,
    countdown,
    questionIsVisible,
    isBeatClock,
    sessionId,
    navigate,
  ]);

  // Automatically navigate to stats page when the game completes
  useEffect(() => {
    if (!sessionId) return;

    if (serverPhase === "ended" || game_status?.game_state === "ended") {
      if (!hasNavigatedToStats.current) {
        hasNavigatedToStats.current = true;
        navigate(`/stats/${sessionId}/`, { replace: true });
      }
    } else {
      hasNavigatedToStats.current = false;
    }
  }, [game_status?.game_state, navigate, serverPhase, sessionId]);

  // Game Control Handlers
  const handlePause = async () => {
    if (!sessionId) return;
    try {
      await pauseGame({ session_code: sessionId });
      showSuccess("Game paused successfully");
      await refetch();
    } catch (error) {
      showError("Failed to pause game");
    }
  };

  const handleResume = async () => {
    if (!sessionId) return;
    try {
      await resumeGame({ session_code: sessionId });
      showSuccess("Game resumed successfully");
      await refetch();
    } catch (error) {
      showError("Failed to resume game");
    }
  };

  const handleNextQuestion = async () => {
    if (!sessionId) return;
    try {
      wsGameControls.nextQuestion();
      setQuestion(null);
      showSuccess("Moving to next question...");
    } catch (error) {
      showError("Failed to go to next question");
    }
  };

  const handlePreviousQuestion = async () => {
    if (!sessionId) return;
    try {
      const response = await previousQuestion({
        session_code: sessionId,
      });
      if (response.success) {
        showSuccess("Moved to previous question");
        await refetch();
      }
    } catch (error) {
      showError("Failed to go to previous question");
    }
  };

  const handleEndGame = async () => {
    if (!sessionId) return;
    try {
      if (isConnected && wsGameControls) {
        wsGameControls.endGame();
        showSuccess("Ending game...");
      } else {
        const response = await endGame({ session_code: sessionId });
        if (response.success) {
          setGameState("ended");
          showSuccess("Game ended successfully");
          await refetch();
          navigate(`/stats/${sessionId}/`);
        }
      }
    } catch (error) {
      showError("Failed to end game");
      setGameState("ended");
      navigate(`/stats/${sessionId}/`);
    }
  };

  if (!game_status && loading && !introMode) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Card className="p-6">
          <LoadingState message="Loading quiz session..." />
        </Card>
      </main>
    );
  }

  if (!game_status && !introMode)
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-center text-stone-400">
            Session not found or failed to load.
            <div className="mt-4">
              <button
                type="button"
                onClick={refetch}
                className="px-4 py-2 bg-tea-500 text-ink-900 rounded-xl font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </Card>
      </main>
    );

  const keyer = `${sessionId}-${question?.id}`;

  // Determine which players to display: prefer live WS list
  const rawDisplayPlayers =
    (connectedPlayers && connectedPlayers.length > 0
      ? connectedPlayers
      : players) || [];
  const displayPlayers = rawDisplayPlayers
    .filter((player) => !player.is_kicked)
    .sort((left, right) => {
      if (!isBeatClock) return 0;
      return Number(right.score ?? 0) - Number(left.score ?? 0);
    });
  const removedPlayers = Array.from(
    new Map(
      [
        ...(((wsGameState as any)?.removedPlayers as Player[] | undefined) ||
          []),
        ...rawDisplayPlayers.filter((player) => player.is_kicked),
      ].map((player) => [getPlayerKey(player), player]),
    ).values(),
  );
  const fairPlay = (wsGameState as any)?.fairPlay;
  const fairPlayEnabled = Boolean(fairPlay?.cheat_detection_enabled);
  const maxFairPlayStrikes = Number(fairPlay?.max_cheat_strikes ?? 3);

  // Compute answered players using server-provided counts when available,
  // otherwise fall back to per-player answered flags.
  const playersAnswered =
    isBeatClock
      ? displayPlayers.reduce(
          (total, player) => total + Number(player.score ?? 0),
          0,
        )
      : Math.min(
          displayPlayers.length,
          game_status?.player_response_counts?.answered ??
            displayPlayers.filter(
              (p: any) => p.answered_current || p.answeredCurrent,
            ).length,
        );

  // Intro screen overlay
  if (introMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-wide">Get Ready!</h1>
          <p className="text-stone-300 max-w-md mx-auto">
            Listen to the brief tutorial. The game will start when the server is
            ready.
          </p>
          {countdown !== null ? (
            <div className="text-6xl font-mono">{countdown}</div>
          ) : serverPhase === "countdown_pending" ? (
            <div className="animate-pulse text-tea-400">
              Starting countdown...
            </div>
          ) : (
            <div className="animate-pulse text-tea-400">
              Playing tutorial audio...
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (skipIntroSent) return;
              if (!sendMessage || !isConnected) {
                showError("WebSocket is still connecting. Try again in a moment.");
                return;
              }

              setSkipIntroSent(true);
              introCompleteSentRef.current = true;
              audioRef.current?.pause();
              sendMessage({
                type: "skip_intro",
                data: {
                  duration_ms: COUNTDOWN_DURATION_MS,
                },
              });
            }}
            disabled={skipIntroSent}
            className="px-6 py-3 bg-tea-500 text-ink-900 rounded-xl font-semibold hover:bg-tea-400 transition"
          >
            {skipIntroSent ? "Skipping..." : "Skip"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-screen transition-transform duration-300 ease-out ${
        isRefreshing || gestureRefreshing ? "transform" : ""
      }`}
    >
      {/* Pull to refresh indicator */}
      {(isRefreshing || gestureRefreshing) && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-ink-800 text-tea-400 px-4 py-2 rounded-full text-sm shadow-lg border border-ink-600">
          {isRefreshing ? "🔄 Refreshing..." : "⬇️ Release to refresh"}
        </div>
      )}

      {/* Swipe hints */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 bg-ink-800/80 text-stone-400 px-3 py-1 rounded-full text-xs backdrop-blur-sm border border-ink-600">
        ← Swipe to navigate →
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Game State and Controls */}
        <div className="grid md:grid-cols-2 gap-4">
          <GameStateIndicator
            game_state={game_state === "ended" ? "ended" : game_state}
            currentQuestion={
              typeof game_status?.current_question_index === "number"
                ? game_status.current_question_index + 1
                : undefined
            }
            totalQuestions={game_status?.total_questions}
            playersCount={displayPlayers.length}
            playersAnswered={playersAnswered}
          />

          <div className="flex items-center justify-between p-4 bg-ink-800 rounded-xl">
            <div className="flex items-center gap-2">
              <ConnectionIndicator size="sm" />
              <WebSocketStatus
                isConnected={isConnected}
                lastUpdate={lastUpdate?.type}
                className="text-stone-400"
              />
            </div>

            <Timer
              ms={
                isBeatClock
                  ? undefined
                  : questionIsVisible && !questionEndsAt && timerMs
                  ? timerMs
                  : undefined
              }
              endsAt={
                isBeatClock
                  ? beatClockEndsAt
                  : questionIsVisible
                    ? questionEndsAt
                    : null
              }
              serverOffsetMs={serverOffsetMs}
              keyer={keyer}
            />
          </div>
        </div>

        {/* Game Controls */}
        <GameControls
          isPaused={game_state === "paused"}
          canGoNext={
            !isBeatClock &&
            game_state === "active" &&
            (game_status?.current_question_index || 0) <
              (game_status?.total_questions || 1) - 1
          }
          canGoPrevious={
            !isBeatClock &&
            game_state === "active" &&
            (game_status?.current_question_index || 0) > 0
          }
          isLoading={loading}
          onPause={handlePause}
          onResume={handleResume}
          onNextQuestion={handleNextQuestion}
          onPreviousQuestion={handlePreviousQuestion}
          onEndGame={handleEndGame}
          totalQuestions={game_status?.total_questions}
          currentQuestion={
            typeof game_status?.current_question_index === "number"
              ? game_status.current_question_index + 1
              : undefined
          }
        />

        <div className="grid md:grid-cols-2 gap-6">
          {/* Question Display */}
          <section>
            {isBeatClock ? (
              <Card className="p-8 text-center">
                <div className="text-sm uppercase tracking-wide text-tea-400">
                  Beat the Clock
                </div>
                <h2 className="mt-3 text-3xl font-semibold">
                  Answer as many as you can
                </h2>
                <div className="mt-6 rounded-2xl bg-ink-700 p-6">
                  <Timer
                    endsAt={beatClockEndsAt}
                    serverOffsetMs={serverOffsetMs}
                    keyer={`${sessionId}-beat-clock`}
                  />
                </div>
                <p className="mt-5 text-stone-300">
                  Questions are shown privately on each player's phone. The
                  leaderboard updates live as correct answers come in.
                </p>
                {error && (
                  <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-200 text-sm">
                    {error}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    Question {(game_status?.current_question_index ?? 0) + 1} of{" "}
                    {game_status?.total_questions || 0}
                  </h2>
                </div>

                <div className="text-lg mb-6">
                  {question?.prompt || "Loading question..."}
                </div>

                {question?.type === "mcq" && question.options && (
                  <div className="grid grid-cols-2 gap-3">
                    {question.options.map((o: MCQOption) => (
                      <div
                        key={o.id}
                        className="px-4 py-3 bg-ink-700 rounded-2xl text-center"
                      >
                        {o.text}
                      </div>
                    ))}
                  </div>
                )}

                {question?.type === "free" && (
                  <div className="p-4 bg-ink-700 rounded-xl text-sm text-stone-300 text-center">
                    Players answer with free text on their phones.
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-200 text-sm">
                    {error}
                  </div>
                )}
              </Card>
            )}
          </section>

          {/* Session Leaderboard */}
          <section>
            <Card className="p-6">
              <div className="text-lg font-semibold mb-4 flex items-center justify-between">
                <span>Leaderboard</span>
                <div className="flex items-center gap-2 text-sm font-normal">
                  {fairPlayEnabled && (
                    <span className="rounded-full bg-amber-900/30 px-2 py-1 text-xs text-amber-300">
                      Fair Play
                    </span>
                  )}
                  <span className="text-stone-400">
                    {isBeatClock
                      ? `${playersAnswered} correct`
                      : `${playersAnswered}/${displayPlayers.length} answered`}
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {displayPlayers.map((p: Player) => {
                  const hasAnswered =
                    (p as any).player_answered ||
                    (p as any).answered_current ||
                    (p as any).answeredCurrent;
                  const strikeCount =
                    typeof p.strike_count === "number"
                      ? p.strike_count
                      : null;
                  const maxStrikes =
                    typeof p.max_strikes === "number"
                      ? p.max_strikes
                      : maxFairPlayStrikes;
                  return (
                    <div
                      key={getPlayerKey(p)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                        hasAnswered
                          ? "bg-green-900/30 border border-green-500/30"
                          : "bg-ink-700"
                      }`}
                    >
                      <div className="font-medium">{p.player_name}</div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {p.is_kicked ? (
                          <span className="rounded-full bg-red-900/40 px-2 py-1 text-xs text-red-300">
                            Removed
                          </span>
                        ) : p.is_frozen ? (
                          <span className="rounded-full bg-amber-900/40 px-2 py-1 text-xs text-amber-300">
                            Frozen
                          </span>
                        ) : p.is_disconnected ? (
                          <span className="rounded-full bg-stone-800 px-2 py-1 text-xs text-stone-300">
                            Disconnected
                          </span>
                        ) : null}
                        {isBeatClock && (
                          <div className="text-sm font-semibold text-tea-300">
                            {Number(p.score ?? 0)} correct
                          </div>
                        )}
                        {strikeCount !== null && (
                          <span className="rounded-full bg-ink-800 px-2 py-1 text-xs text-stone-300">
                            Strike {strikeCount}/{maxStrikes}
                          </span>
                        )}
                        <div
                          className={`${isBeatClock ? "hidden" : ""} text-sm ${
                            hasAnswered ? "text-green-300" : "text-stone-400"
                          }`}
                        >
                          {hasAnswered ? "✓ Answered" : "Thinking..."}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {displayPlayers.length === 0 && (
                  <div className="text-stone-400 text-sm text-center py-8">
                    No players joined yet.
                  </div>
                )}
              </div>

              {removedPlayers.length > 0 && (
                <div className="mt-5 border-t border-ink-700 pt-4">
                  <div className="text-sm font-semibold text-red-300 mb-2">
                    Removed
                  </div>
                  <div className="space-y-2">
                    {removedPlayers.map((player) => {
                      const strikeCount =
                        typeof player.strike_count === "number"
                          ? player.strike_count
                          : maxFairPlayStrikes;
                      const maxStrikes =
                        typeof player.max_strikes === "number"
                          ? player.max_strikes
                          : maxFairPlayStrikes;

                      return (
                        <div
                          key={getPlayerKey(player)}
                          className="flex items-center justify-between rounded-xl bg-red-900/20 border border-red-500/20 px-3 py-2"
                        >
                          <span className="font-medium truncate pr-3">
                            {player.player_name || "Removed player"}
                          </span>
                          <span className="text-xs text-red-300 shrink-0">
                            Removed after {strikeCount}/{maxStrikes} strikes
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* WebSocket Diagnostics - Development Only */}
          {import.meta.env.VITE_DEV && sessionId && (
            <section>
              <WebSocketDiagnostics sessionCode={sessionId} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
