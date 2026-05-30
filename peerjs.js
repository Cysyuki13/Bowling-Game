// PeerJS connection layer to replace Firebase realtime DB.
// Keep game logic/UI untouched: script.js still calls createMatch(), joinGame(),
// updateOpponentBall(), updateOpponentPins(), sendMatchEvent(), etc.
// This file provides a thin compatibility layer by exposing globals that
// script.js expects (matchRef, firebase-like objects), implemented using PeerJS.

// Load via index.html AFTER PeerJS script include in <head> or before script.js.
// If PeerJS isn't loaded, fall back gracefully.

(() => {
  const HAS_PEER = typeof Peer !== 'undefined';

  // Globals used by script.js
  window.__peerjs = window.__peerjs || {};

  const state = {
    peer: null,
    conn: null,
    conn2: null,
    call: null,
    isHost: true,
    roomId: null,
    peerId: null,
    remotePeerId: null,
    // "matchRef" compatibility
    listeners: new Map(),
    // to emulate firebase.database.ServerValue.TIMESTAMP
    ServerValue: { TIMESTAMP: Date.now() }
  };

  // Minimal fake firebase namespace used in script.js
  window.firebase = window.firebase || {};
  window.firebase.database = () => ({
    goOnline: () => {},
    goOffline: () => {},
  });

  // Provide firebase.database.ServerValue.TIMESTAMP used by script.js.
  window.firebase.database.ServerValue = state.ServerValue;

  // Ensure matchRef exists so script.js can call getMatchRef() etc.
  // script.js's getMatchRef currently checks window.db.ref(). We'll keep window.db
  // compatible by providing window.db.ref() that routes to PeerJS.

  // Create in-memory "db" that implements ref(path)
  const db = {
    _refs: new Map(),
    ref: (path) => {
      // path format: matches/<code>
      const m = String(path).match(/^matches\/(.+)$/);
      const code = m ? m[1] : null;
      const ref = db._refs.get(path) || createMatchRef(code);
      db._refs.set(path, ref);
      return ref;
    },
    goOnline: () => {},
    goOffline: () => {}
  };

  window.db = db;

  function createMatchRef(code) {
    const ref = {
      __code: code,
      child: (sub) => createChildRef(code, sub),
      set: async (data) => {
        // Host sets room metadata. We'll treat set() as room create.
        await ensurePeer();
        state.roomId = code;
        state.isHost = true;
        // Host becomes publicly reachable by its peerId.
        // We'll use a fixed mapping peerId = 'host-' + code.
        // Guest will call into that peerId via PeerJS.
        // For that, host must know its peerId.
        state.peerId = getHostPeerId(code);
        state.peer._id = state.peerId; // best effort
        // If peer id was auto, we can't change. We'll always create using host id below.
        return;
      },
      once: async (eventName) => {
        // script.js uses matchRef.once('value').then(snapshot=>...)
        // We'll resolve with host/guest info if reachable.
        const data = await fetchMatchSnapshot(code);
        return {
          val: () => data
        };
      },
      remove: async () => {
        if (state.conn) try { state.conn.close(); } catch {}
        if (state.peer) try { state.peer.destroy(); } catch {}
      },
      onDisconnect: () => ({ remove: () => {} })
    };
    return ref;
  }

  function createChildRef(code, childPath) {
    return {
      set: async (value) => {
        await sendToRemote({ type: 'set', path: childPath, value });
      },
      once: async () => {
        const data = await fetchMatchSnapshot(code);
        const seg = String(childPath);
        const val = getPathValue(data, seg);
        return { val: () => val };
      },
      on: (eventName, cb) => {
        // script.js uses ref.on('value', handler)
        registerListener(childPath, cb);
      },
      off: () => {}
    };
  }

  function registerListener(path, cb) {
    // Store single callback per path (good enough for this game)
    state.listeners.set(path, cb);
  }

  function getPathValue(obj, path) {
    const parts = String(path).split('/').filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  async function ensurePeer() {
    if (state.peer) return;

    // We must create Peer instances with explicit ids to enable matching.
    // Since script.js decides host/guest based on user action,
    // we'll lazily create peer with guessed id.
    // If peer id isn't available, PeerJS will throw.
    const isHostMode = !!state.isHost;
    const id = state.roomId ? (isHostMode ? getHostPeerId(state.roomId) : undefined) : undefined;

    // Create peer without id, then we rely on caller-provided join mechanism.
    // But to keep compatibility (5-digit room code), we use host peer id.
    state.peer = new Peer(id, {
      // Default to public PeerJS server; user can replace if needed.
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      debug: 0
    });

    state.peer.on('open', (id2) => {
      state.peerId = id2;
    });
  }

  function getHostPeerId(code) {
    return 'host-' + code;
  }

  async function fetchMatchSnapshot(code) {
    // Emulate minimal match snapshot: { host: { connected, mode, sessionId }, guest: {...} }
    // We'll attempt to contact host peer to ask for snapshot.
    await ensurePeer();

    const hostPeerId = getHostPeerId(code);
    const conn = state.peer.connect(hostPeerId, { reliable: true });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        try { conn.close(); } catch {}
        resolve(null);
      }, 2500);

      conn.on('open', () => {
        conn.send({ type: 'snapshot_request' });
      });

      conn.on('data', (msg) => {
        if (msg && msg.type === 'snapshot_response') {
          clearTimeout(timeout);
          resolve(msg.payload || null);
          try { conn.close(); } catch {}
        }
      });

      conn.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }

  async function sendToRemote(msg) {
    if (!state.conn) {
      // If not connected yet, ignore.
      return;
    }
    try {
      state.conn.send({ type: 'compat', ...msg });
    } catch {}
  }

  // Public API for script.js to create/join.
  // We'll hook by listening to peer connections and relaying.

  async function connectAsHost(code) {
    await ensurePeer();
    state.roomId = code;
    state.isHost = true;

    // If peer has auto id, better to recreate with fixed host id.
    if (state.peerId !== getHostPeerId(code)) {
      try { state.peer.destroy(); } catch {}
      state.peer = new Peer(getHostPeerId(code), {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 0
      });
    }

    state.peer.on('connection', (conn) => {
      // Single guest connection
      if (state.conn) {
        try { conn.close(); } catch {}
        return;
      }
      state.conn = conn;
      wireConnectionHandlers(conn);
    });
  }

  async function connectAsGuest(code) {
    await ensurePeer();
    state.roomId = code;
    state.isHost = false;
    const hostPeerId = getHostPeerId(code);

    // Try to connect to host.
    const conn = state.peer.connect(hostPeerId, { reliable: true });
    state.conn = conn;

    wireConnectionHandlers(conn);

    return new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('connect timeout')), 5000);
      conn.on('open', () => {
        clearTimeout(to);
        resolve();
      });
      conn.on('error', (e) => {
        clearTimeout(to);
        reject(e);
      });
    });
  }

  function wireConnectionHandlers(conn) {
    conn.on('data', (msg) => {
      // Handle snapshot request/response and compat messages.
      if (!msg) return;

      if (msg.type === 'snapshot_request' && state.isHost) {
        const payload = {
          host: { connected: true, mode: window.targetPinCount, sessionId: window.sessionId || null, joinedAt: Date.now() },
          guest: state.conn2 ? { connected: true } : null
        };
        conn.send({ type: 'snapshot_response', payload });
        return;
      }

      if (msg.type === 'compat') {
        const { path, value } = msg;
        // Relay to the callback registered by script.js
        const cb = state.listeners.get(path);
        if (typeof cb === 'function') {
          cb({ val: () => value });
        }
      }

      if (msg.type === 'disconnect') {
        // Trigger script-side disconnect handling by calling hook if exists.
        if (typeof window.__onPeerDisconnected === 'function') {
          window.__onPeerDisconnected();
        }
      }
    });

    conn.on('close', () => {
      if (typeof window.__onPeerDisconnected === 'function') {
        window.__onPeerDisconnected();
      }
    });
  }

  // Hook script.js multiplayer functions by overriding the global functions.
  // We do it by providing peer wrappers and then letting script.js proceed with
  // its normal flow (it will call matchRef operations which we've shimmed).

  window.__peerCreateMatch = async function(code) {
    await connectAsHost(code);
  };

  window.__peerJoinMatch = async function(code) {
    await connectAsGuest(code);
  };

  // Provide disconnect callback entry
  window.__peerjs.onDisconnected = (fn) => { window.__onPeerDisconnected = fn; };

})();

