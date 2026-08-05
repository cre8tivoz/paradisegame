import * as THREE from 'three'

/**
 * Stage — the 2.5D world. Each scene is built from kit primitives (the same
 * slab/wall/walk vocabulary the first-person game used), plus billboard props
 * and hotspot markers. The camera is fixed isometric, so a stage is a
 * "dollhouse": floor slab, back walls, a few furniture boxes, and sprites.
 *
 * This is the presentation layer. All gameplay logic (evidence, gates,
 * dialogue) lives outside and talks to the stage through object ids.
 */

export interface StageProp {
  readonly id: string
  readonly object: THREE.Object3D
  /** Optional lookable description shown on hover/click. */
  readonly description?: string
  readonly examine?: string
  readonly evidenceId?: string
  readonly dialogueId?: string
  readonly taggable?: boolean
}

export interface StageDef {
  readonly id: string
  readonly name: string
  readonly title: string
  readonly spawn: { x: number; z: number; facing: number }
  readonly floor: { x0: number; x1: number; z0: number; z1: number; y?: number; color?: number; texture?: string; repeatX?: number; repeatY?: number }
  readonly walls: Array<{ x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; color?: number }>
  readonly props: StageProp[]
  readonly walkBounds: { x0: number; x1: number; z0: number; z1: number }
  readonly camera?: { target: { x: number; y: number; z: number }; distance?: number }
  readonly backdrop?: string // texture path for a back wall / sky
}

export class Stage {
  readonly group = new THREE.Group()
  readonly props = new Map<string, StageProp>()
  readonly hotspots: THREE.Object3D[] = []
  readonly id: string
  readonly name: string
  readonly title: string
  readonly spawn: { x: number; z: number; facing: number }
  readonly walkBounds: { x0: number; x1: number; z0: number; z1: number }
  readonly cameraTarget: { x: number; y: number; z: number }

  constructor(def: StageDef) {
    this.id = def.id
    this.name = def.name
    this.title = def.title
    this.spawn = def.spawn
    this.walkBounds = def.walkBounds
    this.cameraTarget = def.camera?.target ?? { x: 0, y: 0, z: 4 }

    this.buildFloor(def)
    this.buildWalls(def)
    for (const prop of def.props) {
      this.addProp(prop)
    }
    if (def.backdrop !== undefined) {
      this.buildBackdrop(def.backdrop)
    }
  }

  private buildFloor(def: StageDef): void {
    const f = def.floor
    const color = f.color ?? 0x6e6255
    const mat =
      f.texture !== undefined
        ? new THREE.MeshStandardMaterial({
            map: loadTile(f.texture, f.repeatX ?? 4, f.repeatY ?? 4),
            roughness: 0.95,
          })
        : new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
    const y = f.y ?? 0
    const w = f.x1 - f.x0
    const d = f.z1 - f.z0
    const geo = new THREE.PlaneGeometry(w, d)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set((f.x0 + f.x1) / 2, y, (f.z0 + f.z1) / 2)
    mesh.receiveShadow = true
    mesh.name = `${def.id}:floor`
    this.group.add(mesh)
  }

  private buildWalls(def: StageDef): void {
    for (const wall of def.walls) {
      const mat = new THREE.MeshStandardMaterial({ color: wall.color ?? 0xc4b393, roughness: 0.92 })
      const w = wall.x1 - wall.x0
      const h = wall.y1 - wall.y0
      const d = wall.z1 - wall.z0
      const geo = new THREE.BoxGeometry(w, h, d)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        (wall.x0 + wall.x1) / 2,
        (wall.y0 + wall.y1) / 2,
        (wall.z0 + wall.z1) / 2,
      )
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.name = `${def.id}:wall`
      this.group.add(mesh)
    }
  }

  private buildBackdrop(path: string): void {
    // A large textured plane behind the stage — the "diorama" backdrop that
    // carries the sky/street/room beyond. Loaded async; safe to add empty.
    const tex = new THREE.TextureLoader().load(path, (t) => {
      t.colorSpace = THREE.SRGBColorSpace
    })
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), mat)
    mesh.position.set(0, 12, -18)
    mesh.name = `${this.id}:backdrop`
    this.group.add(mesh)
  }

  private addProp(prop: StageProp): void {
    this.group.add(prop.object)
    this.props.set(prop.id, prop)
    if (prop.description !== undefined) {
      this.hotspots.push(prop.object)
    }
  }

  /** Add a standalone hotspot (invisible interaction volume). */
  addHotspot(id: string, x: number, y: number, z: number, w: number, h: number, d: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    mesh.position.set(x, y, z)
    mesh.name = id
    this.group.add(mesh)
    this.hotspots.push(mesh)
    return mesh
  }

  /** Simple furniture box helper. */
  static box(
    id: string,
    opts: { x: number; y: number; z: number; w: number; h: number; d: number; color?: number; texture?: string; description?: string; examine?: string; evidenceId?: string; taggable?: boolean },
  ): StageProp {
    const mat =
      opts.texture !== undefined
        ? new THREE.MeshStandardMaterial({ map: loadTile(opts.texture, 1, 1), roughness: 0.8 })
        : new THREE.MeshStandardMaterial({ color: opts.color ?? 0x6b5a4a, roughness: 0.8 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(opts.w, opts.h, opts.d), mat)
    mesh.position.set(opts.x, opts.y + opts.h / 2, opts.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = id
    return {
      id,
      object: mesh,
      description: opts.description,
      examine: opts.examine,
      evidenceId: opts.evidenceId,
      taggable: opts.taggable,
    }
  }
}

const tileCache = new Map<string, THREE.Texture>()
function loadTile(path: string, rx: number, ry: number): THREE.Texture {
  const key = `${path}:${rx}:${ry}`
  const cached = tileCache.get(key)
  if (cached !== undefined) return cached
  const tex = new THREE.TextureLoader().load(path, (t) => {
    t.colorSpace = THREE.SRGBColorSpace
  })
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(rx, ry)
  tileCache.set(key, tex)
  return tex
}