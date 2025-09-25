import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "@/components/Card";
import { LoadingButton } from "@/components/Loading";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

export default function Login() {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useAuth();
    const { showSuccess, showError } = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        clearError();

        // Basic validation
        if (!email.trim()) {
            setLocalError("Email is required");
            return;
        }

        if (!password.trim()) {
            setLocalError("Password is required");
            return;
        }

        if (!email.includes("@")) {
            setLocalError("Please enter a valid email");
            return;
        }

        try {
            await login(email.trim(), password);
            showSuccess(`Welcome back!`);
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
                    <h1 className="text-2xl font-semibold">Welcome Back</h1>
                    <p className="text-stone-300 mt-2">
                        Sign in to your PhunParty account
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (localError) setLocalError(null);
                                if (error) clearError();
                            }}
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                            placeholder="your@email.com"
                            disabled={isLoading}
                            autoComplete="email"
                            required
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
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (localError) setLocalError(null);
                                if (error) clearError();
                            }}
                            className="w-full px-4 py-3 rounded-2xl bg-ink-700 outline-none focus:ring-2 focus:ring-tea-500 transition-all"
                            placeholder="Enter your password"
                            disabled={isLoading}
                            autoComplete="current-password"
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
                        loadingText="Signing In..."
                        className="w-full"
                    >
                        Sign In
                    </LoadingButton>
                </form>

                <div className="mt-6 text-center space-y-2">
                    <Link
                        to="/forgot-password"
                        className="text-sm text-tea-400 hover:text-tea-300 transition-colors"
                    >
                        Forgot your password?
                    </Link>
                    <div className="text-stone-400 text-sm">
                        Don't have an account?{" "}
                        <Link
                            to="/register"
                            className="text-tea-400 hover:text-tea-300 font-medium transition-colors"
                        >
                            Sign up
                        </Link>
                    </div>
                </div>
            </Card>
        </main>
    );
}
