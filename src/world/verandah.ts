import { Box3, Group, Object3D } from 'three'
import { EXTERIOR, INTERIOR } from '../materials/palette.ts'
import type { WalkableRegion } from './collision.ts'
import { aabb, mat, raked, slab, walk } from './kit.ts'

/**
 * The verandah off room 1A, and the external stairs down to the yard.
 *
 * BRIEF.md: "A verandah runs off 1A with external stairs straight down to the
 * back yard." That sentence is the whole of scene 1's second half. Sterling and
 * Victor came up these stairs and in through the sash at 2am, and gate 4 is
 * Miller standing out here and clocking that they exist.
 *
 * ASSETS.md has the iron lace wrapping the corner, so the deck turns and runs a
 * few metres along the street front past 1A's other window before it stops.
 *
 * ## Where it sits
 *
 * The lodge's +X side, hard against room 1A's verandah wall at x = 6.3. The
 * deck is at first-floor level, so it is flush with 1A's floor and you walk
 * straight out. The stairs run off the back end, past the rear of the building,
 * and land beside the shed.
 *
 * **The 3pm sun comes from this side, through this verandah, into 1A.** The
 * roof and the lace both stand between the sun and the sash, and neither may
 * take the beam off the bed. See CLAUDE.md before moving either.
 */

export interface Verandah {
  readonly group: Group
  readonly solids: Box3[]
  readonly floors: WalkableRegion[]
  readonly props: {
    readonly deck: Object3D
    readonly lace: Object3D
    readonly stairs: Object3D
  }
}

/** Deck level. Flush with the first floor, so 1A opens straight onto it. */
const DECK = 3.45

/**
 * Hard against 1A's outer wall face, and only 1.7 deep.
 *
 * Depth is a light budget, not a taste decision. Every metre out from the wall
 * costs 0.43 off the height the sun can still reach on that wall, so a generous
 * three metre verandah puts room 1A's sash almost entirely in shade. Measured
 * on the bed: 2.3 deep took the beam from 172 down to 98.
 */
const INNER = 6.37
const OUTER = 8.05

/** The side run, along the lodge's +X flank. */
const SIDE_Z0 = -2.2
const SIDE_Z1 = 7.2

/** The return round the corner. Stops clear of the neon board at x = 2.1. */
const RETURN_X0 = 2.35
const RETURN_Z0 = -2.2
const RETURN_Z1 = -0.45

/*
 * Balustrade height. Tops out below 1A's sill at 4.40, so its shadow lands on
 * the wall under the window and never inside the room.
 */
const RAIL = 1.02

/*
 * The roof, and the whole reason these numbers are fussed over.
 *
 * The sun runs at about 21 degrees, so it reaches the wall behind this roof at
 * whatever height the outer edge leaves it, less 0.43 for every metre of depth.
 * High eave, shallow verandah, minimal fall: the shade line then lands around
 * y = 5.5 on 1A's wall, and the sash is lit from its sill at 4.40 up to there.
 *
 * Drop the eave, deepen the verandah, or steepen the fall and you take the beam
 * off Crystal. Check it in the room, not on paper.
 */
const EAVE = 6.4
const ROOF = 6.6
const FALL = 0.12

/** Yard level. The stairs are the difference between this and the deck. */
const YARD = -0.15

/**
 * Nineteen risers down to the yard, eighteen of them treads. Same fencing as
 * the main stair: RISE under `PLAYER.stepUp`, over half of `PLAYER.stepDown`.
 */
const TREADS = 18
const RISE = (DECK - YARD) / 19
const GOING = 0.27
const STAIR_X0 = 6.7
const STAIR_X1 = 7.95
const STAIR_Z0 = SIDE_Z1

