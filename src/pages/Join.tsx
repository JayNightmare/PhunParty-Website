import { useState, useRef, useEffect } from "react";
import { MCQOption, Question } from "@/types";
import { useParams } from "react-router-dom";
import Card from "@/components/Card";
import {
  joinGameSession,
  submitAnswer,
  getCurrentQuestion,
  createPlayer,
  leaveGameSession,
} from "@/lib/api";
import { LoadingButton, LoadingState } from "@/components/Loading";
import { useToast } from "@/contexts/ToastContext";
import useGameUpdates from "@/hooks/useGameUpdates";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import MobileAnswerSelector from "@/components/MobileAnswerSelector";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { useTouchGestures } from "@/hooks/useTouchGestures";

export default function Join() {
  const { sessionId } = useParams();
  const { showSuccess, showError } = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [val, setVal] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pendingRejoin, setPendingRejoin] = useState<{
    playerId: string;
    targetSession: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nameTrigger, setNameTrigger] = useState(false);

  const getStoredUser = () => {
    const raw = localStorage.getItem("auth_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, any>;
    } catch {
      return null;
    }
  };

  const getStoredPlayerId = (user: Record<string, any> | null) =>
    user?.player_id || user?.id || null;

  const getJoinedSessionKey = (code: string, playerId: string) =>
    `phunparty:joined:${code}:${playerId}`;

  // Use real-time game updates
  // Determine when to open a real-time (mobile) WebSocket connection.
  // Previously we always connected as a generic "web" client, so the backend
  // didn't classify this participant as a mobile player and therefore did
  // not broadcast a player_joined event to the host waiting room.
  // We now:
  // 1. Wait until the user actually joins (nameTrigger true + we have player id)
  // 2. Connect with clientType "mobile" + playerId + playerName so backend
  //    ConnectionManager.connect() broadcasts player_joined to web clients (hosts).
  const isJoined = !!myId && nameTrigger;

  const {
    game_status,
    game_state,
    isConnected,
    isLoading: statusLoading,
    error: statusError,
    sendMessage,
  } = useGameUpdates({
    sessionCode: sessionId || "",
    // Only enable the WebSocket after the player has formally joined; until then
    // we rely purely on REST status (fewer unnecessary connections & avoids
    // misclassification as a web client).
    enableWebSocket: isJoined,
    clientType: isJoined ? "mobile" : "web",
    playerId: isJoined ? myId || undefined : undefined,
    playerName: isJoined ? name || undefined : undefined,
  });

  // Enhanced touch gestures for mobile
  const { attachGestures, isRefreshing: gestureRefreshing } = useTouchGestures({
    onPullToRefresh: async () => {
      setIsRefreshing(true);
      try {
        // Force refresh game status
        window.location.reload();
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

  // Auto-focus name input on mobile
  useEffect(() => {
    if (!myId && nameInputRef.current) {
      // Delay to ensure mobile keyboard opens properly
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [myId]);

  const serverPhase = (game_state as any)?.phase as string | undefined;
  const hasProtocolState = Boolean(serverPhase);
  const questionIsVisible = hasProtocolState
    ? serverPhase === "question"
    : !!game_status?.isstarted;
  const waitingMessage =
    serverPhase === "intro_audio"
      ? "Host is explaining the rules..."
      : serverPhase === "countdown" || serverPhase === "countdown_pending"
        ? "Get ready..."
        : "Waiting for host to start the game...";

  useEffect(() => {
    // Prefer WebSocket question for real-time updates.
    // Keep WS question payloads available, but only display them after the
    // game has officially started so phones remain on the waiting screen
    // during the intro audio/countdown flow.
    const wsQ = (game_state as any)?.currentQuestion;

    if (wsQ) {
      if (!questionIsVisible) {
        setQuestion(null);
        return;
      }

      const prompt = wsQ.question || wsQ.prompt || "";
      const id = wsQ.question_id || wsQ.id || prompt;
      const displayOptions: string[] = wsQ.display_options || wsQ.options || [];
      const uiMode = wsQ.ui_mode; // Get ui_mode from backend

      const mcqOptions =
        Array.isArray(displayOptions) && displayOptions.length > 0
          ? displayOptions.map((opt: string, i: number) => ({
              id: `option_${i}`,
              text: opt,
            }))
          : [];
      const rawDiff: string = wsQ.difficulty || "Easy";
      const difficulty = (
        rawDiff
          ? rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase()
          : "Easy"
      ) as Question["difficulty"];
      const correctIndex: number | undefined = wsQ.correct_index;
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
      return;
    }
    // If no WS question yet, fall back to REST once the game is started
    if (!questionIsVisible) {
      setQuestion(null);
      return;
    }
    // Fallback: REST fetch if WS not available
    const fetchCurrentQuestion = async () => {
      if (!sessionId) return;
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
      }
    };
    fetchCurrentQuestion();
  }, [
    sessionId,
    questionIsVisible,
    game_status?.current_question_index,
    game_state,
  ]);

  useEffect(() => {
    setHasSubmitted(false);
    setVal("");
  }, [question?.id]);

  // Load stored player ID and name if available
  useEffect(() => {
    if (sessionId) {
      const storedUser = getStoredUser();
      const playerId = getStoredPlayerId(storedUser);
      if (playerId) {
        setMyId(playerId);

        const rememberedName =
          storedUser?.player_name || storedUser?.name || "";
        if (rememberedName) {
          setName(rememberedName);

          const joinedKey = getJoinedSessionKey(sessionId, playerId);
          if (localStorage.getItem(joinedKey) === "1") {
            setNameTrigger(true);
          }
        }
      }
    }
  }, [sessionId]);

  // Join session - handles player creation and game joining
  const join = async () => {
    if (!sessionId || !name.trim()) {
      setJoinError("Please enter your name");
      return;
    }

    setJoinLoading(true);
    setJoinError(null);

    try {
      const storedUser = getStoredUser();
      let playerId = getStoredPlayerId(storedUser);

      if (!playerId) {
        const normalizedName = name.trim();
        const uniqueSuffix = `${Date.now().toString(36)}${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const guestEmail = `guest_${uniqueSuffix}@phun.party`;

        const newPlayer = await createPlayer({
          player_name: normalizedName,
          player_email: guestEmail,
          hashed_password: `guest-${uniqueSuffix}`,
        });

        playerId = newPlayer.player_id;
        localStorage.setItem(
          "auth_user",
          JSON.stringify({
            id: newPlayer.player_id,
            name: newPlayer.player_name,
            email: newPlayer.player_email,
          }),
        );
      }

      const playerData = {
        session_code: sessionId,
        player_id: playerId,
      };

      await joinGameSession(playerData);
      setMyId(playerId);
      localStorage.setItem(getJoinedSessionKey(sessionId, playerId), "1");

      // Enable mobile WebSocket only after backend confirms the player joined.
      setNameTrigger(true);

      showSuccess(`Welcome to the game, ${name.trim()}!`);
    } catch (err: any) {
      const rawMessage = err.message || "Failed to join session";
      // Backend sends {"detail":"Player is already in a game session"}
      if (rawMessage.includes("Player is already in a game session")) {
        try {
          const player = getStoredUser();
          const playerId = getStoredPlayerId(player);
          if (playerId) {
            setPendingRejoin({
              playerId,
              targetSession: sessionId,
            });
          }
        } catch {}
      }
      setJoinError(rawMessage);
      showError(rawMessage);
    } finally {
      setJoinLoading(false);
    }
  };

  const leaveAndRejoin = async () => {
    if (!pendingRejoin) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      await leaveGameSession(pendingRejoin.playerId);
      showSuccess("Left previous session. Joining new session...");
      // Attempt join again
      await joinGameSession({
        session_code: pendingRejoin.targetSession,
        player_id: pendingRejoin.playerId,
      });
      setMyId(pendingRejoin.playerId);
      localStorage.setItem(
        getJoinedSessionKey(
          pendingRejoin.targetSession,
          pendingRejoin.playerId,
        ),
        "1",
      );
      setNameTrigger(true);
      showSuccess(`Welcome to the game, ${name.trim() || "Player"}!`);
      setPendingRejoin(null);
    } catch (err: any) {
      const msg = err.message || "Failed to leave previous session";
      setJoinError(msg);
      showError(msg);
    } finally {
      setJoinLoading(false);
    }
  };

  // Submit answer
  const submit = async (v: string) => {
    if (!sessionId || !question || !myId || !questionIsVisible || hasSubmitted)
      return;

    setSubmitLoading(true);

    try {
      // Try WebSocket first if connected, fallback to HTTP API
      if (isConnected && sendMessage) {
        sendMessage({
          type: "submit_answer",
          data: {
            answer: v,
            question_id: question.id,
          },
        });
        showSuccess("Answer submitted via WebSocket!");
      } else {
        const result = await submitAnswer({
          player_id: myId,
          session_code: sessionId,
          question_id: question.id,
          player_answer: v,
        });
        const matchMethod = result.answer_match?.method;
        showSuccess(
          result.is_correct && matchMethod && matchMethod !== "exact"
            ? "Answer accepted!"
            : "Answer submitted!",
        );
      }
      setHasSubmitted(true);
      setVal("");
    } catch (err: any) {
      const errorMsg = err.message || "Failed to submit answer";
      showError(errorMsg);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle Enter key for joining
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !joinLoading && name.trim()) {
      join();
    }
  };

  // Loading state
  if (statusLoading && !game_status) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <Card className="p-6">
          <LoadingState message="Loading game session..." />
        </Card>
      </main>
    );
  }

  // Error state
  if (statusError && !game_status) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-center">
            <div className="text-red-400 mb-4">❌</div>
            <h2 className="text-lg font-semibold mb-2">Session Not Found</h2>
            <p className="text-stone-400 mb-4">{statusError}</p>
            <div className="text-sm text-stone-500">
              Session ID: {sessionId}
            </div>
          </div>
        </Card>
      </main>
    );
  }

  if (!game_status) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-center text-stone-400">
            Session not found or loading...
          </div>
        </Card>
      </main>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-screen transition-transform duration-300 ease-out ${
        isRefreshing || gestureRefreshing ? "transform" : ""
      }`}
    >
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Pull to refresh indicator */}
      {(isRefreshing || gestureRefreshing) && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-ink-800 text-tea-400 px-4 py-2 rounded-full text-sm shadow-lg border border-ink-600">
          {isRefreshing ? "🔄 Refreshing..." : "⬇️ Release to refresh"}
        </div>
      )}

      <main className="max-w-md mx-auto px-4 py-8">
        <Card className="p-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs text-stone-400">Session: {sessionId}</div>
            <ConnectionIndicator size="sm" showText />
          </div>

          {!nameTrigger ? (
            <div>
              <div className="text-xl font-semibold mb-2">Join Game</div>
              <div className="text-sm text-stone-400 mb-6">
                State: {game_status.game_state} • Players:{" "}
                {game_status.players?.length || 0}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-300 mb-2">
                    Your Name
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 rounded-2xl bg-ink-700 border border-ink-600 text-stone-100 placeholder-stone-500 outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent text-lg"
                    maxLength={30}
                    autoComplete="name"
                    autoFocus
                  />
                  <div className="text-xs text-stone-500 mt-1">
                    {name.length}/30 characters
                  </div>
                </div>

                <LoadingButton
                  onClick={join}
                  isLoading={joinLoading}
                  loadingText="Joining game..."
                  disabled={!name.trim()}
                  className="w-full py-4 text-lg font-semibold"
                >
                  Join Game
                </LoadingButton>

                {joinError && (
                  <div className="p-3 bg-red-900/20 border border-red-800 rounded-xl text-red-400 text-sm space-y-3">
                    <div>{joinError}</div>
                    {pendingRejoin && (
                      <button
                        type="button"
                        onClick={leaveAndRejoin}
                        className="w-full px-4 py-2 rounded-xl bg-tea-600 hover:bg-tea-500 text-ink-900 font-semibold transition-colors disabled:opacity-50"
                        disabled={joinLoading}
                      >
                        Leave Current Session & Join This One
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-lg font-semibold mb-2">Welcome, {name}!</div>
              <div className="text-sm text-stone-400 mb-4">
                {question
                  ? `Question ${
                      (game_status.current_question_index || 0) + 1
                    }/${game_status.total_questions}`
                  : !questionIsVisible
                    ? "No question yet"
                    : "Waiting for next question..."}
              </div>

              {question ? (
                <div className="space-y-4">
                  <div className="p-4 bg-ink-800 rounded-xl">
                    <div className="text-lg font-medium mb-4">
                      {question.prompt}
                    </div>
                  </div>

                  {question.type === "mcq" && (
                    <MobileAnswerSelector
                      options={question.options || []}
                      onSelect={(optionId) => {
                        // Find the option text by ID
                        const selectedOption = question.options?.find(
                          (opt) => opt.id === optionId,
                        );
                        if (selectedOption) {
                          submit(selectedOption.text);
                        }
                      }}
                      isSubmitting={submitLoading}
                      selectedOption={
                        val
                          ? question.options?.find((opt) => opt.text === val)
                              ?.id
                          : undefined
                      }
                      timeRemaining={undefined} // Could add timer from game status
                      disabled={submitLoading || hasSubmitted}
                    />
                  )}

                  {question.type === "free" && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder="Type your answer"
                        className="w-full px-4 py-3 rounded-2xl bg-ink-700 border border-ink-600 text-stone-100 placeholder-stone-500 outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent text-lg"
                        maxLength={100}
                        autoFocus
                      />
                      <LoadingButton
                        onClick={() => submit(val)}
                        isLoading={submitLoading}
                        loadingText="Submitting..."
                        disabled={!val.trim() || hasSubmitted}
                        className="w-full py-3 text-lg font-semibold"
                      >
                        Submit Answer
                      </LoadingButton>
                    </div>
                  )}

                  {hasSubmitted && (
                    <div className="p-3 bg-green-900/20 border border-green-700 rounded-xl text-green-300 text-sm text-center">
                      Answer submitted. Waiting for the next question...
                    </div>
                  )}
                </div>
              ) : !questionIsVisible ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🕒</div>
                  <div className="text-stone-300 font-medium">
                    {waitingMessage}
                  </div>
                  <div className="text-xs text-stone-500 mt-2">
                    {isConnected
                      ? "Connected for real-time updates"
                      : "Connecting..."}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">⏳</div>
                  <div className="text-stone-400">
                    Waiting for the host to advance...
                  </div>
                  <div className="text-xs text-stone-500 mt-2">
                    {isConnected
                      ? "Connected for real-time updates"
                      : "Checking for updates..."}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
