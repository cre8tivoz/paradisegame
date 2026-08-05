import { on } from '../core/events.ts'
import type { Surface } from '../core/events.ts'
import type { Mixer } from './mixer.ts'

/**
 * Footsteps. One synthesised step per `player:footstep`.
 *
 * A step is two things happening at once: the scuff, which is a few
 * milliseconds of noise shaped by whatever is underfoot, and the weight, which
 * is a low thump that barely changes between surfaces because it is Miller and
 * not the floor. Building them separately is what lets carpet and marble sound
 * like the same man on different floors rather than two different men.
 *
 * The controller already tells us the surface and the speed, so nothing here
 * needs to know where he is. `speed` is what separates a walk from a run: no new
 * event was added for running and none is needed.
 */

interface StepVoice {
  /** Centre of the scuff. Hard floors are bright, soft ones are not. */
  readonly scuffHz: number
  readonly scuffQ: number
  /** How long the scuff rings. Marble ticks, carpet does not. */
  readonly scuffDecay: number
  readonly scuffGain: number
  /** The body. Low, short, near enough the same everywhere. */
  readonly thumpHz: number
  readonly thumpGain: number
  /** Chance a step also creaks. Timber only. */
  readonly creak: number
}

const VOICES: Readonly<Record<Surface, StepVoice>> = {
  // Worn hollow and hard. The only surface in the game with a tail on it.
  marble: { scuffHz: 2600, scuffQ: 1.4, scuffDecay: 0.085, scuffGain: 0.30, thumpHz: 92, thumpGain: 0.22, creak: 0 },
  // Worn through to the backing on the treads, so it is soft but not silent.
  carpet: { scuffHz: 520, scuffQ: 0.7, scuffDecay: 0.10, scuffGain: 0.16, thumpHz: 68, thumpGain: 0.26, creak: 0 },
  floorboard: { scuffHz: 900, scuffQ: 2.0, scuffDecay: 0.09, scuffGain: 0.24, thumpHz: 78, thumpGain: 0.25, creak: 0.22 },
  // Loose boards over a void, so it is hollower and it creaks more.
  verandah: { scuffHz: 700, scuffQ: 2.6, scuffDecay: 0.13, scuffGain: 0.26, thumpHz: 62, thumpGain: 0.28, creak: 0.42 },
  // Dry grit, no ring at all.
  bitumen: { scuffHz: 1500, scuffQ: 0.6, scuffDecay: 0.055, scuffGain: 0.22, thumpHz: 84, thumpGain: 0.18, creak: 0 },
}

/** Walk speed from config. Above this a step is a run and hits harder. */
const WALK_REFERENCE = 2.2

export class Footsteps {
  private readonly mixer: Mixer
  private readonly off: () => void
  /** Alternated per step, so left and right are not identical. */
  private parity = false

  constructor(mixer: Mixer) {
    this.mixer = mixer
    this.off = on('player:footstep', ({ surface, speed }) => {
      this.step(surface, speed)
    })
  }

  dispose(): void {
    this.off()
  }

  private step(surface: Surface, speed: number): void {
    if (!this.mixer.isRunning) {
      return
    }
    const voice = VOICES[surface]
    const ctx = this.mixer.context
    const bus = this.mixer.bus('foley')
    const t = this.mixer.now

    this.parity = !this.parity
    // A real pair of shoes is never two identical sounds, and a fixed offset
    // reads as a flanger. Small random detune plus a left/right bias.
    const tilt = this.parity ? 1.06 : 0.94
    const jitter = 0.9 + Math.random() * 0.2
    const push = Math.min(speed / WALK_REFERENCE, 2.1)

    // --- The scuff ---
    const scuff = this.mixer.noiseSource()
    const band = this.mixer.filter('bandpass', voice.scuffHz * tilt * jitter, voice.scuffQ)
    const scuffGain = ctx.createGain()
    scuff.connect(band).connect(scuffGain).connect(bus)

    scuffGain.gain.setValueAtTime(0, t)
    scuffGain.gain.linearRampToValueAtTime(voice.scuffGain * push, t + 0.004)
    scuffGain.gain.exponentialRampToValueAtTime(0.0001, t + voice.scuffDecay)
    // Random offset into the shared noise buffer, or every step is the same
    // few milliseconds of hiss and the ear picks that up immediately.
    scuff.start(t, Math.random() * 1.5, voice.scuffDecay + 0.02)
    scuff.stop(t + voice.scuffDecay + 0.03)

    // --- The weight ---
    const thump = ctx.createOscillator()
    thump.type = 'sine'
    const thumpGain = ctx.createGain()
    thump.connect(thumpGain).connect(bus)
    thump.frequency.setValueAtTime(voice.thumpHz * 1.5, t)
    thump.frequency.exponentialRampToValueAtTime(voice.thumpHz * 0.7, t + 0.07)
    thumpGain.gain.setValueAtTime(0, t)
    thumpGain.gain.linearRampToValueAtTime(voice.thumpGain * push, t + 0.006)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.10)
    thump.start(t)
    thump.stop(t + 0.12)

    // --- The creak ---
    // Only some steps, and it lands just after the weight rather than with it,
    // because a board gives way under load and not on contact.
    if (voice.creak > 0 && Math.random() < voice.creak) {
      const at = t + 0.03 + Math.random() * 0.04
      const creak = ctx.createOscillator()
      creak.type = 'triangle'
      const creakGain = ctx.createGain()
      const creakBand = this.mixer.filter('bandpass', 420 * jitter, 6)
      creak.connect(creakBand).connect(creakGain).connect(bus)
      const base = 160 + Math.random() * 120
      creak.frequency.setValueAtTime(base, at)
      creak.frequency.linearRampToValueAtTime(base * 1.35, at + 0.14)
      creakGain.gain.setValueAtTime(0, at)
      creakGain.gain.linearRampToValueAtTime(0.06, at + 0.03)
      creakGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
      creak.start(at)
      creak.stop(at + 0.2)
    }
  }
}
