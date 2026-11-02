import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeStaticScene } from './merge-utils.js';
import {
  GLOW_TEXTURE,
  createBarn,
  createHayBale,
  createRocks,
  createTractor,
  createTree,
  createWindmill,
  glowTexture,
  MAT,
} from './models.js';

/* ------------------------------------------------------------------ */
/*  Procedural textures                                                */
/* ------------------------------------------------------------------ */

function grassTexture(base = '#4f8f35', variants = ['#5ba53d', '#437d2f', '#68b245', '#3f772d']) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1500; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = variants[Math.floor(Math.random() * variants.length)];
    ctx.globalAlpha = 0.25 + Math.random() * 0.5;
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 5);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function pastureTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#68ad47';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(20,60,10,0.05)';
    ctx.fillRect(0, y, size, 64);
  }
  for (let i = 0; i < 1800; i += 1) {
    ctx.fillStyle = ['#5a9d3d', '#74ba50', '#4e8c34', '#80c65c'][Math.floor(Math.random() * 4)];
    ctx.globalAlpha = 0.25 + Math.random() * 0.4;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 2.5);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/* ------------------------------------------------------------------ */
/*  Sky                                                                */
/* ------------------------------------------------------------------ */

function addSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color(0x080a23) },
    uMid: { value: new THREE.Color(0x2b1a4c) },
    uHorizon: { value: new THREE.Color(0x8f416a) },
    uGlow: { value: new THREE.Color(0xff9a6a) },
    uMoonDir: { value: new THREE.Vector3(0.36, 0.44, -0.82).normalize() },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(230, 36, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uGlow;
        uniform vec3 uMoonDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 color = mix(uHorizon, uMid, smoothstep(0.44, 0.68, h));
          color = mix(color, uTop, smoothstep(0.65, 0.98, h));

          float horizon = exp(-abs(vDir.y) * 13.0);
          color += uGlow * horizon * 0.18;

          float moonHalo = pow(max(dot(vDir, normalize(uMoonDir)), 0.0), 14.0);
          color += vec3(1.0, 0.78, 0.58) * moonHalo * 0.24;

          // faint milky band for a colourful night sky
          float band = exp(-pow((vDir.y - vDir.x * 0.28 - 0.16) * 6.5, 2.0));
          color += vec3(0.16, 0.11, 0.3) * band * 0.35;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );
  sky.name = 'sky';
  sky.userData.noMerge = true;
  scene.add(sky);

  // stars
  const starCount = 950;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const color = new THREE.Color();
  for (let i = 0; i < starCount; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    const radius = 165 + Math.random() * 35;
    const x = Math.sin(phi) * Math.cos(theta) * radius;
    const y = Math.cos(phi) * radius;
    const z = Math.sin(phi) * Math.sin(theta) * radius;
    positions.set([x, y, z], i * 3);
    const pick = Math.random();
    if (pick > 0.9) color.setHex(0xffd7a3);
    else if (pick > 0.8) color.setHex(0x9dd8ff);
    else if (pick > 0.7) color.setHex(0xffb4e8);
    else color.setHex(0xe9f1ff);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.6,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.name = 'stars';
  scene.add(stars);

  // moon + halo
  const moonPos = new THREE.Vector3(45, 42, -105);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(4.4, 24, 18),
    new THREE.MeshBasicMaterial({ color: 0xfff0bd, fog: false, toneMapped: false }),
  );
  moon.position.copy(moonPos);
  scene.add(moon);
  const craterMat = new THREE.MeshBasicMaterial({ color: 0xe0c78f, transparent: true, opacity: 0.35, fog: false });
  for (const [x, y, z, s] of [[-1.2, 1.1, 3.4, 0.8], [1.5, -0.7, 3.7, 0.55], [0.2, 2.1, 3.4, 0.4]]) {
    const crater = new THREE.Mesh(new THREE.CircleGeometry(s, 14), craterMat);
    crater.position.copy(moonPos).add(new THREE.Vector3(x, y, z));
    crater.lookAt(0, 0, 0);
    scene.add(crater);
  }
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW_TEXTURE,
    color: 0xffd6a0,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    fog: false,
  }));
  moonHalo.position.copy(moonPos);
  moonHalo.scale.setScalar(36);
  scene.add(moonHalo);

  return { stars, moon, sky };
}

