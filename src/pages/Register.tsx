import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "@/components/Card";
import { LoadingButton } from "@/components/Loading";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

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
    const [localError, setLocalError] = useState<string | null>(null);

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
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

        if (password.length < 6) {
            return "Password must be at least 6 characters";
        }

        if (password !== confirmPassword) {
            return "Passwords do not match";
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
                name: formData.name.trim(),
                email: formData.email.trim(),
                mobile: formData.mobile.trim() || undefined,
                password: formData.password,
            });
            showSuccess(
                `Welcome to PhunParty, ${formData.name.split(" ")[0]}!`
            );
            navigate("/account", { replace: true });
        } catch (err) {
            // Error is handled by auth context
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
                            placeholder="Create a password (min. 6 characters)"
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
