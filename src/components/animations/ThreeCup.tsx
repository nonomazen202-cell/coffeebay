'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────
//  Sound effects helper (Web Audio API — zero-dependency)
// ─────────────────────────────────────────────────────────────────────
let sharedAudioCtx: AudioContext | null = null;

function playSFX(type: 'whoosh' | 'click' | 'shine', customCtx?: AudioContext) {
  if (typeof window === 'undefined') return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  try {
    let ctx = customCtx || sharedAudioCtx;
    if (!ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      ctx = new AudioContextClass();
      sharedAudioCtx = ctx;
    }

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (type === 'whoosh') {
      const bufferSize = ctx.sampleRate * 1.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 2.5;
      filter.frequency.setValueAtTime(100, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.45);
      filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 1.1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(170, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'shine') {
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        
        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    }
  } catch {
    // Silence error
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Dynamic brand texture painter (generates PBR maps using loaded images)
// ─────────────────────────────────────────────────────────────────────
function createBrandTexture(
  logoImage: HTMLImageElement,
  textureImage: HTMLImageElement
): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 1024;

  // ── FIX: Cylinder-wrap aspect correction ─────────────────────────────
  // The texture wraps 360° around the cylinder.
  // Cylinder: topR=1.7, botR=1.15 → avgR≈1.425 → circumference≈8.953 units
  // Cup height = 4.0 units
  const LOGO_SVG_W = 110.1;
  const LOGO_SVG_H = 94.3;
  const CYL_COR = 4.0 / (2 * Math.PI * ((1.7 + 1.15) / 2)); // ≈ 0.447
  // Choose a target height that looks prominent on the cup face
  const logoDrawH = Math.round(size * 0.38);                          // 389 px tall in texture
  const logoDrawW = Math.round(logoDrawH * (LOGO_SVG_W / LOGO_SVG_H) * CYL_COR); // corrected
  const logoX = Math.round((size - logoDrawW) / 2);                   // horizontally centered
  const logoY = Math.round(size * 0.22);                              // 225 px from top

  // 1. Diffuse (Color) Canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Draw the loaded high-quality Cup-texture.jpg image
  if (textureImage && textureImage.width > 1) {
    ctx.drawImage(textureImage, 0, 0, size, size);
  } else {
    ctx.fillStyle = '#FAFAF8';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const w = Math.random() * 3 + 0.5;
      const h = Math.random() * 0.8 + 0.2;
      ctx.fillStyle = Math.random() > 0.5 ? '#e2ddd8' : '#d2ccc6';
      ctx.fillRect(x, y, w, h);
    }
    ctx.globalAlpha = 1.0;
  }

  // Draw logo with its ORIGINAL SVG colors — no color manipulation
  ctx.globalAlpha = 1.0;
  ctx.drawImage(logoImage, logoX, logoY, logoDrawW, logoDrawH);

  // Brand tagline below the logo
  const textY = logoY + logoDrawH + 36;
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px "Kondolar", Georgia, serif';
  ctx.fillStyle = '#2BA8E0';
  ctx.fillText('LUCKY CUP', size / 2, textY);
  ctx.font = '400 18px "Kondolar", Georgia, serif';
  ctx.fillStyle = 'rgba(50,35,25,0.75)';
  ctx.fillText('Every Cup Hides a Secret', size / 2, textY + 30);

  const diffuseTexture = new THREE.CanvasTexture(canvas);
  diffuseTexture.colorSpace = THREE.SRGBColorSpace;

  // 2. Emissive canvas — logo in natural colors on black background
  // Used only during the shine animation phase (not for constant glow)
  const eCanvas = document.createElement('canvas');
  eCanvas.width = size;
  eCanvas.height = size;
  const eCtx = eCanvas.getContext('2d')!;
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, size, size);
  // Draw logo at full natural colors — no filter
  eCtx.globalAlpha = 1.0;
  eCtx.drawImage(logoImage, logoX, logoY, logoDrawW, logoDrawH);
  eCtx.textAlign = 'center';
  eCtx.font = 'bold 26px "Kondolar", Georgia, serif';
  eCtx.fillStyle = '#2BA8E0';
  eCtx.fillText('LUCKY CUP', size / 2, textY);
  const emissiveTexture = new THREE.CanvasTexture(eCanvas);
  emissiveTexture.colorSpace = THREE.SRGBColorSpace;

  // 3. Bump Map — extract grayscale from cup texture for micro-relief
  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d')!;

  if (textureImage && textureImage.width > 1) {
    bCtx.drawImage(textureImage, 0, 0, size, size);
    const imgData = bCtx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
      const contrast = (brightness - 128) * 1.5 + 128;
      data[i] = contrast;
      data[i + 1] = contrast;
      data[i + 2] = contrast;
    }
    bCtx.putImageData(imgData, 0, 0);
  } else {
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);
  }
  const bumpTexture = new THREE.CanvasTexture(bCanvas);

  // 4. Roughness Map — rough paper base, smooth ink over logo
  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d')!;

  rCtx.fillStyle = '#d8d8d8'; // paper roughness
  rCtx.fillRect(0, 0, size, size);

  // Build logo mask
  const logoMask = document.createElement('canvas');
  logoMask.width = size;
  logoMask.height = size;
  const mCtx = logoMask.getContext('2d')!;
  mCtx.drawImage(logoImage, logoX, logoY, logoDrawW, logoDrawH);
  mCtx.textAlign = 'center';
  mCtx.font = 'bold 26px "Kondolar", Georgia, serif';
  mCtx.fillStyle = '#ffffff';
  mCtx.fillText('LUCKY CUP', size / 2, textY);

  const inkTemp = document.createElement('canvas');
  inkTemp.width = size;
  inkTemp.height = size;
  const tCtx = inkTemp.getContext('2d')!;
  tCtx.fillStyle = '#383838';
  tCtx.fillRect(0, 0, size, size);
  tCtx.globalCompositeOperation = 'destination-in';
  tCtx.drawImage(logoMask, 0, 0);

  rCtx.globalAlpha = 0.88;
  rCtx.drawImage(inkTemp, 0, 0);
  rCtx.globalAlpha = 1.0;
  const roughnessTexture = new THREE.CanvasTexture(rCanvas);

  return {
    map: diffuseTexture,
    emissiveMap: emissiveTexture,
    bumpMap: bumpTexture,
    roughnessMap: roughnessTexture,
  };
}

