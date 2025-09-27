import React, { useState } from "react";
import {
    runWebSocketDiagnostics,
    logDiagnosticResults,
} from "@/lib/diagnostics";

interface DiagnosticResult {
    test: string;
    status: "pass" | "fail" | "warn";
    message: string;
    details?: any;
}

interface WebSocketDiagnosticsProps {
    sessionCode: string;
}

const WebSocketDiagnostics: React.FC<WebSocketDiagnosticsProps> = ({
    sessionCode,
}) => {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<DiagnosticResult[]>([]);
    const [lastRun, setLastRun] = useState<Date | null>(null);

    const runDiagnostics = async () => {
        setIsRunning(true);
        try {
            console.log(
                `🔧 Running WebSocket diagnostics for session: ${sessionCode}`
            );
            const diagnosticResults = await runWebSocketDiagnostics(
                sessionCode
            );
            logDiagnosticResults(diagnosticResults);
            setResults(diagnosticResults);
            setLastRun(new Date());
        } catch (error) {
            console.error("Failed to run diagnostics:", error);
        } finally {
            setIsRunning(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "pass":
                return "✅";
            case "warn":
                return "⚠️";
            case "fail":
                return "❌";
            default:
                return "❓";
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "pass":
                return "text-green-600";
            case "warn":
                return "text-yellow-600";
            case "fail":
                return "text-red-600";
            default:
                return "text-gray-600";
        }
    };

    if (!sessionCode) {
        return null;
    }

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                    WebSocket Diagnostics
                </h3>
                <button
                    onClick={runDiagnostics}
                    disabled={isRunning}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isRunning ? "Running..." : "Run Diagnostics"}
                </button>
            </div>

            {lastRun && (
                <p className="text-sm text-gray-600 mb-4">
                    Last run: {lastRun.toLocaleTimeString()}
                </p>
            )}

            {results.length > 0 && (
                <div className="space-y-3">
                    {results.map((result, index) => (
                        <div
                            key={index}
                            className="bg-white border border-gray-200 rounded p-3"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <span className="text-lg">
                                        {getStatusIcon(result.status)}
                                    </span>
                                    <span className="font-medium text-gray-800">
                                        {result.test}
                                    </span>
                                </div>
                                <span
                                    className={`text-sm ${getStatusColor(
                                        result.status
                                    )}`}
                                >
                                    {result.status.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                                {result.message}
                            </p>
                            {result.details && (
                                <details className="mt-2">
                                    <summary className="text-xs text-gray-500 cursor-pointer">
                                        Show details
                                    </summary>
                                    <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-x-auto">
                                        {JSON.stringify(
                                            result.details,
                                            null,
                                            2
                                        )}
                                    </pre>
                                </details>
                            )}
                        </div>
                    ))}

                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
                        <h4 className="font-medium text-blue-800 mb-2">
                            Summary
                        </h4>
                        <div className="text-sm text-blue-700">
                            <span className="inline-block mr-4">
                                ✅{" "}
                                {
                                    results.filter((r) => r.status === "pass")
                                        .length
                                }{" "}
                                passed
                            </span>
                            <span className="inline-block mr-4">
                                ⚠️{" "}
                                {
                                    results.filter((r) => r.status === "warn")
                                        .length
                                }{" "}
                                warnings
                            </span>
                            <span className="inline-block">
                                ❌{" "}
                                {
                                    results.filter((r) => r.status === "fail")
                                        .length
                                }{" "}
                                failed
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-4 text-sm text-gray-600">
                <p>
                    <strong>Session Code:</strong> {sessionCode}
                </p>
                <p>
                    <strong>Expected WebSocket URL:</strong>{" "}
                    wss://api.phun.party/ws/session/{sessionCode}
                    ?client_type=web
                </p>
            </div>
        </div>
    );
};

export default WebSocketDiagnostics;
