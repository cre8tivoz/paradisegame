/**
 * Save data written on a scene boundary.
 *
 * Only what the next boot needs: which scenes are finished, which evidence is
 * filed, and which scene would load if more than one existed. Scene 2 is not
 * built yet, so a completed scene 1 still boots into scene 1's world — the
 * save is the boundary record, not a teleporter.
 */

export type SceneId = 'scene1'

export interface SaveData {
  readonly version: 1
  readonly current: SceneId
  readonly completed: readonly SceneId[]
  readonly evidence: readonly string[]
}

const KEY = 'paradise-lodge.save'
const VERSION = 1 as const

export class Save {
  read(): SaveData | undefined {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw === null) {
        return undefined
      }
      const parsed: unknown = JSON.parse(raw)
      if (!isSaveData(parsed)) {
        return undefined
      }
      return parsed
    } catch {
      return undefined
    }
  }

  write(data: SaveData): void {
    localStorage.setItem(KEY, JSON.stringify(data))
  }

  /** Mark a scene finished and persist the current case file. */
  completeScene(id: SceneId, evidenceIds: readonly string[]): SaveData {
    const existing = this.read()
    const completed = new Set<SceneId>(existing?.completed ?? [])
    completed.add(id)
    const data: SaveData = {
      version: VERSION,
      current: id,
      completed: [...completed],
      evidence: [...evidenceIds],
    }
    this.write(data)
    return data
  }

  clear(): void {
    localStorage.removeItem(KEY)
  }
}

function isSaveData(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const v = value as Record<string, unknown>
  if (v.version !== 1 || v.current !== 'scene1') {
    return false
  }
  if (!Array.isArray(v.completed) || !Array.isArray(v.evidence)) {
    return false
  }
  return v.completed.every((id) => id === 'scene1') && v.evidence.every((id) => typeof id === 'string')
}
