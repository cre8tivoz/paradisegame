/**
 * Evidence definitions. Knowledge that lands in the case file, not objects
 * Miller pockets. IDs and copy come from BRIEF.md. Look is tier one. Examine
 * is tier two. Only examine files.
 *
 * Writing rules apply: Australian English, contractions, no em dashes, no
 * editorialising.
 */

export interface EvidenceDef {
  readonly id: string
  /** Short label in the notebook list. Plain. Not a hint. */
  readonly label: string
  readonly look: string
  readonly examine: string
  /** Later scenes this clue feeds. Recorded now, used when those scenes land. */
  readonly landsIn: readonly string[]
  /**
   * A shipped texture, for the clues that are documents.
   *
   * The photograph, the diary page and the note are the three things in scene 1
   * Miller actually reads, and a case file that holds knowledge is exactly where
   * a print of one belongs. It is also the only place the photo can be seen:
   * ASSETS.md has him set the frame back down face down, exactly as found, so
   * the print is never face up in the room.
   *
   * Period rule from ASSETS.md, and it is load-bearing: photographs are prints.
   * That is why the frame can lie face down and leave a dust ring at all.
   */
  readonly image?: 'photo-in-frame' | 'diary-page' | 'note'
}

/**
 * Scene 1 evidence, in the order BRIEF.md lists them. The catalogue is the
 * whole set; the case file only shows what has been filed.
 */
export const SCENE1_EVIDENCE: readonly EvidenceDef[] = [
  {
    id: 'needle',
    label: 'Syringe',
    look: 'Syringe in the crook of her arm.',
    examine: 'One puncture. Nothing under it. No history.',
    landsIn: ['S4'],
  },
  {
    id: 'temple',
    label: 'Left temple',
    look: 'Her head, turned toward the window.',
    examine: 'Blunt trauma, left temple, under the hair.',
    landsIn: ['S2', 'S4'],
  },
  {
    id: 'sling',
    label: 'Rubber tie',
    look: 'Rubber tie around her upper arm.',
    examine:
      "The tie's neat. Even tension, tucked under itself. Nobody does that one-handed with their teeth, and nobody leaves it tight after they've found the vein.",
    landsIn: ['S4'],
  },
  {
    id: 'frame',
    label: 'Photo frame',
    look: 'Photo frame angled at the bed.',
    examine:
      'Crystal and a man, black shirt, ponytail. Dust ring shows it lay face down for weeks.',
    landsIn: ['S2', 'S4'],
    image: 'photo-in-frame',
  },
  {
    id: 'sill',
    label: 'Windowsill',
    look: "Sash window, open a hand's width.",
    examine: 'Faint partial, toe pointing out.',
    landsIn: ['S4'],
  },
  {
    id: 'lighter',
    label: 'Cigarette lighter',
    look: 'Cigarette lighter, crystals in the case.',
    examine: "Mahoney's Bar on the base.",
    landsIn: ['S2'],
  },
  {
    id: 'diary',
    label: 'Notebook',
    look: 'Notebook on the parlour table.',
    examine: 'meeting M for lunch - mahoneys 3pm Tuesday',
    landsIn: ['S2'],
    image: 'diary-page',
  },
  {
    id: 'hammer',
    label: 'Hammer',
    look: 'Hammer leaning by the shed.',
    examine: 'Blood on the handle. More on the head.',
    landsIn: ['S2'],
  },
]

const byId = new Map(SCENE1_EVIDENCE.map((entry) => [entry.id, entry]))

export function getEvidence(id: string): EvidenceDef | undefined {
  return byId.get(id)
}
