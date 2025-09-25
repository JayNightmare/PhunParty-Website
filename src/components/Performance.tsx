import React, { Suspense, lazy } from "react";
import { LoadingState } from "@/components/Loading";

// Lazy load components for better performance
export const LazyNewSession = lazy(() => import("@/pages/NewSession"));
export const LazyActiveSessions = lazy(() => import("@/pages/ActiveSessions"));
export const LazyActiveQuiz = lazy(() => import("@/pages/ActiveQuiz"));
export const LazyPostGameStats = lazy(() => import("@/pages/PostGameStats"));
export const LazyAccount = lazy(() => import("@/pages/Account"));
export const LazyEditProfile = lazy(() => import("@/pages/EditProfile"));
export const LazyForgotPassword = lazy(() => import("@/pages/ForgotPassword"));

// Higher-order component for lazy loading with loading state
interface LazyWrapperProps {
    children: React.ReactNode;
    fallback?: React.ComponentType;
}

export function LazyWrapper({
    children,
    fallback: Fallback,
}: LazyWrapperProps) {
    const LoadingFallback =
        Fallback ||
        (() => (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingState message="Loading..." />
            </div>
        ));

    return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}

// Pre-load critical components on idle
export function preloadCriticalComponents() {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        const preloadComponents = [
            () => import("@/pages/Join"),
            () => import("@/pages/ActiveQuiz"),
            () => import("@/pages/NewSession"),
        ];

        preloadComponents.forEach((loadComponent, index) => {
            window.requestIdleCallback(() => {
                setTimeout(() => {
                    loadComponent().catch(() => {
                        // Silently fail - preloading is not critical
                    });
                }, index * 1000); // Stagger preloading
            });
        });
    }
}

// Performance monitoring hook
export function usePerformanceMonitoring() {
    React.useEffect(() => {
        if (typeof window !== "undefined" && "performance" in window) {
            // Log Core Web Vitals
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === "navigation") {
                        console.log(`Page Load Time: ${entry.duration}ms`);
                    }
                    if (entry.entryType === "paint") {
                        console.log(`${entry.name}: ${entry.startTime}ms`);
                    }
                }
            });

            try {
                observer.observe({ entryTypes: ["navigation", "paint"] });
            } catch (error) {
                // Observer not supported
            }

            return () => {
                observer.disconnect();
            };
        }
    }, []);
}

// Image optimization component
interface OptimizedImageProps {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    loading?: "lazy" | "eager";
}

export function OptimizedImage({
    src,
    alt,
    width,
    height,
    className = "",
    loading = "lazy",
}: OptimizedImageProps) {
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);

    const containerStyle = React.useMemo(
        () =>
            ({
                "--img-width": width ? `${width}px` : "auto",
                "--img-height": height ? `${height}px` : "auto",
            } as React.CSSProperties),
        [width, height]
    );

    return (
        <div className={`relative ${className}`} style={containerStyle}>
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 bg-ink-800 animate-pulse rounded" />
            )}
            {hasError ? (
                <div className="absolute inset-0 bg-ink-800 flex items-center justify-center text-stone-500 text-sm rounded">
                    Image unavailable
                </div>
            ) : (
                <img
                    src={src}
                    alt={alt}
                    width={width}
                    height={height}
                    loading={loading}
                    className={`${className} ${
                        isLoaded ? "opacity-100" : "opacity-0"
                    } transition-opacity duration-300`}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setHasError(true)}
                />
            )}
        </div>
    );
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
    elementRef: React.RefObject<Element>,
    {
        threshold = 0,
        root = null,
        rootMargin = "0%",
    }: IntersectionObserverInit = {}
) {
    const [isIntersecting, setIsIntersecting] = React.useState(false);

    React.useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsIntersecting(entry.isIntersecting);
            },
            { threshold, root, rootMargin }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, [elementRef, threshold, root, rootMargin]);

    return isIntersecting;
}

// Debounced search hook
export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState(value);

    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
