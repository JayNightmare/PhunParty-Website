import { Difficulty, Question } from "@/types";
import { nid, shuffle } from "./utils";

const BANK: Array<{ q: string; a: string; d: Difficulty; opts?: string[] }> = [
    {
        q: "What planet is known as the Red Planet?",
        a: "Mars",
        d: "Easy",
        opts: ["Mars", "Venus", "Jupiter", "Mercury"],
    },
    {
        q: 'Who wrote "1984"?',
        a: "George Orwell",
        d: "Medium",
        opts: [
            "Aldous Huxley",
            "George Orwell",
            "J.K. Rowling",
            "Ernest Hemingway",
        ],
    },
    {
        q: "What is the capital of Japan?",
        a: "Tokyo",
        d: "Easy",
        opts: ["Kyoto", "Osaka", "Tokyo", "Nagoya"],
    },
    { q: "Speed of light approx. km/s?", a: "300000", d: "Hard" },
    {
        q: "Largest ocean on Earth?",
        a: "Pacific",
        d: "Medium",
        opts: ["Atlantic", "Indian", "Pacific", "Arctic"],
    },
    {
        q: "HTML stands for?",
        a: "HyperText Markup Language",
        d: "Easy",
        opts: [
            "HighText Markup Language",
            "HyperText Markup Language",
            "Hyperlink Markup Language",
            "Hyper Transfer Markup Language",
        ],
    },
    { q: "Year the iPhone launched?", a: "2007", d: "Medium" },
    {
        q: "Pythagorean theorem a² + b² = ?",
        a: "c²",
        d: "Easy",
        opts: ["c²", "2ab", "a²b²", "abc"],
    },
    {
        q: "Chemical symbol for Gold?",
        a: "Au",
        d: "Easy",
        opts: ["Ag", "Au", "Gd", "Go"],
    },
    {
        q: 'Author of "The Hobbit"?',
        a: "J.R.R. Tolkien",
        d: "Medium",
        opts: [
            "C.S. Lewis",
            "J.R.R. Tolkien",
            "G.R.R. Martin",
            "Philip Pullman",
        ],
    },
];

export function buildQuestions(
    difficulty: Difficulty,
    count: number
): Question[] {
    const pool = BANK.filter((b) => b.d === difficulty);
    const padded =
        pool.length >= count
            ? shuffle(pool).slice(0, count)
            : shuffle([...pool, ...shuffle(BANK).slice(0, count)]);
    return padded.slice(0, count).map((item) => {
        const isHard = difficulty === "Hard" || !item.opts;
        const type = isHard ? "free" : "mcq";
        const options = item.opts
            ? shuffle(item.opts).map((text) => ({ id: nid(), text }))
            : undefined;
        return { id: nid(), type, prompt: item.q, options, answer: item.a };
    });
}

export function difficultyTimerMs(difficulty: Difficulty): number | undefined {
    if (difficulty === "Easy") return undefined;
    return difficulty === "Medium" ? 30000 : 20000;
}
