// ============================================
// GAME CONSTANTS - Physics and Gameplay Parameters
// ============================================
const LANE_Y = 0.1;             // Y position of the bowling lane
const BALL_RADIUS = 0.35;       // Radius of the bowling ball (physics and render)
const PIN_HEIGHT = 0.8;         // Height of bowling pins
const TRAIL_MAX_POINTS = 60;    // Maximum points in ball trail visualization
const MAX_MATCHES = 5;          // Number of frames/matches to complete

// ============================================
// GAME STATE - Core gameplay variables
// ============================================
let pins = [];                  // Array of pin objects (mesh + physics body)
let pinCircles = [];            // Visual circles under pins
let targetPinCount = 10;        // Current game mode: 10 or 100 pins
let offsetDistance10 = 7.2;     // Lane offset for 10-pin mode
let offsetDistance100 = 8.8;    // Lane offset for 100-pin mode
let lastPinSoundTime = 0;       // Throttle pin collision sounds
let hasShownLocalCompleteMessage = false;       // Prevent duplicate "player complete" message
let hasShownOpponentCompleteMessage = false;    // Prevent duplicate opponent message
let hasRecordedScoreInCurrentGame = false;      // Guard flag to prevent premature final result

// ============================================
// THREE.JS RENDERING - Scene, Camera, Renderer
// ============================================
let scene, camera, renderer, world, sunLight, raycaster;
let ballBody, ballMesh;         // Physics body and 3D mesh for player's ball
let laneMesh;                   // The bowling lane mesh
let groundBody;                 // Physics body for lane ground

// ============================================
// GAMEPLAY STATE - Ball and interaction tracking
// ============================================
let isBowling = false;          // Flag: is the ball currently in flight?
let isTouching = false;         // Flag: is player touching screen?
let touchStartPos = { x: 0, y: 0 };     // Initial touch position
let touchStartTime = 0;         // Time when touch started
let lastTouchX = 0;             // Last known X coordinate of touch
let impactParticles = [];       // Particle effects from ball/pin collisions
let trailHistory = [];          // Ball trajectory points for visual trail
// trailMesh moved to global declarations above
let randomHookForce = 0;

let matchHistory = [];
let currentFallenPins = 0;

let impactOccurred = false;
let resetTimer = null;
let pinSettleStartTime = 0;
let pinSettleStableSince = 0;

let timeScale = 1.0;
let isCinematicMode = false;
let cinematicTargetPin = null;

// ============================================
// AUDIO SYSTEM - Sound management
// ============================================
let audioListener, audioLoader;
let ballPathSound, pinKnockSound;
let gameSounds = {};

// ============================================
// CINEMATIC AND REPLAY SYSTEM - Ball tracking and playback
// ============================================
let actionCamera, actionRenderer, actionCanvas;    // Secondary camera for action replay view
let actionTargetPin = null;                         // Pin being focused by action camera
let lastTargetSwitchTime = 0;                      // Throttle camera target switches
const SWITCH_COOLDOWN = 1000;                      // Cooldown between target switches (ms)

const DECK_CENTER_Z = -22;                          // Center point of the bowling lane

let isReplaying = false;        // Flag: is replay mode active?
let replayData = [];            // Recorded ball/pin states for replay
let replayFrameIndex = 0;       // Current frame in replay

let modeSwitchRequestPending = false;
let modeSwitchRequestMode = null;
let modeSwitchRequester = null;
let wasShowingWaitMessage = false;
let waitMessageLocalFinished = false;
let lastScoreUpdateTimestamp = {};

let cameraLookAtTarget = new THREE.Vector3(0, 1, -22);

// Player 1 & 2 Touchpaths (different colors)
let touchPathLine_P1, touchPathLine2_P1, touchPathLine3_P1;
let outerGlowLine_P1;
let touchPathLine_P2, touchPathLine2_P2, touchPathLine3_P2;
let outerGlowLine_P2;
let touchPathPoints_P1 = [];
let touchPathPoints_P2 = [];
let currentPlayerTouchPoints = touchPathPoints_P1;

// Player 1 & 2 Trail meshes (different colors)
let trailMesh_P1, trailMesh_P2;

const groundMat = new CANNON.Material();
const ballMat = new CANNON.Material();
const pinMat = new CANNON.Material();

let leftGutter, rightGutter;
let leftWallJoint, rightWallJoint;

let sounds = {};

let leftWallMesh, rightWallMesh;
let leftWallBody, rightWallBody;

let currentPinVolume = 0.7;
let lastPinHitTime = 0;

function isMobileClient() {
    return typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

// --- MULTIPLAYER VARIABLES ---
// ============================================
// MULTIPLAYER SYSTEM - Firebase real-time networking
// ============================================
let isHost = true;              // Role: true=host(p1), false=guest(p2)
let myPlayerId = 1;             // Current player ID (1 or 2)
let myPlayerOffset = 0;         // X position of player's lane on shared court
let isMultiplayerActive = false;        // Flag: is multiplayer game in progress?
let matchRef = null;            // Firebase reference to current match
let matchListeners = [];        // Array of Firebase listeners to clean up
let opponentBallMesh;           // Ghost ball showing opponent's position
let sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); // Unique session ID to prevent self-joining
let opponentGhostPins = [];     // Ghost pins showing opponent's lane
let matchCode = null;           // 5-digit code for match identification
let isCreatingMatch = false;    // Flag: currently creating a match?
let isJoiningMatch = false;     // Flag: currently joining a match?

// ============================================
// PLAY AGAIN SYSTEM - Rematch coordination
// ============================================
let playAgainRequested = false;                 // Player requested rematch
let playAgainOpponentRequested = false;         // Opponent requested rematch
let playAgainCountdownTimer = null;             // Timer for auto-restart countdown
let playAgainCountdownRemaining = 5;            // Seconds remaining in countdown

// ============================================
// EVENT TIMESTAMPS - Prevent duplicate event processing
// ============================================
let lastEventTimestamps = {
    playAgainRequest: 0,        // Timestamp of last play-again request received
    playAgainResponse: 0,       // Timestamp of last play-again response received
    modeSwitchRequest: 0,       // Timestamp of last mode-switch request received
    modeSwitchResponse: 0       // Timestamp of last mode-switch response received
};
let ballSyncCounter = 0;        // Counter for ball synchronization updates

// ============================================
// SCORE TRACKING AND UI RENDERING
// ============================================
let scores = {
    p1: [],     // Array of scores for player 1
    p2: []      // Array of scores for player 2
};

// ============================================
// MATCHMAKING STATE - Player search for opponents
// ============================================
let isSearchingForMatch = false;     // Player is actively searching for opponent
let matchmakingTimeout = null;       // Timeout for auto-cancel if no opponent found

// ============================================
// LANGUAGE SYSTEM - Multi-language support
// ============================================
let currentLanguage = localStorage.getItem('bowlingLang') || 'zh-TW';

const translations = {
    'en': {
        settingsTitle: 'Settings',
        volumeLabel: 'Volume',
        gameModeLabel: 'Game Mode',
        languageLabel: 'Language',
        homeBtn: '🏠 Home',
        tenPins: '10 Pins',
        hundredPins: '100 Pins',
        hint: 'Drag to move • Swipe up to bowl',
        scoreText: 'Pins: ',
        pinsLabel: 'Bowling Pins: ',
        actionCam: 'Action Cam (Tap to enlarge)',
        watchReplay: 'Watch Replay',
        strike: 'STRIKE!',
        msgTitleStrike: 'Perfect Strike!',
        msgBodyStrike: 'Perfect bowl!',
        msgTitleEnd: 'Frame End',
        msgBodyEnd: 'Watch your replay or continue.',
        nextFrame: 'Next Frame',
        finalScore: 'Final Score',
        result: 'Result',
        knocked: 'Knocked {0}/{1} pins.',
        player1: 'Player 1',
        player2: 'Player 2',
        match1: '1',
        match2: '2',
        match3: '3',
        match4: '4',
        match5: '5',
        total: 'TOT',
        multiplayerTitle: 'Multiplayer Bowling',
        multiplayerDesc: 'Play online with others',
        createRoom: 'Create Room',
        joinRoom: 'Join Room',
        autoMatch: 'Auto Match',
        singlePlayer: 'Single Player',
        cancelMatch: 'Cancel Match',
        roomCode: 'Room Code: ',
        searching: 'Searching for players...',
        hosting: 'Waiting for player...',
        found: 'Match found!',
        enterCode: 'Enter code',
        join: 'Join',
        back: 'Back',
        modeSwitchTitle: 'Mode Change Request',
        modeSwitchBodyAccept: 'Switch to {0} pin mode? This will reset scores.',
        modeSwitchBodyRequest: 'You requested {0} pin mode. Waiting for opponent...',
        modeSwitchBodyOpponent: 'Opponent requested {0} pin mode. Accept?',
        accept: 'Accept',
        decline: 'Decline',
        playAgain: 'Play Again',
        opponentReady: 'Opponent Ready',
        waitOpponent: 'Waiting for opponent...',
        autoRestart: 'Auto restart countdown',
        playerLeft: 'Player Left',
        opponentDisconnected: 'Opponent disconnected. Return to single player...',
        ok: 'OK',
        completeLocal: 'Frame complete. Waiting for opponent...',
        completeOpponent: 'Opponent completed. Finish your remaining frames.',
        finalResult: 'Final Result',
        draw: 'Draw',
        p1Wins: 'Player 1 Wins!',
        p2Wins: 'Player 2 Wins!'
    },
    'zh-TW': {
        settingsTitle: '設定',
        volumeLabel: '音量',
        gameModeLabel: '遊戲模式',
        languageLabel: '語言',
        homeBtn: '🏠 主頁',
        tenPins: '10 瓶',
        hundredPins: '100 瓶',
        hint: '拖曳移動位置 • 向上滑動投球',
        scoreText: '擊倒: ',
        pinsLabel: '保齡球瓶: ',
        actionCam: '動作鏡頭 (點擊放大)',
        watchReplay: '觀看重播',
        strike: 'STRIKE!',
        msgTitleStrike: '全中！',
        msgBodyStrike: '完美擊球！',
        msgTitleEnd: '回合結束',
        msgBodyEnd: '觀看重播或繼續下一局。',
        nextFrame: '下一局',
        finalScore: '最終分數',
        result: '結果',
        knocked: '已擊倒 {0}/{1} 瓶。',
        player1: '玩家 1',
        player2: '玩家 2',
        match1: '1',
        match2: '2',
        match3: '3',
        match4: '4',
        match5: '5',
        total: '總分',
        multiplayerTitle: '多人連線保齡球',
        multiplayerDesc: '與其他玩家線上對戰',
        createRoom: '建立房間',
        joinRoom: '加入房間',
        autoMatch: '自動配對',
        singlePlayer: '單人遊戲',
        cancelMatch: '取消配對',
        roomCode: '房間代碼: ',
        searching: '正在尋找玩家...',
        hosting: '等待玩家加入...',
        found: '找到對手！',
        enterCode: '輸入代碼',
        join: '加入',
        back: '返回',
        modeSwitchTitle: '更改模式請求',
        modeSwitchBodyAccept: '是否切換至 {0} 瓶模式？這將重置目前分數。',
        modeSwitchBodyRequest: '您請求切換至 {0} 瓶模式。等待對手回應...',
        modeSwitchBodyOpponent: '對手請求切換至 {0} 瓶模式。是否接受？',
        accept: '接受',
        decline: '拒絕',
        playAgain: '再玩一次',
        opponentReady: '對手已準備',
        waitOpponent: '等待對手...',
        autoRestart: '自動重啟倒數',
        playerLeft: '玩家已離開',
        opponentDisconnected: '對手已斷線。返回單人遊戲...',
        ok: '確定',
        completeLocal: '您已完成 5 局。等待對手完成他們的 5 局...',
        completeOpponent: '對手已完成 5 局。請繼續完成您的剩餘局數。',
        finalResult: '最終結果',
        draw: '平手',
        p1Wins: '玩家 1 獲勝！',
        p2Wins: '玩家 2 獲勝！'
    }
};

function t(key, ...args) {
    let text = translations[currentLanguage][key] || key;
    args.forEach((arg, i) => {
        text = text.replace(new RegExp(`\\{${i}\\}`, 'g'), arg);
    });
    return text;
}

function updateScoreTableHeaders() {
    // Player names - preserve CSS colors (P1 blue #1e90ff, P2 red #ff4757)
    const p1Name = document.getElementById('p1-name');
    if (p1Name) p1Name.innerText = t('player1');

    const p2Name = document.getElementById('p2-name');
    if (p2Name) p2Name.innerText = t('player2');

    // Frame headers 1-5
    for (let i = 1; i <= 5; i++) {
        const frameHeader = document.getElementById(`frame${i}-header`);
        if (frameHeader) frameHeader.innerText = t(`match${i}`);
    }

    // Total and player headers
    const totalHeader = document.getElementById('total-header');
    if (totalHeader) totalHeader.innerText = t('total');

    const playerHeader = document.getElementById('player-header');
    if (playerHeader) playerHeader.innerText = t('player1'); // Generic "Player" header
}

function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'zh-TW' : 'en';
    localStorage.setItem('bowlingLang', currentLanguage);
    document.documentElement.lang = currentLanguage;
    document.getElementById('language-btn').innerText =
        currentLanguage === 'en' ? 'HK 繁中' : '🇺🇸 English';

    // Update all UI elements
    updateAllUIText();
    playGameSound('ui_click');
}

function updateAllUIText() {
    // Settings menu
    const settingsTitle = document.querySelector('#settings-menu h3');
    if (settingsTitle) settingsTitle.innerText = t('settingsTitle');

    const volLabel = document.querySelector('label[for="volume-slider"]');
    if (volLabel) volLabel.innerText = t('volumeLabel');

    const modeLabel = document.querySelector('label[for="mode-toggle-btn"]');
    if (modeLabel) modeLabel.innerText = t('gameModeLabel');

    const langLabel = document.querySelector('label[for="language-btn"]');
    if (langLabel) langLabel.innerText = t('languageLabel');

    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) homeBtn.innerText = t('homeBtn');

    // Update mode button text
    const modeBtn = document.getElementById('mode-toggle-btn');
    if (modeBtn) {
        modeBtn.innerText = targetPinCount === 10 ? t('tenPins') : t('hundredPins');
    }

    // Score UI
    document.getElementById('hint').innerText = t('hint');

    // Action cam label
    const actionLabel = document.querySelector('#action-cam-container div');
    if (actionLabel) actionLabel.innerText = t('actionCam');

    // Matchmaking panel (only if visible)
    const matchmakingTitle = document.querySelector('#matchmaking-panel h2');
    if (matchmakingTitle) matchmakingTitle.innerText = t('multiplayerTitle');

    const matchmakingDesc = document.querySelector('#matchmaking-panel p');
    if (matchmakingDesc) matchmakingDesc.innerText = t('multiplayerDesc');

    // Update button texts if matchmaking panel exists
    ['create-match-btn', 'join-match-btn', 'auto-match-btn', 'single-player-btn',
        'cancel-search-btn', 'join-code-btn', 'join-cancel-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                switch (id) {
                    case 'create-match-btn': btn.innerText = t('createRoom'); break;
                    case 'join-match-btn': btn.innerText = t('joinRoom'); break;
                    case 'auto-match-btn': btn.innerText = t('autoMatch'); break;
                    case 'single-player-btn': btn.innerText = t('singlePlayer'); break;
                    case 'cancel-search-btn': btn.innerText = t('cancelMatch'); break;
                    case 'join-code-btn': btn.innerText = t('join'); break;
                    case 'join-cancel-btn': btn.innerText = t('back'); break;
                }
            }
        });

    // Mode switch modal
    const modeTitle = document.getElementById('mode-switch-title');
    if (modeTitle) modeTitle.innerText = t('modeSwitchTitle');

    const modeAccept = document.getElementById('mode-switch-accept');
    if (modeAccept) modeAccept.innerText = t('accept');

    const modeDecline = document.getElementById('mode-switch-decline');
    if (modeDecline) modeDecline.innerText = t('decline');

    // Watch replay button
    const replayBtn = document.getElementById('watch-replay-btn');
    if (replayBtn) replayBtn.innerText = t('watchReplay');

    // Strike popup
    document.getElementById('strike-popup').innerText = t('strike');

    // Update score table headers (Step 5)
    updateScoreTableHeaders();
}


// ============================================
// MULTIPLAYER UI FUNCTIONS
// ============================================

// Display the matchmaking panel (where players search for opponents)
function showMatchmakingPanel() {
    const panel = document.getElementById('matchmaking-panel');
    const blocker = document.getElementById('matchmaking-modal-blocker');
    if (panel) panel.style.display = 'block';
    if (blocker) blocker.style.display = 'block';
}

function hideMatchmakingPanel() {
    const panel = document.getElementById('matchmaking-panel');
    const blocker = document.getElementById('matchmaking-modal-blocker');
    if (panel) panel.style.display = 'none';
    if (blocker) blocker.style.display = 'none';
}

