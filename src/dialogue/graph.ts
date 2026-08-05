/**
 * Dialogue node graph. Authored content, not a freeform conversation engine.
 *
 * Camera stays first person. The runner walks nodes; the panel shows them.
 * Evidence presentation (scene 4) hangs off the same graph later. Not here.
 */

export interface DialogueChoice {
  readonly id: string
  readonly label: string
  readonly next: string
}

/**
 * One beat. If `choices` is set, the player picks. Otherwise `next` continues,
 * or the conversation ends when both are absent.
 */
export interface DialogueNode {
  readonly id: string
  readonly speaker: string
  readonly line: string
  readonly next?: string
  readonly choices?: readonly DialogueChoice[]
}

export interface DialogueGraph {
  readonly id: string
  readonly start: string
  readonly nodes: Readonly<Record<string, DialogueNode>>
}

export function getNode(graph: DialogueGraph, nodeId: string): DialogueNode | undefined {
  return graph.nodes[nodeId]
}
