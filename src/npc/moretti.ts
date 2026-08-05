import { Box3, Group, MathUtils, Vector3 } from 'three'
import type { Mesh, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { PLAYER } from '../core/config.ts'
import type { CollisionSolver } from '../world/collision.ts'

/**
 * Constable Moretti. Miller's offsider, and the only thing in scene 1 that
 * moves under its own steam.
 *
 * BRIEF.md: he follows on the navmesh, he bags what Miller tags, and he
 * theorises at the exit. He is not AI. There is no pursuit, no flee, no
 * steering behaviour and nothing to lose him.
 *
 * Geometry comes from public/models/moretti.glb. This file is the only one
 * that knows about the glTF.
 *
 * ## He walks where Miller walked
 *
 * Following is a breadcrumb trail, not a pathfinder. Miller drops a crumb every
 * `CRUMB_SPACING` and Moretti walks the crumbs in order, keeping `STANDOFF`
 * behind.
 *
 * That is the whole navigation system and it is the right one here. The
 * walkable set is axis-aligned boxes, not a graph, so there is nothing to run
 * A* over without building one first. A trail also gets the stairs, the
 * doorways and the verandah for free, because Miller has already proved every
 * step of the route is walkable by standing on it. A steering behaviour would
 * have to rediscover all of that and would wedge itself on the first doorframe.
 *
 * He still resolves every move against the collision solver. The trail says
 * where to go, not where he ends up, so a crumb laid while Miller was leaning
 * through a doorway cannot push him into the frame.
 */

const MODEL_URL = '/models/moretti.glb'

export type MorettiState = 'waiting' | 'following' | 'approaching' | 'bagging'

/** He waits at the tape until Miller walks past him. */
const SPAWN = new Vector3(2.2, -0.72, -1.9)
const SPAWN_YAW = Math.PI

/**
 * How close Miller has to get before Moretti falls in behind.
 *
 * Without this he would walk the whole trail from wherever it starts, which
 * means following Miller's route from the far end of the footpath rather than
 * from where he was standing.
 */
const PICKUP = 4.5

const CRUMB_SPACING = 0.36
/** Roughly 70 metres of trail. Far more than any room-to-room leg needs. */
const CRUMB_LIMIT = 200

/**
 * How far back he keeps. ASSETS.md: "never closer than two metres", which is a
 * note about how much of him has to hold up, and is also just how an offsider
 * stands.
 */
const STANDOFF = 2.0
/**
 * Closer than this and he gets out of the way.
 *
 * He is solid, and an offsider who holds station two metres back is standing
 * exactly where Miller walks when Miller turns round. On a staircase that is a
 * wall: found by walking up the flight, turning at the top and finding the
 * constable parked across the treads.
 *
 * So he backs off along the line away from Miller rather than holding. The
 * solver refuses anything that runs out of floor, so on a flight he retreats
 * down it and in a room he gives ground, which is what a person does.
 */
const YIELD = 1.35
const WALK_SPEED = 2.45
const TURN_RATE = 6.5
const ARRIVE = 0.12

/** Reach for a tagged object. He stops this far off it and crouches. */
const BAG_RANGE = 0.85
const BAG_CROUCH = 0.5
const BAG_HOLD = 1.1

const STAND_HEIGHT = 1.82
const GIRTH = 0.28

/** Local Y of the head joint, from the build script's HEIGHT_HEAD. */
const HEAD_Y = 1.68
const HEAD_YAW_LIMIT = 0.7
const HEAD_GIVE_UP = 1.4
const HEAD_RANGE = 5.0
const HEAD_RESPONSE = 5.0
/**
 * Standing still, he turns to face Miller if Miller is inside this.
 *
 * Without it he keeps whatever heading he stopped on, which means holding
 * station two metres ahead with his back to you while you talk at his
 * shoulders. The head tracking cannot save it: Miller is usually directly
 * behind him, which is past where a neck goes.
 */
const ATTEND = 3.2
const ATTEND_TURN = 2.6

/** Metres per half stride. Sets how fast the legs cycle against real travel. */
const STRIDE = 0.72
const THIGH_SWING = 0.52
const KNEE_FLEX = 0.95
const ARM_SWING = 0.34

export interface Moretti {
  readonly root: Group
  /**
   * One box, and it is empty while he is walking.
   *
   * He resolves his own moves against the same solver Miller uses, so a solid
   * of his own would eject him from himself every frame. Collapsing it while he
   * moves is not a fudge: he is only ever an obstacle worth having when he is
   * standing still, which is exactly when it is back.
   */
  readonly solids: Box3[]
  readonly state: MorettiState
  readonly position: Vector3
  /**
   * Call him over to bag something. `onBagged` fires when he has.
   *
   * @param target       The object, for him to face and crouch at.
   * @param approachFrom Somewhere he can actually stand to reach it. Miller's
   *   own feet, because Miller had to be within arm's length to tag it, so that
   *   spot is reachable by construction and the object may not be.
   */
  sendTo(target: Vector3, approachFrom: Vector3, objectId: string): void
  onBagged: ((objectId: string) => void) | undefined
  update(delta: number, playerFeet: Vector3): void
}

export async function buildMoretti(solver: CollisionSolver): Promise<Moretti> {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL)

  const root = new Group()
  root.name = 'moretti'
  root.add(gltf.scene)
  root.position.copy(SPAWN)
  root.rotation.y = SPAWN_YAW

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
  const legs = (['l', 'r'] as const).map((tag) => ({
    hip: requireNode(gltf.scene, `leg_${tag}_0`),
    knee: requireNode(gltf.scene, `leg_${tag}_1`),
    foot: requireNode(gltf.scene, `foot_${tag}`),
  }))
  const arms = (['l', 'r'] as const).map((tag) => {
    const shoulder = requireNode(gltf.scene, `arm_${tag}_0`)
    return {
      shoulder,
      elbow: requireNode(gltf.scene, `arm_${tag}_1`),
      bind: shoulder.quaternion.clone(),
    }
  })

  const hipsY = hips.position.y

  const solids: Box3[] = [new Box3()]
  const position = SPAWN.clone()

  const crumbs: Vector3[] = []
  const lastCrumb = new Vector3().copy(SPAWN)
  let hasCrumbed = false

  let state: MorettiState = 'waiting'
  let yaw = SPAWN_YAW
  let elapsed = 0
  let stridePhase = 0
  let headYaw = 0
  let headPitch = 0
  let crouch = 0

  let onBagged: ((objectId: string) => void) | undefined = undefined

  const bagTarget = new Vector3()
  /** The trail as it stood when he was called, plus the spot to stand on. */
  const route: Vector3[] = []
  let stalled = 0
  let bagObjectId: string | undefined = undefined
  let bagTimer = 0

  const scratch = new Vector3()
  const step = new Vector3()
  const before = new Vector3()
  const goalPoint = new Vector3()

  function setSolid(present: boolean): void {
    if (!present) {
      solids[0].makeEmpty()
      return
    }
    solids[0].min.set(position.x - GIRTH, position.y, position.z - GIRTH)
    solids[0].max.set(position.x + GIRTH, position.y + STAND_HEIGHT, position.z + GIRTH)
  }

  setSolid(true)

  /**
   * Drop everything on the trail before the crumb he is nearest.
   *
   * Walking the queue from the front assumes he is always at the old end of it,
   * and yielding breaks that assumption completely: he backs down a flight
   * while Miller lays fresh crumbs coming down after him, so he ends up beside
   * the newest crumb with the whole outbound route still queued in front. Then
   * Miller stops, the yield releases, and he sets off back up the stairs to
   * walk the route again from the beginning.
   *
   * Rejoining at the nearest point makes the trail self-correcting. Wherever he
   * has been shoved, he picks it up where he actually is.
   *
   * Distance is full 3D on purpose. The staircase passes within a metre of the
   * hall below it in plan, and a flat comparison would have him rejoin on the
   * wrong floor.
   */
  function rejoin(trail: Vector3[]): void {
    if (trail.length < 2) {
      return
    }
    let best = 0
    let bestDistance = Infinity
    for (let i = 0; i < trail.length; i += 1) {
      const d = trail[i].distanceToSquared(position)
      if (d < bestDistance) {
        bestDistance = d
        best = i
      }
    }
    if (best > 0) {
      trail.splice(0, best)
    }
  }

  /** Move toward a world point. Returns how far he actually got. */
  function walkToward(goal: Vector3, delta: number): number {
    step.set(goal.x - position.x, 0, goal.z - position.z)
    const distance = step.length()
    if (distance < 1e-4) {
      return 0
    }
    const travel = Math.min(WALK_SPEED * delta, distance)
    step.multiplyScalar(travel / distance)

    // Empty while he moves, or the pushout ejects him from his own box.
    setSolid(false)
    before.copy(position)
    scratch.copy(position).add(step)
    const resolved = solver.resolve(position, scratch, GIRTH)
    const moved = Math.hypot(resolved.x - before.x, resolved.z - before.z)
    position.copy(resolved)
    root.position.copy(position)

    if (moved > 1e-4) {
      // Face where he actually went, not where he was told to go. A crumb round
      // a corner would otherwise have him walking sideways into the jamb, and
      // the solver has already slid him along it.
      const want = Math.atan2(-(resolved.x - before.x), -(resolved.z - before.z))
      yaw = turnToward(yaw, want, TURN_RATE * delta)
    }
    return moved
  }

  function poseWalk(moved: number): void {
    stridePhase += (moved / STRIDE) * Math.PI
    for (let i = 0; i < legs.length; i += 1) {
      const leg = legs[i]
      const phase = stridePhase + (i === 0 ? 0 : Math.PI)
      const swing = Math.sin(phase) * THIGH_SWING
      // A knee only bends one way, and the shin hangs down -Y, so the flex has
      // to be negative or he walks with his shins through his thighs.
      const flex = Math.max(0, -Math.sin(phase - 0.55)) * KNEE_FLEX
      leg.hip.rotation.x = swing
      leg.knee.rotation.x = -flex
      leg.foot.rotation.x = -swing * 0.4 + flex * 0.5
    }
    for (let i = 0; i < arms.length; i += 1) {
      const arm = arms[i]
      // Opposite the leg on the same side, which is what walking is.
      const phase = stridePhase + (i === 0 ? Math.PI : 0)
      arm.shoulder.rotation.set(Math.sin(phase) * ARM_SWING, 0, 0)
      arm.shoulder.quaternion.multiply(arm.bind)
      arm.elbow.rotation.x = 0.18 + Math.max(0, Math.sin(phase)) * 0.35
    }
    // Two bobs a stride, not one. A body rises over each straight leg.
    hips.position.y = hipsY + Math.abs(Math.sin(stridePhase)) * 0.018
  }

  function poseStand(delta: number): void {
    const ease = 1 - Math.exp(-8 * delta)
    for (const leg of legs) {
      leg.hip.rotation.x += (crouch * 0.95 - leg.hip.rotation.x) * ease
      leg.knee.rotation.x += (-crouch * 1.5 - leg.knee.rotation.x) * ease
      leg.foot.rotation.x += (crouch * 0.55 - leg.foot.rotation.x) * ease
    }
    for (let i = 0; i < arms.length; i += 1) {
      const arm = arms[i]
      // Right arm reaches for what he is bagging. Left one stays out of it.
      const reach = i === 1 ? crouch : crouch * 0.25
      arm.shoulder.rotation.set(reach * 0.55, 0, 0)
      arm.shoulder.quaternion.multiply(arm.bind)
      arm.elbow.rotation.x += (0.18 + reach * 0.5 - arm.elbow.rotation.x) * ease
    }
    hips.position.y += (hipsY - crouch * BAG_CROUCH - hips.position.y) * ease
    chest.rotation.x = crouch * 0.42 + Math.sin(elapsed * 1.15) * 0.011
    stridePhase = 0
  }

  function aimHead(delta: number, at: Vector3): void {
    scratch.copy(at)
    root.worldToLocal(scratch)
    const flat = Math.hypot(scratch.x, scratch.z)
    const raw = Math.atan2(-scratch.x, -scratch.z)

    let wantYaw = 0
    let wantPitch = 0
    if (flat < HEAD_RANGE && Math.abs(raw) < HEAD_GIVE_UP) {
      wantYaw = MathUtils.clamp(raw, -HEAD_YAW_LIMIT, HEAD_YAW_LIMIT)
      wantPitch = MathUtils.clamp(Math.atan2(scratch.y - HEAD_Y, flat), -0.5, 0.35)
    }
    const ease = 1 - Math.exp(-HEAD_RESPONSE * delta)
    headYaw += (wantYaw - headYaw) * ease
    headPitch += (wantPitch - headPitch) * ease
    head.rotation.y = headYaw
    head.rotation.x = headPitch
  }

  return {
    root,
    solids,
    position,
    get state(): MorettiState {
      return state
    },

    get onBagged(): ((objectId: string) => void) | undefined {
      return onBagged
    },
    set onBagged(handler: ((objectId: string) => void) | undefined) {
      onBagged = handler
    },

    sendTo(target: Vector3, approachFrom: Vector3, objectId: string): void {
      bagTarget.copy(target)
      /*
       * Freeze the trail as it stands, and put Miller's spot on the end of it.
       *
       * Walking straight at the object does not work: he steers into the first
       * armchair between him and it and wedges there, because a straight line
       * is not a route. Miller's crumbs are a route, and they end exactly where
       * somebody was standing when they could reach the thing.
       *
       * Frozen, not live, so Miller wandering off after tagging does not drag
       * him away from the job.
       */
      route.length = 0
      for (const crumb of crumbs) {
        route.push(crumb.clone())
      }
      route.push(approachFrom.clone())
      bagObjectId = objectId
      bagTimer = 0
      stalled = 0
      state = 'approaching'
    },

    update(delta: number, playerFeet: Vector3): void {
      elapsed += delta
      let moved = 0

      if (state === 'waiting') {
        if (playerFeet.distanceTo(position) < PICKUP) {
          // Start the trail here. Anything Miller laid getting to us is a route
          // we are already standing at the end of.
          crumbs.length = 0
          lastCrumb.copy(playerFeet)
          hasCrumbed = true
          state = 'following'
        }
      }

      if (state !== 'waiting') {
        if (!hasCrumbed || playerFeet.distanceTo(lastCrumb) >= CRUMB_SPACING) {
          crumbs.push(playerFeet.clone())
          lastCrumb.copy(playerFeet)
          hasCrumbed = true
          if (crumbs.length > CRUMB_LIMIT) {
            crumbs.shift()
          }
        }
      }

      if (state === 'approaching') {
        rejoin(route)
        const goal = route[0]
        const gap = Math.hypot(bagTarget.x - position.x, bagTarget.z - position.z)
        if (goal !== undefined) {
          moved = walkToward(goal, delta)
          if (Math.hypot(goal.x - position.x, goal.z - position.z) < ARRIVE) {
            route.shift()
          }
        }
        // Stalled means something is in the way that the route did not know
        // about, most likely Miller himself standing on the spot. Close enough
        // to reach is close enough to bag; a constable frozen against a chair
        // is a worse outcome than one who reaches a little further.
        stalled = moved > 1e-4 ? 0 : stalled + delta
        if (route.length === 0 || (stalled > 1.2 && gap < BAG_RANGE * 3)) {
          state = 'bagging'
          bagTimer = 0
        }
      } else if (state === 'bagging') {
        bagTimer += delta
        // Down, hold, up. The hold is the only part the player reads.
        const total = BAG_HOLD + 1.4
        crouch = bagTimer < 0.7 ? smoothstep(bagTimer / 0.7)
          : bagTimer < 0.7 + BAG_HOLD ? 1
            : 1 - smoothstep((bagTimer - 0.7 - BAG_HOLD) / 0.7)
        // Face what he came for.
        yaw = turnToward(yaw, Math.atan2(-(bagTarget.x - position.x), -(bagTarget.z - position.z)), TURN_RATE * delta)
        if (bagTimer >= total) {
          crouch = 0
          const done = bagObjectId
          bagObjectId = undefined
          state = 'following'
          // Drop the trail. He is standing somewhere Miller may never have been.
          crumbs.length = 0
          hasCrumbed = false
          if (done !== undefined) {
            onBagged?.(done)
          }
        }
      } else if (state === 'following' && playerFeet.distanceTo(position) < YIELD) {
        step.set(position.x - playerFeet.x, 0, position.z - playerFeet.z)
        if (step.lengthSq() < 1e-6) {
          // Dead on top of him. Any direction will do, and the solver will
          // refuse it if there is no floor that way.
          step.set(0, 0, 1)
        }
        // Its own vector, not `scratch`: walkToward uses that one internally
        // and would overwrite the goal it was handed.
        goalPoint.copy(position).addScaledVector(step.normalize(), YIELD)
        goalPoint.y = position.y
        moved = walkToward(goalPoint, delta)
      } else if (state === 'following') {
        rejoin(crumbs)
        const goal = crumbs[0]
        if (goal !== undefined) {
          // How much trail is left, so he holds station rather than closing all
          // the way in whenever Miller stops.
          const toGoal = Math.hypot(goal.x - position.x, goal.z - position.z)
          const remaining = toGoal + (crumbs.length - 1) * CRUMB_SPACING
          if (remaining > STANDOFF) {
            moved = walkToward(goal, delta)
          }
          if (toGoal < ARRIVE) {
            crumbs.shift()
          }
        }
      }

      if (moved > 1e-4) {
        crouch = 0
        chest.rotation.x = 0
        poseWalk(moved)
      } else {
        poseWalk(0)
        poseStand(delta)
        if (state === 'following' && playerFeet.distanceTo(position) < ATTEND) {
          yaw = turnToward(
            yaw,
            Math.atan2(-(playerFeet.x - position.x), -(playerFeet.z - position.z)),
            ATTEND_TURN * delta,
          )
        }
      }

      root.rotation.y = yaw
      setSolid(moved <= 1e-4)

      scratch.copy(playerFeet)
      scratch.y += PLAYER.eyeHeightStand
      aimHead(delta, scratch)
    },
  }
}

function requireNode(root: Object3D, name: string): Object3D {
  const found = root.getObjectByName(name)
  if (found === undefined) {
    throw new Error(`Moretti glTF is missing node "${name}"`)
  }
  return found
}

/** Shortest way round, so he never spins the long way through 180 degrees. */
function turnToward(from: number, to: number, maxStep: number): number {
  let diff = (to - from) % (Math.PI * 2)
  if (diff > Math.PI) {
    diff -= Math.PI * 2
  }
  if (diff < -Math.PI) {
    diff += Math.PI * 2
  }
  return from + MathUtils.clamp(diff, -maxStep, maxStep)
}

function smoothstep(t: number): number {
  const x = MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}