// Display matchmaking status message (searching, found, waiting, etc)
function updateMatchmakingStatus(message) {
    const status = document.getElementById('matchmaking-status');
    if (status) {
        if (message === 'searching') {
            status.innerHTML = '<div class="loading-spinner"></div><p>正在尋找玩家...</p>';
        } else if (message === 'found') {
            const roleMessage = isHost ? '建立遊戲中...' : '加入遊戲中...';
            status.innerHTML = `<p style="color: #2ecc71;">✓ ${roleMessage}</p>`;
        } else if (message === 'hosting') {
            status.innerHTML = '<div class="loading-spinner"></div><p>等待玩家加入...</p>';
        } else if (message === 'host_ready') {
            status.innerHTML = '<p style="color: #2ecc71;">✓ 房主已準備就緒，等待玩家...</p>';
        } else if (message === 'timeout') {
            status.innerHTML = '<p style="color: #f39c12;">找不到玩家。作爲房主開始遊戲...</p>';
        } else {
            status.innerHTML = `<p>${message}</p>`;
        }
    }
}

function getMatchRef(code) {
    if (!window.db || typeof window.db.ref !== 'function') {
        console.error('Firebase database is not initialized.');
        return null;
    }
    return window.db.ref(`matches/${code}`);
}

function cleanupFirebaseListeners() {
    matchListeners.forEach((ref) => ref.off());
    matchListeners = [];
}

// Setup Firebase real-time listeners for multiplayer synchronization
function setupFirebaseListeners() {
    if (!matchRef) {
        return;
    }

    cleanupFirebaseListeners();

    const guestRef = matchRef.child('guest');
    const hostRef = matchRef.child('host');
    const ballRef = matchRef.child('ballUpdate');
    const pinRef = matchRef.child('pinUpdate');
    const scoresRef = matchRef.child('scores');
    const eventsRef = matchRef.child('events');

    guestRef.on('value', handleGuestUpdate);
    hostRef.on('value', handleHostUpdate);
    ballRef.on('value', handleBallUpdateEvent);
    pinRef.on('value', handlePinUpdateEvent);
    scoresRef.on('value', handleScoresUpdate);
    eventsRef.on('value', handleEventsUpdate);

    matchListeners.push(guestRef, hostRef, ballRef, pinRef, scoresRef, eventsRef);
}

function getLocalPlayerId() {
    return isHost ? 'p1' : 'p2';
}

function getOpponentPlayerId() {
    return isHost ? 'p2' : 'p1';
}

// Check if player has completed all required matches (MAX_MATCHES)
function isPlayerComplete(playerId) {
    const result = Array.isArray(scores[playerId]) && scores[playerId].length >= MAX_MATCHES;
    return result;
}

function getLocalRole() {
    return isHost ? 'host' : 'guest';
}

function getOpponentRole() {
    return isHost ? 'guest' : 'host';
}

function setMatchCodeUI(code) {
    matchCode = code;
    updateMatchmakingStatus(code ? `房間代碼: ${code} - 等待玩家...` : '');
}

// Handle guest join/leave events from Firebase
function handleGuestUpdate(snapshot) {
    if (!matchRef) return;
    const guestData = snapshot.val();
    if (isHost) {
        if (guestData && !isMultiplayerActive) {
            updateMatchmakingStatus('玩家已加入！比賽開始...');
            hideMatchmakingPanel();
            document.getElementById('cancel-search-btn').style.display = 'none';
            activateMultiplayerMode(true);
            resetGame();
        } else if (!guestData && isMultiplayerActive) {
            handleOpponentDisconnect();
        }
    }
}

// Handle host connection status from Firebase
function handleHostUpdate(snapshot) {
    if (!matchRef) return;
    const hostData = snapshot.val();
    if (!isHost) {
        if (hostData && !isMultiplayerActive) {
            updateMatchmakingStatus('Connected! Setting up lane...');
            hideMatchmakingPanel();
            document.getElementById('cancel-search-btn').style.display = 'none';
            activateMultiplayerMode(false);
            resetGame();
        } else if (!hostData && isMultiplayerActive) {
            handleOpponentDisconnect();
        }
    }
}

// Handle opponent disconnection - reset to main menu
function handleOpponentDisconnect() {
    isMultiplayerActive = false;
    isHost = true;
    isCreatingMatch = false;
    isJoiningMatch = false;
    isSearchingForMatch = false;
    myPlayerOffset = 0;
    matchCode = null;

    camera.position.set(0, 4, 20);
    cameraLookAtTarget.set(0, 1, -22);
    camera.lookAt(cameraLookAtTarget);
    sunLight.position.set(15, 35, -40);
    updateLaneWidth();
    if (opponentBallMesh) opponentBallMesh.visible = false;
    resetSinglePlayerUI();

    // Reset all buttons and UI state
    document.getElementById('create-match-btn').disabled = false;
    document.getElementById('join-match-btn').disabled = false;
    document.getElementById('auto-match-btn').disabled = false;
    document.getElementById('single-player-btn').disabled = false;
    document.getElementById('cancel-search-btn').style.display = 'none';
    updateMatchmakingStatus(''); // Clear any status messages

    const msgTitle = document.getElementById('msg-title');
    if (msgTitle) {
        msgTitle.innerText = t('playerLeft');
        document.getElementById('msg-box').style.display = 'block';
        document.getElementById('msg-body').innerText = "對手已斷線。返回單人遊戲...";
        document.getElementById('action-btn').innerHTML = "確定";
        document.getElementById('action-btn').onclick = () => {
            document.getElementById('msg-box').style.display = 'none';
            fullReset();
            showMatchmakingPanel();
        };
    }
    cleanupFirebaseListeners();
    matchRef = null;

    if (window.db && typeof window.db.goOffline === 'function') {
        window.db.goOffline();
    }

    setTimeout(() => {
        if (!isMultiplayerActive) {
            fullReset();
            showMatchmakingPanel();
        }
    }, 2200);
}

function resetSinglePlayerUI() {
    const p2Row = document.getElementById('p2-row');
    if (p2Row) p2Row.style.display = 'none';
    if (ballMesh && ballMesh.material) ballMesh.material.color.setHex(0x00eeff);
    if (opponentBallMesh) opponentBallMesh.visible = false;
}

function handleBallUpdateEvent(snapshot) {
    const data = snapshot.val();
    if (!data || data.from === getLocalPlayerId()) return;
    updateOpponentBall(data);
}

function areScoreArraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function handleScoresUpdate(snapshot) {
    const allScores = snapshot.val() || {};
    const opponentId = getOpponentPlayerId();
    if (Array.isArray(allScores[opponentId])) {
        const incomingScores = allScores[opponentId];
        const currentScores = scores[opponentId] || [];
        if (!areScoreArraysEqual(incomingScores, currentScores)) {
            scores[opponentId] = incomingScores;
            updateScoreTable(opponentId);
            updateMultiplayerMatchState();
        }
    }
}

function processMatchEvent(key, event) {
    if (!event || typeof event.timestamp !== 'number') return;
    if (event.from === getLocalPlayerId()) return;
    if (event.timestamp <= lastEventTimestamps[key]) return;

    lastEventTimestamps[key] = event.timestamp;

    switch (key) {
        case 'playAgainRequest':
            receivePlayAgainRequest(event);
            break;
        case 'playAgainResponse':
            if (playAgainRequested && event.accepted) {
                beginPlayAgain();
            }
            break;
        case 'modeSwitchRequest':
            handleModeSwitchRequest(event);
            break;
        case 'modeSwitchResponse':
            handleModeSwitchResponse(event);
            break;
    }
}

function handleEventsUpdate(snapshot) {
    const events = snapshot.val() || {};
    processMatchEvent('playAgainRequest', events.playAgainRequest);
    processMatchEvent('playAgainResponse', events.playAgainResponse);
    processMatchEvent('modeSwitchRequest', events.modeSwitchRequest);
    processMatchEvent('modeSwitchResponse', events.modeSwitchResponse);
}

function sendMatchEvent(type, payload = {}) {
    if (!isMultiplayerActive || !matchRef) return;
    const event = {
        ...payload,
        type,
        from: getLocalPlayerId(),
        timestamp: Date.now()
    };
    matchRef.child(`events/${type}`).set(event).catch((err) => {
    });
}

// Create a new multiplayer match as host
function createMatch() {
    unlockAudio();
    if (!window.db) {
        updateMatchmakingStatus('Firebase 未初始化。');
        return;
    }
    window.db.goOnline();

    isCreatingMatch = true;
    isJoiningMatch = false;
    isSearchingForMatch = false;
    hideJoinMatchPanel();

    document.getElementById('create-match-btn').disabled = true;
    document.getElementById('join-match-btn').disabled = true;
    document.getElementById('auto-match-btn').disabled = true;
    document.getElementById('single-player-btn').disabled = true;
    document.getElementById('cancel-search-btn').style.display = 'block';

    cancelMatchmaking();

    const code = Math.floor(10000 + Math.random() * 90000).toString();
    isHost = true;
    myPlayerOffset = 0;
    setMatchCodeUI(code);

    matchRef = getMatchRef(code);
    if (!matchRef) {
        updateMatchmakingStatus('Firebase 未初始化。');
        cancelMatchmaking();
        return;
    }
    const hostRef = matchRef.child('host');
    matchRef.set({
        host: { connected: true, joinedAt: firebase.database.ServerValue.TIMESTAMP, sessionId: sessionId },
        guest: null,
        scores: { p1: [], p2: [] },
        ballUpdate: null,
        events: {},
        mode: targetPinCount
    }).then(() => {
        hostRef.onDisconnect().remove();
        setupFirebaseListeners();
        updateMatchmakingStatus('房間代碼: ' + code + ' - 等待玩家...');
    }).catch((err) => {
        updateMatchmakingStatus('Unable to create match.');
        cancelMatchmaking();
    });
}


// ============================================
// MULTIPLAYER MATCH JOINING
// ============================================

// Join an existing multiplayer match as a guest player
// Validates match existence, sets up player offset, and initializes multiplayer mode
function joinGame(targetHostId) {
    unlockAudio();

    isHost = false;
    matchCode = targetHostId;
    myPlayerOffset = 15;

    document.getElementById('create-match-btn').disabled = true;
    document.getElementById('join-match-btn').disabled = true;
    document.getElementById('cancel-search-btn').style.display = 'block';

    cancelMatchmaking();

    matchRef = getMatchRef(targetHostId);
    matchRef.once('value').then((snapshot) => {
        const data = snapshot.val();
        if (!data || !data.host) {
            updateMatchmakingStatus('找不到房間。');
            cancelMatchmaking();
            return;
        }
        const mode = data.host.mode || 10;
        targetPinCount = mode;
        document.getElementById('mode-toggle-btn').innerText = (targetPinCount === 10) ? '10 瓶' : '100 瓶';
        updateLaneWidth();
        const offsetDistance = (targetPinCount === 100) ? offsetDistance100 : offsetDistance10;
        myPlayerOffset = offsetDistance;
        if (data.guest && data.guest.connected) {
            updateMatchmakingStatus('房間已滵滿。');
            cancelMatchmaking();
            return;
        }

        const guestRef = matchRef.child('guest');
        matchRef.child('guest').set({
            connected: true,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            guestRef.onDisconnect().remove();
            setupFirebaseListeners();
            updateMatchmakingStatus('Connected! Setting up lane...');
            hideMatchmakingPanel();
            document.getElementById('cancel-search-btn').style.display = 'none';

            if (laneMesh) { scene.remove(laneMesh); laneMesh.geometry.dispose(); laneMesh.material.dispose(); }
            if (leftGutter) { scene.remove(leftGutter); leftGutter.geometry.dispose(); leftGutter.material.dispose(); }
            if (rightGutter) { scene.remove(rightGutter); rightGutter.geometry.dispose(); rightGutter.material.dispose(); }
            if (leftWallMesh) { scene.remove(leftWallMesh); leftWallMesh.geometry.dispose(); leftWallMesh.material.dispose(); }
            if (rightWallMesh) { scene.remove(rightWallMesh); rightWallMesh.geometry.dispose(); rightWallMesh.material.dispose(); }

            if (groundBody) world.removeBody(groundBody);
            if (leftWallBody) world.removeBody(leftWallBody);
            if (rightWallBody) world.removeBody(rightWallBody);

            createStreetEnvironment(myPlayerOffset);
            createPins(myPlayerOffset);

            camera.position.set(myPlayerOffset, 4, 12);
            camera.lookAt(myPlayerOffset, 1, 0);

            if (ballBody) ballBody.position.set(myPlayerOffset, LANE_Y + BALL_RADIUS + 0.05, 6);
            if (ballMesh) ballMesh.position.set(myPlayerOffset, LANE_Y + BALL_RADIUS + 0.05, 6);

            activateMultiplayerMode(false);
            resetGame();
        }).catch((err) => {
            updateMatchmakingStatus('Unable to join match.');
            cancelMatchmaking();
        });
    }).catch((err) => {

        updateMatchmakingStatus('Unable to join match.');
        cancelMatchmaking();
    });
}

function startMatchmaking() {
    createMatch();
}

function showJoinMatchPanel() {
    document.getElementById('join-match-panel').style.display = 'flex';
    document.getElementById('join-code-input').value = '';
    document.getElementById('join-code-input').focus();
}

function hideJoinMatchPanel() {
    const panel = document.getElementById('join-match-panel');
    if (panel) panel.style.display = 'none';
}

function attemptJoinMatch() {
    const input = document.getElementById('join-code-input');
    if (!input) return;
    const code = input.value.trim();
    if (!/^[0-9]{5}$/.test(code)) {
        updateMatchmakingStatus('請輸入有效的 5 位數代碼。');
        return;
    }

    if (!window.db) {
        updateMatchmakingStatus('Firebase 未初始化。');
        return;
    }
    window.db.goOnline();

    hideJoinMatchPanel();
    isJoiningMatch = true;
    isCreatingMatch = false;
    document.getElementById('create-match-btn').disabled = true;
    document.getElementById('join-match-btn').disabled = true;
    document.getElementById('auto-match-btn').disabled = true;
    document.getElementById('single-player-btn').disabled = true;
    document.getElementById('cancel-search-btn').style.display = 'block';
    updateMatchmakingStatus('正在加入代碼: ' + code + ' ...');
    joinGame(code);
}

// Cancel current matchmaking process
function cancelMatchmaking() {
    isSearchingForMatch = false;
    isCreatingMatch = false;
    isJoiningMatch = false;
    matchCode = null;
    hideJoinMatchPanel();
    if (matchmakingTimeout) {
        clearTimeout(matchmakingTimeout);
        matchmakingTimeout = null;
    }

    if (matchRef) {
        if (isHost && !isMultiplayerActive) {
            matchRef.remove().catch(() => { });
        }
        if (!isHost && !isMultiplayerActive) {
            matchRef.child('guest').remove().catch(() => { });
        }
    }

    cleanupFirebaseListeners();
    matchRef = null;

    if (window.db && typeof window.db.goOffline === 'function') {
        window.db.goOffline();
    }

    document.getElementById('create-match-btn').disabled = false;
    document.getElementById('join-match-btn').disabled = false;
    document.getElementById('auto-match-btn').disabled = false;
    document.getElementById('single-player-btn').disabled = false;
    document.getElementById('cancel-search-btn').style.display = 'none';
    updateMatchmakingStatus('');
}