// ─────────────────────────────────────────────────────────────────────
//  Coffee Surface Texture Painter (generates realistic espresso Crema)
// ─────────────────────────────────────────────────────────────────────
function createCoffeeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // 1. Dark espresso base
  ctx.fillStyle = '#1b0e07';
  ctx.fillRect(0, 0, 256, 256);

  // 2. Crema ring (oil/foam gradient near the paper wall edge)
  const grad = ctx.createRadialGradient(128, 128, 92, 128, 128, 125);
  grad.addColorStop(0, 'rgba(27, 14, 7, 0)');
  grad.addColorStop(0.3, 'rgba(110, 56, 26, 0.45)');  // caramel color
  grad.addColorStop(0.85, 'rgba(145, 80, 42, 0.7)'); // light crema foam
  grad.addColorStop(1, 'rgba(27, 14, 7, 0.85)');      // dark shadow seam

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // 3. Subtle liquid surface swirls
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(128, 128, 50, 0, Math.PI * 1.25);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(128, 128, 75, Math.PI * 0.4, Math.PI * 1.85);
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  const coffeeTex = new THREE.CanvasTexture(canvas);
  coffeeTex.colorSpace = THREE.SRGBColorSpace;
  return coffeeTex;
}

// ─────────────────────────────────────────────────────────────────────
//  Main 3D Canvas Component
// ─────────────────────────────────────────────────────────────────────

interface ThreeCupProps {
  onAnimationComplete: () => void;
}

