// API client for backend at api.phunparty.com
// All endpoints use fetch and return typed data

export const API_URL =
    import.meta.env.VITE_API_URL || "https://api.phunparty.com";

// --- Types matching backend models ---
export interface ScoresResponseModel {
    player_id: string;
    score: number;
    name: string;
}

export interface PlayerResponse {
    id: string;
    name: string;
    score: number;
    correct: number;
    // Add other fields as needed
}

export interface GameStatusResponse {
    current_question: QuestionResponse | null;
    player_response_counts: Record<string, number>;
    game_state: string; // e.g. lobby | active | finished
    players?: PlayerResponse[]; // Assumed shape; adjust to backend
    timer_ms?: number; // Optional timer value
}

export interface QuestionResponse {
    id: string;
    text: string;
    options: string[];
    answer: string;
    // Add other fields as needed
}

export interface QuestionsAddedResponseModel {
    success: boolean;
    question_id: string;
}

export interface GameResponse {
    code: string;
    name: string;
    status: string;
    // Add other fields as needed
}

// --- API functions ---

export async function getScores(
    session_code: string
): Promise<ScoresResponseModel[]> {
    const res = await fetch(`${API_URL}/${session_code}`);
    if (!res.ok) throw new Error("Failed to fetch scores");
    return res.json();
}

export async function getQuestion(
    question_id: string
): Promise<QuestionResponse> {
    const res = await fetch(`${API_URL}/${question_id}`);
    if (!res.ok) throw new Error("Failed to fetch question");
    return res.json();
}

export async function addQuestion(
    data: Partial<QuestionResponse>
): Promise<QuestionsAddedResponseModel> {
    const res = await fetch(`${API_URL}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to add question");
    return res.json();
}

export async function createPlayer(data: {
    name: string;
    session_code: string;
}): Promise<PlayerResponse> {
    const res = await fetch(`${API_URL}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create player");
    return res.json();
}

export async function getPlayer(player_id: string): Promise<PlayerResponse> {
    const res = await fetch(`${API_URL}/${player_id}`);
    if (!res.ok) throw new Error("Failed to fetch player");
    return res.json();
}

export async function getPlayers(): Promise<PlayerResponse[]> {
    const res = await fetch(`${API_URL}/`);
    if (!res.ok) throw new Error("Failed to fetch players");
    return res.json();
}

export async function deletePlayer(player_id: string): Promise<void> {
    const res = await fetch(`${API_URL}/${player_id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete player");
}

export async function updatePlayer(
    player_id: string,
    name: string
): Promise<PlayerResponse> {
    const res = await fetch(`${API_URL}/${player_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to update player");
    return res.json();
}

export async function submitAnswer(data: {
    player_id: string;
    session_code: string;
    question_id: string;
    answer: string;
}): Promise<any> {
    const res = await fetch(`${API_URL}/submit-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to submit answer");
    return res.json();
}

export async function getSessionStatus(
    session_code: string
): Promise<GameStatusResponse> {
    const res = await fetch(`${API_URL}/status/${session_code}`);
    if (!res.ok) throw new Error("Failed to fetch session status");
    return res.json();
}

export async function getCurrentQuestion(
    session_code: string
): Promise<QuestionResponse> {
    const res = await fetch(`${API_URL}/current-question/${session_code}`);
    if (!res.ok) throw new Error("Failed to fetch current question");
    return res.json();
}

export async function createGame(data: {
    name: string;
}): Promise<GameResponse> {
    const res = await fetch(`${API_URL}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create game");
    return res.json();
}

export async function createSession(data: {
    game_code: string;
}): Promise<GameResponse> {
    const res = await fetch(`${API_URL}/create/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create session");
    return res.json();
}

export async function getGameSession(game_code: string): Promise<GameResponse> {
    const res = await fetch(`${API_URL}/${game_code}`);
    if (!res.ok) throw new Error("Failed to fetch game session");
    return res.json();
}

export async function getGames(): Promise<GameResponse[]> {
    const res = await fetch(`${API_URL}/`);
    if (!res.ok) throw new Error("Failed to fetch games");
    return res.json();
}

export async function joinGameSession(data: {
    player_id: string;
    session_code: string;
}): Promise<any> {
    const res = await fetch(`${API_URL}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to join game session");
    return res.json();
}