// Initiate automatic matchmaking with time-slot based code generation
function autoMatch() {
    unlockAudio();
    if (!window.db) {
        updateMatchmakingStatus('Firebase 未初始化。');
        return;
    }
    window.db.goOnline();

    isSearchingForMatch = true;
    document.getElementById('create-match-btn').disabled = true;
    document.getElementById('join-match-btn').disabled = true;
    document.getElementById('auto-match-btn').disabled = true;
    document.getElementById('single-player-btn').disabled = true;
    document.getElementById('cancel-search-btn').style.display = 'block';

    updateMatchmakingStatus('searching');

    // Generate a match code based on current time slot (every 10 seconds)
    // This increases chance two players will use the same code
    const timeSlot = Math.floor(Date.now() / 10000);
    const autoMatchCode = String(10000 + (timeSlot % 90000)).slice(1);

    matchRef = getMatchRef(autoMatchCode);
    if (!matchRef) {
        updateMatchmakingStatus('Firebase 未初始化。');
        cancelMatchmaking();
        return;
    }

    // Try to join an existing match first
    matchRef.once('value').then((snapshot) => {
        const data = snapshot.val();

        if (data && data.host && !data.guest) {
            // Validate: Don't join your own match
            if (data.host.sessionId === sessionId) {
                cancelMatchmaking();
                updateMatchmakingStatus('無法與自己配對，重試中...');
                setTimeout(() => autoMatch(), 1000);
                return;
            }

            // Validate: Only join if host was created in same time slot (within last 10 seconds)
            const hostJoinTime = data.host.joinedAt || 0;
            const currentTimeSlot = Math.floor(Date.now() / 10000);
            const hostTimeSlot = Math.floor(hostJoinTime / 10000);

            if (currentTimeSlot !== hostTimeSlot) {
                cancelMatchmaking();
                updateMatchmakingStatus('不在同一搜尋區間，重試中...');
                setTimeout(() => autoMatch(), 1000);
                return;
            }

            // Match exists with host waiting - join as guest
            isHost = false;
            matchCode = autoMatchCode;
            const offsetDistance = (data.host.mode || 10) === 100 ? offsetDistance100 : offsetDistance10;
            myPlayerOffset = offsetDistance;
            targetPinCount = data.host.mode || 10;

            document.getElementById('mode-toggle-btn').innerText = (targetPinCount === 10) ? '10 瓶' : '100 瓶';
            updateLaneWidth();

            matchRef.child('guest').set({
                connected: true,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                matchRef.child('guest').onDisconnect().remove();
                setupFirebaseListeners();
                updateMatchmakingStatus('found');
                hideMatchmakingPanel();
                document.getElementById('cancel-search-btn').style.display = 'none';

                if (laneMesh) { scene.remove(laneMesh); laneMesh.geometry.dispose(); laneMesh.material.dispose(); }
                if (leftGutter) { scene.remove(leftGutter); leftGutter.geometry.dispose(); leftGutter.material.dispose(); }
                if (rightGutter) { scene.remove(rightGutter); rightGutter.geometry.dispose(); rightGutter.material.dispose(); }
                if (leftWallMesh) { scene.remove(leftWallMesh); leftWallMesh.geometry.dispose(); leftWallMesh.material.dispose(); }
                if (rightWallMesh) { scene.remove(rightWallMesh); rightWallMesh.geometry.dispose(); rightWallMesh.material.dispose(); }

                if (groundBody) world.removeBody(groundBody);
                if (leftWallBody) world.removeBody(leftWallBody);
                if (rightWallBody) world.removeBody(rightWallBody);

                createStreetEnvironment(myPlayerOffset);
                createPins(myPlayerOffset);

                camera.position.set(myPlayerOffset, 4, 12);
                camera.lookAt(myPlayerOffset, 1, 0);

                if (ballBody) ballBody.position.set(myPlayerOffset, LANE_Y + BALL_RADIUS + 0.05, 6);
                if (ballMesh) ballMesh.position.set(myPlayerOffset, LANE_Y + BALL_RADIUS + 0.05, 6);

                activateMultiplayerMode(false);
                resetGame();
            }).catch((err) => {

                updateMatchmakingStatus('探索失敗。請重試。');
                cancelMatchmaking();
            });
        } else if (!data || !data.host) {
            // No match exists - create one as host

            isHost = true;
            myPlayerOffset = 0;
            matchCode = autoMatchCode;
            setMatchCodeUI(autoMatchCode);

            matchRef.set({
                host: { connected: true, mode: targetPinCount, joinedAt: firebase.database.ServerValue.TIMESTAMP, sessionId: sessionId },
                guest: null,
                scores: { p1: [], p2: [] },
                ballUpdate: null,
                events: {},
                mode: targetPinCount
            }).then(() => {
                const hostRef = matchRef.child('host');
                hostRef.onDisconnect().remove();
                setupFirebaseListeners();
                updateMatchmakingStatus('hosting'); // Show loading while waiting for guest

                // After 2 seconds, show "Host is ready" message
                setTimeout(() => {
                    if (isSearchingForMatch && !isMultiplayerActive) {
                        updateMatchmakingStatus('host_ready');
                    }
                }, 2000);

                // Auto-cancel if guest doesn't join within 30 seconds
                matchmakingTimeout = setTimeout(() => {
                    if (!isMultiplayerActive) {

                        cancelMatchmaking();
                        updateMatchmakingStatus('找不到玩家。請重試。');
                    }
                }, 30000);
            }).catch((err) => {

                updateMatchmakingStatus('建立房間失敗。請重試。');
                cancelMatchmaking();
            });
        } else {
            // Match full

            cancelMatchmaking();
            updateMatchmakingStatus('Match full. Retrying...');
            setTimeout(() => autoMatch(), 1000);
        }
    }).catch((err) => {

        updateMatchmakingStatus('連線失敗。請重試。');
        cancelMatchmaking();
    });
}

// ============================================
// SINGLE PLAYER MODE
// ============================================

// Initialize single-player game mode
// Hides matchmaking UI and resets game state
function startSinglePlayer() {
    hideMatchmakingPanel();
    document.getElementById('mode-select-modal').style.display = 'block';
    triggerDimmer(true);
}

function startSelectedMode(mode) {
    document.getElementById('mode-select-modal').style.display = 'none';
    isChaosMode = (mode === 'chaos');
    resetChaosState();
    window.db.goOffline();

    // Recreate ball with new appearance if mode changed
    if (ballMesh) {
        scene.remove(ballMesh);
    }
    createBall();
    scene.add(ballMesh);
    ballMesh.position.set(myPlayerOffset, BALL_RADIUS, 0);

    if (isChaosMode) {
        promptEventSelection();
    } else {
        resetGame();
    }
}

function createTNTMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // 1. Draw Red Background
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0, 0, 256, 256);

    // 2. Draw White Stripe
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 80, 256, 96);

    // 3. Draw TNT Text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshPhongMaterial({ map: texture });
}

function refreshBallVisuals() {
    if (!ballMesh || !ballBody) return;

    // Remove the old visual mesh from the scene
    scene.remove(ballMesh);

    // Clean up memory
    if (ballMesh.geometry) ballMesh.geometry.dispose();
    if (ballMesh.material) ballMesh.material.dispose();
    // Also dispose of the old outline if it exists
    ballMesh.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });

    const currentSizeMult = isChaosMode ? chaosModifiers.ballSizeMult : 1.0;
    const currentRadius = BALL_RADIUS * currentSizeMult;
    const size = currentRadius * 2;

    // 1. CHOOSE VISUAL GEOMETRY
    let geometry;
    if (isChaosMode && chaosModifiers.isExplosive) {
        geometry = new THREE.BoxGeometry(size, size, size);
        ballBody.material.restitution = 0.8;
    } else {
        geometry = new THREE.SphereGeometry(currentRadius, 32, 32);
        ballBody.material.restitution = 0.2;
    }

    // 2. CHOOSE MATERIAL
    let material;
    if (isChaosMode && chaosModifiers.isExplosive) {
        material = createTNTMaterial();
    } else {
        material = new THREE.MeshPhongMaterial({
            color: (myPlayerId === 2) ? 0xff4757 : 0x00eeff,
            shininess: 100
        });
    }

    // 3. APPLY NEW MESH
    ballMesh = new THREE.Mesh(geometry, material);
    ballMesh.castShadow = true;

    // --- ADD OUTLINE EFFECT START ---
    const outlineThickness = 0.03; // Matches the pin outline style
    let outlineGeo;

    if (isChaosMode && chaosModifiers.isExplosive) {
        const outlineSize = size + outlineThickness;
        outlineGeo = new THREE.BoxGeometry(outlineSize, outlineSize, outlineSize);
    } else {
        outlineGeo = new THREE.SphereGeometry(currentRadius + outlineThickness, 32, 32);
    }

    const outlineMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    });
    const ballOutline = new THREE.Mesh(outlineGeo, outlineMat);

    // Add it as a child so it inherits position/rotation automatically
    ballMesh.add(ballOutline);
    // --- ADD OUTLINE EFFECT END ---

    scene.add(ballMesh);

    // 4. THE PHYSICS TRICK
    ballBody.shapes[0] = new CANNON.Sphere(currentRadius);
    ballBody.updateBoundingRadius();
    ballBody.updateMassProperties();
}

function onChaosEventSelected(eventData) {
    refreshBallVisuals();
}

// ============================================
// Event Selection
// ============================================
function promptEventSelection() {
    triggerDimmer(true);
    const container = document.getElementById('event-choices-container');
    container.innerHTML = ''; // Clear previous

    const choices = getTieredChaosEvents();
    if (!choices || choices.length === 0) {
        document.getElementById('event-select-modal').style.display = 'none';
        resetGame();
        return;
    }

    choices.forEach(event => {
        const btn = document.createElement('button');
        btn.className = `btn event-btn tier-${event.tier}`;
        btn.dataset.tier = event.tier;
        

        btn.style.display = 'flex';
        btn.style.flexDirection = 'column';
        btn.innerHTML = `<span style="font-size:18px; font-weight:bold;">${event.displayName}</span><span style="font-size:12px; font-weight:normal; margin-top:4px;">${event.displayDescription}</span>`;

        btn.onclick = () => {
            activateChaosEvent(event);
            refreshBallVisuals();  // Update ball visuals immediately after event activation
            document.getElementById('event-select-modal').style.display = 'none';
            resetGame(); // Start the round
        };
        container.appendChild(btn);
    });

    document.getElementById('event-select-modal').style.display = 'block';
}


// ============================================
// SCORE RECORDING
// ============================================

// Record a completed frame score and update game state
// Syncs scores with Firebase in multiplayer mode and updates UI
function recordRoundScore(scoreValue) {
    const myId = getLocalPlayerId();

    if (!scores[myId]) scores[myId] = [];
    if (!isFreeplayMode) {
        scores[myId].push(scoreValue);
        hasRecordedScoreInCurrentGame = true;

        if (isMultiplayerActive && matchRef) {
            matchRef.child('scores').child(myId).set(scores[myId]).catch((err) => {
            });
        }
    }

    updateScoreTable(myId);

    updateMultiplayerMatchState();

    if (!isMultiplayerActive) {
        const msgBox = document.getElementById('msg-box');
        const replayBtn = document.getElementById('watch-replay-btn');
        const title = document.getElementById('msg-title');
        const body = document.getElementById('msg-body');
        const actionBtn = document.getElementById('action-btn');

        msgBox.style.display = 'block';
        title.innerText = t('msgTitleEnd');
        body.innerText = t('msgBodyEnd');
        replayBtn.style.display = 'block';
        replayBtn.innerText = "觀看重播";
        replayBtn.onclick = startReplay;
        actionBtn.style.display = 'inline-block';
        actionBtn.innerText = '繼續';
        actionBtn.onclick = () => {
            msgBox.style.display = 'none';
            resetGame();
        };
        document.getElementById('action-cam-container').style.display = 'none';
    }
}

// Check if both players have completed all matches and show final result if so
function updateMultiplayerMatchState() {
    if (!isMultiplayerActive) return;

    const localDone = isPlayerComplete(getLocalPlayerId());
    const opponentDone = isPlayerComplete(getOpponentPlayerId());

    // Only show final result if at least one score has been recorded in this game
    // This prevents stale Firebase data from triggering final result immediately after reset
    if (localDone && opponentDone && hasRecordedScoreInCurrentGame) {
        showMultiplayerFinalResult();
    } else if (localDone && !hasShownLocalCompleteMessage) {
        showMultiplayerWaitMessage(true);
    } else if (opponentDone && !hasShownOpponentCompleteMessage) {
        showMultiplayerWaitMessage(false);
    }
}

// ============================================
// PLAY AGAIN AND REMATCH SYSTEM
// ============================================

// Send play-again request to opponent
function sendPlayAgainRequest() {
    triggerDimmer(false);
    const msgBox = document.getElementById('msg-box');
    if (msgBox) {
        msgBox.style.display = 'none';
        // Only clear the body content, not the entire structure
        const body = document.getElementById('msg-body');
        if (body) body.innerText = '';
    }

    if (!isMultiplayerActive || !matchRef) {
        fullReset();
        return;
    }
    if (playAgainRequested) return;
    playAgainRequested = true;
    sendMatchEvent('playAgainRequest', {});
    startPlayAgainCountdown('確認重賽，自動重啟倒數', '等待對手...');

    if (playAgainOpponentRequested) {
        beginPlayAgain();
    }
}

function receivePlayAgainRequest(data) {
    playAgainOpponentRequested = true;
    if (playAgainRequested) {
        beginPlayAgain();
        return;
    }
    showPlayAgainCountdownMessage();
}

function showPlayAgainCountdownMessage() {
    const msgBox = document.getElementById('msg-box');
    const replayBtn = document.getElementById('watch-replay-btn');
    const title = document.getElementById('msg-title');
    const body = document.getElementById('msg-body');
    const btn = document.getElementById('action-btn');

    msgBox.style.display = 'block';
    replayBtn.style.display = 'none';
    triggerDimmer(false);

    btn.style.display = 'inline-block';
    btn.disabled = false;
    btn.innerText = '繼續';
    btn.onclick = sendPlayAgainRequest;

    title.innerText = '對手已準備';
    startPlayAgainCountdown('自動重啟倒數', '等待您確認：');
    body.innerText = `對手請求重賽，距離自動重啟還有 ${playAgainCountdownRemaining} 秒。`;
}

function startPlayAgainCountdown(successText, waitingText) {
    const msgBox = document.getElementById('msg-box');
    const body = document.getElementById('msg-body');
    const btn = document.getElementById('action-btn');

    if (playAgainCountdownTimer) {
        clearInterval(playAgainCountdownTimer);
    }
    playAgainCountdownRemaining = 5;
    playAgainCountdownTimer = setInterval(() => {
        playAgainCountdownRemaining -= 1;
        if (playAgainCountdownRemaining <= 0) {
            clearInterval(playAgainCountdownTimer);
            playAgainCountdownTimer = null;
            if (!playAgainRequested) {
                if (!playAgainOpponentRequested) {
                    sendPlayAgainRequest();
                }
            }
            beginPlayAgain();
        } else {
            if (body) {
                body.innerText = `${waitingText} ${playAgainCountdownRemaining} 秒。`;
            }
            if (btn && btn.innerText === '繼續') {
                btn.innerText = `繼續 (${playAgainCountdownRemaining})`;
            }
        }
    }, 1000);

    if (body) {
        body.innerText = `${waitingText} ${playAgainCountdownRemaining} 秒。`;
    }
    if (btn && btn.innerText === '繼續') {
        btn.innerText = `繼續 (${playAgainCountdownRemaining})`;
    }
}

function resetPlayAgainState() {
    playAgainRequested = false;
    playAgainOpponentRequested = false;
    if (playAgainCountdownTimer) {
        clearInterval(playAgainCountdownTimer);
        playAgainCountdownTimer = null;
    }
    playAgainCountdownRemaining = 5;
}

// Begin play again - full reset for new match
function beginPlayAgain() {
    resetPlayAgainState();
    const msgBox = document.getElementById('msg-box');
    if (msgBox) {
        msgBox.style.display = 'none';
        // Only clear the body content, not the entire structure
        const body = document.getElementById('msg-body');
        if (body) body.innerText = '';
    }
    fullReset();
}

// Show waiting message when a player completes but opponent hasn't
function showMultiplayerWaitMessage(localFinished) {
    const msgBox = document.getElementById('msg-box');
    const replayBtn = document.getElementById('watch-replay-btn');
    const title = document.getElementById('msg-title');
    const body = document.getElementById('msg-body');
    const btn = document.getElementById('action-btn');

    msgBox.style.display = 'block';
    replayBtn.style.display = 'block';
    replayBtn.innerText = 'WATCH REPLAY';
    replayBtn.onclick = startReplay;
    triggerDimmer(false);

    if (localFinished) {
        title.innerText = t('msgTitleEnd');
        body.innerText = t('completeLocal');
        btn.style.display = 'inline-block';
        btn.disabled = false;
        btn.innerText = '關閉';
        btn.onclick = () => { msgBox.style.display = 'none'; };
        hasShownLocalCompleteMessage = true;
    } else {
        title.innerText = '對手已完成';
        body.innerText = '對手已完成 5 局。請繼續完成您的剩餘局整整整整。';
        btn.style.display = 'inline-block';
        btn.disabled = false;
        btn.innerText = '繼續';
        btn.onclick = () => { msgBox.style.display = 'none'; resetGame(); };
        hasShownOpponentCompleteMessage = true;
    }
}

function getPlayerTotal(playerId) {
    if (!scores[playerId]) return 0;
    return scores[playerId].reduce((sum, score) => sum + (score !== undefined ? score : 0), 0);
}

// ============================================
// FINAL RESULT AND WINNING DETERMINATION
// ============================================

// Display final match results when both players complete
function showMultiplayerFinalResult() {
    const msgBox = document.getElementById('msg-box');
    const replayBtn = document.getElementById('watch-replay-btn');
    const title = document.getElementById('msg-title');
    const body = document.getElementById('msg-body');
    const btn = document.getElementById('action-btn');

    const p1Total = getPlayerTotal('p1');
    const p2Total = getPlayerTotal('p2');
    let winnerText;
    if (p1Total === p2Total) {
        winnerText = '平手';
    } else if (p1Total > p2Total) {
        winnerText = '玩家 1 獲勝！';
    } else {
        winnerText = '玩家 2 獲勝！';
    }

    title.innerText = '最終結果';
    triggerDimmer(true);

    let winnerLabel = winnerText;
    let winnerStatus = '';
    if (winnerText !== '平手') {
        const parts = winnerText.split(' ');
        winnerLabel = `${parts[0]} ${parts[1]}`;
        winnerStatus = parts.slice(2).join(' ');
    }

    body.innerHTML = `
                <div style="text-align:center; font-size:18px; font-weight:bold; margin-bottom:4px; color:#f1c40f; letter-spacing:1px;">${winnerLabel}</div>
                ${winnerStatus ? `<div style="text-align:center; font-size:24px; font-weight:bold; margin-bottom:14px; color:#ffffff;">${winnerStatus}</div>` : ''}
                <div style="display:flex; justify-content:space-between; gap:12px; margin-top:10px;">
                    <div style="flex:1; background:rgba(255,255,255,0.08); padding:12px; border-radius:12px; text-align:center;">
                        <div style="font-size:14px; font-weight:bold; margin-bottom:8px;">玩家 1</div>
                        <div>${(scores.p1 || []).map(v => v === undefined ? '-' : v).join(' | ')}</div>
                        <div style="margin-top:10px; font-size:20px; font-weight:bold; color:#1e90ff;">${p1Total}</div>
                    </div>
                    <div style="flex:1; background:rgba(255,255,255,0.08); padding:12px; border-radius:12px; text-align:center;">
                        <div style="font-size:14px; font-weight:bold; margin-bottom:8px;">玩家 2</div>
                        <div>${(scores.p2 || []).map(v => v === undefined ? '-' : v).join(' | ')}</div>
                        <div style="margin-top:10px; font-size:20px; font-weight:bold; color:#ff4757;">${p2Total}</div>
                    </div>
                </div>`;

    btn.innerText = '再玩一次';
    btn.style.display = 'inline-block';
    btn.disabled = false;
    btn.onclick = sendPlayAgainRequest;
    replayBtn.style.display = 'none';
    msgBox.style.display = 'block';

    const strikePopup = document.getElementById('strike-popup');
    if (strikePopup) {
        strikePopup.innerText = winnerText;
        strikePopup.classList.add('show');
        setTimeout(() => strikePopup.classList.remove('show'), 3000);
    }

    setTimeout(() => triggerDimmer(false), 4000);
}