function addClouds(scene) {
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0x4b3a69,
    roughness: 1,
    transparent: true,
    opacity: 0.72,
    emissive: 0x2a1c43,
    emissiveIntensity: 0.55,
    depthWrite: false,
  });
  const cloudData = [
    [-54, 29, -97, 1.0],
    [-9, 35, -112, 1.35],
    [44, 27, -102, 0.9],
    [78, 38, -122, 1.5],
    [-88, 41, -130, 1.2],
  ];
  cloudData.forEach(([x, y, z, scale], cloudIndex) => {
    const group = new THREE.Group();
    const puffs = [
      [0, 0, 0, 11, 2.1, 4.5],
      [7, 1.0, 0.4, 7, 2.6, 3.4],
      [-7, -0.3, -0.3, 7.5, 1.8, 3.8],
      [3, 1.8, -0.5, 5.5, 1.7, 2.9],
    ];
    puffs.forEach(([px, py, pz, w, h, d]) => {
      const puff = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cloudMat);
      puff.position.set(px, py, pz);
      group.add(puff);
    });
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    group.userData.baseX = x;
    group.userData.speed = 0.25 + cloudIndex * 0.08;
    group.userData.phase = cloudIndex * 1.7;
    group.userData.noMerge = true;
    scene.add(group);
    clouds.push(group);
  });
  return clouds;
}

function addHills(scene) {
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x213c2f, roughness: 1 });
  const hillMatFar = new THREE.MeshStandardMaterial({ color: 0x1a2c31, roughness: 1 });
  const data = [
    [-52, -2, -78, 24, 8, 15, hillMat],
    [-15, -3, -92, 34, 11, 18, hillMatFar],
    [25, -4, -88, 30, 10, 16, hillMat],
    [62, -2, -76, 22, 8, 14, hillMatFar],
  ];
  data.forEach(([x, y, z, sx, sy, sz, mat]) => {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
    hill.position.set(x, y, z);
    hill.scale.set(sx, sy, sz);
    hill.receiveShadow = true;
    scene.add(hill);
  });
}

/* ------------------------------------------------------------------ */
/*  Crops                                                              */
/* ------------------------------------------------------------------ */

function cornGeometry() {
  const parts = [];
  const stem = new THREE.BoxGeometry(0.075, 1.05, 0.075);
  stem.translate(0, 0.525, 0);
  parts.push(stem);

  const leafAngles = [0.2, 1.45, 2.9, 4.5];
  leafAngles.forEach((angle, index) => {
    const leaf = new THREE.BoxGeometry(0.52, 0.055, 0.19);
    leaf.translate(0.24, 0, 0);
    leaf.rotateZ(0.25 - index * 0.07);
    leaf.translate(0, 0.28 + index * 0.16, 0);
    leaf.rotateY(angle);
    parts.push(leaf);
  });
  const tassel = new THREE.BoxGeometry(0.03, 0.3, 0.03);
  tassel.translate(0, 1.14, 0);
  parts.push(tassel);
  const cob = new THREE.BoxGeometry(0.1, 0.26, 0.1);
  cob.translate(0.08, 0.56, 0.06);
  parts.push(cob);

  return mergeGeometries(parts, false);
}

function grassTuftGeometry() {
  const parts = [];
  for (let i = 0; i < 5; i += 1) {
    const blade = new THREE.BoxGeometry(0.035, 0.28 + Math.random() * 0.18, 0.035);
    blade.translate(0, 0.18, 0);
    blade.rotateZ((i - 2) * 0.22);
    blade.rotateY(i * 1.3);
    blade.translate((i - 2) * 0.045, 0, Math.sin(i) * 0.05);
    parts.push(blade);
  }
  return mergeGeometries(parts, false);
}

