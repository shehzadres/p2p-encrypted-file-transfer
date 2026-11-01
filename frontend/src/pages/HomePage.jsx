import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Check, Clock, CloudOff, File, FileArchive, FileImage,
  FileText, Fingerprint, Folder, Github, HardDrive, Laptop, Link2, LockKeyhole,
  MonitorSmartphone, QrCode, ShieldCheck, Smartphone, UploadCloud, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { RoomOptions } from '@/components/transfer/RoomOptions';
import { API_URL } from '@/lib/config';

const DEFAULT_OPTIONS = { expiryTier: 'day', maxPeers: 9, selfDestruct: false };
const MODES = [
  { id: 'send', label: 'Send files', icon: <UploadCloud size={14} aria-hidden /> },
  { id: 'join', label: 'Join a room', icon: <Link2 size={14} aria-hidden /> },
];
const FILE_TYPES = [
  { label: 'Documents', icon: <FileText size={16} />, tone: 'amber' },
  { label: 'Images', icon: <FileImage size={16} />, tone: 'blue' },
  { label: 'Folders', icon: <Folder size={16} />, tone: 'green' },
  { label: 'Archives', icon: <FileArchive size={16} />, tone: 'violet' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('send');
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [options, setOptions] = useState(DEFAULT_OPTIONS);

  async function handleCreateRoom() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfDestruct: options.selfDestruct,
          expiryTier: options.expiryTier,
          maxPeers: options.selfDestruct ? 2 : options.maxPeers + 1,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const { roomId } = await res.json();
      navigate(`/room/${roomId}`);
    } catch {
      setError('Could not reach the signaling server. Check your connection and try again.');
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
      if (res.status === 404) {
        setError('Room not found. Check the invitation and try again.');
        return;
      }
      if (!res.ok) throw new Error('Server error');
      navigate(`/receive/${code}`);
    } catch (ex) {
      if (!ex.message?.includes('found')) setError('Could not reach the signaling server.');
    } finally {
      setJoining(false);
    }
  }

  function updateJoinCode(value) {
    const clean = value.trim();
    const match = clean.match(/\/(?:receive|room)\/([a-zA-Z0-9_-]+)/);
    setJoinCode(match ? match[1] : clean);
  }

  return (
    <div className="nt-home">
      <section className="nt-hero">
        <div className="nt-hero-copy">
          <div className="nt-kicker"><span className="nt-kicker-dot" /> PRIVATE TRANSFER WORKSPACE</div>
          <h1>Files move.<br /><span>Your privacy stays.</span></h1>
          <p className="nt-hero-description">
            Send files directly between browsers. Your data is encrypted on your device
            and travels peer to peer, not through a cloud upload.
          </p>
          <div className="nt-benefit-list">
            <div><span className="nt-benefit-icon"><ShieldCheck size={16} /></span><span><b>End-to-end encrypted</b><small>Private keys stay in your browser</small></span></div>
            <div><span className="nt-benefit-icon"><CloudOff size={16} /></span><span><b>No cloud storage</b><small>Your files are never uploaded</small></span></div>
            <div><span className="nt-benefit-icon"><Zap size={16} /></span><span><b>Direct device transfer</b><small>WebRTC connection between peers</small></span></div>
          </div>
          <div className="nt-device-visual" aria-label="Direct connection between devices">
            <div className="nt-device"><Laptop size={20} /><span>Your browser</span></div>
            <div className="nt-device-link"><span /><i /><span /></div>
            <div className="nt-device"><Smartphone size={20} /><span>Other device</span></div>
            <span className="nt-device-caption"><LockKeyhole size={11} /> Encrypted channel</span>
          </div>
        </div>

        <div className="nt-workspace-card">
          <div className="nt-workspace-top">
            <div>
              <span className="nt-section-eyebrow">TRANSFER WORKSPACE</span>
              <h2>Start something secure</h2>
              <p>Choose how you want to connect.</p>
            </div>
            <div className="nt-workspace-mark"><MonitorSmartphone size={21} /></div>
          </div>
          <Segmented label="Transfer mode" value={mode} onChange={(next) => { setMode(next); setError(''); }} options={MODES} className="nt-mode-switch" />
          {mode === 'send' ? (
            <div className="nt-form-content" key="send">
              <div className="nt-form-heading">
                <div className="nt-form-step">01</div>
                <div><h3>Create a private room</h3><p>We’ll generate a one-time link for your recipient.</p></div>
              </div>
              <div className="nt-room-settings">
                <div className="nt-setting-row">
                  <span><ClockIcon /> Room settings</span>
                  <span className="nt-setting-value">{options.selfDestruct ? 'One-time room' : options.expiryTier === 'hour' ? '1 hour' : options.expiryTier === 'week' ? '7 days' : options.expiryTier === 'never' ? 'No expiry' : '24 hours'}</span>
                </div>
                <RoomOptions value={options} onChange={setOptions} />
              </div>
              <Button size="xl" onClick={handleCreateRoom} loading={loading} className="w-full nt-create-button">
                Create transfer room <ArrowRight size={16} aria-hidden />
              </Button>
              <div className="nt-secure-note"><LockKeyhole size={12} /> Encryption is prepared locally in your browser.</div>
            </div>
          ) : (
            <form className="nt-form-content" key="join" onSubmit={handleJoin} aria-label="Join existing room">
              <div className="nt-form-heading">
                <div className="nt-form-step">02</div>
                <div><h3>Join an existing room</h3><p>Paste the room code or the invitation link.</p></div>
              </div>
              <label className="nt-input-label" htmlFor="room-code">ROOM CODE OR INVITATION LINK</label>
              <div className="nt-input-wrap">
                <Link2 size={17} />
                <input id="room-code" className="nt-room-input" placeholder="Paste your invitation here" value={joinCode} onChange={e => updateJoinCode(e.target.value)} autoComplete="off" spellCheck={false} />
                {joinCode && <button type="button" aria-label="Clear room code" onClick={() => setJoinCode('')}>×</button>}
              </div>
              <Button type="submit" size="xl" loading={joining} disabled={!joinCode.trim()} className="w-full nt-create-button">
                Join transfer room <ArrowRight size={16} aria-hidden />
              </Button>
              <div className="nt-secure-note"><QrCode size={12} /> You can also scan the QR code shared by the sender.</div>
            </form>
          )}
          {error && <div className="nt-error" role="alert"><span>!</span>{error}</div>}
          <div className="nt-workspace-footer"><span><span className="nt-live-dot" /> No account needed</span><span>Nothing to install</span></div>
        </div>
      </section>

      <section className="nt-file-strip" aria-label="Supported file types">
        <div className="nt-file-strip-copy"><span>NO FORMAT FUSS</span><b>Send what you need.</b><small>Files and folders, without a conversion step.</small></div>
        <div className="nt-file-types">{FILE_TYPES.map(item => <div className={`nt-file-type nt-${item.tone}`} key={item.label}>{item.icon}<span>{item.label}</span></div>)}</div>
        <div className="nt-file-limit"><HardDrive size={17} /><span><b>Up to 10 GB</b><small>Per file</small></span></div>
      </section>

      <section className="nt-how">
        <div className="nt-how-heading">
          <div><span className="nt-section-eyebrow">A SIMPLE THREE-STEP FLOW</span><h2>Private by design.<br />Easy by default.</h2></div>
          <p>No account, no upload queue, no cloud drive. Just a secure connection between the people sharing files.</p>
        </div>
        <div className="nt-step-grid">
          <article className="nt-step-card">
            <div className="nt-step-top"><span>01 / CREATE</span><span className="nt-step-icon"><Link2 size={18} /></span></div>
            <div className="nt-step-art nt-art-link"><div className="nt-mini-link"><Link2 size={19} /><span>Private room link</span><Check size={14} /></div><div className="nt-art-line" /></div>
            <h3>Make a private room</h3><p>Create a temporary room and share its link or QR code with the recipient.</p>
          </article>
          <article className="nt-step-card">
            <div className="nt-step-top"><span>02 / CONNECT</span><span className="nt-step-icon"><ShieldCheck size={18} /></span></div>
            <div className="nt-step-art nt-art-secure"><div className="nt-secure-node"><Laptop size={19} /><span>Your device</span></div><div className="nt-secure-path"><i /><LockKeyhole size={15} /><i /></div><div className="nt-secure-node"><Smartphone size={19} /><span>Recipient</span></div></div>
            <h3>Connect securely</h3><p>Your browsers establish a direct connection and exchange temporary encryption keys.</p>
          </article>
          <article className="nt-step-card">
            <div className="nt-step-top"><span>03 / TRANSFER</span><span className="nt-step-icon"><UploadCloud size={18} /></span></div>
            <div className="nt-step-art nt-art-progress"><div className="nt-progress-file"><span><File size={17} /></span><div><b>Project-files.zip</b><small>Transfer in progress</small></div><strong>68%</strong></div><div className="nt-progress-track"><i /></div><div className="nt-progress-meta"><span>Direct transfer</span><span>Encrypted</span></div></div>
            <h3>Send directly</h3><p>Files travel between devices over WebRTC. The signaling server never sees file contents.</p>
          </article>
        </div>
      </section>

      <section className="nt-bottom-banner">
        <div className="nt-bottom-icon"><Fingerprint size={20} /></div>
        <div><b>Your files are yours. Keep it that way.</b><span>Open source, built with WebRTC and libsodium.</span></div>
        <a href="https://github.com/shehzadres/p2p-encrypted-file-transfer" target="_blank" rel="noopener noreferrer"><Github size={15} /> View source <ArrowUpRight size={13} /></a>
      </section>
    </div>
  );
}

function ClockIcon() {
  return <Clock size={13} aria-hidden />;
}
