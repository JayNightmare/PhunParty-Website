import { useNavigate, Navigate } from "react-router-dom";
import Card from "@/components/Card";
import { createSession, getGameTypes } from "@/lib/api";
import { useState, useEffect } from "react";
import { Difficulty } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingButton, LoadingState } from "@/components/Loading";
import { useToast } from "@/contexts/ToastContext";

const getGameTypeCandidates = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (typeof value !== "object") return [String(value)];

  const gameType = value as Record<string, unknown>;
  return [
    gameType.genre,
    gameType.game_code,
    gameType.gameCode,
    gameType.game_type,
    gameType.gameType,
    gameType.name,
    gameType.title,
    gameType.display_name,
    gameType.displayName,
    gameType.rules,
  ]
    .filter((candidate): candidate is string => typeof candidate === "string")
    .filter(Boolean);
};

const compactGameType = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const isBeatTheClockGameType = (value: unknown) => {
  return getGameTypeCandidates(value).some((candidate) => {
    const compact = compactGameType(candidate);
    return compact.includes("beattheclock") || compact.includes("beatclock");
  });
};

const BEAT_CLOCK_QUESTION_POOL_SIZE = 1000;
const BEAT_CLOCK_DURATION_OPTIONS = [30, 60, 90, 120, 180, 300];

const formatGameType = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getGameTypeOptionValue = (gameType: unknown) => {
  const candidates = getGameTypeCandidates(gameType);
  return (
    candidates.find((candidate) => isBeatTheClockGameType(candidate)) ||
    candidates[0] ||
    ""
  );
};

