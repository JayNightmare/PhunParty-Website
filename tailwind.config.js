module.exports = {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: { 900: "#0a0a0a", 800: "#111111", 700: "#181818" },
                tea: { 300: "#b8e1c6", 400: "#9bd4b3", 500: "#7ac9a1" },
                peach: { 300: "#ffd2b3", 400: "#ffbf99", 500: "#ffad80" },
            },
            boxShadow: { soft: "0 8px 32px rgba(0,0,0,0.25)" },
            borderRadius: { xxl: "1.25rem" },
        },
    },
    plugins: [],
};
