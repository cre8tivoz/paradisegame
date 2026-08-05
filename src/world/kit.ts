import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three'
import type { Surface } from '../core/events.ts'
import type { WalkableRegion } from './collision.ts'

/**
 * Kit geometry. Boxes given by their extents, because a building is a list of
 * edges and converting each one to a size and a midpoint by hand is where the
 * mistakes live.
 *
 * Everything here is scaffolding against the locked palette, and it all goes as
 * modelled pieces land. Shared by the lodge, the verandah and the yard.
 */

export function mat(color: number, roughness: number, metalness = 0): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness })
}

export function slab(
  parent: Object3D,
  material: MeshStandardMaterial,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material)
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/** Same as `slab`, for something that is a light source, not a lit surface. */
export function unlit(
  parent: Object3D,
  material: MeshBasicMaterial,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material)
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  parent.add(mesh)
  return mesh
}

/**
 * A box sized rather than placed, for anything that gets rotated afterwards.
 * Extents are no help once a thing is on a rake.
 */
export function raked(
  parent: Object3D,
  material: MeshStandardMaterial,
  width: number,
  height: number,
  length: number,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(width, height, length), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/**
 * Chamfered box geometry. Real edges catch a specular highlight; a stock
 * BoxGeometry cannot. Adapted from Claude of Duty (MIT, Copyright 2026 mshumer),
 * stripped of wear/grime vertex colours.
 */
export function chamferBoxGeometry(sx: number, sy: number, sz: number, bevel = 0.008): BufferGeometry {
  const h = [sx * 0.5, sy * 0.5, sz * 0.5]
  const b = Math.max(0.0005, Math.min(bevel, Math.min(sx, sy, sz) * 0.4))
  const signs: Array<[number, number, number]> = []
  for (let i = 0; i < 8; i++) {
    signs.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1])
  }
  const vert = (ci: number, axis: number): [number, number, number] => {
    const s = signs[ci]!
    return [
      s[0]! * (axis === 0 ? h[0]! : h[0]! - b),
      s[1]! * (axis === 1 ? h[1]! : h[1]! - b),
      s[2]! * (axis === 2 ? h[2]! : h[2]! - b),
    ]
  }

  const pos: number[] = []
  const nrm: number[] = []
  const uv: number[] = []
  const v0 = new Vector3()
  const v1 = new Vector3()
  const v2 = new Vector3()
  const n = new Vector3()

  const addPoly = (ptsIn: Array<[number, number, number]>): void => {
    let pts = ptsIn
    v0.set(pts[0]![0], pts[0]![1], pts[0]![2])
    v1.set(pts[1]![0], pts[1]![1], pts[1]![2])
    v2.set(pts[2]![0], pts[2]![1], pts[2]![2])
    n.copy(v1).sub(v0).cross(v2.clone().sub(v0))
    let cx = 0
    let cy = 0
    let cz = 0
    for (const p of pts) {
      cx += p[0]
      cy += p[1]
      cz += p[2]
    }
    cx /= pts.length
    cy /= pts.length
    cz /= pts.length
    if (n.x * cx + n.y * cy + n.z * cz < 0) {
      pts = pts.slice().reverse()
    }
    v0.set(pts[0]![0], pts[0]![1], pts[0]![2])
    v1.set(pts[1]![0], pts[1]![1], pts[1]![2])
    v2.set(pts[2]![0], pts[2]![1], pts[2]![2])
    n.copy(v1).sub(v0).cross(v2.clone().sub(v0)).normalize()
    for (let t = 1; t < pts.length - 1; t++) {
      const tri = [pts[0]!, pts[t]!, pts[t + 1]!]
      for (const p of tri) {
        pos.push(p[0], p[1], p[2])
        nrm.push(n.x, n.y, n.z)
        const ax =
          Math.abs(n.x) > Math.abs(n.y)
            ? Math.abs(n.x) > Math.abs(n.z)
              ? 0
              : 2
            : Math.abs(n.y) > Math.abs(n.z)
              ? 1
              : 2
        uv.push(ax === 0 ? p[2] : p[0], ax === 1 ? p[2] : p[1])
      }
    }
  }

  for (let axis = 0; axis < 3; axis++) {
    for (const sa of [-1, 1]) {
      const corners: number[] = []
      for (let ci = 0; ci < 8; ci++) {
        if (signs[ci]![axis] === sa) {
          corners.push(ci)
        }
      }
      const a1 = (axis + 1) % 3
      const a2 = (axis + 2) % 3
      corners.sort((p, q) => {
        const ap = Math.atan2(signs[p]![a2]!, signs[p]![a1]!)
        const aq = Math.atan2(signs[q]![a2]!, signs[q]![a1]!)
        return ap - aq
      })
      addPoly(corners.map((ci) => vert(ci, axis)))
    }
  }

  for (let a = 0; a < 3; a++) {
    const a1 = (a + 1) % 3
    const a2 = (a + 2) % 3
    for (const s1 of [-1, 1]) {
      for (const s2 of [-1, 1]) {
        const c: number[] = []
        for (let ci = 0; ci < 8; ci++) {
          if (signs[ci]![a1] === s1 && signs[ci]![a2] === s2) {
            c.push(ci)
          }
        }
        addPoly([vert(c[0]!, a1), vert(c[0]!, a2), vert(c[1]!, a2), vert(c[1]!, a1)])
      }
    }
  }

  for (let ci = 0; ci < 8; ci++) {
    addPoly([vert(ci, 0), vert(ci, 1), vert(ci, 2)])
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  return geo
}

