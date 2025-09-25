import { useState, useEffect } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import Card from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { updatePlayer } from "@/lib/api";

export default function EditProfile() {
    const { user, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // Populate form with current user data
    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || "",
                email: user.email || "",
                mobile: user.mobile || "",
            });
        }
    }, [user]);

    // Redirect to login if not authenticated
    if (!authLoading && !user) {
        return <Navigate to="/login" replace />;
    }

    // Show loading state while checking auth
    if (authLoading) {
        return (
            <main className="max-w-md mx-auto px-4 py-8">
                <Card className="p-6">
                    <div className="text-center text-stone-400">Loading...</div>
                </Card>
            </main>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess(false);

        // Validation
        if (!formData.name.trim()) {
            setError("Name is required");
            setLoading(false);
            return;
        }

        if (!formData.email.trim()) {
            setError("Email is required");
            setLoading(false);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError("Please enter a valid email address");
            setLoading(false);
            return;
        }

        try {
            if (!user || !user.id) {
                throw new Error("Missing user information. Please log in again.");
            }

            const payload = {
                player_name: formData.name.trim(),
                player_email: formData.email.trim(),
                player_mobile: formData.mobile.trim() || undefined,
            };

            const updated = await updatePlayer(user.id, payload);

            const updatedUser = {
                ...user,
                name: updated.player_name,
                email: updated.player_email,
                mobile: updated.player_mobile || "",
            };

            Object.assign(user, updatedUser);
            localStorage.setItem("auth_user", JSON.stringify(updatedUser));

            setSuccess(true);

            setTimeout(() => {
                navigate("/account");
            }, 1500);
        } catch (err: any) {
            setError(err.message || "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    if (success) {
        return (
            <main className="max-w-md mx-auto px-4 py-8">
                <Card className="p-6">
                    <div className="text-center">
                        <div className="text-4xl mb-4">✅</div>
                        <h1 className="text-xl font-semibold mb-2">
                            Profile Updated!
                        </h1>
                        <p className="text-stone-400 mb-4">
                            Your profile has been successfully updated.
                        </p>
                        <div className="text-sm text-stone-500">
                            Redirecting to account page...
                        </div>
                    </div>
                </Card>
            </main>
        );
    }

    return (
        <main className="max-w-md mx-auto px-4 py-8">
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-semibold">Edit Profile</h1>
                    <Link
                        to="/account"
                        className="text-stone-400 hover:text-stone-300 transition-colors"
                    >
                        ✕
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="name"
                            className="block text-sm font-medium text-stone-300 mb-2"
                        >
                            Full Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-ink-800 border border-ink-600 rounded-xl text-stone-200 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent"
                            placeholder="Enter your full name"
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-stone-300 mb-2"
                        >
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-ink-800 border border-ink-600 rounded-xl text-stone-200 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent"
                            placeholder="Enter your email address"
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="mobile"
                            className="block text-sm font-medium text-stone-300 mb-2"
                        >
                            Mobile Number{" "}
                            <span className="text-stone-500">(optional)</span>
                        </label>
                        <input
                            type="tel"
                            id="mobile"
                            name="mobile"
                            value={formData.mobile}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-ink-800 border border-ink-600 rounded-xl text-stone-200 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent"
                            placeholder="Enter your mobile number"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-800 rounded-xl text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Link
                            to="/account"
                            className="flex-1 px-4 py-2 bg-ink-700 border border-ink-600 text-stone-300 rounded-xl font-medium hover:bg-ink-600 transition-colors text-center"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-tea-500 text-ink-900 rounded-xl font-medium hover:bg-tea-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Updating..." : "Save Changes"}
                        </button>
                    </div>
                </form>

                <div className="mt-6 pt-6 border-t border-ink-600">
                    <div className="text-sm text-stone-400 space-y-1">
                        <p>
                            <strong>Tip:</strong> Profile updates apply across
                            all Phun Party experiences.
                        </p>
                    </div>
                </div>
            </Card>
        </main>
    );
}
