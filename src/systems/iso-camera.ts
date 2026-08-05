import * as THREE from 'three'

/**
 * IsoCamera — fixed 3/4 perspective camera (the Sims trick).
 *
 * The world is real 3D geometry, but the camera holds a locked azimuth/polar
 * angle so the game reads as isometric 2.5D. The player can nudge the view
 * (drag to orbit within a clamp, scroll to dolly) — enough to feel 3D without
 * ever losing the "dollhouse" framing.
 *
 * Angles match the proven TinyWorld default: azimuth π·0.32, polar π·0.30,
 * with the +Z face as the readable "front".
 */

export interface IsoCameraConfig {
  azimuth: number // radians, orbit around Y
  polar: number // radians from +Y down
  distance: number
  target: THREE.Vector3
  minDistance: number
  maxDistance: number
  azimuthClamp: [number, number]
  polarClamp: [number, number]
  sensitivity: number
  dollySpeed: number
}

const DEFAULT: IsoCameraConfig = {
  azimuth: Math.PI * 0.32,
  polar: Math.PI * 0.3,
  distance: 26,
  target: new THREE.Vector3(0, 0, 4),
  minDistance: 8,
  maxDistance: 60,
  azimuthClamp: [Math.PI * 0.1, Math.PI * 0.6],
  polarClamp: [Math.PI * 0.12, Math.PI * 0.46],
  sensitivity: 0.004,
  dollySpeed: 0.9,
}

export class IsoCamera {
  readonly camera: THREE.PerspectiveCamera
  private readonly cfg: IsoCameraConfig
  private dragging = false
  private lastX = 0
  private lastY = 0

  constructor(aspect: number, cfg: Partial<IsoCameraConfig> = {}) {
    this.cfg = { ...DEFAULT, ...cfg }
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200)
    this.apply()
  }

  /** Where the camera looks. Mutate this; the rig follows. */
  get target(): THREE.Vector3 {
    return this.cfg.target
  }

  setTarget(x: number, y: number, z: number): void {
    this.cfg.target.set(x, y, z)
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  onPointerDown(x: number, y: number): void {
    this.dragging = true
    this.lastX = x
    this.lastY = y
  }

  onPointerMove(x: number, y: number): void {
    if (!this.dragging) return
    const dx = x - this.lastX
    const dy = y - this.lastY
    this.lastX = x
    this.lastY = y
    this.cfg.azimuth = THREE.MathUtils.clamp(
      this.cfg.azimuth - dx * this.cfg.sensitivity,
      this.cfg.azimuthClamp[0],
      this.cfg.azimuthClamp[1],
    )
    this.cfg.polar = THREE.MathUtils.clamp(
      this.cfg.polar + dy * this.cfg.sensitivity,
      this.cfg.polarClamp[0],
      this.cfg.polarClamp[1],
    )
    this.apply()
  }

  onPointerUp(): void {
    this.dragging = false
  }

  onWheel(deltaY: number): void {
    this.cfg.distance = THREE.MathUtils.clamp(
      this.cfg.distance + deltaY * 0.01 * this.cfg.dollySpeed,
      this.cfg.minDistance,
      this.cfg.maxDistance,
    )
    this.apply()
  }

  /** Recompute camera position from target + spherical angles. */
  apply(): void {
    const { azimuth, polar, distance, target } = this.cfg
    const x = distance * Math.sin(polar) * Math.sin(azimuth)
    const y = distance * Math.cos(polar)
    const z = distance * Math.sin(polar) * Math.cos(azimuth)
    this.camera.position.set(target.x + x, target.y + y, target.z + z)
    this.camera.lookAt(target)
  }

  /** Camera yaw (world space, 0 = +Z, matches character facing math). */
  get yaw(): number {
    return this.cfg.azimuth
  }
}
