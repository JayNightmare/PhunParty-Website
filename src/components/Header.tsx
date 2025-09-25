import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import ConfirmDialog from "./ConfirmDialog";

export default function Header() {
    const { user, logout } = useAuth();
    const { showSuccess } = useToast();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const link = "px-3 py-2 rounded-xl hover:bg-ink-700 transition";
    const active = ({ isActive }: { isActive: boolean }) =>
        isActive ? "bg-ink-700" : "";

    const handleLogout = () => {
        logout();
        showSuccess("You've been logged out successfully");
        setShowLogoutConfirm(false);
    };

    return (
        <>
            <ConfirmDialog
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={handleLogout}
                title="Confirm Logout"
                message="Are you sure you want to log out of your account?"
                confirmText="Logout"
                variant="warning"
            />
            <header className="sticky top-0 z-40 backdrop-blur bg-ink-900/70 border-b border-ink-700">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                    <Link
                        to="/"
                        className="font-semibold text-lg tracking-wide"
                    >
                        PhunParty
                    </Link>
                    <nav className="flex items-center gap-1">
                        <NavLink
                            to="/sessions"
                            className={({ isActive }) =>
                                `${link} ${active({ isActive })}`
                            }
                        >
                            Sessions
                        </NavLink>
                        <NavLink
                            to="/new"
                            className={({ isActive }) =>
                                `${link} ${active({ isActive })}`
                            }
                        >
                            New Game
                        </NavLink>

                        {user ? (
                            <>
                                <NavLink
                                    to="/account"
                                    className={({ isActive }) =>
                                        `${link} ${active({ isActive })}`
                                    }
                                >
                                    Account
                                </NavLink>
                                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-ink-600">
                                    <span className="text-sm text-stone-300">
                                        {user.name}
                                    </span>
                                    <button
                                        onClick={() =>
                                            setShowLogoutConfirm(true)
                                        }
                                        className="px-3 py-1 text-sm rounded-lg bg-ink-700 hover:bg-ink-600 transition-colors"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-ink-600">
                                <Link
                                    to="/login"
                                    className="px-3 py-2 text-sm rounded-xl hover:bg-ink-700 transition"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/register"
                                    className="px-3 py-2 text-sm rounded-xl bg-tea-500 text-ink-900 font-medium hover:bg-tea-400 transition"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        )}
                    </nav>
                </div>
            </header>
        </>
    );
}
