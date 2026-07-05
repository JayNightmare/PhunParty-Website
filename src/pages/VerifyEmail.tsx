import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Card from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { verifyEmailToken } from "@/lib/api";

type VerificationState = "verifying" | "verified" | "mobile_app" | "error";

const verifiedTokenKey = (token: string) =>
    `phunparty:verified-email-token:${token}`;
const verificationCompleteKey = "phunparty:email-verification-complete";
const pendingVerificationEmailKey = "phunparty:pending-verification-email";
const APP_VERIFY_SCHEME_URL =
    import.meta.env.VITE_APP_VERIFY_SCHEME_URL ||
    "phunpartymobileapp://verify-email";
const APP_INSTALL_URL =
    import.meta.env.VITE_APP_INSTALL_URL || "https://phun.party/#/app";

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

function isMobileBrowser() {
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function buildAppVerificationUrl(token: string) {
    const separator = APP_VERIFY_SCHEME_URL.includes("?") ? "&" : "?";
    return `${APP_VERIFY_SCHEME_URL}${separator}${new URLSearchParams({
        token,
    }).toString()}`;
}

export default function VerifyEmail() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { completeEmailVerification, error, clearError } = useAuth();
    const { showSuccess } = useToast();
    const [state, setState] = useState<VerificationState>("verifying");
    const [localError, setLocalError] = useState<string | null>(null);
    const [mobileToken, setMobileToken] = useState<string | null>(null);
    const [showMobileFallback, setShowMobileFallback] = useState(false);
    const hasStarted = useRef(false);

    const openApp = (token: string) => {
        window.location.href = buildAppVerificationUrl(token);
    };

    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;
        clearError();

        const token = searchParams.get("token");
        if (!token) {
            if (sessionStorage.getItem(verificationCompleteKey) === "1") {
                setState("verified");
                return;
            }

            setState("error");
            setLocalError(
                "Open the verification link from your email, or sign up to request a new verification email."
            );
            return;
        }

        if (sessionStorage.getItem(verifiedTokenKey(token)) === "1") {
            if (isMobileBrowser()) {
                setMobileToken(token);
                setState("mobile_app");
                window.setTimeout(() => setShowMobileFallback(true), 1600);
                openApp(token);
            } else {
                setState("verified");
            }
            return;
        }

        const verify = isMobileBrowser()
            ? verifyEmailToken({ token })
            : completeEmailVerification(token);

        Promise.resolve(verify)
            .then(() => {
                sessionStorage.setItem(verifiedTokenKey(token), "1");
                sessionStorage.setItem(verificationCompleteKey, "1");
                sessionStorage.removeItem(pendingVerificationEmailKey);
                showSuccess("Email verified. Welcome to PhunParty!");
                window.history.replaceState(null, "", "/#/verify-email");

                if (isMobileBrowser()) {
                    setMobileToken(token);
                    setState("mobile_app");
                    window.setTimeout(() => setShowMobileFallback(true), 1600);
                    openApp(token);
                    return;
                }

                setState("verified");
                window.setTimeout(() => {
                    navigate("/account", { replace: true });
                }, 1800);
            })
            .catch((err) => {
                if (sessionStorage.getItem(verifiedTokenKey(token)) === "1") {
                    window.history.replaceState(null, "", "/#/verify-email");
                    if (isMobileBrowser()) {
                        setMobileToken(token);
                        setState("mobile_app");
                        window.setTimeout(
                            () => setShowMobileFallback(true),
                            1600
                        );
                        openApp(token);
                    } else {
                        setState("verified");
                    }
                    return;
                }

                setState("error");
                setLocalError(verificationErrorMessage(err));
            });
    }, [clearError, completeEmailVerification, navigate, searchParams, showSuccess]);

    const displayError = localError || error;

    const handleContinueOnWebsite = async () => {
        if (!mobileToken) {
            navigate("/login", { replace: true });
            return;
        }

        await completeEmailVerification(mobileToken);
        navigate("/account", { replace: true });
    };

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

                {state === "mobile_app" && (
                    <>
                        <h1 className="text-2xl font-semibold">
                            Email Verified
                        </h1>
                        <p className="text-stone-300 mt-3">
                            We are opening PhunParty on your phone now.
                        </p>

                        <div className="mt-6 space-y-3">
                            <button
                                type="button"
                                onClick={() => mobileToken && openApp(mobileToken)}
                                className="w-full px-4 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold hover:bg-tea-400 transition-colors"
                            >
                                Open App
                            </button>

                            {showMobileFallback && (
                                <>
                                    <a
                                        href={APP_INSTALL_URL}
                                        className="block w-full px-4 py-3 rounded-2xl bg-ink-700 text-stone-100 font-semibold hover:bg-ink-600 transition-colors"
                                    >
                                        Install PhunParty
                                    </a>
                                    <button
                                        type="button"
                                        onClick={handleContinueOnWebsite}
                                        className="w-full text-sm text-tea-400 hover:text-tea-300 transition-colors"
                                    >
                                        Continue on website instead
                                    </button>
                                    <p className="text-xs text-stone-500">
                                        If the app did not open, it may not be
                                        installed on this device yet.
                                    </p>
                                </>
                            )}
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
