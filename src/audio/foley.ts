import { on } from '../core/events.ts'
import type { Mixer } from './mixer.ts'

/**
 * Foley for the verbs. ASSETS.md's list, minus the footsteps, which have their
 * own file because they fire far more often than anything here.
 *
 * > Gloves going on. Sash window. Wardrobe. Paper. Lighter. Ashtray. Cassette
 * > recorder engaging.
 *
 * The cassette recorder is scene 4. The rest of it is scene 1.
 *
 * ## It plays on examine:start, not on complete
 *
 * The hand animation is the action. `examine:complete` is when the tier-two text
 * lands, which is after the hand has already pushed the sash or opened the
 * drawer, so a sound there arrives once the thing it describes has finished
 * happening. Starting with the clip and letting it ring under the animation is
 * what makes the hand look like it is touching something.
 *
 * ## Nothing here scores a discovery
 *
 * ASSETS.md: "Never score the discoveries. No sting when Miller finds the
 * temple. The absence is the effect." So there is no handler for
 * `evidence:filed` and there must never be one. The needle and the temple are
 * examined in silence except for the cloth and the breath of the animation, and
 * that is the whole point of them.
 */

type Voice = (mixer: Mixer, at: number, bus: AudioNode) => void

/** Paper. Notebook, magazines, the note, the map, the diary. */
const paper: Voice = (mixer, at, bus) => {
  const ctx = mixer.context
  // Three short bursts of filtered noise, which is what a page turning is: not
  // one sound but a handful of separations very close together.
  for (let i = 0; i < 3; i += 1) {
    const start = at + i * (0.04 + Math.random() * 0.05)
    const source = mixer.noiseSource()
    const band = mixer.filter('bandpass', 2600 + Math.random() * 2200, 1.1)
    const gain = ctx.createGain()
    source.connect(band).connect(gain).connect(bus)
    const peak = 0.10 - i * 0.02
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(peak, start + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09)
    source.start(start, Math.random() * 1.5, 0.12)
    source.stop(start + 0.12)
  }
}

/** Timber sliding in a rebate. Wardrobe doors, the dresser drawer. */
const woodSlide: Voice = (mixer, at, bus) => {
  const ctx = mixer.context
  const source = mixer.noiseSource()
  const band = mixer.filter('bandpass', 640, 3.2)
  const gain = ctx.createGain()
  source.connect(band).connect(gain).connect(bus)
  // A slide is a sustain, not a hit, so it comes up and stays before it stops.
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(0.08, at + 0.05)
  gain.gain.setValueAtTime(0.08, at + 0.24)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.36)
  // Rising as it opens, then the knock of it stopping.
  band.frequency.setValueAtTime(520, at)
  band.frequency.linearRampToValueAtTime(880, at + 0.28)
  source.start(at, Math.random(), 0.4)
  source.stop(at + 0.4)

  const knock = ctx.createOscillator()
  knock.type = 'sine'
  const knockGain = ctx.createGain()
  knock.connect(knockGain).connect(bus)
  const hit = at + 0.3
  knock.frequency.setValueAtTime(150, hit)
  knock.frequency.exponentialRampToValueAtTime(70, hit + 0.06)
  knockGain.gain.setValueAtTime(0, hit)
  knockGain.gain.linearRampToValueAtTime(0.12, hit + 0.005)
  knockGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.09)
  knock.start(hit)
  knock.stop(hit + 0.11)
}

/**
 * The sash. Paint on the runners is old, per its own examine line, so it does
 * not slide: it grabs, gives an inch, and stops dead.
 */
const sash: Voice = (mixer, at, bus) => {
  const ctx = mixer.context
  const source = mixer.noiseSource()
  const band = mixer.filter('bandpass', 900, 5)
  const gain = ctx.createGain()
  source.connect(band).connect(gain).connect(bus)

  // Stick, slip, stick. Two shoves with nothing much in between.
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(0.11, at + 0.03)
  gain.gain.linearRampToValueAtTime(0.02, at + 0.14)
  gain.gain.linearRampToValueAtTime(0.13, at + 0.22)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42)
  band.frequency.setValueAtTime(760, at)
  band.frequency.linearRampToValueAtTime(1250, at + 0.24)
  source.start(at, Math.random(), 0.5)
  source.stop(at + 0.5)

  // It stops against the paint rather than against a stop, so the end is dull.
  const jam = ctx.createOscillator()
  jam.type = 'triangle'
  const jamGain = ctx.createGain()
  jam.connect(jamGain).connect(bus)
  const end = at + 0.36
  jam.frequency.setValueAtTime(120, end)
  jam.frequency.exponentialRampToValueAtTime(58, end + 0.08)
  jamGain.gain.setValueAtTime(0, end)
  jamGain.gain.linearRampToValueAtTime(0.10, end + 0.008)
  jamGain.gain.exponentialRampToValueAtTime(0.0001, end + 0.13)
  jam.start(end)
  jam.stop(end + 0.15)
}

