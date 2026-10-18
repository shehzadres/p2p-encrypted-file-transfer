import { useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, selectUnreadNotifications } from '@/store/appStore';

const CONFIG = {
  success: { Icon: CheckCircle2,  color: 'text-success', tile: 'bg-success-muted border-success/30', bar: 'bg-success' },
  error:   { Icon: AlertCircle,   color: 'text-danger',  tile: 'bg-danger-muted  border-danger/30',  bar: 'bg-danger'  },
  warning: { Icon: AlertTriangle, color: 'text-warning', tile: 'bg-warning-muted border-warning/30', bar: 'bg-warning' },
  info:    { Icon: Info,          color: 'text-accent',  tile: 'bg-accent-muted  border-accent/30',  bar: 'bg-accent'  },
};

export function ToastContainer() {
  const { state, actions } = useAppStore();
  const visible = selectUnreadNotifications(state).slice(0, 5);

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 items-end pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
      aria-atomic="false"
    >
      {visible.map((n, i) => (
        <Toast
          key={n.id}
          notification={n}
          index={i}
          onDismiss={() => actions.dismissNotification(n.id)}
        />
      ))}
    </div>
  );
}

function Toast({ notification: n, index, onDismiss }) {
  const ttl      = n.type === 'error' ? 8000 : 5000;
  const cfg      = CONFIG[n.type] ?? CONFIG.info;
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, ttl);
    return () => clearTimeout(timerRef.current);
  }, [n.id]);

  return (
    <div
      role="alert"
      aria-live={n.type === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto glass-raised rounded-2xl overflow-hidden',
        'max-w-sm w-[calc(100vw-2.5rem)] sm:w-80 animate-slide-in-right',
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className={cn('w-8 h-8 rounded-xl border flex items-center justify-center shrink-0', cfg.tile)}>
          <cfg.Icon size={15} className={cfg.color} aria-hidden />
        </span>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-bright leading-snug">{n.title}</p>
          {n.body && <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-muted hover:text-text transition-colors shrink-0 mt-0.5
                     w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[var(--fill-2)]"
        >
          <X size={13} />
        </button>
      </div>

      {/* Progress drain bar */}
      <div className="h-0.5 w-full bg-[var(--line)]">
        <div
          className={cn('h-full w-full', cfg.bar)}
          style={{ animation: `drainBar ${ttl}ms linear forwards` }}
        />
      </div>

      <style>{`
        @keyframes drainBar {
          from { transform: scaleX(1);  transform-origin: left; }
          to   { transform: scaleX(0);  transform-origin: left; }
        }
      `}</style>
    </div>
  );
}
