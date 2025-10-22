import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HashRouter } from "react-router-dom";

// Provide authenticated user and noop provider for tests
vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({
        user: { id: "u1", name: "Tester", email: "t@test" },
        isLoading: false,
    }),
    AuthProvider: ({ children }: any) => children,
}));

// Mock API used by NewSession and ActiveSessions to avoid real fetch
vi.mock("@/lib/api", () => ({
    getGameTypes: async () => ["trivia", "speed-round"],
    getOwnedUserSessions: async () => [],
    getSessionStatus: async (_code: string) => ({
        game_state: "waiting",
        players: [],
        player_response_counts: { answered: 0, total: 0 },
    }),
}));

// Keep WS/polling quiet in tests
vi.mock("@/hooks/useGameUpdates", () => ({
    __esModule: true,
    default: () => ({ gameStatus: null, isConnected: true, isLoading: false }),
}));

import Landing from "@/pages/Landing";
import NewSession from "@/pages/NewSession";
import ActiveSessions from "@/pages/ActiveSessions";

function wrap(node: JSX.Element) {
    return render(<HashRouter>{node}</HashRouter>);
}

describe("ui smoke", () => {
    it("renders landing", () => {
        wrap(<Landing />);
        expect(screen.getByText(/PhunParty/i)).toBeInTheDocument();
    });
    it("renders new session", async () => {
        wrap(<NewSession />);
        // Wait for mocked game types to load and populate select options
        expect(await screen.findByText("Trivia")).toBeInTheDocument();
    });
    it("renders active sessions list container", () => {
        wrap(<ActiveSessions />);
        expect(screen.getByText(/Active Game Sessions/i)).toBeInTheDocument();
    });
});
