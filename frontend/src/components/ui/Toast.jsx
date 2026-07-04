import { useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, selectUnreadNotifications } from '@/store/appStore';

const CONFIG = {
  success: { Icon: CheckCircle2,  color: 'text-success', border: 'border-success/25', bar: 'bg-success' },
  error:   { Icon: AlertCircle,   color: 'text-danger',  border: 'border-danger/25',  bar: 'bg-danger'  },
  warning: { Icon: AlertTriangle, color: 'text-warning', border: 'border-warning/25', bar: 'bg-warning' },
  info:    { Icon: Info,          color: 'text-accent',  border: 'border-accent/25',  bar: 'bg-accent'  },
};

export function ToastContainer() {
  const { state, actions } = useAppStore();
  const visible = selectUnreadNotifications(state).slice(0, 5);

  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none"
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
        'max-w-sm w-[calc(100vw-2.5rem)] sm:w-80',
        'shadow-elevated border animate-slide-in-right',
        cfg.border,
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Progress drain bar */}
      <div
        className={cn('h-0.5 w-full', cfg.bar)}
        style={{
          animation: `drainBar ${ttl}ms linear forwards`,
        }}
      />

      <style>{`
        @keyframes drainBar {
          from { transform: scaleX(1);  transform-origin: left; }
          to   { transform: scaleX(0);  transform-origin: left; }
        }
      `}</style>

      <div className="flex items-start gap-3 px-4 py-3.5">
        <cfg.Icon size={15} className={cn(cfg.color, 'shrink-0 mt-0.5')} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text leading-snug">{n.title}</p>
          {n.body && <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-muted hover:text-text transition-colors shrink-0 mt-0.5
                     w-5 h-5 flex items-center justify-center rounded hover:bg-border"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
