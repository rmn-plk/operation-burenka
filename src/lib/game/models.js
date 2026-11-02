import * as THREE from 'three';
import { mergeImmediateMeshes, mergeVertexColoredMeshes } from './merge-utils.js';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

export const MAT = {
  cowWhite: new THREE.MeshStandardMaterial({ color: 0xf4f0df, roughness: 0.92 }),
  cowBlack: new THREE.MeshStandardMaterial({ color: 0x24201e, roughness: 0.88 }),
  cowPink: new THREE.MeshStandardMaterial({ color: 0xf39aa7, roughness: 0.8 }),
  hoof: new THREE.MeshStandardMaterial({ color: 0x34251f, roughness: 0.88 }),
  horn: new THREE.MeshStandardMaterial({ color: 0xe9d8a6, roughness: 0.65 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x100d0b, roughness: 0.28 }),
  alienSkin: new THREE.MeshStandardMaterial({ color: 0x4f8f49, roughness: 0.62, emissive: 0x173f12, emissiveIntensity: 0.6 }),
  alienDark: new THREE.MeshStandardMaterial({ color: 0x365c35, roughness: 0.68 }),
  alienEye: new THREE.MeshStandardMaterial({ color: 0x06070a, roughness: 0.08, metalness: 0.15 }),
  alienSuit: new THREE.MeshStandardMaterial({ color: 0x3f5141, roughness: 0.7 }),
  barnRed: new THREE.MeshStandardMaterial({ color: 0x9e312c, roughness: 0.9 }),
  barnDark: new THREE.MeshStandardMaterial({ color: 0x5a1b1a, roughness: 0.92 }),
  barnRoof: new THREE.MeshStandardMaterial({ color: 0x3a2028, roughness: 0.82 }),
  whiteWood: new THREE.MeshStandardMaterial({ color: 0xece3d2, roughness: 0.8 }),
  silo: new THREE.MeshStandardMaterial({ color: 0xa7b1b2, metalness: 0.55, roughness: 0.45 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5a3826, roughness: 1 }),
  leafA: new THREE.MeshStandardMaterial({ color: 0x2f6d39, roughness: 0.95 }),
  leafB: new THREE.MeshStandardMaterial({ color: 0x3f8742, roughness: 0.95 }),
  leafC: new THREE.MeshStandardMaterial({ color: 0x245a34, roughness: 0.95 }),
  hay: new THREE.MeshStandardMaterial({ color: 0xd8a64b, roughness: 0.95 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0x6f4a2e, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x807b72, roughness: 0.95 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x323846, metalness: 0.7, roughness: 0.38 }),
};

// one shared material keeps every batched cow part in a single draw call
const cowVertexMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.9,
  metalness: 0.02,
});

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.25, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const GLOW_TEXTURE = glowTexture();

