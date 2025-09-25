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

    const testCors = async () => {
        setIsLoading(true);
        setTestResult("Testing CORS directly to production API...");

        try {
            // Test direct request to production API (should fail if CORS not configured)
            const response = await fetch("https://api.phun.party/auth/login", {
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
                `✅ Direct API Request Success (${response.status}): ${result}\n\n🎉 CORS is working! The server has proper CORS configuration.`
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            if (
                errorMessage.toLowerCase().includes("cors") ||
                errorMessage.toLowerCase().includes("cross-origin") ||
                errorMessage.toLowerCase().includes("network")
            ) {
                setTestResult(
                    `❌ CORS Error Confirmed: ${errorMessage}\n\n🔧 Server needs CORS configuration. Check the deployment guide.`
                );
            } else {
                setTestResult(
                    `❌ Direct API Test Failed: ${errorMessage}\n\nThis might be a server error rather than CORS.`
                );
            }
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
                    {isLoading ? "Testing..." : "Test Login (via Proxy)"}
                </button>
                <button
                    onClick={testCors}
                    disabled={isLoading}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                >
                    {isLoading ? "Testing..." : "Test CORS Direct"}
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
