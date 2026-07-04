import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Globe, Shield, Wifi, Flame, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RoomOptions } from '@/components/transfer/RoomOptions';
import { API_URL } from '@/lib/config';

const DEFAULT_OPTIONS = { expiryTier: 'day', maxPeers: 9, selfDestruct: false };

export default function HomePage() {
  const navigate = useNavigate();
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

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Hero ── */}
      <section className="flex-1 flex items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-2xl w-full text-center">
          {/* Eyebrow badge */}
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-8 rounded-full
                       bg-accent-muted border border-accent/20 text-accent text-xs font-semibold
                       animate-fade-in"
          >
            <Lock size={11} aria-hidden />
            XChaCha20-Poly1305 · X25519 · BLAKE2b-256
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-bright
                       tracking-tighter leading-[1.08] mb-5 animate-slide-up"
            style={{ animationDelay: '60ms' }}
          >
            Transfer files{' '}
            <span className="text-gradient">directly</span>
            <br className="hidden sm:block" />
            {' '}between browsers
          </h1>

          <p
            className="text-subtle text-lg leading-relaxed max-w-md mx-auto mb-10 animate-slide-up"
            style={{ animationDelay: '100ms' }}
          >
            No uploads. No servers. No accounts.
            Files travel peer-to-peer, encrypted end-to-end with libsodium.
          </p>

          {/* Create room form */}
          <div
            className="max-w-md mx-auto space-y-3 animate-slide-up"
            style={{ animationDelay: '140ms' }}
          >
            <RoomOptions value={options} onChange={setOptions} />

            <Button
              size="xl"
              onClick={handleCreateRoom}
              loading={loading}
              className="w-full"
              aria-label={options.selfDestruct ? 'Create self-destruct room' : 'Start a new transfer'}
            >
              {options.selfDestruct
                ? <Flame size={16} className="text-red-300" aria-hidden />
                : <Sparkles size={16} aria-hidden />}
              {options.selfDestruct ? 'Create Self-Destruct Room' : 'Start Transfer'}
              {!loading && <ArrowRight size={16} aria-hidden />}
            </Button>
          </div>

          {/* Divider */}
          <div
            className="flex items-center gap-3 max-w-md mx-auto mt-5 animate-fade-in"
            style={{ animationDelay: '180ms' }}
          >
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted text-xs">or join with a code</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Join form */}
          <form
            onSubmit={handleJoin}
            className="flex gap-2 max-w-md mx-auto mt-4 animate-fade-in"
            style={{ animationDelay: '200ms' }}
            aria-label="Join existing room"
          >
            <input
              className="input flex-1 font-mono"
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
            <Button type="submit" variant="outline" loading={joining} className="shrink-0">
              Join
            </Button>
          </form>

          {error && (
            <p
              className="text-danger text-sm mt-3 animate-fade-in"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          )}
        </div>
      </section>

      {/* ── Features ── */}
      <section
        className="border-t border-border/30 py-16 px-4"
        aria-labelledby="features-heading"
      >
        <div className="max-w-4xl mx-auto">
          <p
            id="features-heading"
            className="text-center text-muted text-2xs uppercase tracking-[0.18em] mb-10 font-semibold"
          >
            How it works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Globe size={18} aria-hidden />}
              title="WebRTC DataChannels"
              desc="Direct peer-to-peer connection via STUN/TURN. Files never touch our servers — not even encrypted."
              delay="0ms"
            />
            <FeatureCard
              icon={<Shield size={18} aria-hidden />}
              title="libsodium Encryption"
              desc="X25519 key exchange. XChaCha20-Poly1305 per chunk. BLAKE2b-256 integrity. Session fingerprint for MITM detection."
              delay="60ms"
            />
            <FeatureCard
              icon={<Wifi size={18} aria-hidden />}
              title="Streaming Pipeline"
              desc="Sliding-window ACKs, adaptive chunk sizing (16 KB – 512 KB), pause, resume, retry, and large-file streaming."
              delay="120ms"
            />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-t border-border/30 py-10 px-4" aria-label="Key stats">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-10 text-center">
          {[
            { value: '10 GB', label: 'Max file size'  },
            { value: 'P2P',   label: 'Data path'      },
            { value: '0',     label: 'Files stored'   },
            { value: 'E2E',   label: 'Encryption'     },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-bold text-bright font-mono tracking-tighter tabular">
                {value}
              </p>
              <p className="text-muted text-2xs uppercase tracking-wide mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, delay }) {
  return (
    <div
      className="card-interactive group animate-fade-in"
      style={{ animationDelay: delay }}
    >
      <div className="w-9 h-9 rounded-xl bg-accent-muted border border-accent/20
                      flex items-center justify-center text-accent mb-4
                      group-hover:scale-110 group-hover:shadow-glow-sm transition-transform duration-300">
        {icon}
      </div>
      <h3 className="font-semibold text-text mb-2 text-sm tracking-tight">{title}</h3>
      <p className="text-muted text-xs leading-relaxed">{desc}</p>
    </div>
  );
}
