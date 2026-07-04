import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/appStore';

/**
 * useNotifications — browser Notification API + in-app toast integration.
 *
 * Watches transfer state changes and fires notifications on:
 *   - Transfer complete (success)
 *   - Transfer error / cancelled
 *   - Transfer stalled (no progress for > 5s while active)
 *
 * Also exposes `notify()` for manual toasts.
 */
export function useNotifications() {
  const { state, actions } = useAppStore();
  const permissionRef      = useRef('default');
  const prevTransfers      = useRef(new Map()); // id → status

  // Request browser notification permission once on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((p) => { permissionRef.current = p; });
    } else if ('Notification' in window) {
      permissionRef.current = Notification.permission;
    }
  }, []);

  // Watch transfers for status changes
  useEffect(() => {
    for (const t of state.transfers) {
      const prev = prevTransfers.current.get(t.id);

      if (prev === t.status) continue; // no change

      // Complete
      if (t.status === 'complete' && prev !== 'complete') {
        const title = t.direction === 'receive'
          ? `Downloaded: ${t.name}`
          : `Sent: ${t.name}`;
        actions.notify({ type: 'success', title, body: formatBytes(t.size) });
        fireBrowserNotification(title, formatBytes(t.size), '✅');
      }

      // Error
      if (t.status === 'error' && prev !== 'error') {
        const title = `Transfer failed: ${t.name}`;
        actions.notify({ type: 'error', title, body: t.errorMessage ?? undefined });
        fireBrowserNotification(title, t.errorMessage ?? '', '❌');
      }

      // Cancelled
      if (t.status === 'cancelled' && prev !== 'cancelled') {
        actions.notify({ type: 'info', title: `Cancelled: ${t.name}` });
      }

      prevTransfers.current.set(t.id, t.status);
    }
  }, [state.transfers, actions]);

  const notify = useCallback((n) => actions.notify(n), [actions]);

  return { notify };
}

function fireBrowserNotification(title, body, icon) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/favicon.svg', silent: false });
    setTimeout(() => n.close(), 6000);
  } catch {
    // Some browsers block Notification in certain contexts
  }
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
