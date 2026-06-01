import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Question, MCQOption } from "@/types";
import { Player } from "@/hooks/useGameWebSocket";

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
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const introCompleteSentRef = useRef(false);
  const hasNavigatedToStats = useRef(false);
  // Timer duration based on difficulty – must be declared before any conditional returns
  const [timerMs, setTimerMs] = useState<number>(30000);

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
  const hasProtocolState = Boolean(serverPhase);
  const questionIsVisible = hasProtocolState
    ? serverPhase === "question"
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

  // Keep timer in sync with question difficulty
  useEffect(() => {
    const diff = (question?.difficulty || "Easy") as any;
    const norm = typeof diff === "string" ? diff.toLowerCase() : "easy";
    if (norm === "hard") setTimerMs(15000);
    else if (norm === "medium") setTimerMs(20000);
    else setTimerMs(30000);
  }, [question?.difficulty]);

  // Determine if intro should run (query param intro=1 on first load)
  useEffect(() => {
    if (location.search.includes("intro=1")) {
      setIntroMode(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (!serverPhase) return;

    if (
      serverPhase === "intro_audio" ||
      serverPhase === "countdown_pending" ||
      serverPhase === "countdown"
    ) {
      setIntroMode(true);
      return;
    }

    setIntroMode(false);
  }, [serverPhase]);

  const sendIntroComplete = () => {
    if (introCompleteSentRef.current || !sendMessage || !isConnected) return;

    introCompleteSentRef.current = true;
    const durationMs = audioRef.current?.duration
      ? Math.round(audioRef.current.duration * 1000)
      : 3000;

    sendMessage({
      type: "intro_complete",
      data: {
        duration_ms: durationMs,
      },
    });
  };

  // Handle intro audio playback only when the backend starts the intro phase.
  useEffect(() => {
    if (serverPhase !== "intro_audio") return;

    if (audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.warn("Intro audio failed to play.", err);
      });
      return;
    }

    introCompleteSentRef.current = false;
    const audio = new Audio("/audio/tutorial_voiceline1.mp3");
    audioRef.current = audio;
    audio.addEventListener("ended", sendIntroComplete);
    audio.play().catch((err) => {
      console.warn(
        "Intro audio failed to autoplay, waiting for user interaction.",
        err,
      );
    });

    return () => {
      audio.removeEventListener("ended", sendIntroComplete);
    };
  }, [serverPhase, sendMessage, isConnected]);

  // Countdown display follows the backend's question_start_at timestamp.
  useEffect(() => {
    if (serverPhase !== "countdown" || !serverCountdown?.questionStartAt) {
      setCountdown(null);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    const updateCountdown = () => {
      const remainingMs = Math.max(
        0,
        Date.parse(serverCountdown.questionStartAt) -
          (Date.now() + serverOffsetMs),
      );
      setCountdown(Math.ceil(remainingMs / 1000));
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 200);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [serverPhase, serverCountdown?.questionStartAt, serverOffsetMs]);

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

    // Prefer WebSocket currentQuestion when available
    const wsQ = (wsGameState as any)?.currentQuestion;

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
              type: mcqOptions.length > 0 ? "mcq" : "free",
              prompt: currentQuestion.prompt || "",
              options: mcqOptions,
              answer: currentQuestion.answer || "",
              genre: currentQuestion.genre || undefined,
              difficulty:
                (currentQuestion.difficulty as Question["difficulty"]) ||
                undefined,
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
            player_id: player.player_id || player.id,
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
              player_id: player.player_id || player.id,
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
    connectedPlayers,
    serverPhase,
    introMode,
    countdown,
    questionIsVisible,
    sessionId,
    navigate,
  ]);

  // Automatically navigate to stats page when the game completes
  useEffect(() => {
    if (!sessionId) return;
    // Only navigate when the server reports the game has ended
    if (game_status?.game_state === "ended") {
      if (!hasNavigatedToStats.current) {
        hasNavigatedToStats.current = true;
        navigate(`/stats/${sessionId}/`, { replace: true });
      }
    } else {
      hasNavigatedToStats.current = false;
    }
  }, [game_status?.game_state, navigate, sessionId]);

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

  // Legacy next question handler for timer
  const next = async () => {
    await handleNextQuestion();
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
  const displayPlayers =
    (connectedPlayers && connectedPlayers.length > 0
      ? connectedPlayers
      : players) || [];

  // Compute answered players using server-provided counts when available,
  // otherwise fall back to per-player answered flags.
  const playersAnswered =
    game_status?.player_response_counts?.answered ??
    players.filter((p: any) => p.answered_current || p.answeredCurrent).length;

  // Intro screen overlay
  if (introMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-wide">Get Ready!</h1>
          <p className="text-stone-300 max-w-md mx-auto">
            Listen to the brief tutorial. The game will start when the server is ready.
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
              audioRef.current?.pause();
              if (sendMessage && isConnected) {
                sendMessage({
                  type: "skip_intro",
                  data: {
                    duration_ms: audioRef.current?.duration
                      ? Math.round(audioRef.current.duration * 1000)
                      : 3000,
                  },
                });
              }
            }}
            className="px-6 py-3 bg-tea-500 text-ink-900 rounded-xl font-semibold hover:bg-tea-400 transition"
          >
            Skip
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

            <Timer ms={timerMs} keyer={keyer} onEnd={next} />
          </div>
        </div>

        {/* Game Controls */}
        <GameControls
          isPaused={game_state === "paused"}
          canGoNext={
            game_state === "active" &&
            (game_status?.current_question_index || 0) <
              (game_status?.total_questions || 1) - 1
          }
          canGoPrevious={
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
          </section>

          {/* Session Leaderboard */}
          <section>
            <Card className="p-6">
              <div className="text-lg font-semibold mb-4 flex items-center justify-between">
                <span>Leaderboard</span>
                <span className="text-sm font-normal text-stone-400">
                  {playersAnswered}/{displayPlayers.length} answered
                </span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {displayPlayers.map((p: Player) => {
                  const hasAnswered =
                    (p as any).player_answered ||
                    (p as any).answered_current ||
                    (p as any).answeredCurrent;
                  return (
                    <div
                      key={p.player_id}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                        hasAnswered
                          ? "bg-green-900/30 border border-green-500/30"
                          : "bg-ink-700"
                      }`}
                    >
                      <div className="font-medium">{p.player_name}</div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`text-sm ${
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
