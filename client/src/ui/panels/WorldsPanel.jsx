import { DIAMOND_SHOP, NEXT_WORLD, WORLDS } from '@shared/balance'
import { worldProgress, worldUnlocked } from '@shared/logic'

import { countdownText } from '../../game/labels/lobbyLabels'
import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import useNow from '../useNow'
import { buyWithDiamonds } from '../diamondShop'
import { BrightPanel } from './Panel'

/**
 * Each world's picture, drawn in CSS (nothing to download): its sky, a far range and
 * near hills, the slide running away into them in the world's colours, and what's in
 * the air there - snow, the desert sun, embers, stars.
 */
const SCENES = {
  snowy: { sky: ['#4fa8ff', '#d4ecff'], far: ['#e9f3ff', '#8fa9d6'], near: ['#ffffff', '#d6e6f7'], slide: ['#d6f0ff', '#4fa3f0'], rim: '#ffffff', air: 'radial-gradient(circle, rgba(255,255,255,.95) 0 1.6px, transparent 2.2px)', props: '#1f8f4a' },
  gold: { sky: ['#ff9a3c', '#ffe6ad'], far: ['#f0a868', '#c96f3a'], near: ['#f8d88e', '#e2ac5c'], slide: ['#ffe9b0', '#f08c2a'], rim: '#fff3d6', sun: '#fff1a8', props: '#3faa4a' },
  lava: { sky: ['#2a1640', '#ff7a4a'], far: ['#5a3446', '#2e1e2c'], near: ['#4a3a44', '#2a2024'], slide: ['#ffd24a', '#ff4a1a'], rim: '#ffb03a', air: 'radial-gradient(circle, rgba(255,170,60,.95) 0 1.6px, transparent 2.4px)', props: '#ff7a1a' },
  next: { sky: ['#5a2fc6', '#d6b8ff'], far: ['#b49cff', '#7a5ae0'], near: ['#e2d6ff', '#a98cff'], slide: ['#ffffff', '#b9a2ff'], rim: '#ffffff', air: 'radial-gradient(circle, rgba(255,255,255,.9) 0 1.2px, transparent 1.8px)', props: '#ffffff' },
}

const fill = { position: 'absolute', inset: 0 }

