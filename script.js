import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- CONFIG ---
const PARTICLE_COUNT = 400; 
const GRAVITY = -0.015;
const AIR_RESISTANCE = 0.985; 
const WOK_RADIUS = 4.5;
const WOK_DEPTH = 0.15; 

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f4f9);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 11);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const mainLight = new THREE.DirectionalLight(0xffffff, 0.5);
mainLight.position.set(2, 10, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
fillLight.position.set(-5, 5, -2);
scene.add(fillLight);

const wokPointLight = new THREE.PointLight(0xffffff, 8, 15);
wokPointLight.position.set(0, 4, 0);
scene.add(wokPointLight);

// --- WOK GEOMETRY ---
const wokGroup = new THREE.Group();
const bowlBottom = -WOK_RADIUS * Math.sin(WOK_DEPTH * Math.PI);
const baseRadius = WOK_RADIUS * Math.cos(WOK_DEPTH * Math.PI);

// USER PREFERRED MATERIAL
const wokMat = new THREE.MeshStandardMaterial({ 
    color: 0x888888,   
    metalness: 0.9,    
    roughness: 0.7,    
    side: THREE.DoubleSide 
});

const wokBowl = new THREE.Mesh(new THREE.SphereGeometry(WOK_RADIUS, 32, 32, 0, Math.PI * 2, Math.PI / 2, WOK_DEPTH * Math.PI), wokMat);
wokBowl.receiveShadow = true;
wokGroup.add(wokBowl);

const wokBase = new THREE.Mesh(new THREE.CircleGeometry(baseRadius, 32), wokMat);
wokBase.rotation.x = -Math.PI / 2;
wokBase.position.y = bowlBottom;
wokBase.receiveShadow = true;
wokGroup.add(wokBase);

const rimGeo = new THREE.TorusGeometry(WOK_RADIUS, 0.05, 12, 100);
const rimMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 });
const rim = new THREE.Mesh(rimGeo, rimMat);
rim.rotation.x = Math.PI / 2;
wokGroup.add(rim);

scene.add(wokGroup);

// --- STATE ---
const particles = [];
let isTossing = false;
let isFinalToss = false;
let tossCount = 0;
let targetTosses = 3;

// Animation State
let wokAnim = { 
    tiltTarget: 0, 
    yTarget: 0, 
    lerpSpeed: 0.15 
};

const minInput = document.getElementById('minNumber');
const maxInput = document.getElementById('maxNumber');

// --- PHYSICS ENGINE ---
function updatePhysics() {
    // Variable easing for the wok gesture
    wokGroup.rotation.x += (wokAnim.tiltTarget - wokGroup.rotation.x) * wokAnim.lerpSpeed;
    wokGroup.position.y += (wokAnim.yTarget - wokGroup.position.y) * wokAnim.lerpSpeed;

    particles.forEach(p => {
        p.vy += GRAVITY;
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;

        const distXZ = Math.sqrt(p.mesh.position.x ** 2 + p.mesh.position.z ** 2);
        let limit = WOK_RADIUS - 0.3;
        if (p.mesh.position.y < 0) {
            limit = Math.sqrt(Math.max(0, WOK_RADIUS**2 - p.mesh.position.y**2)) - 0.3;
        }

        if (distXZ > limit) {
            const angle = Math.atan2(p.mesh.position.z, p.mesh.position.x);
            p.mesh.position.x = Math.cos(angle) * limit;
            p.mesh.position.z = Math.sin(angle) * limit;
            p.vx *= -0.3; p.vz *= -0.3;
        }

        if (p.mesh.position.y < bowlBottom + 0.05) {
            p.mesh.position.y = bowlBottom + 0.05;
            if (isFinalToss && p.tx !== null) {
                p.vx = p.vz = p.vy = 0; 
                p.mesh.position.x = p.tx; p.mesh.position.z = p.tz;
                p.rv.multiplyScalar(0.5);
            } else {
                p.vy *= -0.2; p.vx *= 0.8; p.vz *= 0.8;
            }
        }

        if (!isFinalToss || p.mesh.position.y <= bowlBottom + 0.1) {
            p.vx *= AIR_RESISTANCE; p.vy *= AIR_RESISTANCE; p.vz *= AIR_RESISTANCE;
        }

        p.mesh.rotation.x += p.rv.x; p.mesh.rotation.y += p.rv.y;
        if (Math.abs(p.vx) + Math.abs(p.vy) < 0.01) p.rv.multiplyScalar(0.9);
    });
}