export function textTexture(lines, options = {}) {
  const {
    width = 640,
    height = 320,
    background = '#f0e3c8',
    color = '#3d241b',
    border = '#b48e5f',
    accent = '#9e312c',
    titleSize = 70,
  } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = border;
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 14, width - 28, height - 28);
  ctx.fillStyle = accent;
  ctx.fillRect(14, 14, width - 28, 12);
  ctx.textAlign = 'center';

  const lineArray = Array.isArray(lines) ? lines : [lines];
  lineArray.forEach((line, index) => {
    const isFirst = index === 0;
    ctx.fillStyle = isFirst ? color : '#6b4a36';
    ctx.font = `${isFirst ? '900' : '700'} ${isFirst ? titleSize : Math.round(titleSize * 0.34)}px Arial, sans-serif`;
    ctx.fillText(line, width / 2, height / 2 + (isFirst ? 8 : 58));
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/* ------------------------------------------------------------------ */
/*  Cow                                                                */
/* ------------------------------------------------------------------ */

export function createCowModel() {
  const model = new THREE.Group();
  model.name = 'cow-model';

  const bodyPivot = new THREE.Group();
  model.add(bodyPivot);

  const body = box(1.08, 0.86, 1.82, MAT.cowWhite, 0, 1.23, 0);
  bodyPivot.add(body);

  // black dairy-cow patches
  const sidePatchL = box(0.035, 0.43, 0.6, MAT.cowBlack, 0.555, 1.28, -0.12);
  sidePatchL.rotation.z = 0.12;
  const sidePatchR = box(0.035, 0.36, 0.5, MAT.cowBlack, -0.555, 1.16, 0.45);
  const topPatch = box(0.5, 0.035, 0.64, MAT.cowBlack, -0.12, 1.665, -0.25);
  const topPatch2 = box(0.36, 0.035, 0.36, MAT.cowBlack, 0.28, 1.668, 0.62);
  bodyPivot.add(sidePatchL, sidePatchR, topPatch, topPatch2);

  const rumpPatch = box(0.62, 0.5, 0.03, MAT.cowBlack, 0, 1.27, -0.92);
  bodyPivot.add(rumpPatch);

  const udder = box(0.46, 0.26, 0.5, MAT.cowPink, 0, 0.77, -0.38);
  bodyPivot.add(udder);
  for (let i = 0; i < 4; i += 1) {
    const teat = box(0.055, 0.16, 0.055, MAT.cowPink, -0.15 + (i % 2) * 0.3, 0.59, -0.5 + Math.floor(i / 2) * 0.24);
    bodyPivot.add(teat);
  }

  const legs = [];
  const legData = [
    [0.42, 0.62],
    [-0.42, 0.62],
    [0.42, -0.62],
    [-0.42, -0.62],
  ];
  legData.forEach(([x, z], index) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.78, z);
    const upper = box(0.2, 0.5, 0.2, MAT.cowWhite, 0, -0.25, 0);
    const lower = box(0.17, 0.32, 0.17, MAT.cowWhite, 0, -0.63, 0);
    const hoof = box(0.2, 0.12, 0.22, MAT.hoof, 0, -0.85, 0.02);
    pivot.add(upper, lower, hoof);
    if (index > 1) {
      const patch = box(0.215, 0.18, 0.215, MAT.cowBlack, 0, -0.55, 0);
      pivot.add(patch);
    }
    bodyPivot.add(pivot);
    legs.push(pivot);
  });

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.55, 0.92);
  bodyPivot.add(headPivot);

  const neck = box(0.46, 0.4, 0.4, MAT.cowWhite, 0, -0.1, -0.12);
  const head = box(0.64, 0.58, 0.66, MAT.cowWhite, 0, 0.1, 0.22);
  const forehead = box(0.5, 0.3, 0.22, MAT.cowBlack, 0, 0.32, 0.34);
  const snout = box(0.47, 0.28, 0.3, MAT.cowPink, 0, -0.08, 0.56);
  const nostrilL = box(0.055, 0.055, 0.035, MAT.hoof, -0.11, -0.06, 0.715);
  const nostrilR = box(0.055, 0.055, 0.035, MAT.hoof, 0.11, -0.06, 0.715);
  const eyeL = box(0.075, 0.1, 0.05, MAT.eye, -0.22, 0.17, 0.54);
  const eyeR = box(0.075, 0.1, 0.05, MAT.eye, 0.22, 0.17, 0.54);
  headPivot.add(neck, head, forehead, snout, nostrilL, nostrilR, eyeL, eyeR);

  const earL = new THREE.Group();
  earL.position.set(-0.36, 0.22, 0.2);
  earL.rotation.z = 0.3;
  earL.add(box(0.28, 0.1, 0.18, MAT.cowWhite, -0.12, 0, 0));
  const earR = new THREE.Group();
  earR.position.set(0.36, 0.22, 0.2);
  earR.rotation.z = -0.3;
  earR.add(box(0.28, 0.1, 0.18, MAT.cowWhite, 0.12, 0, 0));
  headPivot.add(earL, earR);

  const hornL = box(0.07, 0.15, 0.07, MAT.horn, -0.23, 0.44, 0.23);
  hornL.rotation.z = 0.32;
  const hornR = box(0.07, 0.15, 0.07, MAT.horn, 0.23, 0.44, 0.23);
  hornR.rotation.z = -0.32;
  headPivot.add(hornL, hornR);

  const tuft = box(0.2, 0.18, 0.12, MAT.cowBlack, 0, 0.46, 0.31);
  headPivot.add(tuft);

  const bell = box(0.12, 0.14, 0.09, new THREE.MeshStandardMaterial({ color: 0xe0b64a, metalness: 0.65, roughness: 0.35 }), 0, -0.27, 0.52);
  const collar = box(0.46, 0.07, 0.37, MAT.cowBlack, 0, -0.15, 0.08);
  headPivot.add(collar, bell);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 1.48, -0.88);
  const tail = box(0.075, 0.6, 0.075, MAT.cowWhite, 0, -0.28, -0.02);
  tail.rotation.x = -0.2;
  const tailTuft = box(0.18, 0.22, 0.18, MAT.cowBlack, 0, -0.63, -0.06);
  tailPivot.add(tail, tailTuft);
  bodyPivot.add(tailPivot);

  // batch the non-animated pieces of the cow; legs, head and tail stay as
  // separate pivots so their procedural animation is preserved
  mergeVertexColoredMeshes(bodyPivot, cowVertexMaterial);
  mergeVertexColoredMeshes(headPivot, cowVertexMaterial);
  mergeVertexColoredMeshes(tailPivot, cowVertexMaterial);
  legs.forEach((leg) => mergeVertexColoredMeshes(leg, cowVertexMaterial));

  return {
    group: model,
    bodyPivot,
    headPivot,
    legs,
    tailPivot,
    earL,
    earR,
  };
}

