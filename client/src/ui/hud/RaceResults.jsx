import { useEffect } from 'react'

import { formatNumber } from '@shared/format'

import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

const MEDALS = ['#ffd23a', '#d9e2ec', '#e8a066']
/** How long the results stay up unless closed. */
const SHOW_MS = 14000

/**
 * How the race went, once everyone in it has stopped: the standings (with the Diamonds
 * the top three won), your place, and - with too few racing - that prizes need more.
 * Shown back in the lobby, over nothing that matters; closes itself.
 */
export function RaceResults() {
  const result = useGame((s) => s.raceResult)
  const phase = useGame((s) => s.phase)
  const close = () => useGame.setState({ raceResult: null })
  useEffect(() => {
    if (!result) return undefined
    const id = setTimeout(() => useGame.setState({ raceResult: null }), SHOW_MS)
    return () => clearTimeout(id)
  }, [result])
  if (!result || phase !== 'lobby') return null

  return (
    <div className="pp-card-in pointer-events-auto absolute left-1/2 top-1/2 flex flex-col items-center" style={{ width: u(560), padding: `0 0 ${u(18)}`, background: '#f4f7fb', border: `${u(6)} solid #14214a`, borderRadius: u(28), transform: 'translate(-50%, -50%)' }}>
      <div className="flex w-full items-center justify-center" style={{ height: u(90), gap: u(12), background: 'linear-gradient(180deg, #ffd23a 0%, #ff9a12 100%)', borderRadius: `${u(22)} ${u(22)} 0 0`, fontSize: u(50) }}>
        <Icon name="flag" size={u(60)} />
        <StrokeText stroke={u(9)}>RACE RESULTS</StrokeText>
      </div>
      <span style={{ fontSize: u(40), marginTop: u(12) }}>
        <StrokeText stroke={u(8)} gradient={result.place === 1 ? GRADIENTS.gold : undefined}>{`You came ${ordinal(result.place)} of ${result.of}!`}</StrokeText>
      </span>
      <div className="flex w-full flex-col" style={{ padding: `${u(10)} ${u(26)}`, gap: u(8) }}>
        {result.standings.map((row, i) => {
          const you = i + 1 === result.place
          return (
            <div key={i} className="flex items-center" style={{ gap: u(14), padding: `${u(8)} ${u(16)}`, background: you ? '#fff1b8' : '#dfe8f6', border: `${u(4)} solid ${you ? '#ffb21e' : '#c3cfe6'}`, borderRadius: u(16), fontSize: u(30) }}>
              <span className="flex items-center justify-center rounded-full" style={{ width: u(46), height: u(46), background: MEDALS[i] ?? '#9fb2d9', border: `${u(4)} solid #14214a`, fontSize: u(26) }}>
                <StrokeText stroke={u(5)}>{i + 1}</StrokeText>
              </span>
              <span className="flex-1 truncate text-left">
                <StrokeText stroke={u(6)}>{you ? `${row.name} (you)` : row.name}</StrokeText>
              </span>
              <StrokeText stroke={u(6)}>{`${formatNumber(row.distance)}m`}</StrokeText>
              {row.prize > 0 && (
                <span className="flex items-center" style={{ gap: u(4), marginLeft: u(6) }}>
                  <Icon name="diamond" size={u(32)} />
                  <StrokeText stroke={u(5)}>{`+${row.prize}`}</StrokeText>
                </span>
              )}
            </div>
          )
        })}
      </div>
      {!result.prized && (
        <span style={{ fontSize: u(24), marginBottom: u(8) }}>
          <StrokeText stroke={u(5)}>Prizes need 2 or more racers - bring a friend next time!</StrokeText>
        </span>
      )}
      <ChunkyButton onClick={close} gradient={GRADIENTS.greenButton} radius={16} border={5} style={{ width: u(240), height: u(76), fontSize: u(40) }}>
        <StrokeText stroke={u(7)}>NICE!</StrokeText>
      </ChunkyButton>
    </div>
  )
}

function ordinal(n) {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'
  return `${n}${suffix}`
}

export default RaceResults
