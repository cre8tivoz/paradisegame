import { Vector3 } from 'three'
import type { Mixer } from './mixer.ts'

/**
 * Ambience beds, one per zone, all four running at once and crossfaded by where
 * Miller is standing.
 *
 * ASSETS.md asks for four things in scene 1:
 *
 * - **Street:** traffic on Fitzroy Street, a tram two blocks off, gulls
 * - **Lodge interior:** the building settling, a clock, a radio in another room,
 *   "silence with weight"
 * - **Room 1A:** almost nothing. Distant traffic through the open sash. Flies
 * - and the yard, which it does not list, so it gets the street bed pushed back
 *   behind a fence
 *
 * Every bed is filtered noise plus a couple of slow modulators. Nothing is
 * sampled and nothing loops audibly, because a two second loop under a quiet
 * room is the most obvious sound in the mix.
 *
 * **The 1A bed is the one that has to be nearly empty.** BRIEF.md's whole claim
 * for that room is that it is beautiful and that everything in it happened in
 * the dark. Filling it with atmosphere argues with the light.
 */

export type Zone = 'street' | 'lodge' | 'room1a' | 'yard'

/**
 * Which zone a point is in.
 *
 * Kept in step with lodge.ts by hand, same as the gate box: the building runs
 * x -6.5 to 6.4 and z 0 to 10.5, the ground floor is y 0 and the first floor
 * 3.45. The verandah hangs off +X above 3.45 and is deliberately lumped in with
 * the yard, because it is outdoors and it looks at the same street.
 */
export function zoneAt(p: Vector3): Zone {
  const inside = p.x > -6.5 && p.x < 6.4 && p.z > -0.1 && p.z < 10.5
  if (inside) {
    // Room 1A sits on the first floor in the +X half, toward the street.
    if (p.y > 3.0 && p.x > 1.9 && p.z < 5.0) {
      return 'room1a'
    }
    return 'lodge'
  }
  return p.z < -0.1 ? 'street' : 'yard'
}

const FADE = 1.6

interface Bed {
  readonly gain: GainNode
  readonly voices: AudioScheduledSourceNode[]
}

export class Ambience {
  private readonly mixer: Mixer
  private readonly beds = new Map<Zone, Bed>()
  private readonly tone: GainNode
  private readonly toneVoices: OscillatorNode[] = []
  private current: Zone | undefined = undefined
  private started = false

  constructor(mixer: Mixer) {
    this.mixer = mixer
    this.beds.set('street', this.buildStreet())
    this.beds.set('lodge', this.buildLodge())
    this.beds.set('room1a', this.buildRoom1A())
    this.beds.set('yard', this.buildYard())
    this.tone = this.buildTone()
  }

  /** Call once the context is running. Safe to call repeatedly. */
  start(): void {
    if (this.started || !this.mixer.isRunning) {
      return
    }
    this.started = true
    const t = this.mixer.now
    for (const bed of this.beds.values()) {
      for (const voice of bed.voices) {
        voice.start(t)
      }
    }
    for (const voice of this.toneVoices) {
      voice.start(t)
    }
  }

  /** Crossfade to whatever zone Miller is in. Cheap enough to call per frame. */
  update(playerFeet: Vector3): void {
    if (!this.started) {
      return
    }
    const zone = zoneAt(playerFeet)
    if (zone === this.current) {
      return
    }
    this.current = zone
    for (const [name, bed] of this.beds) {
      this.mixer.fade(bed.gain.gain, name === zone ? 1 : 0, FADE)
    }
    // The tone belongs to the room and nowhere else.
    this.mixer.fade(this.tone.gain, zone === 'room1a' ? 1 : 0, zone === 'room1a' ? 4.5 : 2.0)
  }

  /** A bed at zero gain, wired to the ambience bus and ready to be faded up. */
  private bed(): { gain: GainNode; voices: AudioScheduledSourceNode[] } {
    const gain = this.mixer.gain(0)
    gain.connect(this.mixer.bus('ambience'))
    return { gain, voices: [] }
  }