/* ------------------------------------------------------------------ */
/*  Alien                                                              */
/* ------------------------------------------------------------------ */

export function createAlien() {
  // Broadly inspired by the big-headed grey-green Visitors from South Park:
  // oversized cranium, huge glossy black eyes, tiny mouth and a spindly body.
  const group = new THREE.Group();
  const skin = MAT.alienSkin;

  const footL = box(0.095, 0.075, 0.16, MAT.alienDark, -0.075, 0.04, 0.035);
  const footR = footL.clone();
  footR.position.x = 0.075;
  const legL = box(0.065, 0.2, 0.075, skin, -0.075, 0.16, 0);
  const legR = legL.clone();
  legR.position.x = 0.075;
  group.add(legL, legR, footL, footR);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), skin);
  torso.scale.set(0.78, 1.3, 0.62);
  torso.position.y = 0.34;
  torso.castShadow = true;
  group.add(torso);

  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), skin);
  shoulder.scale.set(1.22, 0.5, 0.66);
  shoulder.position.y = 0.46;
  group.add(shoulder);

  const neck = box(0.1, 0.14, 0.09, MAT.alienDark, 0, 0.53, 0.01);
  group.add(neck);

  // big South Park-ish head
  const head = new THREE.Group();
  head.position.set(0, 0.77, 0.03);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), skin);
  skull.scale.set(0.94, 1.16, 0.82);
  skull.castShadow = true;
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), skin);
  jaw.scale.set(0.84, 0.6, 0.68);
  jaw.position.set(0, -0.25, 0.025);
  head.add(skull, jaw);

  const eyeGeo = new THREE.SphereGeometry(0.095, 16, 12);
  const eyeL = new THREE.Mesh(eyeGeo, MAT.alienEye);
  eyeL.scale.set(1.08, 1.6, 0.42);
  eyeL.position.set(-0.105, 0.025, 0.235);
  eyeL.rotation.z = -0.18;
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.105;
  eyeR.rotation.z = 0.18;
  head.add(eyeL, eyeR);

  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const glintGeo = new THREE.SphereGeometry(0.014, 8, 6);
  const glintL = new THREE.Mesh(glintGeo, glintMat);
  glintL.position.set(-0.137, 0.075, 0.268);
  const glintR = glintL.clone();
  glintR.position.x = 0.073;
  head.add(glintL, glintR);

  const mouth = box(0.12, 0.028, 0.022, MAT.alienDark, 0, -0.16, 0.248);
  head.add(mouth);

  const browL = box(0.105, 0.022, 0.025, MAT.alienDark, -0.105, 0.155, 0.235);
  browL.rotation.z = -0.18;
  const browR = browL.clone();
  browR.position.x = 0.105;
  browR.rotation.z = 0.18;
  head.add(browL, browR);
  group.add(head);

  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(0.155 * side, 0.44, 0);
    const upper = box(0.055, 0.2, 0.06, skin, 0.018 * side, -0.09, 0);
    upper.rotation.z = 0.1 * side;
    const forearm = box(0.05, 0.18, 0.055, skin, 0.04 * side, -0.255, 0.045);
    forearm.rotation.x = -0.2;
    arm.add(upper, forearm);
    for (let i = 0; i < 3; i += 1) {
      const finger = box(0.022, 0.075, 0.022, MAT.alienDark, 0.02 * side + (i - 1) * 0.028, -0.35, 0.075);
      finger.rotation.x = -0.25;
      arm.add(finger);
    }
    return arm;
  }

  const armL = makeArm(-1);
  const armR = makeArm(1);
  group.add(armL, armR);

  mergeImmediateMeshes(group);
  mergeImmediateMeshes(head);
  mergeImmediateMeshes(armL);
  mergeImmediateMeshes(armR);

  return { group, head, armL, armR, eyeL, eyeR };
}

