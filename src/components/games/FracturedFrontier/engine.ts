// engine.ts
// Pure, deterministic game engine for Fractured Frontier.
//
// Design note (multiplayer sync — "Approach A: full-state sync + replay"):
// `resolveShot()` is the single source of truth for what a shot does. It takes
// the CURRENT authoritative state plus the shot's inputs (weapon/angle/power)
// and synchronously computes everything: trajectories, impacts, terrain
// deformation, damage, ammo, turn/round/wind transitions, and win condition.
// It also returns a frame-by-frame "replay" describing exactly what to animate.
//
// Both the firing client and the receiving client call this SAME function with
// the SAME inputs against the SAME prior state, so they always produce
// identical visuals and an identical resulting state — no physics or RNG ever
// runs independently on each client. The firing client submits `nextState` as
// the new `boardState`; the receiving client uses its own freshly-computed
// replay to animate, then snaps to the synced `nextState` as ground truth.
//
// NO Vue/Firebase knowledge lives here — pure functions and plain data only.

// ─── Constants ────────────────────────────────────────────────────────────────

export const CANVAS_W = 900
export const CANVAS_H = 450
export const GRAVITY = 0.12
export const TANK_W = 18
export const TANK_H = 10
export const TERRAIN_SEGMENTS = CANVAS_W
export const MAX_HEALTH = 100
export const MAX_ROUNDS = 10
export const MAX_SIM_STEPS = 4000

/** Total ground distance (px) a tank may traverse per turn.
 *  Tracks absolute travel (left+right both consume fuel), not net displacement. */
export const FUEL_PER_TURN = 150

/** Flat point bonus added to a winner's cumulative score on top of damage dealt.
 *  100 guarantees a win always outranks a loss: the most damage a LOSING player
 *  could ever deal is < MAX_HEALTH (dealing >= MAX_HEALTH damage means you won),
 *  so `damage + WIN_BONUS` for a win is always greater than any possible loss score. */
export const WIN_BONUS = 100

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlayerRole = 'host' | 'guest'
export type Phase = 'aiming' | 'firing' | 'results' | 'over'

export interface WeaponDef {
  id: string
  name: string
  icon: string
  desc: string
  radius: number
  damage: number
  color: string
  mirv?: boolean
  dirtDump?: boolean
  spread?: number
  /** Fan angle (degrees) between adjacent spread shots. Default 8. */
  fanDeg?: number
  /**
   * Power offsets for a corridor-style cluster — fires one shot per entry,
   * all at the same angle, each with `aimed_power + offset` power. Shots land
   * in a line along the trajectory at different ranges, flooding a corridor
   * rather than spraying outward like a fan.
   */
  powerOffsets?: number[]
  /** Horizontal beam cut — shaves terrain flat across the blast width instead of a circular crater. */
  beamCut?: boolean
  /** True beam weapon — fires a straight ray at the aimed angle, cuts terrain it passes through,
   *  deals damage on direct ship contact. Bypasses projectile simulation entirely. */
  beamWeapon?: boolean
  /**
   * Extra depth (px) the beam cuts below its centre-line.
   * Without this, the cut surface sits at exactly beam-y; terrain just outside the
   * cut zone that is a few pixels lower creates a visible raised shelf.
   * Setting beamDepth > 0 pushes the cut floor below the surroundings so the
   * channel always reads as a trench rather than a raised mesa.
   */
  beamDepth?: number
  /**
   * Max pixels of SOLID TERRAIN (beam centre underground) the beam can punch
   * through before stopping. Prevents the beam from slicing through arbitrarily
   * thick mountains.
   */
  penetration?: number
  /** Max number of terrain bounces before detonating. */
  bounces?: number
}

export interface ShipState {
  health: number
  shield: number
  ammo: Record<string, number>
  x: number
  y: number
}

export interface Point {
  x: number
  y: number
}

