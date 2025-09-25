import { useState, useEffect } from "react";

export interface ConnectionIndicatorProps {
    className?: string;
    showText?: boolean;
    size?: "sm" | "md" | "lg";
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
    className = "",
    showText = false,
    size = "md",
}) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showOfflineWarning, setShowOfflineWarning] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowOfflineWarning(false);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowOfflineWarning(true);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // Auto-hide offline warning after 5 seconds
    useEffect(() => {
        if (showOfflineWarning) {
            const timer = setTimeout(() => {
                setShowOfflineWarning(false);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [showOfflineWarning]);

    const sizeClasses = {
        sm: "w-2 h-2",
        md: "w-3 h-3",
        lg: "w-4 h-4",
    };

    const textSizeClasses = {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
    };

    if (isOnline && !showOfflineWarning) {
        return null; // Don't show anything when online
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div
                className={`
                    ${sizeClasses[size]} 
                    rounded-full 
                    ${isOnline ? "bg-green-500" : "bg-red-500"}
                    ${!isOnline ? "animate-pulse" : ""}
                `}
                title={isOnline ? "Connected" : "No internet connection"}
            />
            {showText && (
                <span
                    className={`
                        ${textSizeClasses[size]}
                        ${isOnline ? "text-green-400" : "text-red-400"}
                    `}
                >
                    {isOnline ? "Connected" : "Offline"}
                </span>
            )}
        </div>
    );
};

export default ConnectionIndicator;
