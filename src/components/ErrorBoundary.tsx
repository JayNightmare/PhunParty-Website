import React from "react";
import Card from "./Card";

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Error caught by boundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="max-w-md mx-auto px-4 py-8">
                    <Card className="p-6">
                        <div className="text-center">
                            <div className="text-4xl mb-4">⚠️</div>
                            <h2 className="text-xl font-semibold mb-2">
                                Something went wrong
                            </h2>
                            <p className="text-stone-400 mb-4">
                                An unexpected error occurred. Please try
                                refreshing the page.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="w-full px-4 py-2 bg-tea-500 text-ink-900 rounded-xl font-medium hover:bg-tea-400 transition-colors"
                                >
                                    Refresh Page
                                </button>
                                <button
                                    onClick={() =>
                                        this.setState({ hasError: false })
                                    }
                                    className="w-full px-4 py-2 bg-ink-700 border border-ink-600 text-stone-300 rounded-xl hover:bg-ink-600 transition-colors"
                                >
                                    Try Again
                                </button>
                            </div>
                            {this.state.error && (
                                <details className="mt-4 text-left">
                                    <summary className="cursor-pointer text-sm text-stone-500">
                                        Error Details
                                    </summary>
                                    <pre className="mt-2 text-xs bg-ink-800 p-3 rounded overflow-auto text-red-400">
                                        {this.state.error.message}
                                    </pre>
                                </details>
                            )}
                        </div>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
