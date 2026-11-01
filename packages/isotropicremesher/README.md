# isotropicremesher

Isotropic remeshing of triangulated surfaces, compiled to WebAssembly.

Upstream C++: [huxingyi/isotropicremesher](https://github.com/huxingyi/isotropicremesher) — MIT licensed,
copyright (c) 2020-2021 Jeremy HU.

Implements the five steps of isotropic remeshing described in
[these lecture slides](http://graphics.stanford.edu/courses/cs468-12-spring/LectureSlides/13_Remeshing1.pdf).

## Install

```sh
npm install isotropicremesher
```

## Usage

```js
const { remesh, initialAverageEdgeLength } = require('isotropicremesher');
```

```js
const result = await remesh({
  vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0 /* ... */],
  indices: [0, 1, 2 /* ... */],
  iterations: 3,
  targetTriangleCount: 50000,
});

result.vertices; // Float64Array, flat [x, y, z, ...]
result.indices;  // Uint32Array, flat [i0, i1, i2, ...]
```

The package is CommonJS-only; TypeScript types ship as `js/index.d.ts`.

### Environments

Works in **Node.js**, **browsers**, and **Electron preload** (where
`process.type === "renderer"` makes emscripten's Node detection fail). The JS
wrapper reads the `.wasm` via `fs` and instantiates it through
`instantiateWasm` whenever Node APIs are available; in the browser, pass
`locateFile` / `wasmBinary` to `loadModule()` if your bundler does not serve
the `.wasm` next to the glue script:

```js
const { loadModule, remesh } = require('isotropicremesher');

await loadModule({
  locateFile: (file) => `https://cdn.example.com/${file}`,
});
```

By default the remesher targets the mesh's own average edge length. Use one of:

- `targetTriangleCount` — desired number of triangles
- `targetEdgeLength` — desired edge length (e.g. `await initialAverageEdgeLength(vertices, indices)` halved)
- `sharpEdgeIncludedAngle` — degrees; edges sharper than this are preserved as features

## Building from source

The C++ sources come from the `upstream/` git submodule (pinned to
[huxingyi/isotropicremesher](https://github.com/huxingyi/isotropicremesher) `d4674ce`); local fixes
live in `patches/` and are applied by `build.sh`.

```sh
git submodule update --init --recursive   # if not cloned with --recurse-submodules
npm run build                             # needs Emscripten on PATH or EMSDK=/path/to/emsdk
```

Output lands in `build/` (`isotropicremesher.js` + `isotropicremesher.wasm`).

### Patches

- `patches/0001-fix-wasm32-halfedge-key-shift.patch` — under wasm32 `size_t` is 32-bit, so upstream's
  `(first << 32) | second` halfedge key collapsed to `second`, every pair collided and opposite
  halfedges were never linked. The mesh came out roughly 3x too large with wrong geometry. Fixed by
  widening before the shift.

## License

MIT — see [LICENSE](./LICENSE).
