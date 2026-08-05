import { emit, on } from '../core/events.ts'
import { WINDOWS } from '../materials/textures.ts'
import type { CaseFile } from './casefile.ts'
import type { EvidenceDef } from './evidence.ts'

/**
 * Miller's notebook. DOM and CSS over the canvas. No framework.
 *
 * It holds knowledge from examines, not inventory. Open with N, close with N
 * or Esc. While it is open the game loop still runs, but main stops driving
 * movement and examine so Miller is not walking through a wall with a book up.
 */
export class Notebook {
  private readonly root: HTMLElement
  private readonly panel: HTMLDivElement
  private readonly list: HTMLUListElement
  private readonly detail: HTMLDivElement
  private readonly caseFile: CaseFile
  private readonly unsubscribes: Array<() => void> = []

  private open = false
  private selectedId: string | undefined = undefined

  constructor(hudRoot: HTMLElement, caseFile: CaseFile) {
    this.root = hudRoot
    this.caseFile = caseFile

    this.panel = document.createElement('div')
    this.panel.className = 'notebook'
    this.panel.setAttribute('aria-hidden', 'true')

    const header = document.createElement('header')
    header.className = 'notebook-header'
    header.innerHTML = '<h1>Case file</h1><p>N close &middot; arrows select &middot; Esc close</p>'

    this.list = document.createElement('ul')
    this.list.className = 'notebook-list'

    this.detail = document.createElement('div')
    this.detail.className = 'notebook-detail'

    const body = document.createElement('div')
    body.className = 'notebook-body'
    body.append(this.list, this.detail)

    this.panel.append(header, body)
    this.root.appendChild(this.panel)

    this.unsubscribes.push(
      on('evidence:filed', () => {
        this.refresh()
      }),
    )

    this.refresh()
  }

  get isOpen(): boolean {
    return this.open
  }

  toggle(): void {
    if (this.open) {
      this.close()
      return
    }
    this.show()
  }

  show(): void {
    if (this.open) {
      return
    }
    this.open = true
    this.panel.classList.add('is-open')
    this.panel.setAttribute('aria-hidden', 'false')
    // Free the cursor so the list is clickable. N or Esc closes.
    if (document.pointerLockElement !== null) {
      document.exitPointerLock()
    }
    this.refresh()
    emit('casefile:open', {})
  }

  close(): void {
    if (!this.open) {
      return
    }
    this.open = false
    this.panel.classList.remove('is-open')
    this.panel.setAttribute('aria-hidden', 'true')
    emit('casefile:close', {})
  }

  /** Move selection in the filed list. */
  moveSelection(delta: number): void {
    const entries = this.caseFile.list()
    if (entries.length === 0) {
      return
    }
    const current = entries.findIndex((entry) => entry.id === this.selectedId)
    const next = current < 0 ? 0 : clampIndex(current + delta, entries.length)
    this.select(entries[next].id)
  }

  private refresh(): void {
    const entries = this.caseFile.list()
    this.list.replaceChildren()

    if (entries.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'notebook-empty'
      empty.textContent = 'Nothing filed.'
      this.list.appendChild(empty)
      this.selectedId = undefined
      this.renderDetail(undefined)
      return
    }

    if (this.selectedId === undefined || !entries.some((e) => e.id === this.selectedId)) {
      this.selectedId = entries[0].id
    }

    for (const entry of entries) {
      const item = document.createElement('li')
      item.className = 'notebook-item'
      if (entry.id === this.selectedId) {
        item.classList.add('is-selected')
      }
      item.textContent = entry.label
      item.tabIndex = 0
      item.addEventListener('click', () => {
        this.select(entry.id)
      })
      this.list.appendChild(item)
    }

    this.renderDetail(entries.find((entry) => entry.id === this.selectedId))
  }

  private select(id: string): void {
    this.selectedId = id
    this.refresh()
  }

  private renderDetail(entry: EvidenceDef | undefined): void {
    this.detail.replaceChildren()
    if (entry === undefined) {
      return
    }

    const label = document.createElement('h2')
    label.textContent = entry.label

    const look = document.createElement('p')
    look.className = 'notebook-look'
    look.textContent = entry.look

    const examine = document.createElement('p')
    examine.className = 'notebook-examine'
    examine.textContent = entry.examine

    this.detail.append(label, look, examine)

    /*
     * The document itself, for the clues that are one.
     *
     * An <img> rather than the three.js texture, because this is DOM over the
     * canvas like the rest of the HUD and the browser already has the file
     * cached from the world loading it. The same window the props use is applied
     * with object-position, so the notebook and the world agree on which part of
     * the source is the thing.
     */
    if (entry.image !== undefined) {
      const [x0, y0, x1, y1] = WINDOWS[entry.image]
      const shot = document.createElement('div')
      shot.className = 'notebook-image'
      const img = document.createElement('img')
      img.src = `/textures/${entry.image}.jpg`
      img.alt = ''
      // Scale the source up so the window fills the frame, then slide it.
      img.style.width = `${100 / (x1 - x0)}%`
      img.style.height = `${100 / (y1 - y0)}%`
      img.style.marginLeft = `${(-x0 * 100) / (x1 - x0)}%`
      img.style.marginTop = `${(-y0 * 100) / (y1 - y0)}%`
      shot.appendChild(img)
      this.detail.append(shot)
    }
  }

  dispose(): void {
    for (const off of this.unsubscribes) {
      off()
    }
    this.unsubscribes.length = 0
    this.panel.remove()
  }
}

function clampIndex(value: number, length: number): number {
  if (length <= 0) {
    return 0
  }
  return ((value % length) + length) % length
}
