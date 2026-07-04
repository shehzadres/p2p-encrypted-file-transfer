import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, ArrowLeft, Wifi, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TransferItem } from '@/components/transfer/TransferItem';
import { TransferSummary } from '@/components/transfer/TransferSummary';
import { TransferHistory } from '@/components/transfer/TransferHistory';
import { ConnectionDiagnostics } from '@/components/transfer/ConnectionDiagnostics';
import { SecurityPanel } from '@/components/transfer/SecurityPanel';
import { useRoom } from '@/hooks/useRoom';
import { useAppStore, selectActiveTransfers, selectCompletedTransfers } from '@/store/appStore';

export default function ReceivePage() {
  const { roomId }         = useParams();
  const navigate           = useNavigate();
  const { state, actions } = useAppStore();
  const [showHistory, setShowHistory] = useState(false);

  const {
    connectionStatus, peerCount, fingerprint, keyExchangeDone,
    hasTurn, pauseTransfer, resumeTransfer, cancelTransfer, getPrimaryPC,
  } = useRoom(roomId, 'receiver');

  const hasPeers  = peerCount > 0;
  const primaryPC = getPrimaryPC();

  const active    = selectActiveTransfers(state);
  const completed = selectCompletedTransfers(state);

  const wsStatus = connectionStatus === 'error' ? 'error'
    : hasPeers ? 'connected' : 'connecting';

  if (connectionStatus === 'error' && state.error) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div
          className="text-center max-w-sm animate-slide-up"
          role="alert"
          aria-live="assertive"
        >
          <div className="w-20 h-20 rounded-3xl bg-danger-muted border border-danger/25
                          flex items-center justify-center mx-auto mb-6 text-3xl">
            🔒
          </div>
          <h2 className="text-lg font-bold text-bright mb-2 tracking-tight">{state.error}</h2>
          <p className="text-muted text-sm mb-6 leading-relaxed">
            This room may have expired, already been used, or the link is incorrect.
          </p>
          <Button onClick={() => navigate('/')} size="lg">
            <ArrowLeft size={15} aria-hidden />
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8" aria-label="File receive session">
      {/* Header */}
      <header className="flex items-center gap-3 mb-8 animate-fade-in">
        <button onClick={() => navigate('/')} className="btn-ghost p-2 rounded-xl" aria-label="Back">
          <ArrowLeft size={16} aria-hidden />
        </button>
        <div>
          <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
            <h1 className="text-xl font-bold text-bright tracking-tight">Receiving Files</h1>
            <Badge variant={hasPeers ? 'success' : 'warning'}>
              <StatusDot status={wsStatus} size="sm" />
              {hasPeers ? 'Sender connected' : 'Waiting for sender'}
            </Badge>
          </div>
          <p className="text-muted text-xs font-mono">{roomId}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Connection status cards */}
          {!hasPeers && (
            <div
              className="card flex items-center gap-4 animate-slide-up"
              role="status" aria-live="polite"
            >
              <div className="w-11 h-11 rounded-2xl bg-accent-muted border border-accent/25
                              flex items-center justify-center shrink-0">
                <Wifi size={20} className="text-accent" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text mb-0.5">Establishing encrypted connection…</p>
                <p className="text-xs text-muted">WebRTC negotiation + X25519 key exchange in progress.</p>
                <ProgressBar indeterminate variant="accent" className="mt-2.5 h-0.5" />
              </div>
            </div>
          )}

          {hasPeers && !keyExchangeDone && (
            <div
              className="card flex items-center gap-4 animate-slide-up border-warning/25"
              role="status" aria-live="polite"
            >
              <div className="w-11 h-11 rounded-2xl bg-warning-muted border border-warning/25
                              flex items-center justify-center shrink-0">
                <ShieldCheck size={20} className="text-warning" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text mb-0.5">Exchanging cryptographic keys…</p>
                <p className="text-xs text-muted">X25519 Diffie-Hellman handshake in progress.</p>
                <ProgressBar indeterminate variant="warning" className="mt-2.5 h-0.5" />
              </div>
            </div>
          )}

          {hasPeers && keyExchangeDone && state.transfers.length === 0 && (
            <div
              className="card flex items-center gap-4 animate-slide-up border-success/20"
              role="status" aria-live="polite"
            >
              <div className="w-11 h-11 rounded-2xl bg-success-muted border border-success/25
                              flex items-center justify-center shrink-0">
                <Download size={20} className="text-success" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-text mb-0.5">Ready to receive</p>
                <p className="text-xs text-muted">Encrypted channel active — waiting for sender to drop files.</p>
              </div>
            </div>
          )}

          {/* Summary */}
          {state.transfers.length > 1 && <TransferSummary />}

          {/* Active */}
          {active.length > 0 && (
            <section aria-labelledby="incoming-heading" className="space-y-2 animate-fade-in">
              <h3 id="incoming-heading"
                className="text-2xs text-muted uppercase tracking-[0.12em] font-semibold px-1">
                Incoming ({active.length})
              </h3>
              <div role="list" aria-label="Incoming transfers">
                {active.map((t) => (
                  <TransferItem key={t.id} transfer={t}
                    onPause={pauseTransfer} onResume={resumeTransfer} onCancel={cancelTransfer}
                    onDismiss={(id) => actions.removeTransfer(id)} />
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section aria-labelledby="received-heading" className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between px-1">
                <h3 id="received-heading"
                  className="text-2xs text-muted uppercase tracking-[0.12em] font-semibold">
                  Received ({completed.length})
                </h3>
                <button onClick={actions.clearCompleted}
                  className="text-2xs text-muted hover:text-text transition-colors"
                  aria-label="Clear received transfers">
                  Clear
                </button>
              </div>
              <div role="list" aria-label="Received transfers">
                {completed.map((t) => (
                  <TransferItem key={t.id} transfer={t}
                    onDismiss={(id) => actions.removeTransfer(id)} />
                ))}
              </div>
            </section>
          )}

          {/* History */}
          {state.history.length > 0 && (
            <div className="animate-fade-in">
              <button onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-2 text-xs text-muted hover:text-text transition-colors px-1"
                aria-expanded={showHistory}>
                {showHistory ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
                {showHistory ? 'Hide' : 'Show'} history ({state.history.length})
              </button>
              {showHistory && (
                <div className="mt-3 animate-slide-down"><TransferHistory /></div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4" aria-label="Session details">
          <div className="animate-slide-up" style={{ animationDelay: '60ms' }}>
            <SecurityPanel fingerprint={fingerprint} keyExchangeDone={keyExchangeDone} />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '80ms' }}>
            <ConnectionDiagnostics pc={primaryPC} connectionStatus={connectionStatus} hasTurn={hasTurn} />
          </div>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            <ArrowLeft size={14} aria-hidden /> Cancel
          </Button>
        </aside>
      </div>
    </div>
  );
}
