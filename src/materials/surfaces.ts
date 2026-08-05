import {
  CanvasTexture,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'

/**
 * Procedural surface maps for room 1A.
 *
 * ASSETS.md forbids shipping photoreal environment photographs: they fight the
 * locked palette and read as a collage. These are canvas-drawn patterns tinted
 * to the same hexes the flat materials already used, so the grade stays honest
 * while the surfaces stop reading as greybox.
 */

function hexRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, n | 0))
}

function paintNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  amp: number,
  seed: number,
): void {
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  let s = seed >>> 0
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amp
    d[i] = clampByte(d[i]! + n)
    d[i + 1] = clampByte(d[i + 1]! + n)
    d[i + 2] = clampByte(d[i + 2]! + n)
  }
  ctx.putImageData(img, 0, 0)
}

function toTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number): Texture {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** Faded small-scale floral on the wallpaper ground. Seamless tile. */
export function wallpaperMap(baseHex: number): Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    throw new Error('2d context unavailable for wallpaper')
  }

  const [br, bg, bb] = hexRgb(baseHex)
  ctx.fillStyle = `rgb(${br},${bg},${bb})`
  ctx.fillRect(0, 0, size, size)

  const petal = `rgb(${clampByte(br - 48)},${clampByte(bg - 58)},${clampByte(bb - 42)})`
  const leaf = `rgb(${clampByte(br - 62)},${clampByte(bg - 28)},${clampByte(bb - 55)})`
  const bud = `rgb(${clampByte(br + 22)},${clampByte(bg - 8)},${clampByte(bb - 18)})`

  const stepY = 36
  const stepX = 32
  // Draw one extra period past each edge so the wrap matches.
  for (let y = -stepY; y < size + stepY; y += stepY) {
    for (let x = -stepX; x < size + stepX; x += stepX) {
      const ox = ((x + ((y / stepY) % 2 === 0 ? 0 : stepX / 2)) % size + size) % size
      const oy = ((y % size) + size) % size
      const draw = (px: number, py: number): void => {
        ctx.fillStyle = leaf
        ctx.beginPath()
        ctx.ellipse(px - 6, py + 4, 7, 3, -0.7, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(px + 7, py + 5, 6, 2.5, 0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = petal
        ctx.beginPath()
        ctx.arc(px, py, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(px + 5, py + 2, 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = bud
        ctx.beginPath()
        ctx.arc(px + 1.5, py, 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
      draw(ox, oy)
      // Wrap copies so motifs that straddle the edge stay continuous.
      if (ox < 24) draw(ox + size, oy)
      if (ox > size - 24) draw(ox - size, oy)
      if (oy < 24) draw(ox, oy + size)
      if (oy > size - 24) draw(ox, oy - size)
    }
  }

  // Soft overall mottling rather than a hard vertical stain band, which seams.
  for (let i = 0; i < 6; i++) {
    const x = (i * 97) % size
    const y = (i * 53) % size
    const g = ctx.createRadialGradient(x, y, 2, x, y, 90)
    g.addColorStop(0, `rgba(${clampByte(br - 55)},${clampByte(bg - 48)},${clampByte(bb - 40)},0.22)`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - 90, y - 90, 180, 180)
    if (x < 90) ctx.fillRect(x - 90 + size, y - 90, 180, 180)
    if (y < 90) ctx.fillRect(x - 90, y - 90 + size, 180, 180)
  }

  paintNoise(ctx, size, 12, 0x51a11)
  return toTexture(canvas, 2.4, 1.5)
}

/** Wide floorboards. Room 1A walks as floorboard; the target is timber, not carpet. */
export function floorboardMap(baseHex: number): Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    throw new Error('2d context unavailable for floorboards')
  }

  const [br, bg, bb] = hexRgb(baseHex)
  const boardH = 64
  for (let y = 0; y < size; y += boardH) {
    const shade = ((y / boardH) % 3) * 6 - 6
    ctx.fillStyle = `rgb(${clampByte(br + shade)},${clampByte(bg + shade)},${clampByte(bb + shade)})`
    ctx.fillRect(0, y, size, boardH - 2)
    ctx.fillStyle = `rgba(${clampByte(br - 40)},${clampByte(bg - 35)},${clampByte(bb - 30)},0.7)`
    ctx.fillRect(0, y + boardH - 2, size, 2)
    for (let x = (y / boardH) % 2 === 0 ? 40 : 140; x < size; x += 180) {
      ctx.fillRect(x, y, 2, boardH - 2)
    }
    for (let yy = y + 4; yy < y + boardH - 4; yy += 3) {
      const wobble = Math.sin(yy * 0.11) * 10
      ctx.strokeStyle = `rgba(${clampByte(br + 20)},${clampByte(bg + 14)},${clampByte(bb + 8)},0.18)`
      ctx.beginPath()
      ctx.moveTo(0, yy)
      ctx.lineTo(size, yy + wobble * 0.05)
      ctx.stroke()
    }
  }

  paintNoise(ctx, size, 14, 0x91f2)
  return toTexture(canvas, 2.2, 3.4)
}

/** Worn carpet fibre — used for the rug, not the room floor. */
export function carpetMap(baseHex: number): Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    throw new Error('2d context unavailable for carpet')
  }

  const [br, bg, bb] = hexRgb(baseHex)
  ctx.fillStyle = `rgb(${br},${bg},${bb})`
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 14000; i++) {
    const x = (i * 47) % size
    const y = (i * 97) % size
    const v = (i % 7) - 3
    ctx.fillStyle = `rgba(${clampByte(br + v * 12)},${clampByte(bg + v * 9)},${clampByte(bb + v * 7)},0.55)`
    ctx.fillRect(x, y, 3, 1)
  }

  // Border.
  ctx.strokeStyle = `rgb(${clampByte(br - 30)},${clampByte(bg - 25)},${clampByte(bb - 20)})`
  ctx.lineWidth = 14
  ctx.strokeRect(10, 10, size - 20, size - 20)
  ctx.strokeStyle = `rgb(${clampByte(br + 35)},${clampByte(bg + 20)},${clampByte(bb - 10)})`
  ctx.lineWidth = 4
  ctx.strokeRect(22, 22, size - 44, size - 44)

  paintNoise(ctx, size, 18, 0xc4a7)
  return toTexture(canvas, 1.2, 1.5)
}

