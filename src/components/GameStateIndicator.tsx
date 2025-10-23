import React from "react";

interface GameStateIndicatorProps {
    game_state: "waiting" | "active" | "paused" | "ended";
    currentQuestion?: number;
    totalQuestions?: number;
    playersCount?: number;
    playersAnswered?: number;
}

export default function GameStateIndicator({
    game_state,
    currentQuestion,
    totalQuestions,
    playersCount = 0,
    playersAnswered = 0,
}: GameStateIndicatorProps) {
    const getStateColor = () => {
        switch (game_state) {
            case "waiting":
                return "bg-blue-900/30 border-blue-500/30 text-blue-200";
            case "active":
                return "bg-green-900/30 border-green-500/30 text-green-200";
            case "paused":
                return "bg-orange-900/30 border-orange-500/30 text-orange-200";
            case "ended":
                return "bg-purple-900/30 border-purple-500/30 text-purple-200";
            default:
                return "bg-stone-700/30 border-stone-500/30 text-stone-200";
        }
    };

    const getStateIcon = () => {
        switch (game_state) {
            case "waiting":
                return "🟡";
            case "active":
                return "🟢";
            case "paused":
                return "⏸️";
            case "ended":
                return "🏁";
            default:
                return "⚪";
        }
    };

    const getStateText = () => {
        switch (game_state) {
            case "waiting":
                return "Waiting to Start";
            case "active":
                return "Game Active";
            case "paused":
                return "Game Paused";
            case "ended":
                return "Game Ended";
            default:
                return "Unknown State";
        }
    };

    const progressPercentage =
        currentQuestion && totalQuestions
            ? (currentQuestion / totalQuestions) * 100
            : 0;

    const answerPercentage =
        playersCount > 0 ? (playersAnswered / playersCount) * 100 : 0;

    return (
        <div className={`p-4 rounded-xl border ${getStateColor()}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{getStateIcon()}</span>
                    <span className="font-medium">{getStateText()}</span>
                </div>

                {currentQuestion && totalQuestions && (
                    <div className="text-sm font-mono">
                        Q{currentQuestion}/{totalQuestions}
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            {totalQuestions && totalQuestions > 0 && (
                <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span>Game Progress</span>
                        <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <div className="w-full bg-ink-700 rounded-full h-2">
                        <div
                            className="bg-tea-500 h-2 rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.min(
                                    100,
                                    Math.max(0, progressPercentage)
                                )}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Player Response Progress */}
            {game_state === "active" && playersCount > 0 && (
                <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span>Players Answered</span>
                        <span>
                            {playersAnswered}/{playersCount}
                        </span>
                    </div>
                    <div className="w-full bg-ink-700 rounded-full h-2">
                        <div
                            className="bg-peach-500 h-2 rounded-full transition-all duration-300"
                            style={{
                                width: `${Math.min(
                                    100,
                                    Math.max(0, answerPercentage)
                                )}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Additional State Info */}
            {game_state === "paused" && (
                <div className="text-xs mt-2 opacity-75">
                    Timer paused • Players cannot submit answers
                </div>
            )}

            {game_state === "waiting" && (
                <div className="text-xs mt-2 opacity-75">
                    Ready to begin • {playersCount} players connected
                </div>
            )}
        </div>
    );
}
