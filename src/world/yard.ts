import { Box3, Group, Object3D } from 'three'
import { EXTERIOR, INTERIOR } from '../materials/palette.ts'
import type { WalkableRegion } from './collision.ts'
import { aabb, mat, raked, slab, walk, wall } from './kit.ts'
import { STAIR_FOOT, YARD_LEVEL } from './verandah.ts'

/**
 * The back yard. Overgrown, a Hills hoist, a shed, and the hammer.
 *
 * BRIEF.md: "The hammer went down at the shed, five feet from the bottom of the
 * stairs." That distance is the clue. Gate 4 has Miller clocking the stairs
 * from the verandah, and gate 7 is the hammer, and the player is meant to have
 * worked out how it got there before Miller says so. So the shed sits at the
 * foot of the stairs, and the hammer sits against the shed, and nothing else in
 * the yard competes for the eye.
 *
 * The side passage is fenced off at the street. The only way in is down the
 * external stairs, which is what makes clocking them mean anything.
 */

export interface Yard {
  readonly group: Group
  readonly solids: Box3[]
  readonly floors: WalkableRegion[]
  readonly props: {
    readonly hoist: Object3D
    readonly shed: Object3D
    readonly hammer: Object3D
    readonly fence: Object3D
  }
}

const GRASS = YARD_LEVEL

/** Boundary. The lodge sits at x -6.75 to 6.65, z -0.45 to 10.75. */
const WEST = -9.4
const EAST = 12.6
const BACK = 20.5
/** The side passage runs down the +X flank, gated at the street end. */
const GATE_Z = -1.2

const FENCE_H = 1.85

