// PeerJS replacement for Firebase multiplayer (Fixed Identity Lifecycle Layer)
(() => {
  const HAS_PEER = typeof Peer !== 'undefined';
  if (!HAS_PEER) {
    console.warn('[PeerJS] Peer library is not loaded. Multiplayer will not work.');
    return;
  }

  // Hook for connection_debug.js lifecycle checks
  window.__peerjs = window.__peerjs || {};
  let disconnectCallback = null;
  window.__peerjs.onDisconnected = (fn) => {
    disconnectCallback = fn;
  };

  // Fake Firebase database configurations 
  const ServerValue = { TIMESTAMP: Date.now() };
  window.firebase = window.firebase || {};
  window.firebase.database = () => ({
    goOnline() {},
    goOffline() {}
  });
  window.firebase.database.ServerValue = ServerValue;

  const PEER_SERVER = {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    debug: 1
  };

  let activePeer = null;
  let activeConn = null;
  let isHostRole = false;
  let retryTimer = null;

  // In-memory real-time state object shared between both peers
  let matchState = {
    host: null,
    guest: null,
    scores: { p1: [], p2: [] },
    ballUpdate: null,
    pinUpdate: null,
    events: {},
    mode: 10
  };

  const listeners = new Map();

  function formatRoomPeerId(code) {
    return `host-${code}`;
  }

  // --- Recursive State Tree Traversal Helpers ---
  function getNestedValue(obj, path) {
    const parts = String(path).split('/').filter(Boolean);
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  function setNestedValue(obj, path, value) {
    const parts = String(path).split('/').filter(Boolean);
    if (parts.length === 0) return value;
    
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
    return obj;
  }

  function triggerMatchingListeners(changedPath) {
    listeners.forEach((callbacks, listenPath) => {
      if (changedPath.startsWith(listenPath) || listenPath.startsWith(changedPath) || listenPath === "") {
        callbacks.forEach(cb => {
          cb({ 
            val: () => getNestedValue(matchState, listenPath),
            exists: () => getNestedValue(matchState, listenPath) !== undefined
          });
        });
      }
    });
  }

  function cleanUpConnection() {
    if (disconnectCallback) disconnectCallback();
    if (typeof window.__onPeerDisconnected === 'function') {
      window.__onPeerDisconnected();
    }
  }

  // --- Network Connections Init Engine ---
  async function initializeHost(code, initialData) {
    isHostRole = true;
    if (initialData) matchState = { ...matchState, ...initialData };

    clearTimeout(retryTimer);
    if (activePeer) {
      try { activePeer.destroy(); } catch(e){}
    }

    activePeer = new Peer(formatRoomPeerId(code), PEER_SERVER);

    activePeer.on('open', () => {
      console.log(`[PeerJS Network] ✅ Room opened. ID: ${formatRoomPeerId(code)}`);
    });

    activePeer.on('connection', (conn) => {
      if (activeConn) {
        conn.close();
        return;
      }
      activeConn = conn;
      setupConnectionBindings(conn);
    });

    activePeer.on('error', (err) => {
      console.error('[PeerJS Network] Host Internal Error:', err);
    });
  }

  // FIXED: Separates client authentication from channel initialization to prevent WebSocket crashes
  async function initializeGuest(code, retryCount = 0) {
    isHostRole = false;

    // Create the primary client session ONLY if it doesn't exist or was explicitly killed
    if (!activePeer || activePeer.destroyed) {
      activePeer = new Peer(undefined, PEER_SERVER);
      
      activePeer.on('open', () => {
        attemptChannelConnection(code, retryCount);
      });

      activePeer.on('error', (err) => {
        // Intercept target unavailability errors cleanly at the root layer
        if (err.type === 'peer-not-found' || err.message.includes('Could not connect to peer')) {
          console.warn(`[PeerJS Network] Room ${formatRoomPeerId(code)} not recognized by cloud broker yet.`);
          handleGuestRetry(code, retryCount);
        } else {
          console.error('[PeerJS Network] Guest Session Error:', err);
        }
      });
    } else if (activePeer.open) {
      // If the parent peer is already authenticated and stable, just execute the hook
      attemptChannelConnection(code, retryCount);
    }
  }

  function attemptChannelConnection(code, retryCount) {
    const targetId = formatRoomPeerId(code);
    console.log(`[PeerJS Network] 👥 Guest checking host room availability: ${targetId} (Attempt ${retryCount + 1})`);
    
    if (activeConn) {
      try { activeConn.close(); } catch(e){}
    }
    
    const conn = activePeer.connect(targetId, { reliable: true });
    activeConn = conn;
    setupConnectionBindings(conn);
  }

  function handleGuestRetry(code, retryCount) {
    if (retryCount < 6) {
      console.log(`[PeerJS Network] Retrying handshake link in 1000ms...`);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        initializeGuest(code, retryCount + 1);
      }, 1000);
    } else {
      console.error('[PeerJS Network] Matchmaking connection timeout. Host registration failed completely.');
    }
  }

  function setupConnectionBindings(conn) {
    conn.on('open', () => {
      console.log('[PeerJS Network] 🤝 P2P Transmission Channel Open and Synchronized.');
      clearTimeout(retryTimer); 
      
      if (isHostRole) {
        conn.send({ type: 'SNAPSHOT', data: matchState });
      }
    });

    conn.on('data', (packet) => {
      if (!packet) return;

      if (packet.type === 'SNAPSHOT') {
        matchState = packet.data;
        listeners.forEach((callbacks, listenPath) => {
          callbacks.forEach(cb => cb({ 
            val: () => getNestedValue(matchState, listenPath),
            exists: () => getNestedValue(matchState, listenPath) !== undefined
          }));
        });
      } 
      else if (packet.type === 'UPDATE') {
        setNestedValue(matchState, packet.path, packet.value);
        triggerMatchingListeners(packet.path);

        if (isHostRole && activeConn && activeConn.open) {
          activeConn.send({ type: 'UPDATE', path: packet.path, value: packet.value });
        }
      }
    });

    conn.on('close', () => {
      console.warn('[PeerJS Network] Connection terminated by remote peer.');
      cleanUpConnection();
    });
  }

  // --- Firebase Emulation Router Map ---
  function createFirebaseRef(pathString) {
    const normalizedPath = pathString.replace(/^matches\/[^/]+/, '').replace(/^\//, '');
    const roomCode = pathString.split('/')[1];

    return {
      child: (subPath) => createFirebaseRef(`${pathString}/${subPath}`),
      
      set: async (value) => {
        if (pathString.startsWith('matches/') && normalizedPath === "") {
          await initializeHost(roomCode, value);
          return;
        }

        setNestedValue(matchState, normalizedPath, value);
        triggerMatchingListeners(normalizedPath);

        if (activeConn && activeConn.open) {
          activeConn.send({ type: 'UPDATE', path: normalizedPath, value: value });
        }
      },

      update: async (valueObj) => {
        if (typeof valueObj === 'object' && valueObj !== null) {
          Object.keys(valueObj).forEach(subKey => {
            const fullSubPath = normalizedPath ? `${normalizedPath}/${subKey}` : subKey;
            setNestedValue(matchState, fullSubPath, valueObj[subKey]);
            triggerMatchingListeners(fullSubPath);

            if (activeConn && activeConn.open) {
              activeConn.send({ type: 'UPDATE', path: fullSubPath, value: valueObj[subKey] });
            }
          });
        }
      },

      once: async (type) => {
        if (type !== 'value') return { val: () => null, exists: () => false };
        
        if (!isHostRole && (!activeConn || !activeConn.open)) {
          await initializeGuest(roomCode);
          await new Promise(res => setTimeout(res, 1200));
        }
        
        const data = getNestedValue(matchState, normalizedPath);
        return { 
          val: () => data,
          exists: () => data !== undefined && data !== null
        };
      },

      on: (type, callback) => {
        if (type !== 'value') return;
        if (!listeners.has(normalizedPath)) {
          listeners.set(normalizedPath, new Set());
        }
        listeners.get(normalizedPath).add(callback);
        
        callback({ 
          val: () => getNestedValue(matchState, normalizedPath),
          exists: () => getNestedValue(matchState, normalizedPath) !== undefined
        });
      },

      off: () => {
        listeners.delete(normalizedPath);
      },

      remove: async () => {
        clearTimeout(retryTimer);
        if (activeConn) try { activeConn.close(); } catch(e){}
        if (activePeer) try { activePeer.destroy(); } catch(e){}
        matchState = {};
      },

      onDisconnect: () => ({ remove() {} })
    };
  }

  window.db = {
    ref: (path) => createFirebaseRef(path),
    goOnline() {},
    goOffline() {}
  };

})();