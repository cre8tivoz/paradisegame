import { emit, on } from './events.ts'
import { Save } from './save.ts'
import type { SceneId } from './save.ts'

/**
 * Scene manager. Owns the fade and the save written on a scene boundary.
 *
 * Step 14. The exit fade used to live in main.ts as scaffolding; this is what
 * owns it. Scene 2 is not built, so completing scene 1 blacks out, saves, and
 * holds. No title card — ASSETS.md allows two in the whole game and neither is
 * here.
 */

export interface SceneEvidenceSource {
  /** Evidence IDs currently filed, catalogue order. */
  listIds(): readonly string[]
}

export class SceneManager {
  private readonly save = new Save()
  private readonly fade: HTMLDivElement
  private readonly evidence: SceneEvidenceSource
  private current: SceneId = 'scene1'
  private completed = false
  private readonly unsub: () => void

  constructor(hudRoot: HTMLElement, evidence: SceneEvidenceSource) {
    this.evidence = evidence

    this.fade = document.createElement('div')
    this.fade.className = 'scene-fade'
    hudRoot.appendChild(this.fade)

    const stored = this.save.read()
    if (stored !== undefined) {
      this.current = stored.current
    }

    this.unsub = on('scene:complete', ({ id }) => {
      this.onComplete(id)
    })
  }

  get currentId(): SceneId {
    return this.current
  }

  get isComplete(): boolean {
    return this.completed
  }

  /** Prior save, if any. Boot still loads scene 1 until scene 2 exists. */
  get stored(): ReturnType<Save['read']> {
    return this.save.read()
  }

  /** Emit load for the active scene. Call once the world is up. */
  start(): void {
    emit('scene:load', { id: this.current })
  }

  private onComplete(id: string): void {
    if (this.completed || id !== this.current) {
      return
    }
    this.completed = true
    this.save.completeScene(this.current, this.evidence.listIds())
    this.fade.classList.add('is-out')
  }

  dispose(): void {
    this.unsub()
    this.fade.remove()
  }
}
