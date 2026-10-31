import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Github, ShieldCheck } from 'lucide-react';
import { APP_NAME } from '@/lib/config';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const REPO_URL = 'https://github.com/shehzadres/p2p-encrypted-file-transfer';

export function AppShell({ children }) {
  return (
    <div className="app-frame min-h-screen flex flex-col overflow-x-hidden">
      <a href="#main-content" className="skip-nav">Skip to content</a>
      <Header />
      <main id="main-content" className="flex-1 flex flex-col" role="main">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="site-header" role="banner">
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label={APP_NAME + ' home'}>
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="brand-name">{APP_NAME}</span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <a className="nav-link nav-github" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <Github size={15} aria-hidden="true" />
            <span>Source code</span>
            <ArrowUpRight size={12} aria-hidden="true" />
          </a>
          {!isHome && <Link to="/" className="nav-new">New transfer</Link>}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p><ShieldCheck size={14} aria-hidden="true" /> Your files move directly between devices. Nothing is stored.</p>
        <span>Private file transfer, made simple.</span>
      </div>
    </footer>
  );
}
