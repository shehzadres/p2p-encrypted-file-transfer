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
 * ThemeToggle — icon button that flips dark/light directly on click,
 * with a dropdown (long-press / click-and-hold not required — secondary
 * click area) to explicitly pick System.
 *
 * Simple click: toggles dark <-> light.
 * Click the chevron-less small arrow: opens menu with all 3 options.
 */
export function ThemeToggle({ className }) {
  const { preference, resolved, setPreference, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef  = useRef(null);
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
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted
                   hover:text-text hover:bg-border/60 transition-all duration-150
                   active:scale-90"
        title={`Theme: ${preference === 'system' ? `System (${resolved})` : preference}`}
      >
        <span className="relative w-4 h-4">
          <Sun
            size={16}
            className={cn(
              'absolute inset-0 transition-all duration-300',
              resolved === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50',
            )}
            aria-hidden
          />
          <Moon
            size={16}
            className={cn(
              'absolute inset-0 transition-all duration-300',
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
          className="absolute right-0 top-full mt-2 w-36 glass-raised rounded-xl
                     shadow-elevated overflow-hidden z-50 animate-scale-in origin-top-right py-1"
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
                  'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors',
                  active ? 'text-accent-light bg-accent-muted' : 'text-subtle hover:text-text hover:bg-border/60',
                )}
              >
                <Icon size={13} aria-hidden />
                <span className="flex-1">{label}</span>
                {active && <Check size={12} aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
