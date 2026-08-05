import * as THREE from 'three'
import { Loop } from '../core/loop.ts'
import { IsoCamera } from '../systems/iso-camera.ts'
import { Cutaway } from '../systems/cutaway.ts'
import { Stage, type StageDef, type StageProp } from '../world/stage.ts'
import { buildLodge, type Lodge } from '../world/lodge.ts'
import { Player } from '../player/player.ts'
import { Billboard } from '../sprites/billboard.ts'
import { EXTERIOR } from '../materials/palette.ts'
import { CaseFile } from '../case/casefile.ts'
import { Notebook } from '../case/notebook.ts'
import { DialogueRunner } from '../dialogue/runner.ts'
import { DialoguePanel } from '../dialogue/panel.ts'
import { ROSIE_RECEPTION } from '../dialogue/graphs/rosie-reception.ts'
import { Mixer } from '../audio/mixer.ts'

/**
 * Paradise Lodge — 2.5D demo (Scene 1 reception).
 *
 * The presentation layer is new (dollhouse stage + billboard characters +
 * fixed isometric camera). The gameplay layer is the original ported verbatim:
 * case file, evidence ids, dialogue graphs, synthesised audio.
 */

interface GameUI {
  lookLine: HTMLDivElement
  hint: HTMLDivElement
  panelHost: HTMLDivElement
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly iso: IsoCamera
  private readonly input: { keys: Set<string>; mouseX: number; mouseY: number }
  private readonly stage: Stage
  private readonly player: Player
  private readonly caseFile = new CaseFile()
  private readonly mixer = new Mixer()
  private readonly runner = new DialogueRunner()
  private readonly notebook: Notebook
  private readonly ui: GameUI
  private readonly loop: Loop
  private readonly raycaster = new THREE.Raycaster()
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly npcBillboards: Billboard[] = []
  private readonly cutaway: Cutaway

  constructor(player: Player, rosie: Billboard) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    document.body.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(EXTERIOR.sky)

