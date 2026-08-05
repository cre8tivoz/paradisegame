import { LOOP } from './config.ts'

export type Tick = (delta: number, elapsed: number) => void

/**
 * The engine loop. One rAF, clamped delta, no fixed-step accumulator.
 *
 * There is no physics engine in this game, so nothing here needs a fixed step.
 * Movement is smoothed exponentially and is stable at any frame rate.
 */
export class Loop {
  private readonly tick: Tick
  private handle = 0
  private last = 0
  private elapsed = 0
  private running = false

  constructor(tick: Tick) {
    this.tick = tick
  }

  start(): void {
    if (this.running) {
      return
    }
    this.running = true
    this.last = performance.now()
    this.handle = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.handle)
  }

  private readonly frame = (now: number): void => {
    if (!this.running) {
      return
    }
    const delta = Math.min((now - this.last) / 1000, LOOP.maxDelta)
    this.last = now
    this.elapsed += delta
    this.tick(delta, this.elapsed)
    this.handle = requestAnimationFrame(this.frame)
  }
}

/**
 * Frame-rate independent exponential approach. `response` is roughly "how many
 * times per second the remaining gap is mostly closed".
 */
export function approach(current: number, target: number, response: number, delta: number): number {
  const t = 1 - Math.exp(-response * delta)
  return current + (target - current) * t
}
