import { Box3, Vector3 } from 'three'
import { emit, on } from '../core/events.ts'
import type { CaseFile } from './casefile.ts'

/**
 * Objective gates for scene 1, from BRIEF.md's table.
 *
 * ## They are not locks
 *
 * Nothing here refuses the player anything. BRIEF.md is explicit that there are
 * no fail states and that the player "can only be slow", and it puts the
 * ordering in the geometry rather than in code: the yard is only reachable down
 * the verandah stairs, so gate 4 happens before gate 7 because it has to, not
 * because a flag says so.
 *
 * What the gates are for is knowing when the scene is finished, which is the one
 * thing the world cannot tell you by its shape. Every gate is evaluated
 * independently, in table order, and the only consequence of the set being
 * complete is that Moretti has something to say.
 *
 * ## And they are not a quest log
 *
 * CLAUDE.md: no map, no quest marker. None of this is displayed. The player
 * finds out where they are by asking Moretti, which is what an offsider is for.
 *
 * ## Every gate has to be reachable without knowing it exists
 *
 * The trap here is a gate that hangs off something optional. Gate 5 used to
 * need Rosie's 2am answer, which was one branch of a conversation the player
 * could finish without ever picking it, and that turns a gate into a fail state
 * for anybody who asked her something else. The bang is now the first thing she
 * says in the parlour, unprompted, so hearing it is unavoidable.
 */

export interface GateDef {
  readonly id: string
  /** BRIEF.md's number, so the table and the code can be read against each other. */
  readonly n: number
  readonly space: string
  readonly beat: string
  readonly isMet: (facts: GateFacts) => boolean
}

/** What the tracker knows. Read-only to the conditions. */
export interface GateFacts {
  filed(evidenceId: string): boolean
  bagged(objectId: string): boolean
  /** Has the look line ever been on this object? */
  seen(objectId: string): boolean
  /** Has a conversation ever opened on this node? */
  heard(nodeId: string): boolean
  insideLodge: boolean
}

/**
 * The ground floor, inside the walls. Gate 0 is the approach being over, and
 * every route to the staircase crosses this, so it cannot be missed.
 *
 * Kept in step with lodge.ts by hand: the hall runs x -1.75 to 1.75 and the
 * ground floor sits at y 0. Widen the building and widen this.
 */
const HALL = new Box3(new Vector3(-1.75, -0.2, 0.0), new Vector3(1.75, 0.4, 5.2))

export const SCENE1_GATES: readonly GateDef[] = [
  {
    id: 'entry',
    n: 0,
    space: 'Street, entry',
    beat: 'Cold open. Rosie at reception',
    isMet: (f) => f.insideLodge,
  },
  {
    id: 'body',
    n: 1,
    space: '1A, body',
    beat: 'Needle, then the temple. Cause of death',
    isMet: (f) => f.filed('needle') && f.filed('temple'),
  },
  {
    id: 'room',
    n: 2,
    space: '1A, room',
    beat: 'Sling, frame, sill',
    isMet: (f) => f.filed('sling') && f.filed('frame') && f.filed('sill'),
  },
  {
    id: 'lighter',
    n: 3,
    space: '1A, room',
    beat: 'Lighter',
    isMet: (f) => f.filed('lighter'),
  },
  {
    id: 'stairs',
    n: 4,
    space: 'Verandah',
    beat: 'Miller clocks the stairs down to the yard',
    // Look, not examine. BRIEF.md says he clocks them, and clocking something
    // is exactly what the look line is for. They carry no evidence.
    isMet: (f) => f.seen('verandah.stairs'),
  },
  {
    id: 'rosie',
    n: 5,
    space: 'Parlour',
    beat: 'Rosie. The 2am bang',
    // Her opening line in the parlour, so it cannot be talked around.
    isMet: (f) => f.heard('bang'),
  },
  {
    id: 'diary',
    n: 6,
    space: 'Parlour',
    beat: 'Diary. Tag',
    isMet: (f) => f.bagged('lodge.diary'),
  },
  {
    id: 'hammer',
    n: 7,
    space: 'Yard',
    beat: 'Hammer. Tag',
    isMet: (f) => f.bagged('yard.hammer'),
  },
]

export class GateTracker {
  private readonly caseFile: CaseFile
  private readonly unlockedIds = new Set<string>()
  private readonly baggedIds = new Set<string>()
  private readonly seenIds = new Set<string>()
  private readonly heardIds = new Set<string>()
  private readonly unsubscribes: Array<() => void> = []
  private insideLodge = false

  /** Fired once per gate, as it opens. The bus carries it too. */
  onUnlocked: ((gateId: string) => void) | undefined = undefined

  constructor(caseFile: CaseFile) {
    this.caseFile = caseFile

    // Everything a gate can hang off arrives on the bus, so the tracker
    // subscribes rather than being poked by main.ts. The one exception is where
    // Miller is standing, which is not an event and never should be.
    this.unsubscribes.push(
      on('evidence:filed', () => {
        this.evaluate()
      }),
      on('tag:bagged', ({ objectId }) => {
        this.baggedIds.add(objectId)
        this.evaluate()
      }),
      on('look:enter', ({ objectId }) => {
        this.seenIds.add(objectId)
        this.evaluate()
      }),
      on('dialogue:start', ({ nodeId }) => {
        this.heardIds.add(nodeId)
        this.evaluate()
      }),
    )
  }

  get unlocked(): ReadonlySet<string> {
    return this.unlockedIds
  }

  has(gateId: string): boolean {
    return this.unlockedIds.has(gateId)
  }

  isBagged(objectId: string): boolean {
    return this.baggedIds.has(objectId)
  }

  get allUnlocked(): boolean {
    return SCENE1_GATES.every((gate) => this.unlockedIds.has(gate.id))
  }

  /** Gates that are still shut, in table order. */
  get outstanding(): GateDef[] {
    return SCENE1_GATES.filter((gate) => !this.unlockedIds.has(gate.id))
  }

  /** Position is the only fact that is not an event. Call once a frame. */
  update(playerFeet: Vector3): void {
    if (this.insideLodge || !HALL.containsPoint(playerFeet)) {
      return
    }
    this.insideLodge = true
    this.evaluate()
  }

  dispose(): void {
    for (const off of this.unsubscribes) {
      off()
    }
    this.unsubscribes.length = 0
  }

  private evaluate(): void {
    const facts: GateFacts = {
      filed: (id) => this.caseFile.has(id),
      bagged: (id) => this.baggedIds.has(id),
      seen: (id) => this.seenIds.has(id),
      heard: (id) => this.heardIds.has(id),
      insideLodge: this.insideLodge,
    }

    for (const gate of SCENE1_GATES) {
      if (this.unlockedIds.has(gate.id) || !gate.isMet(facts)) {
        continue
      }
      this.unlockedIds.add(gate.id)
      emit('gate:unlocked', { gateId: gate.id })
      this.onUnlocked?.(gate.id)
    }
  }
}
