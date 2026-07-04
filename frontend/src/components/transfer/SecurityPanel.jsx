import { Shield, ShieldCheck, ShieldAlert, Lock, Eye, Copy, Check } from 'lucide-react';
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

  return (
    <div className={cn('card', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        {keyExchangeDone
          ? <ShieldCheck size={15} className="text-success" />
          : <Shield size={15} className="text-muted" />}
        <h2 className="font-medium text-text text-sm">
          {keyExchangeDone ? 'End-to-End Encrypted' : 'Security'}
        </h2>
        {keyExchangeDone && (
          <span className="ml-auto text-xs text-success font-medium">Active</span>
        )}
      </div>

      {/* Crypto specs */}
      <div className="space-y-2 mb-4">
        <SpecRow icon={<Lock size={11} />} label="Encryption"   value="XChaCha20-Poly1305" />
        <SpecRow icon={<Lock size={11} />} label="Key exchange" value="X25519 ECDH"        />
        <SpecRow icon={<Lock size={11} />} label="Integrity"    value="BLAKE2b-256"        />
        <SpecRow icon={<Lock size={11} />} label="Metadata"     value="AEAD encrypted"     />
        <SpecRow icon={<Lock size={11} />} label="Server reads" value="Nothing"  ok        />
      </div>

      {/* Session fingerprint */}
      {keyExchangeDone && fingerprint ? (
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Eye size={11} />
              Session Fingerprint
            </div>
            <button
              onClick={copyFingerprint}
              className="text-muted hover:text-text transition-colors"
              title="Copy fingerprint"
            >
              {copied
                ? <Check size={12} className="text-success" />
                : <Copy size={12} />}
            </button>
          </div>
          <code className="block font-mono text-xs text-accent tracking-widest break-all">
            {fingerprint.match(/.{1,4}/g)?.join(' ') ?? fingerprint}
          </code>
          <p className="text-muted text-xs mt-2 leading-relaxed">
            Compare this code with your recipient to verify no one is intercepting.
          </p>
        </div>
      ) : (
        <div className="border-t border-border pt-4">
          <p className="text-muted text-xs">
            {keyExchangeDone
              ? 'Generating session fingerprint…'
              : 'Fingerprint will appear once a peer connects.'}
          </p>
        </div>
      )}
    </div>
  );
}

function SpecRow({ icon, label, value, ok }) {
  return (
    <div className="flex items-center justify-between text-xs gap-2">
      <div className="flex items-center gap-1.5 text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <span className={cn('font-medium', ok ? 'text-success' : 'text-subtle')}>{value}</span>
    </div>
  );
}
