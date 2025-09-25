import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import Card from "./Card";
import { LoadingButton } from "./Loading";

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
    isLoading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "info",
    isLoading = false,
}) => {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen && !isLoading) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            // Prevent body scroll
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, isLoading, onClose]);

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !isLoading) {
            onClose();
        }
    };

    const handleConfirm = async () => {
        try {
            await onConfirm();
        } catch (error) {
            // Error handling should be done by the parent component
            console.error("Confirm action failed:", error);
        }
    };

    const variantStyles = {
        danger: {
            icon: "🚨",
            confirmClass: "bg-red-600 hover:bg-red-700 text-white",
        },
        warning: {
            icon: "⚠️",
            confirmClass: "bg-yellow-600 hover:bg-yellow-700 text-white",
        },
        info: {
            icon: "ℹ️",
            confirmClass: "bg-tea-500 hover:bg-tea-400 text-ink-900",
        },
    };

    const style = variantStyles[variant];

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-message"
        >
            <Card className="p-6 max-w-md mx-4 w-full">
                <div className="text-center">
                    <div className="text-4xl mb-4">{style.icon}</div>
                    <h2
                        id="dialog-title"
                        className="text-xl font-semibold mb-2"
                    >
                        {title}
                    </h2>
                    <p id="dialog-message" className="text-stone-300 mb-6">
                        {message}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-5 py-3 rounded-2xl bg-ink-700 text-stone-300 hover:bg-ink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {cancelText}
                        </button>
                        <LoadingButton
                            onClick={handleConfirm}
                            isLoading={isLoading}
                            loadingText="Processing..."
                            className={style.confirmClass}
                        >
                            {confirmText}
                        </LoadingButton>
                    </div>
                </div>
            </Card>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
