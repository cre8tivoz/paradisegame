import { Camera, Mesh, Object3D, Vector3 } from 'three'

interface CutawayMesh extends Mesh {
  userData: {
    kind: 'wall' | 'ceiling' | 'floor'
    normal: Vector3
    storey: 0 | 1
  }
}

/** Wall/ceiling/floor culling for the dollhouse camera. */
export class Cutaway {
  private readonly camera: Camera
  private readonly root: Object3D
  private readonly walls: CutawayMesh[] = []
  private readonly ceilings: CutawayMesh[] = []
  private readonly floorMeshes: CutawayMesh[] = []
  private currentStorey = 0
  private lastAzimuth: number | null = null
  private lastPolar: number | null = null

  constructor(camera: Camera, root: Object3D) {
    this.camera = camera
    this.root = root
    this.collect()
    this.applyInitial()
  }

  /** Walk the scene graph once at load and bucket tagged meshes. */
  private collect(): void {
    this.root.traverse((obj) => {
      const mesh = obj as CutawayMesh
      if (!mesh.isMesh || !mesh.userData?.kind) return
      switch (mesh.userData.kind) {
        case 'wall':
          this.walls.push(mesh)
          break
        case 'ceiling':
          this.ceilings.push(mesh)
          break
        case 'floor':
          this.floorMeshes.push(mesh)
          break
      }
    })
  }

  /** Hide all ceilings immediately; they only show for the establishing shot. */
  private applyInitial(): void {
    for (const c of this.ceilings) c.visible = false
  }

  /** Call once per frame. Updates storey tracking and wall visibility. */
  update(millerPosition: Vector3): void {
    // 1. Detect storey from Miller's Y
    const newStorey = millerPosition.y >= 3.2 ? 1 : 0
    if (newStorey !== this.currentStorey) {
      this.currentStorey = newStorey
      this.applyStoreyCulling()
    }

    // 2. Update wall visibility on camera azimuth/polar change (cheaper than per-frame dot)
    const azimuth = (this.camera as any).cfg?.azimuth ?? (this.camera as any).azimuth
    const polar = (this.camera as any).cfg?.polar ?? (this.camera as any).polar
    if (azimuth !== this.lastAzimuth || polar !== this.lastPolar) {
      this.lastAzimuth = azimuth
      this.lastPolar = polar
      this.updateWallVisibility()
    }
  }

  /** Hide the storey above Miller entirely; show the storey below. */
  private applyStoreyCulling(): void {
    const targetStorey = this.currentStorey

    // Walls: hide walls on the storey ABOVE Miller
    for (const w of this.walls) {
      const storey = w.userData.storey
      if (storey === targetStorey + 1) {
        w.visible = false
      } else if (storey === targetStorey) {
        // Re-evaluate camera-facing for current storey
        this.updateWallVisibility()
      }
    }

    // Floors: hide floor slab of storey ABOVE Miller
    for (const f of this.floorMeshes) {
      f.visible = f.userData.storey !== targetStorey + 1
    }

    // Props on storey above: traverse and hide
    // We'll catch them via the wall/storey sweep since props are children of lodge
    this.root.traverse((obj) => {
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      const ud = mesh.userData
      if (ud?.storey === targetStorey + 1 && ud?.kind !== 'wall' && ud?.kind !== 'ceiling' && ud?.kind !== 'floor') {
        mesh.visible = false
      } else if (ud?.storey === targetStorey && ud?.kind !== 'wall' && ud?.kind !== 'ceiling' && ud?.kind !== 'floor') {
        mesh.visible = true
      }
    })
  }

  /** Show only walls whose outward normal points AWAY from the camera. */
  private updateWallVisibility(): void {
    const camPos = this.camera.position.clone()
    for (const w of this.walls) {
      // Only evaluate walls on Miller's current storey
      if (w.userData.storey !== this.currentStorey) continue
      const toCam = camPos.clone().sub(w.position).normalize()
      const dot = toCam.dot(w.userData.normal)
      // dot > 0 means normal points toward camera = wall is between camera and room
      w.visible = dot < 0.1
    }
  }

  /** Reveal everything (for establishing shot / photo mode). */
  revealAll(): void {
    for (const c of this.ceilings) c.visible = true
    for (const w of this.walls) w.visible = true
    for (const f of this.floorMeshes) f.visible = true
    this.root.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.isMesh && mesh.userData?.storey !== undefined) mesh.visible = true
    })
  }
}