/* ------------------------------------------------------------------ */
/*  UFO                                                                */
/* ------------------------------------------------------------------ */

export function createUFO() {
  const root = new THREE.Group();
  root.name = 'ufo';
  const visual = new THREE.Group();
  root.add(visual);

  const hullPoints = [
    new THREE.Vector2(0.12, -0.82),
    new THREE.Vector2(0.85, -0.76),
    new THREE.Vector2(1.55, -0.58),
    new THREE.Vector2(2.65, -0.3),
    new THREE.Vector2(3.72, -0.08),
    new THREE.Vector2(4.05, 0.08),
    new THREE.Vector2(3.84, 0.27),
    new THREE.Vector2(2.7, 0.46),
    new THREE.Vector2(1.62, 0.6),
    new THREE.Vector2(1.06, 0.68),
    new THREE.Vector2(0.98, 0.74),
  ];
  const hullGeo = new THREE.LatheGeometry(hullPoints, 64);
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xc7d0e2,
    metalness: 0.8,
    roughness: 0.34,
    emissive: 0x1b2039,
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide,
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  visual.add(hull);

  // darker belly
  const belly = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 0.34, 0.44, 32),
    new THREE.MeshStandardMaterial({ color: 0x4a536b, metalness: 0.7, roughness: 0.35 }),
  );
  belly.position.y = -0.68;
  belly.castShadow = true;
  visual.add(belly);

  // seam rings around the hull
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x5d6b86, metalness: 0.9, roughness: 0.28 });
  const seamA = new THREE.Mesh(new THREE.TorusGeometry(3.82, 0.055, 6, 64), seamMat);
  seamA.rotation.x = Math.PI / 2;
  seamA.position.y = 0.12;
  const seamB = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.045, 6, 64), seamMat);
  seamB.rotation.x = Math.PI / 2;
  seamB.position.y = 0.43;
  visual.add(seamA, seamB);

  // glowing rim lights
  const rimLights = [];
  const lightColors = [0x5ffff2, 0xff5bd8, 0x7dff70, 0xffdb63];
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const color = lightColors[i % lightColors.length];
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), material);
    light.position.set(Math.cos(angle) * 3.95, 0.09, Math.sin(angle) * 3.95);
    visual.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEXTURE,
      color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    glow.scale.setScalar(0.7);
    glow.position.copy(light.position);
    visual.add(glow);
    rimLights.push({ mesh: light, glow, material, angle, phase: i * 0.55 });
  }

  // three landing lamps under the saucer
  const landing = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xbc5bff, toneMapped: false });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.16, 12), lampMat);
    lamp.position.set(Math.cos(angle) * 1.55, -0.93, Math.sin(angle) * 1.55);
    landing.add(lamp);
    const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW_TEXTURE,
      color: 0xb85cff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    lampGlow.scale.setScalar(1.4);
    lampGlow.position.copy(lamp.position);
    landing.add(lampGlow);
  }
  visual.add(landing);

  // main emitter
  const emitter = new THREE.Object3D();
  emitter.position.set(0, -0.89, 0);
  visual.add(emitter);

  const emitterRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.09, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0xff5ce2, toneMapped: false }),
  );
  emitterRing.rotation.x = Math.PI / 2;
  emitter.add(emitterRing);
  const emitterDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.53, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd0ff, transparent: true, opacity: 0.95, toneMapped: false, side: THREE.DoubleSide }),
  );
  emitterDisc.rotation.x = -Math.PI / 2;
  emitterDisc.position.y = -0.01;
  emitter.add(emitterDisc);

  const emitterGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW_TEXTURE,
    color: 0xff59de,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  emitterGlow.scale.setScalar(4.6);
  emitterGlow.position.y = -0.1;
  emitter.add(emitterGlow);

  // glass dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.25, 40, 22, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x9defff,
      metalness: 0.18,
      roughness: 0.06,
      transparent: true,
      opacity: 0.26,
      emissive: 0x2e9dba,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.25,
    }),
  );
  dome.position.y = 0.63;
  dome.castShadow = false;
  visual.add(dome);

  const domeRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.25, 0.12, 10, 48),
    new THREE.MeshStandardMaterial({ color: 0x8e9bb1, metalness: 0.8, roughness: 0.3 }),
  );
  domeRim.rotation.x = Math.PI / 2;
  domeRim.position.y = 0.64;
  visual.add(domeRim);

  // dome interior floor
  const interior = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 0.12, 32),
    new THREE.MeshStandardMaterial({ color: 0x1b3942, metalness: 0.35, roughness: 0.6, emissive: 0x10493b, emissiveIntensity: 0.4 }),
  );
  interior.position.y = 0.65;
  visual.add(interior);

  const innerGlow = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.035, 6, 40),
    new THREE.MeshBasicMaterial({ color: 0x77ff9d, toneMapped: false }),
  );
  innerGlow.rotation.x = Math.PI / 2;
  innerGlow.position.y = 0.72;
  visual.add(innerGlow);

  // aliens at the wheel
  const aliens = [];
  const alienPositions = [
    [-0.78, 0.7, 0.15, 0.18],
    [0.05, 0.7, 0.58, -0.1],
    [0.83, 0.7, -0.06, -0.28],
  ];
  alienPositions.forEach(([x, y, z, yaw], index) => {
    const alien = createAlien();
    alien.group.position.set(x, y, z);
    alien.group.rotation.y = yaw;
    alien.group.userData.baseY = y;
    alien.group.userData.phase = index * 1.9;
    visual.add(alien.group);
    aliens.push(alien);
  });

  const cabinLight = new THREE.PointLight(0x6aff92, 4.2, 5.5, 2);
  cabinLight.position.set(0, 1.45, 0.1);
  visual.add(cabinLight);

  // little antenna
  const antenna = new THREE.Group();
  antenna.position.set(-1.2, 0.7, -0.7);
  const rod = box(0.05, 1.2, 0.05, MAT.metalDark, 0, 0.6, 0);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0x6dffef, toneMapped: false }),
  );
  orb.position.y = 1.22;
  antenna.add(rod, orb);
  visual.add(antenna);

  // soft under-glow
  const underGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW_TEXTURE,
    color: 0xa855ff,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  underGlow.scale.set(10, 4.2, 1);
  underGlow.position.y = -0.9;
  visual.add(underGlow);

  return {
    root,
    visual,
    hull,
    dome,
    aliens,
    rimLights,
    emitter,
    emitterRing,
    emitterDisc,
    emitterGlow,
    cabinLight,
    antenna,
    underGlow,
  };
}

