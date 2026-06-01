import { useEffect, useState } from "react";

export default function Timer({
    ms,
    endsAt,
    serverOffsetMs = 0,
    keyer,
}: {
    ms?: number;
    endsAt?: string | null;
    serverOffsetMs?: number;
    keyer: string;
}) {
    const [left, setLeft] = useState(ms || 0);
    useEffect(() => {
        const endAtMs = endsAt ? Date.parse(endsAt) : NaN;
        const hasAuthoritativeEnd = !Number.isNaN(endAtMs);

        if (!hasAuthoritativeEnd && !ms) return;

        const started = Date.now();
        const initialMs = ms || 0;

        const getRemaining = () =>
            hasAuthoritativeEnd
                ? Math.max(0, endAtMs - (Date.now() + serverOffsetMs))
                : Math.max(0, initialMs - (Date.now() - started));

        setLeft(getRemaining());

        const id = setInterval(() => {
            const remain = getRemaining();
            setLeft(remain);
            if (remain === 0) {
                clearInterval(id);
            }
        }, 100);
        return () => clearInterval(id);
    }, [endsAt, ms, serverOffsetMs, keyer]);

    if (!endsAt && !ms) return null;
    return (
        <div className="text-sm text-stone-300">
            Time left: {(left / 1000).toFixed(1)}s
        </div>
    );
}
