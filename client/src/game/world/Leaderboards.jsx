import { useEffect, useMemo } from 'react'
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'

import { LEADERBOARDS } from '@shared/world'

import { useGame } from '../../store/game'
import { useQuality } from '../../store/quality'
import { BlockSet, disposeBlocks } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { BOARD_INFO, boardRows } from './boards'

const BOARD_W = 9
const BOARD_H = 7
const BOARD_BOTTOM = 1.4
const FONT = '"Fredoka One", "Arial Rounded MT Bold", sans-serif'

/** Draws one board's face, filling the canvas: its coloured title and its top ten. */
function drawBoard(ctx, w, h, board, leaderboards, profile) {
  const info = BOARD_INFO[board.id]
  const pad = w * 0.03
  ctx.clearRect(0, 0, w, h)
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#1d2a5c')
  grad.addColorStop(1, '#101634')
  ctx.fillStyle = grad
  ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2)

  // Title strip.
  const titleH = h * 0.15
  ctx.fillStyle = info.color
  ctx.fillRect(pad, pad, w - pad * 2, titleH)
  ctx.font = `${titleH * 0.62}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = titleH * 0.12
  ctx.strokeStyle = '#111'
  ctx.strokeText(info.title, w / 2, pad + titleH / 2)
  ctx.fillStyle = '#fff'
  ctx.fillText(info.title, w / 2, pad + titleH / 2)

  const rows = boardRows(leaderboards, profile, board.id).slice(0, 10)
  const rowH = (h - titleH - pad * 3) / 10
  rows.forEach((row, r) => {
    const y = pad * 2 + titleH + r * rowH
    if (r % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(pad, y, w - pad * 2, rowH)
    }
    const cy = y + rowH / 2
    ctx.font = `${rowH * 0.66}px ${FONT}`
    // A thin dark edge on every word keeps it readable from an angle.
    ctx.lineWidth = rowH * 0.1
    ctx.strokeStyle = '#0b0f24'
    const text = (value, x, fill, align) => {
      ctx.textAlign = align
      ctx.strokeText(value, x, cy)
      ctx.fillStyle = fill
      ctx.fillText(value, x, cy)
    }
    text(`#${r + 1}`, pad * 2.5, r === 0 ? '#ffd21f' : r === 1 ? '#d9e2ec' : r === 2 ? '#e8a066' : '#9fb2d9', 'left')
    text(row.name.length > 14 ? `${row.name.slice(0, 13)}…` : row.name, w * 0.2, '#ffffff', 'left')
    text(info.format(row.value), w - pad * 2.5, info.color, 'right')
  })
}

/**
 * The three leaderboards behind spawn (Playtime, Distance, Coins). Frames are blocks;
 * each face is a quad with a canvas texture of its own, as wide as the preset allows, so
 * the names stay sharp - redrawn when the boards update (once a minute).
 */
export function Leaderboards() {
  const leaderboards = useGame((s) => s.leaderboards)
  const profile = useGame((s) => s.profile)
  const playable = useGame((s) => s.playable)

  const assets = useMemo(() => {
    const { maxTexture } = useQuality.getState().settings
    const width = Math.min(1024, maxTexture)
    // One face per board, facing -Z (the plaza).
    const faces = LEADERBOARDS.map((board) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = Math.round(width * (BOARD_H / BOARD_W))
      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      texture.minFilter = LinearMipmapLinearFilter
      texture.magFilter = LinearFilter
      // Seen at an angle from most of the plaza: anisotropic filtering keeps it sharp.
      texture.anisotropy = maxTexture > 512 ? 8 : 4
      const geometry = new PlaneGeometry(BOARD_W, BOARD_H)
      geometry.rotateY(Math.PI)
      geometry.translate(board.x, BOARD_BOTTOM + BOARD_H / 2, board.z - 0.55)
      return { board, canvas, texture, geometry, material: new MeshBasicMaterial({ map: texture }) }
    })

    const frames = new BlockSet()
    for (const b of LEADERBOARDS) {
      frames.addOn(b.x, 0, b.z, BOARD_W + 0.8, BOARD_BOTTOM + BOARD_H + 0.6, 0.9, '#1d2a5c')
      frames.addOn(b.x, BOARD_BOTTOM + BOARD_H + 0.6, b.z, BOARD_W + 1.2, 0.6, 1.1, BOARD_INFO[b.id].color, STYLE.GLOW)
      for (const dx of [-BOARD_W / 2, BOARD_W / 2]) frames.addOn(b.x + dx, 0, b.z + 0.3, 0.6, BOARD_BOTTOM + 0.2, 0.6, '#1b1b1f')
    }
    return { faces, frames: frames.build(sharedMaterials().blocks) }
  }, [])

  useEffect(
    () => () => {
      for (const face of assets.faces) {
        face.texture.dispose()
        face.geometry.dispose()
        face.material.dispose()
      }
      disposeBlocks(assets.frames)
    },
    [assets],
  )

  useEffect(() => {
    // Not needed to start playing: drawn once the game is on screen.
    if (!playable) return undefined
    let cancelled = false
    document.fonts?.load(`32px ${FONT}`).finally(() => {
      if (cancelled) return
      for (const face of assets.faces) {
        drawBoard(face.canvas.getContext('2d'), face.canvas.width, face.canvas.height, face.board, leaderboards, profile)
        face.texture.needsUpdate = true
      }
    })
    return () => {
      cancelled = true
    }
    // Profile changes with every coin; offline boards only need the name and headline
    // stats, which a new best brings along.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, playable, leaderboards, profile.stats.bestDistance, profile.name])

  return (
    <>
      <primitive object={assets.frames} />
      {assets.faces.map((face) => (
        <mesh key={face.board.id} geometry={face.geometry} material={face.material} />
      ))}
    </>
  )
}

export default Leaderboards
