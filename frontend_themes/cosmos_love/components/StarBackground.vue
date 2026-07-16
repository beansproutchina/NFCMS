<template>
  <div ref="containerRef" class="star-bg"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

const containerRef = ref<HTMLDivElement>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let animationId = 0;
let stars: THREE.Points | null = null;
let starLayers: THREE.Points[] = [];
let shootingStars: THREE.Line[] = [];
let mouseX = 0;
let mouseY = 0;

onMounted(() => {
  if (!containerRef.value) return;
  initScene();
  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('mousemove', onMouseMove);
  renderer?.dispose();
});

function initScene() {
  const container = containerRef.value!;
  const w = window.innerWidth;
  const h = window.innerHeight;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, w / h, 1, 2000);
  camera.position.z = 500;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Star textures
  const texSmall = createStarTexture(32, false);
  const texMedium = createStarTexture(64, true);
  const texLarge = createStarTexture(128, true);

  // Stars layer 1: distant small stars
  const geo1 = createStarGeometry(3000, 800, 1.2);
  const mat1 = new THREE.PointsMaterial({
    color: 0xeeddff,
    size: 2,
    map: texSmall,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const layer1 = new THREE.Points(geo1, mat1);
  scene.add(layer1);

  // Stars layer 2: medium bright stars
  const geo2 = createStarGeometry(800, 600, 2);
  const mat2 = new THREE.PointsMaterial({
    color: 0xffccee,
    size: 3.5,
    map: texMedium,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const layer2 = new THREE.Points(geo2, mat2);
  scene.add(layer2);

  // Stars layer 3: close bright stars with warm colors
  const geo3 = createStarGeometry(200, 500, 3);
  const mat3 = new THREE.PointsMaterial({
    color: 0xff99bb,
    size: 6,
    map: texLarge,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const layer3 = new THREE.Points(geo3, mat3);
  scene.add(layer3);

  stars = layer1;
  starLayers = [layer1, layer2, layer3];

  // Nebula glow blobs
  addNebula(0xff6b9d, 200, -100, 0.15);
  addNebula(0xb388ff, -250, 150, 0.1);
  addNebula(0xffab91, 100, 200, 0.08);

  animate();
}

function createStarTexture(size = 64, glow = true) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  if (glow) {
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createStarGeometry(count: number, spread: number, _size: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geo;
}

function addNebula(color: number, x: number, y: number, opacity: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${opacity})`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(x, y, -100);
  sprite.scale.set(600, 600, 1);
  scene!.add(sprite);
}

function createShootingStar() {
  if (Math.random() > 0.003 || !scene) return;
  const points = [];
  const startX = (Math.random() - 0.5) * 800;
  const startY = 300 + Math.random() * 200;
  const length = 80 + Math.random() * 120;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    points.push(new THREE.Vector3(startX + t * length, startY - t * length * 0.6, 0));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: 0xffd54f,
    transparent: true,
    opacity: 0.9,
  });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  shootingStars.push(line);

  let fade = 1;
  const fadeOut = () => {
    fade -= 0.03;
    if (fade <= 0) {
      scene!.remove(line);
      geo.dispose();
      mat.dispose();
      shootingStars = shootingStars.filter(s => s !== line);
      return;
    }
    mat.opacity = fade;
    requestAnimationFrame(fadeOut);
  };
  requestAnimationFrame(fadeOut);
}

function animate() {
  if (!renderer || !scene || !camera) return;
  animationId = requestAnimationFrame(animate);

  const time = Date.now() * 0.0001;

  // Parallax mouse movement
  camera.position.x += (mouseX * 30 - camera.position.x) * 0.02;
  camera.position.y += (-mouseY * 30 - camera.position.y) * 0.02;
  camera.lookAt(scene.position);

  // Slow rotation for depth
  scene.rotation.y = time * 0.1;
  scene.rotation.x = Math.sin(time * 0.5) * 0.02;

  // Twinkle effect
  starLayers.forEach((layer, i) => {
    const mat = layer.material as THREE.PointsMaterial;
    const base = [0.7, 0.85, 0.95][i];
    mat.opacity = base + Math.sin(time * (8 + i * 3)) * 0.08;
  });

  createShootingStar();

  renderer.render(scene, camera);
}

function onResize() {
  if (!renderer || !camera) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function onMouseMove(e: MouseEvent) {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = (e.clientY / window.innerHeight) * 2 - 1;
}
</script>

<style scoped>
.star-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
.star-bg canvas {
  display: block;
}
</style>
