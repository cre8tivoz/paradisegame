import {
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  type BufferGeometry,
  type Texture,
} from 'three'

/**
 * Sourced PBR material sets.
 *
 * `surfaces.ts` draws its maps on a canvas and hands a `MeshStandardMaterial` a
 * single albedo with a roughness number guessed beside it. That is revoked. A
 * surface here is four maps that were measured off the real thing: albedo,
 * normal, roughness and ambient occlusion, downloaded as a set at 2k.
 *
 * The difference is not detail, it is variation. A guessed roughness is one
 * number over the whole floor, so the whole floor catches the sun identically
 * and reads as one flat plane with a picture on it. A roughness map is where
 * the wear is, and it is the thing that makes a scuffed board look scuffed.
 *
 * Sets live in `public/textures/pbr/<id>/`, named exactly as Poly Haven ships
 * them. Every one is credited in `docs/CREDITS.md`.
 */

const loader = new TextureLoader()
const cache = new Map<string, Texture>()

export type PbrSet = 'wood_planks'

interface SetDef {
  /** Directory and filename stem under `public/textures/pbr/`. */
  readonly id: string
  /**
   * How many metres of real surface the tile covers, from the Poly Haven
   * listing. Repeats are worked out from this and the size of the thing being
   * covered, so a floor is boards at board scale and not boards at whatever
   * looked right.
   */
  readonly metres: number
}

const SETS: Readonly<Record<PbrSet, SetDef>> = {
  wood_planks: { id: 'wood_planks', metres: 1.5 },
}

/** Poly Haven's map suffixes. `nor_gl` is the OpenGL normal, which is three's. */
type MapKind = 'diff' | 'nor_gl' | 'rough' | 'ao'

function load(set: SetDef, kind: MapKind, srgb: boolean): Texture {
  const path = `/textures/pbr/${set.id}/${set.id}_${kind}_2k.jpg`
  const cached = cache.get(path)
  const tex = cached ?? loader.load(path)
  if (cached === undefined) {
    /*
     * Only the albedo is colour. A normal, a roughness and an occlusion map are
     * measurements, and putting them through the sRGB decode bends every value
     * in them: the normals come out tilted and the roughness comes out glossy.
     */
    tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
    tex.anisotropy = 8
    cache.set(path, tex)
  }
  return tex
}

/**
 * Copies `uv` into `uv1`.
 *
 * `aoMap` and `lightMap` read the **second** UV set, which is named `uv1` in
 * current three and was `uv2` before r151. Geometry built from `BoxGeometry`
 * has one UV set, so without this the AO map is loaded, uploaded, bound, and
 * silently ignored.
 *
 * This is a stand-in. A baked lightmap needs a real non-overlapping unwrap, and
 * that arrives with the room out of Blender. Reusing the tiling UVs is only
 * honest while the AO map is the tile's own AO, which repeats with it.
 */
export function withSecondUv(geometry: BufferGeometry): BufferGeometry {
  const uv = geometry.getAttribute('uv')
  if (uv !== undefined && geometry.getAttribute('uv1') === undefined) {
    geometry.setAttribute('uv1', uv)
  }
  return geometry
}

export interface PbrOptions {
  /** Size of the surface being covered, in metres. Sets the repeat. */
  readonly metres: Vector2
  /** Occlusion strength. 1 is the map as shipped. */
  readonly aoIntensity?: number
  /** Bump depth, both axes. 1 is the map as shipped. */
  readonly normalScale?: number
}

/**
 * A material with all four maps on it.
 *
 * Repeat comes out of the real world size of both the tile and the surface, so
 * the boards are the size boards are.
 */
export function pbrMaterial(name: PbrSet, options: PbrOptions): MeshStandardMaterial {
  const set = SETS[name]
  const repeatX = options.metres.x / set.metres
  const repeatY = options.metres.y / set.metres

  const maps: Texture[] = []
  const take = (kind: MapKind, srgb: boolean): Texture => {
    // Cloned, because repeat lives on the texture and two surfaces at different
    // scales would otherwise fight over it. Clones share the GPU upload.
    const tex = load(set, kind, srgb).clone()
    tex.needsUpdate = true
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
    maps.push(tex)
    return tex
  }

  const material = new MeshStandardMaterial({
    map: take('diff', true),
    normalMap: take('nor_gl', false),
    roughnessMap: take('rough', false),
    aoMap: take('ao', false),
    /*
     * White, and 1. The maps carry the albedo and the roughness now, and a
     * palette hex multiplied through a photographed map is the map twice, which
     * is what was turning every surface toward mud.
     */
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
  })

  material.aoMapIntensity = options.aoIntensity ?? 1
  const ns = options.normalScale ?? 1
  material.normalScale = new Vector2(ns, ns)
  material.userData.pbrMaps = maps
  return material
}
