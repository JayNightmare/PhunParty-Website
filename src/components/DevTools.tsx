import React, { useState } from "react";
import { testApiConnection } from "../lib/api";

const DevTools: React.FC = () => {
    const [testResult, setTestResult] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

    const runApiTest = async () => {
        setIsLoading(true);
        setTestResult("Testing API connection...");

        try {
            const result = await testApiConnection();
            setTestResult(
                `✅ API Test Success: ${JSON.stringify(result, null, 2)}`
            );
        } catch (error) {
            setTestResult(
                `❌ API Test Failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        } finally {
            setIsLoading(false);
        }
    };

    const testLogin = async () => {
        setIsLoading(true);
        setTestResult("Testing login endpoint...");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    player_email: "test@example.com",
                    password: "testpassword",
                }),
            });

            const result = await response.text();
            setTestResult(
                `✅ Login Endpoint Response (${response.status}): ${result}`
            );
        } catch (error) {
            setTestResult(
                `❌ Login Test Failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Only show in development
    if (import.meta.env.PROD) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-sm z-50">
            <h3 className="font-bold mb-2">🛠️ Dev Tools</h3>
            <div className="space-y-2">
                <button
                    onClick={runApiTest}
                    disabled={isLoading}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                >
                    {isLoading ? "Testing..." : "Test API Connection"}
                </button>
                <button
                    onClick={testLogin}
                    disabled={isLoading}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                >
                    {isLoading ? "Testing..." : "Test Login Endpoint"}
                </button>
            </div>
            {testResult && (
                <div className="mt-2 p-2 bg-gray-700 rounded text-xs max-h-32 overflow-auto">
                    <pre className="whitespace-pre-wrap">{testResult}</pre>
                </div>
            )}
        </div>
    );
};

export default DevTools;
