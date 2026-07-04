import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, ArrowLeft, QrCode, Wifi, ChevronDown, ChevronUp, Flame, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { EmptyState } from '@/components/ui/EmptyState';
import { DropZone } from '@/components/transfer/DropZone';
import { TransferItem } from '@/components/transfer/TransferItem';
import { TransferSummary } from '@/components/transfer/TransferSummary';
import { TransferHistory } from '@/components/transfer/TransferHistory';
import { RecipientList } from '@/components/transfer/RecipientList';
import { ConnectionDiagnostics } from '@/components/transfer/ConnectionDiagnostics';
import { SecurityPanel } from '@/components/transfer/SecurityPanel';
import { QRPairingModal } from '@/components/qr/QRPairingModal';
import { useRoom } from '@/hooks/useRoom';
import { useAppStore, selectActiveTransfers, selectCompletedTransfers } from '@/store/appStore';
import { buildRoomUrl } from '@/lib/utils';

export default function TransferPage() {
  const { roomId }         = useParams();
  const navigate           = useNavigate();
  const { state, actions } = useAppStore();

  const [copied,      setCopied]      = useState(false);
  const [showQR,      setShowQR]      = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [queued,      setQueued]      = useState([]);
  const queuedRef    = useRef([]);

  const {
    connectionStatus, peerCount, peerList, fingerprint, keyExchangeDone,
    roomInfo, hasTurn, sendFiles, pauseTransfer, resumeTransfer, cancelTransfer, getPrimaryPC,
  } = useRoom(roomId, 'sender');

  const roomUrl   = buildRoomUrl(roomId);
  const hasPeers  = peerCount > 0;
  const primaryPC = getPrimaryPC();
  const isReady   = hasPeers && keyExchangeDone;
  const isMulti   = (roomInfo?.maxPeers ?? 10) > 2;
  const isSelfDest= roomInfo?.selfDestruct ?? false;

  const active    = selectActiveTransfers(state);
  const completed = selectCompletedTransfers(state);

  // Flush queued files once the peer is ready and key exchange is complete.
  // Must run in useEffect, not in the render body — calling sendFiles() during
  // render triggers a store dispatch (addTransfer) which causes a "cannot update
  // a component while rendering a different component" React warning.
  // useEffect also ensures _sessionKey is non-null before deriveFileKey is called.
  useEffect(() => {
    if (!isReady) return;
    if (queuedRef.current.length === 0) return;
    const toSend = [...queuedRef.current];
    queuedRef.current = [];
    setQueued([]);
    sendFiles(toSend);
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFiles = useCallback((files) => {
    if (!isReady) {
      queuedRef.current = [...queuedRef.current, ...files];
      setQueued([...queuedRef.current]);
    } else {
      sendFiles(files);
    }
  }, [isReady, sendFiles]);

  async function copyLink() {
    await navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const wsStatus = connectionStatus === 'error' ? 'error'
    : hasPeers ? 'connected' : 'connecting';

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8" aria-label="Transfer room">
      {/* Header */}
      <header className="flex items-center gap-3 mb-8 animate-fade-in">
        <button
          onClick={() => navigate('/')}
          className="btn-ghost p-2 rounded-xl"
          aria-label="Back to home"
        >
          <ArrowLeft size={16} aria-hidden />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
            <h1 className="text-xl font-bold text-bright tracking-tight">Transfer Room</h1>
            {isSelfDest && (
              <Badge variant="danger">
                <Flame size={10} aria-hidden />Self-destruct
              </Badge>
            )}
            <Badge variant={hasPeers ? 'success' : 'warning'}>
              <StatusDot status={wsStatus} size="sm" />
              {hasPeers
                ? `${peerCount} peer${peerCount > 1 ? 's' : ''} connected`
                : 'Waiting for peers'}
            </Badge>
          </div>
          <p className="text-muted text-xs font-mono truncate">{roomId}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Share card */}
          <div className="card animate-slide-up" style={{ animationDelay: '40ms' }}>
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} className="text-accent" aria-hidden />
              <h2 className="font-semibold text-text text-sm">
                {isMulti ? 'Share with Recipients' : 'Share with Recipient'}
              </h2>
              {isSelfDest && (
                <span className="ml-auto text-2xs text-danger/80 flex items-center gap-1 font-medium">
                  <Flame size={10} aria-hidden />One-time link
                </span>
              )}
            </div>
            <div className="flex gap-2 mb-3">
              <input
                readOnly value={roomUrl}
                className="input font-mono text-xs flex-1"
                onFocus={(e) => e.target.select()}
                aria-label="Room link"
              />
              <Button variant="outline" size="md" onClick={copyLink} className="shrink-0"
                aria-label={copied ? 'Link copied' : 'Copy link'}>
                {copied
                  ? <Check size={14} className="text-success" aria-hidden />
                  : <Copy size={14} aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setShowQR(true)}
                className="shrink-0" aria-label="Show QR code">
                <QrCode size={15} aria-hidden />
              </Button>
            </div>
            <p className="text-muted text-xs">
              Room code:{' '}
              <code className="text-accent font-mono font-semibold ml-1 select-all">{roomId}</code>
            </p>
          </div>

          {/* Waiting state */}
          {!hasPeers && (
            <div
              className="glass rounded-2xl p-4 flex items-center gap-3 animate-fade-in border-border/50"
              role="status"
              aria-live="polite"
            >
              <div className="w-8 h-8 rounded-xl bg-accent-muted border border-accent/25
                              flex items-center justify-center shrink-0">
                <Wifi size={14} className="text-accent" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-text">
                  {isSelfDest ? 'Waiting for recipient to scan QR…' : 'Waiting for peers to join…'}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Share the link or QR code above
                </p>
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            className="animate-slide-up"
            style={{ animationDelay: '80ms' }}
          >
            <DropZone onFiles={onFiles} />
          </div>

          {queued.length > 0 && (
            <p className="text-xs text-muted px-1 animate-fade-in" role="status" aria-live="polite">
              {queued.length} file{queued.length > 1 ? 's' : ''} queued — will send once encryption is ready
            </p>
          )}

          {/* Aggregate summary */}
          {state.transfers.length > 1 && <TransferSummary />}

          {/* Active transfers */}
          {active.length > 0 && (
            <section aria-labelledby="active-heading" className="space-y-2 animate-fade-in">
              <h3 id="active-heading"
                className="text-2xs text-muted uppercase tracking-[0.12em] font-semibold px-1">
                Active ({active.length})
              </h3>
              <div role="list" aria-label="Active transfers">
                {active.map((t) => (
                  <TransferItem key={t.id} transfer={t}
                    onPause={pauseTransfer} onResume={resumeTransfer} onCancel={cancelTransfer}
                    onDismiss={(id) => actions.removeTransfer(id)} />
                ))}
              </div>
            </section>
          )}

          {/* Completed transfers */}
          {completed.length > 0 && (
            <section aria-labelledby="completed-heading" className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between px-1">
                <h3 id="completed-heading"
                  className="text-2xs text-muted uppercase tracking-[0.12em] font-semibold">
                  Completed ({completed.length})
                </h3>
                <button
                  onClick={actions.clearCompleted}
                  className="text-2xs text-muted hover:text-text transition-colors"
                  aria-label="Clear completed transfers"
                >
                  Clear
                </button>
              </div>
              <div role="list" aria-label="Completed transfers">
                {completed.map((t) => (
                  <TransferItem key={t.id} transfer={t}
                    onDismiss={(id) => actions.removeTransfer(id)} />
                ))}
              </div>
            </section>
          )}

          {/* Empty state when connected but nothing sent yet */}
          {isReady && state.transfers.length === 0 && queued.length === 0 && (
            <EmptyState
              icon="📂"
              title="Drop files to send"
              body="Drag files onto the zone above, or click to browse. Supports any format up to 10 GB."
            />
          )}

          {/* History */}
          {state.history.length > 0 && (
            <div className="animate-fade-in">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-2 text-xs text-muted hover:text-text transition-colors px-1"
                aria-expanded={showHistory}
              >
                {showHistory ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
                {showHistory ? 'Hide' : 'Show'} history ({state.history.length})
              </button>
              {showHistory && (
                <div className="mt-3 animate-slide-down">
                  <TransferHistory />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4" aria-label="Transfer details">
          {isMulti && (
            <div className="animate-slide-up" style={{ animationDelay: '60ms' }}>
              <RecipientList
                peers={peerList}
                transfers={state.transfers}
                peerCount={peerCount}
                maxPeers={roomInfo?.maxPeers ?? 10}
              />
            </div>
          )}
          <div className="animate-slide-up" style={{ animationDelay: '80ms' }}>
            <SecurityPanel fingerprint={fingerprint} keyExchangeDone={keyExchangeDone} />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <ConnectionDiagnostics pc={primaryPC} connectionStatus={connectionStatus} hasTurn={hasTurn} />
          </div>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            <ArrowLeft size={14} aria-hidden />
            End Session
          </Button>
        </aside>
      </div>

      {/* QR Modal */}
      {showQR && (
        <QRPairingModal
          url={roomUrl} roomId={roomId}
          expiresAt={roomInfo?.expiresAt ?? null}
          selfDestruct={isSelfDest}
          maxPeers={roomInfo?.maxPeers ?? 10}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
}
