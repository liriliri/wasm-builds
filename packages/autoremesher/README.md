# autoremesher

Automatic quad remeshing of triangulated surfaces, compiled to WebAssembly.

Upstream C++: [huxingyi/autoremesher](https://github.com/huxingyi/autoremesher) — MIT licensed,
copyright (c) 2020-2026 Dust3D Project / Jeremy HU.

Converts a triangle mesh into clean quad topology. The wasm build runs
single-threaded (TBB is shimmed to sequential equivalents) and needs a larger
stack than typical wasm modules because Eigen stack-allocates heavily.

## Install

```sh
npm install autoremesher
```

## Usage

```js
const { remesh } = require('autoremesher');

const result = await remesh({
  vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0 /* ... */],
  indices: [0, 1, 2 /* ... */],
  targetTriangleCount: 1000,
});

result.vertices; // Float64Array, flat [x, y, z, ...]
result.indices;  // Uint32Array, flat [i0, i1, i2, i3, ...] (quads, stride 4)
```

`targetTriangleCount` is **required** — upstream refuses to remesh when it is
unset or zero. `indices` is always stride 4; any non-quad faces left by upstream
cleanup are dropped.

Optional knobs (omit to keep upstream defaults; `0` is a valid explicit value
where the algorithm treats it as off): `scaling`, `modelType`
(`'organic'` | `'hardSurface'`), `gradientAdaptivity`, `sharpEdgeDegrees`,
`anisotropy`, `smoothNormalDegrees`.

The package is CommonJS-only; TypeScript types ship as `js/index.d.ts`.

## Building from source

The C++ sources come from the `upstream/` git submodule (pinned to
[huxingyi/autoremesher](https://github.com/huxingyi/autoremesher)); local fixes
live in `patches/` and are applied by `build.sh`. A sequential TBB shim lives
in `src/tbb_shim/` so the build does not need real TBB or Qt.

```sh
git submodule update --init --recursive   # if not cloned with --recurse-submodules
EMSDK=$HOME/emsdk npm run build           # or have em++ on PATH
```

Output lands in `build/` (`autoremesher.js` + `autoremesher.wasm`).

### Patches

- `patches/0001-fix-wasm32-halfedge-key-shift.patch` — under wasm32 `size_t` is 32-bit, so
  the vendored isotropicremesher's `(first << 32) | second` halfedge key collapsed to
  `second`. Fixed by widening before the shift (same fix as the `isotropicremesher`
  package).

## License

MIT — see [LICENSE](./LICENSE).
