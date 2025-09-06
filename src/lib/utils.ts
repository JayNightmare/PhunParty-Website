export const nid = (len = 8) =>
    Math.random()
        .toString(36)
        .slice(2, 2 + len);
export const now = () => Date.now();

export const shuffle = <T>(arr: T[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

export const save = (k: string, v: unknown) =>
    localStorage.setItem(k, JSON.stringify(v));
export const load = <T>(k: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(k);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
};
