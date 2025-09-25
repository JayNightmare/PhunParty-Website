import { useEffect, useRef, useState } from "react";

interface TouchPoint {
    x: number;
    y: number;
    timestamp: number;
}

interface SwipeGestureOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onPullToRefresh?: () => Promise<void>;
    threshold?: number;
    velocity?: number;
    preventDefault?: boolean;
}

export function useTouchGestures(options: SwipeGestureOptions) {
    const {
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        onPullToRefresh,
        threshold = 50,
        velocity = 0.3,
        preventDefault = true,
    } = options;

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const startTouch = useRef<TouchPoint | null>(null);
    const lastTouch = useRef<TouchPoint | null>(null);
    const containerRef = useRef<HTMLElement | null>(null);

    const handleTouchStart = (event: TouchEvent) => {
        if (preventDefault) {
            event.preventDefault();
        }

        const touch = event.touches[0];
        const touchPoint: TouchPoint = {
            x: touch.clientX,
            y: touch.clientY,
            timestamp: Date.now(),
        };

        startTouch.current = touchPoint;
        lastTouch.current = touchPoint;
    };

    const handleTouchMove = (event: TouchEvent) => {
        if (!startTouch.current || !lastTouch.current) return;

        if (preventDefault) {
            event.preventDefault();
        }

        const touch = event.touches[0];
        const currentTouch: TouchPoint = {
            x: touch.clientX,
            y: touch.clientY,
            timestamp: Date.now(),
        };

        // Handle pull-to-refresh
        if (onPullToRefresh && !isRefreshing) {
            const deltaY = currentTouch.y - startTouch.current.y;
            const scrollTop = containerRef.current?.scrollTop || 0;

            if (scrollTop <= 0 && deltaY > 0) {
                const distance = Math.min(deltaY * 0.5, 100); // Damping effect
                setPullDistance(distance);

                if (distance > 60) {
                    // Provide haptic feedback when threshold is reached
                    if ("vibrate" in navigator) {
                        navigator.vibrate(10);
                    }
                }
            }
        }

        lastTouch.current = currentTouch;
    };

    const handleTouchEnd = (event: TouchEvent) => {
        if (!startTouch.current || !lastTouch.current) return;

        if (preventDefault) {
            event.preventDefault();
        }

        const deltaX = lastTouch.current.x - startTouch.current.x;
        const deltaY = lastTouch.current.y - startTouch.current.y;
        const deltaTime =
            lastTouch.current.timestamp - startTouch.current.timestamp;

        const velocityX = Math.abs(deltaX) / deltaTime;
        const velocityY = Math.abs(deltaY) / deltaTime;

        // Handle pull-to-refresh
        if (onPullToRefresh && pullDistance > 60 && !isRefreshing) {
            setIsRefreshing(true);
            onPullToRefresh().finally(() => {
                setIsRefreshing(false);
                setPullDistance(0);
            });
        } else {
            setPullDistance(0);
        }

        // Handle swipe gestures
        if (Math.abs(deltaX) > threshold && velocityX > velocity) {
            if (deltaX > 0 && onSwipeRight) {
                onSwipeRight();
                // Haptic feedback
                if ("vibrate" in navigator) {
                    navigator.vibrate(20);
                }
            } else if (deltaX < 0 && onSwipeLeft) {
                onSwipeLeft();
                // Haptic feedback
                if ("vibrate" in navigator) {
                    navigator.vibrate(20);
                }
            }
        }

        if (Math.abs(deltaY) > threshold && velocityY > velocity) {
            if (deltaY > 0 && onSwipeDown) {
                onSwipeDown();
                // Haptic feedback
                if ("vibrate" in navigator) {
                    navigator.vibrate(15);
                }
            } else if (deltaY < 0 && onSwipeUp) {
                onSwipeUp();
                // Haptic feedback
                if ("vibrate" in navigator) {
                    navigator.vibrate(15);
                }
            }
        }

        startTouch.current = null;
        lastTouch.current = null;
    };

    const attachGestures = (element: HTMLElement | null) => {
        if (!element) return;

        containerRef.current = element;

        element.addEventListener("touchstart", handleTouchStart, {
            passive: false,
        });
        element.addEventListener("touchmove", handleTouchMove, {
            passive: false,
        });
        element.addEventListener("touchend", handleTouchEnd, {
            passive: false,
        });

        return () => {
            element.removeEventListener("touchstart", handleTouchStart);
            element.removeEventListener("touchmove", handleTouchMove);
            element.removeEventListener("touchend", handleTouchEnd);
        };
    };

    return {
        attachGestures,
        isRefreshing,
        pullDistance,
    };
}

// Haptic feedback utility
export const haptic = {
    light: () => {
        if ("vibrate" in navigator) {
            navigator.vibrate(10);
        }
    },
    medium: () => {
        if ("vibrate" in navigator) {
            navigator.vibrate(20);
        }
    },
    heavy: () => {
        if ("vibrate" in navigator) {
            navigator.vibrate([30, 10, 30]);
        }
    },
    success: () => {
        if ("vibrate" in navigator) {
            navigator.vibrate([20, 10, 20]);
        }
    },
    error: () => {
        if ("vibrate" in navigator) {
            navigator.vibrate([50, 20, 50]);
        }
    },
};

// Touch-friendly button press effect
export function useTouchButton() {
    const [isPressed, setIsPressed] = useState(false);

    const buttonProps = {
        onTouchStart: () => {
            setIsPressed(true);
            haptic.light();
        },
        onTouchEnd: () => {
            setIsPressed(false);
        },
        onTouchCancel: () => {
            setIsPressed(false);
        },
        className: isPressed
            ? "transform scale-95 transition-transform duration-150"
            : "transition-transform duration-150",
    };

    return { isPressed, buttonProps };
}