export interface LastShot {
  firedBy: PlayerRole
  weaponId: string
  angle: number
  power: number
  /** X position the shooter was at when they fired — set when they moved
   *  before shooting so the receiving client can replay from the correct spot. */
  movedToX?: number
}

export interface Engine {
  phase: Phase
  round: number
  maxRounds: number
  turn: PlayerRole
  wind: number
  variant: string
  terrain: number[]               // height map: terrain[x] = y (from top)
  ships: Record<PlayerRole, ShipState>
  totalDamageDealt: Record<PlayerRole, number>  // cumulative dmg each side has dealt TO THEIR OPPONENT
  winner: PlayerRole | null
  lastShot: LastShot | null
}

// ─── Weapons ──────────────────────────────────────────────────────────────────
// Shared, faction-neutral roster — both sides see and use identical weapons,
// by design (per Joshua: same names for both sides so it's never confusing for
// a student who plays as either faction).

export const WEAPONS: WeaponDef[] = [
  // 1 — Missiles
  { id: 'torpedo',  name: 'Photon Torpedo',        icon: '🔹', desc: 'Standard anti-ship round.',                           radius: 30,  damage: 30, color: '#5ec3ff' },
  // 2 — MIRVs
  { id: 'mirv',     name: 'Multi-Warhead Torpedo',  icon: '☢',  desc: 'Inflicts the damageof 4 warheads on impact.', radius: 25,  damage: 40, color: '#d86bff', mirv: true },
  // 3 — Napalm
  { id: 'napalm',   name: 'Plasma Fire',            icon: '🔥', desc: 'Rains burning plasma across the terrain',  radius: 22,  damage: 8,  color: '#ff7c20', powerOffsets: [-2, -1, 0, 1, 2] },
  // 4 — Earth
  { id: 'graviton', name: 'Graviton Charge',        icon: '🔶', desc: 'Buries the target under raised terrain.',             radius: 120, damage: 10, color: '#9b8866', dirtDump: true },
  // 5 — Beam / Energy
  { id: 'phaser',   name: 'Phaser Beam',             icon: '⚡', desc: 'Straight energy beam that cuts a channel through terrain.', radius: 30, damage: 35, color: '#ffd966', beamWeapon: true, beamDepth: 35, penetration: 100 },
  // 6 — Bouncing Bombs
  { id: 'bouncing', name: 'Bouncing Bomb',          icon: '💣', desc: 'Ricochets off terrain up to 3 times before detonating.', radius: 32, damage: 55, color: '#b0f080', bounces: 3 },
]

export const STARTING_AMMO: Record<string, number> = {
  mirv: 1,
  napalm: 4,
  graviton: 3,
  phaser: 2,
  bouncing: 3,
}

