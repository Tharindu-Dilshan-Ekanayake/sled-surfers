import { BufferAttribute, CanvasTexture, ClampToEdgeWrapping, LinearMipmapLinearFilter, NearestFilter, PlaneGeometry, SRGBColorSpace } from 'three'

import { FREE_COINS_STATUE, LAUNCH_PAD, LEADERBOARDS, PEDESTALS, PLAZA, SPAWN, WORLDS_PORTAL } from '@shared/world'

import { PALETTE } from '../sceneStyle'

/**
 * The plaza floor: one big plane whose colours come from a tiny "ground map" texture
 * painted at one texel per world unit - white snow, with paths trodden a shade bluer
 * between the places people walk to and an ice rink by the leaderboards. The whole
 * floor is a single draw call regardless of how many painted regions it has.
 */

const MAP = { minX: PLAZA.minX - 10, maxX: PLAZA.maxX + 10, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ + 8 }
const MAP_W = MAP.maxX - MAP.minX
const MAP_H = MAP.maxZ - MAP.minZ

/** Where the ground plane ends to the north: the slide's own floor takes over there. */
export const GROUND_NORTH_EDGE = PLAZA.minZ

function painter(ctx) {
  const rect = (r, color) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(r.minX - MAP.minX), Math.round(r.minZ - MAP.minZ), Math.round(r.maxX - r.minX), Math.round(r.maxZ - r.minZ))
  }
  const disc = (x, z, radius, color) => {
    ctx.fillStyle = color
    for (let dz = -radius; dz < radius; dz += 1) {
      for (let dx = -radius; dx < radius; dx += 1) {
        if ((dx + 0.5) ** 2 + (dz + 0.5) ** 2 <= radius * radius) ctx.fillRect(Math.floor(x + dx - MAP.minX), Math.floor(z + dz - MAP.minZ), 1, 1)
      }
    }
  }
  return { rect, disc }
}

export function createGroundMap(maxTexture) {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_W
  canvas.height = MAP_H
  const ctx = canvas.getContext('2d')
  const { rect, disc } = painter(ctx)

  rect(MAP, PALETTE.plaza)
  // A trodden path from spawn up to the boardwalk, and round past the stands.
  rect({ minX: -4, maxX: 4, minZ: PLAZA.minZ, maxZ: SPAWN.z + 4 }, PALETTE.path)
  rect({ minX: -26, maxX: 26, minZ: SPAWN.z - 3, maxZ: SPAWN.z + 3 }, PALETTE.path)
  for (const p of PEDESTALS) disc(p.x, p.z, 5, PALETTE.path)
  disc(WORLDS_PORTAL.x, WORLDS_PORTAL.z + 2, 5, PALETTE.path)
  disc(FREE_COINS_STATUE.x, FREE_COINS_STATUE.z, 5, PALETTE.path)
  // The ice rink in front of the leaderboards.
  rect({ minX: LEADERBOARDS[0].x - 4, maxX: LEADERBOARDS[2].x + 4, minZ: LEADERBOARDS[0].z - 9, maxZ: LEADERBOARDS[0].z - 2 }, PALETTE.ice)
  // The deck up to the slingshot.
  rect({ minX: -7, maxX: 7, minZ: PLAZA.minZ, maxZ: LAUNCH_PAD.z + 20 }, PALETTE.path)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.anisotropy = maxTexture > 512 ? 4 : 1
  return texture
}

/**
 * The ground plane, with UVs computed from world position so the map lands exactly
 * on the world grid. Outside the map, clamp-to-edge repeats the snow.
 */
export function createGroundGeometry() {
  const minX = -280
  const maxX = 280
  const minZ = GROUND_NORTH_EDGE
  const maxZ = 280
  const geometry = new PlaneGeometry(maxX - minX, maxZ - minZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    uv.setXY(i, (x - MAP.minX) / MAP_W, 1 - (z - MAP.minZ) / MAP_H)
  }
  uv.needsUpdate = true
  geometry.setAttribute('aStyle', new BufferAttribute(new Float32Array(position.count), 1))
  return geometry
}
