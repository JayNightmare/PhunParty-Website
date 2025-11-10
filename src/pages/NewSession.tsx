import { useNavigate, Navigate } from "react-router-dom";
import Card from "@/components/Card";
import { createSession, getGameTypes } from "@/lib/api";
import { useState, useEffect } from "react";
import { Difficulty } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingButton, LoadingState } from "@/components/Loading";
import { useToast } from "@/contexts/ToastContext";

export default function NewSession() {
  const { user, isLoading: authLoading } = useAuth();
  const { showSuccess, showError } = useToast();
  const nav = useNavigate();
  const [hostName, setHostName] = useState("");
  const [num, setNum] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [availableGameTypes, setAvailableGameTypes] = useState<string[]>([]);
  const [selectedGameType, setSelectedGameType] = useState("");

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
            .map((gt) => gt?.genre || gt?.game_code || "")
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
        const genre = (gt.genre || "").toString();
        const code = (gt.game_code || "").toString();
        return (
          genre.toLowerCase() === selectedGameType.toLowerCase() ||
          code.toLowerCase() === selectedGameType.toLowerCase()
        );
      });

      if (!gameOfType) {
        setError(`No game found for type: ${selectedGameType}`);
        setLoading(false);
        return;
      }

      const session = await createSession({
        owner_player_id: user?.id || undefined,
        host_name: hostName.trim(),
        number_of_questions: num,
        game_code: gameOfType.game_code, // Use actual game code
        ispublic: true,
        difficulty,
      });
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
                    {gameType.charAt(0).toUpperCase() +
                      gameType.slice(1).replace("-", " ")}
                  </option>
                ))}
              </select>
            )}
          </div>
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
              Easy: no timer, MCQ • Medium: 30s timer, MCQ • Hard: 20s timer,
              free‑text
            </p>
          </div>
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