/* ------------------------------------------------------------------ */
/*  Farm props                                                         */
/* ------------------------------------------------------------------ */

export function createBarn() {
  const group = new THREE.Group();
  const width = 10;
  const depth = 8;
  const wallHeight = 4.7;

  const foundation = box(width + 0.5, 0.4, depth + 0.5, MAT.stone, 0, 0.2, 0);
  group.add(foundation);

  const walls = box(width, wallHeight, depth, MAT.barnRed, 0, wallHeight / 2 + 0.4, 0);
  group.add(walls);

  // vertical plank lines
  for (let i = -4; i <= 4; i += 1) {
    const plank = box(0.05, wallHeight - 0.2, 0.06, MAT.barnDark, i * 1.06, wallHeight / 2 + 0.4, depth / 2 + 0.01);
    plank.castShadow = false;
    group.add(plank);
  }

  // stepped voxel roof
  const roofY = wallHeight + 0.4;
  for (let i = 0; i < 6; i += 1) {
    const stepWidth = width + 1.2 - i * 1.5;
    const stepDepth = depth + 1.2 - i * 0.95;
    if (stepWidth <= 0.8) break;
    const step = box(stepWidth, 0.36, stepDepth, i % 2 === 0 ? MAT.barnRoof : MAT.barnDark, 0, roofY + 0.18 + i * 0.34, 0);
    group.add(step);
  }

  // white corner trim
  for (const x of [-width / 2 + 0.05, width / 2 - 0.05]) {
    for (const z of [-depth / 2 + 0.05, depth / 2 - 0.05]) {
      const trim = box(0.22, wallHeight, 0.22, MAT.whiteWood, x, wallHeight / 2 + 0.4, z);
      group.add(trim);
    }
  }
  const band = box(width + 0.14, 0.18, depth + 0.14, MAT.whiteWood, 0, 1.0, 0);
  group.add(band);

  // big front doors
  const doorY = 2.45;
  const doorZ = depth / 2 + 0.06;
  const doorPanel = box(4.1, 3.9, 0.16, MAT.barnDark, 0, doorY, doorZ);
  group.add(doorPanel);
  const doorFrameTop = box(4.75, 0.3, 0.25, MAT.whiteWood, 0, 4.55, doorZ + 0.02);
  const doorFrameL = box(0.3, 4.2, 0.25, MAT.whiteWood, -2.2, 2.4, doorZ + 0.02);
  const doorFrameR = box(0.3, 4.2, 0.25, MAT.whiteWood, 2.2, 2.4, doorZ + 0.02);
  group.add(doorFrameTop, doorFrameL, doorFrameR);
  const crossA = box(0.26, 4.65, 0.12, MAT.whiteWood, 0, doorY, doorZ + 0.13);
  crossA.rotation.z = 0.72;
  const crossB = box(0.26, 4.65, 0.12, MAT.whiteWood, 0, doorY, doorZ + 0.13);
  crossB.rotation.z = -0.72;
  group.add(crossA, crossB);

  // loft window
  const windowFrame = box(1.55, 1.35, 0.16, MAT.whiteWood, 0, 5.55, depth / 2 + 0.02);
  const windowGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.0),
    new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false }),
  );
  windowGlass.position.set(0, 5.55, depth / 2 + 0.12);
  group.add(windowFrame, windowGlass);
  const windowLight = new THREE.PointLight(0xffb25e, 9, 10, 2);
  windowLight.position.set(0, 5.3, depth / 2 + 1.8);
  group.add(windowLight);

  // side window
  const sideWin = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.0),
    new THREE.MeshBasicMaterial({ color: 0xffcc80, toneMapped: false }),
  );
  sideWin.position.set(width / 2 + 0.07, 3.2, 0.8);
  sideWin.rotation.y = Math.PI / 2;
  group.add(sideWin);

  // sign above the doors
  const signTexture = textTexture(['X-FILES FARM', 'EST. 1947 · MILK DIVISION'], {
    width: 720,
    height: 260,
    titleSize: 74,
    accent: '#2d5b3a',
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.66),
    new THREE.MeshBasicMaterial({ map: signTexture, transparent: false }),
  );
  sign.position.set(0, 6.9, depth / 2 + 0.8);
  group.add(sign);

  // lantern
  const lantern = box(0.32, 0.42, 0.22, new THREE.MeshBasicMaterial({ color: 0xffc56e, toneMapped: false }), -3.6, 3.6, depth / 2 + 0.1);
  group.add(lantern);
  const lanternLight = new THREE.PointLight(0xffa84d, 13, 12, 2);
  lanternLight.position.set(-3.6, 3.55, depth / 2 + 0.7);
  group.add(lanternLight);

  // silo next door
  const silo = new THREE.Group();
  const siloBody = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 7.2, 16), MAT.silo);
  siloBody.position.y = 3.6;
  siloBody.castShadow = true;
  siloBody.receiveShadow = true;
  silo.add(siloBody);
  const siloDome = new THREE.Mesh(new THREE.SphereGeometry(1.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.silo);
  siloDome.position.y = 7.2;
  siloDome.castShadow = true;
  silo.add(siloDome);
  for (let i = 1; i < 4; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.47, 0.045, 5, 20), MAT.metalDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = i * 1.8;
    silo.add(ring);
  }
  const siloBand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.1), MAT.whiteWood);
  siloBand.position.set(0, 5.4, 1.46);
  silo.add(siloBand);
  silo.position.set(-7.2, 0, -1.6);
  group.add(silo);

  return { group, windowLight, lanternLight };
}