/** Chenille bedspread: raised tuft dots catching the sun. */
export function bedspreadMap(baseHex: number): Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    throw new Error('2d context unavailable for bedspread')
  }

  const [br, bg, bb] = hexRgb(baseHex)
  ctx.fillStyle = `rgb(${br},${bg},${bb})`
  ctx.fillRect(0, 0, size, size)

  for (let y = 5; y < size; y += 9) {
    for (let x = 5; x < size; x += 9) {
      const ox = x + ((y / 9) % 2 === 0 ? 0 : 4)
      ctx.fillStyle = `rgb(${clampByte(br - 35)},${clampByte(bg - 28)},${clampByte(bb - 22)})`
      ctx.beginPath()
      ctx.arc(ox + 0.8, y + 0.8, 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgb(${clampByte(br + 38)},${clampByte(bg + 28)},${clampByte(bb + 24)})`
      ctx.beginPath()
      ctx.arc(ox - 0.5, y - 0.5, 2.3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  paintNoise(ctx, size, 14, 0xb9d5)
  return toTexture(canvas, 2.6, 4.0)
}

/** Quiet timber grain for furniture faces. */
export function timberMap(baseHex: number): Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    throw new Error('2d context unavailable for timber')
  }

  const [br, bg, bb] = hexRgb(baseHex)
  ctx.fillStyle = `rgb(${br},${bg},${bb})`
  ctx.fillRect(0, 0, size, size)

  for (let y = 0; y < size; y++) {
    const wobble = Math.sin(y * 0.07) * 8 + Math.sin(y * 0.019) * 18
    const shade = ((y * 13) % 9) - 4
    ctx.strokeStyle = `rgba(${clampByte(br + shade * 8)},${clampByte(bg + shade * 6)},${clampByte(bb + shade * 5)},0.5)`
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(size * 0.33 + wobble, y + 1, size * 0.66 - wobble, y - 1, size, y)
    ctx.stroke()
  }

  paintNoise(ctx, size, 10, 0x71e2)
  return toTexture(canvas, 1.2, 1.6)
}

/** Stained plaster for the ceiling — cracks and foxing, no floral. */
export function plasterMap(baseHex: number): Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    throw new Error('2d context unavailable for plaster')
  }

  const [br, bg, bb] = hexRgb(baseHex)
  ctx.fillStyle = `rgb(${clampByte(br + 18)},${clampByte(bg + 14)},${clampByte(bb + 10)})`
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 8; i++) {
    const x = 40 + i * 55
    const y = 30 + ((i * 73) % 200)
    const g = ctx.createRadialGradient(x, y, 2, x, y, 70 + (i % 3) * 20)
    g.addColorStop(0, `rgba(${clampByte(br - 45)},${clampByte(bg - 38)},${clampByte(bb - 30)},0.4)`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - 90, y - 90, 180, 180)
  }

  ctx.strokeStyle = `rgba(${clampByte(br - 55)},${clampByte(bg - 48)},${clampByte(bb - 40)},0.55)`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(20, 80)
  ctx.lineTo(140, 95)
  ctx.lineTo(210, 88)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(300, 40)
  ctx.lineTo(380, 120)
  ctx.lineTo(470, 110)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(80, 300)
  ctx.lineTo(160, 340)
  ctx.lineTo(240, 320)
  ctx.stroke()

  paintNoise(ctx, size, 16, 0x33ce)
  return toTexture(canvas, 2.0, 2.0)
}

export function mapped(
  _color: number,
  roughness: number,
  map: Texture,
): MeshStandardMaterial {
  // Colour stays near white so the map carries the albedo. Multiplying the
  // palette hex through the map twice was washing every surface toward mud.
  return new MeshStandardMaterial({ color: 0xffffff, roughness, map })
}

export function mappedTinted(
  color: number,
  roughness: number,
  map: Texture,
): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, map })
}
