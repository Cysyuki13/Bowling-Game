// events.js

// Global state for Chaos Mode
let isChaosMode = false;
let activeChaosEvents = [];
let usedChaosEventIds = [];
let isFreeplayMode = false;

// Multipliers and flags modified by events
let chaosModifiers = {
    ballSizeMult: 1,
    ballSpeedMult: 1,
    ballMassMult: 1,
    isExplosive: false
};

const ChaosEventLibrary = [
    // Base events - tiers will be applied dynamically
    {
        id: 'giant_ball',
        name: '巨人 (Giant Ball)',
        description: '巨人效果.',
        tier: 'prismatic',
        baseMultiplier: 1.5,
        baseMassMultiplier: 10.0,
        apply: function(tierMultiplier = 1) {
            chaosModifiers.ballSizeMult *= this.baseMultiplier * tierMultiplier;
            chaosModifiers.ballMassMult *= this.baseMassMultiplier * tierMultiplier;
            if (ballMesh) ballMesh.scale.setScalar(chaosModifiers.ballSizeMult);
            if (ballBody && ballBody.shapes.length > 0) {
                ballBody.shapes[0].radius = BALL_RADIUS * chaosModifiers.ballSizeMult;
                ballBody.shapes[0].updateBoundingSphereRadius();
                ballBody.updateBoundingRadius();
                ballBody.position.y = LANE_Y + BALL_RADIUS * chaosModifiers.ballSizeMult + 0.05;
                if (ballMesh) ballMesh.position.copy(ballBody.position);
            }
            window.currentBallRadius = BALL_RADIUS * chaosModifiers.ballSizeMult;
        }
    },

    {
        id: 'super_speed',
        name: '神速 (Super Speed)',
        description: '神速效果.',
        tier: 'silver',
        baseMultiplier: 1.5,
        apply: function(tierMultiplier = 1) {
            chaosModifiers.ballSpeedMult *= this.baseMultiplier * tierMultiplier;
        }
    },
    {
        id: 'explosive_ball',
        name: 'TNT球 (Explosive Ball)',
        description: 'TNT爆炸效果.',
        tier: 'gold',
        apply: () => {
            chaosModifiers.isExplosive = true;
        }
    }
];

// Tier configuration
const TIER_CONFIG = {
    silver: { multiplier: 1.0, color: '#c0c0c0', nameSuffix: '銀色' },
    gold: { multiplier: 1.5, color: '#ffd700', nameSuffix: '黃金' },
    prismatic: { multiplier: 2.0, color: '#ff00ff', nameSuffix: '棱鏡' }
};

// Get 3 fixed tier chaos events from library
function getTieredChaosEvents() {
    const availableEvents = ChaosEventLibrary.filter(e => !usedChaosEventIds.includes(e.id));
    const shuffled = availableEvents.slice().sort(() => 0.5 - Math.random());
    const selectedBaseEvents = shuffled.slice(0, 3);
    
    return selectedBaseEvents.map(baseEvent => ({
        ...baseEvent,
        tierColor: TIER_CONFIG[baseEvent.tier].color,
        displayName: `${baseEvent.name} [${TIER_CONFIG[baseEvent.tier].nameSuffix}]`,
        displayDescription: `${baseEvent.description} (x${TIER_CONFIG[baseEvent.tier].multiplier})`,
        tierMultiplier: TIER_CONFIG[baseEvent.tier].multiplier
    }));
};

// getRandomChaosEvents() kept for backward compatibility - now uses tiered version
function getRandomChaosEvents() {
    return getTieredChaosEvents();
}

// Function to activate an event
function activateChaosEvent(eventData) {
    // eventData now includes tierMultiplier
    if (eventData.apply) {
        if (eventData.tierMultiplier) {
            eventData.apply(eventData.tierMultiplier);
        } else {
            eventData.apply();
        }
        activeChaosEvents.push(eventData);
        if (!usedChaosEventIds.includes(eventData.id)) {
            usedChaosEventIds.push(eventData.id);
        }
    }
}

// Reset chaos state for a new game
function resetChaosState() {
    activeChaosEvents = [];
    usedChaosEventIds = [];
    isFreeplayMode = false;
    chaosModifiers = { ballSizeMult: 1, ballSpeedMult: 1, ballMassMult: 1, isExplosive: false };

    // Reset ball visuals if needed
    if (ballMesh) {
        ballMesh.scale.setScalar(1);
        ballMesh.position.y = LANE_Y + BALL_RADIUS + 0.05;
    }
    if (ballBody && ballBody.shapes.length > 0) {
        ballBody.shapes[0].radius = BALL_RADIUS;
        ballBody.shapes[0].updateBoundingSphereRadius();
        ballBody.updateBoundingRadius();
        ballBody.position.y = LANE_Y + BALL_RADIUS + 0.05;
    }
    window.currentBallRadius = BALL_RADIUS;
}
