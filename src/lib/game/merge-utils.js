import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KEEP_ATTRIBUTES = new Set(['position', 'normal', 'uv']);

function normalizedGeometry(mesh) {
  let geometry = mesh.geometry.clone();
  if (geometry.index) geometry = geometry.toNonIndexed();
  for (const attribute of Object.keys(geometry.attributes)) {
    if (!KEEP_ATTRIBUTES.has(attribute)) geometry.deleteAttribute(attribute);
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  if (!geometry.getAttribute('uv')) {
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return geometry;
}

function collectImmediateMeshes(root) {
  const entries = [];
  for (const child of root.children) {
    if (!child.isMesh || child.isInstancedMesh || child.isSkinnedMesh) continue;
    if (Array.isArray(child.material)) continue;
    if (!child.geometry) continue;
    entries.push(child);
  }
  return entries;
}

/**
 * Merge direct static mesh children of a group into one mesh per material.
 * Child groups (animated parts) are intentionally left untouched.
 */
export function mergeImmediateMeshes(root) {
  const entries = collectImmediateMeshes(root);
  if (entries.length < 2) return 0;

  root.updateMatrixWorld(true);
  const buckets = new Map();

  for (const mesh of entries) {
    mesh.updateMatrix();
    const key = mesh.material.uuid;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material: mesh.material,
        castShadow: mesh.castShadow,
        receiveShadow: mesh.receiveShadow,
        renderOrder: mesh.renderOrder,
        geometries: [],
        meshes: [],
      };
      buckets.set(key, bucket);
    }
    const geometry = normalizedGeometry(mesh);
    geometry.applyMatrix4(mesh.matrix);
    bucket.geometries.push(geometry);
    bucket.meshes.push(mesh);
  }

  let mergedCount = 0;
  for (const bucket of buckets.values()) {
    if (bucket.geometries.length < 2) {
      bucket.geometries.forEach((geometry) => geometry.dispose());
      continue;
    }
    const merged = mergeGeometries(bucket.geometries, false);
    bucket.geometries.forEach((geometry) => geometry.dispose());
    if (!merged) continue;

    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    mesh.renderOrder = bucket.renderOrder;
    root.add(mesh);
    for (const source of bucket.meshes) {
      source.removeFromParent();
      mergedCount += 1;
    }
  }
  return mergedCount;
}

/**
 * Merge direct static mesh children of a group into a single vertex-coloured
 * mesh. This keeps per-part colour while dropping a whole material group.
 */
export function mergeVertexColoredMeshes(root, material) {
  const entries = collectImmediateMeshes(root).filter((mesh) => (
    mesh.material
    && mesh.material.color
    && !mesh.material.map
    && !mesh.material.transparent
  ));
  if (entries.length < 2) return 0;

  root.updateMatrixWorld(true);
  const geometries = [];
  const meshes = [];

  for (const mesh of entries) {
    mesh.updateMatrix();
    const geometry = normalizedGeometry(mesh);
    geometry.applyMatrix4(mesh.matrix);
    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    const color = mesh.material.color;
    for (let i = 0; i < count; i += 1) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometries.push(geometry);
    meshes.push(mesh);
  }

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());
  if (!merged) return 0;

  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  root.add(mesh);
  meshes.forEach((source) => source.removeFromParent());
  return meshes.length;
}

/**
 * Merge every static mesh below a scene root, preserving animated subtrees
 * marked with `userData.noMerge = true`.
 */
export function mergeStaticScene(root, { name = 'merged-static-world' } = {}) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const meshes = [];

  function visit(object) {
    if (object.userData?.noMerge) return;
    if (object.isMesh && !object.isInstancedMesh && !object.isSkinnedMesh) {
      if (object.geometry && object.material && !Array.isArray(object.material)) {
        meshes.push(object);
      }
    }
    for (const child of object.children) visit(child);
  }
  visit(root);

  for (const mesh of meshes) {
    const key = [
      mesh.material.uuid,
      mesh.castShadow ? 1 : 0,
      mesh.receiveShadow ? 1 : 0,
      mesh.renderOrder || 0,
    ].join('|');
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material: mesh.material,
        castShadow: mesh.castShadow,
        receiveShadow: mesh.receiveShadow,
        renderOrder: mesh.renderOrder,
        geometries: [],
        meshes: [],
      };
      buckets.set(key, bucket);
    }
    const geometry = normalizedGeometry(mesh);
    geometry.applyMatrix4(mesh.matrixWorld);
    bucket.geometries.push(geometry);
    bucket.meshes.push(mesh);
  }

  let mergedGroups = 0;
  let removedMeshes = 0;
  for (const bucket of buckets.values()) {
    if (bucket.geometries.length < 2) {
      bucket.geometries.forEach((geometry) => geometry.dispose());
      continue;
    }
    const merged = mergeGeometries(bucket.geometries, false);
    bucket.geometries.forEach((geometry) => geometry.dispose());
    if (!merged) continue;

    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.name = `${name}-${mergedGroups}`;
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    mesh.renderOrder = bucket.renderOrder;
    mesh.frustumCulled = true;
    root.add(mesh);
    mergedGroups += 1;
    for (const source of bucket.meshes) {
      source.removeFromParent();
      removedMeshes += 1;
    }
  }

  return { mergedGroups, removedMeshes, drawMeshes: meshes.length };
}
