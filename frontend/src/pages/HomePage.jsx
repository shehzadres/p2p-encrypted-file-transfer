import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Check, CloudOff, FileUp, Fingerprint,
  Link2, LockKeyhole, Send, ShieldCheck, Smartphone, Laptop,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { RoomOptions } from '@/components/transfer/RoomOptions';
import { API_URL } from '@/lib/config';

const DEFAULT_OPTIONS = { expiryTier: 'day', maxPeers: 9, selfDestruct: false };
const MODES = [
  { id: 'send', label: 'Send files', icon: <Send size={14} aria-hidden /> },
  { id: 'join', label: 'Join a room', icon: <Link2 size={14} aria-hidden /> },
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
      setError('Could not reach the signaling server. Please try again.');
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
        setError('Room not found. Check the code and try again.');
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

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> PRIVATE FILE TRANSFER</div>
          <h1>Move files.<br /><span>Not through servers.</span></h1>
          <p className="home-intro">
            Send files straight from your browser to another device. Encrypted before they leave,
            and never stored in the cloud.
          </p>
          <div className="home-proof">
            <div className="proof-item"><ShieldCheck size={16} /><span>End-to-end encrypted</span></div>
            <div className="proof-item"><CloudOff size={16} /><span>No cloud storage</span></div>
            <div className="proof-item"><Fingerprint size={16} /><span>Private by default</span></div>
          </div>
          <div className="home-note">
            <div className="device-pair" aria-hidden="true">
              <Laptop size={17} /><span className="device-connector" /><Smartphone size={16} />
            </div>
            <span>Direct browser-to-browser connection</span>
          </div>
        </div>

        <div className="transfer-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-overline">GET STARTED</span>
              <h2>Start a transfer</h2>
            </div>
            <div className="panel-lock"><LockKeyhole size={17} /></div>
          </div>
          <Segmented label="Transfer mode" value={mode} onChange={switchMode} options={MODES} />
          {mode === 'send' ? (
            <div className="panel-form" key="send">
              <div className="form-intro">
                <h3>Send something</h3>
                <p>Create a private room, then share its link with your recipient.</p>
              </div>
              <RoomOptions value={options} onChange={setOptions} />
              <Button size="xl" onClick={handleCreateRoom} loading={loading} className="w-full home-submit">
                Create transfer <ArrowRight size={16} aria-hidden />
              </Button>
              <p className="form-footnote"><LockKeyhole size={12} /> Your browser handles encryption locally.</p>
            </div>
          ) : (
            <form className="panel-form" key="join" onSubmit={handleJoin} aria-label="Join existing room">
              <div className="form-intro">
                <h3>Join a transfer</h3>
                <p>Enter the room code or paste the invitation link you received.</p>
              </div>
              <label className="field-label" htmlFor="room-code">ROOM CODE OR LINK</label>
              <div className="join-field">
                <Link2 size={16} aria-hidden />
                <input
                  id="room-code"
                  className="input"
                  placeholder="Paste room code or link"
                  value={joinCode}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    const match = val.match(/\/(?:receive|room)\/([a-zA-Z0-9_-]+)/);
                    setJoinCode(match ? match[1] : val);
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Button type="submit" size="xl" loading={joining} disabled={!joinCode.trim()} className="w-full home-submit">
                Join transfer <ArrowRight size={16} aria-hidden />
              </Button>
            </form>
          )}
          {error && <div className="home-error" role="alert"><span>!</span>{error}</div>}
        </div>
      </section>

      <section className="home-details" aria-label="How Nexus Transfer works">
        <div className="details-heading">
          <span className="eyebrow">BUILT AROUND PRIVACY</span>
          <h2>Simple on the surface.<br />Thoughtful underneath.</h2>
        </div>
        <div className="detail-grid">
          <article className="detail-item">
            <span className="detail-number">01</span>
            <div className="detail-icon"><FileUp size={19} /></div>
            <h3>Create a room</h3>
            <p>Start a transfer and share a private link or QR code with the person receiving your files.</p>
          </article>
          <article className="detail-item">
            <span className="detail-number">02</span>
            <div className="detail-icon"><LockKeyhole size={19} /></div>
            <h3>Connect securely</h3>
            <p>Your browsers establish a direct connection and agree on temporary encryption keys.</p>
          </article>
          <article className="detail-item">
            <span className="detail-number">03</span>
            <div className="detail-icon"><Check size={19} /></div>
            <h3>Send directly</h3>
            <p>Files travel between devices over WebRTC. The signaling server never sees file contents.</p>
          </article>
        </div>
      </section>

      <section className="home-bottom-note">
        <div><span className="bottom-mark" /><span>Open source</span></div>
        <p>Built with WebRTC and libsodium. No account, no upload queue, no cloud drive.</p>
        <a href="https://github.com/shehzadres/p2p-encrypted-file-transfer" target="_blank" rel="noopener noreferrer">
          Explore the project <ArrowUpRight size={14} />
        </a>
      </section>
    </div>
  );
}
