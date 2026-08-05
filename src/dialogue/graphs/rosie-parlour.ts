import type { DialogueChoice, DialogueGraph } from '../graph.ts'

/**
 * Rosie in the parlour, on the way back down. Gate 5.
 *
 * BRIEF.md: "there was noise at 2am, but this is St Kilda, there's always loud
 * bangs. She's not evasive and she's not lying."
 *
 * That is the whole job of this conversation and it is easy to get wrong. She
 * is not a witness holding something back and she is not a suspect. She heard a
 * bang, she rolled over, and the reason that is not negligence is that she is
 * right about the street. The verandah is what makes her irrelevant to how
 * anyone got upstairs, and she says so herself without knowing what she has
 * said. Miller does not react and the player is not told.
 *
 * **She leads with the bang, unprompted.** It used to be one branch of the
 * question hub, which made gate 5 hang off an option the player could finish
 * the conversation without ever picking. A gate that needs an optional branch
 * is a fail state for anyone who asked something else. It is also better
 * writing this way: it is the thing on her mind, so it is the thing she says.
 *
 * No evidence files here. The diary is on the table beside her and it is
 * tagged as well as examined, so Moretti carries it off at gate 6.
 */

const ASK: readonly DialogueChoice[] = [
  { id: 'crystal', label: 'How long had she been here?', next: 'crystal' },
  { id: 'who', label: 'Who else was in the house?', next: 'who' },
  { id: 'keys', label: 'Who else has a key to 1A?', next: 'keys' },
  { id: 'leave', label: "That'll do for now.", next: 'leave' },
]

export const ROSIE_PARLOUR: DialogueGraph = {
  id: 'rosie.parlour',
  start: 'bang',
  nodes: {
    bang: {
      id: 'bang',
      speaker: 'Rosie',
      line: 'I heard it, you know. Two o clock, near enough. A bang, and then another one.',
      next: 'street',
    },
    street: {
      id: 'street',
      speaker: 'Rosie',
      // The whole point of her, and she has no idea she has just said it.
      line: "This is Fitzroy Street, Detective. There's always a loud bang. You'd never sleep if you got up for every one of them.",
      next: 'ask',
    },
    ask: {
      id: 'ask',
      speaker: 'Rosie',
      line: 'Was there something else?',
      choices: ASK,
    },

    crystal: {
      id: 'crystal',
      speaker: 'Rosie',
      line: "Four years. Longest anyone's stopped here since I took it on.",
      next: 'crystal2',
    },
    crystal2: {
      id: 'crystal2',
      speaker: 'Rosie',
      line: "Paid me Friday, every Friday. She'd sorted herself out. You could see it on her.",
      next: 'more',
    },

    who: {
      id: 'who',
      speaker: 'Rosie',
      line: "Nine rooms let, six of them in. I don't sit at that desk all night.",
      next: 'who2',
    },
    who2: {
      id: 'who2',
      speaker: 'Rosie',
      line: "Anyone could come up the side stairs and I'd not know a thing about it.",
      next: 'more',
    },

    keys: {
      id: 'keys',
      speaker: 'Rosie',
      line: "Me. There's a spare in the pigeonhole and it has been in the pigeonhole all week.",
      next: 'keys2',
    },
    keys2: {
      id: 'keys2',
      speaker: 'Rosie',
      line: "She had the other one. It'll be up there with her things.",
      next: 'more',
    },

    more: {
      id: 'more',
      speaker: 'Rosie',
      line: 'Anything else?',
      choices: ASK,
    },

    leave: {
      id: 'leave',
      speaker: 'Rosie',
      line: "I'll be here. Go and do your job.",
    },
  },
}
