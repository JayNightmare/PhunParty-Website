import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "@/components/Card";
import { LoadingButton } from "@/components/Loading";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { resendEmailVerification, verifyEmail } from "@/lib/api";

const TERMS_URL =
    "https://terms-and-privacy.nexusgit.info/websites/phun-party/terms";
const PRIVACY_URL =
    "https://terms-and-privacy.nexusgit.info/websites/phun-party/privacy";

export default function Register() {
    const navigate = useNavigate();
    const { register, login, isLoading, error, clearError } = useAuth();
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
    const [isVerificationStep, setIsVerificationStep] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const [registeredEmail, setRegisteredEmail] = useState("");
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
            setRegisteredEmail(formData.email.trim());
            setIsVerificationStep(true);
            showSuccess(
                "Account created. Check your email for your verification code."
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : "";
            if (message.toLowerCase().includes("email already exists")) {
                const email = formData.email.trim();
                setRegisteredEmail(email);
                try {
                    await resendEmailVerification({ player_email: email });
                    clearError();
                    setIsVerificationStep(true);
                    showSuccess(
                        "That account already exists but still needs verification. We sent a new code."
                    );
                    return;
                } catch {
                    setLocalError(
                        "That account already exists. Try signing in, or resend the verification code from this page after refreshing."
                    );
                    return;
                }
            }

            setLocalError(
                message || "Account could not be created. Please try again."
            );
        }
    };

    const handleVerifyEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        clearError();

        const code = verificationCode.trim();
        if (!/^\d{6}$/.test(code)) {
            setLocalError("Enter the 6 digit code from your email.");
            return;
        }

        try {
            await verifyEmail({
                player_email: registeredEmail || formData.email.trim(),
                code,
            });
            await login(registeredEmail || formData.email.trim(), formData.password);
            showSuccess("Email verified. Welcome to PhunParty!");
            navigate("/account", { replace: true });
        } catch (err) {
            setLocalError(
                err instanceof Error
                    ? err.message
                    : "Unable to verify that code."
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
            showSuccess("Verification code sent.");
        } catch (err) {
            showError(
                err instanceof Error
                    ? err.message
                    : "Unable to resend verification code."
            );
        } finally {
            setIsResending(false);
        }
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
                    <form onSubmit={handleVerifyEmail} className="space-y-4">
                        <div>
                            <label
                                htmlFor="verificationCode"
                                className="block text-sm text-stone-300 mb-1"
                            >
                                Email Verification Code
                            </label>
                            <input
                                id="verificationCode"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={verificationCode}
                                onChange={(e) => {
                                    setVerificationCode(
                                        e.target.value.replace(/\D/g, "")
                                    );
                                    if (localError) setLocalError(null);
                                    if (error) clearError();
                                }}
                                className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all text-center text-xl tracking-[0.35em]"
                                placeholder="000000"
                                disabled={isLoading}
                                autoComplete="one-time-code"
                                required
                            />
                            <p className="text-stone-400 text-sm mt-2">
                                We sent a 6 digit code to{" "}
                                <span className="text-stone-200">
                                    {registeredEmail || formData.email}
                                </span>
                                .
                            </p>
                        </div>

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
                            loadingText="Verifying..."
                            className="w-full"
                        >
                            Verify Email
                        </LoadingButton>

                        <button
                            type="button"
                            onClick={handleResendCode}
                            disabled={isLoading || isResending}
                            className="w-full text-sm text-tea-400 hover:text-tea-300 disabled:text-stone-500 transition-colors"
                        >
                            {isResending ? "Sending..." : "Resend code"}
                        </button>
                    </form>
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
