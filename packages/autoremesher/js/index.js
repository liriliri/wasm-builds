const createAutoRemesherModule = require('../build/autoremesher.js');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = createAutoRemesherModule();
  }
  return modulePromise;
}

function toFloat64Array(values) {
  return values instanceof Float64Array ? values : Float64Array.from(values);
}

function toUint32Array(values) {
  return values instanceof Uint32Array ? values : Uint32Array.from(values);
}

// NaN means "leave upstream default" on the C++ side, so 0 stays a valid value.
function optionalNumber(value) {
  return value === undefined || value === null ? NaN : Number(value);
}

async function remesh(options) {
  const opts = options || {};
  const vertices = opts.vertices;
  const indices = opts.indices;
  const targetTriangleCount = opts.targetTriangleCount;
  const modelType = opts.modelType === 'hardSurface' || opts.modelType === 1 ? 1 : 0;

  if (!vertices || !indices) {
    throw new Error('remesh: both "vertices" and "indices" are required');
  }
  if (vertices.length % 3 !== 0) {
    throw new Error('remesh: "vertices" length must be a multiple of 3, got ' + vertices.length);
  }
  if (indices.length % 3 !== 0) {
    throw new Error('remesh: "indices" length must be a multiple of 3, got ' + indices.length);
  }
  if (!targetTriangleCount || targetTriangleCount <= 0) {
    throw new Error('remesh: "targetTriangleCount" must be a positive number');
  }

  const wasm = await loadModule();
  const result = wasm.remesh(
    toFloat64Array(vertices),
    toUint32Array(indices),
    targetTriangleCount,
    optionalNumber(opts.scaling),
    modelType,
    optionalNumber(opts.gradientAdaptivity),
    optionalNumber(opts.sharpEdgeDegrees),
    optionalNumber(opts.anisotropy),
    optionalNumber(opts.smoothNormalDegrees)
  );

  if (!result) {
    throw new Error('remesh: the remesher produced no output (check targetTriangleCount and input mesh)');
  }
  return result;
}

module.exports = { loadModule, remesh };
module.exports.default = module.exports;
