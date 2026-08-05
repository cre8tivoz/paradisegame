import * as THREE from 'three'
import { Billboard } from '../sprites/billboard'

/**
 * Player — Miller as a billboard sprite on a flat floor (Sims-style).
 *
 * Click-to-move: the pointer picks a point on the floor plane, the player
 * walks toward it at a fixed speed, stops, and faces the direction of travel.
 * No physics, no navmesh — the walk bounds clamp the movement. This is the
 * whole movement system, matching the BRIEF's "no fail states, no combat".
 */

export class Player {
  readonly root: THREE.Group
  readonly billboard: Billboard
  /** Feet position (y always 0 in 2.5D). */
  readonly position = new THREE.Vector3()
  facing = 0

  private target: THREE.Vector3 | null = null
  private bounds = { x0: -20, x1: 20, z0: -20, z1: 20 }

  constructor(billboard: Billboard) {
    this.billboard = billboard
    this.root = billboard.root
  }

  setBounds(b: { x0: number; x1: number; z0: number; z1: number }): void {
    this.bounds = b
  }

  spawn(x: number, z: number, facing: number): void {
    this.position.set(x, 0, z)
    this.facing = facing
    this.billboard.facing = facing
    this.billboard.setPosition(x, 0, z)
    this.target = null
  }

  /** Called when the floor is clicked. Clamps into walk bounds. */
  moveTo(x: number, z: number): void {
    const tx = THREE.MathUtils.clamp(x, this.bounds.x0, this.bounds.x1)
    const tz = THREE.MathUtils.clamp(z, this.bounds.z0, this.bounds.z1)
    this.target = new THREE.Vector3(tx, 0, tz)
  }

  get isMoving(): boolean {
    return this.target !== null
  }

  stop(): void {
    this.target = null
  }

  update(delta: number, speed = 2.4): void {
    const target = this.target
    if (target === null) {
      this.billboard.update(this.cameraYaw)
      return
    }
    const dx = target.x - this.position.x
    const dz = target.z - this.position.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.08) {
      this.target = null
      this.billboard.update(this.cameraYaw)
      return
    }
    const step = Math.min(speed * delta, dist)
    this.position.x += (dx / dist) * step
    this.position.z += (dz / dist) * step
    this.facing = Math.atan2(dx, dz)
    this.billboard.facing = this.facing
    this.billboard.setPosition(this.position.x, 0, this.position.z)
    this.billboard.update(this.cameraYaw)
  }

  /** Set from the IsoCamera each frame. */
  cameraYaw = 0
}