/** Furniture body with a light chamfer so edges catch the 3pm sun. */
export function chamfered(
  parent: Object3D,
  material: MeshStandardMaterial,
  sx: number,
  sy: number,
  sz: number,
  bevel = 0.008,
): Mesh {
  const mesh = new Mesh(chamferBoxGeometry(sx, sy, sz, bevel), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export function aabb(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): Box3 {
  return new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1))
}

/** A slab that is also solid. */
export function wall(
  parent: Object3D,
  solids: Box3[],
  material: MeshStandardMaterial,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): Mesh {
  const mesh = slab(parent, material, x0, x1, y0, y1, z0, z1)
  solids.push(aabb(x0, x1, y0, y1, z0, z1))
  return mesh
}

/**
 * A patch of floor. Only the top face matters, so the box is a thin lid: the
 * solver asks what is under a point and takes the highest lid within a step.
 */
export function walk(
  floors: WalkableRegion[],
  surface: Surface,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
): void {
  floors.push({ box: aabb(x0, x1, y - 0.2, y, z0, z1), surface })
}

export interface Opening {
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly y1: number
}

/**
 * A wall with holes in it. Scanline over the opening edges in x, then over
 * their y ranges within each column, emitting the solid between them.
 *
 * A pier-and-lintel loop can only do openings that sit side by side. The lodge
 * front stacks them: room 1A's street window is directly over the head of the
 * reception window.
 */
export function elevation(
  parent: Object3D,
  solids: Box3[],
  material: MeshStandardMaterial,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  openings: readonly Opening[],
): void {
  const columns = [...new Set([x0, x1, ...openings.flatMap((o) => [o.x0, o.x1])])]
    .filter((x) => x > x0 && x < x1)
    .sort((a, b) => a - b)
  columns.unshift(x0)
  columns.push(x1)

  for (let i = 0; i < columns.length - 1; i += 1) {
    const left = columns[i]
    const right = columns[i + 1]
    if (left === undefined || right === undefined || right - left < 1e-6) {
      continue
    }
    const mid = (left + right) / 2
    const bands = openings
      .filter((o) => o.x0 < mid && o.x1 > mid)
      .map((o) => ({ y0: Math.max(o.y0, y0), y1: Math.min(o.y1, y1) }))
      .filter((o) => o.y1 > o.y0)
      .sort((a, b) => a.y0 - b.y0)

    let cursor = y0
    for (const band of bands) {
      if (band.y0 > cursor) {
        wall(parent, solids, material, left, right, cursor, band.y0, z0, z1)
      }
      cursor = Math.max(cursor, band.y1)
    }
    if (cursor < y1) {
      wall(parent, solids, material, left, right, cursor, y1, z0, z1)
    }
  }
}
