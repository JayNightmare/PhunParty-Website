import React, { createContext, useContext, useState, useCallback } from "react";
import { ToastContainer, ToastType } from "@/components/Toast";

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    showSuccess: (message: string, duration?: number) => void;
    showError: (message: string, duration?: number) => void;
    showWarning: (message: string, duration?: number) => void;
    showInfo: (message: string, duration?: number) => void;
    dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};

interface ToastProviderProps {
    children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const generateId = () => `toast-${Date.now()}-${Math.random()}`;

    const showToast = useCallback(
        (message: string, type: ToastType = "info", duration = 5000) => {
            const id = generateId();
            const newToast: Toast = { id, message, type, duration };

            setToasts((prev) => [...prev, newToast]);
        },
        []
    );

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showSuccess = useCallback(
        (message: string, duration?: number) =>
            showToast(message, "success", duration),
        [showToast]
    );

    const showError = useCallback(
        (message: string, duration?: number) =>
            showToast(message, "error", duration),
        [showToast]
    );

    const showWarning = useCallback(
        (message: string, duration?: number) =>
            showToast(message, "warning", duration),
        [showToast]
    );

    const showInfo = useCallback(
        (message: string, duration?: number) =>
            showToast(message, "info", duration),
        [showToast]
    );

    const value: ToastContextType = {
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        dismissToast,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </ToastContext.Provider>
    );
};
