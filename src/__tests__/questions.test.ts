import { describe, it, expect } from "vitest";
import { buildQuestions, difficultyTimerMs } from "@/lib/questions";

describe("questions", () => {
    it("builds the requested number of questions", () => {
        const qs = buildQuestions("Easy", 4);
        expect(qs.length).toBe(4);
    });
    it("sets types based on difficulty", () => {
        const easy = buildQuestions("Easy", 3);
        expect(easy.every((q) => q.type === "mcq")).toBe(true);
        const hard = buildQuestions("Hard", 2);
        expect(hard.every((q) => q.type === "free")).toBe(true);
    });
    it("returns timers by difficulty", () => {
        expect(difficultyTimerMs("Easy")).toBeUndefined();
        expect(difficultyTimerMs("Medium")).toBe(30000);
        expect(difficultyTimerMs("Hard")).toBe(20000);
    });
});