export function createWindmill() {
  const group = new THREE.Group();
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x8b735c, roughness: 0.9 });
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    const leg = box(0.18, 8.2, 0.18, towerMat, Math.cos(angle) * 0.9, 4.1, Math.sin(angle) * 0.9);
    leg.rotation.z = Math.cos(angle) * 0.12;
    leg.rotation.x = -Math.sin(angle) * 0.12;
    group.add(leg);
  }
  for (let i = 0; i < 3; i += 1) {
    const brace = box(0.1, 0.1, 4.1, towerMat, 0, 1.8 + i * 2.2, 0);
    brace.rotation.y = i * 0.6;
    group.add(brace);
  }
  const hub = box(0.7, 0.55, 0.7, MAT.metalDark, 0, 8.0, 0);
  group.add(hub);

  const blades = new THREE.Group();
  blades.position.set(0, 8.0, 0.5);
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Group();
    blade.rotation.z = (i / 4) * Math.PI * 2;
    const spar = box(0.14, 3.2, 0.12, MAT.metalDark, 0, 1.55, 0);
    const sail = box(0.7, 2.2, 0.06, MAT.whiteWood, 0.08, 1.8, 0.02);
    blade.add(spar, sail);
    blades.add(blade);
  }
  const bladesGlow = new THREE.PointLight(0xffb35e, 4, 9, 2);
  bladesGlow.position.set(0, 0, 0.6);
  blades.add(bladesGlow);
  group.add(blades);

  const tail = box(0.12, 0.12, 2.0, MAT.metalDark, 0, 8.0, -1.1);
  group.add(tail);
  const tailFin = box(0.9, 1.1, 0.08, MAT.whiteWood, 0, 8.0, -2.0);
  group.add(tailFin);

  return { group, blades };
}

