const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const mod = require('../js/index.js');
const { remesh, initialAverageEdgeLength } = mod;

const here = __dirname;
const NEWLINE = String.fromCharCode(10);

// Minimal OBJ reader: vertices + triangulated faces, enough for the fixtures here.
function loadObj(path) {
  const vertices = [];
  const indices = [];
  for (const rawLine of readFileSync(path, 'utf8').split(NEWLINE)) {
    const line = rawLine.trim();
    if (line.startsWith('v ')) {
      const parts = line.split(/\s+/);
      vertices.push(Number(parts[1]), Number(parts[2]), Number(parts[3]));
    } else if (line.startsWith('f ')) {
      const corners = line
        .slice(2)
        .split(/\s+/)
        .map((token) => Number(token.split('/')[0]) - 1);
      for (let i = 1; i + 1 < corners.length; ++i) {
        indices.push(corners[0], corners[i], corners[i + 1]);
      }
    }
  }
  return { vertices, indices };
}

const cubeSphere = loadObj(join(here, 'cube-sphere.obj'));

test('fixture loads as a triangle mesh', () => {
  assert.equal(cubeSphere.vertices.length % 3, 0);
  assert.equal(cubeSphere.indices.length % 3, 0);
  assert.ok(cubeSphere.vertices.length > 0);
});

test('initialAverageEdgeLength returns a positive length', async () => {
  const length = await initialAverageEdgeLength(cubeSphere.vertices, cubeSphere.indices);
  assert.ok(length > 0, 'expected positive average edge length, got ' + length);
});

test('remesh produces a valid triangle mesh', async () => {
  const result = await remesh({
    vertices: cubeSphere.vertices,
    indices: cubeSphere.indices,
    iterations: 2,
  });
  const vertices = result.vertices;
  const indices = result.indices;

  assert.ok(vertices instanceof Float64Array);
  assert.ok(indices instanceof Uint32Array);
  assert.equal(vertices.length % 3, 0);
  assert.equal(indices.length % 3, 0);
  assert.ok(indices.length / 3 > 0, 'expected at least one triangle');

  const vertexCount = vertices.length / 3;
  for (const index of indices) {
    assert.ok(index < vertexCount, 'index ' + index + ' out of range (' + vertexCount + ' vertices)');
  }
});

test('remesh honours targetTriangleCount approximately', async () => {
  const target = 600;
  const result = await remesh({
    vertices: cubeSphere.vertices,
    indices: cubeSphere.indices,
    iterations: 4,
    targetTriangleCount: target,
  });
  const count = result.indices.length / 3;
  assert.ok(count > target * 0.25 && count < target * 4, 'got ' + count + ' triangles for target ' + target);
});

test('remesh rejects malformed input', async () => {
  await assert.rejects(() => remesh({ vertices: [0, 0], indices: [0, 1, 2] }), /multiple of 3/);
  await assert.rejects(() => remesh({ vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1] }), /multiple of 3/);
  await assert.rejects(() => remesh({ indices: [0, 1, 2] }), /required/);
  await assert.rejects(() => remesh({ vertices: [0, 0, 0] }), /required/);
});

// Regression: under wasm32 size_t is 32-bit, so makeHalfedgeKey's `first << 32`
// collapsed to `second`, every halfedge pair collided and oppositeHalfedge was
// never linked. The mesh then came out ~3x too large: these counts would be
// 167/208 -> 353/449 and 284/442 -> 1339/1926.
test('opposite halfedges link correctly (wasm32 size_t regression)', async () => {
  const once = await remesh({
    vertices: cubeSphere.vertices,
    indices: cubeSphere.indices,
    iterations: 1,
  });
  assert.equal(once.vertices.length / 3, 167);
  assert.equal(once.indices.length / 3, 208);

  const targeted = await remesh({
    vertices: cubeSphere.vertices,
    indices: cubeSphere.indices,
    iterations: 4,
    targetTriangleCount: 600,
  });
  assert.equal(targeted.vertices.length / 3, 284);
  assert.equal(targeted.indices.length / 3, 442);
});

test('require() and dynamic import() agree', async () => {
  const viaImport = await import('../js/index.js');
  const a = await remesh({ vertices: cubeSphere.vertices, indices: cubeSphere.indices, iterations: 1 });
  const b = await viaImport.remesh({ vertices: cubeSphere.vertices, indices: cubeSphere.indices, iterations: 1 });

  assert.equal(a.vertices.length, b.vertices.length);
  assert.equal(a.indices.length, b.indices.length);
  assert.deepEqual(Array.from(a.indices), Array.from(b.indices));
});

test('the entry also exposes a default export', () => {
  assert.equal(typeof mod.default.remesh, 'function');
});
test('remesh accepts typed arrays directly', async () => {
  const result = await remesh({
    vertices: Float64Array.from(cubeSphere.vertices),
    indices: Uint32Array.from(cubeSphere.indices),
    iterations: 1,
  });
  assert.ok(result.vertices.length > 0);
  assert.ok(result.indices.length > 0);
});