// ============================================
// OPPONENT BALL SYNCHRONIZATION
// ============================================

// Update opponent ball position and rotation from Firebase data
// Synchronizes ball physics state across multiplayer clients
function updateOpponentBall(data) {
    if (!opponentBallMesh || targetPinCount === 100) return;
    if (data.active) {
        if (!opponentBallMesh.visible) opponentBallMesh.visible = true;
        opponentBallMesh.position.set(data.pos.x, data.pos.y, data.pos.z);
        opponentBallMesh.quaternion.set(data.quat.x, data.quat.y, data.quat.z, data.quat.w);
    } else {
        opponentBallMesh.visible = false;
    }
}

function handlePinUpdateEvent(snapshot) {
    const data = snapshot.val();
    if (!data || data.from === getLocalPlayerId()) return;
    updateOpponentPins(data);
}

// ============================================
// OPPONENT PIN SYNCHRONIZATION
// ============================================

// Update opponent pin positions and rotations from Firebase data
// Shows ghost pins representing opponent's pin state during their turn
function updateOpponentPins(data) {
    if (!Array.isArray(data.pins) || opponentGhostPins.length === 0) return;
    data.pins.forEach((pinData, index) => {
        const ghostPin = opponentGhostPins[index];
        if (!ghostPin) return;
        ghostPin.position.set(pinData.pos.x, pinData.pos.y, pinData.pos.z);
        ghostPin.quaternion.set(pinData.quat.x, pinData.quat.y, pinData.quat.z, pinData.quat.w);
        ghostPin.visible = true;
    });
}

// ============================================
// MULTIPLAYER MODE ACTIVATION
// ============================================

// Initialize multiplayer game state and environment
// Sets up dual lanes, opponent visualization, and camera positioning
function activateMultiplayerMode(isHostRole) {
    isMultiplayerActive = true;

    updateLaneWidth();
    const p2Row = document.getElementById('p2-row');
    if (p2Row) p2Row.style.display = 'table-row';

    const offsetDistance = (targetPinCount === 100) ? offsetDistance100 : offsetDistance10;
    const localOffset = isHostRole ? 0 : offsetDistance;
    const remoteOffset = isHostRole ? offsetDistance : 0;
    myPlayerOffset = localOffset;

    // Update camera to center between both lanes for visibility
    camera.position.set(offsetDistance / 2, 4, 20);
    cameraLookAtTarget.set(offsetDistance / 2, 1, -22);
    camera.lookAt(cameraLookAtTarget);
    sunLight.position.set(offsetDistance / 2 + 15, 35, -40);

    createStreetEnvironment(remoteOffset);
    if (targetPinCount !== 100) {
        createGhostPins(remoteOffset);
    }

    if (opponentBallMesh) {
        opponentBallMesh.visible = targetPinCount !== 100;
        // Position opponent ball at opponent's lane
        opponentBallMesh.position.set(remoteOffset, LANE_Y + BALL_RADIUS, 6);
    }

    if (isHostRole) {
        ballMesh.material.color.setHex(0x1e90ff);
        if (opponentBallMesh) opponentBallMesh.material.color.setHex(0xff0000);
    } else {
        ballMesh.material.color.setHex(0xff0000);
        if (opponentBallMesh) opponentBallMesh.material.color.setHex(0x1e90ff);
    }
}

// --- GAME FUNCTIONS ---

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010105);
    scene.fog = new THREE.FogExp2(0x010105, 0.03);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    const startX = (typeof myPlayerOffset !== 'undefined') ? myPlayerOffset : 0;
    camera.position.set(startX, 4, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Initialize raycaster for touch/mouse interaction
    raycaster = new THREE.Raycaster();

    // 2. Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 3);
    sunLight.position.set(startX + 15, 35, -40);
    sunLight.intensity = 2.5;
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 40;
    sunLight.shadow.camera.bottom = -40;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // 3. UI Lines - PLAYER 1 (BLUE)
    const pathMaterial_P1 = new THREE.LineBasicMaterial({
        color: 0x00ffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending
    });
    touchPathLine_P1 = new THREE.Line(new THREE.BufferGeometry(), pathMaterial_P1);
    touchPathLine2_P1 = new THREE.Line(new THREE.BufferGeometry(), pathMaterial_P1);
    touchPathLine3_P1 = new THREE.Line(new THREE.BufferGeometry(), pathMaterial_P1);
    scene.add(touchPathLine_P1, touchPathLine2_P1, touchPathLine3_P1);

    const outerGlowMaterial_P1 = new THREE.LineBasicMaterial({
        color: 0x0088ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending
    });
    outerGlowLine_P1 = new THREE.Line(new THREE.BufferGeometry(), outerGlowMaterial_P1);
    outerGlowLine_P1.scale.set(1.02, 1, 1.02);
    scene.add(outerGlowLine_P1);

    // 3b. UI Lines - PLAYER 2 (RED)
    const pathMaterial_P2 = new THREE.LineBasicMaterial({
        color: 0xff0000, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending
    });
    touchPathLine_P2 = new THREE.Line(new THREE.BufferGeometry(), pathMaterial_P2);
    touchPathLine2_P2 = new THREE.Line(new THREE.BufferGeometry(), pathMaterial_P2);
    touchPathLine3_P2 = new THREE.Line(new THREE.BufferGeometry(), pathMaterial_P2);
    scene.add(touchPathLine_P2, touchPathLine2_P2, touchPathLine3_P2);

    const outerGlowMaterial_P2 = new THREE.LineBasicMaterial({
        color: 0xff3333, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending
    });
    outerGlowLine_P2 = new THREE.Line(new THREE.BufferGeometry(), outerGlowMaterial_P2);
    outerGlowLine_P2.scale.set(1.02, 1, 1.02);
    scene.add(outerGlowLine_P2);

    // 4. Street Lamps
    const streetLamp1 = new THREE.PointLight(0xffaa44, 1.5, 50);
    streetLamp1.position.set(startX + 10, 10, -15);
    scene.add(streetLamp1);

    const streetLamp2 = new THREE.PointLight(0x00ffff, 4, 40);
    streetLamp2.position.set(startX - 5, 8, -30);
    scene.add(streetLamp2);

    // 5. AUDIO SETUP
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    audioLoader = new THREE.AudioLoader();

    if (typeof gameSounds === 'undefined') window.gameSounds = {};
    sounds = gameSounds;

    ballPathSound = new THREE.Audio(audioListener);
    audioLoader.load('ball_rolling.mp3', function (buffer) {
        ballPathSound.setBuffer(buffer);
        ballPathSound.setLoop(true);
        ballPathSound.setVolume(0.5);
        gameSounds['ball_roll'] = ballPathSound;
    });

    pinKnockSound = new THREE.Audio(audioListener);
    audioLoader.load('single-bowling-pin-knock.mp3', function (buffer) {
        pinKnockSound.setBuffer(buffer);
        pinKnockSound.setVolume(0.7);
        gameSounds['collision'] = pinKnockSound;
    });

    audioLoader.load('ball_down.mp3', function (buffer) {
        const ballDownSound = new THREE.Audio(audioListener);
        ballDownSound.setBuffer(buffer);
        ballDownSound.setVolume(0.5);
        gameSounds['ball_down'] = ballDownSound;
    });

    audioLoader.load('Minecraft_TNT.mp3', function (buffer) {
        const explosionSound = new THREE.Audio(audioListener);
        explosionSound.setBuffer(buffer);
        explosionSound.setVolume(0.7);
        gameSounds['explosion'] = explosionSound;
    });

    audioLoader.load('ui_sound.mp3', function (buffer) {
        const uiSound = new THREE.Audio(audioListener);
        uiSound.setBuffer(buffer);
        uiSound.setVolume(0.5);
        gameSounds['ui_click'] = uiSound;
    });

    // 6. PHYSICS SETUP
    world = new CANNON.World();
    world.gravity.set(0, -23, 0);

    window.ballMat = new CANNON.Material("ballMat");
    window.groundMat = new CANNON.Material("groundMat");
    window.pinMat = new CANNON.Material("pinMat");
    window.wallMat = new CANNON.Material("wallMat");

    const ballGroundContact = new CANNON.ContactMaterial(ballMat, groundMat, { friction: 0.2, restitution: 0.1 });
    const ballPinContact = new CANNON.ContactMaterial(ballMat, pinMat, {
        friction: 0.0,
        restitution: 0.5
    });
    const pinPinContact = new CANNON.ContactMaterial(pinMat, pinMat, { friction: 0.5, restitution: 0.2 });
    const pinGroundContact = new CANNON.ContactMaterial(pinMat, groundMat, { friction: 0.6, restitution: 0.1 });

    const ballWallContact = new CANNON.ContactMaterial(ballMat, wallMat, {
        friction: 0.1,
        restitution: 0.8,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3
    });

    world.addContactMaterial(ballGroundContact);
    world.addContactMaterial(ballPinContact);
    world.addContactMaterial(pinPinContact);
    world.addContactMaterial(pinGroundContact);
    world.addContactMaterial(ballWallContact);

    // Warm up the physics world with a few initial steps
    for (let i = 0; i < 10; i++) {
        world.step(1 / 60);
    }

    // 7. Action Camera Rendering
    actionCanvas = document.getElementById('action-canvas');
    actionCamera = new THREE.PerspectiveCamera(45, 250 / 150, 0.1, 100);
    actionRenderer = new THREE.WebGLRenderer({ canvas: actionCanvas, antialias: true });
    actionRenderer.setSize(250, 150);

    // 8. Object Initialization
    createStreetEnvironment(myPlayerOffset);
    createBall();
    createPins(myPlayerOffset);
    initLightTrail();

    // 9. Setup Opponent Ball
    const radius = typeof BALL_RADIUS !== 'undefined' ? BALL_RADIUS : 0.35;
    const ghostGeo = new THREE.SphereGeometry(radius, 32, 32);
    const ghostMat = new THREE.MeshStandardMaterial({
        color: 0xff0000, transparent: true, opacity: 0.6
    });
    opponentBallMesh = new THREE.Mesh(ghostGeo, ghostMat);
    opponentBallMesh.visible = false;
    scene.add(opponentBallMesh);

    // 10. Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });

    window.addEventListener('mousedown', (e) => onTouchStart({ touches: [{ clientX: e.clientX, clientY: e.clientY }], preventDefault: () => { } }));
    window.addEventListener('mousemove', (e) => { if (isTouching) onTouchMove({ touches: [{ clientX: e.clientX, clientY: e.clientY }], preventDefault: () => { } }); });
    window.addEventListener('mouseup', (e) => onTouchEnd({ changedTouches: [{ clientX: e.clientX, clientY: e.clientY }], preventDefault: () => { } }));

    // Close settings menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('settings-menu');
        const menuContainer = document.querySelector('.menu-container');
        if (menu && menuContainer && menu.style.display === 'flex') {
            if (!menuContainer.contains(e.target)) {
                closeSettingsMenu();
            }
        }
    });

    const modeAcceptBtn = document.getElementById('mode-switch-accept');
    const modeDeclineBtn = document.getElementById('mode-switch-decline');
    if (modeAcceptBtn) {
        modeAcceptBtn.addEventListener('click', () => {
            if (!isMultiplayerActive || !matchRef) return;
            sendMatchEvent('modeSwitchResponse', { accepted: true, mode: modeSwitchRequestMode });
            doToggleGameMode(modeSwitchRequestMode);
            hideModeSwitchModal();
        });
    }
    if (modeDeclineBtn) {
        modeDeclineBtn.addEventListener('click', () => {
            if (!isMultiplayerActive || !matchRef) return;
            sendMatchEvent('modeSwitchResponse', { accepted: false, mode: modeSwitchRequestMode });
            hideModeSwitchModal();
            // Restore wait message if it was showing before
            if (wasShowingWaitMessage) {
                showMultiplayerWaitMessage(waitMessageLocalFinished);
                wasShowingWaitMessage = false;
            }
        });
    }

    // --- FIX FOR FIRST-THROW LAG ---
    // 1. Temporarily show hidden objects so their materials get compiled
    if (trailMesh_P1) trailMesh_P1.visible = true;
    if (trailMesh_P2) trailMesh_P2.visible = true;
    if (opponentBallMesh) opponentBallMesh.visible = true;

    // 2. Pre-compile shaders for both the main view AND the action camera
    renderer.compile(scene, camera);
    actionRenderer.compile(scene, actionCamera);

    // 3. Force one invisible render pass to ensure GPU buffers are fully allocated
    renderer.render(scene, camera);
    actionRenderer.render(scene, actionCamera);

    // 4. Hide the objects again before the game starts
    if (trailMesh_P1) trailMesh_P1.visible = false;
    if (trailMesh_P2) trailMesh_P2.visible = false;
    if (opponentBallMesh) opponentBallMesh.visible = false;
    // -------------------------------

    // Initialize language system
    document.documentElement.lang = currentLanguage;
    updateAllUIText();

    showMatchmakingPanel();
    unlockAudio();
    animate();
}
function toggleActionCamSize(event) {
    if (event) event.stopPropagation();
    playGameSound('ui_click');
    const container = document.getElementById('action-cam-container');
    container.classList.toggle('enlarged');

    setTimeout(() => {
        if (actionRenderer && actionCamera) {
            const w = container.clientWidth;
            const h = container.clientHeight;
            actionRenderer.setSize(w, h);
            actionCamera.aspect = w / h;
            actionCamera.updateProjectionMatrix();
        }
    }, 50);
}

function toggleSettingsMenu() {
    // Prevent settings menu when matchmaking panel is shown
    const panel = document.getElementById('matchmaking-panel');
    if (panel && panel.style.display === 'block') return;
    playGameSound('ui_click');
    const menu = document.getElementById('settings-menu');
    menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
}

function closeSettingsMenu() {
    const menu = document.getElementById('settings-menu');
    if (menu) menu.style.display = 'none';
}

function goHome() {
    playGameSound('ui_click');
    closeSettingsMenu();
    // Stop any active game or multiplayer session
    if (isMultiplayerActive) {
        handleOpponentDisconnect();
    } else {
        stopAllGameSounds();
        fullReset();
        showMatchmakingPanel();
    }
}

function toggleGameMode() {
    // Always return to matchmaking after mode change
    hideMatchmakingPanel();
    
    const newMode = (targetPinCount === 10) ? 100 : 10;

    // --- SINGLE PLAYER MODE ---
    if (!isMultiplayerActive) {
        const modal = document.getElementById('mode-switch-modal');
        document.getElementById('mode-switch-title').innerText = "切換模式";
        document.getElementById('mode-switch-body').innerText = `是否切換至 ${newMode} 瓶模式？這將重置目前的分數並返回單人選擇。`;

        const acceptBtn = document.getElementById('mode-switch-accept');
        const declineBtn = document.getElementById('mode-switch-decline');

        modal.style.display = 'block';

        acceptBtn.onclick = () => {
            // Only toggle if they click accept, then show single player
            doToggleGameMode();
            modal.style.display = 'none';
            showMatchmakingPanel();
        };

        declineBtn.onclick = () => {
            modal.style.display = 'none';
            showMatchmakingPanel();
        };

        // CRITICAL: Stop the function here so doToggleGameMode() 
        // doesn't run automatically below!
        return;
    }

    // --- MULTIPLAYER MODE ---
    if (isMultiplayerActive && matchRef) {
        requestModeSwitch();
        return;
    }

    // Always return to matchmaking
    showMatchmakingPanel();
}

function adjustMultiplayerLaneOffsets(oldLocalOffset, oldRemoteOffset, newLocalOffset, newRemoteOffset) {
    if (!scene || !world) return;
    scene.traverse(obj => {
        if (!obj.userData || typeof obj.userData.offset === 'undefined') return;
        let isLocal = obj.userData.offset === oldLocalOffset;
        let isRemote = obj.userData.offset === oldRemoteOffset;
        if (!isLocal && !isRemote) return;
        const newOffset = isLocal ? newLocalOffset : newRemoteOffset;
        obj.userData.offset = newOffset;
        if (obj.userData.envType === 'lane') {
            obj.position.x = newOffset;
        } else if (obj.userData.envType === 'gutter') {
            obj.position.x = newOffset + (obj.userData.side === 'left' ? -2.5 : 2.5);
        } else if (obj.userData.envType === 'wall') {
            const wallX = (targetPinCount === 100) ? 4.4 : 3.6;
            obj.position.x = newOffset + (obj.userData.side === 'left' ? -wallX : wallX);
        }
    });
    world.bodies.forEach(body => {
        if (!body.userData || typeof body.userData.offset === 'undefined') return;
        let isLocal = body.userData.offset === oldLocalOffset;
        let isRemote = body.userData.offset === oldRemoteOffset;
        if (!isLocal && !isRemote) return;
        const newOffset = isLocal ? newLocalOffset : newRemoteOffset;
        body.userData.offset = newOffset;
        if (body.userData.envType === 'ground') {
            body.position.x = newOffset;
        } else if (body.userData.envType === 'wall') {
            const wallX = (targetPinCount === 100) ? 4.4 : 3.6;
            body.position.x = newOffset + (body.userData.side === 'left' ? -wallX : wallX);
        }
    });
}

