/**
 * Central place for the 3D scene's tunable visual constants — geometry sizes,
 * label placement, highlight/arrow styling. Kept separate from config.ts (which
 * holds env-driven gameplay knobs). Adjust values here to restyle the cube
 * without hunting through Cube.tsx.
 */
export const SCENE = {
  /** Edge length of each rendered cubie (the visible gap comes from <1 values). */
  pieceSize: 0.95,

  /**
   * Sticker colors by face. Matches the solver's default orientation
   * (F=green, U=white, R=red) — changing these recolors the cube but must stay
   * consistent with that orientation for the solver mapping to hold.
   */
  colors: {
    R: '#B90000', // Right - Red
    L: '#FF5900', // Left - Orange
    U: '#FFFFFF', // Top - White
    D: '#FFD500', // Bottom - Yellow
    F: '#009B48', // Front - Green
    B: '#0045AD', // Back - Blue
    CORE: '#111111', // Inner faces - Black
  },

  /** Floating face-name labels that hover off each face. */
  label: {
    /** Distance from cube center to the label (face surface reaches ~1.5). */
    distance: 3.2,
    fontSize: 0.4,
    outlineWidth: 0.018,
    outlineColor: '#0b1020',
  },

  /** The curved "rotate this face" arrow shown during a move. */
  arrow: {
    /** How far off the face center the arrow glyph sits, along the face normal. */
    faceOffset: 1.75,
    /** Radius of the arc. */
    radius: 1.15,
    /** Thickness of the arc tube. */
    tubeRadius: 0.06,
    coneRadius: 0.16,
    coneHeight: 0.34,
    /** Arc start angle and total sweep (leaves a gap for the arrowhead). */
    arcStart: Math.PI * 0.15,
    arcSweep: Math.PI * 1.5,
    color: '#ffffff',
    emissiveIntensity: 0.6,
  },

  /** Pulsing glow applied to the actively-turning layer. Intensity = base + amplitude*sin(t*frequency). */
  highlight: {
    base: 0.45,
    amplitude: 0.35,
    frequency: 9,
  },
} as const;
