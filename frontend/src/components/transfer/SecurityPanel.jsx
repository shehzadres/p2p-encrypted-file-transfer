import { ShieldCheck, ShieldAlert, Lock, Fingerprint, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * SecurityPanel — shows the encryption configuration and session fingerprint.
 * The fingerprint is a BLAKE2b-256 digest of both public keys; users can
 * compare it out-of-band to detect a MITM attack.
 */
export function SecurityPanel({ fingerprint, keyExchangeDone, className }) {
  const [copied, setCopied] = useState(false);

  async function copyFingerprint() {
    if (!fingerprint) return;
    await navigator.clipboard.writeText(fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const groups = fingerprint?.match(/.{1,4}/g) ?? [];

  return (
    <div className={cn('card', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative w-9 h-9 shrink-0">
          {keyExchangeDone && (
            <span aria-hidden className="absolute inset-0 rounded-xl bg-success/40 blur-md" />
          )}
          <div className={cn(
            'relative w-9 h-9 rounded-xl border flex items-center justify-center transition-colors duration-500',
            keyExchangeDone
              ? 'bg-success-muted border-success/40 text-success'
              : 'bg-[var(--fill-1)] border-[var(--line)] text-muted',
          )}>
            {keyExchangeDone ? <ShieldCheck size={17} aria-hidden /> : <ShieldAlert size={17} aria-hidden />}
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-bright text-sm tracking-tight">
            {keyExchangeDone ? 'End-to-End Encrypted' : 'Security'}
          </h2>
          <p className="text-2xs text-muted mt-0.5">
            {keyExchangeDone ? 'Channel secured' : 'Awaiting key exchange'}
          </p>
        </div>
        {keyExchangeDone && (
          <span className="badge badge-success ml-auto">Active</span>
        )}
      </div>

      {/* Crypto specs */}
      <dl className="well divide-y divide-[var(--line)] mb-4">
        <SpecRow label="Encryption"   value="XChaCha20-Poly1305" />
        <SpecRow label="Key exchange" value="X25519 ECDH"        />
        <SpecRow label="Integrity"    value="BLAKE2b-256"        />
        <SpecRow label="Metadata"     value="AEAD encrypted"     />
        <SpecRow label="Server reads" value="Nothing" ok         />
      </dl>

      {/* Session fingerprint */}
      {keyExchangeDone && fingerprint ? (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-subtle">
              <Fingerprint size={13} className="text-accent-light" aria-hidden />
              Session Fingerprint
            </div>
            <button
              onClick={copyFingerprint}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted
                         hover:text-bright hover:bg-[var(--fill-2)] transition-colors"
              title="Copy fingerprint"
              aria-label="Copy fingerprint"
            >
              {copied
                ? <Check size={13} className="text-success" />
                : <Copy size={13} />}
            </button>
          </div>
          <code
            className="well grid grid-cols-4 gap-1.5 p-2.5 font-mono text-[0.7rem] text-accent-light select-all"
            aria-label={`Fingerprint ${groups.join(' ')}`}
          >
            {groups.map((g, i) => (
              <span
                key={i}
                className="text-center py-1 rounded-md bg-[var(--fill-1)] tracking-wider"
              >
                {g}
              </span>
            ))}
          </code>
          <p className="text-muted text-xs mt-3 leading-relaxed">
            Compare this code with your recipient to verify no one is intercepting.
          </p>
        </div>
      ) : (
        <p className="text-muted text-xs leading-relaxed flex items-center gap-2">
          <Fingerprint size={13} className="shrink-0" aria-hidden />
          {keyExchangeDone
            ? 'Generating session fingerprint…'
            : 'Fingerprint will appear once a peer connects.'}
        </p>
      )}
    </div>
  );
}

function SpecRow({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between text-xs gap-3 px-3.5 py-2.5">
      <dt className="flex items-center gap-2 text-muted">
        <Lock size={11} className="text-accent-light/80" aria-hidden />
        {label}
      </dt>
      <dd className={cn(
        'font-medium font-mono text-[0.72rem]',
        ok ? 'text-success' : 'text-subtle',
      )}>
        {value}
      </dd>
    </div>
  );
}
