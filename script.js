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
let tossDir = 1; // 1 for Right, -1 for Left

let wokAnim = { 
    tiltX: 0, 
    rollZ: 0,
    xPos: 0,
    yPos: 0, 
    lerpSpeed: 0.15 
};

const minInput = document.getElementById('minNumber');
const maxInput = document.getElementById('maxNumber');

// --- PHYSICS ENGINE ---
function updatePhysics() {
    wokGroup.rotation.x += (wokAnim.tiltX - wokGroup.rotation.x) * wokAnim.lerpSpeed;
    wokGroup.rotation.z += (wokAnim.rollZ - wokGroup.rotation.z) * wokAnim.lerpSpeed;
    wokGroup.position.x += (wokAnim.xPos - wokGroup.position.x) * wokAnim.lerpSpeed;
    wokGroup.position.y += (wokAnim.yPos - wokGroup.position.y) * wokAnim.lerpSpeed;

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

// --- ALTERNATING SIDEWAYS TOSS ---
function performToss() {
    tossCount++;
    const finalMode = (tossCount >= targetTosses);
    
    // Capture current direction then flip it for the next one
    const dir = tossDir;
    tossDir *= -1; 

    // 1. WIND-UP (Dip and roll away from toss direction)
    wokAnim.lerpSpeed = 0.12;
    wokAnim.yPos = -0.5;
    wokAnim.xPos = -0.4 * dir;
    wokAnim.rollZ = 0.25 * dir;
    wokAnim.tiltX = -0.1;

    setTimeout(() => {
        // 2. THE SIDEWAYS SNAP (Lateral shift and sharp roll)
        wokAnim.lerpSpeed = 0.45;
        wokAnim.yPos = 1.2;
        wokAnim.xPos = 0.9 * dir;
        wokAnim.rollZ = -0.7 * dir; // Sharp roll towards the side
        wokAnim.tiltX = 0.2;

        launchParticles(finalMode, dir);
    }, 150);

    setTimeout(() => {
        // 3. RECOVERY
        wokAnim.lerpSpeed = 0.12; // Slightly faster catch speed
        wokAnim.yPos = 0;
        wokAnim.xPos = 0;
        wokAnim.rollZ = 0;
        wokAnim.tiltX = 0;
        
        if (finalMode) {
            setTimeout(() => isTossing = false, 4000);
        } else {
            setTimeout(performToss, 900 + Math.random() * 500);
        }
    }, 450);
}

function launchParticles(finalMode, dir) {
    let points = [];
    if (finalMode) {
        isFinalToss = true;
        const min = parseInt(minInput.value) || 1;
        const max = parseInt(maxInput.value) || 99;
        points = getNumberPoints(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    particles.forEach((p, i) => {
        const vUp = 0.45 + Math.random() * 0.15;
        p.vy = vUp;
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
            // Bias horizontal velocity toward the toss direction
            const sidePower = (0.07 + Math.random() * 0.07) * dir;
            const depthPower = (Math.random() - 0.5) * 0.08;
            p.vx = sidePower;
            p.vz = depthPower;
        }
    });
}

function handleClick() {
    if (isTossing) return;
    isTossing = true;
    isFinalToss = false;
    tossCount = 0;
    tossDir = 1; // Always start new sequence by tossing to the right
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