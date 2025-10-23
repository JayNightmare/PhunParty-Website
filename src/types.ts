import { Player } from "@/hooks/useGameWebSocket";

// Backend-aligned types
export type Difficulty = "Easy" | "Medium" | "Hard";
export type GameType = "Trivia";

export type MCQOption = { id: string; text: string };

// Frontend Question type (for display)
export type Question = {
    id: string;
    type: "mcq" | "free";
    prompt: string;
    options?: MCQOption[];
    answer: string;
    difficulty?: Difficulty;
    genre?: string;
};

// Frontend Session type (for display)
export type Session = {
    id: string;
    code: string;
    name: string;
    host_name?: string;
    gameType?: GameType;
    difficulty?: Difficulty;
    numQuestions: number;
    questions?: Question[];
    status: "lobby" | "active" | "finished" | "waiting";
    createdAt?: number;
    players: Player[];
    currentIndex: number;
    timerMs?: number;
    game_code?: string;
    is_active?: boolean;
    is_waiting_for_players?: boolean;
    current_question?: any;
    started_at?: string;
    ended_at?: string;
};

export type AnswerPayload = {
    session_code: string;
    player_id: string;
    question_id: string;
    player_answer: string;
};

// Utility types for API responses
export type ApiGame = {
    game_code: string;
    rules: string;
    genre: string;
};

export type ApiPlayer = {
    player_id: string;
    player_name: string;
    player_email: string;
    player_mobile?: string;
    active_game_code?: string;
};

export type ApiGameStatus = {
    session_code: string;
    is_active: boolean;
    is_waiting_for_players: boolean;
    current_question_index: number;
    total_questions: number;
    current_question: any;
    players: any;
    started_at?: string;
    ended_at?: string;
};

export type ApiScore = {
    score: number;
    result?: string;
};