export function createTree(scale = 1, variant = 0) {
  const group = new THREE.Group();
  const trunk = box(0.45 * scale, 2.3 * scale, 0.45 * scale, MAT.bark, 0, 1.15 * scale, 0);
  group.add(trunk);
  const leafMats = [MAT.leafA, MAT.leafB, MAT.leafC];
  const blocks = [
    [0, 2.7, 0, 2.2, 1.4, 2.2],
    [-0.65, 3.35, 0.25, 1.35, 1.25, 1.35],
    [0.7, 3.1, -0.2, 1.3, 1.1, 1.4],
    [0.05, 4.0, -0.05, 1.15, 1.0, 1.15],
    [-0.2, 3.25, -0.75, 1.2, 1.0, 1.2],
  ];
  blocks.forEach(([x, y, z, w, h, d], index) => {
    const leaf = box(w * scale, h * scale, d * scale, leafMats[(index + variant) % leafMats.length], x * scale, y * scale, z * scale);
    group.add(leaf);
  });
  return group;
}

export function createTractor() {
  const group = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.55, metalness: 0.15 });
  const dark = MAT.metalDark;
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf0b63e, roughness: 0.6 });

  const body = box(2.0, 0.7, 1.25, red, 0, 0.95, 0);
  const hood = box(1.5, 0.55, 1.0, red, 0.75, 1.3, 0);
  const grill = box(0.1, 0.42, 0.85, dark, 1.52, 1.3, 0);
  const cabin = box(1.1, 1.2, 1.1, dark, -0.45, 1.85, 0);
  const roof = box(1.25, 0.14, 1.25, red, -0.45, 2.5, 0);
  group.add(body, hood, grill, cabin, roof);

  const wheelGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.38, 16);
  const wheelR = new THREE.Mesh(wheelGeo, dark);
  wheelR.rotation.z = Math.PI / 2;
  wheelR.position.set(-0.55, 0.72, 0.75);
  wheelR.castShadow = true;
  const wheelL = wheelR.clone();
  wheelL.position.z = -0.75;
  group.add(wheelR, wheelL);

  const smallGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14);
  const frontR = new THREE.Mesh(smallGeo, dark);
  frontR.rotation.z = Math.PI / 2;
  frontR.position.set(1.15, 0.4, 0.66);
  const frontL = frontR.clone();
  frontL.position.z = -0.66;
  group.add(frontR, frontL);

  const lightL = box(0.12, 0.18, 0.22, new THREE.MeshBasicMaterial({ color: 0xffe6a0, toneMapped: false }), 1.58, 1.55, 0.38);
  const lightR = lightL.clone();
  lightR.position.z = -0.38;
  group.add(lightL, lightR);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 8), yellow);
  exhaust.position.set(1.2, 1.75, 0.35);
  group.add(exhaust);

  return group;
}

export function createHayBale(scale = 1) {
  const group = new THREE.Group();
  const bale = box(1.5 * scale, 1.0 * scale, 0.95 * scale, MAT.hay, 0, 0.5 * scale, 0);
  bale.rotation.y = 0.05;
  group.add(bale);
  for (const x of [-0.45, 0.45]) {
    const strap = box(0.06, 1.04 * scale, 0.98 * scale, MAT.bark, x * scale, 0.5 * scale, 0);
    group.add(strap);
  }
  return group;
}

export function createRocks() {
  const group = new THREE.Group();
  const rockData = [
    [0.7, 0.5, 0.6, 0, 0.25, 0],
    [0.45, 0.32, 0.5, 0.6, 0.16, 0.2],
    [0.35, 0.26, 0.4, -0.45, 0.13, -0.2],
  ];
  rockData.forEach(([w, h, d, x, y, z]) => {
    const rock = box(w, h, d, MAT.stone, x, y, z);
    rock.rotation.y = x * 1.4;
    group.add(rock);
  });
  return group;
}
