import Card from "@/components/Card";
import { Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  getGames,
  GameResponse,
  testApiConnection,
  GameHistory,
  DidWin,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileSkeleton, GameListSkeleton } from "@/components/Skeleton";
import { LoadingState } from "@/components/Loading";
import { useToast } from "@/contexts/ToastContext";

export default function Account() {
  const { user, isLoading: authLoading } = useAuth();
  const { showError } = useToast();
  const [games, setGames] = useState<GameHistory[]>([]);
  const [filterResult, setFilterResult] = useState<"All" | DidWin>("All");
  const [filterType, setFilterType] = useState<string>("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showTestResult, setShowTestResult] = useState(false);

  const handleTestApi = async () => {
    console.log("Testing API connection...");
    setShowTestResult(true);
    const result = await testApiConnection();
    setTestResult(JSON.stringify(result, null, 2));
  };

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      try {
        setLoading(true);
        const list = await getGames(user.id);
        setGames(list);
      } catch (err: any) {
        setError(err.message || "Failed to load games");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user]);

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-8 w-48 bg-ink-600 rounded-xl animate-pulse"></div>
            <div className="h-10 w-28 bg-ink-600 rounded-xl animate-pulse"></div>
          </div>
          <ProfileSkeleton />
        </Card>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="h-6 w-32 bg-ink-600 rounded-xl animate-pulse mb-4"></div>
            <GameListSkeleton />
          </Card>
          <Card className="p-6">
            <div className="h-6 w-40 bg-ink-600 rounded-xl animate-pulse mb-4"></div>
            <div className="space-y-3">
              <div className="h-10 bg-ink-600 rounded-lg animate-pulse"></div>
              <div className="h-20 bg-ink-600 rounded-lg animate-pulse"></div>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* User Profile Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Account Profile</h1>
          <Link
            to="/account/edit"
            className="px-4 py-2 bg-tea-500 text-ink-900 rounded-xl font-medium hover:bg-tea-400 transition-colors"
          >
            Edit Profile
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-stone-400 mb-1">
              Full Name
            </label>
            <div className="text-lg text-stone-200">{user?.name}</div>
          </div>
          <div>
            <label className="block text-sm text-stone-400 mb-1">
              Email Address
            </label>
            <div className="text-lg text-stone-200">{user?.email}</div>
          </div>
          <div>
            <label className="block text-sm text-stone-400 mb-1">
              Mobile Number
            </label>
            <div className="text-lg text-stone-200">
              {user?.mobile || (
                <span className="text-stone-400">Not provided</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm text-stone-400 mb-1">
              Active Game
            </label>
            <div className="text-lg text-stone-200">
              {user?.active_game_code || (
                <span className="text-stone-400">None</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Game History Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Game History</h2>
            <Link
              to="/new"
              className="text-sm text-tea-400 hover:text-tea-300 transition-colors"
            >
              Start New Game →
            </Link>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-stone-400">Filter:</label>
            <select
              aria-label="Filter by result"
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-ink-700 text-sm"
            >
              <option value="All">All results</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
              <option value="Draw">Draw</option>
            </select>

            <select
              aria-label="Filter by game type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-ink-700 text-sm"
            >
              <option value="All">All types</option>
              {Array.from(new Set(games.map((g) => g.game_type))).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 max-h-[40vh] overflow-auto pr-2">
            {loading && <GameListSkeleton />}
            {error && (
              <div className="text-red-500 text-sm">
                {error}
                <button
                  onClick={() => window.location.reload()}
                  className="ml-2 text-xs underline"
                >
                  Retry
                </button>
              </div>
            )}
            {!loading &&
              games.length > 0 &&
              games
                .filter((g) =>
                  filterResult === "All" ? true : g.did_win === filterResult
                )
                .filter((g) =>
                  filterType === "All" ? true : g.game_type === filterType
                )
                .map((g) => (
                  <Link
                    to={`/stats/${g.session_code}`}
                    key={g.session_code}
                    className="block px-3 py-2 bg-ink-700 rounded-xl hover:bg-ink-600 transition-colors"
                  >
                    <div className="font-medium">{g.game_type}</div>
                    <div className="text-xs text-stone-400">
                      Code: {g.session_code} • Status: {g.did_win}
                    </div>
                  </Link>
                ))}
            {!loading && games.length === 0 && !error && (
              <div className="text-center py-8 text-stone-400">
                <div className="text-4xl mb-2">🎯</div>
                <div className="text-sm mb-2">No games yet</div>
                <Link
                  to="/new"
                  className="text-tea-400 hover:text-tea-300 text-sm underline"
                >
                  Start your first game
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* Developer Tools Card */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Developer Tools</h2>
          <div className="space-y-3">
            <button
              onClick={handleTestApi}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Test API Connection
            </button>

            {showTestResult && (
              <details className="bg-ink-700 rounded-lg">
                <summary className="p-3 cursor-pointer text-sm font-medium">
                  API Test Results
                </summary>
                {testResult && (
                  <pre className="p-3 text-xs bg-ink-800 rounded-b-lg overflow-auto max-h-40 border-t border-ink-600">
                    {testResult}
                  </pre>
                )}
              </details>
            )}

            <div className="text-xs text-stone-400 space-y-1">
              <div>User ID: {user?.id}</div>
              <div>API Status: Connected ✅</div>
              <div>Build: Development</div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
