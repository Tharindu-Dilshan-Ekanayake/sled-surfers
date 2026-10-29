import { useLayoutEffect, useRef, useState } from 'react'

import { useClearTop } from '../../bloxity/reserved'
import { useGame } from '../../store/game'
import CoinPacks from './CoinPacks'
import Currency from './Currency'
import LeftMenu from './LeftMenu'
import PlayBar from './PlayBar'
import { Prompts, Toast } from './Prompts'
import PullHud from './PullHud'
import RaceBar from './RaceBar'
import RaceResults from './RaceResults'
import ResultCard from './ResultCard'
import RideHud from './RideHud'
import { u } from './style'
import TopBar from './TopBar'

/**
 * The heads-up display, laid out like the reference. In the lobby: Coins, Diamonds and
 * your world top-left, the menu tiles and gifts down the left, the coin packs down the
 * right, PLAY and the four upgrade cards along the bottom. On the slingshot: the pull
 * bar. Down the slide: the ride's own HUD. At the end: the results card.
 *
 * The root ignores pointer events so the canvas and joystick underneath keep working;
 * only the buttons themselves opt back in. While a panel is open the HUD steps aside.
 */
/**
 * The left column's scale: 1, or less when the screen is too short for it below the
 * platform's toolbar and chat (a phone on its side), so none of it is ever cut off.
 */
function useFitHeight(ref, clear) {
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const fit = () => {
      // Measured from where it starts (its scale is about its top-left corner).
      const room = window.innerHeight - el.getBoundingClientRect().top - 10
      const height = el.offsetHeight
      setScale(height > room && height > 0 ? Math.max(0.5, room / height) : 1)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    window.addEventListener('resize', fit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [ref, clear])
  return scale
}

export function HUD() {
  const panelOpen = useGame((s) => s.panel !== null)
  const phase = useGame((s) => s.phase)
  // Boxity's toolbar and chat feed run down the top-left: the left column starts under them.
  const clear = useClearTop(0, 0.22)
  const columnRef = useRef(null)
  const columnScale = useFitHeight(columnRef, clear)
  return (
    <div className="pp-font pointer-events-none absolute inset-0 z-20 select-none">
      <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: panelOpen ? 0 : 1, visibility: panelOpen ? 'hidden' : 'visible' }}>
        {/* Hidden, not unmounted, while riding: remounting them after every ride cost a
            visible hitch on slow phones. */}
        <div className="contents" style={{ visibility: phase === 'lobby' ? 'visible' : 'hidden' }}>
          <TopBar />
          <div
            ref={columnRef}
            className="pointer-events-none absolute flex flex-col"
            style={{ left: u(14), top: `calc(${u(clear ? 12 : 150)} + ${clear}px)`, transform: columnScale < 1 ? `scale(${columnScale})` : undefined, transformOrigin: 'top left' }}
          >
            <Currency />
            <LeftMenu />
          </div>
          <CoinPacks />
          <PlayBar />
        </div>
        {phase === 'lobby' && <Prompts />}
        {phase === 'pull' && <PullHud />}
        {phase === 'ride' && <RideHud />}
        {phase === 'result' && <ResultCard />}
        <RaceBar />
        <RaceResults />
        <Toast />
      </div>
    </div>
  )
}

export default HUD