export default function NewSession() {
  const { user, isLoading: authLoading } = useAuth();
  const { showSuccess, showError } = useToast();
  const nav = useNavigate();
  const [hostName, setHostName] = useState("");
  const [num, setNum] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [fairPlayEnabled, setFairPlayEnabled] = useState(false);
  const [maxFairPlayStrikes, setMaxFairPlayStrikes] = useState(3);
  const [availableGameTypes, setAvailableGameTypes] = useState<string[]>([]);
  const [selectedGameType, setSelectedGameType] = useState("");
  const [beatClockDuration, setBeatClockDuration] = useState(60);

  const [loading, setLoading] = useState(false);
  const [loadingGameTypes, setLoadingGameTypes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default host name from authenticated user
  useEffect(() => {
    if (user?.name) {
      setHostName(user.name);
    }
  }, [user]);

  // Load available game types on component mount
  useEffect(() => {
    const loadGameTypes = async () => {
      try {
        setLoadingGameTypes(true);
        const gameTypes = (await getGameTypes()) as any[];

        // Support multiple possible shapes returned by the API or test mocks:
        // - Array of objects: [{ genre, game_code, ... }, ...]
        // - Array of strings: ["trivia", "speed-round"]
        let gameTypeStrings: string[] = [];

        if (gameTypes.length === 0) {
          gameTypeStrings = [];
        } else if (typeof gameTypes[0] === "string") {
          gameTypeStrings = gameTypes as string[];
        } else {
          gameTypeStrings = gameTypes
            .map(getGameTypeOptionValue)
            .filter(Boolean) as string[];
        }

        setAvailableGameTypes(gameTypeStrings);
        if (gameTypeStrings.length > 0) {
          setSelectedGameType(gameTypeStrings[0]);
        }
      } catch (err) {
        console.error("Failed to load available game types:", err);
        // Set default fallback
        const fallbackTypes = ["trivia", "speed-round"];
        setAvailableGameTypes(fallbackTypes);
        setSelectedGameType(fallbackTypes[0]);
      } finally {
        setLoadingGameTypes(false);
      }
    };
    loadGameTypes();
  }, []);

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card className="p-6">
          <LoadingState message="Loading session creator..." />
        </Card>
      </main>
    );
  }

  const create = async () => {
    setLoading(true);
    setError(null);
    const isBeatClock = isBeatTheClockGameType(selectedGameType);

    if (!hostName.trim()) {
      setError("Host name is required");
      setLoading(false);
      return;
    }

    if (!selectedGameType) {
      setError("Please select a game type");
      setLoading(false);
      return;
    }

    try {
      // Find a game template with the selected game type (genre)
      // use getGameTypes which returns available game definitions
      const gameTypes = await getGameTypes();
      const gameOfType = gameTypes.find((gt) => {
        const selected = compactGameType(selectedGameType);
        return getGameTypeCandidates(gt).some(
          (candidate) => compactGameType(candidate) === selected,
        );
      });

      if (!gameOfType) {
        setError(`No game found for type: ${selectedGameType}`);
        setLoading(false);
        return;
      }

      const sessionIsBeatClock =
        isBeatClock || isBeatTheClockGameType(gameOfType);

      const session = await createSession({
        owner_player_id: user?.id || undefined,
        host_name: hostName.trim(),
        number_of_questions: sessionIsBeatClock
          ? BEAT_CLOCK_QUESTION_POOL_SIZE
          : num,
        game_code: gameOfType.game_code, // Use actual game code
        ispublic: true,
        difficulty: sessionIsBeatClock ? undefined : difficulty,
        cheat_detection_enabled: fairPlayEnabled,
        max_cheat_strikes: maxFairPlayStrikes,
        beat_clock_duration_seconds: sessionIsBeatClock
          ? beatClockDuration
          : undefined,
      });
      sessionStorage.setItem(
        `phunparty:fair-play:${session.code}`,
        JSON.stringify({
          cheat_detection_enabled: fairPlayEnabled,
          max_cheat_strikes: maxFairPlayStrikes,
        }),
      );
      showSuccess(`Session created! Code: ${session.code}`);
      // Navigate directly to waiting room for this session
      nav(`/session/${session.code}/waiting`);
    } catch (err: any) {
      const errorMsg = err.message || "Failed to create session";
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const isBeatClockSelected = isBeatTheClockGameType(selectedGameType);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold">New Game Session</h2>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm text-stone-300 mb-1">
              Host Name
            </label>
            <input
              aria-label="Host Name"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none"
              placeholder="Enter your name"
            />
          </div>
          {!isBeatClockSelected && (
            <div>
              <label className="block text-sm text-stone-300 mb-1">
                Number of Questions
              </label>
              <input
                title="Number of Questions"
                type="number"
                min={1}
                max={20}
                value={num}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setNum(Number.isFinite(n) ? n : 1);
                }}
                className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-stone-300 mb-1">
              Game Type
            </label>
            {loadingGameTypes ? (
              <div className="px-4 py-3 rounded-2xl bg-ink-700 text-stone-400">
                Loading game types...
              </div>
            ) : (
              <select
                aria-label="Game Type"
                value={selectedGameType}
                onChange={(e) => setSelectedGameType(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-ink-700"
              >
                {availableGameTypes.map((gameType) => (
                  <option key={gameType} value={gameType}>
                    {formatGameType(gameType)}
                  </option>
                ))}
              </select>
            )}
          </div>
          {isBeatClockSelected && (
            <div>
              <label className="block text-sm text-stone-300 mb-1">
                Round Time
              </label>
              <select
                title="Beat the Clock round timer"
                value={beatClockDuration}
                onChange={(e) => setBeatClockDuration(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none"
              >
                {BEAT_CLOCK_DURATION_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds < 60
                      ? `${seconds} seconds`
                      : `${seconds / 60} minute${seconds === 60 ? "" : "s"}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-stone-400 mt-2">
                Seconds each player has to answer as many questions as possible.
              </p>
            </div>
          )}
          {!isBeatClockSelected && (
          <div>
            <label className="block text-sm text-stone-300 mb-1">
              Difficulty
            </label>
            <select
              aria-label="Difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full px-4 py-3 rounded-2xl bg-ink-700"
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
            <p className="text-xs text-stone-400 mt-2">
              Easy: no timer, MCQ • Medium: 30s timer, MCQ • Hard: 30s timer,
              free‑text
            </p>
          </div>
          )}
        </div>
        <div className="mt-5 rounded-2xl bg-ink-700/70 border border-ink-600 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={fairPlayEnabled}
              onChange={(event) => setFairPlayEnabled(event.target.checked)}
              className="mt-1 h-4 w-4 accent-tea-500"
            />
            <span>
              <span className="block text-sm font-medium text-stone-100">
                Fair Play Mode
              </span>
              <span className="block text-xs text-stone-400 mt-1">
                Fair Play Mode helps reduce cheating by requiring players to
                stay on the answer screen. Leaving the app or switching screens
                awards a strike; running out of strikes removes you from the
                session.
              </span>
            </span>
          </label>
          {fairPlayEnabled && (
            <div className="mt-3 max-w-xs">
              <label className="block text-xs text-stone-300 mb-1">
                Strikes before removal
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={maxFairPlayStrikes}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setMaxFairPlayStrikes(Number.isFinite(value) ? value : 3);
                }}
                className="w-full px-3 py-2 rounded-xl bg-ink-800 outline-none"
              />
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <LoadingButton
            onClick={create}
            isLoading={loading}
            loadingText="Creating session..."
            className="px-6 py-3"
          >
            Create Session
          </LoadingButton>
        </div>
        {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}
      </Card>
    </main>
  );
}
