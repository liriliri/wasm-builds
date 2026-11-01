const createIsotropicRemesherModule = require('../build/isotropicremesher.js');

let modulePromise = null;

function tryReadWasmBinary() {
  try {
    // Require lazily so browser bundlers without an fs polyfill can still load.
    const fs = require('node:fs');
    const path = require('node:path');
    return fs.readFileSync(
      path.join(__dirname, '../build/isotropicremesher.wasm')
    );
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
    modulePromise = createIsotropicRemesherModule(
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
