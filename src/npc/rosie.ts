import { Box3, Group, MathUtils, Vector3 } from 'three'
import type { Mesh, MeshStandardMaterial, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { PLAYER } from '../core/config.ts'

/**
 * Rosie Lodge. The lodging house manager, and the only person in scene 1 who
 * talks back.
 *
 * BRIEF.md: "Rosie appears twice. Once at reception on the way in, brief and
 * directive. Once in the parlour on the way back down, for the 2am
 * conversation. She relocates between beats."
 *
 * So she is one figure with two stations, not two figures. Relocating rather
 * than duplicating is what makes the parlour beat land: the player was told
 * where she would be, and she is there.
 *
 * Geometry comes from public/models/rosie.glb, authored in Blender. See the
 * Rosie mesh section of CLAUDE.md. This file is the only one that knows about
 * the glTF.
 *
 * ## She is rooted, and that is the whole animation budget
 *
 * BRIEF.md has her rooted at both stations, which means there is no walk cycle,
 * no path and no navmesh work here. What is left is the difference between a
 * mannequin and a person standing still: she breathes, she shifts her weight,
 * she smokes, and she looks at whoever is talking to her.
 *
 * All of it is procedural. There are no authored clips on this mesh and there
 * do not need to be.
 */

const MODEL_URL = '/models/rosie.glb'

export type StationId = 'reception' | 'parlour'

export interface Station {
  /** Feet, world space. */
  readonly position: Vector3
  /** Yaw 0 faces -Z, which is the street. */
  readonly yaw: number
  readonly dialogueId: string
  /** Tier one look line. Writing rules apply: surface only, no signalling. */
  readonly description: string
  /**
   * Where the cigarette hand sits between drags, 0 hanging and 1 at her mouth.
   *
   * This is a staging number, not a mannerism. At reception the counter is at
   * 1.06 and a hanging hand is at 0.82, so an arm at rest puts the one prop she
   * has behind the desk where nobody ever sees it. She holds it up, which is
   * what people do behind a counter anyway.
   */
  readonly restLift: number
}

/**
 * Where she stands, and what she is saying when she is there.
 *
 * Reception is behind the desk between it and the key rack, facing out over the
 * counter. Miller comes in from the hall at the side of her, which is what the
 * head tracking is for.
 *
 * The parlour has her at the street window rather than in one of the armchairs.
 * Two reasons, and neither is taste: there is no seated pose on this mesh, and
 * an armchair would put her below Miller's eyeline for a conversation the
 * player is meant to take seriously. The window also backlights her, which is
 * the only interesting light in that room.
 */
export const STATIONS: Readonly<Record<StationId, Station>> = {
  reception: {
    position: new Vector3(3.5, 0, 3.15),
    yaw: 0,
    dialogueId: 'rosie.reception',
    description: 'Rosie in her infamous cardigan, glasses pushed up.',
    restLift: 0.62,
  },
  parlour: {
    position: new Vector3(-3.05, 0, 0.75),
    yaw: Math.PI,
    dialogueId: 'rosie.parlour',
    description: "She's at the window now. Cigarette going.",
    // Out in the open, so it reads where it hangs. Just off straight, because
    // a ramrod arm is the one pose a person standing about never adopts.
    restLift: 0.1,
  },
}

/** Standing figure, near enough. Half a metre through the shoulders. */
const GIRTH = 0.25
const STAND_HEIGHT = 1.7

/** Local Y of the head joint, from the build script's HEIGHT_HEAD. */
const HEAD_Y = 1.5

/** She turns her head this far and no further. Past it she turns nothing. */
const HEAD_YAW_LIMIT = 0.75
const HEAD_PITCH_DOWN = -0.34
const HEAD_PITCH_UP = 0.4
/** Beyond this she is not being spoken to and stops tracking. */
const HEAD_GIVE_UP = 1.4
const HEAD_RANGE = 4.5
const HEAD_RESPONSE = 4.5

/*
 * The smoking cycle. One drag every fourteen seconds or so, which is about
 * right for a cigarette that has to last a conversation.
 *
 * The pose is the arm at the top of the lift, and it was solved rather than
 * eyeballed: the shoulder is 0.57 from the cigarette and her mouth is 0.26 from
 * the shoulder, so the arm has to fold to under half its length and there is
 * very little slack in where the joints can be.
 *
 * The Y term is the one that is not obvious. Her arm hangs down -Y, so
 * rotation.y rolls the humerus about its own length, and that is what decides
 * which way the elbow carries the forearm when it closes. Without it the
 * shoulder has to drag the whole arm across the chest instead, which is a hand
 * over the mouth and not a drag on a cigarette. Real arms do the same thing.
 */
const DRAG_PERIOD = 14.0
const DRAG_RAISE = 1.05
const DRAG_HOLD = 1.5
const DRAG_LOWER = 1.4
const DRAG_SHOULDER_X = 0.45
const DRAG_SHOULDER_Y = 0.8
const DRAG_SHOULDER_Z = 0.2
const DRAG_ELBOW_X = 2.1
/** Ember at rest, and on the draw. */
const EMBER_IDLE = 1.0
const EMBER_DRAW = 3.4

export interface Rosie {
  readonly root: Group
  /** One box. Rewritten in place when she relocates, so the solver follows. */
  readonly solids: Box3[]
  readonly station: StationId
  readonly current: Station
  setStation(id: StationId): void
  /** @param playerFeet Miller's feet, world space. */
  update(delta: number, playerFeet: Vector3): void
}

export async function buildRosie(): Promise<Rosie> {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL)

  const root = new Group()
  root.name = 'rosie'
  root.add(gltf.scene)

  gltf.scene.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh === true) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })

  const hips = requireNode(gltf.scene, 'hips')
  const chest = requireNode(gltf.scene, 'chest')
  const head = requireNode(gltf.scene, 'head')
  const shoulder = requireNode(gltf.scene, 'arm_r_0')
  const elbow = requireNode(gltf.scene, 'arm_r_1')
  const ember = requireNode(gltf.scene, 'cig_ember') as Mesh

  const hipsY = hips.position.y
  const shoulderBind = shoulder.quaternion.clone()

  const emberMaterial = ember.material as MeshStandardMaterial

  const scratch = new Vector3()

  const solids: Box3[] = [new Box3()]

  let stationId: StationId = 'reception'
  let elapsed = 0
  let headYaw = 0
  let headPitch = 0

  function place(id: StationId): void {
    const station = STATIONS[id]
    stationId = id
    root.position.copy(station.position)
    root.rotation.y = station.yaw
    solids[0].min.set(
      station.position.x - GIRTH,
      station.position.y,
      station.position.z - GIRTH,
    )
    solids[0].max.set(
      station.position.x + GIRTH,
      station.position.y + STAND_HEIGHT,
      station.position.z + GIRTH,
    )
  }

  place('reception')

  return {
    root,
    solids,
    get station(): StationId {
      return stationId
    },
    get current(): Station {
      return STATIONS[stationId]
    },

    setStation(id: StationId): void {
      if (id === stationId) {
        return
      }
      place(id)
    },

    update(delta: number, playerFeet: Vector3): void {
      elapsed += delta

      /*
       * Weight and breath. Small on purpose. The failure mode here is a figure
       * that sways like she is on a boat, and the difference between alive and
       * seasick is about a centimetre.
       */
      hips.position.y = hipsY + Math.sin(elapsed * 0.9) * 0.005
      chest.rotation.z = Math.sin(elapsed * 0.31) * 0.035
      chest.rotation.x = Math.sin(elapsed * 1.05) * 0.012

      // --- Head ---

      scratch.copy(playerFeet)
      scratch.y += PLAYER.eyeHeightStand
      root.worldToLocal(scratch)

      const dx = scratch.x
      const dz = scratch.z
      const flat = Math.hypot(dx, dz)
      const raw = Math.atan2(-dx, -dz)

      let wantYaw = 0
      let wantPitch = 0
      if (flat < HEAD_RANGE && Math.abs(raw) < HEAD_GIVE_UP) {
        wantYaw = MathUtils.clamp(raw, -HEAD_YAW_LIMIT, HEAD_YAW_LIMIT)
        wantPitch = MathUtils.clamp(
          Math.atan2(scratch.y - HEAD_Y, flat),
          HEAD_PITCH_DOWN,
          HEAD_PITCH_UP,
        )
      }

      const catchUp = 1 - Math.exp(-HEAD_RESPONSE * delta)
      headYaw += (wantYaw - headYaw) * catchUp
      headPitch += (wantPitch - headPitch) * catchUp
      head.rotation.y = headYaw
      head.rotation.x = headPitch

      // --- The cigarette ---

      const phase = elapsed % DRAG_PERIOD
      let reach = 0
      let draw = 0
      if (phase < DRAG_RAISE) {
        reach = smoothstep(phase / DRAG_RAISE)
      } else if (phase < DRAG_RAISE + DRAG_HOLD) {
        reach = 1
        // Draw hard in the middle of the hold, not for all of it.
        draw = Math.sin(((phase - DRAG_RAISE) / DRAG_HOLD) * Math.PI)
      } else if (phase < DRAG_RAISE + DRAG_HOLD + DRAG_LOWER) {
        reach = 1 - smoothstep((phase - DRAG_RAISE - DRAG_HOLD) / DRAG_LOWER)
      }

      // The drag runs from wherever this station rests to her mouth, so at
      // reception it is a short lift from chest height and in the parlour it is
      // the whole way up from hanging.
      const rest = STATIONS[stationId].restLift
      const lift = rest + reach * (1 - rest)

      /*
       * Setting the euler writes the quaternion, then the bind goes on the
       * right so it applies first. That order is what puts the swing in the
       * chest's frame rather than in the shoulder's own splayed bind frame,
       * where "forward" is eleven degrees out from where the eye expects it.
       */
      shoulder.rotation.set(
        lift * DRAG_SHOULDER_X,
        lift * DRAG_SHOULDER_Y,
        lift * DRAG_SHOULDER_Z,
      )
      shoulder.quaternion.multiply(shoulderBind)
      elbow.rotation.x = lift * DRAG_ELBOW_X

      emberMaterial.emissiveIntensity = EMBER_IDLE + draw * (EMBER_DRAW - EMBER_IDLE)
    },
  }
}

function requireNode(root: Object3D, name: string): Object3D {
  const found = root.getObjectByName(name)
  if (found === undefined) {
    throw new Error(`Rosie glTF is missing node "${name}"`)
  }
  return found
}

function smoothstep(t: number): number {
  const x = MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}
