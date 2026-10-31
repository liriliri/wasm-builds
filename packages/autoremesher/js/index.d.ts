// Type declarations for autoremesher (js/index.js).

export type ModelType = 'organic' | 'hardSurface' | 0 | 1;

export interface RemeshOptions {
  /** Flat [x, y, z, ...] vertex positions. Length must be a multiple of 3. */
  vertices: ArrayLike<number>;
  /** Flat [i0, i1, i2, ...] triangle indices. Length must be a multiple of 3. */
  indices: ArrayLike<number>;
  /** Desired triangle count used to size the remesh. Required; must be > 0. */
  targetTriangleCount: number;
  /** Optional global scale applied before remeshing. */
  scaling?: number;
  /** Organic (default) or hard-surface feature preservation. */
  modelType?: ModelType;
  /** Gradient-field adaptivity. Omit for upstream default; 0 disables it. */
  gradientAdaptivity?: number;
  /** Sharp-edge threshold in degrees. Omit for upstream default (90). */
  sharpEdgeDegrees?: number;
  /** Anisotropy. Omit for upstream default; 0 disables it. */
  anisotropy?: number;
  /** Smooth-normal threshold in degrees. Omit for upstream default (0). */
  smoothNormalDegrees?: number;
}

export interface RemeshResult {
  /** Flat [x, y, z, ...] remeshed vertex positions. */
  vertices: Float64Array;
  /**
   * Flat [i0, i1, i2, i3, ...] quad indices (stride 4).
   * Non-quad faces left by upstream cleanup are dropped.
   */
  indices: Uint32Array;
}

/** Loads (and caches) the WebAssembly module. */
export function loadModule(): Promise<any>;

/** Quad-remeshes a triangle mesh. */
export function remesh(options: RemeshOptions): Promise<RemeshResult>;

declare const defaultExport: {
  loadModule: typeof loadModule;
  remesh: typeof remesh;
};

export default defaultExport;
