import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
    id,
    type,
    message,
    duration = 5000,
    onDismiss,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        const enterTimer = setTimeout(() => setIsVisible(true), 10);

        // Auto dismiss after duration
        const dismissTimer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onDismiss(id), 300); // Wait for exit animation
        }, duration);

        return () => {
            clearTimeout(enterTimer);
            clearTimeout(dismissTimer);
        };
    }, [id, duration, onDismiss]);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(() => onDismiss(id), 300);
    };

    const typeStyles = {
        success: "bg-green-900/90 border-green-700 text-green-100",
        error: "bg-red-900/90 border-red-700 text-red-100",
        warning: "bg-yellow-900/90 border-yellow-700 text-yellow-100",
        info: "bg-blue-900/90 border-blue-700 text-blue-100",
    };

    const icons = {
        success: "✅",
        error: "❌",
        warning: "⚠️",
        info: "ℹ️",
    };

    return (
        <div
            className={`
                flex items-center gap-3 p-4 rounded-xl border backdrop-blur-sm
                transform transition-all duration-300 ease-out
                ${typeStyles[type]}
                ${
                    isVisible && !isExiting
                        ? "translate-x-0 opacity-100"
                        : "translate-x-full opacity-0"
                }
            `}
            role="alert"
            aria-live="polite"
        >
            <span className="text-lg">{icons[type]}</span>
            <p className="flex-1 text-sm font-medium">{message}</p>
            <button
                onClick={handleDismiss}
                className="text-current opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss notification"
            >
                ✕
            </button>
        </div>
    );
};

interface ToastContainerProps {
    toasts: Array<{
        id: string;
        type: ToastType;
        message: string;
        duration?: number;
    }>;
    onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
    toasts,
    onDismiss,
}) => {
    return createPortal(
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
            ))}
        </div>,
        document.body
    );
};

export default Toast;