function addCropField(scene) {
  const field = new THREE.Group();
  field.name = 'crop-field';

  // tilled rows
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x5d4228, roughness: 1 });
  for (let z = -36; z <= -5; z += 2.5) {
    const soil = new THREE.Mesh(new THREE.BoxGeometry(78, 0.12, 1.65), soilMat);
    soil.position.set(0, 0.02, z);
    soil.receiveShadow = true;
    field.add(soil);
  }

  const geo = cornGeometry();
  const positions = [];
  for (let z = -35.2; z <= -5.8; z += 2.5) {
    for (let x = -37; x <= 37; x += 2.05) {
      const inBarn = x > -29 && x < -14 && z > -20 && z < -8.5;
      const inPath = x > -25.5 && x < -19.5;
      if (inBarn || inPath) continue;
      if (Math.random() < 0.06) continue;
      positions.push([x + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5]);
    }
  }

  // side field patches frame the pasture
  for (let z = -3; z <= 17; z += 2.4) {
    for (let x = 20.5; x <= 38; x += 2.0) {
      positions.push([x + (Math.random() - 0.5) * 0.4, z + (Math.random() - 0.5) * 0.4]);
    }
    for (let x = -39; x <= -21; x += 2.0) {
      if (z > 4.5 && z < 12) continue;
      positions.push([x + (Math.random() - 0.5) * 0.4, z + (Math.random() - 0.5) * 0.4]);
    }
  }

  const cropMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0,
  });
  cropMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float sway = sin(uTime * 1.45 + instanceMatrix[3].x * 0.62 + instanceMatrix[3].z * 0.28);
        float flutter = cos(uTime * 2.1 + instanceMatrix[3].x * 0.3);
        transformed.x += sway * max(position.y, 0.0) * 0.06;
        transformed.z += flutter * max(position.y, 0.0) * 0.025;
      #endif`,
    );
    cropMaterial.userData.shader = shader;
  };

  const crops = new THREE.InstancedMesh(geo, cropMaterial, positions.length);
  crops.name = 'corn-instances';
  crops.castShadow = true;
  crops.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const greens = [0x4c9a2e, 0x5cab36, 0x3f8a2d, 0x6bb93f, 0x4a932f];
  positions.forEach(([x, z], index) => {
    const scale = 0.8 + Math.random() * 0.7;
    dummy.position.set(x, 0.04, z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.scale.set(0.85 + Math.random() * 0.3, scale, 0.85 + Math.random() * 0.3);
    dummy.updateMatrix();
    crops.setMatrixAt(index, dummy.matrix);
    color.setHex(greens[Math.floor(Math.random() * greens.length)]);
    crops.setColorAt(index, color);
  });
  crops.instanceMatrix.needsUpdate = true;
  if (crops.instanceColor) crops.instanceColor.needsUpdate = true;
  field.add(crops);

  // grass tufts around pasture borders
  const tuftGeo = grassTuftGeometry();
  const tuftMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  tuftMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float sway = sin(uTime * 1.9 + instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.4);
        transformed.x += sway * max(position.y, 0.0) * 0.13;
      #endif`,
    );
    tuftMaterial.userData.shader = shader;
  };
  const tuftCount = 330;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMaterial, tuftCount);
  const tuftColors = [0x4e8f34, 0x5fa940, 0x3e7d2c, 0x74b64f];
  for (let i = 0; i < tuftCount; i += 1) {
    let x;
    let z;
    if (i < 220) {
      // rim around the pasture
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { x = -17.2 + Math.random() * 33.4; z = -1.7 + Math.random() * 1.1; }
      else if (side === 1) { x = -17.2 + Math.random() * 33.4; z = 15.6 + Math.random() * 1.1; }
      else if (side === 2) { x = -17.4 + Math.random() * 1.1; z = -1 + Math.random() * 17; }
      else { x = 15.8 + Math.random() * 1.1; z = -1 + Math.random() * 17; }
    } else {
      x = -16 + Math.random() * 32;
      z = -0.5 + Math.random() * 16;
    }
    dummy.position.set(x, 0.03, z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.setScalar(0.8 + Math.random() * 0.9);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    color.setHex(tuftColors[Math.floor(Math.random() * tuftColors.length)]);
    tufts.setColorAt(i, color);
  }
  tufts.instanceMatrix.needsUpdate = true;
  if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  tufts.castShadow = false;
  field.add(tufts);

  // wildflowers near the fence for pops of colour
  const flowerStemMat = new THREE.MeshStandardMaterial({ color: 0x3b7e2a, roughness: 1 });
  const flowerHeadMats = [
    new THREE.MeshBasicMaterial({ color: 0xffd85c, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: 0xff84c4, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: 0xf4f2ff, toneMapped: false }),
  ];
  for (let i = 0; i < 26; i += 1) {
    const x = -16.7 + Math.random() * 33;
    const z = Math.random() < 0.5 ? 15.9 + Math.random() * 0.5 : -1.8 + Math.random() * 0.4;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.32, 0.035), flowerStemMat);
    stem.position.set(x, 0.16, z);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), flowerHeadMats[i % 3]);
    head.position.set(x, 0.36, z);
    field.add(stem, head);
  }

  scene.add(field);
  return { field, cropMaterial, tuftMaterial };
}

