import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Zap, ArrowRight, Github } from 'lucide-react';
import { APP_NAME } from '@/lib/config';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const REPO_URL = 'https://github.com/shehzadres/p2p-encrypted-file-transfer';

export function AppShell({ children }) {
  // Cursor-follow spotlight for glass surfaces: updates --mx / --my on the
  // surface under the pointer. CSS does the rest (see .glass / .card).
  useEffect(() => {
    const onMove = (e) => {
      const el = e.target?.closest?.('.glass, .glass-raised, .glass-bright, .card, .card-interactive');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-void relative overflow-x-hidden transition-colors duration-500">
      {/* Aurora backdrop */}
      <div className="aurora" aria-hidden>
        <span className="orb orb-a animate-orb-a" />
        <span className="orb orb-b animate-orb-b" />
        <span className="orb orb-c animate-orb-c" />
        <span className="aurora-grid" />
        <span className="aurora-grain" />
      </div>

      {/* Skip navigation */}
      <a href="#main-content" className="skip-nav">Skip to content</a>

      <Header />
      <main id="main-content" className="flex-1 flex flex-col relative z-10" role="main">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const location = useLocation();
  const isHome   = location.pathname === '/';

  return (
    <header className="sticky top-0 z-50 px-3 sm:px-6 pt-3" role="banner">
      <div className="glass-raised max-w-6xl mx-auto h-14 rounded-full pl-3 pr-2 sm:pl-4 sm:pr-2.5
                      flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 group rounded-full focus-visible:ring-2
                     focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          aria-label="Nexus Transfer — home"
        >
          <NexusLogo />
          <span className="font-semibold text-bright tracking-tight">
            {APP_NAME}
          </span>
        </Link>

        {/* Nav */}
        <nav aria-label="Header navigation" className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 mr-1">
            <Pill icon={<ShieldCheck size={12} />} label="E2E Encrypted" />
            <Pill icon={<Zap size={12} />}         label="Zero Storage"  />
          </div>

          {!isHome && (
            <Link
              to="/"
              className="btn-outline text-xs h-9 px-3.5 rounded-full flex items-center gap-1.5 !py-0"
            >
              New Transfer
              <ArrowRight size={12} />
            </Link>
          )}

          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center text-subtle
                       bg-[var(--fill-1)] border border-[var(--line)]
                       hover:text-bright hover:bg-[var(--fill-2)] hover:border-[var(--line-strong)]
                       transition-all duration-200 active:scale-90"
          >
            <Github size={16} aria-hidden />
          </a>

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function Pill({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                     bg-[var(--fill-1)] border border-[var(--line)] text-subtle text-2xs font-medium
                     select-none">
      <span className="text-accent-light">{icon}</span>
      {label}
    </span>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 px-3 sm:px-6 pb-4 pt-8 mt-auto" role="contentinfo">
      <div className="glass max-w-6xl mx-auto rounded-3xl px-5 sm:px-6 py-4 flex flex-col sm:flex-row
                      items-center justify-between gap-3 text-xs text-muted">
        <p>Files travel directly between browsers — the server is a blind relay.</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" aria-hidden />
            <span>Server online</span>
          </span>
          <a
            href={REPO_URL}
            className="inline-flex items-center gap-1.5 text-subtle hover:text-bright transition-colors"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Github size={13} aria-hidden />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

function NexusLogo() {
  return (
    <svg
      width="32" height="32" viewBox="0 0 32 32" fill="none"
      className="transition-transform duration-500 ease-spring group-hover:scale-110 group-hover:rotate-[18deg]
                 drop-shadow-[0_4px_14px_rgb(var(--c-accent)/0.55)]"
      aria-hidden
    >
      <rect width="32" height="32" rx="10" fill="url(#logo-bg)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="9.5" stroke="white" strokeOpacity="0.28" />
      <path d="M16 6.5 L25.5 16 L16 25.5 L6.5 16 Z" stroke="white" strokeOpacity="0.95" strokeWidth="1.6"
            strokeLinejoin="round" fill="white" fillOpacity="0.1" />
      <circle cx="16" cy="16" r="3" fill="white" />
      <circle cx="16" cy="6.5"  r="1.4" fill="white" fillOpacity="0.8" />
      <circle cx="25.5" cy="16" r="1.4" fill="white" fillOpacity="0.8" />
      <circle cx="16" cy="25.5" r="1.4" fill="white" fillOpacity="0.8" />
      <circle cx="6.5" cy="16"  r="1.4" fill="white" fillOpacity="0.8" />
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6c4df0" />
          <stop offset="0.55" stopColor="#7c5cf5" />
          <stop offset="1" stopColor="#22b8d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}