function WorldArt({ id, locked }) {
  const scene = SCENES[id] ?? SCENES.next
  return (
    <div className="relative w-full overflow-hidden" style={{ height: u(210), border: `${u(4)} solid #14214a`, borderRadius: u(16), boxShadow: `inset 0 ${u(4)} 0 rgba(255,255,255,.35)` }}>
      <div style={{ ...fill, filter: locked ? 'grayscale(0.55) brightness(0.62)' : 'none' }}>
        <div style={{ ...fill, background: `linear-gradient(180deg, ${scene.sky[0]} 0%, ${scene.sky[1]} 62%)` }} />
        {scene.sun && <div style={{ position: 'absolute', right: '14%', top: '10%', width: '26%', aspectRatio: '1', borderRadius: '50%', background: `radial-gradient(circle, ${scene.sun} 0 45%, rgba(255,241,168,.35) 46% 62%, transparent 63%)` }} />}
        {scene.air && <div style={{ ...fill, backgroundImage: scene.air, backgroundSize: `${u(26)} ${u(22)}`, opacity: 0.85 }} />}
        {/* The far range, then the near hills. */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '30%', height: '48%', background: `linear-gradient(180deg, ${scene.far[0]}, ${scene.far[1]})`, clipPath: 'polygon(0 100%, 0 52%, 10% 26%, 21% 48%, 34% 8%, 47% 44%, 60% 14%, 72% 46%, 85% 18%, 100% 42%, 100% 100%)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '44%', background: `linear-gradient(180deg, ${scene.near[0]}, ${scene.near[1]})`, clipPath: 'polygon(0 100%, 0 26%, 16% 8%, 32% 30%, 50% 14%, 68% 28%, 84% 6%, 100% 24%, 100% 100%)' }} />
        {/* A few trees (cacti, spires) on the hills. */}
        {[
          [9, 36, 1],
          [22, 40, 0.8],
          [78, 38, 1],
          [90, 33, 0.75],
        ].map(([x, y, s], i) => (
          <div key={i} style={{ position: 'absolute', left: `${x}%`, bottom: `${y - 18}%`, width: `${7 * s}%`, height: `${20 * s}%`, background: scene.props, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)', opacity: 0.95 }} />
        ))}
        {/* The slide, running away into the hills: its rim, then its floor. */}
        <div style={{ position: 'absolute', left: '50%', bottom: 0, width: '74%', height: '66%', transform: 'translateX(-50%)', background: scene.rim, clipPath: 'polygon(45% 0, 55% 0, 100% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', left: '50%', bottom: 0, width: '62%', height: '64%', transform: 'translateX(-50%)', background: `linear-gradient(180deg, ${scene.slide[0]}, ${scene.slide[1]})`, clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)' }} />
        <div style={{ position: 'absolute', left: '50%', bottom: 0, width: '14%', height: '64%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,.45)', clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)' }} />
      </div>
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon name="lock" size={u(100)} className="pp-icon-drop" />
        </div>
      )}
    </div>
  )
}

function Card({ number, name, art, selected, children, locked }) {
  return (
    <div
      className="relative flex flex-col items-center"
      style={{
        width: u(300),
        padding: u(14),
        paddingTop: u(18),
        background: selected ? 'linear-gradient(180deg, #fff9df, #ffeaa8)' : 'linear-gradient(180deg, #ffffff, #e6eefb)',
        border: `${u(5)} solid ${selected ? '#ffb21e' : '#14214a'}`,
        borderRadius: u(24),
        boxShadow: selected ? `0 0 0 ${u(5)} rgba(255,210,58,.45), 0 ${u(8)} 0 rgba(20,33,74,.35)` : `0 ${u(8)} 0 rgba(20,33,74,.25)`,
      }}
    >
      <span className="absolute z-10 flex items-center justify-center rounded-full" style={{ left: u(-16), top: u(-20), width: u(66), height: u(66), background: 'linear-gradient(180deg, #fff27a, #ffb21e)', border: `${u(5)} solid #14214a`, fontSize: u(36) }}>
        <StrokeText stroke={u(6)}>{number}</StrokeText>
      </span>
      <WorldArt id={art} locked={locked} />
      <span style={{ fontSize: u(38), marginTop: u(12), whiteSpace: 'nowrap' }}>
        <StrokeText stroke={u(8)}>{name}</StrokeText>
      </span>
      {children}
    </div>
  )
}

/**
 * The WORLDS panel, as in the reference: Snowy Peaks with how far through it your best
 * ride got; each world after it locked until you beat the one before (or opened early
 * with Diamonds); the next world, coming soon with a countdown and NOTIFY ME.
 */
export default function WorldsPanel() {
  const profile = useGame((s) => s.profile)
  const showToast = useGame((s) => s.showToast)
  const now = useNow(30000)
  return (
    <BrightPanel title="WORLDS" icon="worlds" header="linear-gradient(180deg, #6fb6ff 0%, #2f7bff 100%)" width={1400}>
      <div className="flex flex-wrap justify-center" style={{ gap: u(26), paddingTop: u(14) }}>
        {WORLDS.map((world, i) => {
          const open = worldUnlocked(profile, i)
          const here = profile.world === i
          const pct = Math.floor(worldProgress(profile, i) * 100)
          return (
            <Card key={world.id} number={i + 1} name={world.name.toUpperCase()} art={world.id} selected={here} locked={!open}>
              {open ? (
                <>
                  <div className="relative w-full overflow-hidden" style={{ height: u(40), marginTop: u(8), background: '#2b3c78', border: `${u(4)} solid #14214a`, borderRadius: u(20) }}>
                    <div style={{ width: `${Math.max(4, pct)}%`, height: '100%', background: 'linear-gradient(180deg, #8ff0ff, #2fb8ff)' }} />
                    <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: u(24) }}>
                      <StrokeText stroke={u(5)}>{pct}%</StrokeText>
                    </span>
                  </div>
                  <ChunkyButton onClick={() => (here ? null : actions.setWorld(i))} gradient={GRADIENTS.greenButton} radius={14} style={{ marginTop: u(14), width: '100%', height: u(74), gap: u(10), fontSize: u(36) }}>
                    {here && <Icon name="check" size={u(44)} />}
                    <StrokeText stroke={u(7)}>{here ? "YOU'RE HERE" : 'GO!'}</StrokeText>
                  </ChunkyButton>
                </>
              ) : (
                <>
                  <span style={{ fontSize: u(21), marginTop: u(6), textAlign: 'center', lineHeight: 1.1, maxWidth: '100%' }}>
                    <StrokeText stroke={u(5)}>Beat {WORLDS[i - 1].name} first</StrokeText>
                  </span>
                  <div className="flex w-full" style={{ marginTop: u(14), gap: u(10) }}>
                    <ChunkyButton disabled gradient={GRADIENTS.greyButton} radius={14} style={{ flex: 2, height: u(74) }}>
                      <Icon name="lock" size={u(44)} />
                    </ChunkyButton>
                    <ChunkyButton
                      onClick={() => buyWithDiamonds(`world_${world.id}`)}
                      gradient={profile.diamonds >= DIAMOND_SHOP[`world_${world.id}`].diamonds ? GRADIENTS.greenButton : GRADIENTS.greyButton}
                      radius={14}
                      style={{ flex: 1, height: u(74), flexDirection: 'column', fontSize: u(26) }}
                    >
                      <Icon name="diamond" size={u(30)} />
                      <StrokeText stroke={u(5)}>{DIAMOND_SHOP[`world_${world.id}`].diamonds}</StrokeText>
                    </ChunkyButton>
                  </div>
                </>
              )}
            </Card>
          )
        })}
        <Card number={WORLDS.length + 1} name={NEXT_WORLD.name.toUpperCase()} art="next">
          <span style={{ fontSize: u(24), marginTop: u(6) }}>
            <StrokeText stroke={u(5)}>Opens in {countdownText(now)}</StrokeText>
          </span>
          <ChunkyButton
            onClick={() => {
              actions.notifyMe()
              showToast("We'll let you know!")
            }}
            gradient={GRADIENTS.goldButton}
            radius={14}
            style={{ marginTop: u(14), width: '100%', height: u(74), gap: u(10), fontSize: u(34) }}
          >
            <Icon name="bell" size={u(44)} />
            <StrokeText stroke={u(7)}>{profile.notify ? 'NOTIFYING!' : 'NOTIFY ME'}</StrokeText>
          </ChunkyButton>
        </Card>
      </div>
    </BrightPanel>
  )
}
