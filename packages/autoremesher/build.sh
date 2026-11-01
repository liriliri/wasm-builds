#!/usr/bin/env bash
# Builds autoremesher to a CommonJS module + .wasm with Emscripten.
set -euo pipefail

cd "$(dirname "$0")"

UPSTREAM="upstream"
OUT_DIR="build"
PATCH_DIR="patches"
AR_SRC="$UPSTREAM/src/AutoRemesher"
ISO_SRC="$UPSTREAM/thirdparty/isotropicremesher"
MESHOPT_SRC="$UPSTREAM/thirdparty/meshoptimizer/src"

# Locate emsdk: use EMSDK if set, else fall back to em++ on PATH.
if [ -n "${EMSDK:-}" ]; then
  # shellcheck disable=SC1091
  source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1 || true
fi
if ! command -v em++ >/dev/null 2>&1; then
  echo "error: em++ not found. Install emsdk (https://emscripten.org) and source emsdk_env.sh," >&2
  echo "       or set EMSDK=/path/to/emsdk" >&2
  exit 1
fi

if [ ! -d "$AR_SRC" ]; then
  echo "error: upstream submodule is missing at $UPSTREAM." >&2
  echo "       Run: git submodule update --init --recursive" >&2
  exit 1
fi

# Apply our local patches on top of the pinned upstream commit. Idempotent:
# already-applied patches are skipped so re-running the build is safe.
if [ -d "$PATCH_DIR" ]; then
  shopt -s nullglob
  for patch in "$PATCH_DIR"/*.patch; do
    # git -C changes cwd, so resolve the patch to an absolute path first.
    patch_abs="$(cd "$(dirname "$patch")" && pwd)/$(basename "$patch")"
    if git -C "$UPSTREAM" apply --check --reverse "$patch_abs" 2>/dev/null; then
      echo "patch already applied: $(basename "$patch")"
    elif git -C "$UPSTREAM" apply --check "$patch_abs" 2>/dev/null; then
      echo "applying patch: $(basename "$patch")"
      git -C "$UPSTREAM" apply "$patch_abs"
    else
      echo "error: patch $(basename "$patch") does not apply to $UPSTREAM." >&2
      echo "       The upstream submodule may have moved; rebase the patch." >&2
      exit 1
    fi
  done
  shopt -u nullglob
fi

mkdir -p "$OUT_DIR"

SOURCES=(
  "$AR_SRC/autoremesher.cpp"
  "$AR_SRC/constrainedleastsquares.cpp"
  "$AR_SRC/framefield.cpp"
  "$AR_SRC/isotropicremesher.cpp"
  "$AR_SRC/meshseparator.cpp"
  "$AR_SRC/mixedintegerleastsquares.cpp"
  "$AR_SRC/parameterizer.cpp"
  "$AR_SRC/positionkey.cpp"
  "$AR_SRC/quadextractor.cpp"
  "$AR_SRC/quadparameterizer.cpp"
  "$AR_SRC/singularitysimplifier.cpp"
  "$AR_SRC/surfacemesh.cpp"
  "$ISO_SRC/axisalignedboundingboxtree.cpp"
  "$ISO_SRC/isotropichalfedgemesh.cpp"
  "$ISO_SRC/isotropicremesher.cpp"
  "$MESHOPT_SRC/indexgenerator.cpp"
  "$MESHOPT_SRC/simplifier.cpp"
  "src/bindings.cpp"
)

# CJS build: produces build/autoremesher.js + autoremesher.wasm.
# TBB is replaced by src/tbb_shim (sequential). Eigen is header-only.
# STACK_SIZE=32mb: Eigen stack-allocates heavily; the default overflows.
# ENVIRONMENT=web,worker,node keeps browser + Node glue.
# Do NOT set STRICT=1: js/index.js needs Module.instantiateWasm so Electron
# preload can inject .wasm bytes (ENVIRONMENT_IS_NODE is false when
# process.type==="renderer"). WASM=1 and SINGLE_FILE=0 are defaults.

FLAGS=(
  -std=c++17
  -O3
  -DNDEBUG
  -I"$UPSTREAM/include"
  -I"$UPSTREAM/thirdparty/eigen"
  -I"$ISO_SRC"
  -I"$MESHOPT_SRC"
  -I"src/tbb_shim"
  --bind
  -s MODULARIZE=1
  -s EXPORT_NAME=createAutoRemesherModule
  -s ENVIRONMENT=web,worker,node
  -s ALLOW_MEMORY_GROWTH=1
  -s INITIAL_MEMORY=128mb
  -s STACK_SIZE=32mb
  -s EXIT_RUNTIME=0
  -s ASSERTIONS=0
  --no-entry
)

em++ "${FLAGS[@]}" \
  -s EXPORT_ES6=0 \
  -o "$OUT_DIR/autoremesher.js" \
  "${SOURCES[@]}"

echo "built: $OUT_DIR/autoremesher.js"
ls -lh "$OUT_DIR"
