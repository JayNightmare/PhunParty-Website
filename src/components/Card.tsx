export default function Card(
    props: React.PropsWithChildren<{ className?: string }>
) {
    return (
        <div
            className={`bg-ink-800/80 border border-ink-700 rounded-2xl shadow-soft ${
                props.className || ""
            }`}
        >
            {props.children}
        </div>
    );
}