export function buildYard(): Yard {
  const group = new Group()
  group.name = 'yard'
  const solids: Box3[] = []
  const floors: WalkableRegion[] = []

  const grass = mat(EXTERIOR.grassDry, 1)
  const weed = mat(EXTERIOR.weed, 1)
  const paling = mat(EXTERIOR.paling, 0.95)
  const corrugate = mat(EXTERIOR.corrugate, 0.62, 0.35)
  const rust = mat(EXTERIOR.rust, 0.85, 0.2)
  const timber = mat(INTERIOR.timberDark, 0.85)
  const galv = mat(0xa8aca6, 0.5, 0.6)

  // === Ground ===

  slab(group, grass, WEST, EAST, GRASS - 0.3, GRASS, 10.75, BACK)
  slab(group, grass, 6.65, EAST, GRASS - 0.3, GRASS, GATE_Z, 10.75)
  walk(floors, 'verandah', WEST + 0.2, EAST - 0.2, 10.75, BACK - 0.2, GRASS)
  walk(floors, 'verandah', 6.7, EAST - 0.2, GATE_Z + 0.2, 10.9, GRASS)

  // Down the west side of the house too, so the yard reads as wrapping it.
  slab(group, grass, WEST, -6.75, GRASS - 0.3, GRASS, GATE_Z, 10.75)
  walk(floors, 'verandah', WEST + 0.2, -6.8, GATE_Z + 0.2, 10.9, GRASS)

  /*
   * Tufts. Overgrown is a texture and a grass card job, and neither exists yet,
   * so this is a handful of darker clumps against the dry ground to stop it
   * reading as a mown lawn.
   */
  const tufts: readonly (readonly [number, number, number])[] = [
    [-7.4, 13.2, 0.5],
    [-5.1, 17.8, 0.42],
    [-2.2, 12.4, 0.55],
    [0.9, 18.6, 0.38],
    [3.6, 14.1, 0.46],
    [5.2, 19.4, 0.5],
    [9.8, 17.2, 0.44],
    [11.4, 12.6, 0.4],
    [-8.2, 6.5, 0.42],
    [10.9, 4.2, 0.36],
  ]
  for (const [x, z, r] of tufts) {
    slab(group, weed, x - r, x + r, GRASS - 0.02, GRASS + 0.22, z - r, z + r)
  }

  // === Fences ===

  const fence = new Group()
  fence.name = 'fence'
  group.add(fence)

  const palingRun = (x0: number, x1: number, z0: number, z1: number): void => {
    slab(fence, paling, x0, x1, GRASS, GRASS + FENCE_H, z0, z1)
    // Rails, a shade darker, so a long run has something in it.
    slab(fence, timber, x0 - 0.03, x1 + 0.03, GRASS + 0.55, GRASS + 0.63, z0 - 0.02, z1 + 0.02)
    slab(fence, timber, x0 - 0.03, x1 + 0.03, GRASS + 1.35, GRASS + 1.43, z0 - 0.02, z1 + 0.02)
    solids.push(aabb(x0 - 0.05, x1 + 0.05, GRASS, GRASS + FENCE_H, z0 - 0.05, z1 + 0.05))
  }

  palingRun(WEST, WEST + 0.06, GATE_Z, BACK)
  palingRun(EAST - 0.06, EAST, GATE_Z, BACK)
  palingRun(WEST, EAST, BACK - 0.06, BACK)
  // Gated off at the street, both sides. The stairs are the way in.
  palingRun(6.65, EAST, GATE_Z, GATE_Z + 0.06)
  palingRun(WEST, -6.75, GATE_Z, GATE_Z + 0.06)

  // === Shed ===
  // Five feet from the bottom of the stairs, per BRIEF.md.

  const shed = new Group()
  shed.name = 'shed'
  group.add(shed)

  const shedX0 = STAIR_FOOT.x + 0.95
  const shedX1 = shedX0 + 2.6
  const shedZ0 = STAIR_FOOT.z - 0.4
  const shedZ1 = shedZ0 + 2.5
  const shedFront = GRASS + 2.15
  const shedBack = GRASS + 2.45

  wall(shed, solids, corrugate, shedX0, shedX0 + 0.06, GRASS, shedFront, shedZ0, shedZ1)
  wall(shed, solids, corrugate, shedX1 - 0.06, shedX1, GRASS, shedBack, shedZ0, shedZ1)
  wall(shed, solids, corrugate, shedX0, shedX1, GRASS, shedFront, shedZ0, shedZ0 + 0.06)
  wall(shed, solids, corrugate, shedX0, shedX1, GRASS, shedBack, shedZ1 - 0.06, shedZ1)
  // Lean-to roof, falling toward the stairs.
  const shedRoof = raked(shed, rust, shedX1 - shedX0 + 0.3, 0.08, shedZ1 - shedZ0 + 0.3)
  shedRoof.position.set(
    (shedX0 + shedX1) / 2,
    (shedFront + shedBack) / 2 + 0.06,
    (shedZ0 + shedZ1) / 2,
  )
  shedRoof.rotation.z = Math.atan2(shedBack - shedFront, shedX1 - shedX0)
  // Door, shut, on the face looking at the stairs.
  slab(shed, timber, shedX0 - 0.03, shedX0, GRASS, GRASS + 1.95, shedZ0 + 0.55, shedZ0 + 1.6)

  /*
   * The hammer. Leaning against the shed, near the corner closest to the foot
   * of the stairs.
   *
   * Not tagged: `tag` is Moretti's verb and he arrives at step 12. Until then
   * it examines like everything else and files the same evidence.
   */
  const hammer = new Group()
  hammer.name = 'hammer'
  hammer.position.set(shedX0 - 0.28, GRASS, shedZ0 + 2.05)
  hammer.rotation.z = 0.34
  slab(hammer, timber, -0.025, 0.025, 0, 0.36, -0.025, 0.025)
  slab(hammer, galv, -0.045, 0.045, 0.36, 0.45, -0.09, 0.09)
  group.add(hammer)

  // === Hills hoist ===

  const hoist = new Group()
  hoist.name = 'hoist'
  hoist.position.set(-1.4, GRASS, 15.4)
  group.add(hoist)
  slab(hoist, galv, -0.05, 0.05, 0, 1.85, -0.05, 0.05)
  slab(hoist, galv, -0.09, 0.09, 1.85, 1.97, -0.09, 0.09)
  for (const turn of [0, Math.PI / 2]) {
    const arm = raked(hoist, galv, turn === 0 ? 3.4 : 0.05, 0.05, turn === 0 ? 0.05 : 3.4)
    arm.position.set(0, 1.9, 0)
  }
  // Lines between the arm ends. Four squares, tightest first.
  for (const inset of [0.55, 1.05, 1.55]) {
    const r = 1.7 - inset
    slab(hoist, galv, -r, r, 1.86, 1.88, -0.012, 0.012)
    slab(hoist, galv, -0.012, 0.012, 1.86, 1.88, -r, r)
    slab(hoist, galv, -r, r, 1.86, 1.88, r - 0.024, r)
    slab(hoist, galv, -r, r, 1.86, 1.88, -r, -r + 0.024)
    slab(hoist, galv, r - 0.024, r, 1.86, 1.88, -r, r)
    slab(hoist, galv, -r, -r + 0.024, 1.86, 1.88, -r, r)
  }
  solids.push(aabb(-1.5, -1.3, GRASS, GRASS + 1.97, 15.3, 15.5))

  return {
    group,
    solids,
    floors,
    props: { hoist, shed, hammer, fence },
  }
}
