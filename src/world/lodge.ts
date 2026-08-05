import {
  AdditiveBlending,
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Vector3,
} from 'three'
import { EXTERIOR, INTERIOR } from '../materials/palette.ts'
import { neonPlate, tiled } from '../materials/textures.ts'
import type { WalkableRegion } from './collision.ts'
import { aabb, elevation, mat, raked, slab, unlit, walk, wall } from './kit.ts'

/**
 * The Paradise Lodge: the approach and the ground floor, plus the staircase and
 * the first-floor hall that room 1A opens off.
 *
 * BRIEF.md cold open: marble steps, neon sign, in through the front door,
 * parlour to the left, reception to the right, central staircase, turn right
 * at the top to 1A. This is the route in and the route back down, so it is
 * built as one piece of geometry rather than a room at a time.
 *
 * Kit primitives against the locked palette, like room 1A. Everything here is
 * scaffolding until modelled pieces land.
 *
 * ## Plan
 *
 * -Z is the street. +X is the side the verandah wraps onto, which is where 1A's
 * sash looks and where the 3pm sun comes from.
 *
 * ```
 *              x -6.5          -1.7   0   1.7          +6.4
 *   z = -1.75   .. footpath, marble steps, police tape ..
 *   z =  0      +---------------+------+---------------+
 *               |               |      |               |
 *               |    PARLOUR    | HALL |   RECEPTION   |
 *   z =  5.0    +---------------+      +---------------+
 *                               | STAIR| passage
 *   z = 10.5                    +------+
 * ```
 *
 * The flight climbs the -X half of the hall toward the back, so the passage
 * runs beside it rather than under it, and the stairwell above is open on that
 * side. At the top you turn around, walk back toward the street, and 1A is the
 * first door on the right.
 */

export interface Lodge {
  readonly group: Group
  /** Temporary kit interior, detached once the Blender-authored Unit A loads. */
  readonly interiorVisuals: Group
  readonly solids: Box3[]
  readonly floors: WalkableRegion[]
  /** On the footpath, facing the steps. Where the cold open will start. */
  readonly spawn: Vector3
  readonly spawnYaw: number
  readonly props: {
    readonly frontDoor: Object3D
    readonly neon: Object3D
    readonly tape: Object3D
    readonly steps: Object3D
    readonly stairs: Object3D
    readonly desk: Object3D
    readonly keyRack: Object3D
    readonly ledger: Object3D
    readonly phone: Object3D
    readonly ashtray: Object3D
    readonly armchair: Object3D
    readonly parlourTable: Object3D
    readonly diary: Object3D
    readonly television: Object3D
    readonly standardLamp: Object3D
    readonly commodore: Object3D
    readonly uniforms: Object3D
  }
  /** One tube in the sign is crook. Called once a frame with elapsed seconds. */
  update(elapsed: number, playerPos: Vector3): void
}

// --- Plan ---

const HALL_X0 = -1.75
const HALL_X1 = 1.75
/**
 * The flight, and the stairwell open above it, sit in x < STAIR_EDGE. The
 * passage runs beside it in the rest of the hall, which is what stops the route
 * to the foot of the stairs going underneath them.
 */
const STAIR_EDGE = -0.3
const STAIR_X0 = -1.7

const FRONT = -0.1
const BACK = 10.5
/** Back of the parlour and reception. The stair hall carries on past it. */
const ROOM_BACK = 5.05

const LEFT = -6.5
const RIGHT = 6.4

// --- Section ---

const GROUND = 0
const CEIL_GROUND = 3.2
const FIRST = 3.45
const CEIL_FIRST = 6.5
const PARAPET = 6.9

/** Footpath. The marble steps are the difference between this and the floor. */
const PATH = -0.72
const ROAD = -0.85

const INT = 0.14

const DOOR_H = 2.15
const OPENING_W = 1.15

// --- Staircase ---

/**
 * Eighteen risers to the first floor, seventeen of them treads. The last riser
 * steps onto the landing.
 *
 * `RISE` has to stay under `PLAYER.stepUp` or the flight becomes a wall, and
 * over half of `PLAYER.stepDown` or coming down skips a tread.
 */
const TREADS = 17
const RISE = FIRST / 18
const GOING = 0.28
const STAIR_Z0 = 5.2
const STAIR_Z1 = STAIR_Z0 + TREADS * GOING

