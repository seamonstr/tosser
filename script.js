import * as THREE from 'three';

// Three.js scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f4f9);

// Camera - positioned at an angle to see the wok
const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 10, 10);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Add a fill light from below to illuminate the wok interior
const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
fillLight.position.set(0, -5, 2);
scene.add(fillLight);

// Get input elements
const minInput = document.getElementById('minNumber');
const maxInput = document.getElementById('maxNumber');

// Create the wok (bowl shape) - oriented correctly from the start
const wokGroup = new THREE.Group();

// Create a shallow bowl by using the top portion of a sphere
// phiStart = PI/2 - angle makes it start from horizontal
// phiLength determines depth
const wokRadius = 4.5;
const wokDepth = 0.15; // How much of the sphere to use (0.25 * PI radians)

const wokGeometry = new THREE.SphereGeometry(
    wokRadius,
    32, 32,
    0, Math.PI * 2,  // Full circle horizontally
    Math.PI / 2,  // Start from horizontal (equator)
    wokDepth * Math.PI  // Go downward to create bowl
);

const wokMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555,
    metalness: 0.6,
    roughness: 0.5,
    side: THREE.DoubleSide,
});
const wok = new THREE.Mesh(wokGeometry, wokMaterial);
wok.receiveShadow = true;
wokGroup.add(wok);

// Add a circular base to close the bottom of the wok
const baseRadius = wokRadius * Math.cos(wokDepth * Math.PI);
const baseY = -wokRadius * Math.sin(wokDepth * Math.PI);
const baseGeometry = new THREE.CircleGeometry(baseRadius, 32);
const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.7,
    roughness: 0.4,
    side: THREE.DoubleSide,
});
const base = new THREE.Mesh(baseGeometry, baseMaterial);
base.rotation.x = -Math.PI / 2; // Face upward
base.position.y = baseY;
base.receiveShadow = true;
wokGroup.add(base);

// The rim is at y = 0 (the horizontal plane)
const rimGeometry = new THREE.TorusGeometry(wokRadius, 0.15, 16, 50);
const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.6,
    roughness: 0.6,
});
const rim = new THREE.Mesh(rimGeometry, rimMaterial);
rim.rotation.x = Math.PI / 2;
rim.position.y = 0;
wokGroup.add(rim);

// The bottom of the bowl is at approximately y = -wokRadius * sin(wokDepth * PI)
const bowlBottom = -wokRadius * Math.sin(wokDepth * Math.PI);

wokGroup.position.y = 0;
scene.add(wokGroup);

// Particle system
const particles = [];
const particleTypes = [
    { name: 'ginger', color: 0xf2d7d5 },
    { name: 'garlic', color: 0xf7e1c1 },
    { name: 'rice', color: 0xfce4d6 },
    { name: 'beans', color: 0xd4a574 },
];

// Physics constants
const gravity = -0.015;
const dampening = 0.98;

// Toss tracking
let tossCount = 0;
let generateOnToss = Math.random() < 0.5 ? 3 : 4;
let isFormingNumber = false;
let isTossing = false;

// Wok animation properties
let wokTiltTarget = 0;
let wokTiltCurrent = 0;
let wokYTarget = 0;
let wokYCurrent = 0;

// Create particles
function createParticles() {
    particles.forEach(p => scene.remove(p.mesh));
    particles.length = 0;
    isFormingNumber = false;

    const bowlBottom = -wokRadius * Math.sin(wokDepth * Math.PI);

    for (let i = 0; i < 400; i++) {
        const type = particleTypes[Math.floor(Math.random() * particleTypes.length)];

        // Random position within wok
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 4.0;

        const geometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const material = new THREE.MeshStandardMaterial({ color: type.color });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.x = Math.cos(angle) * distance;
        mesh.position.z = Math.sin(angle) * distance;
        mesh.position.y = bowlBottom + 0.2; // Rest on the bottom of the bowl
        mesh.castShadow = true;

        scene.add(mesh);

        particles.push({
            mesh: mesh,
            vx: 0,
            vy: 0,
            vz: 0,
            rotationSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
            ),
            targetX: null,
            targetY: null,
            targetZ: null,
        });
    }
}

createParticles();

