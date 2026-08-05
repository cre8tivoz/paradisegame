/**
 * The mixer. One AudioContext, three buses, and nothing else touches the
 * hardware.
 *
 * ASSETS.md: "Web Audio. Synthesise or source royalty-free." Everything in this
 * directory is synthesised, which is not a shortcut. A 1994 lodging house is
 * room tone, traffic two streets off and the building settling, and that is
 * filtered noise and a few detuned oscillators. Sampled foley would also mean
 * shipping a megabyte of wavs to say "footstep on carpet".
 *
 * ## It cannot start itself
 *
 * Browsers refuse to run an AudioContext until the user has interacted with the
 * page, and they do it silently: the context exists, it is `suspended`, and
 * every sound you schedule is thrown away. So the mixer is created up front and
 * `resume()` is called from the same click that asks for pointer lock. Anything
 * that plays before that is dropped on purpose rather than by accident.
 */

export type BusName = 'ambience' | 'foley' | 'music'

/** Bus trims, so the whole mix can be balanced in one place. */
const BUS_GAIN: Readonly<Record<BusName, number>> = {
  ambience: 0.5,
  foley: 0.85,
  /*
   * ASSETS.md: "Almost none. A single sustained low tone in room 1A that you
   * cannot quite identify as music." If you can identify it, this is too high.
   */
  music: 0.16,
}

export class Mixer {
  private readonly ctx: AudioContext
  private readonly master: GainNode
  private readonly buses = new Map<BusName, GainNode>()
  /** Shared, because every noise source in here wants the same two seconds. */
  private noise: AudioBuffer | undefined = undefined

  constructor() {
    this.ctx = new AudioContext()

    this.master = this.ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(this.ctx.destination)

    for (const name of ['ambience', 'foley', 'music'] as const) {
      const bus = this.ctx.createGain()
      bus.gain.value = BUS_GAIN[name]
      bus.connect(this.master)
      this.buses.set(name, bus)
    }
  }

  get context(): AudioContext {
    return this.ctx
  }

  get now(): number {
    return this.ctx.currentTime
  }

  get isRunning(): boolean {
    return this.ctx.state === 'running'
  }

  /** Call from a real user gesture. Safe to call repeatedly. */
  resume(): void {
    if (this.ctx.state === 'running') {
      return
    }
    void this.ctx.resume()
  }

  bus(name: BusName): GainNode {
    const found = this.buses.get(name)
    if (found === undefined) {
      throw new Error(`No audio bus "${name}"`)
    }
    return found
  }

  /**
   * Two seconds of white noise, generated once and looped by everything that
   * needs a hiss. Footsteps window a few milliseconds out of it; ambience beds
   * loop the whole thing under a filter.
   */
  noiseBuffer(): AudioBuffer {
    if (this.noise !== undefined) {
      return this.noise
    }
    const length = Math.floor(this.ctx.sampleRate * 2)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1
    }
    this.noise = buffer
    return buffer
  }

  /** A looping noise source. Caller connects and starts it. */
  noiseSource(): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer()
    source.loop = true
    return source
  }

  gain(value: number): GainNode {
    const node = this.ctx.createGain()
    node.gain.value = value
    return node
  }

  filter(type: BiquadFilterType, frequency: number, q = 1): BiquadFilterNode {
    const node = this.ctx.createBiquadFilter()
    node.type = type
    node.frequency.value = frequency
    node.Q.value = q
    return node
  }

  /**
   * Ramp a gain toward a value over `seconds`.
   *
   * `setTargetAtTime` rather than a linear ramp: crossfading ambience beds with
   * linear ramps means every zone change has an audible corner in it, and
   * cancelling a ramp that is already running to start another one clicks.
   */
  fade(param: AudioParam, to: number, seconds: number): void {
    param.setTargetAtTime(to, this.ctx.currentTime, Math.max(seconds, 0.01) / 3)
  }

  dispose(): void {
    void this.ctx.close()
  }
}
