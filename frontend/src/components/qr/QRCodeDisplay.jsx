import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export function QRCodeDisplay({ value, size = 160, className = '' }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => setError(true));
  }, [value, size]);

  if (error) return <p className="text-danger text-xs">QR generation failed</p>;

  return (
    <div className="bg-white rounded-xl p-3 shadow-card inline-block">
      <canvas
        ref={canvasRef}
        className={`rounded-md block ${className}`}
        aria-label="QR code for room link"
      />
    </div>
  );
}
