import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

const OPTIONS = [
  { id: 'light',  label: 'Light',  Icon: Sun     },
  { id: 'dark',   label: 'Dark',   Icon: Moon    },
  { id: 'system', label: 'System', Icon: Monitor },
];

/**
 * ThemeToggle — glass icon button that opens a menu to pick
 * Light / Dark / System. The icon morphs between sun and moon.
 */
export function ThemeToggle({ className }) {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef   = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Change theme"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-9 h-9 rounded-full flex items-center justify-center text-subtle
                   bg-[var(--fill-1)] border border-[var(--line)]
                   hover:text-bright hover:bg-[var(--fill-2)] hover:border-[var(--line-strong)]
                   transition-all duration-200 active:scale-90"
        title={`Theme: ${preference === 'system' ? `System (${resolved})` : preference}`}
      >
        <span className="relative w-4 h-4">
          <Sun
            size={16}
            className={cn(
              'absolute inset-0 transition-all duration-500 ease-spring',
              resolved === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50',
            )}
            aria-hidden
          />
          <Moon
            size={16}
            className={cn(
              'absolute inset-0 transition-all duration-500 ease-spring',
              resolved === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50',
            )}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Theme options"
          className="absolute right-0 top-full mt-3 w-40 glass-bright rounded-2xl
                     overflow-hidden z-50 animate-scale-in origin-top-right p-1.5"
        >
          {OPTIONS.map(({ id, label, Icon }) => {
            const active = preference === id;
            return (
              <button
                key={id}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setPreference(id); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-xl transition-colors',
                  active
                    ? 'text-bright bg-accent/15'
                    : 'text-subtle hover:text-bright hover:bg-[var(--fill-2)]',
                )}
              >
                <Icon size={14} aria-hidden className={active ? 'text-accent-light' : undefined} />
                <span className="flex-1 font-medium">{label}</span>
                {active && <Check size={13} className="text-accent-light" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
