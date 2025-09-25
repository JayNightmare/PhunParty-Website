import { useState, useCallback, useRef } from "react";
import { ToastType } from "@/components/Toast";

interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

export const useToast = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idCounter = useRef(0);

    const addToast = useCallback(
        (type: ToastType, message: string, duration?: number) => {
            const id = `toast-${++idCounter.current}`;
            const toast: ToastItem = {
                id,
                type,
                message,
                duration,
            };

            setToasts((prev) => [...prev, toast]);

            return id;
        },
        []
    );

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const success = useCallback(
        (message: string, duration?: number) =>
            addToast("success", message, duration),
        [addToast]
    );

    const error = useCallback(
        (message: string, duration?: number) =>
            addToast("error", message, duration),
        [addToast]
    );

    const warning = useCallback(
        (message: string, duration?: number) =>
            addToast("warning", message, duration),
        [addToast]
    );

    const info = useCallback(
        (message: string, duration?: number) =>
            addToast("info", message, duration),
        [addToast]
    );

    return {
        toasts,
        addToast,
        removeToast,
        success,
        error,
        warning,
        info,
    };
};

// Create a global toast instance for easy usage across components
export const toast = {
    success: (message: string) => {
        // We'll implement this with a global toast manager if needed
        console.log("SUCCESS:", message);
    },
    error: (message: string) => {
        console.log("ERROR:", message);
    },
    warning: (message: string) => {
        console.log("WARNING:", message);
    },
    info: (message: string) => {
        console.log("INFO:", message);
    },
};