  /**
   * Fitzroy Street. Traffic is low noise with a slow swell in it, the tram is a
   * band of rumble two blocks off, and the gulls are occasional.
   */
  private buildStreet(): Bed {
    const ctx = this.mixer.context
    const { gain, voices } = this.bed()

    const traffic = this.mixer.noiseSource()
    const trafficFilter = this.mixer.filter('lowpass', 420, 0.7)
    const trafficGain = this.mixer.gain(0.5)
    traffic.connect(trafficFilter).connect(trafficGain).connect(gain)
    voices.push(traffic)

    // The swell. A car passing is a slow rise and fall in the low band, and one
    // very slow LFO on the filter does the work of a dozen scheduled samples.
    const swell = ctx.createOscillator()
    swell.type = 'sine'
    swell.frequency.value = 0.06
    const swellDepth = this.mixer.gain(210)
    swell.connect(swellDepth).connect(trafficFilter.frequency)
    voices.push(swell)

    // Tram, two blocks off. Narrow and low, so it reads as distance.
    const tram = this.mixer.noiseSource()
    const tramBand = this.mixer.filter('bandpass', 88, 3.5)
    const tramGain = this.mixer.gain(0.0)
    tram.connect(tramBand).connect(tramGain).connect(gain)
    voices.push(tram)
    // It comes and goes rather than idling under everything.
    const tramLfo = ctx.createOscillator()
    tramLfo.type = 'sine'
    tramLfo.frequency.value = 0.021
    const tramDepth = this.mixer.gain(0.16)
    tramLfo.connect(tramDepth).connect(tramGain.gain)
    voices.push(tramLfo)

    // Air. Keeps the top of the mix from being a hole.
    const air = this.mixer.noiseSource()
    const airFilter = this.mixer.filter('highpass', 2200, 0.5)
    const airGain = this.mixer.gain(0.02)
    air.connect(airFilter).connect(airGain).connect(gain)
    voices.push(air)

    return { gain, voices }
  }

  /**
   * The lodge. ASSETS.md's "silence with weight", which is not silence: it is a
   * very low bed you stop hearing, a clock, and a radio through a wall.
   */
  private buildLodge(): Bed {
    const ctx = this.mixer.context
    const { gain, voices } = this.bed()

    // Room tone. Almost all below where you can point at it.
    const room = this.mixer.noiseSource()
    const roomFilter = this.mixer.filter('lowpass', 190, 0.6)
    const roomGain = this.mixer.gain(0.42)
    room.connect(roomFilter).connect(roomGain).connect(gain)
    voices.push(room)

    // Traffic, but through a wall and a shut window.
    const muffled = this.mixer.noiseSource()
    const muffledFilter = this.mixer.filter('lowpass', 260, 0.8)
    const muffledGain = this.mixer.gain(0.12)
    muffled.connect(muffledFilter).connect(muffledGain).connect(gain)
    voices.push(muffled)

    /*
     * A radio in another room. Two detuned oscillators through a narrow band is
     * not music and is not meant to be: through a wall all you get is a
     * bandwidth and a wobble, and anything more specific would be a second
     * thing to notice in a scene that already has one.
     */
    const radioBand = this.mixer.filter('bandpass', 900, 4)
    const radioGain = this.mixer.gain(0.035)
    radioBand.connect(radioGain).connect(gain)
    for (const hz of [196, 293.7]) {
      const voice = ctx.createOscillator()
      voice.type = 'sawtooth'
      voice.frequency.value = hz
      const trim = this.mixer.gain(0.5)
      voice.connect(trim).connect(radioBand)
      voices.push(voice)
    }
    const wobble = ctx.createOscillator()
    wobble.type = 'sine'
    wobble.frequency.value = 0.11
    const wobbleDepth = this.mixer.gain(320)
    wobble.connect(wobbleDepth).connect(radioBand.frequency)
    voices.push(wobble)

    // The clock. One tick a second, and it is the only thing in the bed with a
    // hard edge on it, which is what makes the rest read as still.
    const tick = ctx.createOscillator()
    tick.type = 'square'
    tick.frequency.value = 1
    const tickShape = this.mixer.filter('bandpass', 2400, 12)
    const tickGain = this.mixer.gain(0.012)
    tick.connect(tickShape).connect(tickGain).connect(gain)
    voices.push(tick)

    return { gain, voices }
  }