// ============================================
// GAME MODE TOGGLE
// ============================================

// Switch between 10-pin and 100-pin bowling modes
// Handles pin count changes, lane width adjustments, and memory cleanup
function doToggleGameMode(newMode) {
    const previousTargetPinCount = targetPinCount;
    if (typeof newMode === 'undefined') {
        targetPinCount = (targetPinCount === 10) ? 100 : 10;
    } else {
        targetPinCount = newMode;
    }

    const oldOffsetDistance = (previousTargetPinCount === 100) ? offsetDistance100 : offsetDistance10;
    const newOffsetDistance = (targetPinCount === 100) ? offsetDistance100 : offsetDistance10;
    const oldLocalOffset = isHost ? 0 : oldOffsetDistance;
    const oldRemoteOffset = isHost ? oldOffsetDistance : 0;
    const newLocalOffset = isHost ? 0 : newOffsetDistance;
    const newRemoteOffset = isHost ? newOffsetDistance : 0;

    if (isMultiplayerActive) {
        // Clear existing pins to recreate with new count
        pins.forEach(pin => {
            scene.remove(pin.mesh);
            world.removeBody(pin.body);

            // Dispose GPU memory
            if (pin.mesh.geometry) pin.mesh.geometry.dispose();
            if (pin.mesh.material) pin.mesh.material.dispose();
            pin.mesh.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        });
        pins = [];

        // Dispose pin circle outlines
        pinCircles.forEach(circle => {
            scene.remove(circle);
            if (circle.geometry) circle.geometry.dispose();
            if (circle.material) circle.material.dispose();
        });
        pinCircles = [];
    }

    document.getElementById('mode-toggle-btn').innerText = (targetPinCount === 10) ? '10 瓶' : '100 瓶';
    if (isMultiplayerActive) {
        myPlayerOffset = newLocalOffset;
        adjustMultiplayerLaneOffsets(oldLocalOffset, oldRemoteOffset, newLocalOffset, newRemoteOffset);
    }
    updateLaneWidth();
    matchHistory = [];
    scores = { p1: [], p2: [] };
    updateScoreTable('p1');
    updateScoreTable('p2');
    resetGame();
    if (isMultiplayerActive) {
        const offsetDistance = newOffsetDistance;
        camera.position.set(offsetDistance / 2, 4, 20);
        cameraLookAtTarget.set(offsetDistance / 2, 1, -22);
        camera.lookAt(cameraLookAtTarget);
        sunLight.position.set(offsetDistance / 2 + 15, 35, -40);
        const remoteOffset = isHost ? offsetDistance : 0;
        // Recreate ghost pins with new count for the opponent lane only
        opponentGhostPins.forEach(g => scene.remove(g));
        opponentGhostPins = [];
        if (targetPinCount !== 100) {
            createGhostPins(remoteOffset);
        } else if (opponentBallMesh) {
            opponentBallMesh.visible = false;
        }
        if (matchRef) {
            matchRef.child('scores').set(scores).catch((err) => {
            });
        }
    }
    playGameSound('ui_click');
}

function requestModeSwitch() {
    if (!isMultiplayerActive || modeSwitchRequestPending) return;
    const requestedMode = (targetPinCount === 10) ? 100 : 10;
    modeSwitchRequestPending = true;
    modeSwitchRequestMode = requestedMode;
    modeSwitchRequester = isHost ? 'p1' : 'p2';
    showModeSwitchModal(`您請求切換至 ${requestedMode} 瓶模式。等待對手回應...`, false);
    sendMatchEvent('modeSwitchRequest', { mode: requestedMode });
}

function handleModeSwitchRequest(data) {
    if (modeSwitchRequestPending) {
        sendMatchEvent('modeSwitchResponse', { accepted: false, mode: data.mode });
        return;
    }
    // Hide wait message if it's shown so mode switch modal can be visible
    const msgBox = document.getElementById('msg-box');
    wasShowingWaitMessage = msgBox && msgBox.style.display === 'block';
    if (wasShowingWaitMessage) {
        // Check which wait message was showing
        const title = document.getElementById('msg-title');
        waitMessageLocalFinished = (title && title.innerText === '比賽結束');
        msgBox.style.display = 'none';
    }
    modeSwitchRequestMode = data.mode;
    modeSwitchRequester = data.from || (isHost ? 'p2' : 'p1');
    showModeSwitchModal(`對手請求切換至 ${data.mode} 瓶模式。是否接受？`, true);
}

function handleModeSwitchResponse(data) {
    if (!modeSwitchRequestPending) return;
    modeSwitchRequestPending = false;
    hideModeSwitchModal();
    if (data.accepted && data.mode === modeSwitchRequestMode) {
        doToggleGameMode(data.mode);
    }
}

function showModeSwitchModal(message, showButtons) {
    const modal = document.getElementById('mode-switch-modal');
    const accept = document.getElementById('mode-switch-accept');
    const decline = document.getElementById('mode-switch-decline');
    document.getElementById('mode-switch-body').innerText = message;
    modal.style.display = 'block';
    if (showButtons) {
        accept.style.display = 'inline-block';
        decline.style.display = 'inline-block';
    } else {
        accept.style.display = 'none';
        decline.style.display = 'none';
    }
    triggerDimmer(true);
}

function hideModeSwitchModal() {
    const modal = document.getElementById('mode-switch-modal');
    modal.style.display = 'none';
    triggerDimmer(false);
}

function updateVolume(value) {
    const percent = Math.round(value * 100);
    document.getElementById('vol-percent').innerText = percent + "%";
    if (audioListener) {
        audioListener.setMasterVolume(value * 2);
    }
}

function updateLaneWidth() {
    const is100 = (targetPinCount === 100);
    const laneWidth = is100 ? 7.6 : 4.5;
    const wallX = is100 ? 4.4 : 3.6;
    const currentOffset = (typeof myPlayerOffset !== 'undefined') ? myPlayerOffset : 0;
    const fullWallHeight = 18;
    const lowWallHeight = 1.2;

    if (scene) {
        scene.traverse(obj => {
            if (!obj.userData) return;
            if (obj.userData.envType === 'lane') {
                obj.scale.x = laneWidth / 4.5;
                obj.position.x = obj.userData.offset;
            } else if (obj.userData.envType === 'gutter') {
                if (is100) {
                    obj.visible = false;
                } else {
                    obj.visible = true;
                    obj.position.x = obj.userData.offset + (obj.userData.side === 'left' ? -2.5 : 2.5);
                }
            } else if (obj.userData.envType === 'wall') {
                obj.position.x = obj.userData.offset + (obj.userData.side === 'left' ? -wallX : wallX);
                // Update wall height
                const isPlayer2Lane = (obj.userData.offset !== 0);
                let wallHeight;
                if (isMultiplayerActive) {
                    wallHeight = (obj.userData.side === 'left') ?
                        (isPlayer2Lane ? lowWallHeight : fullWallHeight) :
                        (isPlayer2Lane ? fullWallHeight : lowWallHeight);
                } else {
                    wallHeight = fullWallHeight;
                }
                obj.scale.y = wallHeight / fullWallHeight;
                obj.position.y = wallHeight / 2;
            }
        });
    }

    if (world) {
        world.bodies.forEach(body => {
            if (!body.userData) return;
            if (body.userData.envType === 'ground') {
                const shape = body.shapes[0];
                if (shape) {
                    shape.halfExtents.x = laneWidth / 2;
                    shape.updateConvexPolyhedronRepresentation();
                }
                body.updateBoundingRadius();
                body.position.x = body.userData.offset;
            } else if (body.userData.envType === 'wall') {
                body.position.x = body.userData.offset + (body.userData.side === 'left' ? -wallX : wallX);
                // Update wall height
                const isPlayer2Lane = (body.userData.offset !== 0);
                let wallHeight;
                if (isMultiplayerActive) {
                    wallHeight = (body.userData.side === 'left') ?
                        (isPlayer2Lane ? lowWallHeight : fullWallHeight) :
                        (isPlayer2Lane ? fullWallHeight : lowWallHeight);
                } else {
                    wallHeight = fullWallHeight;
                }
                const shape = body.shapes[0];
                if (shape) {
                    shape.halfExtents.y = wallHeight / 2;
                    shape.updateConvexPolyhedronRepresentation();
                }
                body.updateBoundingRadius();
                body.position.y = wallHeight / 2;
            }
        });
    }
}

function triggerDimmer(show) {
    const dimmer = document.getElementById('screen-dimmer');
    if (!dimmer) return;
    if (show) dimmer.classList.add('dimmed');
    else dimmer.classList.remove('dimmed');
}

function createStreetEnvironment(offset = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#e3c18d';
    ctx.fillRect(0, 0, 512, 1024);

    const plankCount = 39;
    const plankWidth = 512 / plankCount;

    for (let i = 0; i < plankCount; i++) {
        ctx.fillStyle = `rgba(139, 69, 19, ${Math.random() * 0.1})`;
        ctx.fillRect(i * plankWidth, 0, plankWidth, 1024);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i * plankWidth, 0);
        ctx.lineTo(i * plankWidth, 1024);
        ctx.stroke();
    }

    const laneTexture = new THREE.CanvasTexture(canvas);
    laneTexture.wrapS = THREE.RepeatWrapping;
    laneTexture.wrapT = THREE.RepeatWrapping;
    laneTexture.repeat.set(1, 10);

    const laneGeo = new THREE.BoxGeometry(4.5, 0.2, 100);
    const laneMat = new THREE.MeshStandardMaterial({
        map: laneTexture,
        roughness: 0.9,
        metalness: 0.7,
        color: 0x444444
    });

    laneMesh = new THREE.Mesh(laneGeo, laneMat);
    laneMesh.position.set(offset, 0, -35);
    laneMesh.receiveShadow = true;
    laneMesh.userData = { envType: 'lane', offset };
    scene.add(laneMesh);

    // --- GUTTER CREATION ---
    const gutterGeo = new THREE.BoxGeometry(0.5, 0.2, 100);
    const gutterMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });

    leftGutter = new THREE.Mesh(gutterGeo, gutterMat);
    leftGutter.position.set(offset - 2.5, -0.05, -35);
    leftGutter.userData = { envType: 'gutter', side: 'left', offset };
    scene.add(leftGutter);

    rightGutter = new THREE.Mesh(gutterGeo, gutterMat.clone());
    rightGutter.position.set(offset + 2.5, -0.05, -35);
    rightGutter.userData = { envType: 'gutter', side: 'right', offset };
    scene.add(rightGutter);

    // --- VISUAL WALLS ---
    const fullWallHeight = 18;
    const lowWallHeight = 1.2;
    const is100 = (typeof targetPinCount !== 'undefined' && targetPinCount === 100);
    const wallDist = is100 ? 4.4 : 3.6;

    const isPlayer2Lane = (offset !== 0);
    let leftWallHeight, rightWallHeight;
    if (isMultiplayerActive) {
        leftWallHeight = isPlayer2Lane ? lowWallHeight : fullWallHeight;
        rightWallHeight = isPlayer2Lane ? fullWallHeight : lowWallHeight;
    } else {
        leftWallHeight = fullWallHeight;
        rightWallHeight = fullWallHeight;
    }

    const leftWallGeo = new THREE.BoxGeometry(1.2, leftWallHeight, 100);
    const rightWallGeo = new THREE.BoxGeometry(1.2, rightWallHeight, 100);
    const wallVisualMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d });

    leftWallMesh = new THREE.Mesh(leftWallGeo, wallVisualMat);
    leftWallMesh.position.set(offset - wallDist, leftWallHeight / 2, -35);
    leftWallMesh.userData = { envType: 'wall', side: 'left', offset };
    scene.add(leftWallMesh);

    rightWallMesh = new THREE.Mesh(rightWallGeo, wallVisualMat.clone());
    rightWallMesh.position.set(offset + wallDist, rightWallHeight / 2, -35);
    rightWallMesh.userData = { envType: 'wall', side: 'right', offset };
    scene.add(rightWallMesh);

    // --- PHYSICS BODIES ---
    const groundShape = new CANNON.Box(new CANNON.Vec3(2.25, 0.1, 50));
    groundBody = new CANNON.Body({ mass: 0, material: groundMat });
    groundBody.addShape(groundShape);
    groundBody.position.set(offset, 0, -35);
    groundBody.userData = { envType: 'ground', offset };
    world.addBody(groundBody);

    const leftWallShape = new CANNON.Box(new CANNON.Vec3(0.6, leftWallHeight / 2, 50));
    const rightWallShape = new CANNON.Box(new CANNON.Vec3(0.6, rightWallHeight / 2, 50));

    leftWallBody = new CANNON.Body({
        mass: 0,
        material: typeof wallMat !== 'undefined' ? wallMat : groundMat
    });
    leftWallBody.addShape(leftWallShape);
    leftWallBody.position.set(offset - wallDist, leftWallHeight / 2, -35);
    leftWallBody.userData = { envType: 'wall', side: 'left', offset };
    world.addBody(leftWallBody);

    rightWallBody = new CANNON.Body({
        mass: 0,
        material: typeof wallMat !== 'undefined' ? wallMat : groundMat
    });
    rightWallBody.addShape(rightWallShape);
    rightWallBody.position.set(offset + wallDist, rightWallHeight / 2, -35);
    rightWallBody.userData = { envType: 'wall', side: 'right', offset };
    world.addBody(rightWallBody);
}

function createBall() {
    let geometry, material;
    console.log("Creating ball with chaos mode:", isChaosMode, "and modifiers:", chaosModifiers);

    if (isChaosMode && chaosModifiers.isExplosive) {
        // ... (Your existing TNT Canvas/Texture logic)
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#000000';
        for (let i = 0; i < 64; i += 8) {
            ctx.fillRect(i, 0, 4, 64);
            ctx.fillRect(0, i, 64, 4);
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TNT', 32, 32);
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(28, 0, 8, 16);

        const texture = new THREE.CanvasTexture(canvas);
        geometry = new THREE.BoxGeometry(BALL_RADIUS * 2, BALL_RADIUS * 2, BALL_RADIUS * 2);
        material = new THREE.MeshPhongMaterial({ map: texture, shininess: 10 });
    } else {
        geometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
        material = new THREE.MeshPhongMaterial({ color: 0x00eeff, shininess: 250, emissive: 0x003366 });
    }

    ballMesh = new THREE.Mesh(geometry, material);
    ballMesh.castShadow = true;

    // --- ADD OUTLINE EFFECT START ---
    // We create a duplicate geometry slightly larger than the original
    const outlineThickness = 0.01;
    let outlineGeo;

    if (isChaosMode && chaosModifiers.isExplosive) {
        // Use a Box for the TNT outline
        const size = (BALL_RADIUS * 2) + outlineThickness;
        outlineGeo = new THREE.BoxGeometry(size, size, size);
    } else {
        // Use a Sphere for the normal ball outline
        outlineGeo = new THREE.SphereGeometry(BALL_RADIUS + outlineThickness, 32, 32);
    }

    const outlineMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
    });
    const ballOutline = new THREE.Mesh(outlineGeo, outlineMat);

    // Attach the outline to the ballMesh so it moves and rotates with it
    ballMesh.add(ballOutline);
    // --- ADD OUTLINE EFFECT END ---

    scene.add(ballMesh);

    // ... (Your existing Cannon.js physics logic)
    const ballShape = new CANNON.Sphere(BALL_RADIUS);
    ballBody = new CANNON.Body({ mass: 0, shape: ballShape, material: ballMat });
    ballBody.type = CANNON.Body.STATIC;
    ballBody.mass = 0;
    ballBody.updateMassProperties();
    ballBody.allowSleep = false;
    if (typeof ballBody.wakeUp === 'function') ballBody.wakeUp();
    ballBody.linearDamping = 0.1;
    ballBody.angularDamping = 0.1;

    const startPos = new CANNON.Vec3(myPlayerOffset, LANE_Y + BALL_RADIUS + 0.05, 6);
    ballBody.position.copy(startPos);
    world.addBody(ballBody);
    ballMesh.position.copy(ballBody.position);
}

function createPinGeometry() {
    const points = [];
    points.push(new THREE.Vector2(0, -0.4));
    points.push(new THREE.Vector2(0.12, -0.4));
    points.push(new THREE.Vector2(0.16, -0.25));
    points.push(new THREE.Vector2(0.15, -0.15));
    points.push(new THREE.Vector2(0.08, 0.08));
    points.push(new THREE.Vector2(0.06, 0.22));
    points.push(new THREE.Vector2(0.09, 0.32));
    points.push(new THREE.Vector2(0.07, 0.38));
    points.push(new THREE.Vector2(0, 0.4));
    return new THREE.LatheGeometry(points, 24);
}

