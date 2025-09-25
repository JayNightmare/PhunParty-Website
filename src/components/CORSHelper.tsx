import React, { useState } from "react";
import { testApiConnection } from "@/lib/api";
import { LoadingButton } from "@/components/Loading";

interface CORSHelperProps {
    onClose?: () => void;
}

export default function CORSHelper({ onClose }: CORSHelperProps) {
    const [testResults, setTestResults] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const runDiagnostics = async () => {
        setIsLoading(true);
        try {
            const results = await testApiConnection();
            setTestResults(results);
        } catch (error) {
            setTestResults({
                status: "error",
                details: {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-ink-900 border border-ink-600 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-tea-400">
                            CORS Troubleshooting
                        </h2>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-stone-400 hover:text-stone-200 transition-colors"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl">
                            <h3 className="font-semibold text-red-400 mb-2">
                                CORS Error Detected
                            </h3>
                            <p className="text-sm text-red-300 mb-4">
                                The browser is blocking requests to the API due
                                to Cross-Origin Resource Sharing (CORS) policy.
                            </p>

                            <div className="text-xs text-red-200 space-y-2">
                                <p>
                                    <strong>Common causes:</strong>
                                </p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>
                                        API server doesn't have proper CORS
                                        headers
                                    </li>
                                    <li>
                                        Frontend is not using the development
                                        proxy
                                    </li>
                                    <li>API server is down or misconfigured</li>
                                </ul>
                            </div>
                        </div>

                        <div className="p-4 bg-tea-900/20 border border-tea-800 rounded-xl">
                            <h3 className="font-semibold text-tea-400 mb-2">
                                Quick Fixes
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <p className="font-medium text-tea-300">
                                        1. Development Environment:
                                    </p>
                                    <p className="text-stone-300 ml-4">
                                        Make sure you're running the development
                                        server with{" "}
                                        <code className="bg-ink-800 px-1 rounded">
                                            npm run dev
                                        </code>{" "}
                                        or{" "}
                                        <code className="bg-ink-800 px-1 rounded">
                                            yarn dev
                                        </code>
                                    </p>
                                </div>
                                <div>
                                    <p className="font-medium text-tea-300">
                                        2. Check Environment Variables:
                                    </p>
                                    <p className="text-stone-300 ml-4">
                                        Ensure{" "}
                                        <code className="bg-ink-800 px-1 rounded">
                                            VITE_API_URL
                                        </code>{" "}
                                        and{" "}
                                        <code className="bg-ink-800 px-1 rounded">
                                            VITE_API_KEY
                                        </code>{" "}
                                        are set correctly
                                    </p>
                                </div>
                                <div>
                                    <p className="font-medium text-tea-300">
                                        3. Backend CORS Setup:
                                    </p>
                                    <p className="text-stone-300 ml-4">
                                        The API server needs to allow your
                                        domain in CORS settings
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <LoadingButton
                                onClick={runDiagnostics}
                                isLoading={isLoading}
                                loadingText="Testing..."
                                className="flex-1"
                            >
                                Run API Diagnostics
                            </LoadingButton>
                        </div>

                        {testResults && (
                            <div className="p-4 bg-ink-800 border border-ink-600 rounded-xl">
                                <h4 className="font-semibold text-stone-200 mb-2">
                                    Diagnostic Results
                                </h4>
                                <pre className="text-xs text-stone-300 overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(testResults, null, 2)}
                                </pre>
                            </div>
                        )}

                        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-xl">
                            <h3 className="font-semibold text-blue-400 mb-2">
                                Backend CORS Configuration
                            </h3>
                            <p className="text-sm text-blue-300 mb-3">
                                If you control the backend, add these CORS
                                settings:
                            </p>
                            <pre className="text-xs bg-ink-800 p-3 rounded border text-stone-300 overflow-x-auto">
                                {`# FastAPI Example (main.py)
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://yourapp.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)`}
                            </pre>
                        </div>

                        <div className="p-4 bg-amber-900/20 border border-amber-800 rounded-xl">
                            <h3 className="font-semibold text-amber-400 mb-2">
                                Development Workaround
                            </h3>
                            <p className="text-sm text-amber-300 mb-2">
                                For immediate testing, you can disable CORS in
                                Chrome:
                            </p>
                            <ol className="text-xs text-amber-200 list-decimal list-inside space-y-1 ml-2">
                                <li>Close all Chrome windows</li>
                                <li>
                                    Run:{" "}
                                    <code className="bg-ink-800 px-1 rounded">
                                        chrome --disable-web-security
                                        --user-data-dir=/tmp/chrome
                                    </code>
                                </li>
                                <li>
                                    ⚠️ Only use for development - never for
                                    production!
                                </li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
