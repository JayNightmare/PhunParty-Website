import { useState } from "react";
import { Link } from "react-router-dom";
import Card from "@/components/Card";
import { LoadingButton } from "@/components/Loading";
import { useToast } from "@/contexts/ToastContext";
import {
    requestPasswordReset,
    verifyPasswordReset,
    updatePassword,
} from "@/lib/api";

type Step = "phone" | "verify" | "newPassword" | "success";

export default function ForgotPassword() {
    const { showSuccess, showError } = useToast();
    const [step, setStep] = useState<Step>("phone");
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        phoneNumber: "",
        otp: "",
        newPassword: "",
        confirmPassword: "",
    });

    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.phoneNumber.trim()) {
            showError("Phone number is required");
            return;
        }

        setIsLoading(true);
        try {
            await requestPasswordReset({
                phone_number: formData.phoneNumber.trim(),
            });
            showSuccess("Verification code sent to your phone");
            setStep("verify");
        } catch (err: any) {
            showError(err.message || "Failed to send verification code");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.otp.trim()) {
            showError("Verification code is required");
            return;
        }

        setIsLoading(true);
        try {
            await verifyPasswordReset({
                phone_number: formData.phoneNumber,
                otp: formData.otp.trim(),
            });
            showSuccess("Code verified successfully");
            setStep("newPassword");
        } catch (err: any) {
            showError(err.message || "Invalid verification code");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.newPassword.trim()) {
            showError("New password is required");
            return;
        }

        if (formData.newPassword.length < 6) {
            showError("Password must be at least 6 characters");
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            showError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        try {
            await updatePassword({
                phone_number: formData.phoneNumber,
                new_password: formData.newPassword,
            });
            showSuccess("Password updated successfully!");
            setStep("success");
        } catch (err: any) {
            showError(err.message || "Failed to update password");
        } finally {
            setIsLoading(false);
        }
    };

    const updateFormData = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const stepConfig = {
        phone: {
            title: "Reset Password",
            subtitle: "Enter your phone number to receive a verification code",
            onSubmit: handlePhoneSubmit,
        },
        verify: {
            title: "Verify Code",
            subtitle: `Enter the verification code sent to ${formData.phoneNumber}`,
            onSubmit: handleVerifySubmit,
        },
        newPassword: {
            title: "New Password",
            subtitle: "Create a new password for your account",
            onSubmit: handlePasswordSubmit,
        },
        success: {
            title: "Password Updated!",
            subtitle: "Your password has been successfully updated",
            onSubmit: () => {},
        },
    };

    const currentStep = stepConfig[step];

    return (
        <main className="max-w-md mx-auto px-4 py-8">
            <Card className="p-6">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-semibold">
                        {currentStep.title}
                    </h1>
                    <p className="text-stone-300 mt-2">
                        {currentStep.subtitle}
                    </p>
                </div>

                {/* Progress Indicator */}
                <div className="flex justify-center mb-6">
                    <div className="flex space-x-2">
                        {["phone", "verify", "newPassword", "success"].map(
                            (stepName, index) => {
                                const currentStepIndex = [
                                    "phone",
                                    "verify",
                                    "newPassword",
                                    "success",
                                ].indexOf(step);
                                const isActive = index <= currentStepIndex;
                                const isCurrent = stepName === step;

                                return (
                                    <div
                                        key={stepName}
                                        className={`
                                        w-3 h-3 rounded-full transition-colors
                                        ${
                                            isActive
                                                ? isCurrent
                                                    ? "bg-tea-500"
                                                    : "bg-tea-600/70"
                                                : "bg-ink-600"
                                        }
                                    `}
                                    />
                                );
                            }
                        )}
                    </div>
                </div>

                {step === "phone" && (
                    <form onSubmit={handlePhoneSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="phoneNumber"
                                className="block text-sm text-stone-300 mb-1"
                            >
                                Phone Number
                            </label>
                            <input
                                id="phoneNumber"
                                type="tel"
                                value={formData.phoneNumber}
                                onChange={(e) =>
                                    updateFormData(
                                        "phoneNumber",
                                        e.target.value
                                    )
                                }
                                className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                                placeholder="Enter your phone number"
                                disabled={isLoading}
                                required
                            />
                        </div>
                        <LoadingButton
                            type="submit"
                            isLoading={isLoading}
                            loadingText="Sending code..."
                            className="w-full"
                        >
                            Send Verification Code
                        </LoadingButton>
                    </form>
                )}

                {step === "verify" && (
                    <form onSubmit={handleVerifySubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="otp"
                                className="block text-sm text-stone-300 mb-1"
                            >
                                Verification Code
                            </label>
                            <input
                                id="otp"
                                type="text"
                                value={formData.otp}
                                onChange={(e) =>
                                    updateFormData("otp", e.target.value)
                                }
                                className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                                placeholder="Enter 6-digit code"
                                disabled={isLoading}
                                maxLength={6}
                                required
                            />
                        </div>
                        <LoadingButton
                            type="submit"
                            isLoading={isLoading}
                            loadingText="Verifying..."
                            className="w-full"
                        >
                            Verify Code
                        </LoadingButton>
                        <button
                            type="button"
                            onClick={() => setStep("phone")}
                            disabled={isLoading}
                            className="w-full px-5 py-3 rounded-2xl bg-ink-700 text-stone-300 hover:bg-ink-600 transition-colors disabled:opacity-50"
                        >
                            Back to Phone Number
                        </button>
                    </form>
                )}

                {step === "newPassword" && (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="newPassword"
                                className="block text-sm text-stone-300 mb-1"
                            >
                                New Password
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={formData.newPassword}
                                onChange={(e) =>
                                    updateFormData(
                                        "newPassword",
                                        e.target.value
                                    )
                                }
                                className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                                placeholder="Enter new password (min. 6 characters)"
                                disabled={isLoading}
                                minLength={6}
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
                                    updateFormData(
                                        "confirmPassword",
                                        e.target.value
                                    )
                                }
                                className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                                placeholder="Confirm your new password"
                                disabled={isLoading}
                                required
                            />
                        </div>
                        <LoadingButton
                            type="submit"
                            isLoading={isLoading}
                            loadingText="Updating password..."
                            className="w-full"
                        >
                            Update Password
                        </LoadingButton>
                    </form>
                )}

                {step === "success" && (
                    <div className="text-center space-y-4">
                        <div className="text-6xl mb-4">✅</div>
                        <p className="text-stone-300 mb-6">
                            You can now log in with your new password.
                        </p>
                        <Link
                            to="/login"
                            className="inline-block w-full px-5 py-3 rounded-2xl bg-tea-500 text-ink-900 font-semibold hover:bg-tea-400 transition-colors text-center"
                        >
                            Go to Login
                        </Link>
                    </div>
                )}

                {step !== "success" && (
                    <div className="mt-6 text-center">
                        <Link
                            to="/login"
                            className="text-sm text-tea-400 hover:text-tea-300 transition-colors"
                        >
                            Back to Login
                        </Link>
                    </div>
                )}
            </Card>
        </main>
    );
}
