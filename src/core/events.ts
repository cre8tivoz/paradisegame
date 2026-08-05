import type { Vector3 } from 'three'

/**
 * The event vocabulary. This mirrors CLAUDE.md exactly.
 *
 * Do not add an event here without adding it to CLAUDE.md in the same change.
 * Subsystems never reach into each other. They talk through this bus.
 */

export type Stance = 'stand' | 'crouch'

/** Foley surfaces, from ASSETS.md. */
export type Surface = 'marble' | 'carpet' | 'floorboard' | 'verandah' | 'bitumen'

export interface GameEvents {
  'scene:load': { id: string }
  'scene:complete': { id: string }
  'gate:unlocked': { gateId: string }

  'look:enter': { objectId: string }
  'look:exit': { objectId: string }
  'examine:start': { objectId: string }
  'examine:complete': { objectId: string }
  'tag:requested': { objectId: string }
  'tag:bagged': { objectId: string }

  'evidence:filed': { evidenceId: string; sourceObject: string }
  'casefile:open': Record<string, never>
  'casefile:close': Record<string, never>

  'dialogue:start': { nodeId: string; speaker: string }
  'dialogue:choice': { nodeId: string; optionId: string }
  'dialogue:end': { nodeId: string }

  'player:footstep': { position: Vector3; surface: Surface; speed: number }
  'player:state': { stance: Stance }
}

export type EventName = keyof GameEvents

type Handler<K extends EventName> = (payload: GameEvents[K]) => void

/**
 * `never` is the bottom type, so every `Handler<K>` is assignable to this
 * without a cast. Going the other way needs one, and it is contained to `emit`.
 */
type StoredHandler = (payload: never) => void

const handlers = new Map<EventName, Set<StoredHandler>>()

/** Subscribe. Returns an unsubscribe function. */
export function on<K extends EventName>(type: K, handler: Handler<K>): () => void {
  const existing = handlers.get(type)
  const set = existing ?? new Set<StoredHandler>()
  if (existing === undefined) {
    handlers.set(type, set)
  }
  set.add(handler)
  return () => {
    set.delete(handler)
  }
}

export function emit<K extends EventName>(type: K, payload: GameEvents[K]): void {
  const set = handlers.get(type)
  if (set === undefined) {
    return
  }
  // Copy first. A handler that unsubscribes itself must not upset the walk.
  for (const handler of [...set]) {
    const typed = handler as Handler<K>
    typed(payload)
  }
}

/** Test and teardown only. */
export function clearAll(): void {
  handlers.clear()
}