export function buildVerandah(): Verandah {
  const group = new Group()
  group.name = 'verandah'
  const solids: Box3[] = []
  const floors: WalkableRegion[] = []

  const timber = mat(INTERIOR.timberDark, 0.82)
  const boards = mat(EXTERIOR.renderStain, 0.9)
  const iron = mat(EXTERIOR.ironLace, 0.55, 0.4)
  const corrugate = mat(EXTERIOR.corrugate, 0.62, 0.35)

  // === Deck ===

  slab(group, boards, INNER, OUTER, DECK - 0.12, DECK, SIDE_Z0, SIDE_Z1)
  slab(group, boards, RETURN_X0, INNER, DECK - 0.12, DECK, RETURN_Z0, RETURN_Z1)
  walk(floors, 'verandah', INNER, OUTER, SIDE_Z0, SIDE_Z1, DECK)
  walk(floors, 'verandah', RETURN_X0, INNER, RETURN_Z0, RETURN_Z1, DECK)

  /*
   * The threshold of 1A's verandah door, so the walkable set is continuous
   * through the doorway. World z 0.6 to 1.5 at x = 6.3: that is
   * VERANDAH_DOOR_X0/X1 in room1a.ts carried through the quarter turn. Move
   * one, move the other.
   */
  walk(floors, 'verandah', 6.2, INNER + 0.05, 0.55, 1.55, DECK)

  // Bearer under the deck edge, so it does not read as a floating slab.
  slab(group, timber, OUTER - 0.14, OUTER, DECK - 0.34, DECK - 0.12, SIDE_Z0, SIDE_Z1)
  slab(group, timber, RETURN_X0, OUTER, DECK - 0.34, DECK - 0.12, RETURN_Z0, RETURN_Z0 + 0.14)

  // === Posts ===
  // One run of posts carries the roof and, below the deck, the deck itself.

  const postAt = (x: number, z: number): void => {
    slab(group, timber, x - 0.07, x + 0.07, DECK, EAVE, z - 0.07, z + 0.07)
    slab(group, timber, x - 0.08, x + 0.08, YARD, DECK - 0.12, z - 0.08, z + 0.08)
    solids.push(aabb(x - 0.09, x + 0.09, YARD, EAVE, z - 0.09, z + 0.09))
  }

  /*
   * Set out so the gap between the posts at 0.2 and 2.7 is the one the beam
   * comes through. The sun runs 0.47 across for every 1 in, so a post throws
   * its shadow about 0.8 further along the wall than it stands, and 1A's sash
   * spans z 1.93 to 3.28. That rules out a post anywhere in z 1.05 to 2.6.
   * Moving one of these means checking where its shadow lands.
   */
  const sidePosts = [-2.1, 0.2, 2.7, 5.0, 7.05]
  for (const z of sidePosts) {
    postAt(OUTER - 0.12, z)
  }
  for (const x of [2.5, 4.4]) {
    postAt(x, RETURN_Z0 + 0.12)
  }

  // === Iron lace ===
  /*
   * Balustrade and frieze. Both are boxes standing in for cast lace, and both
   * cast shadow, which is the point of them: at 21 degrees the sun rakes
   * through here and lays the pattern out across the deck.
   *
   * The balustrade tops out at DECK + RAIL, which is below 1A's sill at 4.40,
   * so its shadow lands on the wall under the window and never in the room.
   * Raise it past the sill and it will start cutting the beam.
   */
  const lace = new Group()
  lace.name = 'lace'
  group.add(lace)

  const balustrade = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    alongZ: boolean,
  ): void => {
    slab(lace, iron, x0, x1, DECK + RAIL - 0.06, DECK + RAIL, z0, z1)
    slab(lace, iron, x0, x1, DECK + 0.08, DECK + 0.14, z0, z1)
    const from = alongZ ? z0 : x0
    const to = alongZ ? z1 : x1
    for (let at = from + 0.09; at < to - 0.05; at += 0.13) {
      if (alongZ) {
        slab(lace, iron, x0 + 0.01, x1 - 0.01, DECK + 0.14, DECK + RAIL - 0.06, at, at + 0.035)
      } else {
        slab(lace, iron, at, at + 0.035, DECK + 0.14, DECK + RAIL - 0.06, z0 + 0.01, z1 - 0.01)
      }
    }
    solids.push(aabb(x0 - 0.02, x1 + 0.02, DECK, DECK + RAIL, z0 - 0.02, z1 + 0.02))
  }

  // Outer edge of the side run, broken where the stairs leave.
  balustrade(OUTER - 0.06, OUTER, SIDE_Z0, STAIR_Z0, true)
  // Outer edge of the return, and the end of it.
  balustrade(RETURN_X0, OUTER - 0.06, RETURN_Z0, RETURN_Z0 + 0.06, false)
  balustrade(RETURN_X0, RETURN_X0 + 0.06, RETURN_Z0, RETURN_Z1, true)
  // Back end of the side run, either side of the stair opening.
  balustrade(INNER, STAIR_X0, SIDE_Z1 - 0.06, SIDE_Z1, false)
  balustrade(STAIR_X1, OUTER, SIDE_Z1 - 0.06, SIDE_Z1, false)

  // Frieze under the eave, between the posts. Shallow, and tight up under the
  // roof: it hangs into the sun's path and every centimetre of it costs beam.
  for (const z of sidePosts) {
    slab(lace, iron, OUTER - 0.16, OUTER - 0.08, EAVE - 0.22, EAVE - 0.02, z + 0.08, z + 2.2)
  }
  slab(lace, iron, RETURN_X0, OUTER - 0.16, EAVE - 0.22, EAVE - 0.02, RETURN_Z0 + 0.08, RETURN_Z0 + 0.16)

  // === Roof ===
  /*
   * A skillion, falling away from the wall. It has to cast: a lid built without
   * it lets the sun straight through and lights whatever is under it from
   * above, in a slab that reads as a render fault.
   *
   * It also has to stay high. At 21 degrees the sun reaches about seven metres
   * in under this eave, so the sash still gets direct light; drop the eave and
   * the top of the window goes into shade first, then the beam.
   */
  // Negative, so the outer edge is the low one. Positive rotates it up into the
  // parapet and the verandah drains into the building.
  const sideRoof = raked(group, corrugate, OUTER - INNER + 0.5, 0.14, SIDE_Z1 - SIDE_Z0 + 0.3)
  sideRoof.position.set((INNER + OUTER) / 2, ROOF - FALL / 2, (SIDE_Z0 + SIDE_Z1) / 2)
  sideRoof.rotation.z = -Math.atan2(FALL, OUTER - INNER)

  const returnRoof = raked(group, corrugate, OUTER - RETURN_X0, 0.14, RETURN_Z1 - RETURN_Z0 + 0.3)
  returnRoof.position.set((RETURN_X0 + OUTER) / 2, ROOF - FALL / 2 - 0.02, (RETURN_Z0 + RETURN_Z1) / 2)
  returnRoof.rotation.x = -Math.atan2(FALL, RETURN_Z1 - RETURN_Z0)

  // === External stairs ===

  const stairs = new Group()
  stairs.name = 'stairs'
  group.add(stairs)

  for (let n = 1; n <= TREADS; n += 1) {
    const top = DECK - n * RISE
    const z0 = STAIR_Z0 + (n - 1) * GOING
    const z1 = z0 + GOING
    slab(stairs, timber, STAIR_X0, STAIR_X1, top - 0.06, top, z0, z1)
    // Riser, so the flight is not a run of floating boards.
    slab(stairs, timber, STAIR_X0, STAIR_X1, top - RISE, top - 0.06, z0, z0 + 0.04)
    walk(floors, 'verandah', STAIR_X0, STAIR_X1, z0, z1, top)
  }

  const stairZ1 = STAIR_Z0 + TREADS * GOING

  // Stringers and a handrail down the open sides. Raked, so no collision of
  // their own; the uprights below are what keep Miller on the flight.
  const run = (TREADS - 1) * GOING
  const drop = (TREADS - 1) * RISE
  const rake = Math.atan2(drop, run)
  const rakeLength = Math.hypot(run, drop)
  const midY = DECK - RISE - drop / 2
  const midZ = STAIR_Z0 + GOING / 2 + run / 2

  for (const x of [STAIR_X0 + 0.04, STAIR_X1 - 0.04]) {
    const stringer = raked(stairs, timber, 0.08, 0.34, rakeLength)
    stringer.position.set(x, midY - 0.2, midZ)
    stringer.rotation.x = rake

    const rail = raked(stairs, iron, 0.06, 0.06, rakeLength)
    rail.position.set(x, midY + 0.94, midZ)
    rail.rotation.x = rake

    solids.push(aabb(x - 0.04, x + 0.04, YARD, DECK + RAIL, STAIR_Z0, stairZ1))
  }

  // Landing at the foot, so the last riser has somewhere to arrive.
  walk(floors, 'verandah', STAIR_X0 - 0.3, STAIR_X1 + 0.3, stairZ1, stairZ1 + 0.6, YARD)

  return {
    group,
    solids,
    floors,
    props: {
      deck: group,
      lace,
      stairs,
    },
  }
}

/** Where the stairs land, so the yard knows where to put the shed. */
export const STAIR_FOOT = {
  x: (STAIR_X0 + STAIR_X1) / 2,
  z: STAIR_Z0 + TREADS * GOING,
  y: YARD,
} as const

/** Yard level, shared with the yard module. */
export const YARD_LEVEL = YARD
