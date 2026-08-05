import type { DialogueGraph } from '../graph.ts'

/**
 * Rosie at reception, on the way in. BRIEF.md's cold-open beat.
 *
 * Brief and directive, and it stays that way. The cold open at step 15 plays
 * this over the walk in without the player pressing anything, so it has to work
 * as something overheard as well as something asked for.
 *
 * She names the parlour here. That is the only signposting scene 1 gets, and it
 * lands before the player has any reason to want it.
 *
 * ## One option, not two
 *
 * There were two, "What happened?" and "I'll come down.", and they went to
 * different lines: the first said where the body was, the second said where she
 * would be. Both were then reported in play as giving the same answer.
 *
 * They are one path now. A choice is worth putting in front of the player when
 * the answers differ enough to be worth choosing between, and a pair that both
 * mean "go on" is a keystroke charging rent. Both lines survive in order, so
 * the room number and the parlour both still land, and neither can be missed by
 * picking the other one.
 */
export const ROSIE_RECEPTION: DialogueGraph = {
  id: 'rosie.reception',
  start: 'found',
  nodes: {
    found: {
      id: 'found',
      speaker: 'Rosie',
      line: "I found her, Detective. She was one of my long termers. Come find me when you're done.",
      choices: [
        {
          id: 'what',
          label: 'What happened?',
          next: 'what',
        },
      ],
    },
    what: {
      id: 'what',
      speaker: 'Rosie',
      line: "She's upstairs. 1A. I haven't touched anything.",
      next: 'parlour',
    },
    parlour: {
      id: 'parlour',
      speaker: 'Rosie',
      line: "Parlour's on the left when you come back down. I'll be there.",
      next: 'done',
    },
    done: {
      id: 'done',
      speaker: 'Rosie',
      line: 'Go on.',
    },
  },
}