// Update particle physics
function updateParticles() {
    // Animate wok tilt and position
    wokTiltCurrent += (wokTiltTarget - wokTiltCurrent) * 0.15;
    wokYCurrent += (wokYTarget - wokYCurrent) * 0.15;
    wokGroup.rotation.x = wokTiltCurrent;
    wokGroup.position.y = wokYCurrent;

    particles.forEach(p => {
        // If forming a number, move towards target
        if (isFormingNumber && p.targetX !== null) {
            const dx = p.targetX - p.mesh.position.x;
            const dy = p.targetY - p.mesh.position.y;
            const dz = p.targetZ - p.mesh.position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance > 0.05) {
                // Apply controlled attraction force
                const strength = 0.008;
                p.vx += dx * strength;
                p.vy += dy * strength;
                p.vz += dz * strength;

                // Still apply gravity for natural fall
                p.vy += gravity * 0.5;

                // Apply stronger dampening as we get closer to target
                const damping = distance > 0.5 ? 0.92 : 0.8;
                p.vx *= damping;
                p.vy *= damping;
                p.vz *= damping;
            } else {
                p.mesh.position.set(p.targetX, p.targetY, p.targetZ);
                p.vx = p.vy = p.vz = 0;
            }
        } else {
            // Apply gravity
            p.vy += gravity;
        }

        // Update position
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;

        // Rotate
        p.mesh.rotation.x += p.rotationSpeed.x;
        p.mesh.rotation.y += p.rotationSpeed.y;
        p.mesh.rotation.z += p.rotationSpeed.z;
        
        // Dampen rotation when particles are at rest
        const velocityMagnitude = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
        if (velocityMagnitude < 0.01) {
            p.rotationSpeed.x *= 0.9;
            p.rotationSpeed.y *= 0.9;
            p.rotationSpeed.z *= 0.9;
        } else {
            p.rotationSpeed.x *= 0.98;
            p.rotationSpeed.y *= 0.98;
            p.rotationSpeed.z *= 0.98;
        }

        // Keep in wok (spherical boundary following the curved surface)
        const distXZ = Math.sqrt(
            p.mesh.position.x * p.mesh.position.x +
            p.mesh.position.z * p.mesh.position.z
        );

        // Use a slightly smaller radius to account for wok wall thickness
        const interiorRadius = wokRadius - 0.3;
        const bowlBottom = -wokRadius * Math.sin(wokDepth * Math.PI);

        // Collision detection - check radial, spherical surface, and floor
        let collided = false;

        // First check: radial boundary at rim level
        if (distXZ > interiorRadius) {
            const angle = Math.atan2(p.mesh.position.z, p.mesh.position.x);
            p.mesh.position.x = Math.cos(angle) * interiorRadius;
            p.mesh.position.z = Math.sin(angle) * interiorRadius;
            // Bounce inward toward center
            p.vx *= -0.5;
            p.vz *= -0.5;
            collided = true;
        }

        // Second check: curved bowl surface (only for particles below rim level)
        if (!collided && p.mesh.position.y < -0.05) {
            const bowlSurfaceY = -Math.sqrt(Math.max(0, interiorRadius * interiorRadius - distXZ * distXZ));

            // If particle has penetrated through the curved side
            if (p.mesh.position.y < bowlSurfaceY && bowlSurfaceY > bowlBottom + 0.1) {
                p.mesh.position.y = bowlSurfaceY;
                p.vy *= -0.3;
                collided = true;
            }
        }

        // Third check: flat floor - only if no other collision
        if (!collided && p.mesh.position.y < bowlBottom + 0.05) {
            p.mesh.position.y = bowlBottom + 0.05;
            p.vy *= -0.4;
        }

        // Apply dampening
        p.vx *= dampening;
        p.vy *= dampening;
        p.vz *= dampening;
    });
}

// Generate number shape from text
function animateParticlesToNumber(number) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 300;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#000';
    ctx.font = 'bold 220px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), size / 2, size / 2);

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    const pixelPositions = [];
    for (let y = 0; y < size; y += 3) {
        for (let x = 0; x < size; x += 3) {
            const alpha = data[(y * size + x) * 4 + 3];
            if (alpha > 128) {
                // Convert to 3D coordinates (flat on wok surface at bottom of bowl)
                const bowlBottom = -wokRadius * Math.sin(wokDepth * Math.PI);

                pixelPositions.push({
                    x: (x - size / 2) / 50,
                    y: bowlBottom + 0.3,
                    z: (y - size / 2) / 50,
                });
            }
        }
    }

    // Shuffle for organic look
    for (let i = pixelPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pixelPositions[i], pixelPositions[j]] = [pixelPositions[j], pixelPositions[i]];
    }

    particles.forEach((p, index) => {
        if (index < pixelPositions.length) {
            p.targetX = pixelPositions[index].x;
            p.targetY = pixelPositions[index].y;
            p.targetZ = pixelPositions[index].z;
        } else {
            p.targetX = null;
            p.targetY = null;
            p.targetZ = null;
        }
    });

    isFormingNumber = true;
}

// Perform a single toss
function performToss() {
    tossCount++;

    // Animate the wok toss - tilt forward and lift slightly
    wokTiltTarget = -0.3;
    wokYTarget = 0.4;

    setTimeout(() => {
        wokTiltTarget = 0.2; // Tilt back
    }, 150);

    setTimeout(() => {
        wokTiltTarget = 0;
        wokYTarget = 0;
    }, 400);

    particles.forEach(p => {
        p.targetX = null;
        p.targetY = null;
        p.targetZ = null;

        const angle = Math.atan2(p.mesh.position.z, p.mesh.position.x);
        const spreadPower = 0.03 + Math.random() * 0.04;

        p.vx = Math.cos(angle) * spreadPower + (Math.random() - 0.5) * 0.02;
        p.vz = Math.sin(angle) * spreadPower + (Math.random() - 0.5) * 0.02;
        p.vy = 0.25 + Math.random() * 0.15;

        p.rotationSpeed.set(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
        );
    });

    if (tossCount === generateOnToss) {
        const minVal = parseInt(minInput.value) || 10;
        const maxVal = parseInt(maxInput.value) || 99;
        const min = Math.min(minVal, maxVal);
        const max = Math.max(minVal, maxVal);
        const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

        setTimeout(() => {
            animateParticlesToNumber(randomNumber);
        }, 400);

        setTimeout(() => {
            isTossing = false;
            isFormingNumber = false;
        }, 4500);
    } else {
        const delay = 800 + Math.random() * 600;
        setTimeout(() => performToss(), delay);
    }
}

// Handle click to start toss sequence
function handleClick() {
    if (isTossing || isFormingNumber) return;

    isTossing = true;
    tossCount = 0;
    generateOnToss = Math.random() < 0.5 ? 3 : 4;

    performToss();
}

renderer.domElement.addEventListener('click', handleClick);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updateParticles();
    renderer.render(scene, camera);
}

animate();
