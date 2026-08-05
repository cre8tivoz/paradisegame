/**
 * The locked palette, from ASSETS.md. Store as constants, never hardcode a
 * colour in a material.
 */

export const EXTERIOR = {
  renderCream: 0xd8cdba,
  renderStain: 0x8a7c68,
  marbleStep: 0xc9c4b8,
  ironLace: 0x2e2a26,
  neonPink: 0xff3e8a,
  neonCyan: 0x3ee8ff,
  tapeBlue: 0x1b3a6b,
  /**
   * Not in ASSETS.md, same class of assumption as the glove colour.
   *
   * `bitumen` is Fitzroy Street, which ASSETS.md asks to read wet even though
   * it has not rained. `sky` is 3pm February and is deliberately pale and hot
   * rather than a postcard blue, for the same reason `ROOM_1A.daylight` is
   * blown: it is the exposure reference for every exterior shot.
   *
   * `signBoard` is the dark backing the neon is mounted on.
   */
  bitumen: 0x2b2b2e,
  sky: 0xf1f4f3,
  signBoard: 0x241f1c,
  /**
   * The back yard. Same class of assumption again, all of it flagged in
   * CLAUDE.md.
   *
   * `grassDry` is St Kilda at the end of February, so it is khaki and not
   * green. `weed` is what is still alive in the shade of the fence.
   */
  grassDry: 0x8f8b5e,
  weed: 0x5f6b3e,
  paling: 0x6b5c47,
  corrugate: 0x969a94,
  rust: 0x7a4526,
} as const

export const INTERIOR = {
  nicotine: 0xc4b393,
  carpetBrown: 0x5c4433,
  timberDark: 0x3b2a1e,
  brassVerdigris: 0x7a8a6b,
  curtainMaroon: 0x5a2730,
} as const

export const ROOM_1A = {
  wallpaperFloral: 0xb8a48c,
  sunWarm: 0xffe0b0,
  /**
   * ASSETS.md lists `sun-shadow` as `#6E6croll`, which is not a colour. The
   * note in that table gives `#6E6255` as the intended value. Using that.
   */
  sunShadow: 0x6e6255,
  bedspreadRose: 0x9c6b72,
  crystalDress: 0xe8e2d6,
  /**
   * What you see through the sash at 3pm. Not in ASSETS.md, so it is an
   * assumption like the glove colour.
   *
   * It is deliberately near white rather than sky blue. A real photograph of a
   * sunlit room blows its windows out, and BRIEF.md asks room 1A to photograph
   * like a real estate listing. A correctly exposed sky outside would make the
   * interior read as the dark thing in frame, which is the opposite of the point.
   */
  daylight: 0xfff6e6,
} as const

/**
 * Miller's hands. The only part of him the player sees until the last shot.
 *
 * ASSETS.md gives no glove colour and the palette has no token for one, so
 * `glove` is an assumption: pale cream latex, which is what a 1994 Victorian
 * crime scene would actually have. Change this one value if that is wrong.
 *
 * `cuff` is not an assumption. IMAGE-PROMPTS.md puts Miller in a white
 * business shirt with the sleeves buttoned at the wrist, and CLAUDE.md's
 * ageing table has scene 1 cuffs clean and buttoned.
 */
export const HANDS = {
  glove: 0xd9d2be,
  gloveSeam: 0xc7bfa8,
  cuff: 0xf2f0ea,
  cuffShadow: 0xd8d4c8,
} as const

/**
 * Test room only. Never ships. Deliberately outside the locked palette so a
 * grey box is never mistaken for authored geometry.
 */
export const GREYBOX = {
  floor: 0x6f6f6f,
  wall: 0x9a9a9a,
  prop: 0xb4b4b4,
  propAlt: 0x808080,
} as const
