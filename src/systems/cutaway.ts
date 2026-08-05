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
  private lastCamPos = new Vector3(Infinity, 0, 0)

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
      this.updateWallVisibility()
    }

    // 2. Update wall visibility when camera position changes
    if (this.camera.position.distanceToSquared(this.lastCamPos) > 0.0001) {
      this.lastCamPos.copy(this.camera.position)
      this.updateWallVisibility()
    }
  }

  /** Hide the storey above Miller entirely; show the storey below. */
  private applyStoreyCulling(): void {
    const targetStorey = this.currentStorey

    // Floors: hide floor slab of storey ABOVE Miller
    for (const f of this.floorMeshes) {
      f.visible = f.userData.storey !== targetStorey + 1
    }

    // Props on storey above: traverse and hide
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
    for (const w of this.walls) {
      // Storey above Miller: always hidden
      if (w.userData.storey === this.currentStorey + 1) {
        w.visible = false
        continue
      }
      const toCam = this.camera.position.clone().sub(w.position).normalize()
      const dot = toCam.dot(w.userData.normal)
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