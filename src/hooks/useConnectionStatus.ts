import { useEffect, useRef } from "react";

export interface UseConnectionStatusOptions {
    onOnline?: () => void;
    onOffline?: () => void;
    pingUrl?: string;
    pingInterval?: number; // in milliseconds
}

export interface UseConnectionStatusReturn {
    isOnline: boolean;
    isPingSuccessful: boolean | null;
    lastPingTime: number | null;
}

const useConnectionStatus = (options: UseConnectionStatusOptions = {}) => {
    const {
        onOnline,
        onOffline,
        pingUrl = "/api/health", // Default health check endpoint
        pingInterval = 30000, // 30 seconds
    } = options;

    const isOnlineRef = useRef(navigator.onLine);
    const isPingSuccessfulRef = useRef<boolean | null>(null);
    const lastPingTimeRef = useRef<number | null>(null);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const performPing = async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch(pingUrl, {
                method: "HEAD",
                signal: controller.signal,
                cache: "no-store",
            });

            clearTimeout(timeoutId);

            const isSuccessful = response.ok;
            isPingSuccessfulRef.current = isSuccessful;
            lastPingTimeRef.current = Date.now();

            return isSuccessful;
        } catch (error) {
            isPingSuccessfulRef.current = false;
            lastPingTimeRef.current = Date.now();
            return false;
        }
    };

    const startPinging = () => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
        }

        // Initial ping
        performPing();

        // Set up interval
        pingIntervalRef.current = setInterval(performPing, pingInterval);
    };

    const stopPinging = () => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
    };

    useEffect(() => {
        const handleOnline = () => {
            isOnlineRef.current = true;
            onOnline?.();
            startPinging();
        };

        const handleOffline = () => {
            isOnlineRef.current = false;
            onOffline?.();
            stopPinging();
        };

        // Set up event listeners
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Start pinging if online
        if (navigator.onLine) {
            startPinging();
        }

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            stopPinging();
        };
    }, [onOnline, onOffline, pingUrl, pingInterval]);

    return {
        isOnline: isOnlineRef.current,
        isPingSuccessful: isPingSuccessfulRef.current,
        lastPingTime: lastPingTimeRef.current,
    };
};

export default useConnectionStatus;
