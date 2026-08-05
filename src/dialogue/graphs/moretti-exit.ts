import type { DialogueGraph } from '../graph.ts'

/**
 * Moretti, talked to rather than tagged at. Two graphs, and which one he has
 * depends on whether the gates are all open.
 *
 * He is the whole objective display. CLAUDE.md forbids a map and a quest
 * marker, and a checklist in the notebook would be the same thing wearing a
 * different hat, so the way the player finds out where they are is by turning
 * round and asking the constable. That is what an offsider is for.
 *
 * `MORETTI_STANDBY` is deliberately not a list. He does not say which room is
 * unfinished and he does not count anything off, because either of those turns
 * the scene into errands. He says he will wait, which is true and is also the
 * only thing he actually knows.
 */
export const MORETTI_STANDBY: DialogueGraph = {
  id: 'moretti.standby',
  start: 'wait',
  nodes: {
    wait: {
      id: 'wait',
      speaker: 'Moretti',
      line: "I'll be here when you're right to go.",
    },
  },
}

/**
 * The scene exit. BRIEF.md's last row: theorise with Moretti.
 *
 * This is where scene 1's theory lands, and it stops exactly where scene 1's
 * evidence stops. Two sets of hands in one room, one of them tidying up, and a
 * hammer left at the bottom of the stairs. **No name.** Victor is scene 2 and
 * Sterling is scene 4, and the player who hears a name here has been handed the
 * end of the game in the first half hour.
 *
 * Miller speaks. It is the first time in the game he does, and the player still
 * never sees him.
 *
 * The last line sets up scene 2, which BRIEF.md opens with walking the hammer
 * to forensics. Ending on the instruction rather than on a conclusion is the
 * point: he is not solving it here, he is going to work.
 */
export const MORETTI_THEORISE: DialogueGraph = {
  id: 'moretti.theorise',
  start: 'ready',
  nodes: {
    ready: {
      id: 'ready',
      speaker: 'Moretti',
      line: "That's the lot, Detective. Are we right to go?",
      choices: [
        { id: 'run', label: 'Run it back to me first.', next: 'cause' },
        { id: 'wait', label: 'Give me another minute.', next: 'hold' },
      ],
    },
    hold: {
      id: 'hold',
      speaker: 'Moretti',
      line: 'Righto.',
    },

    cause: {
      id: 'cause',
      speaker: 'Moretti',
      line: 'Cause of death.',
      next: 'temple',
    },
    temple: {
      id: 'temple',
      speaker: 'Miller',
      line: "Not the needle. The needle's decoration. It's the left temple.",
      next: 'hands',
    },
    hands: {
      id: 'hands',
      speaker: 'Moretti',
      line: 'One swing, and no history on her.',
      next: 'two',
    },
    two: {
      id: 'two',
      speaker: 'Miller',
      line: 'Whoever tied that arm off did it neatly and left it tight. That is not the hand that swung.',
      next: 'tidy',
    },
    tidy: {
      id: 'tidy',
      speaker: 'Moretti',
      line: 'Two of them in the room.',
      next: 'staged',
    },
    staged: {
      id: 'staged',
      speaker: 'Miller',
      line: 'One of them was tidying up after the other one. Stood the photograph up facing the bed while he was at it.',
      next: 'window',
    },
    window: {
      id: 'window',
      speaker: 'Moretti',
      line: 'And the sash.',
      next: 'sill',
    },
    sill: {
      id: 'sill',
      speaker: 'Miller',
      line: 'Open a hand\'s width, with a partial on the sill pointing out. He left the way he came in.',
      next: 'route',
    },
    route: {
      id: 'route',
      speaker: 'Moretti',
      line: 'Along the verandah and down the back stairs.',
      next: 'hammer',
    },
    hammer: {
      id: 'hammer',
      speaker: 'Miller',
      line: 'And put the hammer down at the shed. Five feet from the bottom of them.',
      next: 'clever',
    },
    clever: {
      id: 'clever',
      speaker: 'Moretti',
      line: "Which isn't anybody being clever.",
      next: 'forensics',
    },
    forensics: {
      id: 'forensics',
      speaker: 'Miller',
      line: 'Get it to forensics tonight. I want the handle done first.',
      next: 'sir',
    },
    sir: {
      id: 'sir',
      speaker: 'Moretti',
      line: 'Sir.',
    },
  },
}

/** The node that ends the scene. Reaching it is the exit. */
export const THEORISE_LAST_NODE = 'sir'
