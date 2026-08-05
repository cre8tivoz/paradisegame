/**
 * Title card one. ASSETS.md: two only, same typeface, white on black.
 *
 * ```
 * ST KILDA
 * 26 FEBRUARY 1994
 * ```
 *
 * Fades in from black, holds, fades out. The world renders underneath the whole
 * time; the card is an overlay, not a cutscene. BRIEF.md's cold open is walk,
 * look, listen, so the player is already moving when the text clears.
 */

export class TitleCard {
  private readonly el: HTMLDivElement

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div')
    this.el.className = 'title-card'
    this.el.innerHTML = '<span>ST KILDA</span><span>26 FEBRUARY 1994</span>'
    parent.appendChild(this.el)

    requestAnimationFrame(() => {
      this.el.classList.add('is-visible')
    })

    window.setTimeout(() => {
      this.el.classList.remove('is-visible')
    }, 4000)

    window.setTimeout(() => {
      this.el.remove()
    }, 5800)
  }
}
