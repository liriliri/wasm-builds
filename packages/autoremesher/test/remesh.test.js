const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const mod = require('../js/index.js');
const { remesh } = mod;

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

function assertFiniteMesh(result) {
  const vertices = result.vertices;
  const indices = result.indices;
  assert.ok(vertices instanceof Float64Array);
  assert.ok(indices instanceof Uint32Array);
  assert.equal(vertices.length % 3, 0);
  assert.equal(indices.length % 4, 0);
  assert.ok(indices.length / 4 > 0, 'expected at least one quad');

  for (const v of vertices) {
    assert.ok(Number.isFinite(v), 'non-finite vertex coordinate: ' + v);
  }

  const vertexCount = vertices.length / 3;
  for (const index of indices) {
    assert.ok(index < vertexCount, 'index ' + index + ' out of range (' + vertexCount + ' vertices)');
  }
}

const cubeSphere = loadObj(join(here, 'cube-sphere.obj'));

test('fixture loads as a triangle mesh', () => {
  assert.equal(cubeSphere.vertices.length % 3, 0);
  assert.equal(cubeSphere.indices.length % 3, 0);
  assert.ok(cubeSphere.vertices.length > 0);
});

test('remesh produces a valid quad mesh', async () => {
  const result = await remesh({
    vertices: cubeSphere.vertices,
    indices: cubeSphere.indices,
    targetTriangleCount: 1000,
  });
  assertFiniteMesh(result);
  // Hand-validated during the wasm proof build: ~278 verts / ~272 quads.
  const verts = result.vertices.length / 3;
  const quads = result.indices.length / 4;
  assert.ok(verts > 50 && verts < 2000, 'unexpected vertex count: ' + verts);
  assert.ok(quads > 50 && quads < 2000, 'unexpected quad count: ' + quads);
});

test('remesh scales with targetTriangleCount', async () => {
  const low = await remesh({
    vertices: cubeSphere.vertices,
    indices: cubeSphere.indices,
    targetTriangleCount: 1000,
  });
  const high = await remesh({
    vertices: cubeSphere.vertices,
    indices: cubeSphere.indices,
    targetTriangleCount: 3000,
  });
  // Regression: upstream remeshedQuads() can include n-gons; we must still
  // return a stride-4 index buffer (previously length % 4 === 2 at target 3000).
  assertFiniteMesh(low);
  assertFiniteMesh(high);
  const lowQuads = low.indices.length / 4;
  const highQuads = high.indices.length / 4;
  assert.ok(highQuads > lowQuads, 'expected more quads at higher target (' + highQuads + ' vs ' + lowQuads + ')');
});

test('remesh rejects malformed input', async () => {
  await assert.rejects(() => remesh({ vertices: [0, 0], indices: [0, 1, 2], targetTriangleCount: 100 }), /multiple of 3/);
  await assert.rejects(() => remesh({ vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1], targetTriangleCount: 100 }), /multiple of 3/);
  await assert.rejects(() => remesh({ indices: [0, 1, 2], targetTriangleCount: 100 }), /required/);
  await assert.rejects(() => remesh({ vertices: [0, 0, 0], targetTriangleCount: 100 }), /required/);
  await assert.rejects(() => remesh({ vertices: cubeSphere.vertices, indices: cubeSphere.indices }), /targetTriangleCount/);
  await assert.rejects(() => remesh({ vertices: cubeSphere.vertices, indices: cubeSphere.indices, targetTriangleCount: 0 }), /targetTriangleCount/);
});

test('require() and dynamic import() agree', async () => {
  const viaImport = await import('../js/index.js');
  const a = await remesh({
    vertices: cubeSphere.vertices,
    indices: cubeSphere.indices,
    targetTriangleCount: 1000,
  });
  const b = await viaImport.remesh({
    vertices: cubeSphere.vertices,
    indices: cubeSphere.indices,
    targetTriangleCount: 1000,
  });

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
    targetTriangleCount: 1000,
  });
  assertFiniteMesh(result);
});
