// Connection debug utilities for multiplayer (PeerJS).
// Provides console logging and diagnostic tools for connection issues.

(function () {
  const logPrefix = '[Multiplayer-Conn]';

  function safeStringify(v) {
    try {
      return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val));
    } catch {
      return String(v);
    }
  }

  function install() {
    // Verify PeerJS is loaded
    if (typeof Peer === 'undefined') {
      console.error(`${logPrefix} ❌ PeerJS global Peer is missing. Check that peerjs.min.js loaded correctly.`);
      window.__debugMultiplayer = {
        status: 'ERROR_PEER_NOT_LOADED',
        log: (...args) => console.log(logPrefix, ...args)
      };
      return;
    }

    console.log(`${logPrefix} ✅ PeerJS loaded successfully`);

    // Verify window.db is available (set by peerjs_network.js)
    if (typeof window.db === 'undefined') {
      console.error(`${logPrefix} ❌ window.db is not defined. peerjs_network.js may not have run.`);
    } else {
      console.log(`${logPrefix} ✅ window.db initialized`);
    }

    // Expose debug interface
    window.__debugMultiplayer = {
      log: (...args) => {
        console.log(logPrefix, ...args);
      },
      stringify: safeStringify,
      checkPeerState: () => {
        const state = {
          peerLoaded: typeof Peer !== 'undefined',
          dbAvailable: typeof window.db !== 'undefined',
          dbMatches: window.db ? window.db._matches?.size || 0 : 'N/A',
          firebaseAvailable: typeof window.firebase !== 'undefined'
        };
        console.log(logPrefix, 'State:', state);
        return state;
      },
      testConnection: async (code) => {
        if (!window.db) {
          console.error(logPrefix, '❌ window.db not available');
          return;
        }
        console.log(logPrefix, `Testing connection to room: ${code}`);
        try {
          const ref = window.db.ref(`matches/${code}`);
          if (!ref) {
            console.error(logPrefix, '❌ Failed to create ref');
            return;
          }
          console.log(logPrefix, '✅ Ref created:', ref);
        } catch (e) {
          console.error(logPrefix, '❌ Error:', e);
        }
      }
    };

    console.log(`${logPrefix} ✅ Debug layer installed. Use window.__debugMultiplayer for diagnostics.`);
  }

  // Install immediately if document is ready, or wait for it
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }

  // Also run on window load to catch any timing issues
  window.addEventListener('load', () => {
    console.log(logPrefix, 'Page fully loaded');
    if (window.__debugMultiplayer) {
      window.__debugMultiplayer.checkPeerState();
    }
  });
})();
