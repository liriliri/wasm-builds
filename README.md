# wasm-builds

Monorepo that ports small C++ libraries to WebAssembly and publishes them to npm.

Each package under `packages/` references its upstream C++ library as a **git submodule**, keeps local
fixes as **patch files** under `packages/<name>/patches/`, adds Embind bindings, and builds to a
CommonJS module + `.wasm` via Emscripten. Upstream sources are never vendored into this repo, so provenance and
the exact upstream commit stay visible.

## Packages

| Package | Upstream | License | Format |
| --- | --- | --- | --- |
| [isotropicremesher](packages/isotropicremesher) | [huxingyi/isotropicremesher](https://github.com/huxingyi/isotropicremesher) @ `d4674ce` | MIT | CJS |
| [autoremesher](packages/autoremesher) | [huxingyi/autoremesher](https://github.com/huxingyi/autoremesher) @ `4a49f82` | MIT | CJS |

## Requirements

- [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) (`em++`) on `PATH`,
  or an `EMSDK` env var pointing at an emsdk checkout (e.g. `EMSDK=$HOME/emsdk npm run build`).
- Node.js >= 18

Install emsdk:

```sh
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest
```

## Build

```sh
git clone --recurse-submodules <this repo>
# or, in an existing checkout:
git submodule update --init --recursive

npm install
npm run build
```

Per package:

```sh
npm run build --workspace isotropicremesher
```

`build.sh` applies `patches/*.patch` to the submodule before compiling. It is idempotent — patches
already applied are skipped, so re-running the build is safe.

## Adding a new library

1. `git submodule add --name <name> <upstream-url> packages/<name>/upstream` and commit the pin.
2. Write `packages/<name>/src/bindings.cpp` exposing the API with Embind.
3. Add a JS wrapper in `packages/<name>/js/` plus types.
4. Add a `build.sh` modelled on `packages/isotropicremesher/build.sh` (compile from `upstream/src`).
5. Add the package to `package.json` (workspaces glob covers it automatically).

## Patching upstream

Upstream is referenced as a submodule and we do **not** maintain forks. Local fixes live as patch
files. Submodules are configured with `ignore = dirty` (see `.gitmodules`) because `build.sh` applies
patches into the submodule worktree — without it, every patched build shows up as repo noise. That
setting still reports genuine commit drift, so an upstream bump is never hidden.

When the upstream C++ needs a change (e.g. a wasm-specific bug), edit the submodule and capture a
patch instead of editing files in this repo:

```sh
cd packages/<name>/upstream
# ...make the edit...
git diff > ../patches/0001-short-description.patch
cd .. && git -C upstream checkout -- .   # leave the submodule pristine
```

`build.sh` re-applies every `patches/*.patch` at build time. If upstream moves and a patch no longer
applies, the build fails with a clear message rather than silently skipping the fix — rebase the
patch then.
