const createAutoRemesherModule = require('../build/autoremesher.js');

let modulePromise = null;

function tryReadWasmBinary() {
  try {
    // Require lazily so browser bundlers without an fs polyfill can still load.
    const fs = require('node:fs');
    const path = require('node:path');
    return fs.readFileSync(path.join(__dirname, '../build/autoremesher.wasm'));
  } catch {
    return undefined;
  }
}

function toUint8Array(binary) {
  // Buffer is a Uint8Array subclass on modern Node.
  return binary instanceof Uint8Array ? binary : new Uint8Array(binary);
}

/** Wire local/injected bytes through instantiateWasm (Module.wasmBinary is unused). */
function withLocalWasm(config) {
  if (config.instantiateWasm) return config;

  const wasmBinary = config.wasmBinary || tryReadWasmBinary();
  if (!wasmBinary) return config;

  const bytes = toUint8Array(wasmBinary);
  return Object.assign({}, config, {
    instantiateWasm(imports, successCallback) {
      WebAssembly.instantiate(bytes, imports).then((output) => {
        successCallback(output.instance, output.module);
      });
      // Empty object → async completion via successCallback.
      return {};
    },
  });
}

/**
 * Load (and cache) the wasm module.
 * Electron preload needs local instantiate (process.type === "renderer").
 * Browser: pass locateFile / wasmBinary when the .wasm is not next to the glue.
 */
function loadModule(overrides) {
  if (!modulePromise) {
    modulePromise = createAutoRemesherModule(
      withLocalWasm(Object.assign({}, overrides))
    );
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
