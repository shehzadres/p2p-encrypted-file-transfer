import { useEffect, useRef, useCallback, useState } from 'react';
import { SIGNALING_EVENTS } from '@shared/constants';
import { SignalingClient } from '@/lib/signalingClient';
import { PeerConnection } from '@/lib/peerConnection';
import { TransferEngine } from '@/lib/transferEngine';
import { fetchIceConfig } from '@/lib/browserCompat';
import { useAppStore } from '@/store/appStore';
import { API_URL } from '@/lib/config';

export function useRoom(roomId, role) {
  const { actions } = useAppStore();

  const sigRef       = useRef(null);
  const peersRef     = useRef(new Map());
  const iceConfigRef = useRef(null); // { iceServers, hasTurn } — fetched once

  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [peerCount,        setPeerCount]        = useState(0);
  const [peerList,         setPeerList]         = useState([]);
  const [fingerprint,      setFingerprint]      = useState(null);
  const [keyExchangeDone,  setKeyExchangeDone]  = useState(false);
  const [roomInfo,         setRoomInfo]         = useState(null);
  const [hasTurn,          setHasTurn]          = useState(false);

  // Load room info + ICE config in parallel
  useEffect(() => {
    if (!roomId) return;
    Promise.all([
      fetch(`${API_URL}/rooms/${roomId}`).then((r) => r.ok ? r.json() : null),
      fetchIceConfig(API_URL),
    ]).then(([info, ice]) => {
      if (info) setRoomInfo(info);
      if (ice)  {
        iceConfigRef.current = ice;
        setHasTurn(ice.hasTurn);
      }
    }).catch(() => {});
  }, [roomId]);

  const syncPeers = useCallback(() => {
    const entries = [...peersRef.current.entries()];
    setPeerCount(entries.length);
    setPeerList(entries.map(([peerId, e]) => ({ peerId, keyExchangeDone: e.keyDone })));
  }, []);

  const removePeer = useCallback((peerId) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    entry.unsubs.forEach((u) => u());
    entry.engine?.destroy();
    entry.pc?.destroy();
    peersRef.current.delete(peerId);
    actions.removePeer(peerId);
    syncPeers();
  }, [actions, syncPeers]);

  const addPeer = useCallback((peerId, isInitiator) => {
    if (peersRef.current.has(peerId)) return;
    const sig = sigRef.current;
    if (!sig) return;

    const ice = iceConfigRef.current ?? { iceServers: [], hasTurn: false };

    const pc = new PeerConnection({
      peerId,
      isInitiator,
      iceServers: ice.iceServers,
      hasTurn:    ice.hasTurn,
      onSignal: (type, payload) => {
        switch (type) {
          case 'offer':         sig.sendOffer(roomId, peerId, payload.sdp);             break;
          case 'answer':        sig.sendAnswer(roomId, peerId, payload.sdp);            break;
          case 'ice-candidate': sig.sendIceCandidate(roomId, peerId, payload.candidate);break;
        }
      },
    });

    pc.startDiagnostics(2000);
    const engine = new TransferEngine(pc, role);
    const unsubs = [];
    const entry  = { pc, engine, unsubs, keyDone: false };
    peersRef.current.set(peerId, entry);

    unsubs.push(engine.on('key-exchange-complete', ({ fingerprint: fp }) => {
      entry.keyDone = true;
      actions.addPeer(peerId);
      syncPeers();
      setKeyExchangeDone(true);
      if (fp) setFingerprint(fp);
    }));

    unsubs.push(engine.on('transfer-update',   (u) => actions.updateTransfer({ ...u, peerId })));
    unsubs.push(engine.on('transfer-incoming', (i) => actions.addTransfer({ ...i, peerId, direction: 'receive' })));
    unsubs.push(engine.on('transfer-progress', (p) => actions.updateTransfer({ ...p, peerId })));

    unsubs.push(engine.on('transfer-complete', ({ id }) => {
      actions.updateTransfer({ id, status: 'complete', percent: 100, speed: 0, eta: 0 });
      if (role === 'sender' && roomInfo?.selfDestruct) {
        fetch(`${API_URL}/rooms/${roomId}/done`, { method: 'POST' }).catch(() => {});
      }
    }));

    unsubs.push(engine.on('transfer-error',     ({ id }) => actions.updateTransfer({ id, status: 'error' })));
    unsubs.push(engine.on('transfer-cancelled', ({ id }) => actions.updateTransfer({ id, status: 'cancelled' })));

    // Connection recovery events
    unsubs.push(pc.on('relay-escalated', () => {
      actions.notify?.({ type: 'warning', title: 'Switching to TURN relay', body: 'Direct connection failed — using fallback server' });
    }));

    unsubs.push(pc.on('state-change', ({ state }) => {
      if (state === 'failed' || state === 'closed') removePeer(peerId);
    }));

    unsubs.push(pc.on('error', ({ phase, message }) => {
      console.warn(`[PC:${peerId.slice(0, 6)}] ${phase}:`, message);
    }));

    // Note: 'stats' events are consumed directly by useConnectionDiagnostics,
    // which subscribes to this PeerConnection instance itself — no relay needed here.

    syncPeers();
  }, [roomId, role, actions, removePeer, syncPeers, roomInfo]);

  // ── Signaling lifecycle ────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) return;

    const sig = new SignalingClient();
    sigRef.current = sig;
    const unsubs = [];

    unsubs.push(sig.on(SIGNALING_EVENTS.ROOM_INFO, (d) => actions.setRoom(roomId, d.peerId)));

    unsubs.push(sig.on(SIGNALING_EVENTS.ROOM_JOINED, (d) => {
      setConnectionStatus('connected');
      actions.setConnectionStatus('connected');
      for (const id of (d.peers ?? [])) addPeer(id, true);
    }));

    unsubs.push(sig.on(SIGNALING_EVENTS.PEER_JOINED,  (d) => addPeer(d.peerId, false)));
    unsubs.push(sig.on(SIGNALING_EVENTS.PEER_LEFT,    (d) => removePeer(d.peerId)));

    unsubs.push(sig.on(SIGNALING_EVENTS.OFFER, (d) => {
      const entry = peersRef.current.get(d.fromId);
      if (entry) {
        entry.pc.receiveOffer(d.sdp);
      } else {
        addPeer(d.fromId, false);
        peersRef.current.get(d.fromId)?.pc.receiveOffer(d.sdp);
      }
    }));

    unsubs.push(sig.on(SIGNALING_EVENTS.ANSWER,        (d) => peersRef.current.get(d.fromId)?.pc.receiveAnswer(d.sdp)));
    unsubs.push(sig.on(SIGNALING_EVENTS.ICE_CANDIDATE, (d) => peersRef.current.get(d.fromId)?.pc.receiveIceCandidate(d.candidate)));

    const setErr = (msg) => { setConnectionStatus('error'); actions.setConnectionStatus('error'); actions.setError(msg); };
    unsubs.push(sig.on(SIGNALING_EVENTS.ROOM_NOT_FOUND, () => setErr('Room not found')));
    unsubs.push(sig.on(SIGNALING_EVENTS.ROOM_FULL,      () => setErr('Room is full')));
    unsubs.push(sig.on(SIGNALING_EVENTS.ROOM_EXPIRED,   () => setErr('This link has expired')));
    unsubs.push(sig.on(SIGNALING_EVENTS.ERROR,   (d) => console.warn('[Signaling]', d)));
    unsubs.push(sig.on('disconnected',  () => setConnectionStatus('connecting')));
    unsubs.push(sig.on('reconnecting',  () => setConnectionStatus('connecting')));

    sig.connect();
    sig.joinRoom(roomId);

    return () => {
      unsubs.forEach((u) => u());
      sig.leaveRoom();
      sig.destroy();
      sigRef.current = null;
      for (const entry of peersRef.current.values()) {
        entry.unsubs.forEach((u) => u());
        entry.engine?.destroy();
        entry.pc?.destroy();
      }
      peersRef.current.clear();
      actions.reset();
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendFiles = useCallback(async (files) => {
    const fileArray = Array.from(files);
    const allIds = [];
    for (const [peerId, { engine }] of peersRef.current) {
      if (!engine?._keyExchangeDone) continue;
      try {
        const ids = await engine.sendFiles(fileArray);
        for (let i = 0; i < fileArray.length; i++) {
          actions.addTransfer({
            id: ids[i], name: fileArray[i].name, size: fileArray[i].size,
            type: fileArray[i].type, status: 'queued', percent: 0,
            speed: 0, eta: Infinity, direction: 'send', peerId,
          });
        }
        allIds.push(...ids);
      } catch (err) { console.error('[useRoom] sendFiles error:', err); }
    }
    return allIds;
  }, [actions]);

  const pauseTransfer  = useCallback((id) => { for (const { engine } of peersRef.current.values()) engine?.pause(id);  }, []);
  const resumeTransfer = useCallback((id) => { for (const { engine } of peersRef.current.values()) engine?.resume(id); }, []);
  const cancelTransfer = useCallback((id) => { for (const { engine } of peersRef.current.values()) engine?.cancel(id); }, []);
  const getPrimaryPC   = useCallback(() => peersRef.current.values().next().value?.pc ?? null, []);

  return {
    connectionStatus, peerCount, peerList,
    fingerprint, keyExchangeDone, roomInfo, hasTurn,
    sendFiles, pauseTransfer, resumeTransfer, cancelTransfer, getPrimaryPC,
  };
}
