import type { DialogueGraph } from '../graph.ts'

/**
 * What Moretti says once he has bagged something.
 *
 * One node each, and nothing to choose. He is not a conversation in scene 1, he
 * is a colleague doing his job, and the walk over is most of the beat: Miller
 * calls it, Moretti comes, Moretti crouches, Moretti says what he has got.
 *
 * These fire on `tag:bagged`, not on `tag:requested`, so nothing opens over the
 * top of him while he is still crossing the room.
 *
 * He never editorialises. He does not say the hammer is the murder weapon and
 * he does not say the diary matters. He says what is in the bag.
 */

export const MORETTI_BAG: Readonly<Record<string, DialogueGraph>> = {
  'lodge.diary': {
    id: 'moretti.bag.diary',
    start: 'bagged',
    nodes: {
      bagged: {
        id: 'bagged',
        speaker: 'Moretti',
        line: "Notebook, parlour table. I'll get it listed with the rest.",
      },
    },
  },
  'yard.hammer': {
    id: 'moretti.bag.hammer',
    start: 'bagged',
    nodes: {
      bagged: {
        id: 'bagged',
        speaker: 'Moretti',
        // He is a constable at a scene. The distance is a measurement he took,
        // not a point he is making, and Miller does not answer him.
        line: "Hammer, against the shed. That's five feet from the bottom of those stairs.",
      },
    },
  },
}
