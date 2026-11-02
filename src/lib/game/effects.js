import * as THREE from 'three';
import { GLOW_TEXTURE } from './models.js';

const PINK = new THREE.Color(0xff5fdc);
const VIOLET = new THREE.Color(0xa35cff);
const MINT = new THREE.Color(0x7dffd2);
const WHITE = new THREE.Color(0xffe9fb);
const GOLD = new THREE.Color(0xffcf63);

/* ------------------------------------------------------------------ */
/*  Tractor beam                                                       */
/* ------------------------------------------------------------------ */

export function createBeam(scene) {
  const group = new THREE.Group();
  group.name = 'tractor-beam';
  group.visible = false;
  scene.add(group);

  const outerMaterial = new THREE.MeshBasicMaterial({
    color: 0x6d21e8,
    transparent: true,
    opacity: 0.2,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 3.25, 1, 40, 1, true), outerMaterial);
  group.add(outer);

  const midMaterial = new THREE.MeshBasicMaterial({
    color: 0xff35d0,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 1.75, 1, 32, 1, true), midMaterial);
  group.add(mid);

  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xff8ff2,
    transparent: true,
    opacity: 0.05,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.48, 1, 24, 1, true), coreMaterial);
  group.add(core);

  // travelling hoops
  const hoops = [];
  for (let i = 0; i < 7; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 ? 0x9e5cff : 0xff5bdc,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 6, 40), mat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    hoops.push({ mesh: ring, offset: i / 7, mat });
  }

  // rising spiral motes
  const particleCount = 170;
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  const angles = new Float32Array(particleCount);
  const radii = new Float32Array(particleCount);
  const progress = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    progress[i] = Math.random();
    angles[i] = Math.random() * Math.PI * 2;
    radii[i] = 0.1 + Math.random() * 0.71;
    speeds[i] = 0.1 + Math.random() * 0.17;
    positions[i * 3 + 1] = -0.5 + progress[i];
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0xff9df3,
    size: 0.12,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  group.add(particles);

  const groundGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(8.5, 8.5),
    new THREE.MeshBasicMaterial({
      map: GLOW_TEXTURE,
      color: 0xff3ed4,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.y = 0.06;
  scene.add(groundGlow);

  const beamLight = new THREE.PointLight(0xff64dc, 0, 18, 2);
  scene.add(beamLight);
  const shipBeamLight = new THREE.PointLight(0xff4fd8, 0, 15, 2);
  scene.add(shipBeamLight);

  const emitterWorld = new THREE.Vector3();
  const targetWorld = new THREE.Vector3();
  const midpoint = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let currentLength = 1;

  function update(time, dt, emitter, target, active, intensity = 1) {
    group.visible = active;
    groundGlow.visible = active;
    beamLight.intensity = active ? 11 * intensity : 0;
    shipBeamLight.intensity = active ? 17 * intensity : 0;

    if (!active) {
      return;
    }

    emitter.getWorldPosition(emitterWorld);
    targetWorld.copy(target);
    targetWorld.y = Math.max(0.08, targetWorld.y);
    const length = emitterWorld.distanceTo(targetWorld);
    currentLength = length;
    midpoint.copy(emitterWorld).add(targetWorld).multiplyScalar(0.5);
    direction.copy(emitterWorld).sub(targetWorld).normalize();

    group.position.copy(midpoint);
    group.quaternion.setFromUnitVectors(up, direction);
    group.scale.set(1, length, 1);

    const flicker = 0.9 + Math.sin(time * 18) * 0.05 + Math.sin(time * 7.1) * 0.05;
    outerMaterial.opacity = 0.2 * flicker * intensity;
    midMaterial.opacity = 0.12 * flicker * intensity;
    coreMaterial.opacity = 0.05 * flicker * intensity;

    hoops.forEach((hoop, i) => {
      let p = (time * 0.24 + hoop.offset + i * 0.014) % 1;
      p = 1 - p;
      // local -0.5 is ground, +0.5 is the saucer
      const localY = -0.5 + p;
      const radius = 3.1 * (1 - p) + 0.16;
      hoop.mesh.position.y = localY;
      hoop.mesh.scale.set(radius, radius, 1);
      hoop.mat.opacity = (0.22 + Math.sin(p * Math.PI) * 0.48) * intensity;
      hoop.mesh.rotation.z = time * 0.45 + i;
    });

    const posAttr = particleGeo.attributes.position;
    const array = posAttr.array;
    for (let i = 0; i < particleCount; i += 1) {
      progress[i] += dt * speeds[i];
      if (progress[i] > 1) {
        progress[i] -= 1;
        angles[i] = Math.random() * Math.PI * 2;
        radii[i] = 0.1 + Math.random() * 0.7;
      }
      const p = progress[i];
      const radius = (3.05 * (1 - p) + 0.12) * radii[i];
      const angle = angles[i] + time * (0.55 + i % 3 * 0.16);
      array[i * 3] = Math.cos(angle) * radius;
      array[i * 3 + 1] = -0.5 + p;
      array[i * 3 + 2] = Math.sin(angle) * radius;
    }
    posAttr.needsUpdate = true;

    groundGlow.position.x = targetWorld.x;
    groundGlow.position.z = targetWorld.z;
    const pulse = 1 + Math.sin(time * 5.7) * 0.08;
    groundGlow.scale.set(pulse, pulse, 1);
    groundGlow.material.opacity = active ? 0.26 * flicker * intensity : 0;

    beamLight.position.set(targetWorld.x, 1.6, targetWorld.z);
    shipBeamLight.position.copy(emitterWorld).add(new THREE.Vector3(0, -1.2, 0));
  }

  return {
    group,
    update,
    groundGlow,
    beamLight,
    shipBeamLight,
    currentLength,
  };
}

/* ------------------------------------------------------------------ */
/*  Target reticle                                                     */
/* ------------------------------------------------------------------ */

export function createReticle(scene) {
  const group = new THREE.Group();
  group.name = 'target-reticle';
  group.visible = false;
  scene.add(group);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x82ffe1,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.34, 40), ringMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.1;
  const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.87, 32), ringMat.clone());
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.1;
  group.add(outerRing, innerRing);

  const tickMat = new THREE.MeshBasicMaterial({ color: 0xff73e4, toneMapped: false, transparent: true, opacity: 0.95 });
  for (let i = 0; i < 4; i += 1) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.07), tickMat);
    const angle = (i / 4) * Math.PI * 2;
    tick.position.set(Math.cos(angle) * 1.55, 0.11, Math.sin(angle) * 1.55);
    tick.rotation.y = -angle;
    group.add(tick);
  }

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.7, 3.7),
    new THREE.MeshBasicMaterial({
      map: GLOW_TEXTURE,
      color: 0x6bffe0,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.07;
  group.add(glow);

  const diamondMat = new THREE.MeshBasicMaterial({ color: 0xffe9ff, toneMapped: false });
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), diamondMat);
  diamond.position.y = 2.2;
  group.add(diamond);
  const diamondGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW_TEXTURE,
    color: 0xff6fe4,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  diamondGlow.scale.setScalar(1.6);
  diamondGlow.position.y = 2.2;
  group.add(diamondGlow);

  let visible = false;
  let lifted = false;

  function update(time, dt, position, isLifting, liftHeight = 0) {
    if (!position) {
      group.visible = false;
      visible = false;
      return;
    }
    group.visible = true;
    visible = true;
    lifted = isLifting;
    group.position.set(position.x, 0, position.z);
    outerRing.rotation.z += dt * 0.9;
    innerRing.rotation.z -= dt * 1.4;
    const pulse = 1 + Math.sin(time * 4.5) * 0.07;
    outerRing.scale.setScalar(pulse);
    innerRing.scale.setScalar(1 + Math.sin(time * 4.5 + 1.2) * 0.05);
    ringMat.opacity = isLifting ? 1 : 0.68;
    innerRing.material.opacity = isLifting ? 1 : 0.54;
    ringMat.color.set(isLifting ? 0xff7de6 : 0x82ffe1);
    innerRing.material.color.set(isLifting ? 0xffc2f4 : 0xcbfff2);
    tickMat.color.set(isLifting ? 0xffffff : 0xff73e4);
    diamond.position.y = 2.15 + liftHeight + Math.sin(time * 4.2) * 0.13;
    diamond.rotation.y += dt * 2.4;
    diamond.rotation.x += dt * 0.8;
    diamondGlow.position.y = diamond.position.y;
    diamondGlow.scale.setScalar(1.5 + Math.sin(time * 5.1) * 0.2);
    const ringFade = 1 - Math.min(1, liftHeight / 5) * 0.65;
    ringMat.opacity *= ringFade;
    innerRing.material.opacity *= ringFade;
  }

  return { group, update, isVisible: () => visible, isLifted: () => lifted };
}

