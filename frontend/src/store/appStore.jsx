import { createContext, useContext, useReducer, useCallback, useRef } from 'react';

// ── Types (JSDoc) ──────────────────────────────────────────────────────────
/**
 * @typedef {'queued'|'transferring'|'paused'|'complete'|'error'|'cancelled'} TransferStatus
 *
 * @typedef {Object} Transfer
 * @property {string}         id
 * @property {string}         name
 * @property {number}         size
 * @property {string}         type
 * @property {TransferStatus} status
 * @property {number}         percent      0–100
 * @property {number}         speed        bytes/s (EMA-smoothed)
 * @property {number}         peakSpeed    highest speed recorded
 * @property {number}         eta          seconds remaining
 * @property {'send'|'receive'} direction
 * @property {string}         peerId
 * @property {number}         startedAt    timestamp ms (0 = not started)
 * @property {number}         completedAt  timestamp ms (0 = not done)
 * @property {string|null}    errorMessage
 * @property {number}         sent         bytes sent/received
 * @property {boolean}        stalled      true if speed = 0 for >3s while transferring
 */

/**
 * @typedef {Object} Notification
 * @property {string}   id
 * @property {'info'|'success'|'warning'|'error'} type
 * @property {string}   title
 * @property {string}   [body]
 * @property {number}   createdAt
 * @property {boolean}  read
 * @property {boolean}  dismissed
 */

/**
 * @typedef {Object} AppState
 * @property {'idle'|'connecting'|'connected'|'error'} connectionStatus
 * @property {string|null}    roomId
 * @property {string|null}    peerId
 * @property {string[]}       peers
 * @property {Transfer[]}     transfers      active + recent transfers
 * @property {Transfer[]}     history        completed transfers (preserved across rooms)
 * @property {Notification[]} notifications
 * @property {string|null}    error
 * @property {Object}         sessionStats
 */

const initialSessionStats = {
  totalBytesSent:     0,
  totalBytesReceived: 0,
  filesCompleted:     0,
  filesFailed:        0,
  sessionStart:       Date.now(),
};

const initialState = {
  connectionStatus: 'idle',
  roomId:           null,
  peerId:           null,
  peers:            [],
  transfers:        [],
  history:          [],       // survives room reset
  notifications:    [],
  error:            null,
  sessionStats:     { ...initialSessionStats },
};

// ── Reducer ────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };

    case 'SET_ROOM':
      return { ...state, roomId: action.payload.roomId, peerId: action.payload.peerId };

    case 'ADD_PEER':
      return { ...state, peers: [...state.peers.filter((p) => p !== action.payload), action.payload] };

    case 'REMOVE_PEER':
      return { ...state, peers: state.peers.filter((p) => p !== action.payload) };

    case 'CLEAR_PEERS':
      return { ...state, peers: [] };

    // ── Transfers ──────────────────────────────────────────────────────────

    case 'ADD_TRANSFER': {
      const t = {
        percent:      0,
        speed:        0,
        peakSpeed:    0,
        eta:          Infinity,
        startedAt:    0,
        completedAt:  0,
        errorMessage: null,
        sent:         0,
        stalled:      false,
        peerId:       '',
        ...action.payload,
      };
      return { ...state, transfers: [...state.transfers, t] };
    }

    case 'UPDATE_TRANSFER': {
      const { id, ...patch } = action.payload;

      // Compute derived fields
      if (patch.sent != null && patch.size != null) {
        patch.percent = patch.size > 0 ? (patch.sent / patch.size) * 100 : 0;
      } else if (patch.received != null && patch.total != null) {
        patch.percent = patch.total > 0 ? (patch.received / patch.total) * 100 : 0;
        patch.sent    = patch.received;
      }

      // Track peak speed
      let sessionStats = state.sessionStats;

      const updated = state.transfers.map((t) => {
        if (t.id !== id) return t;
        const merged = { ...t, ...patch };
        // Peak speed
        if (merged.speed > (merged.peakSpeed || 0)) merged.peakSpeed = merged.speed;
        // Stall detection: speed=0 while transferring
        if (merged.status === 'transferring' && merged.speed === 0 && t.speed === 0) {
          merged.stalled = true;
        } else {
          merged.stalled = false;
        }
        // Timestamps
        if (patch.status === 'transferring' && t.startedAt === 0) merged.startedAt = Date.now();
        if (patch.status === 'complete'     && t.completedAt === 0) {
          merged.completedAt = Date.now();
          sessionStats = {
            ...sessionStats,
            filesCompleted:     sessionStats.filesCompleted + 1,
            totalBytesSent:     merged.direction === 'send'
              ? sessionStats.totalBytesSent + merged.size
              : sessionStats.totalBytesSent,
            totalBytesReceived: merged.direction === 'receive'
              ? sessionStats.totalBytesReceived + merged.size
              : sessionStats.totalBytesReceived,
          };
        }
        if ((patch.status === 'error' || patch.status === 'cancelled') && t.completedAt === 0) {
          merged.completedAt = Date.now();
          sessionStats = { ...sessionStats, filesFailed: sessionStats.filesFailed + 1 };
        }
        return merged;
      });

      return { ...state, transfers: updated, sessionStats };
    }

    case 'REMOVE_TRANSFER':
      return { ...state, transfers: state.transfers.filter((t) => t.id !== action.payload) };

    case 'CLEAR_COMPLETED': {
      // Move completed transfers to history, remove from active list
      const done    = state.transfers.filter((t) => ['complete', 'error', 'cancelled'].includes(t.status));
      const active  = state.transfers.filter((t) => !['complete', 'error', 'cancelled'].includes(t.status));
      return {
        ...state,
        transfers: active,
        history:   [...done, ...state.history].slice(0, 100), // keep last 100
      };
    }

    case 'CLEAR_HISTORY':
      return { ...state, history: [] };

    // ── Notifications ──────────────────────────────────────────────────────

    case 'ADD_NOTIFICATION': {
      const n = {
        id:        crypto.randomUUID(),
        createdAt: Date.now(),
        read:      false,
        dismissed: false,
        ...action.payload,
      };
      return { ...state, notifications: [n, ...state.notifications].slice(0, 50) };
    }

    case 'DISMISS_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload ? { ...n, dismissed: true, read: true } : n
        ),
      };

    case 'MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };

    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };

    // ── Misc ───────────────────────────────────────────────────────────────

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'RESET': {
      // Preserve history and session stats; clear room-specific state
      const done = state.transfers.filter((t) => ['complete', 'error', 'cancelled'].includes(t.status));
      return {
        ...initialState,
        history:      [...done, ...state.history].slice(0, 100),
        notifications: state.notifications,
        sessionStats:  state.sessionStats,
      };
    }

    default:
      return state;
  }
}

