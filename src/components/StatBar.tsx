export default function StatBar({
    value,
    max,
}: {
    value: number;
    max: number;
}) {
    const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
    return (
        <div className="w-full h-2 bg-ink-700 rounded-full overflow-hidden">
            <div className="h-full bg-tea-500" style={{ width: pct + "%" }} />
        </div>
    );
}