export function buildLodge(): Lodge {
  const group = new Group()
  group.name = 'lodge'
  const solids: Box3[] = []
  const floors: WalkableRegion[] = []

  const render = new MeshStandardMaterial({
    color: 0xffffff,
    map: tiled('render-cream', 4.5, 3.2),
    roughness: 0.94,
  })
  const stain = mat(EXTERIOR.renderStain, 0.96)
  const marble = new MeshStandardMaterial({
    color: 0xffffff,
    map: tiled('marble-step', 2.2, 1.4),
    roughness: 0.55,
  })
  const iron = mat(EXTERIOR.ironLace, 0.55, 0.4)
  const bitumen = mat(EXTERIOR.bitumen, 0.62)
  const nicotine = mat(INTERIOR.nicotine, 0.95)
  const carpet = new MeshStandardMaterial({
    color: 0xffffff,
    map: tiled('carpet-brown', 8, 5),
    roughness: 0.98,
  })
  const timber = new MeshStandardMaterial({
    color: 0xffffff,
    map: tiled('timber-dark', 1.6, 2.0),
    roughness: 0.76,
  })
  const brass = mat(INTERIOR.brassVerdigris, 0.42, 0.55)
  const maroon = mat(INTERIOR.curtainMaroon, 0.9)
  const tapeBlue = mat(EXTERIOR.tapeBlue, 0.8)

  // === The street ===

  slab(group, bitumen, -22, 22, ROAD - 0.4, ROAD, -26, FRONT - 0.35).receiveShadow = true
  walk(floors, 'bitumen', -20, 20, -24, -1.45, ROAD)

  // Footpath, kerb proud of the road.
  slab(group, marble, -14, 14, PATH - 0.35, PATH, -4.0, FRONT - 0.35)
  walk(floors, 'bitumen', -13.8, 13.8, -3.95, -1.4, PATH)

  // === Marble steps ===
  // Four risers from the footpath to the threshold. Worn hollow at the centre
  // is a texture job, not geometry, so they are square for now.

  const steps = new Group()
  steps.name = 'steps'
  group.add(steps)
  for (let i = 0; i < 4; i += 1) {
    // Highest against the wall, stepping down toward the footpath.
    const top = GROUND - i * ((GROUND - PATH) / 4)
    const z1 = FRONT - 0.35 - i * 0.35
    const z0 = z1 - 0.35
    slab(steps, marble, -1.7, 1.7, top - 0.4, top, z0, z1)
    walk(floors, 'marble', -1.65, 1.65, z0, z1, top)
  }
  // Cheek walls either side, so the flight reads as a flight.
  wall(group, solids, marble, -2.05, -1.68, PATH - 0.1, GROUND + 0.55, -1.75, FRONT - 0.35)
  wall(group, solids, marble, 1.68, 2.05, PATH - 0.1, GROUND + 0.55, -1.75, FRONT - 0.35)

  // === Police tape ===
  // Two halves, each parented to a pivot at its outer post so the cold open
  // can rotate them upward. The uniforms at the inner posts hold the raised
  // ends. Until the player approaches the tape hangs at waist height, already
  // parted at the centre.

  const tape = new Group()
  tape.name = 'tape'
  group.add(tape)

  const tapeLeftPivot = new Group()
  tapeLeftPivot.position.set(-4.6, 0, -2.335)
  tape.add(tapeLeftPivot)
  const tapeRightPivot = new Group()
  tapeRightPivot.position.set(4.6, 0, -2.335)
  tape.add(tapeRightPivot)

  slab(tapeLeftPivot, tapeBlue, 0, 3.65, PATH + 0.94, PATH + 1.02, -0.015, 0.015)
  slab(tapeLeftPivot, iron, -0.03, 0.03, PATH, PATH + 1.15, -0.06, 0)
  slab(tapeLeftPivot, iron, 3.62, 3.68, PATH, PATH + 1.15, -0.06, 0)

  slab(tapeRightPivot, tapeBlue, -3.65, 0, PATH + 0.94, PATH + 1.02, -0.015, 0.015)
  slab(tapeRightPivot, iron, -0.03, 0.03, PATH, PATH + 1.15, -0.06, 0)
  slab(tapeRightPivot, iron, -3.68, -3.62, PATH, PATH + 1.15, -0.06, 0)

  // === Exterior shell ===
  // Rendered Victorian, sun-bleached, damp rising up the front.

  /*
   * Front elevation. Built as piers between openings rather than as three
   * boxes, because a facade with only a door in it reads as a wall with a hole,
   * not a house.
   *
   * The ground-floor windows are real openings: the sun comes from the front
   * right, so they are the only daylight the parlour and reception get, and
   * without them both rooms are lit by fill alone and go flat.
   */
  const frontZ0 = FRONT - 0.35
  const frontZ1 = FRONT - 0.1
  const SILL = 0.95
  const HEAD = 2.75

  /*
   * The first-floor opening is room 1A's street window. It sits inside the
   * head over the reception window, which is why the elevation is built by
   * scanline and not as piers: openings here stack as well as sit side by side.
   *
   * Keep FIRST_WINDOW in step with FRONT_WINDOW_* in room1a.ts. This is the
   * hole in the outside wall; that is the hole in the room's own wall, and they
   * have to be the same hole.
   */
  const FIRST_WINDOW = { x0: 2.55, x1: 3.65, y0: 4.32, y1: 6.08 }

  /*
   * Three bays and a centred entrance. The upstairs windows sit directly over
   * the downstairs ones, because they are meant to be the same house twice and
   * a facade where they do not line up reads as a mistake before it reads as
   * anything else.
   */
  const BAYS = [-5.9, -3.6, 2.55] as const
  const BAY_WIDTH = 1.1

  const openings = [
    { x0: BAYS[0], x1: BAYS[0] + BAY_WIDTH, y0: SILL, y1: HEAD, glazed: true },
    { x0: BAYS[1], x1: BAYS[1] + BAY_WIDTH, y0: SILL, y1: HEAD, glazed: true },
    { x0: -0.62, x1: 0.62, y0: PATH - 0.4, y1: DOOR_H, glazed: false },
    { x0: BAYS[2], x1: BAYS[2] + BAY_WIDTH, y0: SILL, y1: HEAD, glazed: true },
  ] as const

  elevation(group, solids, render, LEFT - 0.25, RIGHT + 0.25, PATH - 0.4, PARAPET, frontZ0, frontZ1, [
    ...openings,
    FIRST_WINDOW,
  ])

  // Rising damp. Unlit-flat would be wrong; it is a stain on render.
  slab(group, stain, LEFT - 0.25, RIGHT + 0.25, PATH - 0.4, PATH + 0.72, frontZ0 - 0.01, frontZ0)

  /*
   * Glass, not board. Same trap as room 1A's sash: a solid pane makes the
   * window an opaque black rectangle and, worse, a shadow caster, so the room
   * behind it gets nothing.
   */
  const glass = new MeshBasicMaterial({
    color: 0xf6efe0,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  })

  for (const o of openings) {
    if (!o.glazed) {
      continue
    }
    const mid = (o.y0 + o.y1) / 2
    const pane = new Mesh(new BoxGeometry(o.x1 - o.x0 - 0.1, o.y1 - o.y0 - 0.08, 0.012), glass)
    pane.position.set((o.x0 + o.x1) / 2, mid, frontZ1 - 0.06)
    group.add(pane)
    // Meeting rail and stiles, so the joinery still reads through clear glass.
    slab(group, timber, o.x0 + 0.05, o.x1 - 0.05, mid - 0.03, mid + 0.03, frontZ1 - 0.09, frontZ1 - 0.03)
    slab(group, timber, o.x0, o.x0 + 0.06, o.y0, o.y1, frontZ1 - 0.09, frontZ1 - 0.03)
    slab(group, timber, o.x1 - 0.06, o.x1, o.y0, o.y1, frontZ1 - 0.09, frontZ1 - 0.03)
    // Sill, proud of the render.
    slab(group, marble, o.x0 - 0.12, o.x1 + 0.12, o.y0 - 0.09, o.y0, frontZ0 - 0.08, frontZ1)
    // Curtains, hung either side and sun-rotted at the leading edge.
    slab(group, maroon, o.x0 - 0.2, o.x0 + 0.16, o.y0 - 0.1, o.y1 + 0.2, FRONT, FRONT + 0.12)
    slab(group, maroon, o.x1 - 0.16, o.x1 + 0.2, o.y0 - 0.1, o.y1 + 0.2, FRONT, FRONT + 0.12)
  }

  /*
   * The other two first-floor windows are applied, not cut. At 3pm an unlit
   * upstairs room photographs as a black rectangle from the street, which is
   * exactly what these are, so there is nothing behind them worth a hole.
   *
   * 1A's is the real one, and it only gets a surround here.
   */
  for (const x0 of BAYS) {
    const x1 = x0 + BAY_WIDTH
    const cut = x0 === FIRST_WINDOW.x0
    slab(group, marble, x0 - 0.12, x1 + 0.12, FIRST_WINDOW.y0 - 0.1, FIRST_WINDOW.y0, frontZ0 - 0.16, frontZ0)
    slab(group, timber, x0 - 0.09, x0, FIRST_WINDOW.y0, FIRST_WINDOW.y1, frontZ0 - 0.08, frontZ0)
    slab(group, timber, x1, x1 + 0.09, FIRST_WINDOW.y0, FIRST_WINDOW.y1, frontZ0 - 0.08, frontZ0)
    slab(group, timber, x0 - 0.09, x1 + 0.09, FIRST_WINDOW.y1, FIRST_WINDOW.y1 + 0.1, frontZ0 - 0.08, frontZ0)
    if (!cut) {
      slab(group, mat(0x2a2620, 0.35, 0.1), x0, x1, FIRST_WINDOW.y0, FIRST_WINDOW.y1, frontZ0 - 0.02, frontZ0)
    }
  }

  // Sides and back. The right side stops short of 1A's sash: that opening is in
  // room 1A's own wall, and doubling it here would brick the window up.
  wall(group, solids, render, LEFT - 0.25, LEFT, PATH - 0.4, PARAPET, frontZ0, BACK + 0.25)
  wall(group, solids, render, RIGHT, RIGHT + 0.25, PATH - 0.4, FIRST, frontZ0, BACK + 0.25)
  wall(group, solids, render, RIGHT, RIGHT + 0.25, FIRST, PARAPET, STAIR_Z0, BACK + 0.25)
  wall(group, solids, render, RIGHT, RIGHT + 0.25, CEIL_FIRST, PARAPET, frontZ0, STAIR_Z0)
  wall(group, solids, render, LEFT - 0.25, RIGHT + 0.25, PATH - 0.4, PARAPET, BACK, BACK + 0.25)

  /*
   * Rear elevation. Applied windows, not cut.
   *
   * The yard looks straight at this wall and a blank thirteen metre slab is the
   * biggest thing in it. Nothing is opened, though: the only way into the yard
   * is down the external stairs, and that is what makes clocking them at gate 4
   * worth anything. A back door here would hand the player a shortcut and take
   * the beat away.
   */
  for (const x0 of [-5.0, -1.6, 3.2]) {
    const x1 = x0 + BAY_WIDTH
    for (const [y0, y1] of [
      [SILL, HEAD],
      [FIRST_WINDOW.y0, FIRST_WINDOW.y1],
    ] as const) {
      slab(group, timber, x0 - 0.09, x1 + 0.09, y0 - 0.09, y1 + 0.1, BACK + 0.25, BACK + 0.33)
      slab(group, mat(0x2a2620, 0.35, 0.1), x0, x1, y0, y1, BACK + 0.33, BACK + 0.35)
      slab(group, marble, x0 - 0.14, x1 + 0.14, y0 - 0.18, y0 - 0.09, BACK + 0.25, BACK + 0.39)
    }
  }

  // Roof lid. Has to cast, or the sun comes straight through it and lights the
  // first-floor hall from above in a slab that reads as a render fault.
  slab(group, render, LEFT - 0.25, RIGHT + 0.25, PARAPET - 0.2, PARAPET, frontZ0, BACK + 0.25)

  // === Neon ===
  // Two lines over the entrance. Unlit, because a tube is a light source, not a
  // lit surface, and at 3pm it is barely winning against the sun anyway.
  // Letterforms want a texture; these are the tubes they will be bent into.

  const neon = new Group()
  neon.name = 'neon'
  group.add(neon)
  // 3:2 plate from the authored PNGs. Board is tall enough to carry it.
  slab(neon, mat(EXTERIOR.signBoard, 0.85), -2.15, 2.15, 3.35, 5.15, frontZ0 - 0.16, frontZ0 - 0.02)
  const neonTexA = neonPlate('neon-sign')
  const neonTexB = neonPlate('neon-sign-2')
  const neonMat = new MeshBasicMaterial({
    map: neonTexA,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
  const neonPlateMesh = new Mesh(new PlaneGeometry(4.05, 2.7), neonMat)
  neonPlateMesh.position.set(0, 4.25, frontZ0 - 0.2)
  neon.add(neonPlateMesh)

  // === Front door ===

  const frontDoor = new Group()
  frontDoor.name = 'frontDoor'
  frontDoor.position.set(-0.58, GROUND, frontZ1)
  frontDoor.rotation.y = -1.85
  const leaf = slab(frontDoor, timber, 0.02, 1.14, 0.02, DOOR_H - 0.03, -0.05, 0.0)
  leaf.castShadow = true
  group.add(frontDoor)
  // Threshold, so the doorway is not a hole in the floor plan.
  walk(floors, 'marble', -0.6, 0.6, frontZ0, FRONT + 0.1, GROUND)

  // === Ground floor ===

  const interiorStart = group.children.length

  slab(group, carpet, LEFT, RIGHT, GROUND - 0.1, GROUND, FRONT, BACK).receiveShadow = true
  walk(floors, 'carpet', HALL_X0, HALL_X1, FRONT - 0.2, STAIR_Z0 + 0.05, GROUND)
  walk(floors, 'carpet', STAIR_EDGE - 0.05, HALL_X1, STAIR_Z0 + 0.05, BACK, GROUND)
  walk(floors, 'carpet', LEFT, HALL_X0 + 0.15, FRONT, ROOM_BACK, GROUND)
  walk(floors, 'floorboard', HALL_X1 - 0.15, RIGHT, FRONT, ROOM_BACK, GROUND)

  // Reception is boards, not runner.
  slab(group, timber, HALL_X1, RIGHT, GROUND - 0.09, GROUND + 0.005, FRONT, ROOM_BACK)

  // Hall walls, one opening each into the parlour and reception.
  for (const side of [-1, 1] as const) {
    const x1 = side < 0 ? HALL_X0 + INT : HALL_X1
    const x0 = x1 - INT
    wall(group, solids, nicotine, x0, x1, GROUND, CEIL_GROUND, FRONT - 0.2, 1.9)
    wall(group, solids, nicotine, x0, x1, GROUND, CEIL_GROUND, 1.9 + OPENING_W, ROOM_BACK + INT)
    wall(group, solids, nicotine, x0, x1, DOOR_H, CEIL_GROUND, 1.9, 1.9 + OPENING_W)
    // Architrave, so an opening reads as a doorway and not a missing wall.
    slab(group, timber, x0 - 0.02, x1 + 0.02, DOOR_H, DOOR_H + 0.09, 1.86, 1.94 + OPENING_W)
  }

  // Backs of the parlour and reception.
  wall(group, solids, nicotine, LEFT, HALL_X0 + INT, GROUND, CEIL_GROUND, ROOM_BACK, ROOM_BACK + INT)
  wall(group, solids, nicotine, HALL_X1 - INT, RIGHT, GROUND, CEIL_GROUND, ROOM_BACK, ROOM_BACK + INT)

  // Ground-floor ceiling over the rooms and the front of the hall. Casts, for
  // the same reason the roof does.
  slab(group, nicotine, LEFT, RIGHT, CEIL_GROUND, CEIL_GROUND + 0.09, FRONT, ROOM_BACK + INT)

  // Skirting round the hall, and the picture rail the nicotine stops at.
  for (const x of [HALL_X0 + INT + 0.01, HALL_X1 - INT - 0.01]) {
    slab(group, timber, x - 0.02, x + 0.02, GROUND, GROUND + 0.16, FRONT, ROOM_BACK)
  }

  // === Staircase ===

  const stairs = new Group()
  stairs.name = 'stairs'
  group.add(stairs)

  for (let n = 1; n <= TREADS; n += 1) {
    const top = n * RISE
    const z0 = STAIR_Z0 + (n - 1) * GOING
    const z1 = z0 + GOING
    slab(stairs, timber, STAIR_X0, STAIR_EDGE, top - RISE, top, z0, z1)
    // Runner, worn through on the treads. Inset, so the boards show at the edge.
    slab(stairs, carpet, STAIR_X0 + 0.16, STAIR_EDGE - 0.16, top, top + 0.012, z0, z1)
    walk(floors, 'carpet', STAIR_X0, STAIR_EDGE, z0, z1, top)
  }

  /*
   * Closed string and handrail down the open side. Both rake, so they are
   * rotated meshes and carry no collision of their own. The upright box below
   * is what actually keeps Miller off the edge.
   *
   * Stop short of the top landing. A rail that ran to STAIR_Z1 left less than a
   * player radius between its end and the back wall, so the landing was a dead
   * end. The last few treads are open on this side; the top newel marks where
   * the rail stops and the turn onto the landing begins.
   */
  const RAIL_TREADS = TREADS - 3
  const run = (RAIL_TREADS - 1) * GOING
  const climb = (RAIL_TREADS - 1) * RISE
  const rake = Math.atan2(climb, run)
  const rakeLength = Math.hypot(run, climb)
  const rakeMidY = RISE + climb / 2
  const rakeMidZ = STAIR_Z0 + GOING / 2 + run / 2
  const railEndZ = STAIR_Z0 + RAIL_TREADS * GOING

  const string = raked(stairs, timber, 0.14, 0.4, rakeLength)
  string.position.set(STAIR_EDGE, rakeMidY - 0.22, rakeMidZ)
  string.rotation.x = -rake

  const rail = raked(stairs, timber, 0.1, 0.09, rakeLength)
  rail.position.set(STAIR_EDGE, rakeMidY + 0.92, rakeMidZ)
  rail.rotation.x = -rake

  // Newels at foot and head of the flight rail.
  slab(stairs, timber, STAIR_EDGE - 0.09, STAIR_EDGE + 0.09, 0, 1.2, STAIR_Z0 + 0.52, STAIR_Z0 + 0.7)
  const railTopY = RAIL_TREADS * RISE
  slab(
    stairs,
    timber,
    STAIR_EDGE - 0.09,
    STAIR_EDGE + 0.09,
    railTopY,
    railTopY + 1.05,
    railEndZ - 0.12,
    railEndZ + 0.06,
  )
  // Solid stops with the rail. Landing clearance past this is what lets Miller
  // turn onto the first-floor hall; do not push it back to STAIR_Z1.
  solids.push(
    aabb(STAIR_EDGE - 0.02, STAIR_EDGE + 0.14, GROUND, CEIL_FIRST, STAIR_Z0 + 0.58, railEndZ),
  )

  for (let n = 3; n <= RAIL_TREADS; n += 1) {
    const top = n * RISE
    const z = STAIR_Z0 + (n - 0.5) * GOING
    slab(stairs, timber, STAIR_EDGE - 0.03, STAIR_EDGE + 0.03, top, top + 0.82, z - 0.025, z + 0.025)
  }

  // === First floor ===

  // Slab under the hall and landing. This is also the ceiling over the passage.
  slab(group, nicotine, STAIR_EDGE - 0.16, HALL_X1, FIRST - 0.16, FIRST, FRONT, BACK)
  slab(group, nicotine, STAIR_X0 - 0.05, HALL_X1, FIRST - 0.16, FIRST, STAIR_Z1 - 0.06, BACK)
  slab(group, carpet, STAIR_EDGE - 0.16, HALL_X1, FIRST, FIRST + 0.008, FRONT, BACK)
  slab(group, carpet, STAIR_X0 - 0.05, HALL_X1, FIRST, FIRST + 0.008, STAIR_Z1 - 0.06, BACK)

  walk(floors, 'carpet', STAIR_EDGE - 0.02, HALL_X1, FRONT, BACK, FIRST)
  walk(floors, 'carpet', STAIR_X0, HALL_X1, STAIR_Z1 - 0.06, BACK, FIRST)

  // Hall walls. The right-hand one only runs behind 1A; 1A's own wall carries
  // the doorway in front of it.
  wall(group, solids, nicotine, STAIR_EDGE - 0.16, STAIR_EDGE - 0.02, FIRST, CEIL_FIRST, FRONT, STAIR_Z0)
  wall(group, solids, nicotine, HALL_X1 - INT, HALL_X1, FIRST, CEIL_FIRST, STAIR_Z0, BACK)
  wall(group, solids, nicotine, STAIR_X0 - 0.05, STAIR_X0 + 0.09, FIRST, CEIL_FIRST, STAIR_Z1 - 0.06, BACK)

  /*
   * Banister along the open stairwell on the first-floor hall. Waist height,
   * not a wall: the void is what you look down into as you walk back toward
   * the street. Stops at the same z as the flight rail so the landing stays clear.
   */
  const hallRailZ0 = STAIR_Z0
  const hallRailZ1 = railEndZ
  slab(group, timber, STAIR_EDGE - 0.04, STAIR_EDGE + 0.06, FIRST + 0.9, FIRST + 0.98, hallRailZ0, hallRailZ1)
  for (let z = hallRailZ0 + 0.2; z < hallRailZ1; z += 0.28) {
    slab(group, timber, STAIR_EDGE - 0.02, STAIR_EDGE + 0.04, FIRST, FIRST + 0.9, z - 0.02, z + 0.02)
  }
  slab(group, timber, STAIR_EDGE - 0.08, STAIR_EDGE + 0.08, FIRST, FIRST + 1.0, hallRailZ1 - 0.1, hallRailZ1 + 0.06)
  solids.push(
    aabb(STAIR_EDGE - 0.02, STAIR_EDGE + 0.1, FIRST, FIRST + 1.05, hallRailZ0, hallRailZ1),
  )

  // Numbered doors, shut. 1A is the first on the right and is a real room; these
  // are the neighbours and they stay closed for the whole game.
  for (const z of [6.0, 8.1]) {
    slab(group, timber, HALL_X1 - INT - 0.05, HALL_X1 - INT, FIRST, FIRST + DOOR_H, z, z + 0.9)
    slab(group, brass, HALL_X1 - INT - 0.09, HALL_X1 - INT - 0.05, FIRST + 1.02, FIRST + 1.1, z + 0.72, z + 0.8)
  }

  // First-floor ceiling.
  slab(group, nicotine, STAIR_X0 - 0.05, HALL_X1, CEIL_FIRST, CEIL_FIRST + 0.09, FRONT, BACK)

  // === Reception ===
  // Desk sits clear of the hall opening. A previous span started at x 2.32,
  // which left 0.57m against the hall wall — less than a player diameter — so
  // the doorway dumped Miller into a dead end. Gap from HALL_X1 to the desk
  // end is the circulation path; Rosie stays behind it at z 3.15.

  const desk = new Group()
  desk.name = 'desk'
  group.add(desk)
  slab(desk, timber, 3.4, 5.6, GROUND, 1.06, 2.0, 2.6)
  slab(desk, timber, 3.32, 5.68, 1.06, 1.14, 1.92, 2.72)

  const keyRack = new Group()
  keyRack.name = 'keyRack'
  group.add(keyRack)
  slab(keyRack, timber, 2.6, 5.2, 1.35, 2.5, ROOM_BACK - 0.22, ROOM_BACK - 0.06)
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const x = 2.72 + col * 0.31
      const y = 1.46 + row * 0.27
      slab(keyRack, mat(0x1a1512, 1), x, x + 0.25, y, y + 0.21, ROOM_BACK - 0.245, ROOM_BACK - 0.215)
    }
  }

  const ledger = slab(group, mat(0xd8cfbc, 0.9), 4.0, 4.7, 1.14, 1.2, 2.1, 2.52)
  ledger.name = 'ledger'
  const phone = new Group()
  phone.name = 'phone'
  group.add(phone)
  slab(phone, mat(0x17130f, 0.5), 5.0, 5.45, 1.14, 1.28, 2.12, 2.44)
  slab(phone, mat(0x17130f, 0.5), 5.02, 5.43, 1.28, 1.36, 2.14, 2.24)
  const ashtray = slab(group, mat(EXTERIOR.marbleStep, 0.35), 3.5, 3.82, 1.14, 1.2, 2.16, 2.48)
  ashtray.name = 'ashtray'

  solids.push(aabb(3.32, 5.68, GROUND, 1.14, 1.92, 2.72))
  solids.push(aabb(2.6, 5.2, GROUND, 2.5, ROOM_BACK - 0.22, ROOM_BACK))

  // === Parlour ===

  const armchair = new Group()
  armchair.name = 'armchair'
  group.add(armchair)
  for (const [cx, cz, turn] of [
    [-4.6, 1.6, 0.5],
    [-4.5, 3.6, -0.4],
    [-2.5, 3.9, -1.5],
  ] as const) {
    const chair = new Group()
    chair.position.set(cx, GROUND, cz)
    chair.rotation.y = turn
    slab(chair, maroon, -0.42, 0.42, 0.28, 0.5, -0.42, 0.42)
    slab(chair, maroon, -0.42, 0.42, 0.5, 1.02, -0.44, -0.28)
    slab(chair, maroon, -0.5, -0.36, 0.5, 0.72, -0.42, 0.42)
    slab(chair, maroon, 0.36, 0.5, 0.5, 0.72, -0.42, 0.42)
    slab(chair, timber, -0.4, 0.4, 0, 0.28, -0.4, 0.4)
    armchair.add(chair)
    solids.push(aabb(cx - 0.55, cx + 0.55, GROUND, 1.02, cz - 0.55, cz + 0.55))
  }

  const parlourTable = new Group()
  parlourTable.name = 'parlourTable'
  group.add(parlourTable)
  slab(parlourTable, timber, -3.9, -2.9, 0.42, 0.48, 2.1, 2.9)
  for (const [x, z] of [
    [-3.85, 2.15],
    [-3.0, 2.15],
    [-3.85, 2.8],
    [-3.0, 2.8],
  ] as const) {
    slab(parlourTable, timber, x, x + 0.05, GROUND, 0.42, z, z + 0.05)
  }
  solids.push(aabb(-3.95, -2.85, GROUND, 0.48, 2.05, 2.95))

  /*
   * The diary. Gate 6.
   *
   * BRIEF.md puts it on the parlour table, which is the table Rosie is standing
   * next to, and the player walks past it on the way in without a reason to
   * care. It is not hidden and it is not signposted.
   */
  const diary = new Group()
  diary.name = 'diary'
  group.add(diary)
  slab(diary, mat(0x2f2a24, 0.92), -3.62, -3.18, 0.48, 0.512, 2.32, 2.68)
  // Pages, proud of the cover on three sides, and the cover flipped back off
  // the top of them. It is lying open, not shut on the table.
  slab(diary, mat(0xd9d0bb, 0.95), -3.60, -3.20, 0.512, 0.528, 2.34, 2.66)
  slab(diary, mat(0x2f2a24, 0.92), -3.60, -3.22, 0.528, 0.542, 2.36, 2.50)

  const television = new Group()
  television.name = 'television'
  group.add(television)
  slab(television, mat(0x2a2521, 0.7), -6.2, -5.5, 0.4, 1.02, 2.3, 2.9)
  slab(television, mat(0x0a0a0b, 0.25), -5.53, -5.49, 0.52, 0.94, 2.4, 2.82)
  slab(television, timber, -6.15, -5.55, GROUND, 0.4, 2.35, 2.85)
  solids.push(aabb(-6.25, -5.45, GROUND, 1.02, 2.25, 2.95))

  const standardLamp = new Group()
  standardLamp.name = 'standardLamp'
  group.add(standardLamp)
  slab(standardLamp, timber, -5.34, -5.26, GROUND, 1.5, 3.96, 4.04)
  slab(standardLamp, mat(0xbfa87e, 0.9), -5.55, -5.05, 1.5, 1.86, 3.75, 4.25)
  slab(standardLamp, timber, -5.5, -5.1, GROUND, 0.03, 3.8, 4.2)

  /*
   * Keep the collision and walk regions above, but make the old visual kit one
   * detachable unit. Unit A replaces this group after its GLB and lightmaps
   * have loaded; the street, facade and front door remain authored here.
   */
  const interiorVisuals = new Group()
  interiorVisuals.name = 'lodge-interior-kit'
  group.children.slice(interiorStart).forEach((child) => interiorVisuals.add(child))
  group.add(interiorVisuals)

  // === Commodore ===
  // Beige 1993 VP Holden, unmarked, fleet spec. Parked parallel to the kerb,
  // off to the left so it does not block the approach. Kit boxes: body, cabin,
  // glass, four wheels. No personality, per ASSETS.md.

  const commodore = new Group()
  commodore.name = 'commodore'
  group.add(commodore)

  const carBody = mat(0xc8b88a, 0.72)
  const carGlass = new MeshBasicMaterial({
    color: 0x1a2030,
    transparent: true,
    opacity: 0.6,
  })
  const carTyre = mat(0x1a1a1a, 0.9)
  const carTrim = mat(0x2a2a2a, 0.5, 0.3)

  const CX = -3.8
  const CZ = -5.2
  const CY = ROAD

  slab(commodore, carBody, CX - 2.2, CX + 2.2, CY + 0.3, CY + 0.82, CZ - 0.82, CZ + 0.82)
  slab(commodore, carBody, CX - 1.3, CX + 0.9, CY + 0.82, CY + 1.32, CZ - 0.76, CZ + 0.76)
  unlit(commodore, carGlass, CX - 1.24, CX - 0.6, CY + 0.86, CY + 1.26, CZ - 0.72, CZ + 0.72)
  unlit(commodore, carGlass, CX - 0.5, CX + 0.1, CY + 0.86, CY + 1.26, CZ - 0.72, CZ + 0.72)
  unlit(commodore, carGlass, CX + 0.2, CX + 0.84, CY + 0.86, CY + 1.26, CZ - 0.72, CZ + 0.72)
  slab(commodore, carTrim, CX - 2.22, CX + 2.22, CY + 0.52, CY + 0.58, CZ - 0.84, CZ + 0.84)
  for (const wx of [CX - 1.5, CX + 1.5]) {
    for (const wz of [CZ - 0.78, CZ + 0.78]) {
      slab(commodore, carTyre, wx - 0.28, wx + 0.28, CY, CY + 0.32, wz - 0.1, wz + 0.1)
    }
  }
  slab(commodore, carTrim, CX - 2.22, CX - 2.18, CY + 0.36, CY + 0.72, CZ - 0.6, CZ + 0.6)
  slab(commodore, carTrim, CX + 2.18, CX + 2.22, CY + 0.36, CY + 0.72, CZ - 0.6, CZ + 0.6)
  solids.push(aabb(CX - 2.3, CX + 2.3, CY, CY + 1.35, CZ - 0.9, CZ + 0.9))

  // === Uniforms ===
  // Two constables at the inner tape posts. VicPol summer blues, checked cap
  // bands. Low fidelity, never examined. Arms raise with the tape.

  const uniforms = new Group()
  uniforms.name = 'uniforms'
  group.add(uniforms)

  const uniShirt = mat(0x4a6a8a, 0.85)
  const uniPants = mat(0x1a2a3a, 0.8)
  const uniSkin = mat(0xc4a882, 0.8)
  const uniCap = mat(0x1a2a3a, 0.7)
  const uniBand = mat(0x8a8a7a, 0.6)

  interface UniformParts {
    readonly armL: Group
    readonly armR: Group
  }

  const uniformParts: UniformParts[] = []

  for (const ux of [-0.95, 0.95]) {
    const fig = new Group()
    fig.position.set(ux, 0, -2.55)
    uniforms.add(fig)

    slab(fig, uniPants, -0.14, -0.02, PATH, PATH + 0.82, -0.1, 0.1)
    slab(fig, uniPants, 0.02, 0.14, PATH, PATH + 0.82, -0.1, 0.1)
    slab(fig, uniShirt, -0.18, 0.18, PATH + 0.82, PATH + 1.38, -0.12, 0.12)
    slab(fig, uniSkin, -0.08, 0.08, PATH + 1.38, PATH + 1.58, -0.08, 0.08)
    slab(fig, uniCap, -0.1, 0.1, PATH + 1.56, PATH + 1.64, -0.1, 0.1)
    slab(fig, uniBand, -0.11, 0.11, PATH + 1.54, PATH + 1.57, -0.11, 0.11)

    const armL = new Group()
    armL.position.set(-0.2, PATH + 1.32, 0)
    fig.add(armL)
    slab(armL, uniShirt, -0.06, 0.06, -0.52, 0, -0.05, 0.05)
    slab(armL, uniSkin, -0.05, 0.05, -0.62, -0.52, -0.04, 0.04)

    const armR = new Group()
    armR.position.set(0.2, PATH + 1.32, 0)
    fig.add(armR)
    slab(armR, uniShirt, -0.06, 0.06, -0.52, 0, -0.05, 0.05)
    slab(armR, uniSkin, -0.05, 0.05, -0.62, -0.52, -0.04, 0.04)

    uniformParts.push({ armL, armR })
    solids.push(aabb(ux - 0.25, ux + 0.25, PATH, PATH + 1.7, -2.7, -2.4))
  }

  // Tape lift state. The cold open raises both halves when Miller approaches.
  let tapeLiftT = 0
  let tapeLifting = false
  let tapeLifted = false
  const TAPE_LIFT_SPEED = 1.2

  return {
    group,
    interiorVisuals,
    solids,
    floors,
    spawn: new Vector3(0.6, ROAD, -7.4),
    spawnYaw: Math.PI,
    props: {
      frontDoor,
      neon,
      tape,
      steps,
      stairs,
      desk,
      keyRack,
      ledger,
      phone,
      ashtray,
      armchair,
      parlourTable,
      diary,
      television,
      standardLamp,
      commodore,
      uniforms,
    },
    update(elapsed: number, playerPos: Vector3): void {
      const beat = Math.sin(elapsed * 11.3) + Math.sin(elapsed * 4.1)
      const failing = beat < -1.72
      neonMat.map = failing ? neonTexB : neonTexA
      neonMat.opacity = failing ? 0.35 : 1
      neonMat.needsUpdate = true

      if (!tapeLifted) {
        const dz = Math.abs(playerPos.z - (-2.335))
        const dx = Math.abs(playerPos.x)
        if (!tapeLifting && dz < 3.5 && dx < 3) {
          tapeLifting = true
        }
        if (tapeLifting) {
          tapeLiftT = Math.min(tapeLiftT + TAPE_LIFT_SPEED * 0.016, 1)
          const ease = tapeLiftT * tapeLiftT * (3 - 2 * tapeLiftT)
          const angle = ease * 1.1
          tapeLeftPivot.rotation.z = -angle
          tapeRightPivot.rotation.z = angle
          for (const parts of uniformParts) {
            parts.armL.rotation.z = ease * 1.8
            parts.armR.rotation.z = -ease * 1.8
          }
          if (tapeLiftT >= 1) {
            tapeLifted = true
          }
        }
      }
    },
  }
}