/* ------------------------------------------------------------------ */
/*  Particle bursts                                                    */
/* ------------------------------------------------------------------ */

export function createParticles(scene, capacity = 420) {
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const baseColors = new Float32Array(capacity * 3);
  const velocities = new Float32Array(capacity * 3);
  const life = new Float32Array(capacity);
  const maxLife = new Float32Array(capacity);
  const gravity = new Float32Array(capacity);
  const drag = new Float32Array(capacity);

  for (let i = 0; i < capacity; i += 1) {
    positions[i * 3 + 1] = -999;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.22,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;
  const tempColor = new THREE.Color();

  function spawn(origin, options = {}) {
    const {
      count = 26,
      palette = [PINK, VIOLET, WHITE],
      speed = 2.5,
      spread = 1.2,
      upward = 2.2,
      lifeMin = 0.55,
      lifeMax = 1.2,
      gravityValue = -3.5,
      dragValue = 0.98,
      shape = 'sphere',
      radius = 0.2,
    } = options;

    for (let i = 0; i < count; i += 1) {
      const index = cursor;
      cursor = (cursor + 1) % capacity;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      const px = origin.x + (shape === 'ring' ? Math.cos(angle) * radius : (Math.random() - 0.5) * radius);
      const py = origin.y + (shape === 'ring' ? 0 : (Math.random() - 0.5) * radius);
      const pz = origin.z + (shape === 'ring' ? Math.sin(angle) * radius : (Math.random() - 0.5) * radius);
      positions[index * 3] = px;
      positions[index * 3 + 1] = py;
      positions[index * 3 + 2] = pz;

      const outSpeed = Math.random() * speed;
      velocities[index * 3] = Math.cos(angle) * outSpeed + (Math.random() - 0.5) * 0.8;
      velocities[index * 3 + 1] = upward * (0.35 + Math.random() * 0.8);
      velocities[index * 3 + 2] = Math.sin(angle) * outSpeed + (Math.random() - 0.5) * 0.8;

      tempColor.copy(palette[Math.floor(Math.random() * palette.length)]);
      baseColors[index * 3] = tempColor.r;
      baseColors[index * 3 + 1] = tempColor.g;
      baseColors[index * 3 + 2] = tempColor.b;
      colors[index * 3] = tempColor.r;
      colors[index * 3 + 1] = tempColor.g;
      colors[index * 3 + 2] = tempColor.b;

      const l = lifeMin + Math.random() * (lifeMax - lifeMin);
      life[index] = l;
      maxLife[index] = l;
      gravity[index] = gravityValue;
      drag[index] = dragValue;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  function update(dt) {
    let dirty = false;
    for (let i = 0; i < capacity; i += 1) {
      if (life[i] <= 0) continue;
      dirty = true;
      life[i] -= dt;
      if (life[i] <= 0) {
        positions[i * 3 + 1] = -999;
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
        continue;
      }
      const damping = Math.pow(drag[i], dt * 60);
      velocities[i * 3] *= damping;
      velocities[i * 3 + 1] += gravity[i] * dt;
      velocities[i * 3 + 2] *= damping;
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;

      const fade = Math.min(1, life[i] / (maxLife[i] * 0.6));
      colors[i * 3] = baseColors[i * 3] * fade;
      colors[i * 3 + 1] = baseColors[i * 3 + 1] * fade;
      colors[i * 3 + 2] = baseColors[i * 3 + 2] * fade;
    }
    if (dirty) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
  }

  function celebration(origin) {
    spawn(origin, {
      count: 90,
      palette: [PINK, VIOLET, MINT, GOLD, WHITE, new THREE.Color(0x6fc9ff)],
      speed: 5.5,
      spread: 2,
      upward: 5.5,
      lifeMin: 1.0,
      lifeMax: 2.2,
      gravityValue: -5.2,
      dragValue: 0.985,
      radius: 1.2,
    });
  }

  return { spawn, update, celebration };
}
