import React from "react";

interface WebSocketStatusProps {
    isConnected: boolean;
    isReconnecting?: boolean;
    lastUpdate?: string;
    className?: string;
}

const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
    isConnected,
    isReconnecting = false,
    lastUpdate,
    className = "",
}) => {
    const getStatusText = () => {
        if (isReconnecting) return "Reconnecting...";
        if (isConnected) return "Connected";
        return "Offline";
    };

    const getStatusColor = () => {
        if (isReconnecting) return "text-yellow-400";
        if (isConnected) return "text-green-400";
        return "text-red-400";
    };

    const getStatusIcon = () => {
        if (isReconnecting) return "🔄";
        if (isConnected) return "🟢";
        return "🔴";
    };

    return (
        <div className={`flex items-center gap-2 text-sm ${className}`}>
            <span className="flex items-center gap-1">
                <span>{getStatusIcon()}</span>
                <span className={getStatusColor()}>{getStatusText()}</span>
            </span>
            {lastUpdate && isConnected && (
                <span className="text-stone-500 text-xs">
                    Last: {lastUpdate}
                </span>
            )}
        </div>
    );
};

export default WebSocketStatus;
