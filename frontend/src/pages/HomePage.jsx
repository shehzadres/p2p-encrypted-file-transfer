import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Lock, Globe, Shield, Wifi, Flame, Sparkles, Send, Link2,
  ShieldCheck, CloudOff, Zap, Laptop, Smartphone, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { RoomOptions } from '@/components/transfer/RoomOptions';
import { API_URL } from '@/lib/config';
import { cn } from '@/lib/utils';

const DEFAULT_OPTIONS = { expiryTier: 'day', maxPeers: 9, selfDestruct: false };

const MODES = [
  { id: 'send', label: 'Send files',  icon: <Send  size={14} aria-hidden /> },
  { id: 'join', label: 'Join a room', icon: <Link2 size={14} aria-hidden /> },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [mode,     setMode]     = useState('send');
  const [loading,  setLoading]  = useState(false);
  const [joining,  setJoining]  = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error,    setError]    = useState('');
  const [options,  setOptions]  = useState(DEFAULT_OPTIONS);

  async function handleCreateRoom() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfDestruct: options.selfDestruct,
          expiryTier:   options.expiryTier,
          maxPeers:     options.selfDestruct ? 2 : options.maxPeers + 1,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const { roomId } = await res.json();
      navigate(`/room/${roomId}`);
    } catch {
      setError('Could not reach the signaling server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().replace(/\s/g, '');
    if (!code) return;
    setJoining(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/rooms/${code}`);
      if (res.status === 404) { setError('Room not found — check the code and try again.'); return; }
      if (!res.ok) throw new Error('Server error');
      navigate(`/receive/${code}`);
    } catch (ex) {
      if (!ex.message?.includes('found')) setError('Could not reach the signaling server.');
    } finally {
      setJoining(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Hero ── */}
      <section className="px-4 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow badge */}
          <div
            className="glass inline-flex items-center gap-2.5 pl-3 pr-4 py-1.5 mb-8 rounded-full
                       text-xs font-medium text-subtle animate-fade-in"
          >
            <span className="relative flex w-2 h-2" aria-hidden>
              <span className="absolute inset-0 rounded-full bg-teal animate-ping-soft" />
              <span className="relative rounded-full w-2 h-2 bg-teal" />
            </span>
            <Lock size={11} className="text-accent-light" aria-hidden />
            <span className="font-mono tracking-tight">XChaCha20-Poly1305 · X25519 · BLAKE2b-256</span>
          </div>

          {/* Headline */}
          <h1
            className="text-[2.6rem] sm:text-6xl lg:text-7xl font-semibold text-bright
                       tracking-tighter leading-[1.04] mb-6 animate-slide-up"
            style={{ animationDelay: '60ms' }}
          >
            Transfer files{' '}
            <span className="text-aurora">directly</span>
            <br className="hidden sm:block" />
            {' '}between browsers
          </h1>

          <p
            className="text-subtle text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-10 animate-slide-up"
            style={{ animationDelay: '110ms' }}
          >
            No uploads. No servers. No accounts.
            Files travel peer-to-peer, encrypted end-to-end with libsodium.
          </p>

          {/* Command panel */}
          <div
            className="glass-bright rounded-[28px] p-3 sm:p-4 max-w-lg mx-auto text-left animate-slide-up"
            style={{ animationDelay: '160ms' }}
          >
            <Segmented
              label="Transfer mode"
              value={mode}
              onChange={switchMode}
              options={MODES}
            />

            <div className="px-1 pt-4 pb-1 sm:px-2">
              {mode === 'send' ? (
                <div key="send" className="space-y-3 animate-fade-in">
                  <p className="text-sm text-muted leading-relaxed">
                    Create an end-to-end encrypted room and share the link.
                  </p>

                  <RoomOptions value={options} onChange={setOptions} />

                  <Button
                    size="xl"
                    onClick={handleCreateRoom}
                    loading={loading}
                    className="w-full"
                    aria-label={options.selfDestruct ? 'Create self-destruct room' : 'Start a new transfer'}
                  >
                    {options.selfDestruct
                      ? <Flame size={16} className="text-red-200" aria-hidden />
                      : <Sparkles size={16} aria-hidden />}
                    {options.selfDestruct ? 'Create Self-Destruct Room' : 'Start Transfer'}
                    {!loading && <ArrowRight size={16} aria-hidden />}
                  </Button>
                </div>
              ) : (
                <form
                  key="join"
                  onSubmit={handleJoin}
                  className="space-y-3 animate-fade-in"
                  aria-label="Join existing room"
                >
                  <p className="text-sm text-muted leading-relaxed">
                    Paste the room code or the full link you were sent.
                  </p>
                  <div className="relative">
                    <Link2
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      aria-hidden
                    />
                    <input
                      className="input font-mono h-12 pl-11"
                      placeholder="Room code or paste link…"
                      value={joinCode}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const match = val.match(/\/receive\/([a-zA-Z0-9_-]+)/);
                        setJoinCode(match ? match[1] : val);
                      }}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Room code"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="xl"
                    loading={joining}
                    disabled={!joinCode.trim()}
                    className="w-full"
                  >
                    Join Room
                    {!joining && <ArrowRight size={16} aria-hidden />}
                  </Button>
                </form>
              )}

              {error && (
                <div
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10
                             px-3.5 py-2.5 text-sm text-danger animate-fade-in"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Trust row */}
          <ul
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-xs text-muted
                       animate-fade-in"
            style={{ animationDelay: '260ms' }}
            aria-label="Highlights"
          >
            {[
              { icon: ShieldCheck, label: 'End-to-end encrypted' },
              { icon: CloudOff,    label: 'Nothing stored on servers' },
              { icon: Zap,         label: 'Up to 10 GB per file' },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2">
                <Icon size={14} className="text-accent-light" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Bento features ── */}
      <section className="px-4 pb-20 sm:pb-24" aria-labelledby="features-heading">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p
              id="features-heading"
              className="text-muted text-2xs uppercase tracking-[0.2em] font-semibold mb-3"
            >
              How it works
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-bright tracking-tighter">
              Everything happens in your browser
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* WebRTC — wide */}
            <FeatureCard
              className="md:col-span-2"
              icon={<Globe size={18} aria-hidden />}
              title="WebRTC DataChannels"
              desc="Direct peer-to-peer connection via STUN/TURN. Files never touch our servers — not even encrypted."
              delay="0ms"
            >
              <div className="well mt-6 px-5 py-4 flex items-center gap-4" aria-hidden>
                <DeviceNode icon={<Laptop size={18} />} label="Sender" />
                <svg className="flex-1 h-8 min-w-0 overflow-visible" viewBox="0 0 200 32" preserveAspectRatio="none">
                  <line
                    x1="0" y1="16" x2="200" y2="16"
                    stroke="rgb(var(--c-accent))" strokeWidth="2" strokeLinecap="round"
                    strokeDasharray="6 10" vectorEffect="non-scaling-stroke"
                    className="animate-flow"
                  />
                </svg>
                <DeviceNode icon={<Smartphone size={18} />} label="Receiver" />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-2xs text-muted">
                <CloudOff size={12} aria-hidden /> No server in the data path
              </p>
            </FeatureCard>

            {/* Encryption */}
            <FeatureCard
              icon={<Shield size={18} aria-hidden />}
              title="libsodium Encryption"
              desc="X25519 key exchange. XChaCha20-Poly1305 per chunk. BLAKE2b-256 integrity. Session fingerprint for MITM detection."
              delay="70ms"
            >
              <div className="mt-5 flex flex-wrap gap-1.5">
                {['XChaCha20-Poly1305', 'X25519', 'BLAKE2b-256'].map((c) => (
                  <span key={c} className="badge badge-muted font-mono">{c}</span>
                ))}
              </div>
            </FeatureCard>

            {/* Streaming */}
            <FeatureCard
              icon={<Wifi size={18} aria-hidden />}
              title="Streaming Pipeline"
              desc="Sliding-window ACKs, adaptive chunk sizing (16 KB – 512 KB), pause, resume, retry, and large-file streaming."
              delay="140ms"
            >
              <div className="well mt-5 h-14 px-3 py-2.5 flex items-end gap-1" aria-hidden>
                {Array.from({ length: 18 }).map((_, i) => (
                  <span
                    key={i}
                    className="flex-1 h-full rounded-sm bg-gradient-to-t from-accent-dim to-teal
                               origin-bottom animate-bar-wave"
                    style={{ animationDelay: `${i * 110}ms` }}
                  />
                ))}
              </div>
            </FeatureCard>

            {/* Stats — wide */}
            <div
              className="card md:col-span-2 flex items-center animate-fade-in"
              style={{ animationDelay: '210ms' }}
              role="group"
              aria-label="Key stats"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-6 w-full text-center">
                {[
                  { value: '10 GB', label: 'Max file size' },
                  { value: 'P2P',   label: 'Data path'     },
                  { value: '0',     label: 'Files stored'  },
                  { value: 'E2E',   label: 'Encryption'    },
                ].map(({ value, label }, i) => (
                  <div
                    key={label}
                    className={cn('px-2', i > 0 && 'sm:border-l sm:border-[var(--line)]')}
                  >
                    <p className="text-3xl font-semibold font-mono tracking-tighter tabular text-aurora">
                      {value}
                    </p>
                    <p className="text-muted text-2xs uppercase tracking-[0.14em] mt-1.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DeviceNode({ icon, label }) {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="glass-raised w-11 h-11 rounded-2xl flex items-center justify-center text-accent-light animate-float">
        {icon}
      </div>
      <span className="text-2xs text-muted font-medium">{label}</span>
    </div>
  );
}

function FeatureCard({ icon, title, desc, delay, className, children }) {
  return (
    <div
      className={cn('card group animate-slide-up', className)}
      style={{ animationDelay: delay }}
    >
      <div className="relative w-10 h-10 mb-4">
        <div aria-hidden className="absolute inset-0 rounded-xl bg-accent/40 blur-lg opacity-0
                                    group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent/25 to-teal/15
                        border border-accent/30 flex items-center justify-center text-accent-light
                        group-hover:scale-110 transition-transform duration-500 ease-spring">
          {icon}
        </div>
      </div>
      <h3 className="font-semibold text-bright mb-2 text-base tracking-tight">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{desc}</p>
      {children}
    </div>
  );
}
