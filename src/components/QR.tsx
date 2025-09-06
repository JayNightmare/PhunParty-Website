import QRCode from "react-qr-code";

export default function QR({ value }: { value: string }) {
    return (
        <div className="bg-white p-3 rounded-2xl inline-block">
            <QRCode value={value} size={160} />
        </div>
    );
}
