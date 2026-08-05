import type { Vector3 } from 'three'
import { Ambience } from './ambience.ts'
import { Footsteps } from './footsteps.ts'
import { Foley } from './foley.ts'
import { Mixer } from './mixer.ts'

/**
 * The audio subsystem, as one thing for `main.ts` to hold.
 *
 * Everything under `src/audio/` is synthesised through Web Audio and no sound
 * file ships. That is what ASSETS.md asks for, and it also means the whole of
 * scene 1's sound is a few hundred lines with no download and no loading state.
 *
 * Footsteps and foley subscribe to the bus themselves. Ambience is the only part
 * that needs telling anything, because where Miller is standing is not an event.
 */
export class Audio {
  /**
   * Public so the dev handle can tap a bus and measure it. `main.ts` never
   * touches it: it calls `unlock` and `update` and nothing else.
   */
  readonly mixer: Mixer
  private readonly ambience: Ambience
  private readonly footsteps: Footsteps
  readonly foley: Foley

  constructor() {
    this.mixer = new Mixer()
    this.ambience = new Ambience(this.mixer)
    this.footsteps = new Footsteps(this.mixer)
    this.foley = new Foley(this.mixer)
  }

  /**
   * Wire this to the same click that asks for pointer lock.
   *
   * A browser will not run an AudioContext until the user has interacted, and it
   * fails quietly: the context is `suspended`, everything scheduled is
   * discarded, and there is no error anywhere. Starting the beds only after the
   * context is actually running is what makes that a non-issue rather than an
   * intermittent silence.
   */
  unlock(): void {
    this.mixer.resume()
    // resume() is a promise, so the context is usually not running yet on this
    // line. Ambience.start is a no-op until it is, and update() retries.
    this.ambience.start()
  }

  update(playerFeet: Vector3): void {
    this.ambience.start()
    this.ambience.update(playerFeet)
  }

  dispose(): void {
    this.footsteps.dispose()
    this.foley.dispose()
    this.mixer.dispose()
  }
}
