import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Card from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

type VerificationState = "verifying" | "verified" | "error";

const verifiedTokenKey = (token: string) =>
    `phunparty:verified-email-token:${token}`;

function verificationErrorMessage(error: unknown) {
    const fallback = "This verification link is invalid or expired.";
    if (!(error instanceof Error)) return fallback;

    try {
        const parsed = JSON.parse(error.message);
        if (typeof parsed?.detail === "string") return parsed.detail;
    } catch {
        // The error was already plain text.
    }

    return error.message || fallback;
}

export default function VerifyEmail() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { completeEmailVerification, error, clearError } = useAuth();
    const { showSuccess } = useToast();
    const [state, setState] = useState<VerificationState>("verifying");
    const [localError, setLocalError] = useState<string | null>(null);
    const hasStarted = useRef(false);

    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;
        clearError();

        const token = searchParams.get("token");
        if (!token) {
            if (searchParams.get("verified") === "1") {
                setState("verified");
                return;
            }

            setState("error");
            setLocalError("This verification link is missing its token.");
            return;
        }

        if (sessionStorage.getItem(verifiedTokenKey(token)) === "1") {
            setState("verified");
            return;
        }

        completeEmailVerification(token)
            .then(() => {
                sessionStorage.setItem(verifiedTokenKey(token), "1");
                setState("verified");
                showSuccess("Email verified. Welcome to PhunParty!");
                navigate("/verify-email?verified=1", { replace: true });
                window.setTimeout(() => {
                    navigate("/account", { replace: true });
                }, 1800);
            })
            .catch((err) => {
                if (sessionStorage.getItem(verifiedTokenKey(token)) === "1") {
                    setState("verified");
                    navigate("/verify-email?verified=1", { replace: true });
                    return;
                }

                setState("error");
                setLocalError(verificationErrorMessage(err));
            });
    }, [clearError, completeEmailVerification, navigate, searchParams, showSuccess]);

    const displayError = localError || error;

    return (
        <main className="max-w-md mx-auto px-4 py-8">
            <Card className="p-6 text-center">
                {state === "verifying" && (
                    <>
                        <h1 className="text-2xl font-semibold">
                            Verifying Email
                        </h1>
                        <p className="text-stone-300 mt-3">
                            Hang tight while we verify your PhunParty account.
                        </p>
                    </>
                )}

                {state === "verified" && (
                    <>
                        <h1 className="text-2xl font-semibold">
                            Email Verified
                        </h1>
                        <p className="text-stone-300 mt-3">
                            You are signed in and ready to continue.
                        </p>
                        <div className="mt-6 space-y-3">
                            <button
                                type="button"
                                onClick={() => navigate("/account", { replace: true })}
                                className="w-full px-4 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold hover:bg-tea-400 transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    </>
                )}

                {state === "error" && (
                    <>
                        <h1 className="text-2xl font-semibold">
                            Link Not Verified
                        </h1>
                        <p className="text-stone-300 mt-3">
                            {displayError ||
                                "This verification link is invalid or expired."}
                        </p>
                        <div className="mt-6">
                            <Link
                                to="/login"
                                className="inline-block w-full px-4 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold hover:bg-tea-400 transition-colors"
                            >
                                Go to Sign In
                            </Link>
                        </div>
                    </>
                )}
            </Card>
        </main>
    );
}
