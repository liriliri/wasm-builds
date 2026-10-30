// Type declarations for isotropicremesher (js/index.js).

export interface RemeshOptions {
  /** Flat [x, y, z, ...] vertex positions. Length must be a multiple of 3. */
  vertices: ArrayLike<number>;
  /** Flat [i0, i1, i2, ...] triangle indices. Length must be a multiple of 3. */
  indices: ArrayLike<number>;
  /** Number of remeshing iterations. Defaults to 3. */
  iterations?: number;
  /** Desired triangle count. Takes precedence over targetEdgeLength. */
  targetTriangleCount?: number;
  /** Desired edge length. Ignored when targetTriangleCount is set. */
  targetEdgeLength?: number;
  /** Included angle in degrees; edges sharper than this are preserved. */
  sharpEdgeIncludedAngle?: number;
}

export interface RemeshResult {
  /** Flat [x, y, z, ...] remeshed vertex positions. */
  vertices: Float64Array;
  /** Flat [i0, i1, i2, ...] remeshed triangle indices. */
  indices: Uint32Array;
}

/** Loads (and caches) the WebAssembly module. */
export function loadModule(): Promise<any>;

/** Remeshes a triangle mesh toward isotropic (equilateral) triangles. */
export function remesh(options: RemeshOptions): Promise<RemeshResult>;

/** Average edge length of the input mesh. */
export function initialAverageEdgeLength(
  vertices: ArrayLike<number>,
  indices: ArrayLike<number>
): Promise<number>;

declare const defaultExport: {
  loadModule: typeof loadModule;
  remesh: typeof remesh;
  initialAverageEdgeLength: typeof initialAverageEdgeLength;
};

export default defaultExport;