function createPins(offset = 0) {
    const pinGeo = createPinGeometry();
    const pinMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 200 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const stripeGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16);

    const SCORE_RADIUS = 0.22;
    const circleGeo = new THREE.RingGeometry(SCORE_RADIUS - 0.05, SCORE_RADIUS, 32);
    const circleMat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.6
    });

    const spawnSinglePin = (x, z) => {
        const pinSizeMult = (typeof chaosModifiers !== 'undefined' && chaosModifiers.pinSizeMult) ? chaosModifiers.pinSizeMult : 1.0;
        const pinMassMult = (typeof chaosModifiers !== 'undefined' && chaosModifiers.pinMassMult) ? chaosModifiers.pinMassMult : 1.0;
        const worldX = x + offset;

        const circle = new THREE.Mesh(circleGeo, circleMat.clone());
        circle.rotation.x = -Math.PI / 2;
        circle.scale.setScalar(pinSizeMult);
        circle.position.set(worldX, LANE_Y + 0.01, z);
        scene.add(circle);
        pinCircles.push(circle);

        const group = new THREE.Group();

        const pMesh = new THREE.Mesh(pinGeo, pinMaterial);
        pMesh.castShadow = true;
        pMesh.scale.setScalar(pinSizeMult);
        group.add(pMesh);

        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.BackSide
        });
        const outlineMesh = new THREE.Mesh(pinGeo, outlineMaterial);
        outlineMesh.scale.setScalar(1.07 * pinSizeMult);
        group.add(outlineMesh);

        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.scale.setScalar(pinSizeMult);
        stripe.position.set(0, 0.16 * pinSizeMult, 0);
        group.add(stripe);

        scene.add(group);

        const pinMass = ((targetPinCount > 50) ? 2.0 : 2.5) * pinMassMult;
        const pBody = new CANNON.Body({ mass: pinMass, material: pinMat });
        const qCyl = new CANNON.Quaternion();
        qCyl.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

        pBody.addShape(new CANNON.Cylinder(0.12, 0.12, 0.1, 12), new CANNON.Vec3(0, -0.35, 0), qCyl);
        pBody.addShape(new CANNON.Sphere(0.16), new CANNON.Vec3(0, -0.18, 0));
        pBody.addShape(new CANNON.Cylinder(0.08, 0.13, 0.3, 12), new CANNON.Vec3(0, 0.05, 0), qCyl);
        pBody.addShape(new CANNON.Sphere(0.09), new CANNON.Vec3(0, 0.31, 0));

        pBody.linearDamping = targetPinCount > 50 ? 0.30 : 0.2;
        pBody.angularDamping = targetPinCount > 50 ? 0.35 : 0.3;
        pBody.type = CANNON.Body.KINEMATIC;
        pBody.position.set(worldX, LANE_Y + (PIN_HEIGHT / 2 * pinSizeMult), z);

        pBody.addEventListener('collide', (e) => {
            if (pBody.type === CANNON.Body.KINEMATIC) {
                pBody.type = CANNON.Body.DYNAMIC;
                pBody.updateMassProperties();

                const now = performance.now();

                if (now - lastPinHitTime > 1000) {
                    currentPinVolume = 0.7;
                } else {
                    currentPinVolume = Math.max(0.07, currentPinVolume - 0.05);
                }
                lastPinHitTime = now;

                if (now - lastPinSoundTime > 80) {
                    if (pinKnockSound && pinKnockSound.buffer) {
                        if (pinKnockSound.isPlaying) pinKnockSound.stop();
                        pinKnockSound.setVolume(currentPinVolume);
                        pinKnockSound.play();
                    }
                    lastPinSoundTime = now;
                }

                const forceDir = pBody.position.vsub(e.contact.bi.position);
                forceDir.normalize();
                const impulseStrength = (targetPinCount === 100) ? 2.5 : 2;
                pBody.applyImpulse(forceDir.scale(impulseStrength), pBody.position);
                pBody.velocity.y += 1.2;

                spawnImpact(pBody.position, 0xffffff, 8);

                const collider = e.contact.bi === pBody ? e.contact.bj : e.contact.bi;
                if (chaosModifiers.isExplosive && ballBody && collider === ballBody) {
                    const explosionPosition = pBody.position.clone();
                    spawnExplosionEffect({ x: explosionPosition.x, y: explosionPosition.y, z: explosionPosition.z }, 0xffaa33, 14, 2);
                    playGameSound('explosion');

                    pins.forEach(pin => {
                        const dir = pin.body.position.clone().vsub(explosionPosition);
                        const distance = dir.length();
                        if (distance > 0 && distance < 5) {
                            dir.normalize();
                            const power = (5 - distance) * 3 * chaosModifiers.ballSpeedMult;
                            pin.body.applyImpulse(dir.scale(power), pin.body.position);
                        }
                    });
                }

                if (!impactOccurred) {
                    impactOccurred = true;
                    isCinematicMode = true;
                    timeScale = 0.15;
                    cinematicTargetPin = pBody;

                    setTimeout(() => {
                        timeScale = 1.0;
                        isCinematicMode = false;
                    }, 3000);

                    clearTimeout(resetTimer);
                    resetTimer = setTimeout(checkPinsStability, (targetPinCount === 100) ? 9000 : 4000);
                }
            }
        });

        world.addBody(pBody);
        pins.push({ mesh: group, body: pBody, initialPos: { x: worldX, z: z } });
    };

    const startZ = -22;
    if (targetPinCount === 100) {
        const spacing = 0.52;
        for (let r = 0; r < 13; r++) {
            for (let i = 0; i <= r; i++) {
                const x = (i - r * 0.5) * spacing;
                spawnSinglePin(x, startZ - (r * spacing));
            }
        }
        const row14Count = 9;
        for (let i = 0; i < row14Count; i++) {
            const x = (i - (row14Count - 1) * 0.5) * spacing;
            spawnSinglePin(x, startZ - (13 * spacing));
        }
    } else {
        const spacing = 0.65;
        for (let r = 0; r < 4; r++) {
            for (let i = 0; i <= r; i++) {
                const x = (i - r * 0.5) * spacing;
                spawnSinglePin(x, startZ - (r * spacing));
            }
        }
    }
}

function createGhostPins(offset = 0) {
    const pinGeo = createPinGeometry();
    const pinMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.35
    });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.4 });
    const stripeGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16);

    let ghostPinCount = 0;
    const maxGhostPins = (targetPinCount === 100) ? 30 : 10;

    const spawnGhostPin = (x, z) => {
        if (ghostPinCount >= maxGhostPins) return;
        ghostPinCount++;

        const worldX = x + offset;
        const group = new THREE.Group();

        const pMesh = new THREE.Mesh(pinGeo, pinMaterial);
        pMesh.castShadow = true;
        group.add(pMesh);

        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.2
        });
        const outlineMesh = new THREE.Mesh(pinGeo, outlineMaterial);
        outlineMesh.scale.setScalar(1.07);
        group.add(outlineMesh);

        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(0, 0.16, 0);
        group.add(stripe);

        group.position.set(worldX, LANE_Y + (PIN_HEIGHT / 2), z);
        group.visible = true;
        scene.add(group);
        opponentGhostPins.push(group);
    };

    const startZ = -22;
    if (targetPinCount === 100) {
        const spacing = 0.52;
        for (let r = 0; r < 13 && ghostPinCount < maxGhostPins; r++) {
            for (let i = 0; i <= r && ghostPinCount < maxGhostPins; i++) {
                const x = (i - r * 0.5) * spacing;
                spawnGhostPin(x, startZ - (r * spacing));
            }
        }
        const row14Count = 9;
        for (let i = 0; i < row14Count && ghostPinCount < maxGhostPins; i++) {
            const x = (i - (row14Count - 1) * 0.5) * spacing;
            spawnGhostPin(x, startZ - (13 * spacing));
        }
    } else {
        const spacing = 0.65;
        for (let r = 0; r < 4; r++) {
            for (let i = 0; i <= r; i++) {
                const x = (i - r * 0.5) * spacing;
                spawnGhostPin(x, startZ - (r * spacing));
            }
        }
    }
}

function initLightTrail() {
    const geometry = new THREE.PlaneGeometry(1, 1, 1, TRAIL_MAX_POINTS - 1);


    // Player 1 Trail (BLUE)
    const material_P1 = new THREE.MeshBasicMaterial({
        color: 0x00ccff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });

    trailMesh_P1 = new THREE.Mesh(geometry.clone(), material_P1);
    trailMesh_P1.frustumCulled = false;
    trailMesh_P1.visible = false;
    scene.add(trailMesh_P1);


    // Player 2 Trail (RED)
    const material_P2 = new THREE.MeshBasicMaterial({
        color: 0xff3333, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });

    trailMesh_P2 = new THREE.Mesh(geometry.clone(), material_P2);
    trailMesh_P2.frustumCulled = false;
    trailMesh_P2.visible = false;
    scene.add(trailMesh_P2);

}

function updateLightTrail() {
    // 如果不是在投球狀態，隱藏所有拖尾並清空歷史
    if (!isBowling) {
        if (typeof trailMesh_P1 !== 'undefined') trailMesh_P1.visible = false;
        if (typeof trailMesh_P2 !== 'undefined') trailMesh_P2.visible = false;
        trailHistory = [];
        return;
    }

    // 1. 根據目前玩家身份選擇正確的 Mesh
    const isPlayer2 = getLocalPlayerId() === 'p2';
    const currentTrailMesh = isPlayer2 ? trailMesh_P2 : trailMesh_P1;

    // 確保 Mesh 是顯示的
    currentTrailMesh.visible = true;

    // 2. 動態更改顏色：Player 2 設為紅色，Player 1 保持青色
    // 這樣即使兩個人並排玩，顏色也會是分開的
    if (isPlayer2) {
        currentTrailMesh.material.color.setHex(0xff0000); // 純紅色
    } else {
        currentTrailMesh.material.color.setHex(0x00ffff); // 原本的青色
    }

    // 3. 記錄球的當前位置
    trailHistory.push({
        x: ballBody.position.x,
        y: ballBody.position.y,
        z: ballBody.position.z
    });

    // 限制拖尾長度
    if (trailHistory.length > TRAIL_MAX_POINTS) trailHistory.shift();

    // 4. 更新頂點數據 (帶有錐形逐漸變細的效果)
    const posAttr = currentTrailMesh.geometry.attributes.position;
    const baseWidth = 0.12;

    for (let i = 0; i < TRAIL_MAX_POINTS; i++) {
        // 取得歷史記錄中的點，如果還沒記錄到那麼多點，就用球的當前位置填充
        const pointIndex = Math.min(i, trailHistory.length - 1);
        const point = trailHistory[pointIndex] || {
            x: ballBody.position.x,
            y: ballBody.position.y,
            z: ballBody.position.z
        };

        // 計算拖尾寬度：越往後（索引越小）越細
        const taper = (i / TRAIL_MAX_POINTS);
        const currentWidth = baseWidth * taper;

        // 拖尾高度：稍微高於地面防止閃爍 (Z-fighting)
        const trailY = point.y - BALL_RADIUS + 0.02;

        // 設定左邊和右邊的頂點，形成帶狀 (Ribbon)
        posAttr.setXYZ(i * 2, point.x - currentWidth / 2, trailY, point.z);
        posAttr.setXYZ(i * 2 + 1, point.x + currentWidth / 2, trailY, point.z);
    }

    // 告訴 Three.js 需要重新渲染頂點
    posAttr.needsUpdate = true;
}

function spawnImpact(pos, color, count, scale = 1.0) {
    const reduceFor100Pins = (typeof targetPinCount !== 'undefined' && targetPinCount === 100);
    const mobileClient = isMobileClient();
    const particleCount = Math.max(2, Math.min(count, reduceFor100Pins || mobileClient ? 4 : count));
    const geometrySegments = mobileClient ? 3 : 4;

    for (let i = 0; i < particleCount; i++) {
        const part = new THREE.Mesh(
            new THREE.SphereGeometry(0.04 * scale, geometrySegments, geometrySegments),
            new THREE.MeshBasicMaterial({ color: color, transparent: true })
        );
        part.position.set(pos.x, pos.y, pos.z);
        const vx = (Math.random() - 0.5) * 0.1 * scale;
        const vy = Math.random() * 0.3 * scale;
        const vz = (Math.random() - 0.5) * 0.1 * scale;
        scene.add(part);
        impactParticles.push({ mesh: part, vel: new THREE.Vector3(vx, vy, vz), life: 1.0 });
    }
}

function updateImpacts() {
    for (let i = impactParticles.length - 1; i >= 0; i--) {
        const p = impactParticles[i];
        p.mesh.position.add(p.vel);
        p.vel.y -= 0.02; p.life -= 0.04;
        // For normal impacts: scale down with life
        p.mesh.scale.setScalar(Math.max(0, p.life));
        p.mesh.material.opacity = Math.max(0, p.life);
        if (p.life <= 0) { scene.remove(p.mesh); impactParticles.splice(i, 1); }
    }
}



function spawnExplosionEffect(pos, color, count, scale = 1.0) {
    // Apply physical force to nearby pins to make them fall
    const explosionRadius = 5.0 * scale; // Radius of explosion effect
    const explosionForce = 100.0 * scale; // Strength of the force

    pins.forEach(pin => {
        if (pin.body) {
            const dx = pin.body.position.x - pos.x;
            const dy = pin.body.position.y - pos.y;
            const dz = pin.body.position.z - pos.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (distance < explosionRadius && distance > 0) {
                // Calculate directional force
                const factor = explosionForce / distance;
                const force = new CANNON.Vec3(
                    (dx / distance) * factor,
                    (dy / distance) * factor,
                    (dz / distance) * factor
                );
                pin.body.applyImpulse(force, pin.body.position);
            }
        }
    });

    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            triggerDimmer(true); // Turn on

            // Turn off shortly after
            setTimeout(() => {
                triggerDimmer(false);
            }, 150);

        }, i * 50); // Triggers every 300ms
    }
}

function onTouchStart(e) {
    unlockAudio(); // Ensure audio context is initialized on first user interaction
    if (isBowling) return;
    if (isMultiplayerActive && isPlayerComplete(getLocalPlayerId()) && !isPlayerComplete(getOpponentPlayerId())) return;
    // Prevent interaction when a modal or matchmaking panel is shown
    const panel = document.getElementById('matchmaking-panel');
    const modeModal = document.getElementById('mode-select-modal');
    const eventModal = document.getElementById('event-select-modal');
    const joinPanel = document.getElementById('join-match-panel');
    const modeSwitchModal = document.getElementById('mode-switch-modal');
    if ((panel && panel.style.display === 'block') ||
        (modeModal && modeModal.style.display !== 'none') ||
        (eventModal && eventModal.style.display !== 'none') ||
        (joinPanel && joinPanel.style.display !== 'none') ||
        (modeSwitchModal && modeSwitchModal.style.display !== 'none')) {
        return;
    }
    e.preventDefault();
    isTouching = true;

    const isPlayer2 = getLocalPlayerId() === 'p2';
    if (isPlayer2) {
        touchPathPoints_P2 = [];
    } else {
        touchPathPoints_P1 = [];
    }
    // Use correct touchpath lines based on current player
    const clearPoint = [new THREE.Vector3(myPlayerOffset, 0, 0)];
    if (isPlayer2) {
        touchPathLine_P2.geometry.setFromPoints(clearPoint);
        touchPathLine2_P2.geometry.setFromPoints(clearPoint);
        touchPathLine3_P2.geometry.setFromPoints(clearPoint);
        if (outerGlowLine_P2) outerGlowLine_P2.geometry.setFromPoints(clearPoint);
        touchPathLine_P2.geometry.attributes.position.needsUpdate = true;
        touchPathLine2_P2.geometry.attributes.position.needsUpdate = true;
        touchPathLine3_P2.geometry.attributes.position.needsUpdate = true;
        if (outerGlowLine_P2) outerGlowLine_P2.geometry.attributes.position.needsUpdate = true;
    } else {
        touchPathLine_P1.geometry.setFromPoints(clearPoint);
        touchPathLine2_P1.geometry.setFromPoints(clearPoint);
        touchPathLine3_P1.geometry.setFromPoints(clearPoint);
        if (outerGlowLine_P1) outerGlowLine_P1.geometry.setFromPoints(clearPoint);
        touchPathLine_P1.geometry.attributes.position.needsUpdate = true;
        touchPathLine2_P1.geometry.attributes.position.needsUpdate = true;
        touchPathLine3_P1.geometry.attributes.position.needsUpdate = true;
        if (outerGlowLine_P1) outerGlowLine_P1.geometry.attributes.position.needsUpdate = true;
    }

    document.getElementById('hint').style.opacity = '0';
    const t = (e.touches && e.touches[0]) || e;
    touchStartPos.x = t.clientX;
    touchStartPos.y = t.clientY;
    lastTouchX = t.clientX;
    touchStartTime = Date.now();
    ballMesh.material.emissive.setHex(isPlayer2 ? 0xff3333 : 0x00ccff);
    currentPlayerTouchPoints = isPlayer2 ? touchPathPoints_P2 : touchPathPoints_P1;
}

