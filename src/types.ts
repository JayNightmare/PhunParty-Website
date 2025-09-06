export type Difficulty = "Easy" | "Medium" | "Hard";
export type GameType = "Trivia";

export type MCQOption = { id: string; text: string };

export type Question = {
    id: string;
    type: "mcq" | "free";
    prompt: string;
    options?: MCQOption[];
    answer: string;
};

export type Player = {
    id: string;
    name: string;
    score: number;
    correct: number;
    answeredCurrent?: boolean;
};

export type Session = {
    id: string;
    name: string;
    gameType: GameType;
    difficulty: Difficulty;
    numQuestions: number;
    questions: Question[];
    status: "lobby" | "active" | "finished";
    createdAt: number;
    players: Player[];
    currentIndex: number;
    timerMs?: number;
};

export type AnswerPayload = {
    playerId: string;
    sessionId: string;
    questionId: string;
    value: string;
};