  /**
   * Room 1A. Nearly nothing, on purpose.
   *
   * Distant traffic through the open sash, and flies. The flies are the only
   * thing in scene 1's audio that says what has happened in here, and they are
   * quiet enough that a player can miss them.
   */
  private buildRoom1A(): Bed {
    const ctx = this.mixer.context
    const { gain, voices } = this.bed()

    const throughSash = this.mixer.noiseSource()
    const sashFilter = this.mixer.filter('bandpass', 340, 0.9)
    const sashGain = this.mixer.gain(0.16)
    throughSash.connect(sashFilter).connect(sashGain).connect(gain)
    voices.push(throughSash)

    // Flies. A buzz is a saw a long way off pitch, and the wander is what stops
    // it reading as a tone.
    const fly = ctx.createOscillator()
    fly.type = 'sawtooth'
    fly.frequency.value = 148
    const flyBand = this.mixer.filter('bandpass', 1500, 7)
    const flyGain = this.mixer.gain(0.0)
    fly.connect(flyBand).connect(flyGain).connect(gain)
    voices.push(fly)

    const wander = ctx.createOscillator()
    wander.type = 'triangle'
    wander.frequency.value = 3.1
    const wanderDepth = this.mixer.gain(26)
    wander.connect(wanderDepth).connect(fly.frequency)
    voices.push(wander)

    // They come near and go away again. Slow, and it never quite reaches zero.
    const near = ctx.createOscillator()
    near.type = 'sine'
    near.frequency.value = 0.043
    const nearDepth = this.mixer.gain(0.022)
    near.connect(nearDepth).connect(flyGain.gain)
    voices.push(near)
    flyGain.gain.value = 0.024

    return { gain, voices }
  }

  /** The yard. The street, over a paling fence, plus something in the grass. */
  private buildYard(): Bed {
    const ctx = this.mixer.context
    const { gain, voices } = this.bed()

    const overFence = this.mixer.noiseSource()
    const fenceFilter = this.mixer.filter('lowpass', 520, 0.7)
    const fenceGain = this.mixer.gain(0.3)
    overFence.connect(fenceFilter).connect(fenceGain).connect(gain)
    voices.push(overFence)

    // End of February, so it is dry and there are insects in it.
    const insects = this.mixer.noiseSource()
    const insectBand = this.mixer.filter('bandpass', 4200, 9)
    const insectGain = this.mixer.gain(0.03)
    insects.connect(insectBand).connect(insectGain).connect(gain)
    voices.push(insects)

    const pulse = ctx.createOscillator()
    pulse.type = 'sine'
    pulse.frequency.value = 6.2
    const pulseDepth = this.mixer.gain(0.02)
    pulse.connect(pulseDepth).connect(insectGain.gain)
    voices.push(pulse)

    return { gain, voices }
  }

  /**
   * ASSETS.md: "A single sustained low tone in room 1A that you cannot quite
   * identify as music."
   *
   * Three oscillators a few cents apart on a low D, so it beats slowly and never
   * settles into a pitch you can name. It lives on the music bus, which is
   * trimmed low enough that it reads as the building rather than as a cue.
   *
   * **It is not a discovery sting.** ASSETS.md is explicit: never score the
   * discoveries. This fades in with the room and does not react to anything.
   */
  private buildTone(): GainNode {
    const ctx = this.mixer.context
    const out = this.mixer.gain(0)
    out.connect(this.mixer.bus('music'))

    const soften = this.mixer.filter('lowpass', 300, 0.7)
    soften.connect(out)

    for (const hz of [73.4, 73.9, 110.2]) {
      const voice = ctx.createOscillator()
      voice.type = 'sine'
      voice.frequency.value = hz
      const trim = this.mixer.gain(hz > 100 ? 0.22 : 0.5)
      voice.connect(trim).connect(soften)
      this.toneVoices.push(voice)
    }
    return out
  }
}
