import React, { useState, useEffect } from "react";
import { MCQOption } from "@/types";
import { haptic, useTouchButton } from "@/hooks/useTouchGestures";

interface MobileAnswerSelectorProps {
    options: MCQOption[];
    onSelect: (optionId: string) => void;
    selectedOption?: string;
    isSubmitting?: boolean;
    disabled?: boolean;
    timeRemaining?: number;
}

export default function MobileAnswerSelector({
    options,
    onSelect,
    selectedOption,
    isSubmitting = false,
    disabled = false,
    timeRemaining,
}: MobileAnswerSelectorProps) {
    const [animatedSelection, setAnimatedSelection] = useState<string | null>(
        null
    );
    const [showTimeWarning, setShowTimeWarning] = useState(false);

    // Show warning when time is running low
    useEffect(() => {
        if (timeRemaining && timeRemaining <= 10 && timeRemaining > 0) {
            setShowTimeWarning(true);
            haptic.medium();
        } else {
            setShowTimeWarning(false);
        }
    }, [timeRemaining]);

    const handleOptionSelect = (optionId: string) => {
        if (disabled || isSubmitting) return;

        // Animate selection
        setAnimatedSelection(optionId);
        haptic.success();

        // Call the callback after a brief animation
        setTimeout(() => {
            onSelect(optionId);
            setAnimatedSelection(null);
        }, 150);
    };

    const OptionButton = ({
        option,
        index,
    }: {
        option: MCQOption;
        index: number;
    }) => {
        const { buttonProps } = useTouchButton();
        const isSelected = selectedOption === option.id;
        const isAnimating = animatedSelection === option.id;

        // Color scheme for options
        const colors = [
            "bg-red-500 hover:bg-red-400 active:bg-red-600",
            "bg-blue-500 hover:bg-blue-400 active:bg-blue-600",
            "bg-green-500 hover:bg-green-400 active:bg-green-600",
            "bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600",
        ];

        const baseColor = colors[index % colors.length];

        return (
            <button
                {...buttonProps}
                onClick={() => handleOptionSelect(option.id)}
                disabled={disabled || isSubmitting}
                className={`
          relative w-full p-4 rounded-2xl font-semibold text-white text-lg
          shadow-lg active:shadow-md
          transition-all duration-200 ease-out
          touch-manipulation
          ${
              isSelected
                  ? "ring-4 ring-white ring-opacity-50 transform scale-105"
                  : "hover:transform hover:scale-102"
          }
          ${isAnimating ? "animate-pulse" : ""}
          ${
              disabled || isSubmitting
                  ? "opacity-50 cursor-not-allowed"
                  : baseColor
          }
          ${buttonProps.className}
        `}
                style={{ minHeight: "64px" }}
            >
                {/* Option letter indicator */}
                <div className="absolute top-2 left-2 w-6 h-6 bg-black/20 rounded-full flex items-center justify-center text-sm font-bold">
                    {String.fromCharCode(65 + index)} {/* A, B, C, D */}
                </div>

                {/* Option text */}
                <div className="text-center pt-2">{option.text}</div>

                {/* Selection indicator */}
                {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center animate-bounce">
                        <span className="text-green-600 text-sm font-bold">
                            ✓
                        </span>
                    </div>
                )}

                {/* Loading indicator */}
                {isSubmitting && isSelected && (
                    <div className="absolute inset-0 bg-black/20 rounded-2xl flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </button>
        );
    };

    return (
        <div className="space-y-4">
            {/* Time warning */}
            {showTimeWarning && timeRemaining && (
                <div className="bg-orange-500 text-white px-4 py-2 rounded-lg text-center font-semibold animate-pulse">
                    ⏰ {timeRemaining}s remaining!
                </div>
            )}

            {/* Options grid */}
            <div className="grid gap-4">
                {options.map((option, index) => (
                    <OptionButton
                        key={option.id}
                        option={option}
                        index={index}
                    />
                ))}
            </div>

            {/* Selection feedback */}
            {selectedOption && (
                <div className="text-center p-4 bg-green-900/30 border border-green-500/30 rounded-lg text-green-200">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-2xl">✓</span>
                        <span className="font-semibold">Answer Selected!</span>
                    </div>
                    <p className="text-sm opacity-80">
                        Your answer has been recorded. You can change it until
                        time runs out.
                    </p>
                </div>
            )}

            {/* Submission status */}
            {isSubmitting && (
                <div className="text-center p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg text-blue-200">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-semibold">Submitting...</span>
                    </div>
                    <p className="text-sm opacity-80">
                        Please wait while we process your answer.
                    </p>
                </div>
            )}
        </div>
    );
}