export function weaponById(id: string): WeaponDef | undefined {
  return WEAPONS.find(w => w.id === id)
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function opponentOf(role: PlayerRole): PlayerRole {
  return role === 'host' ? 'guest' : 'host'
}

/** host always occupies the left pad, guest the right — matches createInitialState/placement */
export function sideOf(role: PlayerRole): 'left' | 'right' {
  return role === 'host' ? 'left' : 'right'
}

// ─── Terrain & wind ───────────────────────────────────────────────────────────
// Terrain generation is a pure function of fixed constants — no RNG — so both
// clients regenerate an IDENTICAL battlefield independently if needed. Only
// wind uses RNG, and it is rolled exactly once per transition by whichever
// client computes that transition (see resolveShot/createInitialState), then
// synced — never re-rolled independently by the receiving client.

export function generateTerrain(): number[] {
  const h = CANVAS_H
  const w = TERRAIN_SEGMENTS
  const t = new Array(w).fill(0)

  for (let x = 0; x < w; x++) {
    const base = h * 0.55
    const wave1 = Math.sin((x / w) * Math.PI * 3) * 60
    const wave2 = Math.sin((x / w) * Math.PI * 7 + 1.2) * 25
    const wave3 = Math.sin((x / w) * Math.PI * 13 + 0.7) * 12
    t[x] = Math.round(base + wave1 + wave2 + wave3)
  }

  for (let i = 0; i < 3; i++) {
    for (let x = 1; x < w - 1; x++) {
      t[x] = Math.round((t[x - 1] + t[x] + t[x + 1]) / 3)
    }
  }

  for (let x = 0; x < w; x++) {
    t[x] = Math.max(80, Math.min(h - 20, t[x]))
  }

  return t
}

export function rollWind(): number {
  return parseFloat((Math.random() * 4 - 2).toFixed(1))
}

// ─── State factory ────────────────────────────────────────────────────────────

function createShip(terrain: number[], role: PlayerRole): ShipState {
  const margin = 80
  const x = role === 'host' ? margin : CANVAS_W - margin
  return {
    health: MAX_HEALTH,
    shield: 0,
    ammo: { ...STARTING_AMMO },
    x,
    y: terrain[x] - TANK_H,
  }
}

export function createInitialState(variant: string = 'standard'): Engine {
  const terrain = generateTerrain()
  return {
    phase: 'aiming',
    round: 1,
    maxRounds: MAX_ROUNDS,
    turn: 'host',
    wind: rollWind(),
    variant,
    terrain,
    ships: {
      host: createShip(terrain, 'host'),
      guest: createShip(terrain, 'guest'),
    },
    totalDamageDealt: { host: 0, guest: 0 },
    winner: null,
    lastShot: null,
  }
}

export function serializeState(state: Engine): string {
  return JSON.stringify(state)
}

export function deserializeState(json: string): Engine {
  return JSON.parse(json) as Engine
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
// Cumulative, win-or-lose: damage dealt to your opponent always counts, and a
// win adds a flat WIN_BONUS — guaranteeing wins always outrank loss-only scores
// while still rewarding a hard-fought loss and rewarding frequent play overall.

export function computeMatchScore(state: Engine, role: PlayerRole): number {
  const damage = state.totalDamageDealt[role] ?? 0
  const won = state.winner === role
  return damage + (won ? WIN_BONUS : 0)
}

// ─── Flight simulation ────────────────────────────────────────────────────────

interface Velocity { vx: number; vy: number }

interface FlightResult {
  points: Point[]
  endPoint: Point
  endVelocity: Velocity
}

function launchVelocity(shooter: ShipState, role: PlayerRole, angle: number, power: number): Velocity {
  const angleRad = (angle * Math.PI) / 180
  const p = power * 0.12
  const dir = role === 'host' ? 1 : -1
  return {
    vx: Math.cos(angleRad) * p * dir,
    vy: -Math.sin(angleRad) * p,
  }
}

/**
 * Steps a projectile forward until it terminates (terrain hit, off the left/
 * right edges, or a mid-flight hit on a ship). Returns the full point-by-point
 * path (for animation) plus where/how fast it ended.
 *
 * The top/bottom boundary is NOT a hard wall — shots that exit above y=0
 * continue in negative-y space; gravity curves them back. The renderer maps
 * any point with y<0 to y+CANVAS_H so the shot appears to "come back" from
 * the bottom of the canvas. Pure — same inputs always produce the same path.
 */
function simulateFlight(
  start: Point & Velocity,
  terrain: number[],
  ships: Record<PlayerRole, ShipState>,
  wind: number,
  firedBy: PlayerRole,
  maxBounces = 0,
): FlightResult {
  const points: Point[] = []
  let { x, y, vx, vy } = start
  let bouncesLeft = maxBounces

  for (let i = 0; i < MAX_SIM_STEPS; i++) {
    x += vx
    y += vy
    vy += GRAVITY
    vx += wind * 0.01
    points.push({ x, y })

    const ix = Math.round(x)
    // Terrain and ship collision only apply in the visible canvas band.
    // Shots above the canvas (y < 0) are in "open space" and pass through.
    const hitTerrain = y >= 0 && ix >= 0 && ix < CANVAS_W && y >= terrain[ix]

    if (hitTerrain) {
      if (bouncesLeft > 0) {
        // Reflect off terrain surface — flip vy upward with damping, scrub a
        // bit of horizontal speed for friction, and push above the surface so
        // the next step doesn't immediately re-trigger the collision.
        y = terrain[ix] - 1
        vy = -Math.abs(vy) * 0.65
        vx *= 0.85
        bouncesLeft--
        continue
      }
      return { points, endPoint: { x, y }, endVelocity: { vx, vy } }
    }

    const offScreen = x < -10 || x > CANVAS_W + 10 || y > CANVAS_H + 60
    if (offScreen) {
      return { points, endPoint: { x, y }, endVelocity: { vx, vy } }
    }

    for (const role of ['host', 'guest'] as PlayerRole[]) {
      // A projectile spawns at its own shooter's position, so the shooter's
      // tank must never count as a mid-flight collision target — otherwise
      // every shot detonates on launch. Splash damage from `applyExplosion`
      // can still hurt the shooter if they fire too close to their own hull;
      // this exclusion only prevents the impossible "hit yourself at the
      // muzzle" case.
      if (role === firedBy) continue
      const s = ships[role]
      if (s.health <= 0) continue
      if (Math.abs(x - s.x) < TANK_W / 2 + 5 && Math.abs(y - (s.y + TANK_H / 2)) < TANK_H + 5) {
        return { points, endPoint: { x, y }, endVelocity: { vx, vy } }
      }
    }
  }

  return { points, endPoint: { x, y }, endVelocity: { vx, vy } }
}

/** Deterministic MIRV split — same parent end-state always yields the same 4 children. */
function spawnMirvChildren(at: Point, parentVelocity: Velocity): (Point & Velocity)[] {
  const total = 4
  const children: (Point & Velocity)[] = []
  for (let i = 0; i < total; i++) {
    children.push({
      x: at.x,
      y: at.y,
      vx: (i - total / 2 + 0.5) * 1.5,
      vy: parentVelocity.vy * 0.3 - 1,
    })
  }
  return children
}

function applyExplosion(
  terrain: number[],
  ships: Record<PlayerRole, ShipState>,
  at: Point,
  weapon: WeaponDef,
): { terrain: number[]; ships: Record<PlayerRole, ShipState>; damageDealt: Record<PlayerRole, number> } {
  const newTerrain = terrain.slice()
  const radius = weapon.radius
  const lo = Math.max(0, Math.round(at.x - radius))
  const hi = Math.min(CANVAS_W, Math.round(at.x + radius))

  if (weapon.beamCut) {
    // Horizontal beam sweep — shaves a flat rectangle across the blast width.
    // Unlike the circular crater, every column in range gets an identical flat
    // cut of `beamDepth` pixels, which levels ridges rather than punching craters.
    const beamDepth = 22
    for (let x = lo; x < hi; x++) {
      newTerrain[x] = Math.min(CANVAS_H - 15, newTerrain[x] + beamDepth)
    }
  } else {
    for (let x = lo; x < hi; x++) {
      const dist = Math.abs(x - at.x)
      const delta = Math.sqrt(Math.max(0, radius * radius - dist * dist))
      if (weapon.dirtDump) {
        newTerrain[x] = Math.min(CANVAS_H - 15, newTerrain[x] - delta * 0.6)
      } else {
        newTerrain[x] = Math.min(CANVAS_H - 15, newTerrain[x] + delta * 0.55)
      }
    }
  }

  const newShips: Record<PlayerRole, ShipState> = {
    host: { ...ships.host, ammo: { ...ships.host.ammo } },
    guest: { ...ships.guest, ammo: { ...ships.guest.ammo } },
  }

  // Re-seat ships on the newly deformed terrain
  for (const role of ['host', 'guest'] as PlayerRole[]) {
    const s = newShips[role]
    if (s.health > 0) {
      const ix = Math.max(0, Math.min(CANVAS_W - 1, Math.round(s.x)))
      s.y = newTerrain[ix] - TANK_H
    }
  }

  const damageDealt: Record<PlayerRole, number> = { host: 0, guest: 0 }
  for (const role of ['host', 'guest'] as PlayerRole[]) {
    const s = newShips[role]
    if (s.health <= 0) continue
    const dx = s.x - at.x
    const dy = (s.y + TANK_H / 2) - at.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < radius + TANK_W) {
      let dmg = Math.round(weapon.damage * (1 - dist / (radius + TANK_W)))
      if (s.shield > 0) {
        const absorbed = Math.min(dmg, s.shield)
        s.shield -= absorbed
        dmg -= absorbed
      }
      s.health = Math.max(0, s.health - dmg)
      if (dmg > 0) damageDealt[role] += dmg
    }
  }

  return { terrain: newTerrain, ships: newShips, damageDealt }
}

// ─── Replay data (what the UI animates — identical on both clients) ──────────

export interface ExplosionEvent {
  x: number
  y: number
  radius: number
  color: string
  /**
   * Authoritative terrain + ship snapshot the INSTANT this explosion lands —
   * carving/damage applies immediately on impact (matching the original sim),
   * with the VFX playing on top of the already-updated battlefield. Both
   * clients reach this exact snapshot via the same pure computation, so the
   * UI can snap its live preview to it the moment the explosion begins and
   * stay perfectly in lockstep without waiting for the final synced state.
   */
  resultingTerrain: number[]
  resultingShips: Record<PlayerRole, ShipState>
}

export interface FlightSegment {
  weaponId: string
  points: Point[]
  /** Explosion to play once this flight's path finishes, or null if it fizzled (e.g. a MIRV parent that silently splits). */
  explosion: ExplosionEvent | null
}

export interface ShotReplay {
  firedBy: PlayerRole
  weaponId: string
  /** Ordered groups of simultaneous flights — usually one group of one flight;
   *  a MIRV shot is [ [parent], [child1, child2, child3, child4] ]. */
  groups: FlightSegment[][]
  damageDealt: Record<PlayerRole, number>
  hitMessage: string
}

export interface ShotResolution {
  nextState: Engine
  replay: ShotReplay
}

// ─── The single source of truth: resolve a shot end-to-end ───────────────────

export function resolveShot(state: Engine, firedBy: PlayerRole, weaponId: string, angle: number, power: number): ShotResolution {
  const weapon = weaponById(weaponId)
  if (!weapon) throw new Error(`Unknown weapon id: ${weaponId}`)

  const shooter = state.ships[firedBy]
  if (weapon.id !== 'torpedo' && (shooter.ammo[weapon.id] ?? 0) <= 0) {
    throw new Error(`${firedBy} has no ammo remaining for ${weapon.id}`)
  }

  let terrain = state.terrain.slice()
  let ships: Record<PlayerRole, ShipState> = {
    host: { ...state.ships.host, ammo: { ...state.ships.host.ammo } },
    guest: { ...state.ships.guest, ammo: { ...state.ships.guest.ammo } },
  }

  // Deduct ammo up front (torpedo is infinite)
  if (weapon.id !== 'torpedo') {
    ships[firedBy].ammo[weapon.id] = (ships[firedBy].ammo[weapon.id] ?? 0) - 1
  }

  const groups: FlightSegment[][] = []
  const totalDamageThisShot: Record<PlayerRole, number> = { host: 0, guest: 0 }

  /** Snapshot helper — captures terrain + ships immediately after an impact resolves,
   *  so the replay can carry an authoritative checkpoint for that exact instant. */
  const snapshot = (): { resultingTerrain: number[]; resultingShips: Record<PlayerRole, ShipState> } => ({
    resultingTerrain: terrain.slice(),
    resultingShips: {
      host: { ...ships.host, ammo: { ...ships.host.ammo } },
      guest: { ...ships.guest, ammo: { ...ships.guest.ammo } },
    },
  })

  const fireOne = (fireAngle: number, w: WeaponDef, firePower = power): FlightSegment => {
    const launch = launchVelocity(shooter, firedBy, fireAngle, firePower)
    const flight = simulateFlight({ x: shooter.x, y: shooter.y + TANK_H / 2, ...launch }, terrain, ships, state.wind, firedBy, w.bounces ?? 0)
    const result = applyExplosion(terrain, ships, flight.endPoint, w)
    terrain = result.terrain
    ships = result.ships
    totalDamageThisShot.host += result.damageDealt.host
    totalDamageThisShot.guest += result.damageDealt.guest
    return {
      weaponId: weapon.id,
      points: flight.points,
      explosion: { x: flight.endPoint.x, y: flight.endPoint.y, radius: w.radius, color: w.color, ...snapshot() },
    }
  }

  if (weapon.mirv) {
    const launch = launchVelocity(shooter, firedBy, angle, power)
    const parentFlight = simulateFlight({ x: shooter.x, y: shooter.y + TANK_H / 2, ...launch }, terrain, ships, state.wind, firedBy)

    // Parent flies, then silently splits — no explosion of its own
    groups.push([{ weaponId: weapon.id, points: parentFlight.points, explosion: null }])

    const childWeapon: WeaponDef = { ...weapon, mirv: false, radius: weapon.radius * 0.7 }
    const children = spawnMirvChildren(parentFlight.endPoint, parentFlight.endVelocity)
    const childGroup: FlightSegment[] = []

    for (const child of children) {
      const flight = simulateFlight(child, terrain, ships, state.wind, firedBy)
      const result = applyExplosion(terrain, ships, flight.endPoint, childWeapon)
      terrain = result.terrain
      ships = result.ships
      totalDamageThisShot.host += result.damageDealt.host
      totalDamageThisShot.guest += result.damageDealt.guest
      childGroup.push({
        weaponId: weapon.id,
        points: flight.points,
        explosion: { x: flight.endPoint.x, y: flight.endPoint.y, radius: childWeapon.radius, color: weapon.color, ...snapshot() },
      })
    }
    groups.push(childGroup)
  } else if (weapon.powerOffsets && weapon.powerOffsets.length > 0) {
    // Corridor pattern — all shots at the same angle, each at a different power.
    // They follow the same arc but land at different distances, flooding a line
    // of terrain rather than spraying outward like a fan.
    const group: FlightSegment[] = []
    for (const offset of weapon.powerOffsets) {
      const firePower = Math.max(5, Math.min(100, power + offset))
      group.push(fireOne(angle, weapon, firePower))
    }
    groups.push(group)
  } else if (weapon.beamWeapon) {
    // ─ Straight beam: ray-trace at aimed angle, cut terrain, zap ship on contact ─
    const angleRad = (angle * Math.PI) / 180
    const dir = firedBy === 'host' ? 1 : -1
    const stepX = Math.cos(angleRad) * dir * 2   // 2-pixel steps
    const stepY = -Math.sin(angleRad) * 2         // canvas y increases downward

    const newTerrain = terrain.slice()
    const newShips: Record<PlayerRole, ShipState> = {
      host: { ...ships.host, ammo: { ...ships.host.ammo } },
      guest: { ...ships.guest, ammo: { ...ships.guest.ammo } },
    }

    // Start from the barrel tip
    const barrelLen = 18
    let bx = shooter.x + Math.cos(angleRad) * dir * barrelLen
    let by = (shooter.y + TANK_H / 2) - Math.sin(angleRad) * barrelLen

    const beamDepth   = weapon.beamDepth   ?? 0
    const maxPenetr   = weapon.penetration ?? 9999
    let   ugDist      = 0   // cumulative pixels the beam CENTRE has spent underground

    const beamPoints: Point[] = []
    let hitShipRole: PlayerRole | null = null

    while (bx >= -5 && bx <= CANVAS_W + 5 && by >= -10 && by <= CANVAS_H + 10) {
      beamPoints.push({ x: bx, y: by })

      const ix = Math.round(bx)
      if (ix >= 0 && ix < CANVAS_W && by >= 0) {
        const origSurface = newTerrain[ix]
        // Cut floor = beam centre + beamDepth. Any terrain surface above this
        // line gets shaved down, creating a channel beamDepth pixels wider than
        // the beam's own centre line (prevents the raised-shelf artefact).
        const cutLine = Math.min(CANVAS_H - 15, Math.round(by) + beamDepth)
        if (origSurface < cutLine) {
          newTerrain[ix] = cutLine
        }

        // Penetration tracking: accumulate every step where the beam CENTRE
        // is underground. The counter is intentionally NOT reset when the beam
        // briefly exits terrain — a rough mountaintop would otherwise allow
        // unlimited tunnelling by repeatedly clearing the counter.
        if (origSurface < by) {
          ugDist += 2
          if (ugDist > maxPenetr) break
        }
      }

      // First opponent-ship contact → record hit (keep tracing for terrain cut)
      if (hitShipRole === null) {
        for (const role of ['host', 'guest'] as PlayerRole[]) {
          if (role === firedBy) continue
          const s = newShips[role]
          if (s.health <= 0) continue
          if (Math.abs(bx - s.x) < TANK_W / 2 + 4 && Math.abs(by - (s.y + TANK_H / 2)) < TANK_H + 4) {
            hitShipRole = role
          }
        }
      }

      bx += stepX
      by += stepY
    }

    // Apply ship damage
    if (hitShipRole) {
      const s = newShips[hitShipRole]
      let dmg = weapon.damage
      if (s.shield > 0) {
        const absorbed = Math.min(dmg, s.shield)
        s.shield -= absorbed
        dmg -= absorbed
      }
      s.health = Math.max(0, s.health - dmg)
      if (dmg > 0) totalDamageThisShot[hitShipRole] += dmg
    }

    // Commit to outer mutable state
    terrain = newTerrain
    ships = newShips

    // ── Settle beam cut edges → traversable slopes ─────────────────────────
    // The beam leaves sheer vertical cliffs (terrain steps of 30–40 px).
    // Multiple passes of 3-point averaging on steep columns converts those
    // cliffs into gentle ramps that tanks can actually drive up and over.
    // The flat cut floor is unaffected — both its neighbours are at the same
    // depth so no step is detected and no averaging runs there.
    for (let pass = 0; pass < 14; pass++) {
      for (let x = 1; x < CANVAS_W - 1; x++) {
        if (Math.abs(terrain[x] - terrain[x - 1]) > 5 ||
            Math.abs(terrain[x] - terrain[x + 1]) > 5) {
          terrain[x] = Math.round((terrain[x - 1] + terrain[x] + terrain[x + 1]) / 3)
        }
      }
    }

    // Re-seat ships on settled terrain (done after settling so ships land
    // on the smoothed surface, not the raw cliff edge)
    for (const role of ['host', 'guest'] as PlayerRole[]) {
      const s = ships[role]
      if (s.health > 0) {
        const ix = Math.max(0, Math.min(CANVAS_W - 1, Math.round(s.x)))
        s.y = terrain[ix] - TANK_H
      }
    }

    const beamSnap = snapshot()
    // Always include a non-null explosion so the resultingTerrain snapshot
    // is applied to displayTerrain the moment the beam finishes sweeping.
    // On a ship hit, the radius is visible; on a miss it's a tiny terminal spark.
    const lastPt = beamPoints[beamPoints.length - 1] ?? { x: shooter.x, y: shooter.y }
    groups.push([{
      weaponId: weapon.id,
      points: beamPoints,
      explosion: {
        x: hitShipRole ? ships[hitShipRole].x : lastPt.x,
        y: hitShipRole ? ships[hitShipRole].y + TANK_H / 2 : lastPt.y,
        radius: hitShipRole ? weapon.radius : 6,
        color: weapon.color,
        ...beamSnap,
      },
    }])

  } else if (weapon.spread && weapon.spread > 1) {
    // Deterministic fan pattern — `spread` projectiles launched simultaneously,
    // evenly fanned around the aimed angle. Fan angle between shots is
    // weapon.fanDeg (default 8°).
    const FAN_DEGREES = weapon.fanDeg ?? 8
    const count = weapon.spread
    const startOffset = -((count - 1) / 2) * FAN_DEGREES
    const group: FlightSegment[] = []
    for (let i = 0; i < count; i++) {
      group.push(fireOne(angle + startOffset + i * FAN_DEGREES, weapon))
    }
    groups.push(group)
  } else {
    groups.push([fireOne(angle, weapon)])
  }

  // ─ Build the human-readable hit message (faction-agnostic; UI adds names) ─
  const hitParts: string[] = []
  if (totalDamageThisShot.host > 0) hitParts.push(`host:-${totalDamageThisShot.host}`)
  if (totalDamageThisShot.guest > 0) hitParts.push(`guest:-${totalDamageThisShot.guest}`)
  const hitMessage = hitParts.length ? hitParts.join(' ') : 'missed'

  // ─ Tally cumulative "damage dealt to opponent" for scoring ─
  const opponent = opponentOf(firedBy)
  const totalDamageDealt: Record<PlayerRole, number> = {
    ...state.totalDamageDealt,
    [firedBy]: state.totalDamageDealt[firedBy] + totalDamageThisShot[opponent],
  }

  // ─ Win condition / turn & round transition ─
  const alive: PlayerRole[] = (['host', 'guest'] as PlayerRole[]).filter(r => ships[r].health > 0)
  let phase: Phase
  let winner: PlayerRole | null = null
  let turn = state.turn
  let round = state.round
  let wind = state.wind

  if (alive.length <= 1 || state.round >= state.maxRounds) {
    phase = 'over'
    if (alive.length === 1) {
      winner = alive[0]
    } else if (alive.length === 2) {
      // Round limit reached with both ships still standing — higher remaining health wins;
      // an exact tie is a draw. (Mirrors a "time's up" ruling, not in the original prototype.)
      const h = ships.host.health
      const g = ships.guest.health
      winner = h === g ? null : h > g ? 'host' : 'guest'
    } else {
      winner = null
    }
  } else {
    phase = 'results'
    turn = opponentOf(firedBy)
    if (turn === 'host') {
      round = state.round + 1
      wind = rollWind()
    }
  }

  const nextState: Engine = {
    ...state,
    phase,
    round,
    turn,
    wind,
    terrain,
    ships,
    totalDamageDealt,
    winner,
    lastShot: { firedBy, weaponId, angle, power },
  }

  return {
    nextState,
    replay: { firedBy, weaponId, groups, damageDealt: totalDamageThisShot, hitMessage },
  }
}

/**
 * Advance from 'results' to the next 'aiming' turn (or 'over'). Pure — mirrors
 * the original endTurn() logic, but as a state transform rather than a timer
 * callback, so both clients reach the same place. In practice resolveShot()
 * already computes the next turn/phase; this exists for symmetry/clarity when
 * the UI wants to move from showing the result banner to the next aim screen.
 */
export function beginNextTurn(state: Engine): Engine {
  if (state.phase === 'over') return state
  return { ...state, phase: 'aiming' }
}