/** Small metal. The lighter, turned over and read. */
const metal: Voice = (mixer, at, bus) => {
  const ctx = mixer.context
  // Two struck partials, inharmonic, very short. Chrome, not a bell.
  for (const [hz, peak] of [[3100, 0.07], [4700, 0.045]] as const) {
    const voice = ctx.createOscillator()
    voice.type = 'sine'
    voice.frequency.value = hz * (0.97 + Math.random() * 0.06)
    const gain = ctx.createGain()
    voice.connect(gain).connect(bus)
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(peak, at + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11)
    voice.start(at)
    voice.stop(at + 0.13)
  }
}

/** An evidence bag. Moretti bagging the diary or the hammer. */
const bag: Voice = (mixer, at, bus) => {
  const ctx = mixer.context
  for (let i = 0; i < 5; i += 1) {
    const start = at + i * (0.05 + Math.random() * 0.07)
    const source = mixer.noiseSource()
    // Higher and thinner than paper. Polythene, not cartridge.
    const band = mixer.filter('bandpass', 4200 + Math.random() * 3000, 0.9)
    const gain = ctx.createGain()
    source.connect(band).connect(gain).connect(bus)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.055, start + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07)
    source.start(start, Math.random() * 1.5, 0.09)
    source.stop(start + 0.09)
  }
}

/** Latex over a knuckle. Miller pulling gloves on at the front door. */
const gloves: Voice = (mixer, at, bus) => {
  const ctx = mixer.context
  // Two pulls: stretch up the hand, then the wrist snap. Tuned against the
  // reference cloth() band-pass scrape so it reads as latex, not paper.
  for (let i = 0; i < 2; i += 1) {
    const start = at + i * 0.36
    const source = mixer.noiseSource()
    const band = mixer.filter('bandpass', 1600 + i * 200, 0.7)
    const gain = ctx.createGain()
    source.connect(band).connect(gain).connect(bus)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.045, start + 0.04)
    gain.gain.linearRampToValueAtTime(0.13, start + 0.14)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
    band.frequency.setValueAtTime(1200, start)
    band.frequency.linearRampToValueAtTime(2800 + i * 400, start + 0.18)
    source.start(start, Math.random(), 0.32)
    source.stop(start + 0.32)

    // Wrist snap partial.
    const tick = ctx.createOscillator()
    tick.type = 'triangle'
    tick.frequency.value = 2400 + i * 350
    const tickGain = ctx.createGain()
    tick.connect(tickGain).connect(bus)
    const snap = start + 0.16
    tickGain.gain.setValueAtTime(0, snap)
    tickGain.gain.linearRampToValueAtTime(0.035, snap + 0.004)
    tickGain.gain.exponentialRampToValueAtTime(0.0001, snap + 0.05)
    tick.start(snap)
    tick.stop(snap + 0.06)
  }
}

/** Glass on timber. The ashtray, if anything ever moves it. */
const glass: Voice = (mixer, at, bus) => {
  const ctx = mixer.context
  const voice = ctx.createOscillator()
  voice.type = 'sine'
  voice.frequency.value = 1850
  const gain = ctx.createGain()
  voice.connect(gain).connect(bus)
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(0.06, at + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
  voice.start(at)
  voice.stop(at + 0.32)
}

/**
 * Which object sounds like what. Anything not listed examines in silence, which
 * is most of the body: see the note about not scoring discoveries.
 */
const BY_OBJECT: Readonly<Record<string, Voice>> = {
  '1a.sash': sash,
  '1a.sill': paper,
  '1a.wardrobe': woodSlide,
  '1a.drawer': woodSlide,
  '1a.magazines': paper,
  '1a.note': paper,
  '1a.map': paper,
  '1a.frame': woodSlide,
  '1a.lighter': metal,
  'lodge.diary': paper,
  'lodge.ashtray': glass,
}

export class Foley {
  private readonly mixer: Mixer
  private readonly unsubscribes: Array<() => void> = []

  constructor(mixer: Mixer) {
    this.mixer = mixer

    this.unsubscribes.push(
      on('examine:start', ({ objectId }) => {
        const voice = BY_OBJECT[objectId]
        if (voice !== undefined) {
          this.play(voice)
        }
      }),
      on('tag:bagged', () => {
        this.play(bag)
      }),
      // The notebook is paper too, and it is the one bit of UI that gets to be
      // a physical object rather than a screen.
      on('casefile:open', () => {
        this.play(paper)
      }),
      on('casefile:close', () => {
        this.play(paper)
      }),
    )
  }

  /** Miller pulling his gloves on. Called by the world, not by an event. */
  glovesOn(): void {
    this.play(gloves)
  }

  dispose(): void {
    for (const off of this.unsubscribes) {
      off()
    }
    this.unsubscribes.length = 0
  }

  private play(voice: Voice): void {
    if (!this.mixer.isRunning) {
      return
    }
    voice(this.mixer, this.mixer.now + 0.01, this.mixer.bus('foley'))
  }
}
