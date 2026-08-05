import './styles.css'
import { Game } from './game/Game.ts'
import { Billboard } from './sprites/billboard.ts'
import { Player } from './player/player.ts'

async function boot(): Promise<void> {
  const [miller, rosie] = await Promise.all([
    Billboard.create('miller', { height: 1.85, scale: 1 }),
    Billboard.create('rosie', { height: 1.75, scale: 1 }),
  ])
  const player = new Player(miller)
  const game = new Game(player, rosie)
  // Dev hook for click-target testing in the browser console.
  ;(window as unknown as { __lodge?: unknown }).__lodge = {
    project: (x: number, y: number, z: number) => game.debugProject(x, y, z),
  }
}

void boot().catch((err) => {
  console.error('Boot failed', err)
  const msg = document.createElement('div')
  msg.id = 'boot-error'
  msg.textContent = 'Failed to start: ' + (err instanceof Error ? err.message : String(err))
  document.body.appendChild(msg)
})