    const sun = new THREE.DirectionalLight(0xfff2dd, 2.4)
    sun.position.set(6, 9, -4)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -14
    sun.shadow.camera.right = 14
    sun.shadow.camera.top = 14
    sun.shadow.camera.bottom = -14
    this.scene.add(sun)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6e6255, 0.5))

    this.iso = new IsoCamera(window.innerWidth / window.innerHeight, { distance: 22 })
    this.iso.setTarget(0, 0, 4)

    this.input = { keys: new Set(), mouseX: 0, mouseY: 0 }
    this.ui = this.buildUI()

    // Dialogue and notebook are the original DOM ports, hung off the host.
    void new DialoguePanel(this.ui.panelHost, this.runner)
    this.notebook = new Notebook(this.ui.panelHost, this.caseFile)

    // Build the full procedural lodge (street, steps, facade, ground floor, stairs, first floor)
    const lodge = buildLodge()
    this.scene.add(lodge.group)

    // Cutaway system: walls facing camera, ceilings always hidden, storey culling
    this.cutaway = new Cutaway(this.iso.camera, lodge.group)

    // Use the Stage class for interaction logic (hotspots, props) — build a stage from the lodge's collision/walk data
    const stageDef = this.lodgeToStageDef(lodge)
    this.stage = new Stage(stageDef)
    this.scene.add(this.stage.group)

    this.player = player
    this.player.spawn(lodge.spawn.x, lodge.spawn.z, lodge.spawnYaw)
    this.player.setBounds({ x0: -7.5, x1: 7.5, z0: -2, z1: 11 })
    this.scene.add(this.player.root)

    // Rosie behind the desk, facing the door. Talkable.
    // facing 0 = +Z = the entrance side of THIS stage (the original repo's
    // street was -Z; carrying its π over made her face the back wall and
    // the view selector showed her profile at the default camera angle).
    rosie.setPosition(-2.4, 0, 4.3)
    rosie.facing = 0
    rosie.update(this.iso.yaw)
    this.scene.add(rosie.root)
    const rosieHotspot = this.stage.addHotspot('rosie', -2.4, 1.0, 4.3, 1.6, 1.8, 1.6)
    rosieHotspot.userData.dialogueId = 'rosie.reception'
    rosieHotspot.userData.description = 'Rosie Rourke, the manager. Cigarette smoke curls off her sleeve as she watches you.'
    this.npcBillboards.push(rosie)

    this.bindEvents()
    this.loop = new Loop(
      (delta, elapsed) => this.update(delta, elapsed),
    )
    this.loop.start()
  }

  private buildUI(): GameUI {
    const lookLine = document.createElement('div')
    lookLine.id = 'look-line'
    document.body.appendChild(lookLine)
    const hint = document.createElement('div')
    hint.id = 'hint'
    hint.textContent = 'Click floor to move · Click a thing to look · Drag to orbit · Scroll to zoom · N notebook'
    document.body.appendChild(hint)
    const panelHost = document.createElement('div')
    panelHost.id = 'dialogue-host'
    document.body.appendChild(panelHost)
    return { lookLine, hint, panelHost }
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.iso.resize(window.innerWidth / window.innerHeight)
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })

    const el = this.renderer.domElement
    el.addEventListener('pointerdown', (e) => {
      this.mixer.resume()
      this.iso.onPointerDown(e.clientX, e.clientY)
      this.input.mouseX = e.clientX
      this.input.mouseY = e.clientY
    })
    window.addEventListener('pointermove', (e) => {
      this.input.mouseX = e.clientX
      this.input.mouseY = e.clientY
      this.iso.onPointerMove(e.clientX, e.clientY)
    })
    window.addEventListener('pointerup', () => {
      this.iso.onPointerUp()
    })
    el.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.iso.onWheel(e.deltaY)
    })
    el.addEventListener('click', (_e) => {
      if (this.runner.isActive || this.notebook.isOpen) return
      const hit = this.pick(this.stage.hotspots)
      if (hit !== null) {
        if (typeof hit.userData.dialogueId === 'string') {
          const prop = this.stage.props.get(hit.name)
          const desc = prop?.description ?? (hit.userData.description as string | undefined)
          if (desc !== undefined) this.ui.lookLine.textContent = desc
          this.runner.start(ROSIE_RECEPTION)
          return
        }
        const prop = this.stage.props.get(hit.name)
        if (prop !== undefined && prop.description !== undefined) {
          this.onPropClicked(prop)
        }
        return
      }
      this.raycaster.setFromCamera(this.pointerNdc(), this.iso.camera)
      const point = new THREE.Vector3()
      const hitGround = this.raycaster.ray.intersectPlane(this.groundPlane, point)
      if (hitGround !== null) {
        this.player.moveTo(point.x, point.z)
      }
    })
    window.addEventListener('keydown', (e) => {
      this.input.keys.add(e.key.toLowerCase())
      if (e.key === 'Escape') {
        if (this.runner.isActive) this.runner.cancel()
        if (this.notebook.isOpen) this.notebook.close()
      }
      if (e.key.toLowerCase() === 'n') {
        this.notebook.toggle()
      }
    })
    window.addEventListener('keyup', (e) => {
      this.input.keys.delete(e.key.toLowerCase())
    })
  }

  private pointerNdc(): THREE.Vector2 {
    return new THREE.Vector2(
      (this.input.mouseX / window.innerWidth) * 2 - 1,
      -(this.input.mouseY / window.innerHeight) * 2 + 1,
    )
  }

  private pick(objects: THREE.Object3D[]): THREE.Object3D | null {
    this.raycaster.setFromCamera(this.pointerNdc(), this.iso.camera)
    const hits = this.raycaster.intersectObjects(objects, false)
    return hits.length > 0 ? hits[0]!.object : null
  }

  private onPropClicked(prop: StageProp): void {
    const p = prop.object.position
    const dx = this.player.position.x - p.x
    const dz = this.player.position.z - p.z
    const d = Math.hypot(dx, dz)
    if (d > 1.6) {
      this.player.moveTo(p.x + (dx / d) * 1.2, p.z + (dz / d) * 1.2)
    }
    this.player.facing = Math.atan2(-dx, -dz)
    this.player.billboard.facing = this.player.facing
    this.player.stop()

    this.ui.lookLine.textContent = prop.examine ?? prop.description ?? ''
    if (prop.evidenceId !== undefined) {
      this.caseFile.file(prop.evidenceId, prop.id)
      this.ui.lookLine.textContent += '  [Filed]'
    }
    if (prop.dialogueId !== undefined) {
      const graphs: Record<string, unknown> = { 'rosie.reception': ROSIE_RECEPTION }
      const graph = graphs[prop.dialogueId]
      if (graph !== undefined) {
        this.runner.start(graph as Parameters<DialogueRunner['start']>[0])
      }
    }
  }

  private update(delta: number, _elapsed: number): void {
    this.player.cameraYaw = this.iso.yaw
    this.player.update(delta)

    if (!this.runner.isActive && !this.notebook.isOpen) {
      const hit = this.pick(this.stage.hotspots)
      if (hit !== null) {
        const prop = this.stage.props.get(hit.name)
        const desc =
          prop?.description ??
          (typeof hit.userData.description === 'string' ? hit.userData.description : undefined)
        this.ui.lookLine.textContent = desc ?? ''
        this.renderer.domElement.style.cursor = 'pointer'
      } else {
        this.ui.lookLine.textContent = ''
        this.renderer.domElement.style.cursor = 'default'
      }
    }
    for (const npc of this.npcBillboards) {
      npc.update(this.iso.yaw)
    }
    // Cutaway: hide camera-facing walls, ceilings, and storey-above geometry
    this.cutaway.update(this.player.position)
    const t = this.stage.cameraTarget
    this.iso.setTarget(
      t.x + this.player.position.x * 0.35,
      t.y,
      t.z + this.player.position.z * 0.35,
    )
    this.render()
  }

  private lodgeToStageDef(lodge: Lodge): StageDef {
    let x0 = -7.5, x1 = 7.5, z0 = -2, z1 = 11

    // Build walkable bounds from floors
    for (const floor of lodge.floors) {
      x0 = Math.min(x0, floor.box.min.x)
      x1 = Math.max(x1, floor.box.max.x)
      z0 = Math.min(z0, floor.box.min.z)
      z1 = Math.max(z1, floor.box.max.z)
    }

    const props: StageProp[] = [
          { id: 'desk', object: lodge.props.desk, description: 'The reception desk.', examine: "An empty ledger, a brass bell, a key rack. Room 1A's key is missing." },
          { id: 'stairs', object: lodge.props.stairs, description: 'The staircase to the first floor.' },
          { id: 'parlour-table', object: lodge.props.parlourTable, description: 'A table in the parlour.' },
          { id: 'diary', object: lodge.props.diary, description: 'An open diary.', examine: 'Pages yellowed, entries cramped.', evidenceId: 'diary' },
          { id: 'tv', object: lodge.props.television, description: 'An old CRT television.' },
          { id: 'lamp', object: lodge.props.standardLamp, description: 'A standard lamp.' },
          { id: 'phone', object: lodge.props.phone, description: 'The pay phone. The handset smells of stale smoke.' },
          { id: 'commodore', object: lodge.props.commodore, description: 'A beige 1993 Holden Commodore, unmarked.' },
        ]

    return {
      id: 'lodge',
      name: 'Lodge',
      title: 'THE PARADISE LODGE',
      spawn: { x: lodge.spawn.x, z: lodge.spawn.z, facing: lodge.spawnYaw },
      floor: { x0, x1, z0, z1, texture: '/textures/carpet-brown.jpg', repeatX: 3, repeatY: 3 },
      walls: [],
      props,
      walkBounds: { x0, x1, z0, z1 },
      camera: { target: { x: 0, y: 0, z: 4 }, distance: 22 },
    }
  }

  private render(): void {
    this.renderer.render(this.scene, this.iso.camera)
  }

  /** Dev hook: project a world point to screen coords for click testing. */
  debugProject(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.iso.camera)
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    }
  }
}
