const createIsotropicRemesherModule = require('../build/isotropicremesher.js');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = createIsotropicRemesherModule();
  }
  return modulePromise;
}

function toFloat64Array(values) {
  return values instanceof Float64Array ? values : Float64Array.from(values);
}

function toUint32Array(values) {
  return values instanceof Uint32Array ? values : Uint32Array.from(values);
}

async function remesh(options) {
  const opts = options || {};
  const vertices = opts.vertices;
  const indices = opts.indices;
  const iterations = opts.iterations === undefined ? 3 : opts.iterations;
  const targetTriangleCount = opts.targetTriangleCount || 0;
  const targetEdgeLength = opts.targetEdgeLength || 0;
  const sharpEdgeIncludedAngle = opts.sharpEdgeIncludedAngle || 0;

  if (!vertices || !indices) {
    throw new Error('remesh: both "vertices" and "indices" are required');
  }
  if (vertices.length % 3 !== 0) {
    throw new Error('remesh: "vertices" length must be a multiple of 3, got ' + vertices.length);
  }
  if (indices.length % 3 !== 0) {
    throw new Error('remesh: "indices" length must be a multiple of 3, got ' + indices.length);
  }

  const wasm = await loadModule();
  const result = wasm.remesh(
    toFloat64Array(vertices),
    toUint32Array(indices),
    iterations | 0,
    targetTriangleCount,
    targetEdgeLength,
    sharpEdgeIncludedAngle
  );

  if (!result) {
    throw new Error('remesh: the remesher produced no output');
  }
  return result;
}

async function initialAverageEdgeLength(vertices, indices) {
  if (!vertices || !indices) {
    throw new Error('initialAverageEdgeLength: both vertices and indices are required');
  }
  const wasm = await loadModule();
  return wasm.initialAverageEdgeLength(toFloat64Array(vertices), toUint32Array(indices));
}

module.exports = { loadModule, remesh, initialAverageEdgeLength };
module.exports.default = module.exports;
