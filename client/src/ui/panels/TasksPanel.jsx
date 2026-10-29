import { TASK_CHEST, TASKS } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import { BrightPanel } from './Panel'

/** How a task's goal reads: "3 rides", "300m", "40 coins"... */
function goalText(task) {
  const { kind, goal } = task
  if (kind === 'distance') return `${formatNumber(goal)}m`
  if (kind === 'rides') return `${goal} rides`
  if (kind === 'coins') return `${goal} coins`
  if (kind === 'upgrades') return `${goal} upgrades`
  if (kind === 'smash') return `Smash ${goal} walls`
  return `${goal} boost pads`
}

/**
 * The DAILY TASKS panel, as in the reference: three tasks for today, each with its
 * progress bar (CLAIM once done) and the Diamonds it pays; claim all three and the
 * chest along the bottom opens.
 */
export default function TasksPanel() {
  const tasks = useGame((s) => s.profile.tasks)
  // Done first, as in the reference: claimable ones on top.
  const order = tasks.list.map((task, index) => ({ task, index })).sort((a, b) => Number(b.task.progress >= b.task.goal && !b.task.claimed) - Number(a.task.progress >= a.task.goal && !a.task.claimed))
  const allClaimed = tasks.list.length > 0 && tasks.list.every((t) => t.claimed)
  return (
    <BrightPanel title="DAILY TASKS" icon="tasks" header="linear-gradient(180deg, #6fb6ff 0%, #2f7bff 100%)" width={760}>
      <div className="flex flex-col" style={{ gap: u(16) }}>
        {order.map(({ task, index }) => {
          const info = TASKS[task.kind]
          const done = task.progress >= task.goal
          return (
            <div key={task.kind} className="flex items-center" style={{ gap: u(18), padding: u(12), background: done && !task.claimed ? 'linear-gradient(180deg, #ffd84a, #ffb21e)' : '#f4f7fb', border: `${u(5)} solid ${done && !task.claimed ? '#e08a00' : '#9aa9c9'}`, borderRadius: u(20), opacity: task.claimed ? 0.6 : 1 }}>
              <div className="flex items-center justify-center" style={{ width: u(104), height: u(104), background: '#fff', border: `${u(4)} solid #9aa9c9`, borderRadius: u(16) }}>
                <Icon name={info.icon} size={u(80)} />
              </div>
              <div className="flex flex-1 flex-col" style={{ gap: u(8) }}>
                <span style={{ fontSize: u(40) }}>
                  <StrokeText stroke={u(8)}>{goalText(task)}</StrokeText>
                </span>
                {task.claimed ? (
                  <span className="flex items-center" style={{ gap: u(8), fontSize: u(30) }}>
                    <Icon name="check" size={u(40)} />
                    <StrokeText stroke={u(6)}>DONE!</StrokeText>
                  </span>
                ) : done ? (
                  <ChunkyButton onClick={() => actions.claimTask(index)} gradient={GRADIENTS.greenButton} radius={14} style={{ width: u(240), height: u(62), fontSize: u(32) }}>
                    <StrokeText stroke={u(6)}>CLAIM</StrokeText>
                  </ChunkyButton>
                ) : (
                  <div className="relative overflow-hidden" style={{ height: u(44), background: '#2b3c78', border: `${u(4)} solid #14214a`, borderRadius: u(22) }}>
                    <div style={{ width: `${(task.progress / task.goal) * 100}%`, height: '100%', background: 'linear-gradient(180deg, #8ff0ff, #2fb8ff)' }} />
                    <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: u(26) }}>
                      <StrokeText stroke={u(5)}>
                        {formatNumber(task.progress)}/{formatNumber(task.goal)}
                      </StrokeText>
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center" style={{ gap: u(4), fontSize: u(52) }}>
                <Icon name="diamond" size={u(72)} />
                <StrokeText stroke={u(8)}>{info.diamonds}</StrokeText>
              </div>
            </div>
          )
        })}
        <div className="flex items-center" style={{ gap: u(20), padding: u(16), background: 'linear-gradient(180deg, #4a7bd6, #2b4d9e)', border: `${u(5)} solid #14214a`, borderRadius: u(22) }}>
          <Icon name="chest:blue" size={u(110)} />
          <div className="flex" style={{ gap: u(12) }}>
            {tasks.list.map((t) => (
              <span key={t.kind} className="flex items-center justify-center rounded-full" style={{ width: u(64), height: u(64), background: t.claimed ? '#3fd14a' : '#14214a', border: `${u(5)} solid #fff` }}>
                {t.claimed && <Icon name="check" size={u(40)} />}
              </span>
            ))}
          </div>
          <ChunkyButton
            onClick={() => actions.claimTaskChest()}
            disabled={!allClaimed || tasks.chest}
            gradient={allClaimed && !tasks.chest ? GRADIENTS.goldButton : GRADIENTS.greyButton}
            radius={16}
            style={{ marginLeft: 'auto', width: u(240), height: u(84), gap: u(8), fontSize: u(30), flexDirection: 'column' }}
          >
            {tasks.chest ? (
              <StrokeText stroke={u(6)}>OPENED!</StrokeText>
            ) : allClaimed ? (
              <StrokeText stroke={u(6)}>OPEN!</StrokeText>
            ) : (
              <Icon name="lock" size={u(52)} />
            )}
          </ChunkyButton>
        </div>
        <span className="text-center" style={{ fontSize: u(24) }}>
          <StrokeText stroke={u(5)}>
            Chest: {formatNumber(TASK_CHEST.coins)}+ Coins and {TASK_CHEST.diamonds} Diamonds · New tasks every day
          </StrokeText>
        </span>
      </div>
    </BrightPanel>
  )
}
