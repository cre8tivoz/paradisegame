import {
  ClampToEdgeWrapping,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'

/**
 * Shipped textures under `public/textures/`.
 *
 * Sources live in `images/assets/`. Codex generates them; this module loads the
 * resized runtime copies. Seamless tiles use `tiled()`. Document props use
 * `windowed()`. Neon letterforms are PNG with alpha.
 */

const loader = new TextureLoader()
const cache = new Map<string, Texture>()

export type DocTexture =
  | 'photo-in-frame'
  | 'diary-page'
  | 'note'
  | 'victor-record'
  | 'map-pins'
  | 'magazines'

export type TileTexture =
  | 'wallpaper-floral'
  | 'carpet-brown'
  | 'bedspread-rose'
  | 'render-cream'
  | 'marble-step'
  | 'floorboards-oak'
  | 'timber-dark'
  | 'crystal-dress'

export type NeonTexture = 'neon-sign' | 'neon-sign-2'

export type TextureName = DocTexture | TileTexture | NeonTexture

/**
 * Where the interesting part of each document source is, in fractions of the
 * image, measured from the top left.
 */
export const WINDOWS: Readonly<Record<DocTexture, readonly [number, number, number, number]>> = {
  'photo-in-frame': [0.02, 0.02, 0.98, 0.98],
  'diary-page': [0.06, 0.08, 0.94, 0.92],
  note: [0.08, 0.10, 0.92, 0.90],
  'victor-record': [0.04, 0.04, 0.96, 0.96],
  'map-pins': [0.02, 0.02, 0.98, 0.98],
  magazines: [0.02, 0.02, 0.98, 0.98],
}

const TILE_EXT: Readonly<Record<TileTexture, 'jpg'>> = {
  'wallpaper-floral': 'jpg',
  'carpet-brown': 'jpg',
  'bedspread-rose': 'jpg',
  'render-cream': 'jpg',
  'marble-step': 'jpg',
  'floorboards-oak': 'jpg',
  'timber-dark': 'jpg',
  'crystal-dress': 'jpg',
}

const DOC_EXT: Readonly<Record<DocTexture, 'jpg'>> = {
  'photo-in-frame': 'jpg',
  'diary-page': 'jpg',
  note: 'jpg',
  'victor-record': 'jpg',
  'map-pins': 'jpg',
  magazines: 'jpg',
}

function load(path: string): Texture {
  const existing = cache.get(path)
  if (existing !== undefined) {
    return existing
  }
  const loaded = loader.load(path)
  loaded.colorSpace = SRGBColorSpace
  loaded.anisotropy = 8
  cache.set(path, loaded)
  return loaded
}

/** Document / prop photograph. Shared; clone via `windowed` before UV edits. */
export function texture(name: DocTexture): Texture {
  return load(`/textures/${name}.${DOC_EXT[name]}`)
}

/**
 * Seamless material tile. Cloned so each surface can set its own repeat
 * without fighting.
 */
export function tiled(name: TileTexture, repeatX: number, repeatY: number): Texture {
  const tex = load(`/textures/${name}.${TILE_EXT[name]}`).clone()
  tex.needsUpdate = true
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.anisotropy = 8
  return tex
}

/**
 * Neon letterforms on transparent PNG.
 *
 * `neon-sign` is the preferred static plate. `neon-sign-2` is the motion /
 * flicker alternate (same plate until a second frame is authored).
 */
export function neonPlate(name: NeonTexture = 'neon-sign'): Texture {
  const tex = load(`/textures/${name}.png`).clone()
  tex.needsUpdate = true
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.anisotropy = 4
  return tex
}

/**
 * A texture windowed to one region of its source.
 *
 * Cloned, because `offset` and `repeat` live on the texture and two props
 * windowing the same source would otherwise fight over them.
 */
export function windowed(name: DocTexture): Texture {
  const [x0, y0, x1, y1] = WINDOWS[name]
  const tex = texture(name).clone()
  tex.needsUpdate = true
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.repeat.set(x1 - x0, y1 - y0)
  tex.offset.set(x0, 1 - y1)
  return tex
}
