import React from "react";

interface LoadingButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    loadingText?: string;
    children: React.ReactNode;
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md" | "lg";
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
    loading = false,
    loadingText = "Loading...",
    children,
    variant = "primary",
    size = "md",
    disabled,
    className = "",
    ...props
}) => {
    const baseClasses =
        "inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-ink-900";

    const variantClasses = {
        primary:
            "bg-peach-500 text-ink-900 hover:bg-peach-400 focus:ring-peach-500",
        secondary:
            "bg-ink-700 text-stone-100 hover:bg-ink-600 focus:ring-ink-500",
        ghost: "bg-transparent text-stone-300 hover:bg-ink-700 focus:ring-stone-500",
    };

    const sizeClasses = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-5 py-2 text-base",
        lg: "px-6 py-3 text-lg",
    };

    const finalClassName = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    return (
        <button
            {...props}
            disabled={disabled || loading}
            className={finalClassName}
        >
            {loading && (
                <svg
                    className="-ml-1 mr-3 h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    ></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
            )}
            {loading ? loadingText : children}
        </button>
    );
};

export default LoadingButton;
