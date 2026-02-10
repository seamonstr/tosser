// Select the canvas and set up the context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Get input elements
const minInput = document.getElementById('minNumber');
const maxInput = document.getElementById('maxNumber');

// Wok properties - viewed from above as a circle
const wok = {
    x: canvas.width / 2,
    y: canvas.height * 0.65,
    radius: 180,
    rimColor: '#444',
    innerColor: '#333',
    scale: 1,
    targetScale: 1,
};

// Particle properties
const particles = [];
const particleTypes = [
    { name: 'ginger', color: '#f2d7d5', shape: 'square' },
    { name: 'garlic', color: '#f7e1c1', shape: 'circle' },
    { name: 'rice', color: '#fce4d6', shape: 'rectangle' },
    { name: 'beans', color: '#d4a574', shape: 'oval' },
];

const gravity = 0.3;
const dampening = 0.98;
const zGravity = 0.5; // Gravity pulling particles back down (away from camera)
const airResistance = 0.02; // Drag force that slows fast-moving particles

// Toss tracking
let tossCount = 0;
let generateOnToss = Math.random() < 0.5 ? 3 : 4;
let isFormingNumber = false;
let isTossing = false;
let targetPositions = [];

// Initialize particles scattered in the wok
function createParticles() {
    particles.length = 0;
    isFormingNumber = false;
    for (let i = 0; i < 400; i++) {
        // Random position within wok circle
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (wok.radius - 20);
        const type = particleTypes[Math.floor(Math.random() * particleTypes.length)];

        particles.push({
            x: wok.x + Math.cos(angle) * distance,
            y: wok.y + Math.sin(angle) * distance,
            z: 0, // Depth: 0 = at wok level, positive = towards camera
            vx: 0,
            vy: 0,
            vz: 0, // Velocity in z-direction
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            type: type,
            targetX: null,
            targetY: null,
        });
    }
}

createParticles();

// Draw the wok from above
function drawWok() {
    // Animate wok scale smoothly
    wok.scale += (wok.targetScale - wok.scale) * 0.1;

    ctx.save();
    ctx.translate(wok.x, wok.y);
    ctx.scale(wok.scale, wok.scale);
    ctx.translate(-wok.x, -wok.y);

    // Outer rim
    ctx.beginPath();
    ctx.arc(wok.x, wok.y, wok.radius, 0, Math.PI * 2);
    ctx.fillStyle = wok.rimColor;
    ctx.fill();

    // Inner circle
    ctx.beginPath();
    ctx.arc(wok.x, wok.y, wok.radius - 15, 0, Math.PI * 2);
    ctx.fillStyle = wok.innerColor;
    ctx.fill();

    // Add some depth/shading
    const gradient = ctx.createRadialGradient(wok.x, wok.y, 0, wok.x, wok.y, wok.radius - 15);
    gradient.addColorStop(0, 'rgba(80, 80, 80, 0.3)');
    gradient.addColorStop(1, 'rgba(20, 20, 20, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.restore();
}

// Draw a single particle based on its type
function drawParticle(p) {
    // Calculate scale based on z-depth (particles closer to camera are larger)
    const scale = 1 + p.z * 0.015; // Each unit of z increases size by 1.5%
    const size = 3 * scale;

    // Adjust opacity based on depth (optional: particles slightly fade when far)
    const opacity = Math.max(0.7, 1 - p.z * 0.005);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = p.type.color;

    switch(p.type.shape) {
        case 'circle':
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'square':
            ctx.fillRect(-size, -size, size * 2, size * 2);
            break;
        case 'rectangle':
            ctx.fillRect(-size * 1.3, -size * 0.7, size * 2.6, size * 1.4);
            break;
        case 'oval':
            ctx.beginPath();
            ctx.ellipse(0, 0, size * 1.3, size * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
    }

    ctx.restore();
}

// Draw all particles
function drawParticles() {
    particles.forEach(p => drawParticle(p));
}

// Update particle positions
function updateParticles() {
    particles.forEach(p => {
        // If forming a number, apply gentle force towards target position
        if (isFormingNumber && p.targetX !== null && p.targetY !== null) {
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 2) {
                // Apply force towards target (accelerate, don't override velocity)
                const strength = 0.3;
                p.vx += dx * strength * 0.01;
                p.vy += dy * strength * 0.01;
            } else {
                // Lock in place when close enough
                p.x = p.targetX;
                p.y = p.targetY;
                p.vx = 0;
                p.vy = 0;
            }
        }

        // Apply z-axis gravity (falling back into wok)
        if (!isFormingNumber || p.targetX === null) {
            p.vz -= zGravity;
            // Apply air resistance for natural easing (stronger effect on faster particles)
            p.vz *= (1 - airResistance);
        } else {
            // Also settle z position when forming number
            p.vz -= zGravity;
            p.vz *= (1 - airResistance);
        }

        // Update position
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.rotation += p.rotationSpeed;

        // Keep z from going negative (below wok surface)
        if (p.z < 0) {
            p.z = 0;
            p.vz *= -0.4; // Bounce with energy loss
        }

        // Apply dampening (friction) - particles slow down naturally
        p.vx *= dampening;
        p.vy *= dampening;
        p.vz *= dampening;
        p.rotationSpeed *= dampening;

        // Keep particles within the wok (circular boundary)
        const dx = p.x - wok.x;
        const dy = p.y - wok.y;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

        if (distanceFromCenter > wok.radius - 20) {
            // Bounce back into the wok with energy loss
            const angle = Math.atan2(dy, dx);
            p.x = wok.x + Math.cos(angle) * (wok.radius - 20);
            p.y = wok.y + Math.sin(angle) * (wok.radius - 20);

            // Reflect velocity with damping
            const normalX = Math.cos(angle);
            const normalY = Math.sin(angle);
            const dotProduct = p.vx * normalX + p.vy * normalY;
            p.vx = p.vx - 2 * dotProduct * normalX;
            p.vy = p.vy - 2 * dotProduct * normalY;
            p.vx *= 0.6;
            p.vy *= 0.6;
        }
    });
}

// Generate pixel map for a number and assign target positions to particles
function animateParticlesToNumber(number) {
    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d');
    const size = 300;
    offscreenCanvas.width = size;
    offscreenCanvas.height = size;

    // Draw the number on the offscreen canvas
    offscreenCtx.fillStyle = '#000';
    offscreenCtx.font = 'bold 220px Arial';
    offscreenCtx.textAlign = 'center';
    offscreenCtx.textBaseline = 'middle';
    offscreenCtx.fillText(number.toString(), size / 2, size / 2);

    const imageData = offscreenCtx.getImageData(0, 0, size, size);
    const data = imageData.data;

    // Collect all pixel positions that are part of the number
    const pixelPositions = [];
    for (let y = 0; y < size; y += 3) {
        for (let x = 0; x < size; x += 3) {
            const alpha = data[(y * size + x) * 4 + 3];
            if (alpha > 128) {
                pixelPositions.push({
                    x: wok.x - size / 2 + x,
                    y: wok.y - size / 2 + y,
                });
            }
        }
    }

    // Shuffle pixel positions for more organic animation
    for (let i = pixelPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pixelPositions[i], pixelPositions[j]] = [pixelPositions[j], pixelPositions[i]];
    }

    // Assign target positions to particles
    particles.forEach((p, index) => {
        if (index < pixelPositions.length) {
            p.targetX = pixelPositions[index].x;
            p.targetY = pixelPositions[index].y;
        } else {
            // Extra particles stay scattered
            p.targetX = null;
            p.targetY = null;
        }
    });

    isFormingNumber = true;
}

