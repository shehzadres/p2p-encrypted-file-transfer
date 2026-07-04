import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/config';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function AppShell({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-void relative overflow-x-hidden transition-colors duration-300">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-64 left-1/2 -translate-x-1/2 w-[900px] h-[600px]
                        bg-accent/5 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-1/3 -right-64 w-[600px] h-[500px]
                        bg-teal/3 rounded-full blur-[100px]" />
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
    <header className="sticky top-0 z-50" role="banner">
      {/* Blur backing */}
      <div className="absolute inset-0 bg-void/70 backdrop-blur-xl border-b border-border/50 transition-colors duration-300" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 group rounded-lg focus-visible:ring-2
                     focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          aria-label="Nexus Transfer — home"
        >
          <NexusLogo />
          <span className="font-semibold text-text tracking-tight group-hover:text-bright transition-colors">
            {APP_NAME}
          </span>
        </Link>

        {/* Nav */}
        <nav aria-label="Header navigation" className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            <Pill icon={<ShieldCheck size={11} />} label="E2E Encrypted" />
            <Pill icon={<Zap size={11} />}         label="Zero Storage"  />
          </div>

          {!isHome && (
            <Link
              to="/"
              className="btn-ghost text-xs h-8 px-3 rounded-lg flex items-center gap-1.5"
            >
              New Transfer
              <ArrowRight size={12} />
            </Link>
          )}

          <div className="w-px h-5 bg-border mx-0.5" aria-hidden />

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function Pill({ icon, label }) {
  return (
    <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                     bg-surface/80 border border-border text-muted text-2xs font-medium
                     select-none">
      <span className="text-accent">{icon}</span>
      {label}
    </span>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/30 py-6 mt-auto" role="contentinfo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center
                      justify-between gap-3 text-xs text-muted">
        <p>Files travel directly between browsers — the server is a blind relay.</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot"
              aria-hidden
            />
            <span>Server online</span>
          </span>
          <a
            href="https://github.com"
            className="text-muted hover:text-text transition-colors"
            rel="noopener noreferrer"
            target="_blank"
          >
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
      width="28" height="28" viewBox="0 0 32 32" fill="none"
      className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12"
      aria-hidden
    >
      <rect width="32" height="32" rx="9" className="fill-panel transition-colors duration-300" />
      <rect width="32" height="32" rx="9" fill="url(#logo-grad)" fillOpacity="0.6" />
      <path d="M8 16 L16 8 L24 16 L16 24 Z" fill="none" className="stroke-accent" strokeWidth="1.8"
            strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.8" className="fill-accent-light" />
      <circle cx="16" cy="8"  r="1.2" className="fill-accent" opacity="0.55" />
      <circle cx="24" cy="16" r="1.2" className="fill-accent" opacity="0.55" />
      <circle cx="16" cy="24" r="1.2" className="fill-accent" opacity="0.55" />
      <circle cx="8"  cy="16" r="1.2" className="fill-accent" opacity="0.55" />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6c63ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#06b6d4" stopOpacity="0.1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