// ── Context + Provider ─────────────────────────────────────────────────────

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Stall timer: tracks last-seen non-zero speed per transfer
  const stallTimers = useRef(new Map()); // id → { lastSpeed, timer }

  const actions = {
    setConnectionStatus: useCallback((s) =>
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: s }), []),

    setRoom: useCallback((roomId, peerId) =>
      dispatch({ type: 'SET_ROOM', payload: { roomId, peerId } }), []),

    addPeer: useCallback((p) =>
      dispatch({ type: 'ADD_PEER', payload: p }), []),

    removePeer: useCallback((p) =>
      dispatch({ type: 'REMOVE_PEER', payload: p }), []),

    clearPeers: useCallback(() => dispatch({ type: 'CLEAR_PEERS' }), []),

    addTransfer: useCallback((t) =>
      dispatch({ type: 'ADD_TRANSFER', payload: t }), []),

    updateTransfer: useCallback((update) => {
      dispatch({ type: 'UPDATE_TRANSFER', payload: update });
    }, []),

    removeTransfer: useCallback((id) =>
      dispatch({ type: 'REMOVE_TRANSFER', payload: id }), []),

    clearCompleted: useCallback(() =>
      dispatch({ type: 'CLEAR_COMPLETED' }), []),

    clearHistory: useCallback(() =>
      dispatch({ type: 'CLEAR_HISTORY' }), []),

    // Notifications
    notify: useCallback((n) =>
      dispatch({ type: 'ADD_NOTIFICATION', payload: n }), []),

    dismissNotification: useCallback((id) =>
      dispatch({ type: 'DISMISS_NOTIFICATION', payload: id }), []),

    markAllRead: useCallback(() =>
      dispatch({ type: 'MARK_ALL_READ' }), []),

    clearNotifications: useCallback(() =>
      dispatch({ type: 'CLEAR_NOTIFICATIONS' }), []),

    setError: useCallback((e) =>
      dispatch({ type: 'SET_ERROR', payload: e }), []),

    clearError: useCallback(() =>
      dispatch({ type: 'CLEAR_ERROR' }), []),

    reset: useCallback(() =>
      dispatch({ type: 'RESET' }), []),

    // No-op stub consumed by useRoom (peer stats go to diagnostics, not store)
    setPeerStats: useCallback(() => {}, []),
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}

// ── Selectors ──────────────────────────────────────────────────────────────

export function selectActiveTransfers(state) {
  return state.transfers.filter((t) => ['queued', 'transferring', 'paused'].includes(t.status));
}

export function selectCompletedTransfers(state) {
  return state.transfers.filter((t) => ['complete', 'error', 'cancelled'].includes(t.status));
}

export function selectTotalProgress(state) {
  const active = state.transfers.filter((t) => t.size > 0);
  if (active.length === 0) return 0;
  const totalBytes = active.reduce((acc, t) => acc + t.size, 0);
  const sentBytes  = active.reduce((acc, t) => acc + (t.sent || 0), 0);
  return totalBytes > 0 ? (sentBytes / totalBytes) * 100 : 0;
}

export function selectAggregateSpeed(state) {
  return state.transfers
    .filter((t) => t.status === 'transferring')
    .reduce((acc, t) => acc + (t.speed || 0), 0);
}

export function selectUnreadNotifications(state) {
  return state.notifications.filter((n) => !n.read && !n.dismissed);
}
