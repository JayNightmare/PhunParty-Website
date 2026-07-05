import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "@/components/Card";
import { LoadingButton } from "@/components/Loading";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { resendEmailVerification } from "@/lib/api";

const TERMS_URL =
    "https://terms-and-privacy.nexusgit.info/websites/phun-party/terms";
const PRIVACY_URL =
    "https://terms-and-privacy.nexusgit.info/websites/phun-party/privacy";
const pendingVerificationEmailKey = "phunparty:pending-verification-email";

function getPendingVerificationEmail() {
    try {
        return sessionStorage.getItem(pendingVerificationEmailKey) || "";
    } catch {
        return "";
    }
}

export default function Register() {
    const navigate = useNavigate();
    const { register, isLoading, error, clearError } = useAuth();
    const { showSuccess, showError } = useToast();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "",
        password: "",
        confirmPassword: "",
    });
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [isVerificationStep, setIsVerificationStep] = useState(
        () => !!getPendingVerificationEmail()
    );
    const [registeredEmail, setRegisteredEmail] = useState(
        getPendingVerificationEmail
    );
    const [isResending, setIsResending] = useState(false);

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (localError) setLocalError(null);
        if (error) clearError();
    };

    const handleTermsChange = (accepted: boolean) => {
        setTermsAccepted(accepted);
        if (localError) setLocalError(null);
        if (error) clearError();
    };

    const validateForm = () => {
        const { name, email, password, confirmPassword } = formData;

        if (!name.trim()) {
            return "Name is required";
        }

        if (!email.trim()) {
            return "Email is required";
        }

        if (!email.includes("@")) {
            return "Please enter a valid email";
        }

        if (!password.trim()) {
            return "Password is required";
        }

        if (password.length < 8) {
            return "Password must be at least 8 characters";
        }

        if (password !== confirmPassword) {
            return "Passwords do not match";
        }

        if (!termsAccepted) {
            return "You must accept the Terms of Service and Privacy Policy to sign up.";
        }

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        clearError();

        const validationError = validateForm();
        if (validationError) {
            setLocalError(validationError);
            return;
        }

        try {
            await register({
                player_name: formData.name.trim(),
                player_email: formData.email.trim(),
                player_mobile: formData.mobile.trim() || undefined,
                password: formData.password,
            });
            const email = formData.email.trim();
            sessionStorage.setItem(pendingVerificationEmailKey, email);
            setRegisteredEmail(email);
            setIsVerificationStep(true);
            showSuccess(
                "Account created. Check your email and tap the verification button."
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : "";
            if (message.toLowerCase().includes("email already exists")) {
                const email = formData.email.trim();
                sessionStorage.setItem(pendingVerificationEmailKey, email);
                setRegisteredEmail(email);
                try {
                    await resendEmailVerification({ player_email: email });
                    clearError();
                    setIsVerificationStep(true);
                    showSuccess(
                        "That account already exists but still needs verification. We sent a new verification email."
                    );
                    return;
                } catch {
                    setLocalError(
                        "That account already exists. Try signing in, or resend the verification email from this page after refreshing."
                    );
                    return;
                }
            }

            setLocalError(
                message || "Account could not be created. Please try again."
            );
        }
    };

    const handleResendCode = async () => {
        setLocalError(null);
        clearError();
        setIsResending(true);

        try {
            await resendEmailVerification({
                player_email: registeredEmail || formData.email.trim(),
            });
            showSuccess("Verification email sent.");
        } catch (err) {
            showError(
                err instanceof Error
                    ? err.message
                    : "Unable to resend verification email."
            );
        } finally {
            setIsResending(false);
        }
    };

    const handleUseDifferentEmail = () => {
        sessionStorage.removeItem(pendingVerificationEmailKey);
        setIsVerificationStep(false);
        setRegisteredEmail("");
        setLocalError(null);
        clearError();
    };

    const displayError = localError || error;

    return (
        <main className="max-w-md mx-auto px-4 py-8">
            <Card className="p-6">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-semibold">Join PhunParty</h1>
                    <p className="text-stone-300 mt-2">
                        Create your account to start hosting games
                    </p>
                </div>

                {isVerificationStep ? (
                    <div className="space-y-4">
                        <div className="rounded-2xl bg-ink-800/60 border border-ink-700 p-4">
                            <h2 className="text-lg font-semibold">
                                Check Your Email
                            </h2>
                            <p className="text-stone-300 text-sm mt-2">
                                We sent a verification button to{" "}
                                <span className="text-stone-100">
                                    {registeredEmail || formData.email}
                                </span>
                                . Tap it to verify your email and continue.
                            </p>
                            <p className="mt-3 rounded-xl border border-tea-500/20 bg-tea-500/10 px-3 py-2 text-xs text-tea-100">
                                Delivery is usually quick, but it can take up
                                to a few minutes to arrive. Check your spam or
                                junk folder if it does not appear.
                            </p>
                        </div>

                        {displayError && (
                            <div className="bg-red-900/20 border border-red-700 rounded-2xl p-3">
                                <p className="text-red-400 text-sm">
                                    {displayError}
                                </p>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleResendCode}
                            disabled={isLoading || isResending}
                            className="w-full"
                        >
                            <span className="block px-4 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold hover:bg-tea-400 disabled:bg-stone-500 transition-colors">
                                {isResending ? "Sending..." : "Resend verification email"}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate("/login")}
                            className="w-full text-sm text-tea-400 hover:text-tea-300 disabled:text-stone-500 transition-colors"
                        >
                            Back to sign in
                        </button>

                        <button
                            type="button"
                            onClick={handleUseDifferentEmail}
                            className="w-full text-sm text-stone-400 hover:text-stone-200 transition-colors"
                        >
                            Use a different email
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="name"
                            className="block text-sm text-stone-300 mb-1"
                        >
                            Full Name
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                                handleInputChange("name", e.target.value)
                            }
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                            placeholder="Your full name"
                            disabled={isLoading}
                            autoComplete="name"
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm text-stone-300 mb-1"
                        >
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                                handleInputChange("email", e.target.value)
                            }
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                            placeholder="your@email.com"
                            disabled={isLoading}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="mobile"
                            className="block text-sm text-stone-300 mb-1"
                        >
                            Mobile Number{" "}
                            <span className="text-stone-500">(optional)</span>
                        </label>
                        <input
                            id="mobile"
                            type="tel"
                            value={formData.mobile}
                            onChange={(e) =>
                                handleInputChange("mobile", e.target.value)
                            }
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                            placeholder="Your mobile number"
                            disabled={isLoading}
                            autoComplete="tel"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm text-stone-300 mb-1"
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) =>
                                handleInputChange("password", e.target.value)
                            }
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                            placeholder="Create a password (min. 8 characters)"
                            disabled={isLoading}
                            autoComplete="new-password"
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="confirmPassword"
                            className="block text-sm text-stone-300 mb-1"
                        >
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) =>
                                handleInputChange(
                                    "confirmPassword",
                                    e.target.value
                                )
                            }
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                            placeholder="Confirm your password"
                            disabled={isLoading}
                            autoComplete="new-password"
                            required
                        />
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl bg-ink-800/60 border border-ink-700 p-3 text-sm text-stone-300">
                        <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) =>
                                handleTermsChange(e.target.checked)
                            }
                            disabled={isLoading}
                            required
                            className="mt-1 h-4 w-4 rounded border-stone-500 bg-ink-700 text-tea-500 focus:ring-2 focus:ring-tea-500"
                        />
                        <span>
                            I agree to the{" "}
                            <a
                                href={TERMS_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="text-tea-400 hover:text-tea-300 underline underline-offset-2"
                            >
                                Terms of Service
                            </a>{" "}
                            and{" "}
                            <a
                                href={PRIVACY_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="text-tea-400 hover:text-tea-300 underline underline-offset-2"
                            >
                                Privacy Policy
                            </a>
                            .
                        </span>
                    </label>

                    {displayError && (
                        <div className="bg-red-900/20 border border-red-700 rounded-2xl p-3">
                            <p className="text-red-400 text-sm">
                                {displayError}
                            </p>
                        </div>
                    )}

                    <LoadingButton
                        type="submit"
                        isLoading={isLoading}
                        loadingText="Creating Account..."
                        className="w-full"
                    >
                        Create Account
                    </LoadingButton>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <div className="text-stone-400 text-sm">
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            className="text-tea-400 hover:text-tea-300 font-medium transition-colors"
                        >
                            Sign in
                        </Link>
                    </div>
                </div>
            </Card>
        </main>
    );
}
