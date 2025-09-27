/**
 * WebSocket diagnostics and API testing utilities
 */

interface DiagnosticResult {
    test: string;
    status: "pass" | "fail" | "warn";
    message: string;
    details?: any;
}

export async function runWebSocketDiagnostics(
    sessionCode: string
): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    // Test 1: Check environment variables
    const apiUrl = import.meta.env.VITE_API_URL;
    const wsUrl = import.meta.env.VITE_WS_URL;
    const apiKey = import.meta.env.VITE_API_KEY;

    results.push({
        test: "Environment Variables",
        status: apiUrl && apiKey ? "pass" : "warn",
        message: `API URL: ${apiUrl || "not set"}, WS URL: ${
            wsUrl || "not set"
        }, API Key: ${apiKey ? "set" : "not set"}`,
        details: { apiUrl, wsUrl, hasApiKey: !!apiKey },
    });

    // Test 2: Check API connectivity
    try {
        const response = await fetch(
            `${apiUrl || "https://api.phun.party"}/health`,
            {
                headers: {
                    "X-API-Key": apiKey || "",
                    Accept: "application/json",
                },
            }
        );

        results.push({
            test: "API Health Check",
            status: response.ok ? "pass" : "fail",
            message: `Status: ${response.status} ${response.statusText}`,
            details: {
                status: response.status,
                headers: Object.fromEntries(response.headers),
            },
        });
    } catch (error) {
        results.push({
            test: "API Health Check",
            status: "fail",
            message: `Failed to connect: ${
                error instanceof Error ? error.message : error
            }`,
            details: { error },
        });
    }

    // Test 3: Check session status endpoint
    try {
        const response = await fetch(
            `${
                apiUrl || "https://api.phun.party"
            }/game-logic/status/${sessionCode}`,
            {
                headers: {
                    "X-API-Key": apiKey || "",
                    Accept: "application/json",
                },
            }
        );

        if (response.ok) {
            const data = await response.json();
            results.push({
                test: "Session Status API",
                status: "pass",
                message: `Session found and accessible`,
                details: { status: response.status, data },
            });
        } else {
            const errorText = await response.text();
            results.push({
                test: "Session Status API",
                status: "fail",
                message: `Status: ${response.status} - ${errorText}`,
                details: { status: response.status, error: errorText },
            });
        }
    } catch (error) {
        results.push({
            test: "Session Status API",
            status: "fail",
            message: `Failed to check session: ${
                error instanceof Error ? error.message : error
            }`,
            details: { error },
        });
    }

    // Test 4: WebSocket URL validation
    const wsFullUrl = `wss://api.phun.party/ws/session/${sessionCode}?client_type=web`;
    results.push({
        test: "WebSocket URL",
        status: "pass",
        message: `WebSocket URL: ${wsFullUrl}`,
        details: { url: wsFullUrl },
    });

    // Test 5: WebSocket connection test
    return new Promise((resolve) => {
        const testWs = new WebSocket(wsFullUrl);
        const timeout = setTimeout(() => {
            testWs.close();
            results.push({
                test: "WebSocket Connection",
                status: "fail",
                message: "Connection timeout (5s)",
                details: { timeout: true },
            });
            resolve(results);
        }, 5000);

        testWs.onopen = () => {
            clearTimeout(timeout);
            results.push({
                test: "WebSocket Connection",
                status: "pass",
                message: "Connection successful",
                details: { connected: true },
            });
            testWs.close();
            resolve(results);
        };

        testWs.onerror = () => {
            clearTimeout(timeout);
            results.push({
                test: "WebSocket Connection",
                status: "fail",
                message: "Connection failed",
                details: { error: true },
            });
            resolve(results);
        };

        testWs.onclose = (event) => {
            clearTimeout(timeout);
            if (event.code !== 1000) {
                results.push({
                    test: "WebSocket Connection",
                    status: "fail",
                    message: `Connection closed with code ${event.code}: ${
                        event.reason || "<no reason>"
                    }`,
                    details: {
                        code: event.code,
                        reason: event.reason,
                        wasClean: event.wasClean,
                    },
                });
                resolve(results);
            }
        };
    });
}

export function logDiagnosticResults(results: DiagnosticResult[]) {
    console.log("🔧 WebSocket Diagnostics Results:");
    console.log("=================================");

    results.forEach((result, index) => {
        const icon =
            result.status === "pass"
                ? "✅"
                : result.status === "warn"
                ? "⚠️"
                : "❌";
        console.log(`${index + 1}. ${icon} ${result.test}: ${result.message}`);
        if (result.details) {
            console.log("   Details:", result.details);
        }
    });

    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const warned = results.filter((r) => r.status === "warn").length;

    console.log(
        `\n📊 Summary: ${passed} passed, ${warned} warnings, ${failed} failed`
    );
    return results;
}
