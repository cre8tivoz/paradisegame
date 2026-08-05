/**
 * Tunables. Everything a designer would want to feel out lives here, not
 * buried in the controller.
 *
 * Units are metres, seconds, radians.
 */

const DEG = Math.PI / 180

export const PLAYER = {
  /** Purposeful walk. Miller is working, not strolling and not jogging. */
  walkSpeed: 2.2,
  crouchSpeed: 1.1,
  /**
   * Run. Only forward, only standing. There is no stamina and no fail state,
   * so this is a speed change and nothing else. Scene 3's chase is scripted
   * and designed to be lost, so run never has to be balanced against AI.
   */
  runSpeed: 4.6,

  /** Exponential approach rate toward target velocity. Higher is snappier. */
  groundResponse: 14,

  eyeHeightStand: 1.7,
  eyeHeightCrouch: 1.05,
  /** Exponential approach rate for the stance change. */
  stanceResponse: 11,

  /** Collision radius of the vertical cylinder Miller occupies. */
  radius: 0.32,
  /**
   * Collision height of that cylinder. Head clearance, not eye height. Anything
   * whose underside is above this is something Miller walks under, which is how
   * a door lintel stops being a wall.
   */
  height: 1.84,
  /**
   * How high a step Miller takes without thinking about it. Shorter than this
   * and it is walked over rather than walked into, which is the whole reason a
   * stair tread is a floor and a threshold is not a wall.
   *
   * A Victorian stair rises about 0.18 a tread, so this clears one comfortably
   * and refuses two.
   */
  stepUp: 0.28,
  /**
   * The same allowance downward. Beyond it there is no floor and the move is
   * refused, so the edge of a landing stops Miller instead of dropping him.
   * There is no gravity in this game and nothing ever falls.
   */
  stepDown: 0.34,
  /** Exponential rate the view catches up after a step. Higher is stiffer. */
  stepResponse: 15,

  leanAngle: 14 * DEG,
  leanOffset: 0.42,
  leanResponse: 12,

  /** Distance walked between footstep events. */
  strideLength: 0.78,
  /** A runner covers more ground per step, so footsteps must not machine-gun. */
  runStrideLength: 1.15,
  /** Vertical head travel across a stride. Deliberately small. */
  headBobAmplitude: 0.018,
  headBobEnabled: true,

  /** Hold to crouch. Set true to toggle instead. */
  crouchIsToggle: false,
} as const

export const CAMERA = {
  fov: 70,
  near: 0.05,
  far: 100,
  /** Radians of yaw or pitch per pixel of mouse travel. */
  sensitivity: 0.0022,
  pitchClamp: 88 * DEG,
} as const

export const LOOP = {
  /**
   * Delta is clamped to this so a tabbed-out frame cannot teleport Miller.
   *
   * It is also the tunnelling guard. Collision is a pushout, not a swept test,
   * so a single frame must never carry Miller past the midplane of a wall.
   * That budget is `radius` + half the wall thickness, or 0.32 + 0.15 = 0.47.
   * At runSpeed 4.6 this clamp allows 4.6 * 0.05 = 0.23, which is half of it.
   *
   * Raise runSpeed or this number and check that sum again, or Miller will go
   * through a wall on a stalled frame.
   */
  maxDelta: 0.05,
} as const

export const RENDER = {
  maxPixelRatio: 2,
  /**
   * ACES filmic + this exposure are what stop the 3pm sun (intensity 8) from
   * turning Crystal's cream dress and every lit wall into clipped white. The
   * light grade CLAUDE.md still lists as owed starts here; without it the room
   * cannot photograph.
   */
  exposure: 0.85,
} as const

export const HAND = {
  /**
   * How far in front of the camera an examine reaches. The clip anchors to the
   * object, clamped into this band, so Miller reaches the thing that is really
   * there without his arm stretching across the room.
   */
  reachMin: 0.32,
  reachMax: 0.52,
} as const

export const INTERACT = {
  /**
   * How far Miller can look at something. Arm's reach and a bit. Short enough
   * that he has to walk up to a thing, which is most of the pacing.
   */
  lookRange: 3,
  /** Seconds for the description line to fade in and out. */
  descriptionFade: 0.18,
} as const
