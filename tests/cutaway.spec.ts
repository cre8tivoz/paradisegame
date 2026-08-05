import { expect, test } from '@playwright/test'

interface WindowWithExtras extends Window {
  __lodge?: { project: (x: number, y: number, z: number) => { x: number; y: number } }
  __GAME__?: { scene: any }
  __GAME_SCENE__?: any
  __GAME_CAMERA__?: any
  __THREE_GAME_DIAGNOSTICS__?: any
}

async function getCeilingVisibility(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const ceilings: any[] = []
    const win = window as WindowWithExtras
    if (!win.__GAME__) return { total: 0, visible: 0 }
    win.__GAME__.scene.traverse((obj: any) => {
      if (obj.isMesh && obj.userData?.kind === 'ceiling') {
        ceilings.push(obj)
      }
    })
    const visible = ceilings.filter(c => c.visible)
    return { total: ceilings.length, visible: visible.length, visibleNames: visible.map(c => c.name) }
  })
}

async function getWallVisibility(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const walls: any[] = []
    const win = window as WindowWithExtras
    if (!win.__GAME__) return { total: 0, visible: 0 }
    win.__GAME__.scene.traverse((obj: any) => {
      if (obj.isMesh && obj.userData?.kind === 'wall') {
        walls.push(obj)
      }
    })
    const visible = walls.filter(w => w.visible)
    return { total: walls.length, visible: visible.length, hidden: walls.length - visible.length }
  })
}

async function clickToMove(page: import('@playwright/test').Page, x: number, y: number, z: number) {
  await page.evaluate(({ x, y, z }) => {
    const canvas = document.querySelector('#game-canvas')
    const win = window as WindowWithExtras
    if (!canvas || !win.__lodge) return
    const p = win.__lodge.project(x, y, z)
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: p.x, clientY: p.y, bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: p.x, clientY: p.y, bubbles: true }))
    canvas.dispatchEvent(new MouseEvent('click', { clientX: p.x, clientY: p.y, bubbles: true }))
  }, { x, y, z })
  await page.waitForTimeout(3000)
}

async function dragCamera(page: import('@playwright/test').Page, deltaX: number, deltaY: number) {
  await page.mouse.move(400, 300)
  await page.mouse.down()
  await page.mouse.move(400 + deltaX, 300 + deltaY, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(1000)
}

test.describe('Cutaway system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#game-canvas')).toBeVisible()
    await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10)
  })

  test('ceilings always hidden at start', async ({ page }) => {
    const ceilings = await getCeilingVisibility(page)
    expect(ceilings.total).toBeGreaterThan(0)
    expect(ceilings.visible).toBe(0)
  })

  test('ground floor visible, ceilings hidden after walking inside', async ({ page }) => {
    await clickToMove(page, 0, 0, -1)
    await clickToMove(page, 0, 0, 3)
    
    const ceilings = await getCeilingVisibility(page)
    expect(ceilings.visible).toBe(0)
    
    const walls = await getWallVisibility(page)
    expect(walls.total).toBeGreaterThan(0)
    expect(walls.hidden).toBeGreaterThan(0)
  })

  test('different walls culled at different azimuths', async ({ page }) => {
    test.setTimeout(120000)
    await clickToMove(page, 0, 0, 3)
    
    const walls1 = await getWallVisibility(page)
    await dragCamera(page, -300, 0)
    const walls2 = await getWallVisibility(page)
    await dragCamera(page, 600, 0)
    const walls3 = await getWallVisibility(page)
    
    expect([walls1.hidden, walls2.hidden, walls3.hidden]).not.toEqual(
      [walls1.hidden, walls1.hidden, walls1.hidden]
    )
  })

  test('first floor - ground floor hidden, no ceiling above Miller', async ({ page }) => {
    test.setTimeout(180000)
    await clickToMove(page, 0, 0, -1)
    await clickToMove(page, 0, 0, 3)
    await clickToMove(page, 0, 0, 7)
    await clickToMove(page, 0, 3.5, 8)
    
    const ceilings = await getCeilingVisibility(page)
    expect(ceilings.visible).toBe(0)
    
    const walls = await getWallVisibility(page)
    expect(walls.total).toBeGreaterThan(0)
  })
})