function getNumberPoints(number) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.height = 300;
    ctx.fillStyle = 'black';
    ctx.font = '220px Arial'; 
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), 150, 150);
    const data = ctx.getImageData(0, 0, 300, 300).data;
    const pts = [];
    for (let y = 0; y < 300; y++) { 
        for (let x = 0; x < 300; x++) {
            if (data[(y * 300 + x) * 4 + 3] > 128) {
                pts.push({ x: (x - 150) / 60, z: (y - 150) / 60 });
            }
        }
    }
    const result = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const index = Math.floor((i / PARTICLE_COUNT) * pts.length);
        result.push(pts[index] || { x: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 });
    }
    return result.sort(() => Math.random() - 0.5);
}

// --- GESTURE-BASED TOSS ---
function performToss() {
    tossCount++;
    const finalMode = (tossCount >= targetTosses);

    // 1. WIND-UP (Slow dip, tilt away)
    wokAnim.lerpSpeed = 0.1;
    wokAnim.yTarget = -0.6;
    wokAnim.tiltTarget = -0.25; // Tilt away from camera

    setTimeout(() => {
        // 2. THE SNAP (Explosive lift, flick towards camera)
        wokAnim.lerpSpeed = 0.45; // Very fast
        wokAnim.yTarget = 1.3;
        wokAnim.tiltTarget = 0.65; // Flick interior towards viewport

        // 3. LAUNCH: The moment of highest momentum
        launchParticles(finalMode);

    }, 150);

    setTimeout(() => {
        // 4. RECOVERY (Slow settle back to home)
        wokAnim.lerpSpeed = 0.07;
        wokAnim.yTarget = 0;
        wokAnim.tiltTarget = 0;
        
        if (finalMode) {
            setTimeout(() => isTossing = false, 4000);
        } else {
            setTimeout(performToss, 800 + Math.random() * 500);
        }
    }, 450);
}

function launchParticles(finalMode) {
    let points = [];
    if (finalMode) {
        isFinalToss = true;
        const min = parseInt(minInput.value) || 1;
        const max = parseInt(maxInput.value) || 99;
        points = getNumberPoints(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    particles.forEach((p, i) => {
        const vUp = 0.48 + Math.random() * 0.12;
        p.vy = vUp;
        // Increase rotation for a more chaotic "toss" feel
        p.rv.set((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5);

        if (finalMode) {
            const pt = points[i];
            p.tx = pt.x; p.tz = pt.z;
            const a = 0.5 * GRAVITY, b = vUp, c = p.mesh.position.y - (bowlBottom + 0.1);
            const flightTime = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);
            p.vx = (p.tx - p.mesh.position.x) / flightTime;
            p.vz = (p.tz - p.mesh.position.z) / flightTime;
        } else {
            p.tx = null;
            const ang = Math.random() * Math.PI * 2;
            const pwr = 0.07 + Math.random() * 0.07;
            p.vx = Math.cos(ang) * pwr;
            p.vz = Math.sin(ang) * pwr;
        }
    });
}

function handleClick() {
    if (isTossing) return;
    isTossing = true;
    isFinalToss = false;
    tossCount = 0;
    targetTosses = Math.floor(Math.random() * 2) + 3;
    performToss();
}

renderer.domElement.addEventListener('click', handleClick);

const loader = new GLTFLoader();
loader.load('Orange.glb', (gltf) => {
    let geo, mat;
    gltf.scene.traverse(n => { if (n.isMesh && !geo) { geo = n.geometry.clone(); mat = n.material.clone(); }});
    geo.center();
    const size = new THREE.Box3().setFromObject(new THREE.Mesh(geo)).getSize(new THREE.Vector3());
    geo.scale(0.18/Math.max(size.x, size.y), 0.18/Math.max(size.x, size.y), 0.18/Math.max(size.x, size.y));

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = m.receiveShadow = true;
        const ang = Math.random() * Math.PI * 2, dist = Math.random() * baseRadius * 0.85;
        m.position.set(Math.cos(ang) * dist, bowlBottom + 0.1, Math.sin(ang) * dist);
        m.rotation.set(Math.random()*7, Math.random()*7, Math.random()*7);
        scene.add(m);
        particles.push({ mesh: m, vx: 0, vy: 0, vz: 0, rv: new THREE.Vector3(), tx: null, tz: null });
    }
    const animate = () => { requestAnimationFrame(animate); updatePhysics(); renderer.render(scene, camera); };
    animate();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});