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
    pinMassMult: 1,
    frictionMult: 1,
    gravityMult: 1,
    linearDampingMult: 1,    // NEW: for ice effect
    iceTimer: 0,             // NEW: ice duration timer
    isIceLane: false,
    iceParticlesActive: false // NEW: particle system flag
};

const ChaosEventLibrary = [
{
        id: 'ice_lane',
        name: '極寒冰道',  
        description: '超低摩擦+低阻尼！球如溜冰般滑行，冰晶四濺！(20秒)',
        tier: 'silver',
        apply: function(tierMultiplier = 1) {
            // Enhanced physics: extreme slip + low damping (PERSISTENT)
            chaosModifiers.frictionMult = 0.001 * tierMultiplier;  // Near-zero friction
            chaosModifiers.linearDampingMult = 0.02 * tierMultiplier; // Preserve momentum
            chaosModifiers.isIceLane = true;
            chaosModifiers.iceParticlesActive = true;
            // REMOVED: No auto-timer per user feedback - stays active until deselected
            
            console.log(`🧊 Ice Lane ACTIVATED! Friction: ${chaosModifiers.frictionMult}, Damping: ${chaosModifiers.linearDampingMult} (Persistent)`);
            console.log('🔍 Ice lane active - pin circles should now render properly with ice effect');
            
            // Visual/audio feedback
            if (typeof playGameSound === 'function') playGameSound('ice_activate');
        },
        cleanup: function() {  // NEW: proper cleanup
            chaosModifiers.frictionMult = 1;
            chaosModifiers.linearDampingMult = 1;
            chaosModifiers.isIceLane = false;
            chaosModifiers.iceParticlesActive = false;
            chaosModifiers.iceTimer = 0;
            console.log('❄️ Ice Lane melted - normal physics restored');
        }
    },
    // Base events - tiers will be applied dynamically
    {
        id: 'giant_ball',
        name: '巨人球',
        description: '球變大變重，撞飛所有球瓶！',
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
        name: '極速衝鋒',
        description: '球速變超快，瞬間擊倒球瓶！',
        tier: 'silver',
        baseMultiplier: 1.5,
        apply: function(tierMultiplier = 1) {
            chaosModifiers.ballSpeedMult *= this.baseMultiplier * tierMultiplier;
        }
    },
    {
        id: 'explosive_ball',
        name: 'TNT爆炸球',
        description: '球會爆炸！產生超大範圍破壞！',
        tier: 'gold',
        apply: () => {
            chaosModifiers.isExplosive = true;
        }
    },
    {
        id: 'tiny_ball',
        name: '縮小球',
        description: '球變超小變輕，幾乎無法擊倒球瓶！(錯誤狀態)',
        tier: 'error',
        baseMultiplier: 0.5,
        baseMassMultiplier: 0.1,
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
        id: 'random_spin',
        name: '隨機旋轉',
        description: '球會自己旋轉並隨機移動！(錯誤狀態)',
        tier: 'error',
        apply: function(tierMultiplier = 1) {
            chaosModifiers.isRandomSpin = true;
            chaosModifiers.initialForwardSpeed = 30 * tierMultiplier; // Reference speed for bias
            
            chaosModifiers.randomSpinInterval = setInterval(() => {
                if (!ballBody || !ballMesh || !chaosModifiers.isRandomSpin) return;
                
                // Continuous random spin (controlled chaos)
                const spinForce = 40 * tierMultiplier;
                ballBody.angularVelocity.x = (Math.random() - 0.5) * spinForce;
                ballBody.angularVelocity.y = (Math.random() - 0.5) * spinForce;
                ballBody.angularVelocity.z = (Math.random() - 0.5) * spinForce;
                
                // Forward-biased impulses (random path but always progresses)
                const forwardBias = 12 + (chaosModifiers.initialForwardSpeed || 30) * 0.3;
                const impulse = new CANNON.Vec3(
                    (Math.random() - 0.5) * 8,   // Side variation
                    Math.random() * 3,            // Slight bounce
                    -(forwardBias + Math.random() * 6)  // Always forward
                );
                ballBody.applyImpulse(impulse, ballBody.position);
                
                // Torque for natural path curving (replaces jitter)
                const torqueAmount = 25 * tierMultiplier;
                ballBody.torque.set(
                    (Math.random() - 0.5) * torqueAmount,
                    0,
                    (Math.random() - 0.5) * torqueAmount * 0.7  // Less z-torque to preserve forward
                );
                
                // Visual spin sync (enhanced)
                ballMesh.rotation.x += 0.25;
                ballMesh.rotation.y += 0.3;
                ballMesh.rotation.z += 0.2;
            }, 200); // Smoother 5x/sec updates
        }
    },
    {
        id: 'giant_pins',
        name: '巨大保齡球瓶',
        description: '保齡球瓶變巨大變重，幾乎撞不倒！(錯誤狀態)',
        tier: 'error',
        baseMultiplier: 2.0,
        baseMassMultiplier: 8.0,
        apply: function(tierMultiplier = 1) {
            const sizeMult = this.baseMultiplier * tierMultiplier;
            const massMult = this.baseMassMultiplier * tierMultiplier;
            chaosModifiers.pinSizeMult = sizeMult;
            chaosModifiers.pinMassMult = massMult;
            
            console.log('Giant pins activated! Size:', chaosModifiers.pinSizeMult, 'Mass:', chaosModifiers.pinMassMult);
            
            // Force pin recreation with new sizes by calling resetGame()
            if (typeof resetGame === 'function') {
                console.log('Recreating pins with giant sizes...');
                setTimeout(resetGame, 100); // Small delay to ensure globals available
            }
        }
    },
    {
        id: 'tier_transmute_silver',
        name: '質變金級',
        description: '隨機獲得金色能力！(50%變錯誤)',
        tier: 'silver',
        apply: function(tierMultiplier = 1) {
            const goldEvents = ChaosEventLibrary.filter(e => e.tier === 'gold' && !usedChaosEventIds.includes(e.id));
            if (goldEvents.length === 0) return;
            
            if (Math.random() < 0.5) {
                // 50% error chance
                const errorEvents = ChaosEventLibrary.filter(e => e.tier === 'error');
                const randomEvent = errorEvents[Math.floor(Math.random() * errorEvents.length)];
                activateChaosEvent({
                    ...randomEvent,
                    tierColor: TIER_CONFIG.error.color,
                    tierMultiplier: TIER_CONFIG.error.multiplier
                }, this.id);
            } else {
                // Normal gold event
                const randomEvent = goldEvents[Math.floor(Math.random() * goldEvents.length)];
                activateChaosEvent({
                    ...randomEvent,
                    tierColor: TIER_CONFIG.gold.color,
                    tierMultiplier: TIER_CONFIG.gold.multiplier
                }, this.id);
            }
        }
    },
    {
        id: 'tier_transmute_gold',
        name: '質變棱鏡',
        description: '隨機獲得棱鏡能力！(50%變錯誤)',
        tier: 'gold',
        apply: function(tierMultiplier = 1) {
            const prismaticEvents = ChaosEventLibrary.filter(e => e.tier === 'prismatic' && !usedChaosEventIds.includes(e.id));
            if (prismaticEvents.length === 0) return;
            
            if (Math.random() < 0.5) {
                // 50% error chance
                const errorEvents = ChaosEventLibrary.filter(e => e.tier === 'error');
                const randomEvent = errorEvents[Math.floor(Math.random() * errorEvents.length)];
                activateChaosEvent({
                    ...randomEvent,
                    tierColor: TIER_CONFIG.error.color,
                    tierMultiplier: TIER_CONFIG.error.multiplier
                }, this.id);
            } else {
                // Normal prismatic event
                const randomEvent = prismaticEvents[Math.floor(Math.random() * prismaticEvents.length)];
                activateChaosEvent({
                    ...randomEvent,
                    tierColor: TIER_CONFIG.prismatic.color,
                    tierMultiplier: TIER_CONFIG.prismatic.multiplier
                }, this.id);
            }
        }
    },
    {
        id: 'low_gravity',
        name: '低重力',
        description: '降低重力常數。球瓶與球撞擊後會飛起並「飄浮」更久。',
        tier: 'gold',
        apply: function(tierMultiplier = 1) {
            chaosModifiers.gravityMult = 0.3 * tierMultiplier;
        }
    },
    {
        id: 'tier_chaos_prismatic',
        name: '大混亂',
        description: '隨機獲得雙棱鏡能力！(50%變錯誤)',
        tier: 'prismatic',
        apply: function(tierMultiplier = 1) {
            const prismaticEvents = ChaosEventLibrary.filter(e => e.tier === 'prismatic' && !usedChaosEventIds.includes(e.id));
            if (prismaticEvents.length < 2) return;
            
            // Pick 2 random prismatic (or error if none available)
            const availablePrismatic = prismaticEvents.slice();
            const selectedEvents = [];
            
            for (let i = 0; i < 2; i++) {
                if (Math.random() < 0.5 && availablePrismatic.length > 0) {
                    // 50% per event to be error
                    const errorEvents = ChaosEventLibrary.filter(e => e.tier === 'error');
                    const randomEvent = errorEvents[Math.floor(Math.random() * errorEvents.length)];
                    selectedEvents.push({
                        ...randomEvent,
                        tierColor: TIER_CONFIG.error.color,
                        tierMultiplier: TIER_CONFIG.error.multiplier
                    });
                } else if (availablePrismatic.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availablePrismatic.length);
                    const randomEvent = availablePrismatic[randomIndex];
                    selectedEvents.push({
                        ...randomEvent,
                        tierColor: TIER_CONFIG.prismatic.color,
                        tierMultiplier: TIER_CONFIG.prismatic.multiplier
                    });
                    availablePrismatic.splice(randomIndex, 1);
                }
            }
            
            // Activate both events
            selectedEvents.forEach(event => activateChaosEvent(event));
        }
    }
];

