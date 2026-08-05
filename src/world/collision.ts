import { Box3, Vector3 } from 'three'
import { PLAYER } from '../core/config.ts'
import type { Surface } from '../core/events.ts'

/**
 * A patch of floor Miller is allowed to stand on, and what it sounds like.
 *
 * The walkable set is the navmesh. It is axis-aligned boxes rather than
 * triangles, which suits a building made of rectangular rooms, stair treads and
 * landings, and it means the yard and the street need no invisible walls: they
 * simply run out of floor.
 */
export interface WalkableRegion {
  readonly box: Box3
  readonly surface: Surface
}

/** What is underfoot at a point. */
export interface Ground {
  readonly y: number
  readonly surface: Surface
}

/**
 * What the player controller asks for when it wants to move. The controller
 * knows nothing about how the answer is worked out.
 */
export interface CollisionSolver {
  /** Slide a vertical cylinder from `from` toward `to`. Returns where it got. */
  resolve(from: Vector3, to: Vector3, radius: number): Vector3
  /** Is a cylinder centred on `at` clear of everything solid at that height? */
  isClear(at: Vector3, radius: number): boolean
  /**
   * The surface under (x, z) that feet at `fromY` can reach, or undefined if
   * there is nothing to stand on within a step either way.
   */
  groundAt(x: number, z: number, fromY: number): Ground | undefined
}

/**
 * Axis-aligned boxes. Circle-vs-AABB pushout in XZ, filtered by height, over a
 * set of walkable regions that decide where the floor is.
 *
 * Height is the part that makes a two-storey building work. A solid only blocks
 * if it overlaps the band the cylinder actually occupies, from `stepUp` above
 * the feet to `height` above them, so a lintel is headroom, a tread is a step,
 * and a ground-floor wall is not also a first-floor wall.
 */
export class BoxCollisionSolver implements CollisionSolver {
  private readonly solids: Box3[]
  private readonly floors: WalkableRegion[]

  /** How many times to re-run pushout, so corners settle instead of jittering. */
  private static readonly ITERATIONS = 3

  constructor(solids: Box3[], floors: WalkableRegion[]) {
    this.solids = solids
    this.floors = floors
  }

  resolve(from: Vector3, to: Vector3, radius: number): Vector3 {
    // Resolve one axis at a time so a wall stops that axis and lets the other
    // one slide, which is what makes sliding along a wall feel right. The floor
    // test goes in per axis for the same reason: walking along the lip of a
    // landing should slide, not stop dead.
    const result = from.clone()

    result.x = to.x
    this.pushOut(result, radius, from.y)
    if (this.groundAt(result.x, result.z, from.y) === undefined) {
      result.x = from.x
    }

    result.z = to.z
    this.pushOut(result, radius, from.y)
    if (this.groundAt(result.x, result.z, from.y) === undefined) {
      result.z = from.z
    }

    const ground = this.groundAt(result.x, result.z, from.y)
    result.y = ground === undefined ? from.y : ground.y
    return result
  }

  isClear(at: Vector3, radius: number): boolean {
    const r2 = radius * radius
    for (const box of this.solids) {
      if (at.y <= box.min.y || at.y >= box.max.y) {
        continue
      }
      const dx = at.x - clamp(at.x, box.min.x, box.max.x)
      const dz = at.z - clamp(at.z, box.min.z, box.max.z)
      if (dx * dx + dz * dz < r2) {
        return false
      }
    }
    return true
  }

  groundAt(x: number, z: number, fromY: number): Ground | undefined {
    const highest = fromY + PLAYER.stepUp
    const lowest = fromY - PLAYER.stepDown
    let found: Ground | undefined = undefined

    for (const region of this.floors) {
      const box = region.box
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) {
        continue
      }
      const top = box.max.y
      if (top > highest || top < lowest) {
        continue
      }
      if (found === undefined || top > found.y) {
        found = { y: top, surface: region.surface }
      }
    }

    return found
  }

  private pushOut(point: Vector3, radius: number, feetY: number): void {
    // The band the cylinder occupies. Starting it a step above the feet is what
    // lets Miller walk onto a tread instead of into it.
    const bottom = feetY + PLAYER.stepUp
    const top = feetY + PLAYER.height

    for (let i = 0; i < BoxCollisionSolver.ITERATIONS; i += 1) {
      let moved = false
      for (const box of this.solids) {
        if (box.max.y <= bottom || box.min.y >= top) {
          continue
        }

        const closestX = clamp(point.x, box.min.x, box.max.x)
        const closestZ = clamp(point.z, box.min.z, box.max.z)
        const dx = point.x - closestX
        const dz = point.z - closestZ
        const distSq = dx * dx + dz * dz

        if (distSq >= radius * radius) {
          continue
        }

        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq)
          const push = (radius - dist) / dist
          point.x += dx * push
          point.z += dz * push
        } else {
          // Centre is inside the box. Eject along the shallowest face.
          const toMinX = point.x - box.min.x
          const toMaxX = box.max.x - point.x
          const toMinZ = point.z - box.min.z
          const toMaxZ = box.max.z - point.z
          const smallest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ)
          if (smallest === toMinX) {
            point.x = box.min.x - radius
          } else if (smallest === toMaxX) {
            point.x = box.max.x + radius
          } else if (smallest === toMinZ) {
            point.z = box.min.z - radius
          } else {
            point.z = box.max.z + radius
          }
        }
        moved = true
      }
      if (!moved) {
        return
      }
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Nothing is solid and the floor is wherever you are. Isolates movement bugs. */
export class NoClipSolver implements CollisionSolver {
  resolve(_from: Vector3, to: Vector3, _radius: number): Vector3 {
    return to.clone()
  }

  isClear(_at: Vector3, _radius: number): boolean {
    return true
  }

  groundAt(_x: number, _z: number, fromY: number): Ground {
    return { y: fromY, surface: 'floorboard' }
  }
}

export const PLAYER_RADIUS = PLAYER.radius