export function ThreeCup({ onAnimationComplete }: ThreeCupProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const startSignalRef = useRef<(() => void) | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    let active = true;
    let localCleanup: (() => void) | null = null;

    const container = mountRef.current;
    
    // Clear out container to ensure no leftover duplicate canvas elements
    container.innerHTML = '';

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 440;

    // ─── Parallel Preload: Logo SVG & Cup Texture Image ──────────────
    let logoImg: HTMLImageElement | null = null;
    let textureImg: HTMLImageElement | null = null;

    let progress = 0;
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += Math.floor(Math.random() * 15) + 5;
        setLoadProgress(Math.min(progress, 90));
      }
    }, 100);

    // A. Logo SVG
    const logoLoader = new Image();
    logoLoader.crossOrigin = 'anonymous';
    logoLoader.src = '/Coffee-bay-logo-cup.svg';
    logoLoader.onload = () => {
      logoImg = logoLoader;
      checkReady();
    };
    logoLoader.onerror = () => {
      logoImg = new Image(1, 1);
      checkReady();
    };

    // B. Cup Texture JPG
    const textureLoader = new Image();
    textureLoader.crossOrigin = 'anonymous';
    textureLoader.src = '/Cup-texture.jpg';
    textureLoader.onload = () => {
      textureImg = textureLoader;
      checkReady();
    };
    textureLoader.onerror = () => {
      textureImg = new Image(1, 1);
      checkReady();
    };

    function checkReady() {
      if (logoImg && textureImg && active) {
        clearInterval(progressInterval);
        setLoadProgress(100);
        setIsLoaded(true);
        initScene(logoImg, textureImg);
      }
    }

    function initScene(logoImage: HTMLImageElement, textureImage: HTMLImageElement) {
      if (!active || !mountRef.current) return;

      // Final guard to prevent duplicate canvas elements
      if (container.querySelector('canvas')) return;

      // ─── 1. Scene ───────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0xF6F4F0, 0.035);

      // Camera: field of view 48, position slightly back (10) for clipping fix
      const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
      camera.position.set(0, 0.3, 10.0);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // LinearToneMapping preserves exact texture colors (ACES desaturates)
      renderer.toneMapping = THREE.LinearToneMapping;
      renderer.toneMappingExposure = 1.0;
      container.appendChild(renderer.domElement);

      // ─── 2. Lights ──────────────────────────────────────────────────
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      // Key light: neutral white to avoid yellow cast on cup
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
      keyLight.position.set(6, 9, 6);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024; // slightly lower resolution + high radius = beautifully feathered/soft shadow
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.1;
      keyLight.shadow.camera.far = 35;
      // Tight frustum centered on the cup path to maximize shadow map utility
      keyLight.shadow.camera.left = -6;
      keyLight.shadow.camera.right = 6;
      keyLight.shadow.camera.top = 8;
      keyLight.shadow.camera.bottom = -6;
      keyLight.shadow.bias = -0.0002;
      keyLight.shadow.normalBias = 0.02; // prevent shadow acne on cylindrical body
      keyLight.shadow.radius = 18.0; // very high blur radius for a gorgeous feathered shadow
      scene.add(keyLight);
      scene.add(keyLight.target);
      keyLight.shadow.camera.updateProjectionMatrix();

      // Fill light: cool blue ambient fill from left-front
      const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.6);
      fillLight.position.set(-6, 3, 4);
      scene.add(fillLight);

      // Rim light: clean white rim highlight from behind-top
      const rimLight = new THREE.DirectionalLight(0xffffff, 2.5);
      rimLight.position.set(0, 4, -8);
      scene.add(rimLight);

      // Spot light to animate the brand logo specular shine sweep
      const brandSpot = new THREE.SpotLight(0xffffff, 0.0, 15, Math.PI / 4, 0.5, 0.8);
      brandSpot.position.set(0, 2, 7);
      scene.add(brandSpot);

      // ─── 3. Build the White Paper Cup ───────────────────────────────
      const cupGroup = new THREE.Group();
      scene.add(cupGroup);

      const textures = createBrandTexture(logoImage, textureImage);

      // A. Cup Body (Physical PBR Material with micro-bumps & coating)
      const bodyGeom = new THREE.CylinderGeometry(1.7, 1.15, 4.0, 64, 1, true);
      const bodyMat = new THREE.MeshPhysicalMaterial({
        map: textures.map,
        bumpMap: textures.bumpMap,
        // No constant emissive — logo colors are natural, not glowing
        emissive: new THREE.Color(0x000000),
        emissiveMap: textures.emissiveMap,
        emissiveIntensity: 0,
        bumpScale: 0.022, // slightly more pronounced micro-relief
        roughnessMap: textures.roughnessMap, // smooth ink vs rough paper
        metalness: 0.01,
        roughness: 0.82,   // matte paper base
        side: THREE.DoubleSide,
        color: 0xffffff,
        clearcoat: 0.28,            // lamination sheen — more visible
        clearcoatRoughness: 0.18,   // slightly shiny coating
        sheen: 0.35,                // subtle velvet sheen on paper edges
        sheenRoughness: 0.75,
        sheenColor: new THREE.Color(0xfff8f0),
      });
      const cupBody = new THREE.Mesh(bodyGeom, bodyMat);
      cupBody.castShadow = true;
      cupBody.receiveShadow = true;
      
      // Rotate cup body so the logo (centered on the texture) faces the camera directly
      cupBody.rotation.y = Math.PI;
      cupGroup.add(cupBody);

      // B. Cup Bottom
      const bottomGeom = new THREE.CircleGeometry(1.15, 64);
      const bottomMat = new THREE.MeshStandardMaterial({
        color: 0xf0ede8,
        roughness: 0.9,
        metalness: 0.0,
      });
      const bottom = new THREE.Mesh(bottomGeom, bottomMat);
      bottom.rotation.x = Math.PI / 2;
      bottom.position.y = -2.0;
      cupGroup.add(bottom);

      // C. Coffee surface (Espresso crema texture)
      const coffeeGeom = new THREE.CircleGeometry(1.62, 64);
      const coffeeTex = createCoffeeTexture();
      const coffeeMat = new THREE.MeshStandardMaterial({
        map: coffeeTex,
        roughness: 0.05,
        metalness: 0.15,
      });
      const coffee = new THREE.Mesh(coffeeGeom, coffeeMat);
      coffee.rotation.x = -Math.PI / 2;
      coffee.position.y = 1.88;
      cupGroup.add(coffee);

      // D. Cup Rim
      const rimGeom = new THREE.TorusGeometry(1.7, 0.08, 16, 64);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xf5f2ee,
        roughness: 0.5,
        metalness: 0.05,
      });
      const rim = new THREE.Mesh(rimGeom, rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 2.0;
      cupGroup.add(rim);

      // ─── 4. Double Shadow System ────────────────────────────────────

      // Shadow 1: Real-time dynamic soft shadow map plane (large, receives cast shadow)
      const shadowGeo = new THREE.PlaneGeometry(40, 40);
      const shadowMat2 = new THREE.ShadowMaterial({
        opacity: 0.18,
        fog: false,
        depthWrite: false,
      });
      const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat2);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -2.0;
      shadowPlane.receiveShadow = true;
      shadowPlane.renderOrder = 1;
      scene.add(shadowPlane);

      // Shadow 2: Contact Shadow — elliptical, soft, COMPLETE under the cup base
      // Use a larger canvas (512) for a smooth gradient without pixelation
      const CS_SIZE = 512;
      const csGeo = new THREE.PlaneGeometry(4.8, 3.2); // ellipse shape: wider than deep
      const csCanvas = document.createElement('canvas');
      csCanvas.width = CS_SIZE;
      csCanvas.height = CS_SIZE;
      const csCtx = csCanvas.getContext('2d')!;

      // Save/restore + scale to make an elliptical radial gradient
      csCtx.save();
      csCtx.scale(1, 0.55); // squash vertically → ellipse
      const cx = CS_SIZE / 2;
      const cy = CS_SIZE / 2 / 0.55; // compensate for scale
      const grad = csCtx.createRadialGradient(cx, cy, 0, cx, cy, CS_SIZE * 0.46);
      grad.addColorStop(0,    'rgba(0,0,0,0.88)');  // dense AO right under cup
      grad.addColorStop(0.18, 'rgba(0,0,0,0.72)');
      grad.addColorStop(0.45, 'rgba(0,0,0,0.38)');
      grad.addColorStop(0.72, 'rgba(0,0,0,0.12)');
      grad.addColorStop(1,    'rgba(0,0,0,0)');
      csCtx.fillStyle = grad;
      csCtx.fillRect(0, 0, CS_SIZE, CS_SIZE / 0.55);
      csCtx.restore();

      const csTex = new THREE.CanvasTexture(csCanvas);
      const csMat = new THREE.MeshBasicMaterial({
        map: csTex,
        transparent: true,
        depthWrite: false,
      });
      const contactShadow = new THREE.Mesh(csGeo, csMat);
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = -1.994; // just above shadowPlane
      contactShadow.renderOrder = 2;
      scene.add(contactShadow);

      // ─── 5. Animation Timeline ────────────────────────────────────
      const clock = new THREE.Clock(false); // prevent autoStart during loading
      let animTime = 0;
      let frameId = 0;
      let whooshPlayed = false;
      let clickPlayed = false;
      let shinePlayed = false;
      let exitWhooshPlayed = false;
      let finished = false;

      // Initial state: invisible, far away
      cupGroup.scale.set(0, 0, 0);
      cupGroup.position.set(0, 4, -14);
      cupGroup.rotation.set(0.15, 6.0 * Math.PI, 0);

      // ─── TIMELINE (3.5s total) ────────────────────────────────────
      const PHASE_FLY    = 1.0;
      const PHASE_SETTLE = 1.4;
      const PHASE_WOBBLE = 1.8;
      const PHASE_SHINE  = 2.6;
      const PHASE_HOLD   = 2.8;
      const PHASE_EXIT   = 3.5;

      // Collect all materials for exit fade
      const allMats = [bodyMat, bottomMat, coffeeMat, rimMat, csMat];

      const animate = () => {
        if (!active || finished) return;
        frameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        animTime += delta;

        // ── PHASE 1: FLY IN + SPIN ────────────────────────────────
        if (animTime < PHASE_FLY) {
          if (!whooshPlayed) { playSFX('whoosh'); whooshPlayed = true; }

          const t = animTime / PHASE_FLY;
          const ease = 1 - Math.pow(2, -10 * t);

          cupGroup.scale.setScalar(ease);
          cupGroup.position.z = THREE.MathUtils.lerp(-14, 0, ease);
          cupGroup.position.y = THREE.MathUtils.lerp(5, 0, ease);
          cupGroup.rotation.y = THREE.MathUtils.lerp(6.0 * Math.PI, 0, ease);
          cupGroup.rotation.x = THREE.MathUtils.lerp(0.15, 0, ease);
        }

        // ── PHASE 2: SETTLE BOUNCE ────────────────────────────────
        else if (animTime < PHASE_SETTLE) {
          if (!clickPlayed) { playSFX('click'); clickPlayed = true; }

          const localT = (animTime - PHASE_FLY) / (PHASE_SETTLE - PHASE_FLY);
          const spring = Math.sin(localT * Math.PI * 2.5) * Math.exp(-localT * 5);
          cupGroup.scale.set(1 + spring * 0.05, 1 - spring * 0.1, 1 + spring * 0.05);
          cupGroup.position.y = spring * -0.15;
        }

        // ── PHASE 3: WOBBLE ───────────────────────────────────────
        else if (animTime < PHASE_WOBBLE) {
          cupGroup.scale.set(1, 1, 1);
          cupGroup.position.y = 0;
          const localT = animTime - PHASE_SETTLE;
          cupGroup.rotation.z = Math.sin(localT * 28) * 0.035 * Math.exp(-localT * 6);
          cupGroup.rotation.x = Math.cos(localT * 22) * 0.015 * Math.exp(-localT * 5);
        }

        // ── PHASE 4: LOGO SHINE ───────────────────────────────────
        else if (animTime < PHASE_SHINE) {
          if (!shinePlayed) { playSFX('shine'); shinePlayed = true; }

          cupGroup.rotation.z = 0;
          cupGroup.rotation.x = 0;

          const localT = (animTime - PHASE_WOBBLE) / (PHASE_SHINE - PHASE_WOBBLE);

          bodyMat.emissive = new THREE.Color(0x000000);
          bodyMat.emissiveMap = textures.emissiveMap;
          bodyMat.emissiveIntensity = 0;

          cupGroup.rotation.y = Math.sin(localT * Math.PI) * 0.35;
          brandSpot.position.x = THREE.MathUtils.lerp(-4.5, 4.5, localT);
          cupGroup.position.y = Math.sin(localT * Math.PI) * 0.12;
          
          brandSpot.color = new THREE.Color(0xffffff);
          brandSpot.intensity = Math.sin(localT * Math.PI) * 5.2;
        }

        // ── PHASE 5: HOLD ─────────────────────────────────────────
        else if (animTime < PHASE_HOLD) {
          // Reset emissive to zero after shine — natural look
          bodyMat.emissive = new THREE.Color(0x000000);
          bodyMat.emissiveIntensity = 0;
          cupGroup.rotation.y = 0;
          cupGroup.position.y = Math.sin(animTime * 3) * 0.02;
        }

        // ── PHASE 6: EXIT — Dynamic Vortex Spin & Upward Rocket Launch
        else if (animTime >= PHASE_HOLD) {
          const exitDuration = PHASE_EXIT - PHASE_HOLD;
          const exitT = Math.min((animTime - PHASE_HOLD) / exitDuration, 1.0);

          if (exitT >= 1.0) {
            finished = true;
            cancelAnimationFrame(frameId);
            onAnimationComplete();
            return;
          }

          if (exitT < 0.35) {
            // Sub-phase 1: Charge up (Squash down, tilt back, intense cyan glow)
            const t = exitT / 0.35;
            const squashY = THREE.MathUtils.lerp(1.0, 0.76, t);
            const squashXZ = THREE.MathUtils.lerp(1.0, 1.14, t);
            
            cupGroup.scale.set(squashXZ, squashY, squashXZ);
            cupGroup.position.y = THREE.MathUtils.lerp(0, -0.42, t);
            cupGroup.rotation.x = THREE.MathUtils.lerp(0, -0.16, t);
            cupGroup.rotation.y = 0;
            cupGroup.rotation.z = 0;

            bodyMat.emissive = new THREE.Color(0x000000);
            bodyMat.emissiveIntensity = 0;
            brandSpot.intensity = 0;
            brandSpot.color = new THREE.Color(0xffffff);

            // Simple opacity (solid)
            allMats.forEach((mat) => {
              mat.transparent = true;
              mat.opacity = 1.0;
            });
            shadowMat2.opacity = 0.18;
          } else {
            // Sub-phase 2: Rocket vortex launch (Super spin, shoot upwards, fade to 0)
            if (!exitWhooshPlayed) {
              playSFX('whoosh');
              exitWhooshPlayed = true;
            }

            const t = (exitT - 0.35) / 0.65;
            const easeIn = t * t * t; // exponential curve

            // Shoot upwards and slightly back/left (cinematic curve)
            cupGroup.position.y = THREE.MathUtils.lerp(-0.42, 12.0, easeIn);
            cupGroup.position.z = THREE.MathUtils.lerp(0, -12.0, easeIn);
            cupGroup.position.x = THREE.MathUtils.lerp(0, -3.5, easeIn);

            const shrink = 1.0 - t;
            cupGroup.scale.set(
              1.14 * shrink,
              0.76 * shrink,
              1.14 * shrink
            );

            // Rapid rotation spin on all axes
            cupGroup.rotation.y = THREE.MathUtils.lerp(0, 12.0 * Math.PI, t); // 6 full spins!
            cupGroup.rotation.x = THREE.MathUtils.lerp(-0.16, 0.75, t);
            cupGroup.rotation.z = THREE.MathUtils.lerp(0, -0.55, t);

            // Opacity and glow fade out rapidly
            const opacity = 1.0 - t * t;
            allMats.forEach((mat) => {
              mat.transparent = true;
              mat.opacity = opacity;
            });
            bodyMat.emissiveIntensity = 0;
            brandSpot.intensity = 0;
          }
        }

        // --- Dynamic Shadow updates at the end of the frame ---
        const cupHeight = cupGroup.position.y;
        const cupScaleX = cupGroup.scale.x;
        const cupScaleZ = cupGroup.scale.z;

        // 1. Contact shadow scale: expands as height increases, contracts as it approaches floor
        const heightScaleFactor = 1.0 + Math.max(0, cupHeight) * 0.18;
        contactShadow.scale.set(cupScaleX * heightScaleFactor, cupScaleZ * heightScaleFactor, 1.0);

        // 2. Contact shadow offset: matches the keyLight (6, 9, 6) projection direction
        const shiftX = -0.55 * cupHeight;
        const shiftZ = -0.55 * cupHeight;
        contactShadow.position.set(shiftX, -1.994, shiftZ);

        // 3. Contact shadow opacity:
        // Base contact shadow opacity is 0.88 when on ground.
        // It gets transparent as the cup gets higher.
        const heightOpacity = Math.max(0.0, 1.0 - Math.max(0, cupHeight) * 0.28);
        
        let fadeOpacity = 1.0;
        if (animTime >= PHASE_HOLD) {
          const exitDuration = PHASE_EXIT - PHASE_HOLD;
          const exitT = Math.min((animTime - PHASE_HOLD) / exitDuration, 1.0);
          if (exitT > 0.35) {
            const t = (exitT - 0.35) / 0.65;
            fadeOpacity = 1.0 - t * t;
          }
        }
        csMat.opacity = 0.88 * heightOpacity * fadeOpacity;

        // 4. Dynamic Cast Shadow Opacity:
        // Fade the dynamic shadow map as the cup rises.
        shadowMat2.opacity = 0.18 * heightOpacity * fadeOpacity;

        renderer.render(scene, camera);
      };

      const startAnimation = () => {
        // GPU Warm-up render to prevent first-frame lag
        renderer.render(scene, camera);
        clock.start();
        animate();
      };

      startSignalRef.current = startAnimation;

      // ─── Resize handler ───────────────────────────────────────────
      const handleResize = () => {
        if (!active) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      // ─── Store cleanup function ───────────────────────────────────
      localCleanup = () => {
        finished = true;
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', handleResize);
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        bodyGeom.dispose(); bodyMat.dispose();
        bottomGeom.dispose(); bottomMat.dispose();
        coffeeGeom.dispose(); coffeeMat.dispose();
        rimGeom.dispose(); rimMat.dispose();
        shadowGeo.dispose(); shadowMat2.dispose();
        csGeo.dispose(); csMat.dispose();
        textures.map.dispose(); textures.emissiveMap.dispose();
        textures.bumpMap.dispose(); textures.roughnessMap.dispose();
        coffeeTex.dispose(); csTex.dispose();
        renderer.dispose();
      };
    }

    // ─── Cleanup on unmount ──────────────────────────────────────────
    return () => {
      active = false;
      clearInterval(progressInterval);
      if (localCleanup) {
        localCleanup();
        localCleanup = null;
      }
    };
  }, [onAnimationComplete]);

  const triggerStart = () => {
    // 1. Play click sound and initialize AudioContext directly via user action
    playSFX('click');
    // 2. Hide preloader overlay
    setHasStarted(true);
    // 3. Start 3D rendering loop
    if (startSignalRef.current) {
      startSignalRef.current();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        ref={mountRef}
        className="w-full h-full max-w-[500px] mx-auto flex items-center justify-center select-none"
        style={{ overflow: 'visible', visibility: hasStarted ? 'visible' : 'hidden' }}
      />
      
      {!hasStarted && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <div style={{ textAlign: 'center', width: '80%', maxWidth: '280px' }}>
            {!isLoaded && (
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.25em', color: '#2BA8E0', marginBottom: '1rem', fontWeight: 800 }}>
                Loading 3D Assets...
              </div>
            )}
            
            {!isLoaded ? (
              <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${loadProgress}%`, background: '#2BA8E0', transition: 'width 0.15s ease' }} />
              </div>
            ) : (
              <button
                onClick={triggerStart}
                style={{
                  background: 'transparent',
                  border: '1px solid #2BA8E0',
                  color: '#2BA8E0',
                  padding: '0.8rem 1.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(43, 168, 224, 0.2)',
                  transition: 'all 0.3s ease',
                  animation: 'pulse-glow-button 1.5s infinite alternate ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2BA8E0';
                  e.currentTarget.style.color = '#151314';
                  e.currentTarget.style.boxShadow = '0 0 35px rgba(43, 168, 224, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#2BA8E0';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(43, 168, 224, 0.2)';
                }}
              >
                [ Start Experience ]
              </button>
            )}
          </div>
          
          <style>{`
            @keyframes pulse-glow-button {
              0% { box-shadow: 0 0 15px rgba(43, 168, 224, 0.15); border-color: rgba(43, 168, 224, 0.4); }
              100% { box-shadow: 0 0 25px rgba(43, 168, 224, 0.55); border-color: rgba(43, 168, 224, 1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