// Perform a single toss
function performToss() {
    tossCount++;

    // Animate the wok toss
    wok.targetScale = 1.15;
    setTimeout(() => { wok.targetScale = 1; }, 300);

    // Perform toss animation - particles fly UP towards camera
    particles.forEach(p => {
        // Clear any target positions
        p.targetX = null;
        p.targetY = null;

        // Calculate direction from center for slight spread
        const angle = Math.atan2(p.y - wok.y, p.x - wok.x);

        // Small horizontal/vertical spread
        const spreadPower = 2 + Math.random() * 3;
        p.vx = Math.cos(angle) * spreadPower + (Math.random() - 0.5) * 2;
        p.vy = Math.sin(angle) * spreadPower + (Math.random() - 0.5) * 2;

        // MAIN TOSS: Strong initial velocity UP (towards camera = positive z)
        // Higher initial velocity for harder acceleration at start
        p.vz = 18 + Math.random() * 10;

        p.rotationSpeed = (Math.random() - 0.5) * 0.5;
    });

    // Check if it's time to generate a number
    if (tossCount === generateOnToss) {
        const minVal = parseInt(minInput.value) || 10;
        const maxVal = parseInt(maxInput.value) || 99;
        const min = Math.min(minVal, maxVal);
        const max = Math.max(minVal, maxVal);
        const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

        // Assign number targets immediately so particles form the number as they fall
        setTimeout(() => {
            animateParticlesToNumber(randomNumber);
        }, 400); // Small delay to let particles reach apex of trajectory

        // Allow new round after number forms
        setTimeout(() => {
            isTossing = false;
            isFormingNumber = false;
        }, 4500);
    } else {
        // Schedule next automatic toss with random delay
        const delay = 800 + Math.random() * 600; // 800-1400ms
        setTimeout(() => performToss(), delay);
    }
}

// Handle initial click to start toss sequence
function toss() {
    // Don't allow new sequence while already tossing or forming number
    if (isTossing || isFormingNumber) return;

    // Reset for new sequence
    isTossing = true;
    tossCount = 0;
    generateOnToss = Math.random() < 0.5 ? 3 : 4;

    // Start the automatic toss sequence
    performToss();
}

// Listen for clicks anywhere on the canvas
canvas.addEventListener('click', toss);

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWok();
    drawParticles();
    updateParticles();
    requestAnimationFrame(animate);
}

animate();