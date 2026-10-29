import { useEffect, useRef } from 'react'

/**
 * Keyboard state in a plain object, deliberately *not* React state.
 *
 * Movement is read every frame inside `useFrame`; routing keydown/keyup through
 * React state would re-render the whole scene 60x a second for no benefit. One shared
 * object, so the player and the slingshot read the same keys.
 */
const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'rocket',
  ShiftRight: 'rocket',
}

export const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  rocket: false,
}

let installed = 0
const set = (code, value) => {
  const action = KEY_MAP[code]
  if (action) keys[action] = value
}
const onKeyDown = (e) => {
  // Typing in a field (chat, a lobby code) isn't steering.
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (KEY_MAP[e.code]) e.preventDefault() // stop Space scrolling the page
  set(e.code, true)
}
const onKeyUp = (e) => set(e.code, false)
// Alt-tabbing away mid-ride otherwise leaves a key stuck down.
const onBlur = () => {
  for (const action of Object.keys(keys)) keys[action] = false
}

export function useKeyboard() {
  const ref = useRef(keys)
  useEffect(() => {
    if (installed++ === 0) {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      window.addEventListener('blur', onBlur)
    }
    return () => {
      if (--installed > 0) return
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
  return ref
}

export default useKeyboard
