import * as THREE from 'three'

/**
 * Billboard sprite — a character cut from a reference sheet, always facing the
 * camera (the classic 2.5D trick). Supports swapping between up to three cut
 * views (front / three-quarter / profile) based on the camera's yaw relative
 * to the character's facing, so a character turning reads as turning.
 *
 * Views are loaded once via a shared texture cache keyed by sprite id, so the
 * whole cast shares a handful of textures instead of one per instance.
 */

export interface SpriteViews {
  front: string
  threequarter: string
  profile: string
}

export const SPRITE_PATHS: Record<string, SpriteViews> = {
  miller: {
    front: '/sprites/miller-front.png',
    threequarter: '/sprites/miller-threequarter.png',
    profile: '/sprites/miller-profile.png',
  },
  moretti: {
    front: '/sprites/moretti-front.png',
    threequarter: '/sprites/moretti-threequarter.png',
    profile: '/sprites/moretti-profile.png',
  },
  rosie: {
    front: '/sprites/rosie-front.png',
    threequarter: '/sprites/rosie-threequarter.png',
    profile: '/sprites/rosie-profile.png',
  },
  crystal: {
    front: '/sprites/crystal-front.png',
    threequarter: '/sprites/crystal-threequarter.png',
    profile: '/sprites/crystal-profile.png',
  },
  mark: {
    front: '/sprites/mark-front.png',
    threequarter: '/sprites/mark-threequarter.png',
    profile: '/sprites/mark-profile.png',
  },
  sterling: {
    front: '/sprites/sterling-front.png',
    threequarter: '/sprites/sterling-threequarter.png',
    profile: '/sprites/sterling-profile.png',
  },
  victor: {
    front: '/sprites/victor-front.png',
    threequarter: '/sprites/victor-threequarter.png',
    profile: '/sprites/victor-profile.png',
  },
}

const textureCache = new Map<string, THREE.Texture>()

function loadTexture(path: string): Promise<THREE.Texture> {
  const cached = textureCache.get(path)
  if (cached !== undefined) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      path,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        textureCache.set(path, tex)
        resolve(tex)
      },
      undefined,
      (err) => reject(err),
    )
  })
}

export class Billboard {
  readonly root: THREE.Group
  readonly mesh: THREE.Mesh
  private readonly materials: {
    front: THREE.MeshBasicMaterial
    threequarter: THREE.MeshBasicMaterial
    profile: THREE.MeshBasicMaterial
  }

  /** World-space facing in radians (0 = facing +Z). Drives view selection. */
  facing = 0
  /** Height of the sprite in world units. Width derives from aspect. */
  height = 1.8
  /** Shadow disc under the figure, so a sprite reads as standing on the floor. */
  readonly shadow: THREE.Mesh

  private constructor(
    _views: SpriteViews,
    front: THREE.MeshBasicMaterial,
    threequarter: THREE.MeshBasicMaterial,
    profile: THREE.MeshBasicMaterial,
    shadowMat: THREE.MeshBasicMaterial,
  ) {
    this.materials = { front, threequarter, profile }

    this.root = new THREE.Group()
    this.root.name = 'billboard'

    const geom = new THREE.PlaneGeometry(1, 1)
    const mesh = new THREE.Mesh(geom, front)
    mesh.name = 'sprite-plane'
    mesh.renderOrder = 10
    this.mesh = mesh
    this.root.add(mesh)

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 20),
      shadowMat,
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -this.height / 2 + 0.02
    shadow.renderOrder = 5
    this.shadow = shadow
    this.root.add(shadow)
  }

  static async create(spriteId: string, opts: { height?: number; scale?: number } = {}): Promise<Billboard> {
    const views = SPRITE_PATHS[spriteId]
    if (views === undefined) throw new Error(`Unknown sprite "${spriteId}"`)
    const [front, threequarter, profile] = await Promise.all([
      loadTexture(views.front),
      loadTexture(views.threequarter),
      loadTexture(views.profile),
    ])
    const mk = (tex: THREE.Texture): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, depthWrite: false })
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
    const bb = new Billboard(views, mk(front), mk(threequarter), mk(profile), shadowMat)
    bb.height = opts.height ?? bb.height
    bb.setScale(opts.scale ?? 1)
    return bb
  }

  setScale(s: number): void {
    const mat = this.materials.front
    const img = mat.map?.image
    let aspect = 0.5
    if (img && typeof img === 'object' && 'width' in img && 'height' in img) {
      aspect = (img as { width: number; height: number }).width / (img as { width: number; height: number }).height
    }
    const w = this.height * aspect * s
    const h = this.height * s
    this.mesh.scale.set(w, h, 1)
    this.shadow.scale.set(s, s, s)
    this.shadow.position.y = -h / 2 + 0.02
  }

  setPosition(x: number, y: number, z: number): void {
    this.root.position.set(x, y, z)
  }

  /**
   * Pick the view that best matches the camera angle relative to the
   * character's facing. 0 = facing the camera (front view), ±90 = side
   * (profile), in between = three-quarter.
   */
  update(cameraYaw: number): void {
    // Relative angle of camera to character facing
    let rel = cameraYaw - this.facing
    // Normalise to [-π, π]
    while (rel > Math.PI) rel -= Math.PI * 2
    while (rel < -Math.PI) rel += Math.PI * 2
    // Billboard plane itself always faces camera: set the plane's yaw so the
    // texture's "front" (character facing forward in the image) points the
    // right way. Plane faces +Z by default; rotate to face the camera.
    this.mesh.rotation.y = cameraYaw + Math.PI
    // Select view by how close the camera is to the character's facing
    const abs = Math.abs(rel)
    let mat: THREE.MeshBasicMaterial
    if (abs > Math.PI * 0.62) {
      mat = this.materials.profile
    } else if (abs > Math.PI * 0.3) {
      mat = this.materials.threequarter
    } else {
      mat = this.materials.front
    }
    if (this.mesh.material !== mat) {
      this.mesh.material = mat
    }
    // Mirror for the "other side" — the cut sheets only have left views.
    // When the camera is to the character's right, flip the plane so the
    // three-quarter/profile view reads from the correct side.
    const flip = rel < 0 ? -1 : 1
    this.mesh.scale.x = Math.abs(this.mesh.scale.x) * flip
  }
}
