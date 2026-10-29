import { useState } from 'react'

import { DIAMOND_SHOP, SLEDS, sledSpeedPercent, TIERS, WORLD_SLEDS, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { nextSled, worldUnlocked } from '@shared/logic'

import { useSledIcon } from '../../game/sleds/sledIcons'
import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import { buyWithDiamonds } from '../diamondShop'
import { BrightPanel } from './Panel'

/** A sled's portrait; a dark silhouette until you can buy it. */
function SledPicture({ id, size, dark }) {
  const url = useSledIcon(id)
  if (!url) return <Icon name="sled" size={u(size)} style={{ opacity: 0.25 }} />
  return <img src={url} alt="" draggable={false} style={{ width: u(size), height: u(size), filter: dark ? 'brightness(0.15) saturate(0)' : 'none', opacity: dark ? 0.75 : 1 }} />
}

const TIER_COLORS = { gold: '#ffc61e', diamond: '#5fd2ff', ruby: '#e2244a', galaxy: '#6a3fd6' }

function SledCell({ sled, profile }) {
  const owned = profile.sleds.includes(sled.id)
  const equipped = profile.sled === sled.id
  const next = nextSled(profile, WORLDS.findIndex((w) => w.id === sled.world))?.id === sled.id
  const affordable = profile.coins >= sled.cost
  const tier = TIERS.find((t) => t.id === sled.tier)
  const base = sled.tier === 'base'
  return (
    <div className="relative flex flex-col items-center" style={{ width: base ? u(250) : u(170) }}>
      {sled.index > 0 && (
        <span className="absolute z-10" style={{ top: u(132), left: u(-6), padding: `0 ${u(8)}`, background: '#3fd14a', border: `${u(3)} solid #fff`, borderRadius: u(12), transform: 'rotate(-6deg)', fontSize: u(20) }}>
          <StrokeText stroke={u(4)}>+{sledSpeedPercent(sled)}%</StrokeText>
        </span>
      )}
      <div className="relative flex w-full flex-col items-center" style={{ height: u(170), background: '#ffffff', border: `${u(4)} solid ${equipped ? '#ffc61e' : '#c9d3e6'}`, borderRadius: u(16) }}>
        <span style={{ fontSize: base ? u(30) : u(26), height: u(34) }}>
          {base ? <StrokeText stroke={u(6)}>{sled.name}</StrokeText> : <StrokeText stroke={u(5)} fill={TIER_COLORS[sled.tier]}>{tier.name.toUpperCase()}</StrokeText>}
        </span>
        <SledPicture id={sled.id} size={118} dark={!owned && !next} />
        {!owned && !next && <Icon name="lock" size={u(40)} style={{ position: 'absolute', right: u(6), bottom: u(6) }} />}
      </div>
      {equipped ? (
        <ChunkyButton gradient={GRADIENTS.greenButton} radius={12} style={{ marginTop: u(6), width: '100%', height: u(58) }}>
          <Icon name="check" size={u(40)} />
        </ChunkyButton>
      ) : owned ? (
        <ChunkyButton onClick={() => actions.equipSled(sled.id)} gradient={GRADIENTS.blueButton} radius={12} style={{ marginTop: u(6), width: '100%', height: u(58), fontSize: u(30) }}>
          <StrokeText stroke={u(6)}>EQUIP</StrokeText>
        </ChunkyButton>
      ) : (
        <ChunkyButton
          onClick={() => (next && affordable ? actions.buySled(sled.id) : null)}
          disabled={!next}
          gradient={next && affordable ? GRADIENTS.greenButton : GRADIENTS.greyButton}
          radius={12}
          style={{ marginTop: u(6), width: '100%', height: u(58), gap: u(6), fontSize: u(30) }}
        >
          <Icon name="coin" size={u(34)} />
          <StrokeText stroke={u(6)}>{formatNumber(sled.cost)}</StrokeText>
        </ChunkyButton>
      )}
    </div>
  )
}

/** A premium sled on top: SKIP TO its place in the list, for Diamonds. */
function Premium({ id, product, profile, background }) {
  const sled = SLEDS[id]
  const owned = profile.sleds.includes(id)
  return (
    <div className="flex flex-1 items-center" style={{ gap: u(16), padding: u(12), background, border: `${u(5)} solid #9aa9c9`, borderRadius: u(20) }}>
      <div className="flex flex-col items-center" style={{ width: u(190), background: 'rgba(255,255,255,.7)', borderRadius: u(14) }}>
        <SledPicture id={id} size={130} />
        <span style={{ fontSize: u(26), marginTop: u(-16) }}>
          <StrokeText stroke={u(5)}>{sled.name}</StrokeText>
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center" style={{ gap: u(10) }}>
        <span style={{ padding: `${u(2)} ${u(18)}`, background: 'linear-gradient(180deg, #7dff6a, #2fc53a)', border: `${u(4)} solid #14214a`, borderRadius: u(16), fontSize: u(28) }}>
          <StrokeText stroke={u(5)}>SKIP TO {sled.index + 1} · +{sledSpeedPercent(sled)}%</StrokeText>
        </span>
        {owned ? (
          <ChunkyButton
            onClick={() => actions.equipSled(id)}
            gradient={profile.sled === id ? GRADIENTS.greenButton : GRADIENTS.blueButton}
            radius={14}
            style={{ width: u(220), height: u(76), fontSize: u(34) }}
          >
            <StrokeText stroke={u(7)}>{profile.sled === id ? 'EQUIPPED' : 'EQUIP'}</StrokeText>
          </ChunkyButton>
        ) : (
          <ChunkyButton
            onClick={() => buyWithDiamonds(product)}
            gradient={profile.diamonds >= DIAMOND_SHOP[product].diamonds ? GRADIENTS.greenButton : GRADIENTS.greyButton}
            radius={14}
            style={{ width: u(220), height: u(76), gap: u(10), fontSize: u(40) }}
          >
            <Icon name="diamond" size={u(46)} />
            <StrokeText stroke={u(7)}>{DIAMOND_SHOP[product].diamonds}</StrokeText>
          </ChunkyButton>
        )}
      </div>
    </div>
  )
}

/**
 * The SLEDS panel, as in the reference: a tab per world down its side; the two premium
 * sleds across the top; then the world's sleds row by row, each shape in its plain,
 * Gold, Diamond, Ruby and Galaxy finish - bought in order (the next one green when you
 * can afford it, the rest locked silhouettes), equipped with a tap.
 */
export default function SledsPanel() {
  const profile = useGame((s) => s.profile)
  const [tab, setTab] = useState(() => (profile.world > 0 && worldUnlocked(profile, profile.world) ? profile.world : 0))
  const world = WORLDS[tab]
  const ids = WORLD_SLEDS[world.id]
  const rows = []
  // A row per shape, its finishes across (they're bought shape by shape, then finish by finish).
  for (const shape of new Set(ids.map((id) => SLEDS[id].shape))) rows.push(ids.filter((id) => SLEDS[id].shape === shape))
  const side = WORLDS.map((w, i) => {
    const open = worldUnlocked(profile, i)
    return (
      <ChunkyButton
        key={w.id}
        onClick={() => open && setTab(i)}
        gradient={i === tab ? GRADIENTS.greenButton : GRADIENTS.greyButton}
        radius={16}
        style={{ width: u(230), height: u(84), gap: u(8), fontSize: u(38) }}
      >
        <StrokeText stroke={u(7)}>WORLD {i + 1}</StrokeText>
        {!open && <Icon name="lock" size={u(36)} />}
      </ChunkyButton>
    )
  })
  return (
    <BrightPanel title={`WORLD ${tab + 1} SLEDS`} header="linear-gradient(180deg, #ff9cc8 0%, #ff4f9a 100%)" width={1180} side={side}>
      {tab === 0 && (
        <div className="flex" style={{ gap: u(18), marginBottom: u(20) }}>
          <Premium id="unicorn" product="sled_unicorn" profile={profile} background="linear-gradient(180deg, #e6f6ff, #cfe9ff)" />
          <Premium id="orca" product="sled_orca" profile={profile} background="linear-gradient(180deg, #efe6ff, #d9c9ff)" />
        </div>
      )}
      <div className="flex flex-col" style={{ gap: u(26) }}>
        {rows.map((row) => (
          <div key={row[0]} className="flex items-end" style={{ gap: u(14), padding: u(14), paddingTop: u(22), background: '#dfe8f6', border: `${u(4)} solid #c3cfe6`, borderRadius: u(20) }}>
            {row.map((id) => (
              <SledCell key={id} sled={SLEDS[id]} profile={profile} />
            ))}
          </div>
        ))}
      </div>
    </BrightPanel>
  )
}
