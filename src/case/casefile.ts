import { emit } from '../core/events.ts'
import { SCENE1_EVIDENCE, getEvidence } from './evidence.ts'
import type { EvidenceDef } from './evidence.ts'

/**
 * The case file. Holds knowledge, not objects. Miller examines, Moretti bags.
 * What lands here is what Miller has written down.
 *
 * Filing is idempotent. Examining the same thing twice does not duplicate it
 * and does not re-emit.
 */
export class CaseFile {
  private readonly filed = new Map<string, string>()

  /** Whether this evidence ID is already in the file. */
  has(evidenceId: string): boolean {
    return this.filed.has(evidenceId)
  }

  /**
   * File evidence from an examined object. Returns the definition if this was
   * the first time, otherwise undefined.
   */
  file(evidenceId: string, sourceObject: string): EvidenceDef | undefined {
    if (this.filed.has(evidenceId)) {
      return undefined
    }
    const def = getEvidence(evidenceId)
    if (def === undefined) {
      console.warn(`Unknown evidence id "${evidenceId}" from ${sourceObject}`)
      return undefined
    }
    this.filed.set(evidenceId, sourceObject)
    emit('evidence:filed', { evidenceId, sourceObject })
    return def
  }

  /** Filed entries, catalogue order. */
  list(): EvidenceDef[] {
    const out: EvidenceDef[] = []
    for (const def of SCENE1_EVIDENCE) {
      if (this.filed.has(def.id)) {
        out.push(def)
      }
    }
    return out
  }

  get size(): number {
    return this.filed.size
  }

  /** Filed evidence IDs, catalogue order. For the scene-boundary save. */
  listIds(): string[] {
    return this.list().map((def) => def.id)
  }

  clear(): void {
    this.filed.clear()
  }
}