/* ------------------------------------------------------------------ */
/*  Fence, path, pasture                                               */
/* ------------------------------------------------------------------ */

function addPasture(scene) {
  const pasture = new THREE.Mesh(
    new THREE.PlaneGeometry(34.5, 19.2),
    new THREE.MeshStandardMaterial({
      map: pastureTexture(),
      color: 0xffffff,
      roughness: 1,
    }),
  );
  pasture.rotation.x = -Math.PI / 2;
  pasture.position.set(-0.4, 0.035, 7.2);
  pasture.receiveShadow = true;
  scene.add(pasture);

  // worn dirt patches under the hay and near the gate
  const patchMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a3d,
    roughness: 1,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const patch = new THREE.Mesh(new THREE.CircleGeometry(2.5, 20), patchMat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(-12.5, 0.05, 10.2);
  patch.scale.set(1.6, 0.9, 1);
  scene.add(patch);
}

function addFence(scene) {
  const fence = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe8dfca, roughness: 0.88 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xd7cab0, roughness: 0.9 });
  const xMin = -18;
  const xMax = 16.6;
  const zMin = -2.6;
  const zMax = 16.8;
  const gateMin = -23.4;
  const gateMax = -20.2;

  const addPost = (x, z) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.17, 1.15, 0.17), postMat);
    post.position.set(x, 0.575, z);
    post.rotation.z = (Math.random() - 0.5) * 0.035;
    post.castShadow = true;
    post.receiveShadow = true;
    fence.add(post);
  };

  // back fence (with a gate gap)
  for (let x = xMin; x <= xMax; x += 2.15) {
    if (x > gateMin && x < gateMax) continue;
    addPost(x, zMin);
  }
  for (let x = xMin; x <= xMax; x += 2.15) {
    if (x > gateMin && x < gateMax) continue;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.09), railMat);
    rail.position.set(x + 1.05, 0.8, zMin);
    rail.castShadow = true;
    fence.add(rail);
    const railLow = rail.clone();
    railLow.position.y = 0.42;
    fence.add(railLow);
  }
  // side fences
  for (let z = zMin; z <= zMax; z += 2.15) {
    for (const x of [xMin, xMax]) {
      addPost(x, z);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 2.2), railMat);
      rail.position.set(x, 0.8, z + 1.05);
      rail.castShadow = true;
      fence.add(rail);
      const railLow = rail.clone();
      railLow.position.y = 0.42;
      fence.add(railLow);
    }
  }
  // front fence, low and friendly
  for (let x = xMin; x <= xMax; x += 2.15) {
    addPost(x, zMax);
  }
  for (let x = xMin; x <= xMax; x += 2.15) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.09), railMat);
    rail.position.set(x + 1.05, 0.72, zMax);
    rail.castShadow = true;
    fence.add(rail);
  }

  // gate posts
  for (const x of [gateMin, gateMax]) {
    const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.6, 0.26), postMat);
    gatePost.position.set(x, 0.8, zMin);
    gatePost.castShadow = true;
    fence.add(gatePost);
  }

  scene.add(fence);
}

function addDirtPath(scene) {
  const path = new THREE.Group();
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x92714a, roughness: 1 });
  const tiles = [
    [-22, -10.2, 2.6, 5.8],
    [-22, -5.6, 2.4, 3.8],
    [-22, -2.4, 2.2, 2.4],
    [-17.5, 1.8, 7.4, 2.0],
    [-11.5, 2.1, 5.4, 1.8],
  ];
  tiles.forEach(([x, z, w, d], index) => {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pathMat);
    tile.rotation.x = -Math.PI / 2;
    tile.rotation.z = index > 2 ? 0.16 : 0;
    tile.position.set(x, 0.055, z);
    tile.receiveShadow = true;
    path.add(tile);
  });
  scene.add(path);
}

