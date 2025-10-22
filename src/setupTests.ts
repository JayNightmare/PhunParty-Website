import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Provide a default mock for AuthContext to simplify component rendering in tests
vi.mock("@/contexts/AuthContext", () => ({
    __esModule: true,
    useAuth: () => ({ user: null, isLoading: false }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/contexts/ToastContext", () => ({
    __esModule: true,
    useToast: () => ({
        showToast: (_msg: string) => {},
        showSuccess: (_msg: string) => {},
        showError: (_msg: string) => {},
        showWarning: (_msg: string) => {},
        showInfo: (_msg: string) => {},
        dismissToast: (_id: string) => {},
    }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// jsdom doesn't implement matchMedia; mock it to avoid errors in components relying on it
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
