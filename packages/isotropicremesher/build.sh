#!/usr/bin/env bash
# Builds isotropicremesher to a CommonJS module + .wasm with Emscripten.
set -euo pipefail

cd "$(dirname "$0")"

UPSTREAM="upstream"
CPP_DIR="$UPSTREAM/src"
OUT_DIR="build"
PATCH_DIR="patches"

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

if [ ! -d "$CPP_DIR" ]; then
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
    # --ignore-whitespace: upstream sources are CRLF; CI checkouts often
    # normalize to LF, and a CRLF/LF mismatch makes plain `git apply` fail.
    if git -C "$UPSTREAM" apply --ignore-whitespace --check --reverse "$patch_abs" 2>/dev/null; then
      echo "patch already applied: $(basename "$patch")"
    elif git -C "$UPSTREAM" apply --ignore-whitespace --check "$patch_abs" 2>/dev/null; then
      echo "applying patch: $(basename "$patch")"
      git -C "$UPSTREAM" apply --ignore-whitespace "$patch_abs"
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
  "$CPP_DIR/axisalignedboundingboxtree.cpp"
  "$CPP_DIR/isotropichalfedgemesh.cpp"
  "$CPP_DIR/isotropicremesher.cpp"
  "src/bindings.cpp"
)

# CJS build: produces build/isotropicremesher.js + isotropicremesher.wasm.
# ENVIRONMENT=web,worker,node keeps browser + Node glue.
# Do NOT set STRICT=1: js/index.js needs Module.instantiateWasm so Electron
# preload can inject .wasm bytes (ENVIRONMENT_IS_NODE is false when
# process.type==="renderer"). WASM=1 and SINGLE_FILE=0 are defaults.

FLAGS=(
  -std=c++17
  -O3
  -DNDEBUG
  -I"$CPP_DIR"
  --bind
  -s MODULARIZE=1
  -s EXPORT_NAME=createIsotropicRemesherModule
  -s ENVIRONMENT=web,worker,node
  -s ALLOW_MEMORY_GROWTH=1
  -s INITIAL_MEMORY=64mb
  -s EXIT_RUNTIME=0
  -s ASSERTIONS=0
  --no-entry
)

em++ "${FLAGS[@]}" \
  -s EXPORT_ES6=0 \
  -o "$OUT_DIR/isotropicremesher.js" \
  "${SOURCES[@]}"

echo "built: $OUT_DIR/isotropicremesher.js"
ls -lh "$OUT_DIR"