// Tier configuration
const TIER_CONFIG = {
    silver: { multiplier: 1.0, color: '#c0c0c0', nameSuffix: '銀色' },
    gold: { multiplier: 1.5, color: '#ffd700', nameSuffix: '黃金' },
    prismatic: { multiplier: 2.0, color: '#ff00ff', nameSuffix: '棱鏡' },
    error: { multiplier: 1.0, color: '#ff4444', nameSuffix: '錯誤' }
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
function activateChaosEvent(eventData, sourceEventId = null) {
    // eventData now includes tierMultiplier
    // sourceEventId tracks if activated by transmutation (for "質變" label)
    if (eventData.apply) {
        if (eventData.tierMultiplier) {
            eventData.apply(eventData.tierMultiplier);
        } else {
            eventData.apply();
        }
        // Add source tracking for transmuted events
        if (sourceEventId) {
            eventData.sourceEventId = sourceEventId;
        }
        activeChaosEvents.push(eventData);
        if (!usedChaosEventIds.includes(eventData.id)) {
            usedChaosEventIds.push(eventData.id);
        }
        updateChaosEventsDisplay();
    }
}


// Event icons map
const EVENT_ICONS = {
    'giant_ball': '🏈',
    'super_speed': '⚡',
    'explosive_ball': '💣',
    'tiny_ball': '⚠️',
    'random_spin': '🌀',
    'giant_pins': '🏺',
    'ice_lane': '🧊',
    'low_gravity': '🪐',
    default: '🎯'
};

let isChaosBoxVisible = false;

function computeButtonState() {
    const btn = document.getElementById('chaos-toggle-btn');
    const countEl = document.getElementById('chaos-btn-count');
    const iconEl = document.getElementById('chaos-btn-icon');
    const controls = document.querySelector('.chaos-controls');
    
    if (!isChaosMode || !btn || !countEl || !iconEl || !controls) {
        if (controls) controls.classList.remove('chaos-visible');
        return;
    }
    
    const count = activeChaosEvents.length;
    const uniqueIds = new Set(activeChaosEvents.map(e => e.id));
    const uniqueCount = uniqueIds.size;
    const maxEvents = ChaosEventLibrary.length;
    countEl.textContent = `${uniqueCount}/${maxEvents}`;
    
    if (count === 0) {
        // Neutral state
        btn.className = 'chaos-toggle-btn';
        iconEl.textContent = EVENT_ICONS.default;
        controls.classList.add('chaos-visible');
        return;
    }
    
    // Determine dominant tier (highest: prismatic > gold > silver > error)
    const tierPriority = { prismatic: 4, gold: 3, silver: 2, error: 1 };
    let dominantTier = 'error';
    let iconRotation = [];
    
    activeChaosEvents.forEach(event => {
        const eventTier = event.tier || 'error';
        if (tierPriority[eventTier] > tierPriority[dominantTier]) {
            dominantTier = eventTier;
        }
        iconRotation.push(EVENT_ICONS[event.id] || EVENT_ICONS.default);
    });
    
    // Use LATEST (last) event icon
    iconEl.textContent = iconRotation[iconRotation.length - 1] || EVENT_ICONS.default;
    
    // Apply tier class
    btn.className = `chaos-toggle-btn tier-${dominantTier}`;
    controls.classList.add('chaos-visible');
}

function toggleChaosBox() {
    const box = document.getElementById('chaos-events-info');
    const btn = document.getElementById('chaos-toggle-btn');
    if (!box || !btn) return;
    
    isChaosBoxVisible = !isChaosBoxVisible;
    box.style.display = isChaosBoxVisible ? 'block' : 'none';
    btn.style.transform = isChaosBoxVisible ? 'scale(1.15) rotate(180deg)' : 'scale(1)';
    
    // Optional: rotate icon
    const icon = document.getElementById('chaos-btn-icon');
    if (icon) {
        icon.style.transform = isChaosBoxVisible ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}

function updateChaosEventsDisplay() {
    const box = document.getElementById('chaos-events-info');
    const list = document.getElementById('active-events-list');
    
    computeButtonState(); // Always update button first
    
    if (!isChaosMode || !list) {
        if (box) box.style.display = 'none';
        return;
    }
    
    list.innerHTML = '';
    if (activeChaosEvents.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#888; font-style:italic; padding: 20px 0; font-size: 11px;">等待選擇能力...</div>';
        if (box) box.style.display = isChaosBoxVisible ? 'block' : 'none';
        return;
    }
    
    activeChaosEvents.forEach((event, index) => {
        const item = document.createElement('div');
        item.className = 'active-event-item';
        item.style.borderLeftColor = event.tierColor || '#9b59b6';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.gap = '2px';
        item.style.padding = '6px 8px';
        const icon = EVENT_ICONS[event.id] || '●';
        const shortDesc = (event.description || '').length > 25 ? event.description.substring(0, 25) + '...' : event.description;
        
        // Check if transmuted (randomly chosen by transmuters)
        const isTransmuted = event.sourceEventId && ['tier_transmute_silver', 'tier_transmute_gold', 'tier_chaos_prismatic'].includes(event.sourceEventId);
        const transmutedLabel = isTransmuted ? '<span style="background: #ff6b6b; color: white; font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: bold;">質變</span>' : '';
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="color: ${event.tierColor || '#9b59b6'}; font-weight: bold; font-size: 14px; min-width: 20px; flex-shrink: 0;">${icon}</span>
                <span style="font-weight: 600; font-size: 12px;">${event.displayName || event.name}${transmutedLabel}</span>
            </div>
            <small style="color: #aaa; font-size: 11px; line-height: 1.2;">${shortDesc}</small>
        `;
        list.appendChild(item);
    });
    
    if (box) box.style.display = isChaosBoxVisible ? 'block' : 'none';
}


// Reset chaos state for a new game
function resetChaosState() {
    activeChaosEvents = [];
    usedChaosEventIds = [];
    isFreeplayMode = false;
    if (chaosModifiers.randomSpinInterval) {
        clearInterval(chaosModifiers.randomSpinInterval);
        chaosModifiers.randomSpinInterval = null;
    }
    chaosModifiers = { 
        ballSizeMult: 1, 
        ballSpeedMult: 1, 
        ballMassMult: 1, 
        frictionMult: 1,
        gravityMult: 1,
        isIceLane: false,
        isExplosive: false, 
        isRandomSpin: false,
        pinSizeMult: 1,
        pinMassMult: 1
    };

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
    
    // Reset pins if exist
    if (typeof pins !== 'undefined' && Array.isArray(pins)) {
        pins.forEach(pin => {
            if (pin.mesh) {
                pin.mesh.scale.setScalar(1);
                pin.mesh.children.forEach(child => child.scale.setScalar(1));
            }
        });
    }
    if (typeof pinCircles !== 'undefined' && Array.isArray(pinCircles)) {
        pinCircles.forEach(circle => circle.scale.setScalar(1));
    }
    
    updateChaosEventsDisplay();
}
