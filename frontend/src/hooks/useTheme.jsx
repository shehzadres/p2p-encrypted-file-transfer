import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'nexus-theme'; // 'dark' | 'light' | 'system'
const ThemeContext = createContext(null);

function getSystemPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getStoredPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(resolved) {
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.classList.toggle('light', resolved === 'light');
  document.documentElement.classList.toggle('dark',  resolved === 'dark');
  // Keep the browser UI (address bar, etc.) in sync
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#f7f7fa' : '#050508');
}

/**
 * ThemeProvider — manages light/dark/system preference.
 *
 * Preference is persisted in localStorage. 'system' tracks the OS preference
 * live via a matchMedia listener. Applied via [data-theme] on <html>, which
 * the CSS custom properties in globals.css key off of.
 */
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getStoredPreference); // 'dark'|'light'|'system'
  const [resolved,   setResolved]   = useState(() =>
    getStoredPreference() === 'system' ? getSystemPreference() : getStoredPreference()
  );

  // Apply whenever resolved theme changes
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Recompute resolved theme when preference changes
  useEffect(() => {
    const next = preference === 'system' ? getSystemPreference() : preference;
    setResolved(next);
    try { localStorage.setItem(STORAGE_KEY, preference); } catch {}
  }, [preference]);

  // Track OS-level changes while in 'system' mode
  useEffect(() => {
    if (preference !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => setResolved(getSystemPreference());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const toggle = useCallback(() => {
    setPreference((p) => {
      // Cycle: dark -> light -> dark (system is selectable explicitly elsewhere)
      if (p === 'system') return getSystemPreference() === 'light' ? 'dark' : 'light';
      return p === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