function addFarmDetails(scene) {
  const barn = createBarn();
  barn.group.position.set(-22.5, 0, -14.2);
  barn.group.rotation.y = 0.02;
  scene.add(barn.group);

  const windmill = createWindmill();
  windmill.group.position.set(25.5, 0, -11.5);
  windmill.group.rotation.y = -0.2;
  windmill.group.scale.setScalar(1.15);
  windmill.blades.userData.noMerge = true;
  scene.add(windmill.group);

  const tractor = createTractor();
  tractor.position.set(-14.2, 0.05, -5.6);
  tractor.rotation.y = -0.65;
  tractor.scale.setScalar(0.8);
  scene.add(tractor);

  const hay1 = createHayBale(1.25);
  hay1.position.set(-13.2, 0.05, 11.2);
  hay1.rotation.y = 0.15;
  scene.add(hay1);
  const hay2 = createHayBale(1.05);
  hay2.position.set(-14.7, 0.05, 9.5);
  hay2.rotation.y = -0.3;
  scene.add(hay2);
  const hay3 = createHayBale(1.1);
  hay3.position.set(13.7, 0.05, 13.1);
  hay3.rotation.y = 0.7;
  scene.add(hay3);

  // water trough
  const trough = new THREE.Group();
  const troughMat = new THREE.MeshStandardMaterial({ color: 0x8d9ea6, metalness: 0.5, roughness: 0.5 });
  const troughBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.9), troughMat);
  troughBody.position.y = 0.35;
  troughBody.castShadow = true;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.65),
    new THREE.MeshStandardMaterial({ color: 0x4db7d8, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.8 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.58;
  trough.add(troughBody, water);
  trough.position.set(12.6, 0, 3.4);
  trough.rotation.y = -0.1;
  scene.add(trough);

  const rocks = createRocks();
  rocks.position.set(-19.5, 0, 3.8);
  rocks.scale.setScalar(1.3);
  scene.add(rocks);

  const rocks2 = createRocks();
  rocks2.position.set(16.1, 0, 6.6);
  rocks2.scale.setScalar(0.8);
  scene.add(rocks2);

  // trees framing the farm
  const treeData = [
    [-35, -7, 1.6, 0],
    [-33, 7, 1.25, 1],
    [30.5, -2, 1.5, 2],
    [34.5, 11, 1.25, 1],
    [-37, -27, 1.8, 2],
    [17, -31, 1.5, 0],
    [39, -23, 1.7, 1],
    [-16, -33, 1.35, 2],
    [47, 3, 1.35, 0],
    [-45, 14, 1.4, 1],
  ];
  treeData.forEach(([x, z, s, variant]) => {
    const tree = createTree(s, variant);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI;
    scene.add(tree);
  });

  // distant telephone poles for that Midwestern horizon
  for (let i = 0; i < 3; i += 1) {
    const x = 42 + i * 10;
    const z = -45 - i * 8;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8, 0.25), MAT.bark);
    pole.position.set(x, 4, z);
    scene.add(pole);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 0.18), MAT.bark);
    cross.position.set(x, 7.1, z);
    scene.add(cross);
  }

  return { barn, windmill };
}

/* ------------------------------------------------------------------ */
/*  Fireflies                                                          */
/* ------------------------------------------------------------------ */