function onTouchMove(e) {
    if (isBowling || !isTouching) return;
    const t = (e.touches && e.touches[0]) || e;

    const deltaX_Movement = (t.clientX - lastTouchX) * 0.015;

    const movementLimit = (targetPinCount === 100) ? 3.0 : 1.5;
    ballBody.position.x = Math.max(myPlayerOffset - movementLimit, Math.min(myPlayerOffset + movementLimit, ballBody.position.x + deltaX_Movement));
    lastTouchX = t.clientX;

    const mouseNDC = new THREE.Vector2(
        (t.clientX / window.innerWidth) * 2 - 1,
        -(t.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouseNDC, camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15);
    const pos = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, pos);
    if (!pos) return;

    const MAX_PATH_POINTS = 100;
    const isPlayer2 = getLocalPlayerId() === 'p2';

    const laneLimit = (targetPinCount === 100) ? 3.0 : 1.5;
    pos.x = Math.max(myPlayerOffset - laneLimit, Math.min(myPlayerOffset + laneLimit, pos.x));

    // Use the current player's touchpath array
    currentPlayerTouchPoints.push(pos);
    if (currentPlayerTouchPoints.length > MAX_PATH_POINTS) currentPlayerTouchPoints.shift();

    // Create offset point arrays for visual effect
    const offsetPoints_pos = currentPlayerTouchPoints.map(p => {
        const offsetPos = p.clone();
        offsetPos.x += 0.02;
        return offsetPos;
    });
    const offsetPoints_neg = currentPlayerTouchPoints.map(p => {
        const offsetPos = p.clone();
        offsetPos.x -= 0.02;
        return offsetPos;
    });

    if (isPlayer2) {
        touchPathLine_P2.geometry.setFromPoints(currentPlayerTouchPoints);
        touchPathLine2_P2.geometry.setFromPoints(offsetPoints_pos);
        touchPathLine3_P2.geometry.setFromPoints(offsetPoints_neg);
        if (outerGlowLine_P2) outerGlowLine_P2.geometry.setFromPoints(currentPlayerTouchPoints);
        touchPathLine_P2.geometry.attributes.position.needsUpdate = true;
        touchPathLine2_P2.geometry.attributes.position.needsUpdate = true;
        touchPathLine3_P2.geometry.attributes.position.needsUpdate = true;
        if (outerGlowLine_P2) outerGlowLine_P2.geometry.attributes.position.needsUpdate = true;
    } else {
        touchPathLine_P1.geometry.setFromPoints(currentPlayerTouchPoints);
        touchPathLine2_P1.geometry.setFromPoints(offsetPoints_pos);
        touchPathLine3_P1.geometry.setFromPoints(offsetPoints_neg);
        if (outerGlowLine_P1) outerGlowLine_P1.geometry.setFromPoints(currentPlayerTouchPoints);
        touchPathLine_P1.geometry.attributes.position.needsUpdate = true;
        touchPathLine2_P1.geometry.attributes.position.needsUpdate = true;
        touchPathLine3_P1.geometry.attributes.position.needsUpdate = true;
        if (outerGlowLine_P1) outerGlowLine_P1.geometry.attributes.position.needsUpdate = true;
    }
}

function onTouchEnd(e) {
    if (isBowling || !isTouching) return;
    e.preventDefault();
    isTouching = false;

    const t = (e.changedTouches && e.changedTouches[0]) || e;
    const deltaX = t.clientX - touchStartPos.x;
    const deltaY = touchStartPos.y - t.clientY;
    const duration = Date.now() - touchStartTime;

    ballMesh.material.emissive.setHex(0x003366);

    if (deltaY > 20) {
        let speedScale = (deltaY / Math.max(duration, 5)) * 25;
        let forwardSpeed = Math.max(25, Math.min(speedScale, 65)) * chaosModifiers.ballSpeedMult; let sideSpeed = deltaX * 0.05;
        randomHookForce = (Math.random() - 0.5) * 5;
        throwBall(forwardSpeed, sideSpeed);
    } else {
        document.getElementById('hint').style.opacity = '1';
    }

    // Clear appropriate touchpath lines for current player
    const isPlayer2 = getLocalPlayerId() === 'p2';
    if (isPlayer2) {
        touchPathPoints_P2 = [];
        currentPlayerTouchPoints = touchPathPoints_P2;
        touchPathLine_P2.geometry.setFromPoints([new THREE.Vector3(0, 0, 0)]);
        touchPathLine2_P2.geometry.setFromPoints([new THREE.Vector3(0, 0, 0)]);
        touchPathLine3_P2.geometry.setFromPoints([new THREE.Vector3(0, 0, 0)]);
        touchPathLine_P2.geometry.attributes.position.needsUpdate = true;
        touchPathLine2_P2.geometry.attributes.position.needsUpdate = true;
        touchPathLine3_P2.geometry.attributes.position.needsUpdate = true;
    } else {
        touchPathPoints_P1 = [];
        currentPlayerTouchPoints = touchPathPoints_P1;
        touchPathLine_P1.geometry.setFromPoints([new THREE.Vector3(0, 0, 0)]);
        touchPathLine2_P1.geometry.setFromPoints([new THREE.Vector3(0, 0, 0)]);
        touchPathLine3_P1.geometry.setFromPoints([new THREE.Vector3(0, 0, 0)]);
        touchPathLine_P1.geometry.attributes.position.needsUpdate = true;
        touchPathLine2_P1.geometry.attributes.position.needsUpdate = true;
        touchPathLine3_P1.geometry.attributes.position.needsUpdate = true;
    }
}

function arePinsSettled() {
    const is100 = (targetPinCount === 100);
    const laneMargin = is100 ? 3.8 : 2.5;
    const playerPins = pins.filter(p =>
        Math.abs(p.initialPos.x - myPlayerOffset) < laneMargin
    );
    const ballSpeed = ballBody ? ballBody.velocity.length() : 0;
    const maxPinSpeed = is100 ? 0.08 : 0.14;
    const maxAngSpeed = is100 ? 0.08 : 0.14;
    const maxPinHeight = LANE_Y + 0.75;

    if (ballSpeed > (is100 ? 0.08 : 0.15)) return false;

    return playerPins.every(p => {
        const pinSpeed = p.body.velocity.length();
        const angSpeed = p.body.angularVelocity.length();
        const pinHeight = p.body.position.y;
        return pinSpeed <= maxPinSpeed && angSpeed <= maxAngSpeed && pinHeight <= maxPinHeight;
    });
}

function checkPinsStability() {
    const is100 = (targetPinCount === 100);
    const maxWait = is100 ? 10000 : 5000;
    const now = performance.now();
    const settled = arePinsSettled();

    if (settled) {
        if (!pinSettleStableSince) {
            pinSettleStableSince = now;
        }
        if (now - pinSettleStableSince >= 1000) {
            checkPins();
            return;
        }
    } else {
        pinSettleStableSince = 0;
    }

    if (now - pinSettleStartTime >= maxWait) {
        checkPins();
        return;
    }

    resetTimer = setTimeout(checkPinsStability, 500);
}

// ============================================
// BALL PHYSICS AND THROWING
// ============================================

// Initiates ball throw with physics simulation
// Handles different ball masses and physics for 10-pin vs 100-pin modes
// Sets up velocity, spin, and collision detection timers
function throwBall(speed, sideSpeed = 0) {
    isBowling = true;
    document.getElementById('hint').style.opacity = '0';

    const baseMass = (targetPinCount === 100) ? 680 : 500;
    const ballMass = baseMass * (typeof chaosModifiers !== 'undefined' && chaosModifiers.ballMassMult ? chaosModifiers.ballMassMult : 1.0);
    ballBody.mass = ballMass;
    ballBody.type = CANNON.Body.DYNAMIC;
    ballBody.updateMassProperties();
    ballBody.allowSleep = false;
    if (typeof ballBody.wakeUp === 'function') ballBody.wakeUp();

    const forwardFactor = (targetPinCount === 100) ? 1.1 : 0.9;
    const spinFactor = (targetPinCount === 100) ? 1.0 : 0.8;
    ballBody.velocity.set(sideSpeed, 0, -speed * forwardFactor);
    ballBody.angularVelocity.set(speed * spinFactor, randomHookForce * 2, (Math.random() - 0.5) * 15);

    pinSettleStartTime = performance.now();
    pinSettleStableSince = 0;
    resetTimer = setTimeout(checkPinsStability, (targetPinCount === 100) ? 3000 : 1000);
    playGameSound('ball_down');
}

// ============================================
// PIN SCORING AND COLLISION DETECTION
// ============================================

// Analyzes pin positions after ball throw to determine score
// Checks distance from initial position and tilt angle to count fallen pins
// Updates visual indicators and calculates final score for the frame
function checkPins() {
    let fallen = 0;
    const SCORE_RADIUS = 0.22;
    const is100 = (targetPinCount === 100);
    const laneMargin = is100 ? 3.8 : 2.5; // Half lane width plus margin

    // Only count pins in the current player's lane
    const playerPins = pins.filter(p =>
        Math.abs(p.initialPos.x - myPlayerOffset) < laneMargin
    );
    const totalPinsInPlay = playerPins.length;

    playerPins.forEach((p, index) => {
        const dx = p.body.position.x - p.initialPos.x;
        const dz = p.body.position.z - p.initialPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const up = new CANNON.Vec3(0, 1, 0);
        const pinUp = p.body.quaternion.vmult(up);
        const angle = Math.acos(up.dot(pinUp));

        if (distance > SCORE_RADIUS || angle > 0.78 || p.body.position.y < -0.5) {
            fallen++;
            const originalIndex = pins.indexOf(p);
            if (pinCircles[originalIndex]) pinCircles[originalIndex].material.color.setHex(0x2ecc71);
        } else {
            const originalIndex = pins.indexOf(p);
            if (pinCircles[originalIndex]) pinCircles[originalIndex].material.color.setHex(0xe74c3c);
        }
    });

    playGameSound('ball_roll');

    currentFallenPins = fallen;
    document.getElementById('score-text').innerText = t('pinsLabel') + fallen + '/' + totalPinsInPlay;

    let scoreToRecord = fallen;
    const lastIndex = matchHistory.length - 1;
    if (fallen === totalPinsInPlay) {
        let consecutiveStrikes = 1;
        for (let i = lastIndex; i >= 0; i--) {
            if (matchHistory[i] >= totalPinsInPlay) consecutiveStrikes++;
            else break;
        }
        scoreToRecord = totalPinsInPlay * consecutiveStrikes;
    }

    if (!isFreeplayMode) {
        matchHistory.push(scoreToRecord);
    }
    recordRoundScore(scoreToRecord);


    const msgBox = document.getElementById('msg-box');
    const replayBtn = document.getElementById('watch-replay-btn');
    const title = document.getElementById('msg-title');
    const body = document.getElementById('msg-body');
    const btn = document.getElementById('action-btn');

    if (fallen === totalPinsInPlay) {
        playerPins.forEach(p => {
            const blastForce = 15;
            const direction = p.body.position.clone().vsub(new CANNON.Vec3(myPlayerOffset, 0, -22));
            direction.normalize();
            p.body.applyImpulse(direction.scale(blastForce), p.body.position);
        });

        const strikePopup = document.getElementById('strike-popup');
        const actionBtn = document.getElementById('action-btn');

        // Disable button during strike animation
        if (actionBtn) {
            actionBtn.disabled = true;
            actionBtn.style.opacity = '0.5';
            actionBtn.style.cursor = 'not-allowed';
        }

        strikePopup.classList.add('show');
        triggerDimmer(true);
        spawnImpact(new CANNON.Vec3(myPlayerOffset, 1, -22), 0xf1c40f, 60, 4.0);

        setTimeout(() => {
            strikePopup.classList.remove('show');
            triggerDimmer(false);
            showResultMenu();

            // Enable button after animation completes
            if (actionBtn) {
                actionBtn.disabled = false;
                actionBtn.style.opacity = '1';
                actionBtn.style.cursor = 'pointer';
            }
        }, 2000);
    } else {
        showResultMenu();
    }
}

function showResultMenu() {
    const msgBox = document.getElementById('msg-box');
    const replayBtn = document.getElementById('watch-replay-btn');
    const title = document.getElementById('msg-title');
    const body = document.getElementById('msg-body');
    const btn = document.getElementById('action-btn');
    const existingFreeplayBtn = document.getElementById('temp-freeplay-btn');
    if (existingFreeplayBtn) existingFreeplayBtn.remove();

    if (isMultiplayerActive) {
        const localDone = isPlayerComplete(getLocalPlayerId());
        const opponentDone = isPlayerComplete(getOpponentPlayerId());
        if (localDone && opponentDone) {
            showMultiplayerFinalResult();
            return;
        }
        if (localDone) {
            showMultiplayerWaitMessage(true);
            return;
        }
        if (opponentDone) {
            showMultiplayerWaitMessage(false);
            return;
        }
        // Neither done, show result message
    }

    if (!msgBox || !replayBtn || !title || !body || !btn) {
        return;
    }

    const playerPins = pins.filter(p => Math.abs(p.initialPos.x - myPlayerOffset) < ((targetPinCount === 100) ? 3.8 : 2.5));
    const totalPinsInPlay = playerPins.length;
    const fallen = currentFallenPins;

    msgBox.style.display = 'block';
    replayBtn.style.display = 'block';

    if (fallen !== totalPinsInPlay) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }

    if (matchHistory.length >= MAX_MATCHES) {
        if (!isMultiplayerActive) {
            title.innerText = t('finalScore');
            let total = matchHistory.reduce((a, b) => a + b, 0);
            body.innerText = `本局擊倒 ${fallen} 瓶。\n總分：${total}`;
            btn.innerText = "重新開始";
            btn.onclick = fullReset;

            if (isChaosMode && !isFreeplayMode) {
                const freeplayBtn = document.createElement('button');
                freeplayBtn.className = 'btn';
                freeplayBtn.id = 'temp-freeplay-btn';
                freeplayBtn.innerText = "無計分暢玩 (Freeplay)";
                freeplayBtn.style.background = "#2ecc71";
                freeplayBtn.style.marginTop = "10px";
                freeplayBtn.onclick = () => {
                    isFreeplayMode = true;
                    matchHistory = [];
                    scores = { p1: [], p2: [] };
                    updateScoreTable();
                    msgBox.style.display = 'none';
                    promptEventSelection();
                };
                msgBox.appendChild(freeplayBtn);
            }
        }
    } else if (isChaosMode && !isFreeplayMode) {
        title.innerText = (fallen === totalPinsInPlay) ? t('msgTitleStrike') : t('msgTitleEnd');
        body.innerText = t('knocked', fallen, totalPinsInPlay);
        btn.innerText = "選擇下一個能力";
        btn.onclick = () => {
            msgBox.style.display = 'none';
            promptEventSelection();
        };
    } else {
        title.innerText = (fallen === totalPinsInPlay) ? t('msgTitleStrike') : t('msgTitleEnd');
        body.innerText = t('knocked', fallen, totalPinsInPlay);
        btn.innerText = t('nextFrame');
        btn.onclick = handleMatchEnd;
    }
}


function handleMatchEnd() {
    // Safety check: prevent execution if button is disabled
    const actionBtn = document.getElementById('action-btn');
    if (actionBtn && actionBtn.disabled) return;

    if (matchHistory.length >= MAX_MATCHES) {
        fullReset();
    } else {
        recordAndReset();
    }
}

function recordAndReset() {
    resetGame();
}

// ============================================
// REPLAY SYSTEM
// ============================================

// Starts replay playback of recorded ball trajectory and pin movements
// Switches camera to follow the ball path from recorded frame data
function startReplay() {
    if (replayData.length === 0) return;
    playGameSound('ui_click');

    isReplaying = true;
    replayFrameIndex = 0;

    document.getElementById('msg-box').style.display = 'none';

    const replayBtn = document.getElementById('watch-replay-btn');
    replayBtn.innerText = "取消重播";
    replayBtn.onclick = stopReplay;
}

// Stops replay playback and returns to normal game view
// Resets camera position and restores game UI state
function stopReplay() {
    isReplaying = false;
    playGameSound('ui_click');

    document.getElementById('msg-box').style.display = 'block';

    const replayBtn = document.getElementById('watch-replay-btn');
    replayBtn.innerText = "觀看回放";
    replayBtn.onclick = startReplay;

    camera.lookAt(myPlayerOffset, 0, 0);
}

// ============================================
// GAME RESET AND STATE MANAGEMENT
// ============================================

// Completely resets all game state for a new match
// Clears scores, match history, and multiplayer flags
// Updates UI and syncs state with Firebase if in multiplayer mode
function fullReset() {
    // Reset chaos mode completely
    if (typeof window !== 'undefined' && typeof window.isChaosMode !== 'undefined') {
        window.isChaosMode = false;
    }
    if (typeof resetChaosState === 'function') {
        resetChaosState();
    }
    
    matchHistory = [];
    scores = { p1: [], p2: [] };
    hasShownLocalCompleteMessage = false;
    hasShownOpponentCompleteMessage = false;
    hasRecordedScoreInCurrentGame = false;
    const msgBox = document.getElementById('msg-box');
    if (msgBox) {
        msgBox.style.display = 'none';
        const body = document.getElementById('msg-body');
        if (body) body.innerText = '';
    }
    updateScoreTable();
    if (!isMultiplayerActive) {
        resetSinglePlayerUI();
        // Show singleplayer mode selection
        startSinglePlayer();
    }
    if (isMultiplayerActive && matchRef) {
        matchRef.child('scores').set(scores).catch((err) => {
        });
    }
    resetGame();
}

function updateScoreTable(player) {
    if (!player) {
        updateScoreTable('p1');
        updateScoreTable('p2');
        return;
    }
    if (!scores[player]) scores[player] = [];

    const history = scores[player];
    let total = 0;

    for (let i = 0; i < MAX_MATCHES; i++) {
        const cell = document.getElementById(`${player}-m${i}`);
        if (cell) {
            if (history[i] !== undefined) {
                cell.innerText = history[i];
                total += history[i];
                cell.style.background = "rgba(255, 255, 255, 0.2)";
            } else {
                cell.innerText = "-";
                cell.style.background = "rgba(255, 255, 255, 0.05)";
            }
        }
    }

    const totalCell = document.getElementById(`${player}-total`);
    if (totalCell) {
        totalCell.innerText = total;
    }
}

// ============================================
// GAME STATE RESET
// ============================================

