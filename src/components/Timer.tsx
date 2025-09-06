import { useEffect, useState } from "react";

export default function Timer({
    ms,
    onEnd,
    keyer,
}: {
    ms?: number;
    onEnd: () => void;
    keyer: string;
}) {
    const [left, setLeft] = useState(ms || 0);
    useEffect(() => {
        if (!ms) return;
        setLeft(ms);
        const started = Date.now();
        const id = setInterval(() => {
            const gone = Date.now() - started;
            const remain = Math.max(0, ms - gone);
            setLeft(remain);
            if (remain === 0) {
                clearInterval(id);
                onEnd();
            }
        }, 100);
        return () => clearInterval(id);
    }, [ms, keyer]);

    if (!ms) return null;
    return (
        <div className="text-sm text-stone-300">
            Time left: {(left / 1000).toFixed(1)}s
        </div>
    );
}
