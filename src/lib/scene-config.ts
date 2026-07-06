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

  /**
   * Auto camera tour played when a CFOP stage is mastered (see StageCameraDirector).
   * Spherical coords are relative to `target`: `phi` = polar angle from +Y (keep within
   * (0, ~2.7); π is a degenerate straight-under view), `theta` = azimuth, `radius` clamped
   * to OrbitControls' [4, 12]. Each stage flies to a FOCUS pose framing the face it completes
   * (Cross/F2L on top/white, OLL/PLL dip under to the bottom last layer), then a universal
   * `survey` helical orbit reveals all six faces before the camera returns to rest.
   */
  stageCamera: {
    target: [0, -0.5, 0] as [number, number, number], // cube center (matches the group offset)
    flyDuration: 1.2,
    holdDuration: 1.3,
    returnDuration: 1.2,
    // Per-stage focus pose. `targetY` nudges the look-at point toward the relevant face.
    cross: { phi: 0.55, theta: 0.6, radius: 6.5, targetY: 0.3 }, // look DOWN at the white cross (U/top)
    f2l: { phi: 1.15, theta: 0.6, radius: 7.0, targetY: 0.1 }, // high 3/4 toward the top two layers
    oll: { phi: 2.35, theta: 0.6, radius: 6.5, targetY: -1.1 }, // dip under, look UP at last layer (D/bottom)
    pll: { phi: 2.3, theta: 0.6, radius: 6.8, targetY: -1.1 }, // dip under, look UP at last layer (D/bottom)
    // Universal "show me every face" survey: a helical 360° orbit that tilts up and down so
    // the top, bottom and all four sides pass through view. phi = polarMid + polarAmp*sin(2π·t).
    survey: {
      toSurveyDuration: 0.6, // smooth glide from the focus pose into the orbit start
      duration: 4.0, // one full sweep
      pauseDuration: 1.2, // hold after the survey, before returning to rest
      radius: 8.5, // pulled back so the whole cube stays framed
      polarMid: 1.35,
      polarAmp: 0.85,
      turns: 1, // azimuth revolutions
    },
  },
} as const;