// Reset all game state variables and UI elements for a new frame/turn
// Clears physics state, touch paths, camera position, and prepares for next throw
function resetGame() {
    isBowling = false;
    randomHookForce = 0;
    currentFallenPins = 0;
    impactOccurred = false;
    isCinematicMode = false;
    cinematicTargetPin = null;
    timeScale = 1.0;

    replayData = [];
    isReplaying = false;

    touchPathPoints_P1 = [];
    touchPathPoints_P2 = [];
    currentPlayerTouchPoints = getLocalPlayerId() === 'p2' ? touchPathPoints_P2 : touchPathPoints_P1;
    const clearPoint = [new THREE.Vector3(myPlayerOffset, 0, 0)];
    // Clear appropriate player's touchpath
    const isPlayer2 = getLocalPlayerId() === 'p2';
    if (isPlayer2) {
        [touchPathLine_P2, touchPathLine2_P2, touchPathLine3_P2, outerGlowLine_P2].forEach(line => {
            if (line && line.geometry) {
                line.geometry.setFromPoints(clearPoint);
                line.geometry.attributes.position.needsUpdate = true;
            }
        });
    } else {
        [touchPathLine_P1, touchPathLine2_P1, touchPathLine3_P1, outerGlowLine_P1].forEach(line => {
            if (line && line.geometry) {
                line.geometry.setFromPoints(clearPoint);
                line.geometry.attributes.position.needsUpdate = true;
            }
        });
    }

    actionTargetPin = null;
    lastTargetSwitchTime = 0;

    camera.position.set(myPlayerOffset, 4, 12);
    camera.lookAt(myPlayerOffset, 1, -5);

    // Reset camera look target for current player offset
    if (typeof cameraLookAtTarget !== 'undefined' && cameraLookAtTarget) {
        cameraLookAtTarget.set(myPlayerOffset, 1, 0);
    }

    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = null;

    triggerDimmer(false);

    const strikePopup = document.getElementById('strike-popup');
    if (strikePopup) {
        strikePopup.innerText = 'STRIKE!';
        strikePopup.classList.remove('show');
    }

    document.getElementById('score-text').innerText = t('scoreText') + '0';
    document.getElementById('msg-box').style.display = 'none';
    const tempFreeplayBtn = document.getElementById('temp-freeplay-btn');
    if (tempFreeplayBtn) tempFreeplayBtn.remove();
    document.getElementById('hint').style.opacity = '1';
    document.getElementById('watch-replay-btn').style.display = 'none';

    ballBody.type = CANNON.Body.STATIC;
    ballBody.mass = 0;
    ballBody.updateMassProperties();
    ballBody.allowSleep = false;
    if (typeof ballBody.wakeUp === 'function') ballBody.wakeUp();
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballBody.force.set(0, 0, 0);
    ballBody.torque.set(0, 0, 0);
    ballBody.position.set(myPlayerOffset, LANE_Y + BALL_RADIUS * chaosModifiers.ballSizeMult + 0.05, 5);
    ballBody.quaternion.set(0, 0, 0, 1);

    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    trailHistory = [];
    if (trailMesh_P1) trailMesh_P1.visible = false;
    if (trailMesh_P2) trailMesh_P2.visible = false;

    stopAllGameSounds();

    // Properly dispose of pin meshes and bodies
    pins.forEach(p => {
        scene.remove(p.mesh);
        world.removeBody(p.body);

        // Dispose GPU memory for mesh and its children
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        if (p.mesh.material) p.mesh.material.dispose();

        // Dispose children (pin body parts: white, black stripe, red line)
        p.mesh.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    });
    pins = [];

    // Dispose pin circle outlines
    pinCircles.forEach(circle => {
        scene.remove(circle);
        if (circle.geometry) circle.geometry.dispose();
        if (circle.material) circle.material.dispose();
    });
    pinCircles = [];

    // Dispose opponent ghost pins
    opponentGhostPins.forEach(pin => {
        scene.remove(pin);
        if (pin.geometry) pin.geometry.dispose();
        if (pin.material) pin.material.dispose();
    });
    opponentGhostPins = [];

    createPins(myPlayerOffset);
    if (isMultiplayerActive) {
        const offsetDistance = (targetPinCount === 100) ? offsetDistance100 : offsetDistance10;
        const remoteOffset = isHost ? offsetDistance : 0;
        if (targetPinCount !== 100) {
            createGhostPins(remoteOffset);
        }
    }

    if (leftWallMesh) leftWallMesh.visible = true;
    if (rightWallMesh) rightWallMesh.visible = true;

    document.getElementById('action-cam-container').style.display = 'none';
}

function stopAllGameSounds() {
    if (typeof sounds !== 'undefined' && sounds) {
        Object.values(sounds).forEach(sound => {
            if (sound && sound.isPlaying) sound.stop();
        });
    }
    if (typeof gameSounds !== 'undefined' && gameSounds) {
        Object.values(gameSounds).forEach(sound => {
            if (sound && sound.isPlaying) sound.stop();
        });
    }
    if (ballPathSound && ballPathSound.isPlaying) ballPathSound.stop();
    if (pinKnockSound && pinKnockSound.isPlaying) pinKnockSound.stop();
}

let audioCtx; // Declare audioCtx, will be created after user gesture
let audioContextResuming = false; // Track if audio context is currently resuming

function playGameSound(soundName) {
    if (!audioCtx) return; // Wait for audio context to be initialized
    const sound = sounds[soundName];
    if (sound && sound.buffer) {
        if (audioCtx.state === 'suspended' && !audioContextResuming) {
            audioContextResuming = true;
            audioCtx.resume().then(() => {
                audioContextResuming = false;
                if (!sound.isPlaying) sound.play();
            });
        } else if (audioCtx.state !== 'suspended') {
            if (sound.isPlaying) sound.stop();
            sound.play();
        }
    }
}

let audioContextStarted = false;
function unlockAudio() {
    if (audioContextStarted) return;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            audioContextStarted = true;
        });
    } else {
        audioContextStarted = true;
    }
}

window.addEventListener('click', unlockAudio);
window.addEventListener('touchstart', unlockAudio);

let actionCamInitialized = false; // Add this global variable at the top of your script

function updateActionCam() {
    if (!isBowling) {
        document.getElementById('action-cam-container').style.display = 'none';
        actionTargetPin = null;
        actionCamInitialized = false; // Reset for the next throw
        return;
    }

    document.getElementById('action-cam-container').style.display = 'block';
    const currentTime = performance.now();

    if (!impactOccurred) {
        const ballPos = ballMesh.position;
        const targetPos = new THREE.Vector3(ballPos.x + 1.2, 0.6, ballPos.z + 3);
        const lookAtTarget = new THREE.Vector3(ballPos.x, 0.4, ballPos.z - 2);

        // FIX: If this is the first frame of the throw, snap the camera 
        // immediately so it doesn't "fly" from the center of the world.
        if (!actionCamInitialized) {
            actionCamera.position.copy(targetPos);
            actionCamera.lookAt(lookAtTarget);
            actionCamInitialized = true;
        } else {
            actionCamera.position.lerp(targetPos, 0.1);
            actionCamera.lookAt(lookAtTarget);
        }
    } else {
        // --- Impact Logic ---
        let bestPin = null;
        let highestPriority = -1;
        const is100 = (targetPinCount === 100);
        const gutterLimit = is100 ? 3.8 : 2.25;

        pins.forEach(p => {
            const v = p.body.velocity.length();
            const isOnLane = p.body.position.y > 0.1 && Math.abs(p.body.position.x - myPlayerOffset) < gutterLimit;

            if (isOnLane && v > 0.8) {
                const distFromCenter = Math.sqrt(
                    Math.pow(p.body.position.x - myPlayerOffset, 2) + Math.pow(p.body.position.z - DECK_CENTER_Z, 2)
                );
                const priority = v / (distFromCenter + 1);
                if (priority > highestPriority) {
                    highestPriority = priority;
                    bestPin = p;
                }
            }
        });

        // Clear target if it falls or goes out of bounds
        if (actionTargetPin) {
            const targetIsFallen = actionTargetPin.body.position.y < 0.1 ||
                Math.abs(actionTargetPin.body.position.x - myPlayerOffset) > gutterLimit;
            if (targetIsFallen) {
                actionTargetPin = null;
            }
        }

        // Switch targets with cooldown
        if (!actionTargetPin || (currentTime - lastTargetSwitchTime > SWITCH_COOLDOWN)) {
            if (bestPin && bestPin !== actionTargetPin) {
                actionTargetPin = bestPin;
                lastTargetSwitchTime = currentTime;
            }
        }

        if (actionTargetPin) {
            const offsetX = is100 ? 3.2 : 1.8;
            const offsetY = is100 ? 2.5 : 1.3;
            const offsetZ = is100 ? 5.5 : 2.5;

            let targetX = actionTargetPin.mesh.position.x + offsetX;
            const targetY = offsetY;
            const targetZ = actionTargetPin.mesh.position.z + offsetZ;

            const currentLaneWidth = is100 ? 7.6 : 4.5;
            const safetyMargin = 0.8;
            const maxX = (currentLaneWidth / 2) - safetyMargin;

            // Clamp to player's lane bounds
            targetX = Math.max(myPlayerOffset - maxX, Math.min(myPlayerOffset + maxX, targetX));

            const targetCamPos = new THREE.Vector3(targetX, targetY, targetZ);
            actionCamera.position.lerp(targetCamPos, 0.04);
            actionCamera.lookAt(actionTargetPin.mesh.position);
        } else {
            // Fallback view of the deck
            const fallbackPos = new THREE.Vector3(myPlayerOffset, is100 ? 4 : 2, DECK_CENTER_Z + 5);
            actionCamera.position.lerp(fallbackPos, 0.02);
            actionCamera.lookAt(myPlayerOffset, 0, DECK_CENTER_Z);
        }
    }

    // Ensure the small window renderer actually renders the frame
    actionRenderer.render(scene, actionCamera);
}

// ============================================
// MAIN ANIMATION LOOP
// ============================================

// Main game loop that runs every frame
// Handles physics simulation, rendering, and multiplayer synchronization
function animate() {
    requestAnimationFrame(animate);

    if (world && !isReplaying) {
        const currentScale = (typeof timeScale !== 'undefined') ? timeScale : 1;
        world.step(1 / 60 * currentScale);
    }

    const currentOffset = (typeof myPlayerOffset !== 'undefined') ? myPlayerOffset : 0;

    if (typeof sunLight !== 'undefined' && sunLight) {
        sunLight.position.x = currentOffset + 15;
    }

    if (ballMesh && ballBody) {
        if (!isReplaying) {
            ballMesh.position.copy(ballBody.position);
            ballMesh.quaternion.copy(ballBody.quaternion);

            if (isMultiplayerActive && matchRef) {
                ballSyncCounter += 1;
                if (ballSyncCounter % 3 === 0) {
                    const activeBall = isBowling || ballBody.velocity.length() > 0.04;
                    matchRef.child('ballUpdate').set({
                        active: activeBall,
                        pos: { x: ballBody.position.x, y: ballBody.position.y, z: ballBody.position.z },
                        quat: { x: ballBody.quaternion.x, y: ballBody.quaternion.y, z: ballBody.quaternion.z, w: ballBody.quaternion.w },
                        from: getLocalPlayerId(),
                        timestamp: Date.now()
                    }).catch((err) => {
                    });
                }

                if (ballSyncCounter % 3 === 0 && pins.length > 0) {
                    const pinPayload = pins.map(p => ({
                        pos: {
                            x: p.body.position.x,
                            y: p.body.position.y,
                            z: p.body.position.z
                        },
                        quat: {
                            x: p.body.quaternion.x,
                            y: p.body.quaternion.y,
                            z: p.body.quaternion.z,
                            w: p.body.quaternion.w
                        }
                    }));
                    matchRef.child('pinUpdate').set({
                        from: getLocalPlayerId(),
                        timestamp: Date.now(),
                        pins: pinPayload
                    }).catch((err) => {
                    });
                }
            }

            if (pins && pins.length > 0) {
                pins.forEach(p => {
                    if (p.mesh && p.body) {
                        p.mesh.position.copy(p.body.position);
                        p.mesh.quaternion.copy(p.body.quaternion);
                    }
                });
            }

            // REPLAY RECORDING: Capture frame data during gameplay
            if (isBowling && replayData.length < 900) {
                replayData.push({
                    ball: {
                        pos: ballBody.position.clone(),
                        quat: ballBody.quaternion.clone()
                    },
                    pins: pins.map(p => ({
                        pos: p.body.position.clone(),
                        quat: p.body.quaternion.clone()
                    }))
                });
            }
        } else {
            if (typeof replayFrameIndex !== 'undefined' && replayData && replayFrameIndex < replayData.length) {
                const frame = replayData[replayFrameIndex];
                ballMesh.position.copy(frame.ball.pos);
                ballMesh.quaternion.copy(frame.ball.quat);
                pins.forEach((p, i) => {
                    if (frame.pins[i]) {
                        p.mesh.position.copy(frame.pins[i].pos);
                        p.mesh.quaternion.copy(frame.pins[i].quat);
                    }
                });
                replayFrameIndex++;
            } else if (typeof stopReplay === 'function') {
                stopReplay();
            }
        }
    }

    // --- Sound Logic: Play rolling sound only when ball is on lane ---
    if (isBowling && typeof ballPathSound !== 'undefined' && ballPathSound && ballPathSound.buffer) {
        const { x, y, z } = ballBody.position;
        const is100 = (typeof targetPinCount !== 'undefined' && targetPinCount === 100);
        const laneMargin = is100 ? 3.8 : 2.25; // Lane width
        const currentBallRadius = typeof window.currentBallRadius !== 'undefined' ? window.currentBallRadius : BALL_RADIUS;

        // Check conditions for playing sound
        const isOnLane = Math.abs(x - currentOffset) < laneMargin; // Ball within lane x bounds
        const isTouchingFloor = y < (LANE_Y + currentBallRadius + 0.4) && y > (LANE_Y + currentBallRadius - 0.3); // Ball near floor (dynamic for scaled ball)
        const isBeforeBackdrop = z > -65; // Ball hasn't hit backdrop
        const isMoving = ballBody.velocity.length() > 0.15; // Ball is actually moving

        if (isOnLane && isTouchingFloor && isBeforeBackdrop && isMoving) {
            // Play sound if not already playing
            if (!ballPathSound.isPlaying) {
                ballPathSound.play();
            }
        } else {
            // Mute sound: ball in air, off lane, or at backdrop
            if (ballPathSound.isPlaying) {
                ballPathSound.stop();
            }
        }
    }

    if (camera) {
        if (typeof isBowling !== 'undefined' && isBowling) {
            const isPortrait = window.innerHeight > window.innerWidth;
            const pinAreaZ = -22;
            const is100 = (typeof targetPinCount !== 'undefined' && targetPinCount === 100);
            const currentOffset = (typeof myPlayerOffset !== 'undefined') ? myPlayerOffset : 0;

            let desiredPosition = new THREE.Vector3();
            let desiredLookAt = new THREE.Vector3();

            if (typeof isCinematicMode !== 'undefined' && isCinematicMode) {
                // Cinematic slow-motion view
                const yOffset = is100 ? (isPortrait ? 7.5 : 4.5) : (isPortrait ? 5.5 : 3.5);
                const zOffset = is100 ? (isPortrait ? 10 : 7) : (isPortrait ? 9 : 6);
                const lookZ = is100 ? pinAreaZ - 4 : pinAreaZ;
                desiredPosition.set(currentOffset, yOffset, pinAreaZ + zOffset);
                desiredLookAt.set(currentOffset, 0.5, lookZ);
            }
            else if (typeof impactOccurred !== 'undefined' && impactOccurred) {
                // Fixed camera focused on pins after impact
                const lookZ = is100 ? -26 : -24;
                const camY = is100 ? 6 : 5;
                const camZ = is100 ? -12 : -14;
                desiredPosition.set(currentOffset, camY, camZ);
                desiredLookAt.set(currentOffset, 1, lookZ);
            }
            else if (ballBody) {
                // Follow the ball during throw
                const camY = is100 ? 5.5 : 4;
                const targetZ = Math.max(ballBody.position.z + 8, -12);
                // Keep camera in player's lane, slightly offset for viewing angle
                const camOffsetX = currentOffset + (ballBody.position.x - currentOffset) * 0.3;
                desiredPosition.set(camOffsetX, camY, targetZ);
                desiredLookAt.set(ballBody.position.x, 1, ballBody.position.z - 10);
            }

            if (typeof cameraLookAtTarget !== 'undefined' && cameraLookAtTarget) {
                camera.position.lerp(desiredPosition, 0.04);
                cameraLookAtTarget.lerp(desiredLookAt, 0.04);
                camera.lookAt(cameraLookAtTarget);
            } else {
                // Fallback if cameraLookAtTarget is not initialized
                camera.position.lerp(desiredPosition, 0.04);
                camera.lookAt(desiredLookAt);
            }
        } else {
            // Idle/Menu camera
            const currentOffset = (typeof myPlayerOffset !== 'undefined') ? myPlayerOffset : 0;
            camera.position.lerp(new THREE.Vector3(currentOffset, 4, 12), 0.05);
            camera.lookAt(currentOffset, 1, 0);
        }
    }

    if (typeof updateActionCam === 'function') updateActionCam();
    if (typeof updateLightTrail === 'function') updateLightTrail();
    if (typeof updateImpacts === 'function') updateImpacts();

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = () => {
    init();

    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');

    if (roomId) {
        setTimeout(() => {
            window.db.goOnline();
            joinGame(roomId);
        }, 1000);
    }
};