function addFireflies(scene) {
  const count = 85;
  const positions = new Float32Array(count * 3);
  const base = [];
  for (let i = 0; i < count; i += 1) {
    const x = -18 + Math.random() * 37;
    const z = -3 + Math.random() * 20;
    const y = 0.4 + Math.random() * 3.8;
    positions.set([x, y, z], i * 3);
    base.push({ x, y, z, phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.8 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffe27a,
    size: 0.14,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, base, positions, count };
}

/* ------------------------------------------------------------------ */
/*  Main world                                                         */
/* ------------------------------------------------------------------ */

export function buildWorld(scene) {
  scene.fog = new THREE.FogExp2(0x281a3a, 0.0085);

  const hemi = new THREE.HemisphereLight(0x8f9eff, 0x213414, 1.2);
  scene.add(hemi);

  const moonLight = new THREE.DirectionalLight(0xffd9ae, 2.25);
  moonLight.position.set(38, 34, 24);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -36;
  moonLight.shadow.camera.right = 36;
  moonLight.shadow.camera.top = 32;
  moonLight.shadow.camera.bottom = -28;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 100;
  moonLight.shadow.bias = -0.0004;
  moonLight.shadow.normalBias = 0.025;
  moonLight.target.position.set(0, 0, 4);
  scene.add(moonLight, moonLight.target);

  const rimLight = new THREE.DirectionalLight(0x7e63ff, 1.25);
  rimLight.position.set(-28, 18, -34);
  scene.add(rimLight);

  const warmBounce = new THREE.DirectionalLight(0xff8b62, 0.55);
  warmBounce.position.set(-8, 9, 42);
  scene.add(warmBounce);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(230, 230),
    new THREE.MeshStandardMaterial({ map: grassTexture(), color: 0xffffff, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  addSky(scene);
  const clouds = addClouds(scene);
  addHills(scene);
  addPasture(scene);
  addDirtPath(scene);
  addFence(scene);
  addCropField(scene);
  const { barn, windmill } = addFarmDetails(scene);
  const fireflies = addFireflies(scene);

  // distant ambient dust/light shafts in the sky
  const mistMat = new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,160,210,0.28)', 'rgba(110,80,255,0)'),
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  for (let i = 0; i < 3; i += 1) {
    const mist = new THREE.Sprite(mistMat);
    mist.position.set(-50 + i * 48, 15 + i * 4, -92 - i * 12);
    mist.scale.set(55, 22, 1);
    scene.add(mist);
  }

  // small fairy-light ring around the barn yard
  const stringLights = new THREE.Group();
  const stringMat = new THREE.MeshBasicMaterial({ color: 0xffd97a, toneMapped: false });
  for (let i = 0; i < 9; i += 1) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), stringMat);
    bulb.position.set(-18 + i * 0.85, 2.4 + Math.sin(i * 1.3) * 0.3, -9.9);
    stringLights.add(bulb);
  }
  stringLights.userData.noMerge = true;
  scene.add(stringLights);

  const cropMaterials = scene.children
    .flatMap((child) => (child.name === 'crop-field' ? child.children : []))
    .filter((child) => child.isInstancedMesh && child.name === 'corn-instances');
  const cropMaterial = cropMaterials.length ? cropMaterials[0].material : null;

  // keep references to animated materials
  let cropsMat = cropMaterial;
  let tuftMat = null;
  const cropField = scene.getObjectByName('crop-field');
  if (cropField) {
    cropField.children.forEach((child) => {
      if (child.isInstancedMesh) {
        if (child.name === 'corn-instances') cropsMat = child.material;
        else tuftMat = child.material;
      }
    });
  }

  // Collapse the static farm into a handful of material batches. This is the
  // single biggest win for draw-call count on integrated GPUs.
  const mergeStats = mergeStaticScene(scene);

  function update(time, dt) {
    windmill.blades.rotation.z -= dt * 0.85;
    barn.windowLight.intensity = 8.5 + Math.sin(time * 3.1) * 0.7;
    barn.lanternLight.intensity = 12 + Math.sin(time * 7.3) * 1.4 + Math.sin(time * 2.3) * 1.2;

    if (cropsMat?.userData.shader) cropsMat.userData.shader.uniforms.uTime.value = time;
    if (tuftMat?.userData.shader) tuftMat.userData.shader.uniforms.uTime.value = time;

    clouds.forEach((cloud) => {
      cloud.position.x = cloud.userData.baseX + Math.sin(time * 0.035 + cloud.userData.phase) * 10;
      cloud.position.y += Math.sin(time * 0.11 + cloud.userData.phase) * 0.001;
    });

    const positions = fireflies.points.geometry.attributes.position.array;
    fireflies.base.forEach((f, index) => {
      positions[index * 3] = f.x + Math.sin(time * f.speed + f.phase) * 1.1;
      positions[index * 3 + 1] = f.y + Math.sin(time * f.speed * 1.7 + f.phase) * 0.45;
      positions[index * 3 + 2] = f.z + Math.cos(time * f.speed * 0.8 + f.phase) * 0.8;
    });
    fireflies.points.geometry.attributes.position.needsUpdate = true;
    fireflies.points.material.opacity = 0.72 + Math.sin(time * 2.7) * 0.18;

    stringLights.children.forEach((bulb, index) => {
      const s = 0.85 + Math.sin(time * 3.4 + index * 1.1) * 0.25;
      bulb.scale.setScalar(s);
    });
  }

  return {
    update,
    barn,
    windmill,
    clouds,
    fireflies,
    moonLight,
    hemi,
    sunLight: moonLight,
    mergeStats,
  };
}
