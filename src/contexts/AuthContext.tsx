import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import {
    login,
    createPlayer,
    LoginRequest,
    CreatePlayerRequest,
    PlayerResponse,
} from "@/lib/api";
import CORSHelper from "@/components/CORSHelper";

interface User {
    id: string;
    name: string;
    email: string;
    mobile?: string;
    active_game_code?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (userData: RegisterData) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    error: string | null;
    clearError: () => void;
    showCORSHelper: boolean;
    setCORSHelper: (show: boolean) => void;
}

interface RegisterData {
    player_name: string;
    player_email: string;
    password: string;
    player_mobile?: string;
    active_game_code?: null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCORSHelper, setShowCORSHelper] = useState(false);

    // Initialize auth state from localStorage
    useEffect(() => {
        const storedToken = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("auth_user");

        if (storedToken && storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                setToken(storedToken);
                setUser(userData);
            } catch (err) {
                // Clear invalid data
                localStorage.removeItem("auth_token");
                localStorage.removeItem("auth_user");
            }
        }
        setIsLoading(false);
    }, []);

    const handleLogin = async (email: string, password: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const loginData: LoginRequest = {
                player_email: email,
                password,
            };
            const response = await login(loginData);

            // Store token
            const authToken = response.access_token;
            setToken(authToken);
            localStorage.setItem("auth_token", authToken);

            // Create user object from the login response
            const userData: User = {
                id: response.user.player_id,
                name: response.user.player_name,
                email: response.user.player_email,
                mobile: response.user.player_mobile || undefined,
                active_game_code: response.user.active_game_code || undefined,
            };

            setUser(userData);
            localStorage.setItem("auth_user", JSON.stringify(userData));
        } catch (err: any) {
            const errorMessage = err.message || "Login failed";
            setError(errorMessage);

            // Check if it's a CORS error
            if (
                errorMessage.toLowerCase().includes("cors") ||
                errorMessage.toLowerCase().includes("cross-origin") ||
                errorMessage.toLowerCase().includes("network error")
            ) {
                setShowCORSHelper(true);
            }

            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (userData: RegisterData) => {
        setIsLoading(true);
        setError(null);

        try {
            // Send plain password - the backend will hash it properly with bcrypt
            const registerData: CreatePlayerRequest = {
                player_name: userData.player_name,
                player_email: userData.player_email,
                player_mobile: userData.player_mobile,
                hashed_password: userData.password, // Backend expects plain password and does bcrypt hashing
            };

            const response = await createPlayer(registerData);

            // After successful registration, log them in
            await handleLogin(userData.player_email, userData.password);
        } catch (err: any) {
            setError(err.message || "Registration failed");
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setError(null);
    };

    const clearError = () => setError(null);

    const setCORSHelper = (show: boolean) => setShowCORSHelper(show);

    const value: AuthContextType = {
        user,
        token,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        isLoading,
        error,
        clearError,
        showCORSHelper,
        setCORSHelper,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            {showCORSHelper && (
                <CORSHelper onClose={() => setShowCORSHelper(false)} />
            )}
        </AuthContext.Provider>
    );
};
