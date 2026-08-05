import { emit } from '../core/events.ts'
import { getNode } from './graph.ts'
import type { DialogueGraph, DialogueNode } from './graph.ts'

/**
 * Walks a dialogue graph. Emits the vocabulary in CLAUDE.md. Does not know
 * about the DOM. The panel listens via `onNode` and the bus.
 */
export class DialogueRunner {
  private graph: DialogueGraph | undefined = undefined
  private node: DialogueNode | undefined = undefined

  /** Fired whenever the active node changes, including the first. */
  onNode: ((node: DialogueNode | undefined) => void) | undefined = undefined

  get isActive(): boolean {
    return this.graph !== undefined
  }

  get current(): DialogueNode | undefined {
    return this.node
  }

  get graphId(): string | undefined {
    return this.graph?.id
  }

  /**
   * Start a conversation at the graph's start node, or at `startNode` when
   * given. No-op if a conversation is already running.
   */
  start(graph: DialogueGraph, startNode?: string): void {
    if (this.graph !== undefined) {
      return
    }
    const nodeId = startNode ?? graph.start
    const node = getNode(graph, nodeId)
    if (node === undefined) {
      console.warn(`Dialogue "${graph.id}" has no node "${nodeId}"`)
      return
    }
    this.graph = graph
    this.node = node
    emit('dialogue:start', { nodeId: node.id, speaker: node.speaker })
    this.onNode?.(node)
  }

  /** Advance a linear node. No-op when the current node has choices. */
  advance(): void {
    const graph = this.graph
    const node = this.node
    if (graph === undefined || node === undefined) {
      return
    }
    if (node.choices !== undefined && node.choices.length > 0) {
      return
    }
    if (node.next === undefined) {
      this.end()
      return
    }
    this.goTo(graph, node.next)
  }

  /** Pick a choice by id. */
  choose(optionId: string): void {
    const graph = this.graph
    const node = this.node
    if (graph === undefined || node === undefined || node.choices === undefined) {
      return
    }
    const option = node.choices.find((entry) => entry.id === optionId)
    if (option === undefined) {
      return
    }
    emit('dialogue:choice', { nodeId: node.id, optionId: option.id })
    this.goTo(graph, option.next)
  }

  /** Leave the conversation without finishing the graph. */
  cancel(): void {
    if (this.graph === undefined || this.node === undefined) {
      return
    }
    const nodeId = this.node.id
    this.graph = undefined
    this.node = undefined
    this.onNode?.(undefined)
    emit('dialogue:end', { nodeId })
  }

  private goTo(graph: DialogueGraph, nodeId: string): void {
    const next = getNode(graph, nodeId)
    if (next === undefined) {
      console.warn(`Dialogue "${graph.id}" missing node "${nodeId}"`)
      this.end()
      return
    }
    this.node = next
    this.onNode?.(next)
  }

  private end(): void {
    const node = this.node
    if (node === undefined) {
      this.graph = undefined
      return
    }
    const nodeId = node.id
    this.graph = undefined
    this.node = undefined
    this.onNode?.(undefined)
    emit('dialogue:end', { nodeId })
  }
}
