import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Copy, Check, Share2, Smartphone, QrCode, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/**
 * QRPairingModal — full-screen pairing overlay.
 *
 * Features:
 *  - Large QR code (240×240) for easy mobile scanning
 *  - Native Web Share API for mobile "share link" button
 *  - Copy-to-clipboard with visual feedback
 *  - Expiry countdown (if expiresAt provided)
 *  - Self-destruct badge
 *  - Keyboard trap (Escape to close)
 *  - Focus management (returns focus to trigger on close)
 */
export function QRPairingModal({
  url,
  roomId,
  expiresAt,
  selfDestruct,
  maxPeers,
  onClose,
}) {
  const canvasRef   = useRef(null);
  const triggerRef  = useRef(document.activeElement);
  const closeRef    = useRef(null);
  const [copied,    setCopied]    = useState(false);
  const [qrError,   setQrError]   = useState(false);
  const [countdown, setCountdown] = useState(null);

  // ── QR Code generation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width:               240,
      margin:              2,
      color:               { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel:'M',
    }).catch(() => setQrError(true));
  }, [url]);

  // ── Expiry countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const sec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCountdown(sec);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // ── Focus trap & keyboard handler ────────────────────────────────────────
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Return focus to trigger element on close
      if (triggerRef.current?.focus) triggerRef.current.focus();
    };
  }, [onClose]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [url]);

  const shareLink = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: 'Nexus Transfer — Join Room',
        text:  'Join my secure file transfer session',
        url,
      });
    } catch { /* user cancelled */ }
  }, [url]);

  const canShare = Boolean(navigator.share);

  // ── Countdown formatting ─────────────────────────────────────────────────
  const countdownStr = (() => {
    if (countdown === null) return null;
    if (countdown <= 0)    return 'Expired';
    const h = Math.floor(countdown / 3600);
    const m = Math.floor((countdown % 3600) / 60);
    const s = countdown % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  })();

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="QR Pairing"
    >
      <div className="glass-bright rounded-2xl w-full max-w-sm shadow-2xl shadow-void animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <QrCode size={16} className="text-accent" />
            <h2 className="font-semibold text-text text-sm">Scan to Join</h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-border flex items-center justify-center text-muted hover:text-text transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 px-6 mt-3 flex-wrap">
          {selfDestruct && (
            <span className="badge bg-danger/15 text-danger border border-danger/30 text-xs">
              🔥 Self-destruct after transfer
            </span>
          )}
          {maxPeers === 2 && !selfDestruct && (
            <span className="badge bg-accent/15 text-accent border border-accent/30 text-xs">
              Single recipient
            </span>
          )}
          {maxPeers > 2 && (
            <span className="badge bg-teal/15 text-teal border border-teal/30 text-xs">
              Up to {maxPeers - 1} recipients
            </span>
          )}
          {countdownStr && (
            <span className={cn(
              'badge text-xs',
              countdown < 300
                ? 'bg-danger/15 text-danger border border-danger/30'
                : 'bg-border text-muted',
            )}>
              ⏱ {countdownStr}
            </span>
          )}
        </div>

        {/* QR */}
        <div className="flex justify-center py-6">
          {qrError ? (
            <div className="w-60 h-60 rounded-xl bg-surface border border-border flex flex-col items-center justify-center gap-2">
              <RefreshCw size={20} className="text-muted" />
              <p className="text-xs text-muted">QR generation failed</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-4 shadow-elevated">
              <canvas
                ref={canvasRef}
                className="rounded-lg block"
                aria-label="Room join QR code"
              />
            </div>
          )}
        </div>

        {/* Room code */}
        <div className="px-6 pb-2 text-center">
          <p className="text-xs text-muted mb-1">Room code</p>
          <code className="text-accent font-mono text-base font-semibold tracking-widest">
            {roomId?.match(/.{1,4}/g)?.join(' ') ?? roomId}
          </code>
        </div>

        {/* Mobile instructions */}
        <div className="mx-6 mb-4 mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-surface border border-border">
          <Smartphone size={13} className="text-accent mt-0.5 shrink-0" />
          <p className="text-xs text-muted leading-relaxed">
            Open the camera app on a mobile device and point it at the QR code.
            Tap the notification to join instantly — no app required.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-6 pb-6">
          {canShare && (
            <Button variant="outline" className="flex-1" onClick={shareLink}>
              <Share2 size={13} />
              Share
            </Button>
          )}
          <Button
            variant={canShare ? 'outline' : 'primary'}
            className="flex-1"
            onClick={copyLink}
          >
            {copied
              ? <><Check size={13} className="text-success" />Copied</>
              : <><Copy size={13} />Copy Link</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
