import { Link, NavLink } from "react-router-dom";

export default function Header() {
    const link = "px-3 py-2 rounded-xl hover:bg-ink-700 transition";
    const active = ({ isActive }: { isActive: boolean }) =>
        isActive ? "bg-ink-700" : "";
    return (
        <header className="sticky top-0 z-40 backdrop-blur bg-ink-900/70 border-b border-ink-700">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                <Link to="/" className="font-semibold text-lg tracking-wide">
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
                    <NavLink
                        to="/account"
                        className={({ isActive }) =>
                            `${link} ${active({ isActive })}`
                        }
                    >
                        Account
                    </NavLink>
                </nav>
            </div>
        </header>
    );
}
