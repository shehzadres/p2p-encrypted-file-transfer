import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initCrypto } from './lib/crypto';
import { checkBrowserCompat } from './lib/browserCompat';
import App from './App';
import './styles/globals.css';

async function bootstrap() {
  // ── Browser capability check ─────────────────────────────────────────────
  const { ok, missing } = checkBrowserCompat();
  if (!ok) {
    document.getElementById('root').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#050508;color:#e2e2f0;font-family:sans-serif;text-align:center;padding:2rem">
        <div style="max-width:420px">
          <p style="font-size:2.5rem;margin-bottom:1rem">⚠️</p>
          <p style="font-size:1.15rem;font-weight:600;margin-bottom:.75rem;color:#f0f0ff">
            Browser not supported
          </p>
          <p style="color:#6b6b8a;font-size:.9rem;margin-bottom:1.5rem;line-height:1.6">
            The following required APIs are missing in your browser:
          </p>
          <ul style="list-style:none;margin-bottom:1.5rem;color:#ef4444;font-size:.875rem;line-height:2">
            ${missing.map((m) => `<li>✗ ${m}</li>`).join('')}
          </ul>
          <p style="color:#6b6b8a;font-size:.8rem">
            Please use Chrome 80+, Firefox 75+, Edge 80+, or Safari 15+
          </p>
        </div>
      </div>`;
    return;
  }

  // ── libsodium WASM initialisation ────────────────────────────────────────
  try {
    await initCrypto();
  } catch (err) {
    document.getElementById('root').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#050508;color:#ef4444;font-family:sans-serif;text-align:center;padding:2rem">
        <div>
          <p style="font-size:2rem;margin-bottom:1rem">🔒</p>
          <p style="font-size:1.1rem;font-weight:600;margin-bottom:.5rem;color:#f0f0ff">
            Cryptography failed to initialise
          </p>
          <p style="color:#6b6b8a;font-size:.9rem">${err.message}</p>
        </div>
      </div>`;
    return;
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();
